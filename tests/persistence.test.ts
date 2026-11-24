import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialGameState, gameReducer } from '../src/domain/reducer';
import {
  STORAGE_KEY,
  clearAllPersistedState,
  detectImageMimeFromBytes,
  loadPersistedState,
  processPortraitFileLocally,
  savePersistedState,
} from '../src/persistence/storage';

describe('Local-only persistence & portrait validation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists, reloads, and resets profiles and romantic activity memories without external network calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    let state = createInitialGameState();
    state = gameReducer(state, {
      type: 'UPDATE_PLAYER_NAME',
      playerId: 'p1',
      name: 'มะลิ',
    });
    state = gameReducer(state, {
      type: 'SET_LANTERN_WISH',
      playerId: 'p1',
      wish: 'ขอให้อยู่ข้างกันทุกปี',
    });
    state = gameReducer(state, {
      type: 'SAVE_PHOTO_MEMORY',
      pose: 'hold-hands',
      backdrop: 'sala',
      caption: 'ริมศาลาคืนเพ็ญ',
      timestamp: '2026-11-24T12:00:00.000Z',
    });

    await savePersistedState(state);
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();

    const loaded = await loadPersistedState();
    expect(loaded?.players.p1.name).toBe('มะลิ');
    expect(loaded?.skyLantern.p1Wish).toBe('ขอให้อยู่ข้างกันทุกปี');
    expect(loaded?.photoMemories).toHaveLength(1);

    await clearAllPersistedState();
    const afterReset = await loadPersistedState();
    expect(afterReset).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('rejects non-image files and invalid magic headers locally with fallback status', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const textFile = new File(['hello world'], 'notes.txt', {
      type: 'text/plain',
    });
    const res1 = await processPortraitFileLocally(textFile);
    expect(res1.portrait.status).toBe('invalid');
    expect(res1.portrait.dataUrl).toBeNull();
    expect(res1.portrait.error).toBeTruthy();

    const fakePng = new File(['not-a-real-png-header'], 'fake.png', {
      type: 'image/png',
    });
    const res2 = await processPortraitFileLocally(fakePng);
    expect(res2.portrait.status).toBe('invalid');
    expect(res2.portrait.dataUrl).toBeNull();

    expect(
      detectImageMimeFromBytes(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
      )
    ).toBe('image/png');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
