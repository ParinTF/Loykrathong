import type { ActivitySkillCommand } from '../domain/activitySkills.mjs';
import type {
  CoopSignalEvent,
  CoupleEmoteEvent,
  PhotoBoothEvent,
  PhotoBoothFilterId,
  PhotoBoothShutter,
  PlayerId,
  PlayerPosition,
  PlayerProfile,
  SharedRoomQuestState,
} from '../domain/types';

export type RoomConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export interface RoomOccupancy { p1: boolean; p2: boolean }
export interface RoomSession { roomCode: string; seatKey: string; role: PlayerId }
export type RoomIntent =
  | { type: 'create_room'; seatKey: string }
  | { type: 'join_room' | 'resume_room'; roomCode: string; seatKey: string };

interface RoomSnapshot {
  roomCode: string;
  occupancy: RoomOccupancy;
  players: Record<PlayerId, PlayerProfile>;
  shared: SharedRoomQuestState;
}

export interface OnlineRoomCallbacks {
  onJoined: (message: RoomSnapshot & { role: PlayerId; seatKey: string }) => void;
  onSnapshot: (message: RoomSnapshot) => void;
  onPeerMoved: (playerId: PlayerId, position: PlayerPosition) => void;
  onPeerProfile: (playerId: PlayerId, profile: PlayerProfile) => void;
  onEmote: (event: CoupleEmoteEvent) => void;
  onCoopSignal: (event: CoopSignalEvent) => void;
  onPhotoBoothEvent?: (event: PhotoBoothEvent) => void;
  onStatusChange: (status: RoomConnectionStatus, message: string | null, code?: string) => void;
}

const SESSION_KEY = 'loykratong.room.seat.v2';
const ROOM_CODE = /^[a-f0-9]{24}$/;
const SEAT_KEY = /^[a-f0-9]{32}$/;

export function createSeatKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, '0')).join('');
}

export function readInviteCode(): string | null {
  return typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('room')?.toLowerCase() ?? null;
}

export function readRoomSession(invite: string | null): RoomSession | null {
  for (const location of ['sessionStorage', 'localStorage'] as const) {
    try {
      const saved = JSON.parse(window[location].getItem(SESSION_KEY) ?? 'null') as RoomSession | null;
      if (saved && ROOM_CODE.test(saved.roomCode) && SEAT_KEY.test(saved.seatKey)
        && (saved.role === 'p1' || saved.role === 'p2') && (invite === null || invite === saved.roomCode)) return saved;
    } catch { /* Private browsing can disable storage. */ }
  }
  return null;
}

export function saveRoomSession(session: RoomSession | null): void {
  for (const location of ['sessionStorage', 'localStorage'] as const) {
    try {
      if (session) window[location].setItem(SESSION_KEY, JSON.stringify(session));
      else window[location].removeItem(SESSION_KEY);
    } catch { /* In-memory reconnect remains available. */ }
  }
}

export function buildRoomInviteUrl(roomCode: string): string {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set('room', roomCode);
  return url.toString();
}

export async function inspectInvitation(
  code: string, signal: AbortSignal,
): Promise<{ hostName: string } | { message: string; retry: boolean }> {
  if (!ROOM_CODE.test(code)) return { message: 'ลิงก์คำเชิญนี้ไม่ถูกต้อง', retry: false };
  try {
    const response = await fetch('/api/invitations/' + code, { signal, cache: 'no-store' });
    const data = await response.json();
    if (response.ok && typeof data.hostName === 'string') return { hostName: data.hostName };
    if (typeof data.error?.message === 'string') return { message: data.error.message, retry: response.status >= 500 };
  } catch {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  }
  return { message: 'ตรวจคำเชิญไม่สำเร็จ ลองเชื่อมต่ออีกครั้ง', retry: true };
}

export class OnlineRoomClient {
  private ws: WebSocket | null = null;
  private intent: RoomIntent | null = null;
  private joined = false;
  private attempts = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  private moveTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMoveAt = -Infinity;

  constructor(
    private readonly getProfile: () => PlayerProfile,
    private readonly callbacks: OnlineRoomCallbacks,
    private readonly endpoint?: string,
  ) {}

  connect(intent: RoomIntent): void {
    if (this.ws && this.intent && this.intent.seatKey === intent.seatKey) return;
    this.disconnect();
    this.intent = intent;
    this.attempts = 0;
    this.open();
  }

