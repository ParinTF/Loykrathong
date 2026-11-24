import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  isLanternHeatReady, LANTERN_COUNTDOWN_MS, LANTERN_HEAT, LANTERN_HOLD_MS, type ActivitySkillCommand,
} from '../../domain/activitySkills.mjs';
import type { PlayerId, PlayerProfile, SkyLanternState } from '../../domain/types';
import { playChime } from '../../game/sound';
import { HudIcon } from '../hud/HudPrimitives';

interface SkyLanternActivityProps {
  lantern: SkyLanternState;
  players: Record<PlayerId, PlayerProfile>;
  myRole: PlayerId;
  bothOnline: boolean;
  reducedMotion: boolean;
  soundEnabled: boolean;
  onSetWish: (playerId: PlayerId, wish: string) => void;
  onCommand: (command: ActivitySkillCommand) => void;
}

function isHoldKey(key: string) {
  return key === ' ' || key === 'Enter';
}

export function SkyLanternActivity({
  lantern, players, myRole, bothOnline, reducedMotion, soundEnabled, onSetWish, onCommand,
}: SkyLanternActivityProps) {
  const [heat, setHeat] = useState(25);
  const [now, setNow] = useState(Date.now);
  const holding = useRef(false);
  const latestCommand = useRef(onCommand);
  const bothLit = lantern.p1Lit && lantern.p2Lit;
  const deadline = lantern.warmUntil ?? lantern.liftAt;
  const wasLit = useRef(bothLit);
  const wasReleased = useRef(lantern.released);
  const myWish = myRole === 'p1' ? lantern.p1Wish : lantern.p2Wish;
  const myGrip = myRole === 'p1' ? lantern.p1Grip : lantern.p2Grip;
  const myReady = myRole === 'p1' ? lantern.p1ReadyRelease : lantern.p2ReadyRelease;
  const [heatMin, heatMax] = LANTERN_HEAT[myRole];
  const heatReady = isLanternHeatReady(myRole, heat);
  const canGrip = bothOnline && myWish.trim().length > 0 && heatReady && !bothLit;
  const canReady = bothOnline && !myReady && Boolean(lantern.p1Wish.trim() && lantern.p2Wish.trim());

  useEffect(() => {
    if (deadline == null) return;
    function refresh() { setNow(Date.now()); }
    refresh();
    const timer = window.setInterval(refresh, reducedMotion ? 240 : 80);
    return () => window.clearInterval(timer);
  }, [deadline, reducedMotion]);

  useEffect(() => {
    if (bothLit && !wasLit.current) playChime('lantern', soundEnabled);
    if (lantern.released && !wasReleased.current) playChime('ceremony', soundEnabled);
    wasLit.current = bothLit;
    wasReleased.current = lantern.released;
  }, [bothLit, lantern.released, soundEnabled]);

  useEffect(() => {
    latestCommand.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    function stopHolding() {
      if (!holding.current) return;
      holding.current = false;
      latestCommand.current({ type: 'lantern-grip', held: false });
    }
    const onVisibility = () => { if (document.hidden) stopHolding(); };
    window.addEventListener('blur', stopHolding);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', stopHolding);
      document.removeEventListener('visibilitychange', onVisibility);
      stopHolding();
    };
  }, []);

  function beginHold() {
    if (!canGrip || holding.current) return;
    holding.current = true;
    onCommand({ type: 'lantern-grip', held: true, heat });
  }

  function stopHold() {
    if (!holding.current) return;
    holding.current = false;
    onCommand({ type: 'lantern-grip', held: false });
  }

  function pressHold(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    beginHold();
  }

  const warmProgress = lantern.warmUntil != null
    ? Math.max(0, Math.min(100, 100 * (1 - (lantern.warmUntil - now) / LANTERN_HOLD_MS)))
    : 0;
  const remaining = lantern.liftAt != null
    ? Math.max(1, Math.min(LANTERN_COUNTDOWN_MS / 1000, Math.ceil((lantern.liftAt - now) / 1000)))
    : null;

  return (
    <section className="romantic-activity sky-lantern-activity" aria-label="ส่งความปรารถนาขึ้นสู่ท้องฟ้า">
      <p className="activity-gentle-note">
        เขียนคำอธิษฐานคนละหนึ่งข้อ ตั้งระดับไฟในเขตทองของตัวเอง แล้วค้างประคองพร้อมกัน 1.8 วินาที
      </p>
      {!bothOnline && !lantern.released && <p className="status-badge" role="status">รอให้อีกคนออนไลน์ก่อนจุดโคม</p>}
      <div className={'lantern-ritual-stage' + (bothLit ? ' is-lit' : '') + (lantern.released ? ' is-released' : '')}>
        <div className="lantern-body">
          <div className="lantern-body__panel">
            <span className="lantern-body__author">{players.p1.name}</span>
            <p className="lantern-body__wish">{lantern.p1Wish.trim() || 'รอเขียนคำอธิษฐาน'}</p>
          </div>
          <div className="lantern-body__divider" aria-hidden="true" />
          <div className="lantern-body__panel">
            <span className="lantern-body__author">{players.p2.name}</span>
            <p className="lantern-body__wish">{lantern.p2Wish.trim() || 'รอเขียนคำอธิษฐาน'}</p>
          </div>
        </div>
        <div className="lantern-burner" aria-hidden="true">
          <span className={'burner-flame' + (lantern.p1Lit || lantern.p1Grip ? ' is-on' : '')}><HudIcon name="candle" /></span>
          <span className={'burner-flame' + (lantern.p2Lit || lantern.p2Grip ? ' is-on' : '')}><HudIcon name="candle" /></span>
        </div>
        {remaining !== null && <div className="lantern-countdown-overlay" role="status" aria-label={'ปล่อยโคมใน ' + remaining + ' วินาที'}>{remaining}</div>}
      </div>

      {lantern.released ? (
        <p className="romantic-reward-banner" role="status">โคมของทั้งสองคนลอยสว่างขึ้นสู่ท้องฟ้าในฉาก 3 มิติแล้ว</p>
      ) : (
        <div className="lantern-controls">
          <label className="field-group">
            <span className="field-label">คำอธิษฐานของ {players[myRole].name}</span>
            <textarea className="text-input text-area" rows={2} maxLength={110} value={myWish}
              disabled={myGrip || myReady} onChange={(event) => onSetWish(myRole, event.target.value)} />
          </label>
          {!bothLit && (
            <>
              <label className="lantern-heat-control" data-ready={heatReady}>
                <span className="field-label">ระดับไฟฝั่งคุณ <strong>{heat}%</strong></span>
                <span className="lantern-heat-control__scale" aria-hidden="true">
                  <i style={{ left: heatMin + '%', width: (heatMax - heatMin) + '%' }} />
                </span>
                <input type="range" min={0} max={100} value={heat} disabled={myGrip}
                  aria-valuetext={heat + '% เขตทอง ' + heatMin + ' ถึง ' + heatMax + '%'}
                  onChange={(event) => setHeat(Number(event.target.value))} />
              </label>
              <p className="skill-feedback">{heatReady ? 'ไฟอยู่ในเขตทองแล้ว' : 'ปรับไฟให้อยู่ในช่วง ' + heatMin + '–' + heatMax + '%'}</p>
              <div className="lantern-balance" role="progressbar" aria-label="ประคองไฟพร้อมกัน"
                aria-valuenow={Math.round(warmProgress)}>
                <span style={{ width: warmProgress + '%' }} />
              </div>
              <button type="button" className="btn btn--primary lantern-hold-button" disabled={!canGrip}
                aria-pressed={Boolean(myGrip)}
                onPointerDown={pressHold} onPointerUp={stopHold} onPointerCancel={stopHold}
                onLostPointerCapture={stopHold} onBlur={stopHold} onContextMenu={(event) => event.preventDefault()}
                onKeyDown={(event) => {
                  if (!isHoldKey(event.key)) return;
                  event.preventDefault();
                  if (!event.repeat) beginHold();
                }} onKeyUp={(event) => {
                  if (!isHoldKey(event.key)) return;
                  event.preventDefault();
                  stopHold();
                }}>
                {myGrip ? 'กำลังประคอง ค้างไว้' : 'กดค้างเพื่อประคองไฟ'}
              </button>
            </>
          )}
          {bothLit && (
            <button type="button" className="btn btn--primary" disabled={!canReady}
              onClick={() => onCommand({ type: 'lantern-ready' })}>
              {myReady ? 'พร้อมแล้ว รออีกคน' : 'เตรียมปล่อยโคมพร้อมกัน'}
            </button>
          )}
          <div className="activity-role-bar" aria-label="สถานะการประคองโคม">
            <span className={'sync-pill' + (lantern.p1Grip || lantern.p1Lit ? ' is-ready' : '')}>
              {players.p1.name} · {lantern.p1Lit ? 'ไฟพร้อม' : lantern.p1Grip ? 'กำลังประคอง' : 'รอประคอง'}
            </span>
            <span className={'sync-pill' + (lantern.p2Grip || lantern.p2Lit ? ' is-ready' : '')}>
              {players.p2.name} · {lantern.p2Lit ? 'ไฟพร้อม' : lantern.p2Grip ? 'กำลังประคอง' : 'รอประคอง'}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
