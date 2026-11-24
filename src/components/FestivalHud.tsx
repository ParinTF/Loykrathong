import { memo, useEffect, useRef, useState } from 'react';
import type {
  AppSettings,
  PlayerCustomization,
  PlayerId,
  PlayerProfile,
  WorldSpot,
} from '../domain/types';
import type { CameraPreset } from '../game/FestivalScene';
import type { RoomConnectionStatus, RoomOccupancy } from '../online/roomClient';
import { AvatarPreview } from './AvatarPreview';
import { EmoteWheel } from './hud/EmoteWheel';
import {
  InvitationWaitingPanel,
  MultiplayerPanel,
  SettingsPanel,
  type SettingsActions,
} from './hud/HudPanels';
import { HudIcon, HudIconButton } from './hud/HudPrimitives';
import { QuestTracker, type HudMemories } from './hud/QuestTracker';
import { WardrobePanel } from './hud/WardrobePanel';

export type HudOverlay = 'settings' | 'multiplayer' | 'wardrobe' | null;
export type HudProfile = Pick<
  PlayerProfile,
  'id' | 'name' | 'portrait' | 'customization'
>;

export interface HudActions extends SettingsActions {
  onJoinPartner: () => void;
  onOverlay: (overlay: HudOverlay) => void;
  onEmote: (emoji: string, text: string) => void;
  onInteract: () => void;
  onUpdateCustomization: (patch: Partial<PlayerCustomization>) => void;
  onOpenKeepsake: () => void;
}

interface FestivalHudProps {
  profiles: Record<PlayerId, HudProfile>;
  settings: AppSettings;
  memories: HudMemories;
  eventLog: string;
  nearbySpot: WorldSpot | null;
  roomCode: string;
  role: PlayerId;
  roomStatus: RoomConnectionStatus;
  roomError: string | null;
  occupancy: RoomOccupancy;
  canJoinPartner: boolean;
  camera: CameraPreset;
  overlay: HudOverlay;
  actions: HudActions;
}

function statusText(
  status: RoomConnectionStatus,
  bothOnline: boolean
): string {
  if (status === 'connecting') return 'กำลังเชื่อมต่อ';
  if (status !== 'connected') return 'โหมดเดินชมคืนเพ็ญ';
  return bothOnline ? 'ออนไลน์ครบคู่' : 'รอคู่รักเข้าห้อง';
}

function FestivalNotice({ message }: { message: string }) {
  const previous = useRef(message);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (previous.current === message) return;
    previous.current = message;
    setNotice(message);
    const timer = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);
  return (
    <div className="hud-notice" role="status">
      {notice}
    </div>
  );
}

