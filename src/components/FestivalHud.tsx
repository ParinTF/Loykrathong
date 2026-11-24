import { useState } from 'react';
import {
  MATERIAL_LABELS,
  MINIGAME_TITLES,
  countCollectedMaterials,
  getCoupleProgressPercent,
} from '../domain/reducer';
import { LANTERN_SPOTS } from '../domain/worldMap';
import type { GameState, MaterialId, MinigameId, PlayerId } from '../domain/types';
import { AvatarPreview } from './AvatarPreview';

interface FestivalHudProps {
  state: GameState;
  reducedMotion: boolean;
  onSetActivePlayer: (playerId: PlayerId) => void;
  onToggleFollow: () => void;
  onOpenSetup: () => void;
  onToggleSound: () => void;
  onToggleReducedMotion: () => void;
  onRequestReset: () => void;
}

export function FestivalHud({
  state,
  reducedMotion,
  onSetActivePlayer,
  onToggleFollow,
  onOpenSetup,
  onToggleSound,
  onToggleReducedMotion,
  onRequestReset,
}: FestivalHudProps) {
  const [questOpen, setQuestOpen] = useState(false);

  const progressPct = getCoupleProgressPercent(state);
  const collectedCount = countCollectedMaterials(state.inventory);
  const stageText: Record<GameState['questStage'], string> = {
    explore: `สำรวจเก็บวัสดุ (${collectedCount}/3)`,
    craft: 'ไปที่โต๊ะประดิษฐ์กระทง (3 ด่าน)',
    ceremony: 'ไปที่ท่าน้ำแสงจันทร์เพื่อปล่อยกระทง',
    released: `ปล่อยกระทงแล้ว ${state.releasedKrathongs.length} ใบ`,
  };

  return (
    <header className="hud-header">
      <div className="hud-top-row">
        <div className="hud-players" role="group" aria-label="สลับตัวละครที่ควบคุม">
          {(['p1', 'p2'] as const).map((pid) => {
            const p = state.players[pid];
            const isActive = state.settings.activePlayer === pid;
            return (
              <button
                key={pid}
                type="button"
                className={`hud-player-btn ${isActive ? 'is-active' : ''}`}
                aria-pressed={isActive}
                onClick={() => onSetActivePlayer(pid)}
              >
                <AvatarPreview profile={p} size={32} decorative />
                <span className="hud-player-meta">
                  <span className="hud-player-name">
                    {p.name || (pid === 'p1' ? 'ผู้เล่น 1' : 'ผู้เล่น 2')}
                  </span>
                  <span className="hud-player-tag">
                    {isActive ? 'กำลังเดิน' : pid === 'p1' ? 'P1' : 'P2'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="hud-actions">
          <button
            type="button"
            className={`btn btn--hud ${state.settings.followPartner ? 'is-on' : ''}`}
            aria-pressed={state.settings.followPartner}
            onClick={onToggleFollow}
          >
            เดินคู่กัน: {state.settings.followPartner ? 'เปิด' : 'แยกเดิน'}
          </button>

          <button
            type="button"
            className="btn btn--hud"
            aria-expanded={questOpen}
            aria-controls="quest-checklist-panel"
            onClick={() => setQuestOpen((prev) => !prev)}
          >
            ภารกิจ {progressPct}%
          </button>

          <button
            type="button"
            className="btn btn--hud"
            onClick={onOpenSetup}
          >
            แต่งตัวละคร
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
      </div>

      {questOpen && (
        <section
          id="quest-checklist-panel"
          className="quest-drawer"
          aria-label="รายการภารกิจคืนลอยกระทง"
        >
          <div className="quest-drawer__col">
            <h2 className="quest-drawer__title">1. เก็บวัสดุในงาน ({collectedCount}/3)</h2>
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
            <h2 className="quest-drawer__title">2. มินิเกมประดิษฐ์กระทง (3 ด่านต่อเนื่อง)</h2>
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
            <h2 className="quest-drawer__title">3. จุดพิเศษและพิธีปล่อยกระทง</h2>
              <ul className="quest-list" role="list">
              <li className={state.litLanternIds.length === LANTERN_SPOTS.length ? 'is-done' : ''}>
                จุดโคมยี่เป็งในลาน ({state.litLanternIds.length}/{LANTERN_SPOTS.length} ดวง)
              </li>
              <li className={state.pavilionBlessed ? 'is-done' : ''}>
                แวะศาลาคู่รักแสงจันทร์ ({state.pavilionBlessed ? 'รับคำอวยพรแล้ว' : 'ยังไม่แวะ'})
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