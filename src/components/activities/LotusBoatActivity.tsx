import { useCallback, useEffect, useRef, useState } from 'react';
import { BOAT_LOTUS_TARGETS } from '../../domain/reducer';
import type {
  CoopSignalEvent,
  LotusBoatState,
  PlayerId,
  PlayerProfile,
} from '../../domain/types';
import { playChime } from '../../game/sound';

interface LotusBoatActivityProps {
  boat: LotusBoatState;
  players: Record<PlayerId, PlayerProfile>;
  myRole: PlayerId;
  bothOnline: boolean;
  lastSignal: CoopSignalEvent | null;
  reducedMotion: boolean;
  soundEnabled: boolean;
  onUpdateBoat: (patch: Partial<LotusBoatState>) => void;
  onPickLotus: (lotusId: string, byPlayer: PlayerId) => void;
  onSendSignal?: (
    spotId: string,
    action: string,
    value?: number,
    x?: number,
    y?: number
  ) => void;
}

const FIREFLIES = [
  { x: 14, y: 22, delay: '0s' },
  { x: 38, y: 16, delay: '1.1s' },
  { x: 64, y: 24, delay: '2.2s' },
  { x: 84, y: 44, delay: '0.6s' },
  { x: 76, y: 78, delay: '1.7s' },
  { x: 46, y: 82, delay: '2.6s' },
  { x: 18, y: 68, delay: '0.9s' },
  { x: 52, y: 48, delay: '1.9s' },
];

const PICK_RADIUS = 19;