export const FestivalHud = memo(function FestivalHud({
  profiles,
  settings,
  memories,
  eventLog,
  nearbySpot,
  roomCode,
  role,
  roomStatus,
  roomError,
  occupancy,
  canJoinPartner,
  camera,
  overlay,
  actions,
}: FestivalHudProps) {
  const overlayTrigger = useRef<HTMLButtonElement | null>(null);
  const bothOnline = occupancy.p1 && occupancy.p2;
  const connected = roomStatus === 'connected';
  const dismiss = () => {
    actions.onOverlay(null);
    requestAnimationFrame(() =>
      overlayTrigger.current?.focus({ preventScroll: true })
    );
  };

  return (
    <div
      className="festival-hud"
      data-festival-hud
      data-high-contrast={settings.highContrast}
    >
      <section className="hud-couple hud-surface" aria-label="ตัวละครคู่รัก">
        <div className="hud-couple__players">
          {(['p1', 'p2'] as const).map((player) => {
            const profile = profiles[player];
            const name =
              profile.name || (player === 'p1' ? 'ผู้เล่น 1' : 'ผู้เล่น 2');
            return (
              <div
                key={player}
                className="hud-couple__player"
                data-active={role === player}
              >
                <AvatarPreview profile={profile} size={32} decorative />
                <span className="hud-couple__identity">
                  <span className="hud-couple__name">{name}</span>
                  <span className="hud-couple__role">
                    {player === role
                      ? 'คุณ'
                      : occupancy[player]
                        ? 'ออนไลน์'
                        : 'รอเข้าห้อง'}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="hud-couple__footer">
          <span
            className="hud-presence"
            data-connected={connected}
            role="status"
          >
            {statusText(roomStatus, bothOnline)}
          </span>
          {canJoinPartner && (
            <button
              type="button"
              className="hud-couple__movement"
              onClick={actions.onJoinPartner}
            >
              <HudIcon name="heart" /> ไปหาคู่รัก
            </button>
          )}
        </div>
      </section>

      <div className="hud-festival-title">
        <div className="hud-festival-title__ornament">
          <HudIcon name="lotus" />
        </div>
        <p>คืนเพ็ญริมน้ำ</p>
        {nearbySpot && <span>{nearbySpot.zoneName}</span>}
      </div>

      <nav className="hud-utilities hud-surface" aria-label="เครื่องมือในเกม">
        <HudIconButton
          icon="people"
          label="เล่นด้วยกัน"
          aria-haspopup="dialog"
          aria-expanded={overlay === 'multiplayer'}
          data-connected={connected}
          onClick={(event) => {
            overlayTrigger.current = event.currentTarget;
            actions.onOverlay('multiplayer');
          }}
        />
        <HudIconButton
          icon={settings.soundEnabled ? 'sound' : 'muted'}
          label={
            settings.soundEnabled ? 'ปิดเสียงเอฟเฟกต์' : 'เปิดเสียงเอฟเฟกต์'
          }
          aria-pressed={settings.soundEnabled}
          onClick={actions.onSound}
        />
        <HudIconButton
          icon="settings"
          label="ตั้งค่า"
          aria-haspopup="dialog"
          aria-expanded={overlay === 'settings'}
          onClick={(event) => {
            overlayTrigger.current = event.currentTarget;
            actions.onOverlay('settings');
          }}
        />
        <HudIconButton
          icon="wardrobe"
          label="แต่งตัว"
          aria-haspopup="dialog"
          aria-expanded={overlay === 'wardrobe'}
          onClick={(event) => {
            overlayTrigger.current = event.currentTarget;
            actions.onOverlay('wardrobe');
          }}
        />
      </nav>

      {connected && !bothOnline && roomCode && (
        <InvitationWaitingPanel roomCode={roomCode} role={role} />
      )}

      <QuestTracker
        memories={memories}
        onOpenKeepsake={actions.onOpenKeepsake}
      />
      <FestivalNotice message={eventLog} />

      {nearbySpot && (
        <button
          className="hud-interact hud-surface"
          type="button"
          onClick={actions.onInteract}
          aria-keyshortcuts="E"
          aria-label={`โต้ตอบ: ${nearbySpot.title}`}
        >
          <kbd aria-hidden="true">E</kbd>
          <HudIcon name="spark" className="hud-interact__touch" />
          <span>{nearbySpot.title}</span>
        </button>
      )}

      <EmoteWheel onSend={actions.onEmote} />

      {overlay === 'settings' && (
        <SettingsPanel
          settings={settings}
          camera={camera}
          actions={actions}
          onDismiss={dismiss}
        />
      )}
      {overlay === 'multiplayer' && (
        <MultiplayerPanel
          roomCode={roomCode}
          status={roomStatus}
          error={roomError}
          bothOnline={bothOnline}
          role={role}
          onDismiss={dismiss}
        />
      )}
      {overlay === 'wardrobe' && (
        <WardrobePanel
          profile={profiles[role]}
          connected={connected || roomStatus === 'disconnected'}
          onChange={actions.onUpdateCustomization}
          onDismiss={dismiss}
        />
      )}
    </div>
  );
});