  private open(): void {
    const intent = this.intent;
    if (!intent) return;
    this.callbacks.onStatusChange('connecting', this.attempts ? 'กำลังกลับเข้าห้องเดิม…' : null);
    let socket: WebSocket;
    try {
      const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(this.endpoint ?? scheme + '//' + window.location.host + '/ws');
    } catch {
      this.callbacks.onStatusChange('error', 'เปิดการเชื่อมต่อไม่ได้ ลองอีกครั้ง');
      return;
    }
    this.ws = socket;
    this.handshakeTimer = setTimeout(() => {
      if (this.ws === socket && !this.joined) socket.close();
    }, 10000);
    socket.onopen = () => {
      if (this.ws !== socket) return;
      socket.send(JSON.stringify(intent.type === 'resume_room' ? intent : { ...intent, profile: this.getProfile() }));
    };
    socket.onmessage = (event) => {
      if (this.ws !== socket) return;
      let msg;
      try { msg = JSON.parse(String(event.data)); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      switch (msg.type) {
        case 'joined_room':
          this.joined = true;
          this.attempts = 0;
          this.clearHandshake();
          this.intent = { type: 'resume_room', roomCode: msg.roomCode, seatKey: intent.seatKey };
          this.callbacks.onJoined({ ...msg, seatKey: intent.seatKey });
          this.callbacks.onStatusChange('connected', null);
          return;
        case 'room_snapshot': this.callbacks.onSnapshot(msg); return;
        case 'peer_moved': this.callbacks.onPeerMoved(msg.playerId, msg.position); return;
        case 'peer_profile': this.callbacks.onPeerProfile(msg.playerId, msg.profile); return;
        case 'emote': this.callbacks.onEmote(msg); return;
        case 'coop_signal': this.callbacks.onCoopSignal(msg); return;
        case 'photobooth_frame':
        case 'photobooth_cam_state':
        case 'photobooth_shutter':
        case 'photobooth_snap':
          this.callbacks.onPhotoBoothEvent?.(msg as PhotoBoothEvent);
          return;
        case 'room_error':
          if (msg.code === 'seat_busy' && this.attempts < 4) {
            socket.close();
          } else {
            this.disconnect();
            this.callbacks.onStatusChange('error', msg.message || 'เข้าห้องไม่สำเร็จ', msg.code);
          }
      }
    };
    socket.onclose = (event) => {
      if (this.ws !== socket) return;
      this.clearHandshake();
      this.clearMove();
      this.ws = null;
      this.joined = false;
      if (event?.code === 4001) {
        this.intent = null;
        this.callbacks.onStatusChange('error', 'ห้องนี้เปิดต่อที่แท็บใหม่ของคุณแล้ว', 'seat_moved');
        return;
      }
      if (!this.intent) return;
      this.attempts += 1;
      if (this.intent.type !== 'resume_room' && this.attempts > 2) {
        this.callbacks.onStatusChange('error', 'การเชื่อมต่อขาดหาย ลองเริ่มอีกครั้ง');
        return;
      }
      this.callbacks.onStatusChange('connecting', 'สัญญาณขาดหาย กำลังกลับเข้าห้องเดิม…');
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.open();
      }, Math.min(8000, 1200 * this.attempts));
    };
  }

  private clearHandshake(): void {
    if (this.handshakeTimer !== null) clearTimeout(this.handshakeTimer);
    this.handshakeTimer = null;
  }

  private clearMove(): void {
    if (this.moveTimer !== null) clearTimeout(this.moveTimer);
    this.moveTimer = null;
  }

  private send(payload: object): void {
    if (this.joined && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  sendProfile(profile: PlayerProfile): void { this.send({ type: 'update_profile', profile }); }

  sendMove(position: PlayerPosition, force = false): void {
    if (!this.joined) return;
    this.clearMove();
    const deliver = () => {
      this.moveTimer = null;
      this.lastMoveAt = performance.now();
      this.send({ type: 'move', position });
    };
    const remaining = 38 - (performance.now() - this.lastMoveAt);
    if (force || remaining <= 0) deliver();
    else this.moveTimer = setTimeout(deliver, remaining);
  }

  sendSharedState(shared: SharedRoomQuestState, options?: {
    forceReplace?: boolean;
  }): void {
    this.send({ type: 'sync_shared', shared, ...options });
  }

  sendCoopSignal(spotId: string, action: string, value = 0, x?: number, y?: number): void {
    this.send({ type: 'coop_signal', spotId, action, value, x, y });
  }

  sendActivitySkill(command: ActivitySkillCommand): void {
    this.send({ type: 'activity_skill', command });
  }

  sendPhotoBoothFrame(dataUrl: string, mirrored: boolean, filter: PhotoBoothFilterId): void {
    this.send({ type: 'photobooth_frame', dataUrl, mirrored, filter });
  }

  sendPhotoBoothCamState(active: boolean): void {
    this.send({ type: 'photobooth_cam_state', active });
  }

  sendPhotoBoothShutter(payload: PhotoBoothShutter): void {
    this.send({ type: 'photobooth_shutter', ...payload });
  }

  sendPhotoBoothSnap(sessionId: string, shotIndex: number, dataUrl: string | null): void {
    this.send({ type: 'photobooth_snap', sessionId, shotIndex, dataUrl });
  }

  sendEmote(emoji: string, text: string): void { this.send({ type: 'send_emote', emoji, text }); }

  disconnect(): void {
    this.intent = null;
    this.joined = false;
    this.clearHandshake();
    this.clearMove();
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const socket = this.ws;
    this.ws = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      try { socket.close(); } catch { /* Already closed. */ }
    }
  }
}
