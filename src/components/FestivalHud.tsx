
import { memo, useEffect, useRef, useState } from 'react';
import type { AppSettings, PlayMode, PlayerId, PlayerProfile, WorldSpot } from '../domain/types';
import type { CameraPreset } from '../game/FestivalScene';
import type { RoomConnectionStatus, RoomOccupancy } from '../online/roomClient';
import { AvatarPreview } from './AvatarPreview';
import { EmoteWheel } from './hud/EmoteWheel';
import { MultiplayerPanel, SettingsPanel, type SettingsActions } from './hud/HudPanels';
import { HudIcon, HudIconButton } from './hud/HudPrimitives';
import { QuestTracker, type HudQuest } from './hud/QuestTracker';

export type HudOverlay = 'settings' | 'multiplayer' | null;
export type HudProfile = Pick<PlayerProfile, 'id' | 'name' | 'portrait' | 'customization'>;

export interface HudActions extends SettingsActions {
  onPlayer: (player: PlayerId) => void;
  onFollow: () => void;
  onJoinPartner: () => void;
  onOpenSetup: (section: 'online-room' | 'couple-studio') => void;
  onConnectRoom: () => void;
  onOverlay: (overlay: HudOverlay) => void;
  onEmote: (emoji: string, text: string) => void;
  onInteract: () => void;
}

interface FestivalHudProps {
  profiles: Record<PlayerId, HudProfile>;
  settings: AppSettings;
  quest: HudQuest;
  eventLog: string;
  nearbySpot: WorldSpot | null;
  playMode: PlayMode;
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

function statusText(online: boolean, status: RoomConnectionStatus, bothOnline: boolean): string {
  if (!online) return 'เล่นเครื่องเดียว';
  if (status === 'connecting') return 'กำลังเชื่อมต่อ';
  if (status !== 'connected') return 'ห้องออฟไลน์';
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
  return <div className="hud-notice" role="status">{notice}</div>;
}

export const FestivalHud = memo(function FestivalHud({
  profiles, settings, quest, eventLog, nearbySpot, playMode, roomCode, role, roomStatus, roomError,
  occupancy, canJoinPartner, camera, overlay, actions,
}: FestivalHudProps) {
  const overlayTrigger = useRef<HTMLButtonElement | null>(null);
  const online = playMode === 'online';
  const bothOnline = occupancy.p1 && occupancy.p2;
  const active = online ? role : settings.activePlayer;
  const dismiss = () => {
    actions.onOverlay(null);
    requestAnimationFrame(() => overlayTrigger.current?.focus({ preventScroll: true }));
  };

  return (
    <div className="festival-hud" data-festival-hud data-high-contrast={settings.highContrast}>
      <section className="hud-couple hud-surface" aria-label="ตัวละครคู่รัก">
        <div className="hud-couple__players">
          {(['p1', 'p2'] as const).map((player) => {
            const profile = profiles[player];
            const name = profile.name || (player === 'p1' ? 'ผู้เล่น 1' : 'ผู้เล่น 2');
            const info = (
              <>
                <AvatarPreview profile={profile} size={32} decorative />
                <span className="hud-couple__identity">
                  <span className="hud-couple__name">{name}</span>
                  <span className="hud-couple__role">
                    {online ? player === role ? 'คุณ' : occupancy[player] ? 'ออนไลน์' : 'รอเข้าห้อง' : player.toUpperCase()}
                  </span>
                </span>
              </>
            );
            if (online) return <div key={player} className="hud-couple__player" data-active={active === player}>{info}</div>;
            return (
              <button key={player} type="button" className="hud-couple__player" data-active={active === player}
                aria-label={'ควบคุม ' + name} aria-pressed={active === player} onClick={() => actions.onPlayer(player)}>
                {info}
              </button>
            );
          })}
        </div>
        <div className="hud-couple__footer">
          <span className="hud-presence" data-connected={online && roomStatus === 'connected'} role="status">
            {statusText(online, roomStatus, bothOnline)}
          </span>
          {!online && (
            <button type="button" className="hud-couple__movement" aria-pressed={settings.followPartner}
              onClick={actions.onFollow}>
              <HudIcon name="walk" />
              <span>{settings.followPartner ? 'เดินคู่กัน' : 'แยกเดิน'}</span>
            </button>
          )}
          {canJoinPartner && (
            <button type="button" className="hud-couple__movement" onClick={actions.onJoinPartner}>
              <HudIcon name="heart" /> ไปหาคู่รัก
            </button>
          )}
        </div>
      </section>

      <div className="hud-festival-title">
        <div className="hud-festival-title__ornament"><HudIcon name="lotus" /></div>
        <p>คืนเพ็ญริมน้ำ</p>
        {nearbySpot && <span>{nearbySpot.zoneName}</span>}
      </div>

      <nav className="hud-utilities hud-surface" aria-label="เครื่องมือในเกม">
        <HudIconButton icon="people" label="เล่นด้วยกัน" aria-haspopup="dialog" aria-expanded={overlay === 'multiplayer'}
          data-connected={online && roomStatus === 'connected'} onClick={(event) => {
            overlayTrigger.current = event.currentTarget;
            actions.onOverlay('multiplayer');
          }} />
        <HudIconButton icon={settings.soundEnabled ? 'sound' : 'muted'}
          label={settings.soundEnabled ? 'ปิดเสียงเอฟเฟกต์' : 'เปิดเสียงเอฟเฟกต์'}
          aria-pressed={settings.soundEnabled} onClick={actions.onSound} />
        <HudIconButton icon="settings" label="ตั้งค่า" aria-haspopup="dialog" aria-expanded={overlay === 'settings'}
          onClick={(event) => {
            overlayTrigger.current = event.currentTarget;
            actions.onOverlay('settings');
          }} />
        <HudIconButton icon="wardrobe" label="แต่งตัว" onClick={() => actions.onOpenSetup('couple-studio')} />
      </nav>

      <QuestTracker quest={quest} />
      <FestivalNotice message={eventLog} />

      {nearbySpot && (
        <button className="hud-interact hud-surface" type="button" onClick={actions.onInteract}
          aria-keyshortcuts="E" aria-label={`โต้ตอบ: ${nearbySpot.title}`}>
          <kbd aria-hidden="true">E</kbd>
          <HudIcon name="spark" className="hud-interact__touch" />
          <span>{nearbySpot.title}</span>
        </button>
      )}

      <EmoteWheel onSend={actions.onEmote} />

      {overlay === 'settings' && (
        <SettingsPanel settings={settings} camera={camera} actions={actions} onDismiss={dismiss} />
      )}
      {overlay === 'multiplayer' && (
        <MultiplayerPanel roomCode={roomCode} status={roomStatus} error={roomError} bothOnline={bothOnline}
          onConnect={actions.onConnectRoom} onManage={() => actions.onOpenSetup('online-room')} onDismiss={dismiss} />
      )}
    </div>
  );
});
