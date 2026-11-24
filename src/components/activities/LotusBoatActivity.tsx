import { useEffect, useRef } from 'react';
import { BOAT_LOTUS_TARGETS, canReachLotus, type ActivitySkillCommand } from '../../domain/activitySkills.mjs';
import type { LotusBoatState, PlayerId, PlayerProfile } from '../../domain/types';
import { playChime } from '../../game/sound';
import { HudIcon } from '../hud/HudPrimitives';

interface LotusBoatActivityProps {
  boat: LotusBoatState;
  players: Record<PlayerId, PlayerProfile>;
  myRole: PlayerId;
  bothOnline: boolean;
  reducedMotion: boolean;
  soundEnabled: boolean;
  onCommand: (command: ActivitySkillCommand) => void;
}

const FIREFLIES = [[14,22], [38,16], [64,24], [84,44], [76,78], [46,82], [18,68], [52,48]];
const ROW_DIRECTION: Record<string, number> = {
  arrowright: 0, d: 0, arrowdown: 90, s: 90, arrowleft: 180, a: 180, arrowup: 270, w: 270,
};

export function LotusBoatActivity({
  boat, players, myRole, bothOnline, reducedMotion, soundEnabled, onCommand,
}: LotusBoatActivityProps) {
  const pond = useRef<HTMLDivElement>(null);
  const isRower = boat.rower === myRole;
  const pickerRole = boat.rower === 'p1' ? 'p2' : 'p1';
  const canRow = bothOnline && isRower;
  const targetsInRange = BOAT_LOTUS_TARGETS.filter((flower) =>
    !boat.collectedIds.includes(flower.id) && canReachLotus(boat, flower));
  const closeWithoutAlignment = BOAT_LOTUS_TARGETS.some((flower) =>
    !boat.collectedIds.includes(flower.id) && Math.hypot(flower.x - boat.boatX, flower.y - boat.boatY) <= 12);

  useEffect(() => {
    if (!canRow) return;
    const keyStroke = (event: KeyboardEvent) => {
      if (event.repeat || (event.target instanceof Element && event.target.closest('input,textarea,select'))) return;
      const angle = ROW_DIRECTION[event.key.toLowerCase()];
      if (angle === undefined) return;
      event.preventDefault();
      onCommand({ type: 'boat-stroke', angle });
    };
    window.addEventListener('keydown', keyStroke);
    return () => window.removeEventListener('keydown', keyStroke);
  }, [canRow, onCommand]);

  function stroke(angle: number) {
    playChime('beat', soundEnabled);
    onCommand({ type: 'boat-stroke', angle });
  }

  return (
    <section className="romantic-activity lotus-boat-activity" aria-label="พายเรือเก็บดอกบัวด้วยกัน">
      <div className="activity-role-bar">
        <div className="role-pill role-pill--rower"><span>คนพายเรือ:</span><strong>{players[boat.rower].name}</strong></div>
        <div className="role-pill role-pill--picker"><span>คนเก็บดอกบัว:</span><strong>{players[pickerRole].name}</strong></div>
        <button type="button" className="btn btn--secondary btn--sm" disabled={!canRow}
          onClick={() => onCommand({ type: 'boat-swap' })}>ส่งไม้พายให้อีกคน</button>
      </div>
      <p className="activity-gentle-note">
        {isRower
          ? 'แตะผิวน้ำเพื่อหันทิศ แล้วกดพายทีละจังหวะ จอดให้ดอกบัวอยู่ข้างลำเรือ'
          : 'บอกคนพายให้หันด้านข้างเข้าหาดอกบัว เมื่อดอกบัวขึ้นขอบทองจึงเอื้อมเก็บได้'}
      </p>
      {!bothOnline && <p className="status-badge" role="status">รอให้อีกคนออนไลน์ก่อนลงเรือ</p>}
      <div
        ref={pond}
        className="moon-pond moon-pond--skill"
        data-reduced-motion={reducedMotion}
        onClick={(event) => {
          if (!canRow || !pond.current || !(event.target instanceof Element) || event.target.closest('button')) return;
          const box = pond.current.getBoundingClientRect();
          if (!box.width || !box.height) return;
          const x = (event.clientX - box.left) * 100 / box.width;
          const y = (event.clientY - box.top) * 100 / box.height;
          if (Math.hypot(x - boat.boatX, y - boat.boatY) < 2) return;
          onCommand({ type: 'boat-aim', angle: Math.atan2(y - boat.boatY, x - boat.boatX) * 180 / Math.PI });
        }}>
        <div className="moon-pond__moon" aria-hidden="true" />
        {FIREFLIES.map(([x,y], index) => (
          <span key={index} className="moon-pond__firefly" style={{ left: x + '%', top: y + '%', animationDelay: (index * -.42) + 's' }} aria-hidden="true" />
        ))}
        {BOAT_LOTUS_TARGETS.map((flower) => {
          const collected = boat.collectedIds.includes(flower.id);
          const aligned = !collected && canReachLotus(boat, flower);
          return (
            <button key={flower.id} type="button" className={'pond-lotus' + (collected ? ' is-collected' : aligned ? ' is-in-reach' : '')}
              style={{ left: flower.x + '%', top: flower.y + '%' }}
              aria-label={collected ? flower.label + ' เก็บแล้ว' : 'เก็บ' + flower.label}
              disabled={!bothOnline || isRower || !aligned}
              onClick={() => {
                playChime('pickup', soundEnabled);
                onCommand({ type: 'boat-pick', id: flower.id });
              }}>
              <HudIcon name={collected ? 'check' : 'lotus'} />
            </button>
          );
        })}
        <div className="pond-boat pond-boat--skill"
          style={{ left: boat.boatX + '%', top: boat.boatY + '%', transform: 'translate(-50%, -50%) rotate(' + boat.boatAngle + 'deg)' }}
          aria-hidden="true">
          <svg viewBox="0 0 76 38">
            <path d="M5 19C18 5 48 4 70 19C50 34 18 33 5 19Z" fill="#79503b" stroke="#e1bc7c" strokeWidth="2"/>
            <path d="M12 19h49M29 9v20m16-20v20M67 19h7" fill="none" stroke="#ead3a3" strokeWidth="2"/>
            <path d="M32 4h12m-12 30h12" stroke="#f0d49a" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
      <div className="skill-action-row" role="group" aria-label={isRower ? 'ควบคุมเรือ' : 'เก็บดอกบัว'}>
        {isRower ? (
          <>
            {[['พายเหนือ',270], ['พายซ้าย',180], ['พายขวา',0], ['พายใต้',90]].map(([label, angle]) => (
              <button key={label} type="button" className="btn btn--secondary btn--sm" disabled={!canRow}
                onClick={() => stroke(Number(angle))}>{label}</button>
            ))}
            <button type="button" className="btn btn--primary btn--sm" disabled={!canRow} onClick={() => stroke(boat.boatAngle)}>
              พายตามหัวเรือ
            </button>
          </>
        ) : (
          <p className="status-badge" role="status">
            {targetsInRange.length ? 'เก็บดอกบัวที่ขึ้นขอบทองได้เลย'
              : closeWithoutAlignment ? 'อยู่ใกล้แล้ว ลองหันด้านข้างเรือเข้าหาดอกบัว'
                : 'รอเรือเข้าใกล้ดอกบัว'}
          </p>
        )}
      </div>
      <p className="status-badge" role="status">เก็บดอกบัวแล้ว {boat.collectedIds.length}/{BOAT_LOTUS_TARGETS.length} ดอก</p>
      {boat.completed && <p className="romantic-reward-banner">เก็บดอกบัวครบแล้ว ได้รับดอกบัวชมพูจากสระหิ่งห้อย</p>}
    </section>
  );
}
