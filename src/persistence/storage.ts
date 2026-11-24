import { createInitialGameState } from '../domain/reducer';
import { normalizeGraphicsQuality } from '../game/graphics';
import type { GameState, PlayerId, PlayerPortrait } from '../domain/types';

export const STORAGE_KEY = 'loykratong.couple.state.v1';
const IDB_NAME = 'loykratong-local-portraits';
const IDB_STORE = 'portraits';
const IDB_VERSION = 1;
export const MAX_PORTRAIT_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_PORTRAIT_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

export function detectImageMimeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;

  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // GIF: 47 49 46 38
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return 'image/gif';
  }

  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

export function validatePortraitFileMeta(file: File | null): string | null {
  if (!file) {
    return 'ยังไม่ได้เลือกไฟล์รูปภาพ (ใช้รูปอวตารเริ่มต้นแทน)';
  }
  if (file.size <= 0) {
    return 'ไฟล์รูปภาพว่างเปล่า กรุณาเลือกไฟล์ JPG, PNG หรือ WebP';
  }
  if (file.size > MAX_PORTRAIT_BYTES) {
    return 'ไฟล์มีขนาดใหญ่เกิน 10 MB กรุณาเลือกรูปที่เล็กลง';
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeAllowed = file.type
    ? ALLOWED_PORTRAIT_MIME_TYPES.has(file.type.toLowerCase())
    : ALLOWED_EXTENSIONS.has(ext);

  if (!mimeAllowed) {
    return 'รองรับเฉพาะไฟล์รูปภาพ PNG, JPG, WebP หรือ GIF ในเครื่องเท่านั้น';
  }

  return null;
}

export interface ProcessedPortraitResult {
  portrait: PlayerPortrait;
  blob: Blob | null;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read blob as Data URL'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

function loadImageLocally(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Invalid image decode'));
    img.src = objectUrl;
  });
}

/**
 * Local-only portrait processing. Never performs network requests or external uploads.
 */
export async function processPortraitFileLocally(
  file: File | null
): Promise<ProcessedPortraitResult> {
  const metaError = validatePortraitFileMeta(file);
  const now = new Date().toISOString();

  if (metaError || !file) {
    return {
      portrait: {
        status: 'invalid',
        dataUrl: null,
        mimeType: null,
        error: metaError ?? 'ไม่พบไฟล์รูปภาพ',
        updatedAt: now,
      },
      blob: null,
    };
  }

  try {
    const headerBuffer = await file.slice(0, 12).arrayBuffer();
    const detectedMime = detectImageMimeFromBytes(new Uint8Array(headerBuffer));
    if (!detectedMime) {
      return {
        portrait: {
          status: 'invalid',
          dataUrl: null,
          mimeType: null,
          error: 'ไฟล์ไม่ใช่รูปภาพ PNG/JPG/WebP/GIF ที่ถูกต้อง ใช้ตัวละครอวตารแทนอัตโนมัติ',
          updatedAt: now,
        },
        blob: null,
      };
    }

    // Crop and downscale locally via offscreen canvas so IndexedDB/localStorage stays fast
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadImageLocally(objectUrl);
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const fallbackDataUrl = await readBlobAsDataUrl(file);
        return {
          portrait: {
            status: 'ready',
            dataUrl: fallbackDataUrl,
            mimeType: detectedMime,
            error: null,
            updatedAt: now,
          },
          blob: file,
        };
      }

      const srcSize = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
      const sx = Math.max(0, Math.floor(((img.naturalWidth || img.width) - srcSize) / 2));
      const sy = Math.max(0, Math.floor(((img.naturalHeight || img.height) - srcSize) / 2));
      ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) resolve(result);
            else reject(new Error('Canvas export failed'));
          },
          'image/png',
          0.9
        );
      });

      const dataUrl = await readBlobAsDataUrl(blob);
      return {
        portrait: {
          status: 'ready',
          dataUrl,
          mimeType: blob.type || detectedMime,
          error: null,
          updatedAt: now,
        },
        blob,
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return {
      portrait: {
        status: 'invalid',
        dataUrl: null,
        mimeType: null,
        error: 'ไม่สามารถถอดรหัสรูปภาพได้ กรุณาลองไฟล์อื่น (ใช้รูปอวตารเริ่มต้นแทนแล้ว)',
        updatedAt: now,
      },
      blob: null,
    };
  }
}

function openPortraitDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function savePortraitBlob(
  playerId: PlayerId,
  blob: Blob | null
): Promise<boolean> {
  const db = await openPortraitDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      if (blob) {
        store.put(blob, playerId);
      } else {
        store.delete(playerId);
      }
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

async function loadPortraitBlob(playerId: PlayerId): Promise<Blob | null> {
  const db = await openPortraitDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(playerId);
      req.onsuccess = () => {
        db.close();
        resolve(req.result instanceof Blob ? req.result : null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

let saveQueue: Promise<void> = Promise.resolve();

function writeSerializableToLocalStorage(serializable: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Fallback: retry without inline data URLs if storage quota is tight
    try {
      serializable.players.p1.portrait.dataUrl = null;
      serializable.players.p2.portrait.dataUrl = null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      // Ignore unrecoverable storage quota errors gracefully
    }
  }
}

/**
 * Synchronously persists a snapshot to localStorage so immediate reloads (before async
 * IndexedDB transactions settle) never lose state or unconfirmed inline portrait fallbacks.
 */
export function flushStateToLocalStorageSync(state: GameState): void {
  let existingParsed: Partial<GameState> | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      existingParsed = JSON.parse(raw) as Partial<GameState>;
    }
  } catch {
    existingParsed = null;
  }

  const prepareSyncPortrait = (
    playerId: PlayerId,
    portrait: PlayerPortrait
  ): PlayerPortrait => {
    if (portrait.status !== 'ready') {
      return {
        status: 'absent',
        dataUrl: null,
        mimeType: null,
        error: null,
        updatedAt: null,
      };
    }
    const prevPortrait = existingParsed?.players?.[playerId]?.portrait;
    const alreadyConfirmedInIdb =
      prevPortrait?.status === 'ready' &&
      prevPortrait.updatedAt === portrait.updatedAt &&
      prevPortrait.dataUrl === null;

    return {
      ...portrait,
      dataUrl: alreadyConfirmedInIdb ? null : portrait.dataUrl,
      error: null,
    };
  };

  const serializable: GameState = {
    ...state,
    players: {
      p1: {
        ...state.players.p1,
        portrait: prepareSyncPortrait('p1', state.players.p1.portrait),
      },
      p2: {
        ...state.players.p2,
        portrait: prepareSyncPortrait('p2', state.players.p2.portrait),
      },
    },
  };

  writeSerializableToLocalStorage(serializable);
}

export function savePersistedState(
  state: GameState,
  portraitBlobs?: Partial<Record<PlayerId, Blob | null>>
): Promise<void> {
  const runSave = async (): Promise<void> => {
    const idbConfirmed: Record<PlayerId, boolean> = { p1: false, p2: false };

    for (const pid of ['p1', 'p2'] as const) {
      const portrait = state.players[pid].portrait;
      if (portraitBlobs && portraitBlobs[pid] !== undefined) {
        const savedOk = await savePortraitBlob(pid, portraitBlobs[pid] ?? null);
        idbConfirmed[pid] = Boolean(portraitBlobs[pid]) && savedOk;
      } else if (portrait.status === 'ready') {
        const existingBlob = await loadPortraitBlob(pid);
        idbConfirmed[pid] = existingBlob !== null;
      }
    }

    // Strip bulky dataUrl from localStorage ONLY when IndexedDB is confirmed to hold the Blob;
    // otherwise retain the inline dataUrl fallback across all subsequent saves.
    const sanitizePortraitForStorage = (
      playerId: PlayerId,
      portrait: PlayerPortrait
    ): PlayerPortrait => {
      if (portrait.status !== 'ready') {
        return {
          status: 'absent',
          dataUrl: null,
          mimeType: null,
          error: null,
          updatedAt: null,
        };
      }
      return {
        ...portrait,
        dataUrl: idbConfirmed[playerId] ? null : portrait.dataUrl,
        error: null,
      };
    };

    const serializable: GameState = {
      ...state,
      players: {
        p1: {
          ...state.players.p1,
          portrait: sanitizePortraitForStorage('p1', state.players.p1.portrait),
        },
        p2: {
          ...state.players.p2,
          portrait: sanitizePortraitForStorage('p2', state.players.p2.portrait),
        },
      },
    };

    writeSerializableToLocalStorage(serializable);
  };

  saveQueue = saveQueue.then(runSave, runSave);
  return saveQueue;
}

export async function loadPersistedState(): Promise<GameState | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (!parsed || parsed.schemaVersion !== 1 || !parsed.players) {
      return null;
    }

    const base = createInitialGameState();
    const merged: GameState = {
      ...base,
      ...parsed,
      settings: {
        ...base.settings,
        ...(parsed.settings ?? {}),
        graphicsQuality: normalizeGraphicsQuality(parsed.settings?.graphicsQuality),
        musicEnabled: parsed.settings?.musicEnabled === true,
        highContrast: parsed.settings?.highContrast === true,
        showTouchControls: parsed.settings?.showTouchControls === true,
      },
      inventory: { ...base.inventory, ...(parsed.inventory ?? {}) },
      contributedBy: { ...base.contributedBy, ...(parsed.contributedBy ?? {}) },
      minigames: {
        recipe: { ...base.minigames.recipe, ...(parsed.minigames?.recipe ?? {}) },
        assembly: { ...base.minigames.assembly, ...(parsed.minigames?.assembly ?? {}) },
        rhythm: { ...base.minigames.rhythm, ...(parsed.minigames?.rhythm ?? {}) },
      },
      krathongDesign: {
        ...base.krathongDesign,
        ...(parsed.krathongDesign ?? {}),
      },
      coopTasks:
        parsed.coopTasks && typeof parsed.coopTasks === 'object'
          ? parsed.coopTasks
          : {},
      players: {
        p1: {
          ...base.players.p1,
          ...(parsed.players.p1 ?? {}),
          customization: {
            ...base.players.p1.customization,
            ...(parsed.players.p1?.customization ?? {}),
          },
          portrait: {
            ...base.players.p1.portrait,
            ...(parsed.players.p1?.portrait ?? {}),
          },
          position: {
            ...base.players.p1.position,
            ...(parsed.players.p1?.position ?? {}),
          },
        },
        p2: {
          ...base.players.p2,
          ...(parsed.players.p2 ?? {}),
          customization: {
            ...base.players.p2.customization,
            ...(parsed.players.p2?.customization ?? {}),
          },
          portrait: {
            ...base.players.p2.portrait,
            ...(parsed.players.p2?.portrait ?? {}),
          },
          position: {
            ...base.players.p2.position,
            ...(parsed.players.p2?.position ?? {}),
          },
        },
      },
      litLanternIds: Array.isArray(parsed.litLanternIds)
        ? parsed.litLanternIds
        : [],
      releasedKrathongs: Array.isArray(parsed.releasedKrathongs)
        ? parsed.releasedKrathongs
        : [],
    };

    // Hydrate portrait Blobs from IndexedDB if available
    for (const pid of ['p1', 'p2'] as const) {
      if (merged.players[pid].portrait.status === 'ready' && !merged.players[pid].portrait.dataUrl) {
        const blob = await loadPortraitBlob(pid);
        if (blob) {
          merged.players[pid].portrait.dataUrl = await readBlobAsDataUrl(blob);
        } else {
          // Blob missing -> fall back cleanly to absent avatar
          merged.players[pid].portrait = {
            status: 'absent',
            dataUrl: null,
            mimeType: null,
            error: null,
            updatedAt: null,
          };
        }
      }
    }

    return merged;
  } catch {
    return null;
  }
}

export async function clearAllPersistedState(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
  await savePortraitBlob('p1', null);
  await savePortraitBlob('p2', null);
}
