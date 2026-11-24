import { useRef, useState } from 'react';
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

export function MultiplayerPanel({ roomCode, status, bothOnline, error, onConnect, onManage, onDismiss }: {
  roomCode: string;
  status: RoomConnectionStatus;
  bothOnline: boolean;
  error: string | null;
  onConnect: () => void;
  onManage: () => void;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const invite = useRef<HTMLInputElement>(null);

  async function copyInvite() {
    if (!invite.current) return;
    try {
      await navigator.clipboard.writeText(invite.current.value);
      setCopied(true);
      setCopyError(false);
    } catch {
      invite.current.focus();
      invite.current.select();
      setCopyError(true);
    }
  }

  return (
    <HudDialog title="เล่นด้วยกัน" onDismiss={onDismiss}>
      {status === 'connected' ? (
        <>
          <p className="hud-room__summary" role="status">
            ห้อง <strong>{roomCode}</strong> · {bothOnline ? 'ออนไลน์ครบคู่' : 'รอคู่รักเข้าห้อง'}
          </p>
          <label className="hud-invite">
            ลิงก์เชิญ
            <input type="url" ref={invite} readOnly value={buildRoomInviteUrl(roomCode)} />
          </label>
          <button className="hud-text-button hud-text-button--primary" onClick={() => void copyInvite()} type="button">
            <HudIcon name={copied ? 'check' : 'link'} /> {copied ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์เชิญ'}
          </button>
          {copyError && <p className="hud-room__summary" role="status">เลือกและคัดลอกลิงก์ด้านบนได้เลย</p>}
        </>
      ) : (
        <>
          {error && <p className="hud-room__error" role="alert">{error}</p>}
          <button type="button" className="hud-text-button hud-text-button--primary"
            disabled={status === 'connecting'} onClick={onConnect}>
            <HudIcon name="people" /> {status === 'connecting' ? 'กำลังเชื่อมต่อห้อง…' : 'เปิดห้องออนไลน์ชวนแฟน'}
          </button>
          {status === 'connecting' && <p role="status" className="visually-hidden">กำลังเชื่อมต่อห้องออนไลน์</p>}
        </>
      )}
      <button className="hud-text-button" type="button" onClick={() => {
        onDismiss();
        onManage();
      }}>{status === 'connected' ? 'จัดการห้อง' : 'เข้าด้วยรหัสห้อง'}</button>
    </HudDialog>
  );
}
