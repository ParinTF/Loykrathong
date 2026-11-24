import { useState } from 'react';
import {
  MATERIAL_LABELS,
  MINIGAME_TITLES,
  countCollectedMaterials,
  getCoupleProgressPercent,
} from '../domain/reducer';
import { LANTERN_SPOTS } from '../domain/worldMap';
import type {
  GameState,
  MaterialId,
  MinigameId,
  PlayMode,
  PlayerId,
} from '../domain/types';
import {
  buildRoomInviteUrl,
  type RoomConnectionStatus,
  type RoomOccupancy,
} from '../online/roomClient';
import type { CameraPreset } from '../game/FestivalScene';
import { AvatarPreview } from './AvatarPreview';

interface FestivalHudProps {
  state: GameState;
  playMode?: PlayMode;
  roomCode?: string;
  myOnlineRole?: PlayerId;
  roomStatus?: RoomConnectionStatus;
  occupancy?: RoomOccupancy;
  cameraPreset?: CameraPreset;
  reducedMotion: boolean;
  onSetActivePlayer: (playerId: PlayerId) => void;
  onToggleFollow: () => void;
  onCycleCameraPreset?: () => void;
  onResetCameraAngle?: () => void;
  onOpenSetup: () => void;
  onQuickSwitchOnline?: () => void;
  onSendEmote?: (emoji: string, text: string) => void;
  onWalkToPartner?: () => void;
  onToggleSound: () => void;
  onToggleReducedMotion: () => void;
  onRequestReset: () => void;
}

const COUPLE_EMOTES = [
  { emoji: '💖', text: 'คิดถึงนะ' },
  { emoji: '🪷', text: 'มาเจอกันตรงนี้เร็ว!' },
  { emoji: '🕯️', text: 'ไปช่วยกันทำกระทงกัน' },
  { emoji: '🌊', text: 'ไปท่าน้ำแสงจันทร์กัน!' },
];

const CAMERA_PRESET_LABELS: Record<CameraPreset, string> = {
  follow: 'มุมกล้อง 3D: ปกติ',
  close: 'มุมกล้อง 3D: ใกล้ชมฟ้า',
  overview: 'มุมกล้อง 3D: มุมสูง',
};

