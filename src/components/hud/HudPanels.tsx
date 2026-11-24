import { useEffect, useRef, useState } from 'react';
import { GRAPHICS_QUALITIES, type AppSettings, type GraphicsQuality, type PresentationSettings } from '../../domain/types';
import type { CameraPreset } from '../../game/FestivalScene';
import { buildRoomInviteUrl, type RoomConnectionStatus } from '../../online/roomClient';
import { HudDialog, HudIcon, HudSwitch } from './HudPrimitives';

const graphicsLabels: Record<GraphicsQuality, string> = {
  auto: 'Auto · อัตโนมัติ',
  low: 'Low · ต่ำ',
  medium: 'Medium · กลาง',
  high: 'High · สูง',
  ultra: 'Ultra · สูงสุด',
};

export interface SettingsActions {
  onCamera: (preset: CameraPreset) => void;
  onResetCamera: () => void;
  onPresentation: (patch: Partial<PresentationSettings>) => void;
  onSound: () => void;
  onMotion: (mode: AppSettings['reducedMotionOverride']) => void;
  onResetGame: () => void;
}

export function SettingsPanel({ settings, camera, actions, onDismiss }: {
  settings: AppSettings;
  camera: CameraPreset;
  actions: SettingsActions;
  onDismiss: () => void;
}) {
  return (
    <HudDialog title="ตั้งค่า" onDismiss={onDismiss}>
      <fieldset className="hud-setting-group">
        <legend>กล้องและภาพ</legend>
        <label className="hud-setting-row">
          <span>โหมดกล้อง</span>
          <select value={camera} onChange={(event) => actions.onCamera(event.target.value as CameraPreset)}>
            <option value="follow">ติดตาม</option>
            <option value="close">ระยะใกล้</option>
            <option value="overview">มุมสูง</option>
          </select>
        </label>
        <label className="hud-setting-row">
          <span>คุณภาพกราฟิก</span>
          <select value={settings.graphicsQuality}
            onChange={(event) => actions.onPresentation({ graphicsQuality: event.target.value as GraphicsQuality })}>
            {GRAPHICS_QUALITIES.map((quality) => <option key={quality} value={quality}>{graphicsLabels[quality]}</option>)}
          </select>
        </label>
        <button type="button" className="hud-text-button" onClick={actions.onResetCamera}>
          <HudIcon name="compass" /> ตั้งกล้องตรง
        </button>
      </fieldset>
      <fieldset className="hud-setting-group">
        <legend>เสียง</legend>
        <HudSwitch label="เสียงเอฟเฟกต์" checked={settings.soundEnabled} onChange={actions.onSound} />
        <HudSwitch label="ดนตรีบรรยากาศ" checked={settings.musicEnabled}
          onChange={() => actions.onPresentation({ musicEnabled: !settings.musicEnabled })} />
      </fieldset>
      <fieldset className="hud-setting-group">
        <legend>การเข้าถึง</legend>
        <label className="hud-setting-row">
          <span>ลดการเคลื่อนไหว</span>
          <select value={settings.reducedMotionOverride}
            onChange={(event) => actions.onMotion(event.target.value as AppSettings['reducedMotionOverride'])}>
            <option value="system">ตามการตั้งค่าเครื่อง</option>
            <option value="reduce">เปิด</option>
            <option value="no-preference">ปิด</option>
          </select>
        </label>
        <HudSwitch label="เพิ่มคอนทราสต์ HUD" checked={settings.highContrast}
          onChange={() => actions.onPresentation({ highContrast: !settings.highContrast })} />
        <HudSwitch label="แสดงปุ่มเดินบนจอเสมอ" checked={settings.showTouchControls}
          onChange={() => actions.onPresentation({ showTouchControls: !settings.showTouchControls })} />
        <details className="hud-key-help">
          <summary>ปุ่มควบคุมด้วยแป้นพิมพ์</summary>
          <dl>
            <div><dt><kbd>WASD</kbd> <kbd>↑↓←→</kbd></dt><dd>เดิน</dd></div>
            <div><dt><kbd>E</kbd></dt><dd>โต้ตอบเมื่ออยู่ใกล้</dd></div>
            <div><dt><kbd>Q</kbd> <kbd>R</kbd> <kbd>V</kbd></dt><dd>หมุนและสลับมุมกล้อง</dd></div>
          </dl>
        </details>
      </fieldset>
      <button type="button" className="hud-text-button hud-text-button--danger" onClick={() => {
        onDismiss();
        actions.onResetGame();
      }}>รีเซ็ตข้อมูลเกม</button>
    </HudDialog>
  );
}

function InviteActions({ roomCode }: { roomCode: string }) {
  const [feedback, setFeedback] = useState('');
  const [manual, setManual] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const url = buildRoomInviteUrl(roomCode);

  useEffect(() => {
    if (manual) {
      field.current?.focus();
      field.current?.select();
    }
  }, [manual]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback('คัดลอกคำเชิญแล้ว');
    } catch {
      setManual(true);
      setFeedback('เลือกและคัดลอกลิงก์นี้ได้เลย');
    }
  }

  async function share() {
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title: 'คืนเพ็ญของเราสองคน', text: 'มาลอยกระทงด้วยกันคืนนี้', url });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) await copy();
    }
  }

  return (
    <>
      <div className="hud-invite-actions">
        <button type="button" className="hud-text-button hud-text-button--primary" onClick={() => void copy()}>
          <HudIcon name="link" /> คัดลอกลิงก์
        </button>
        <button type="button" className="hud-text-button" onClick={() => void share()}>
          <HudIcon name="share" /> แชร์
        </button>
      </div>
      {manual && <label className="hud-invite">
        ลิงก์คำเชิญ <input ref={field} type="url" readOnly value={url} />
      </label>}
      {feedback && <p className="hud-room__summary" role="status">{feedback}</p>}
    </>
  );
}

export function InvitationWaitingPanel({ roomCode, role }: { roomCode: string; role: 'p1' | 'p2' }) {
  return (
    <aside className="hud-invite-card hud-surface" aria-label="คำเชิญสำหรับคู่รัก">
      <h2><HudIcon name="lotus" /> ที่ข้างคุณยังว่างอยู่</h2>
      <p role="status">{role === 'p1' ? 'ส่งคำเชิญ แล้วเดินชมคืนเพ็ญระหว่างรอได้เลย' : 'รออีกคนกลับมา แล้วเริ่มภารกิจด้วยกัน'}</p>
      {role === 'p1' && <InviteActions roomCode={roomCode} />}
    </aside>
  );
}

export function MultiplayerPanel({ roomCode, status, bothOnline, error, role, onDismiss }: {
  roomCode: string;
  status: RoomConnectionStatus;
  bothOnline: boolean;
  error: string | null;
  role: 'p1' | 'p2';
  onDismiss: () => void;
}) {
  return (
    <HudDialog title="คืนเพ็ญของเราสองคน" onDismiss={onDismiss}>
      <p className="hud-room__summary" role="status">
        {status === 'connecting' ? error ?? 'กำลังกลับเข้าห้องเดิม…' :
          bothOnline ? 'ตอนนี้คุณทั้งสองคนอยู่ในห้องเดียวกันแล้ว' :
          'รออีกคนเข้ามา คุณเดินชมงานระหว่างรอได้'}
      </p>
      {status === 'connected' && !bothOnline && role === 'p1' && <InviteActions roomCode={roomCode} />}
    </HudDialog>
  );
}