export function LotusBoatActivity({
  boat,
  players,
  myRole,
  bothOnline,
  lastSignal,
  reducedMotion,
  soundEnabled,
  onUpdateBoat,
  onPickLotus,
  onSendSignal,
}: LotusBoatActivityProps) {
  const [soloRoleView, setSoloRoleView] = useState<PlayerId>(myRole);
  const effectiveActor: PlayerId = bothOnline ? myRole : soloRoleView;

  const isRower = boat.rower === effectiveActor;
  const pickerRole: PlayerId = boat.rower === 'p1' ? 'p2' : 'p1';
  const isPicker = !isRower;

  const [livePos, setLivePos] = useState({
    x: boat.boatX,
    y: boat.boatY,
    angle: boat.boatAngle,
  });
  const [announcement, setAnnouncement] = useState(
    'ล่องเรือชมหิ่งห้อยอย่างสบายใจ ไม่มีเวลานับถอยหลัง'
  );
  const lastBroadcastRef = useRef(0);
  const pondRef = useRef<HTMLDivElement>(null);

  // Keep local smooth boat position in sync with shared state
  useEffect(() => {
    setLivePos({ x: boat.boatX, y: boat.boatY, angle: boat.boatAngle });
  }, [boat.boatX, boat.boatY, boat.boatAngle]);

  // Smooth real-time partner steering signal
  useEffect(() => {
    if (
      lastSignal &&
      lastSignal.spotId === 'gather-lotus' &&
      lastSignal.action === 'boat-pos' &&
      lastSignal.playerId !== myRole &&
      typeof lastSignal.x === 'number' &&
      typeof lastSignal.y === 'number'
    ) {
      setLivePos({
        x: lastSignal.x,
        y: lastSignal.y,
        angle: lastSignal.value ?? 0,
      });
    }
  }, [lastSignal, myRole]);

  const steerTo = useCallback(
    (nextX: number, nextY: number) => {
      const clampedX = Math.max(8, Math.min(92, Math.round(nextX * 10) / 10));
      const clampedY = Math.max(14, Math.min(86, Math.round(nextY * 10) / 10));
      const dx = clampedX - livePos.x;
      const dy = clampedY - livePos.y;
      const angle =
        Math.hypot(dx, dy) > 0.3
          ? Math.round((Math.atan2(dy, dx) * 180) / Math.PI)
          : livePos.angle;
      setLivePos({ x: clampedX, y: clampedY, angle });

      const now = performance.now();
      if (now - lastBroadcastRef.current >= 90) {
        lastBroadcastRef.current = now;
        onSendSignal?.('gather-lotus', 'boat-pos', angle, clampedX, clampedY);
      }
      onUpdateBoat({ boatX: clampedX, boatY: clampedY, boatAngle: angle });
    },
    [livePos.angle, livePos.x, livePos.y, onSendSignal, onUpdateBoat]
  );

  const paddleDelta = useCallback(
    (dx: number, dy: number) => {
      if (!isRower) return;
      playChime('beat', soundEnabled);
      steerTo(livePos.x + dx, livePos.y + dy);
    },
    [isRower, livePos.x, livePos.y, soundEnabled, steerTo]
  );

  // Allow keyboard rowing when focused inside the modal
  useEffect(() => {
    if (!isRower) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        event.preventDefault();
        paddleDelta(0, -8);
      } else if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        event.preventDefault();
        paddleDelta(0, 8);
      } else if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        paddleDelta(-9, 0);
      } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        event.preventDefault();
        paddleDelta(9, 0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRower, paddleDelta]);

  const nearbyUncollected = BOAT_LOTUS_TARGETS.filter((t) => {
    if (boat.collectedIds.includes(t.id)) return false;
    return Math.hypot(t.x - livePos.x, t.y - livePos.y) <= PICK_RADIUS;
  });

  const handlePick = (lotusId: string, label: string) => {
    if (!isPicker) {
      setAnnouncement('สลับหน้าที่เป็นคนเก็บดอกบัว หรือชวนคู่รักแตะเก็บบัวข้างเรือได้เลย');
      return;
    }
    playChime('pickup', soundEnabled);
    onPickLotus(lotusId, effectiveActor);
    setAnnouncement(`เก็บ${label}ขึ้นเรือเรียบร้อยแล้ว`);
  };

  const handleSwapRoles = () => {
    const nextRower: PlayerId = boat.rower === 'p1' ? 'p2' : 'p1';
    playChime('beat', soundEnabled);
    onUpdateBoat({ rower: nextRower });
    setAnnouncement(
      `สลับหน้าที่แล้ว! ตอนนี้ ${players[nextRower].name} พายเรือ และ ${players[boat.rower].name} เก็บดอกบัว`
    );
  };

  const handlePondClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isRower || !pondRef.current) return;
    if ((event.target as HTMLElement).closest('button')) return;
    const rect = pondRef.current.getBoundingClientRect();
    const pctX = ((event.clientX - rect.left) / rect.width) * 100;
    const pctY = ((event.clientY - rect.top) / rect.height) * 100;
    playChime('beat', soundEnabled);
    steerTo(pctX, pctY);
  };

  const rowerName = players[boat.rower].name;
  const pickerName = players[pickerRole].name;

  return (
    <section
      className="romantic-activity lotus-boat-activity"
      aria-label="พายเรือเก็บดอกบัวด้วยกัน"
    >
      <div className="activity-role-bar">
        <div className="role-pill role-pill--rower">
          <span>🚣 คนพายเรือ:</span>
          <strong>{rowerName}</strong>
        </div>
        <div className="role-pill role-pill--picker">
          <span>🪷 คนเก็บดอกบัว:</span>
          <strong>{pickerName}</strong>
        </div>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={handleSwapRoles}
        >
          ⇄ สลับหน้าที่กัน
        </button>
      </div>

      {!bothOnline && (
        <div className="solo-preview-bar" role="group" aria-label="สลับฝั่งเล่นระหว่างรอคู่รัก">
          <span>กำลังรอแฟนเข้าห้อง · ลองสลับฝั่งเล่นดูได้:</span>
          <div className="solo-preview-bar__actions">
            {(['p1', 'p2'] as const).map((pid) => (
              <button
                key={pid}
                type="button"
                className={`btn btn--sm ${soloRoleView === pid ? 'btn--primary' : 'btn--secondary'}`}
                aria-pressed={soloRoleView === pid}
                onClick={() => setSoloRoleView(pid)}
              >
                มุมมอง {players[pid].name} ({boat.rower === pid ? 'พายเรือ' : 'เก็บบัว'})
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="activity-gentle-note">
        {isRower
          ? 'คุณคือคนพายเรือ — แตะบนผิวน้ำ กดปุ่มทิศทาง หรือใช้ลูกศรพาเรือเข้าใกล้ดอกบัวชมพูให้คนรักเก็บ'
          : 'คุณคือคนเก็บดอกบัว — รอเรือล่องเข้าใกล้ดอกบัวที่ส่องประกายแล้วแตะเก็บขึ้นเรือไปด้วยกัน'}
      </p>

      <div
        ref={pondRef}
        className={`moon-pond ${isRower ? 'moon-pond--steerable' : ''}`}
        data-reduced-motion={reducedMotion ? 'true' : 'false'}
        onClick={handlePondClick}
      >
        <div className="moon-pond__moon" aria-hidden="true" />

        {FIREFLIES.map((ff, idx) => (
          <span
            key={idx}
            className="moon-pond__firefly"
            style={{ left: `${ff.x}%`, top: `${ff.y}%`, animationDelay: ff.delay }}
            aria-hidden="true"
          />
        ))}

        {BOAT_LOTUS_TARGETS.map((lotus) => {
          const collected = boat.collectedIds.includes(lotus.id);
          const dist = Math.hypot(lotus.x - livePos.x, lotus.y - livePos.y);
          const inReach = !collected && dist <= PICK_RADIUS;
          return (
            <button
              key={lotus.id}
              type="button"
              className={`pond-lotus ${collected ? 'is-collected' : ''} ${inReach ? 'is-in-reach' : ''}`}
              style={{ left: `${lotus.x}%`, top: `${lotus.y}%` }}
              disabled={collected || !inReach || !isPicker}
              aria-label={
                collected
                  ? `${lotus.label} เก็บแล้ว`
                  : inReach
                    ? `เก็บ${lotus.label}`
                    : `${lotus.label} (พายเรือเข้ามาใกล้อีกนิด)`
              }
              onClick={() => handlePick(lotus.id, lotus.label)}
            >
              <span aria-hidden="true">{collected ? '✨' : '🪷'}</span>
              {inReach && isPicker && (
                <span className="pond-lotus__tag">แตะเก็บ!</span>
              )}
            </button>
          );
        })}

        <div
          className="pond-boat"
          style={{
            left: `${livePos.x}%`,
            top: `${livePos.y}%`,
            transform: `translate(-50%, -50%) rotate(${livePos.angle}deg)`,
          }}
          aria-hidden="true"
        >
          <span className="pond-boat__hull">🛶</span>
          <span className="pond-boat__glow" />
        </div>
      </div>

      <div className="boat-controls-row">
        {isRower ? (
          <div className="boat-paddle-pad" role="group" aria-label="ปุ่มพายเรือ">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => paddleDelta(0, -10)}
            >
              ↑ พายขึ้น
            </button>
            <div className="boat-paddle-pad__mid">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => paddleDelta(-11, 0)}
              >
                ← ซ้าย
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => paddleDelta(11, 0)}
              >
                ขวา →
              </button>
            </div>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => paddleDelta(0, 10)}
            >
              ↓ พายลง
            </button>
          </div>
        ) : (
          <div className="picker-action-box">
            {nearbyUncollected.length > 0 ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() =>
                  handlePick(nearbyUncollected[0].id, nearbyUncollected[0].label)
                }
              >
                🪷 เก็บ{nearbyUncollected[0].label}ขึ้นเรือ
              </button>
            ) : (
              <p className="status-badge">
                รอ {rowerName} พายเรือเข้าใกล้ดอกบัวชมพู (สามารถส่งสัญญาณบอกทางกันได้!)
              </p>
            )}
          </div>
        )}

        <div className="boat-basket">
          <span className="boat-basket__label">ตะกร้าดอกบัวบนเรือ</span>
          <div className="boat-basket__icons" aria-label={`เก็บแล้ว ${boat.collectedIds.length} จาก ${BOAT_LOTUS_TARGETS.length} ดอก`}>
            {BOAT_LOTUS_TARGETS.map((lotus) => (
              <span
                key={lotus.id}
                className={
                  boat.collectedIds.includes(lotus.id)
                    ? 'basket-bloom is-filled'
                    : 'basket-bloom'
                }
              >
                🪷
              </span>
            ))}
          </div>
        </div>
      </div>

      {boat.completed && (
        <div className="romantic-reward-banner" role="status">
          🌸 ทั้งคู่พายเรือเก็บบัวชมพูครบแล้ว! ได้รับ <strong>ดอกบัวชมพูจากสระหิ่งห้อย</strong> — ยังสามารถล่องเรือชมหิ่งห้อยด้วยกันต่อได้ตามสบายเลย
        </div>
      )}

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