export function FestivalHud({
  state,
  playMode = 'local',
  roomCode = '',
  myOnlineRole = 'p1',
  roomStatus = 'disconnected',
  occupancy = { p1: false, p2: false },
  cameraPreset = 'follow',
  reducedMotion,
  onSetActivePlayer,
  onToggleFollow,
  onCycleCameraPreset,
  onResetCameraAngle,
  onOpenSetup,
  onQuickSwitchOnline,
  onSendEmote,
  onWalkToPartner,
  onToggleSound,
  onToggleReducedMotion,
  onRequestReset,
}: FestivalHudProps) {
  const [questOpen, setQuestOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const progressPct = getCoupleProgressPercent(state);
  const collectedCount = countCollectedMaterials(state.inventory);
  const stageText: Record<GameState['questStage'], string> = {
    explore: `ช่วยกันเก็บวัสดุ (${collectedCount}/3)`,
    craft: 'ไปที่โต๊ะประดิษฐ์กระทง (3 ด่าน)',
    ceremony: 'ไปที่ท่าน้ำแสงจันทร์เพื่อปล่อยกระทง',
    released: `ปล่อยกระทงแล้ว ${state.releasedKrathongs.length} ใบ`,
  };

  const partnerRole: PlayerId = myOnlineRole === 'p1' ? 'p2' : 'p1';
  const bothOnline = occupancy.p1 && occupancy.p2;
  const coupleDist = Math.hypot(
    state.players.p1.position.x - state.players.p2.position.x,
    state.players.p1.position.y - state.players.p2.position.y
  );

  const handleCopyLink = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(buildRoomInviteUrl(roomCode));
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 2600);
    } catch {
      // ignore clipboard restriction
    }
  };

  return (
    <header className="hud-header">
      <div className="hud-top-row">
        <div
          className="hud-players"
          role="group"
          aria-label={
            playMode === 'online' ? 'สถานะคู่รักออนไลน์' : 'สลับตัวละครที่ควบคุม'
          }
        >
          {(['p1', 'p2'] as const).map((pid) => {
            const p = state.players[pid];
            const isActive =
              playMode === 'online'
                ? myOnlineRole === pid
                : state.settings.activePlayer === pid;
            const isPeerOnline = occupancy[pid];
            return (
              <button
                key={pid}
                type="button"
                className={`hud-player-btn ${isActive ? 'is-active' : ''}`}
                aria-pressed={isActive}
                disabled={playMode === 'online' && pid !== myOnlineRole}
                onClick={() => {
                  if (playMode === 'local') onSetActivePlayer(pid);
                }}
              >
                <AvatarPreview profile={p} size={32} decorative />
                <span className="hud-player-meta">
                  <span className="hud-player-name">
                    {p.name || (pid === 'p1' ? 'ผู้เล่น 1' : 'ผู้เล่น 2')}
                  </span>
                  <span className="hud-player-tag">
                    {playMode === 'online'
                      ? pid === myOnlineRole
                        ? '● คุณกำลังเดิน'
                        : isPeerOnline
                          ? '● แฟนออนไลน์'
                          : '○ รอแฟนเข้าห้อง'
                      : isActive
                        ? 'กำลังเดิน'
                        : pid === 'p1'
                          ? 'P1'
                          : 'P2'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="hud-actions">
          {playMode === 'online' ? (
            <>
              <button
                type="button"
                className={`btn btn--hud ${bothOnline ? 'is-on' : ''}`}
                onClick={() => void handleCopyLink()}
              >
                {copiedInvite
                  ? '✓ คัดลอกลิงก์แล้ว!'
                  : roomStatus === 'connected'
                    ? `🔗 ห้อง ${roomCode} (${bothOnline ? '2/2' : '1/2 ชวนแฟน'})`
                    : 'กำลังเชื่อมห้อง...'}
              </button>
              {coupleDist > 150 && onWalkToPartner && (
                <button
                  type="button"
                  className="btn btn--hud"
                  onClick={onWalkToPartner}
                >
                  💞 วาร์ปไปข้างแฟน ({state.players[partnerRole].name})
                </button>
              )}
            </>
          ) : (
            <>
              {onQuickSwitchOnline && (
                <button
                  type="button"
                  className="btn btn--hud is-on"
                  onClick={onQuickSwitchOnline}
                >
                  🌐 เปิดห้องออนไลน์ชวนแฟน
                </button>
              )}
              <button
                type="button"
                className={`btn btn--hud ${state.settings.followPartner ? 'is-on' : ''}`}
                aria-pressed={state.settings.followPartner}
                onClick={onToggleFollow}
              >
                เดินคู่กัน: {state.settings.followPartner ? 'เปิด' : 'แยกเดิน'}
              </button>
            </>
          )}

          {onCycleCameraPreset && (
            <button
              type="button"
              className="btn btn--hud"
              onClick={onCycleCameraPreset}
            >
              🎥 {CAMERA_PRESET_LABELS[cameraPreset]}
            </button>
          )}

          {onResetCameraAngle && (
            <button
              type="button"
              className="btn btn--hud"
              title="รีเซ็ตมุมหมุนกล้อง 3 มิติกลับทิศเหนือ"
              onClick={onResetCameraAngle}
            >
              🧭 ตั้งกล้องตรง
            </button>
          )}

          <button
            type="button"
            className="btn btn--hud"
            aria-expanded={questOpen}
            aria-controls="quest-checklist-panel"
            onClick={() => setQuestOpen((prev) => !prev)}
          >
            ภารกิจ {progressPct}%
          </button>

          <button type="button" className="btn btn--hud" onClick={onOpenSetup}>
            แต่งตัว/ห้อง
          </button>

          <button
            type="button"
            className="btn btn--hud"
            aria-pressed={state.settings.soundEnabled}
            onClick={onToggleSound}
          >
            เสียง: {state.settings.soundEnabled ? 'เปิด' : 'ปิด'}
          </button>

          <button
            type="button"
            className="btn btn--hud"
            aria-pressed={reducedMotion}
            onClick={onToggleReducedMotion}
          >
            {reducedMotion ? 'ลดภาพเคลื่อนไหว: เปิด' : 'ลดภาพเคลื่อนไหว: ปิด'}
          </button>

          <button
            type="button"
            className="btn btn--hud btn--danger-outline"
            onClick={onRequestReset}
          >
            รีเซ็ต
          </button>
        </div>
      </div>

      <div className="hud-status-strip">
        <span className="hud-stage-pill">{stageText[state.questStage]}</span>
        <p className="hud-event-log" role="status" aria-live="polite">
          {state.lastEventLog}
        </p>
        {onSendEmote && (
          <div className="hud-emote-bar" role="group" aria-label="ส่งข้อความความรู้สึกให้แฟน">
            {COUPLE_EMOTES.map((em) => (
              <button
                key={em.emoji}
                type="button"
                className="btn btn--hud hud-emote-btn"
                title={`${em.emoji} ${em.text}`}
                aria-label={`ส่งข้อความ ${em.text}`}
                onClick={() => onSendEmote(em.emoji, em.text)}
              >
                {em.emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {questOpen && (
        <section
          id="quest-checklist-panel"
          className="quest-drawer"
          aria-label="รายการภารกิจคืนลอยกระทง"
        >
          <div className="quest-drawer__col">
            <h2 className="quest-drawer__title">
              1. ภารกิจคู่รักเก็บวัสดุ ({collectedCount}/3)
            </h2>
            <ul className="quest-list" role="list">
              {(Object.keys(MATERIAL_LABELS) as MaterialId[]).map((mat) => {
                const done = state.inventory[mat];
                return (
                  <li key={mat} className={done ? 'is-done' : ''}>
                    <span aria-hidden="true">{done ? '✓' : '○'}</span>{' '}
                    <strong>{MATERIAL_LABELS[mat].name}</strong> —{' '}
                    <span className="quest-hint">{MATERIAL_LABELS[mat].hint}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="quest-drawer__col">
            <h2 className="quest-drawer__title">2. มินิเกมประดิษฐ์กระทง (3 ด่านแอ็กชัน)</h2>
            <ul className="quest-list" role="list">
              {(['recipe', 'assembly', 'rhythm'] as MinigameId[]).map((gid) => {
                const rec = state.minigames[gid];
                const done = rec.status === 'passed';
                return (
                  <li key={gid} className={done ? 'is-done' : ''}>
                    <span aria-hidden="true">{done ? '✓' : '○'}</span>{' '}
                    {MINIGAME_TITLES[gid]}
                    {done ? ` (${rec.score} คะแนน)` : ''}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="quest-drawer__col">
            <h2 className="quest-drawer__title">3. จุดพิเศษคู่รักและพิธีปล่อยกระทง</h2>
            <ul className="quest-list" role="list">
              <li
                className={
                  state.litLanternIds.length === LANTERN_SPOTS.length ? 'is-done' : ''
                }
              >
                ช่วยกันจุดโคมยี่เป็ง ({state.litLanternIds.length}/{LANTERN_SPOTS.length} ดวง)
              </li>
              <li className={state.pavilionBlessed ? 'is-done' : ''}>
                บรรเลงระฆังศาลาคู่รักแสงจันทร์ (
                {state.pavilionBlessed ? 'รับคำอวยพรแล้ว' : 'ยังไม่แวะ'})
              </li>
              <li className={state.releasedKrathongs.length > 0 ? 'is-done' : ''}>
                ปล่อยกระทงที่ท่าน้ำแสงจันทร์ ({state.releasedKrathongs.length} ใบ)
              </li>
            </ul>
          </div>
        </section>
      )}
    </header>
  );
}
