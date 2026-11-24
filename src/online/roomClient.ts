import type {
  CoopSignalEvent,
  CoupleEmoteEvent,
  MinigameId,
  PlayerId,
  PlayerPosition,
  PlayerProfile,
  SharedRoomQuestState,
} from '../domain/types';

export type RoomConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface RoomOccupancy {
  p1: boolean;
  p2: boolean;
}

export interface OnlineRoomCallbacks {
  onJoined: (payload: {
    roomCode: string;
    role: PlayerId;
    occupancy: RoomOccupancy;
    players: Record<PlayerId, PlayerProfile>;
    shared: SharedRoomQuestState;
  }) => void;
  onSnapshot: (payload: {
    roomCode: string;
    occupancy: RoomOccupancy;
    players: Record<PlayerId, PlayerProfile>;
    shared: SharedRoomQuestState;
  }) => void;
  onPeerMoved: (playerId: PlayerId, position: PlayerPosition) => void;
  onPeerProfile: (playerId: PlayerId, profile: PlayerProfile) => void;
  onEmote: (event: CoupleEmoteEvent) => void;
  onCoopSignal?: (event: CoopSignalEvent) => void;
  onStatusChange: (status: RoomConnectionStatus, errorMessage: string | null) => void;
}

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Per-tab in-memory client ID (never shared via sessionStorage when duplicating tabs!)
const TAB_CLIENT_ID = `lk-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;

export function generateInviteRoomCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
  }
  return out;
}

export function normalizeRoomCodeInput(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

export function readInitialRoomFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = normalizeRoomCodeInput(params.get('room') || '');
    return code.length >= 4 ? code : null;
  } catch {
    return null;
  }
}

export function buildRoomInviteUrl(roomCode: string): string {
  if (typeof window === 'undefined') return `?room=${roomCode}`;
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  return url.toString();
}

export function getOrCreateClientId(): string {
  return TAB_CLIENT_ID;
}

export class OnlineRoomClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private intentionalClose = false;
  private roomCode = '';
  private preferredRole: PlayerId = 'p1';
  private readonly clientId: string;
  private getProfile: () => PlayerProfile;
  private callbacks: OnlineRoomCallbacks;
  private lastMoveSentAt = 0;
  private wsEndpointOverride?: string;

  constructor(
    getProfile: () => PlayerProfile,
    callbacks: OnlineRoomCallbacks,
    options?: { clientId?: string; wsEndpoint?: string }
  ) {
    this.getProfile = getProfile;
    this.callbacks = callbacks;
    this.clientId =
      options?.clientId ??
      `lk-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    this.wsEndpointOverride = options?.wsEndpoint;
  }

  public connect(roomCode: string, preferredRole: PlayerId): void {
    const normalized = normalizeRoomCodeInput(roomCode);
    if (normalized.length < 4) {
      this.callbacks.onStatusChange(
        'error',
        'กรุณากรอกรหัสห้องอย่างน้อย 4 ตัวอักษร (A-Z หรือ 0-9)'
      );
      return;
    }

    // If already connected or connecting to the exact same room & role, do nothing!
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING) &&
      this.roomCode === normalized &&
      this.preferredRole === preferredRole
    ) {
      return;
    }

    this.disconnect();
    this.intentionalClose = false;
    this.roomCode = normalized;
    this.preferredRole = preferredRole;
    this.openSocket(false);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private openSocket(isReconnect: boolean): void {
    this.clearReconnectTimer();

    if (typeof WebSocket === 'undefined') {
      this.callbacks.onStatusChange(
        'error',
        'เบราว์เซอร์นี้ไม่รองรับการเชื่อมต่อ WebSocket'
      );
      return;
    }

    // Close any previous socket cleanly with handlers detached so its async close never triggers a zombie timer
    if (this.ws) {
      const stale = this.ws;
      this.ws = null;
      stale.onopen = null;
      stale.onmessage = null;
      stale.onerror = null;
      stale.onclose = null;
      try {
        stale.close();
      } catch {
        // ignore
      }
    }

    this.callbacks.onStatusChange('connecting', null);
    const wsUrl =
      this.wsEndpointOverride ??
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      this.callbacks.onStatusChange(
        'error',
        'ไม่สามารถเปิดช่องทางเชื่อมต่อห้องออนไลน์ได้'
      );
      return;
    }

    this.ws = socket;

    socket.onopen = () => {
      if (this.ws !== socket) return;
      socket.send(
        JSON.stringify({
          type: 'join_room',
          roomCode: this.roomCode,
          preferredRole: this.preferredRole,
          clientId: this.clientId,
          profile: this.getProfile(),
          preserveRoomPosition: isReconnect,
        })
      );
      this.startHeartbeat();
    };

    socket.onmessage = (event) => {
      if (this.ws !== socket) return;
      try {
        const msg = JSON.parse(String(event.data));
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'joined_room') {
          this.preferredRole = msg.role;
          this.callbacks.onStatusChange('connected', null);
          this.callbacks.onJoined({
            roomCode: msg.roomCode,
            role: msg.role,
            occupancy: msg.occupancy,
            players: msg.players,
            shared: msg.shared,
          });
        } else if (msg.type === 'room_snapshot') {
          this.callbacks.onSnapshot({
            roomCode: msg.roomCode,
            occupancy: msg.occupancy,
            players: msg.players,
            shared: msg.shared,
          });
        } else if (msg.type === 'peer_moved') {
          this.callbacks.onPeerMoved(msg.playerId, msg.position);
        } else if (msg.type === 'peer_profile') {
          this.callbacks.onPeerProfile(msg.playerId, msg.profile);
        } else if (msg.type === 'emote') {
          this.callbacks.onEmote({
            playerId: msg.playerId,
            emoji: msg.emoji,
            text: msg.text,
            ts: msg.ts,
          });
        } else if (msg.type === 'coop_signal') {
          this.callbacks.onCoopSignal?.({
            playerId: msg.playerId,
            spotId: msg.spotId,
            action: msg.action,
            value: msg.value,
            ts: msg.ts,
          });
        } else if (msg.type === 'room_error') {
          this.intentionalClose = true;
          this.callbacks.onStatusChange('error', msg.message || 'เข้าห้องไม่สำเร็จ');
          socket.close();
        }
      } catch {
        // Ignore malformed frame
      }
    };

    socket.onerror = () => {
      // Handled on close
    };

    socket.onclose = () => {
      // CRITICAL: Ignore async close events from superseded sockets!
      if (this.ws !== socket) {
        return;
      }
      this.stopHeartbeat();
      this.ws = null;
      if (this.intentionalClose) {
        return;
      }
      this.callbacks.onStatusChange(
        'connecting',
        'สัญญาณสะดุด กำลังเชื่อมต่อกลับเข้าห้องเดิมอัตโนมัติ...'
      );
      this.clearReconnectTimer();
      this.reconnectTimer = setTimeout(() => {
        if (!this.intentionalClose && this.roomCode) {
          this.openSocket(true);
        }
      }, 1800) as unknown as number;
    };
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20_000) as unknown as number;
  }

  private stopHeartbeat(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  public sendProfile(profile: PlayerProfile): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'update_profile', profile }));
    }
  }

  public sendMove(position: PlayerPosition, force = false): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const now = performance.now();
    if (!force && now - this.lastMoveSentAt < 38) return;
    this.lastMoveSentAt = now;
    this.ws.send(JSON.stringify({ type: 'move', position }));
  }

  public sendSharedState(
    shared: SharedRoomQuestState,
    options?: {
      forceReplace?: boolean;
      resetTaskKey?: string;
      resetMinigame?: MinigameId;
    }
  ): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'sync_shared',
          shared,
          ...options,
        })
      );
    }
  }

  public sendCoopSignal(spotId: string, action: string, value = 0): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'coop_signal',
          spotId,
          action,
          value,
        })
      );
    }
  }

  public sendEmote(emoji: string, text: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'send_emote', emoji, text }));
    }
  }

  public disconnect(): void {
    this.intentionalClose = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    if (this.ws) {
      const active = this.ws;
      this.ws = null;
      active.onopen = null;
      active.onmessage = null;
      active.onerror = null;
      active.onclose = null;
      try {
        active.close();
      } catch {
        // ignore
      }
    }
  }
}
