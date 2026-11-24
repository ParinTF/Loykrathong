import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { LEAF_SHAPES_ORDER } from '../../domain/reducer';
import type {
  LeafCutShapeId,
  LeafRelayState,
  PlayerId,
  PlayerProfile,
} from '../../domain/types';
import { playChime } from '../../game/sound';

interface LeafFoldRelayActivityProps {
  relay: LeafRelayState;
  players: Record<PlayerId, PlayerProfile>;
  myRole: PlayerId;
  bothOnline: boolean;
  soundEnabled: boolean;
  onUpdateRelay: (patch: Partial<LeafRelayState>) => void;
  onAdvanceCut: (byPlayer: PlayerId) => void;
  onAdvanceFold: (byPlayer: PlayerId) => void;
}

const SHAPE_INFO: Record<
  LeafCutShapeId,
  { name: string; cutHints: [string, string, string]; foldHints: [string, string, string] }
> = {
  swan: {
    name: 'กลีบหงส์อ่อนช้อย',
    cutHints: ['เจียนโคนใบให้โค้งเรียว', 'ตัดแต่งแนวเส้นกลางใบ', 'เล็มปลายกลีบให้พริ้วสวย'],
    foldHints: ['ลากพับมุมซ้ายเข้าหากลาง', 'ลากพับมุมขวาซ้อนทับอย่างประณีต', 'กลัดไม้กลัดตรึงกลีบหงส์ให้แน่น'],
  },
  lotus: {
    name: 'กลีบบัวหลวงรับจันทร์',
    cutHints: ['ตัดแบ่งแผ่นใบตองกว้างพอดี', 'โค้งมุมบนเป็นทรงกลีบบัว', 'แต่งริมใบตองให้เนียนเรียบ'],
    foldHints: ['พับจีบซ้ายโอบโค้งเข้าด้านใน', 'พับจีบขวาประคบเป็นทรงบัว', 'ม้วนโคนและกลัดเก็บกลีบบัว'],
  },
  garuda: {
    name: 'กลีบเล็บครุฑโบราณ',
    cutHints: ['เจียนแถบใบตองเรียวยาว', 'ตัดปลายแหลมทรงโบราณ', 'แต่งโคนใบให้พร้อมม้วนซ้อน'],
    foldHints: ['พับมุมแหลมลงกึ่งกลาง', 'ตลบปีกสองข้างโอบซ้อนกัน', 'กลัดยอดกลีบเล็บครุฑเสร็จสมบูรณ์'],
  },
};

export function LeafFoldRelayActivity({
  relay,
  players,
  myRole,
  bothOnline,
  soundEnabled,
  onUpdateRelay,
  onAdvanceCut,
  onAdvanceFold,
}: LeafFoldRelayActivityProps) {
  const [soloRoleView, setSoloRoleView] = useState<PlayerId>(myRole);
  const effectiveActor: PlayerId = bothOnline ? myRole : soloRoleView;

  const isCutter = relay.cutter === effectiveActor;
  const folderRole: PlayerId = relay.cutter === 'p1' ? 'p2' : 'p1';
  const isFolder = !isCutter;

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [foldDragging, setFoldDragging] = useState(false);

  const shapeMeta = SHAPE_INFO[relay.currentShape];
  const cutterName = players[relay.cutter].name;
  const folderName = players[folderRole].name;

  const handleSwap = () => {
    const nextCutter: PlayerId = relay.cutter === 'p1' ? 'p2' : 'p1';
    playChime('beat', soundEnabled);
    onUpdateRelay({ cutter: nextCutter });
  };

  const handleCutPoint = () => {
    if (!isCutter || relay.passedLeafReady) return;
    playChime('pickup', soundEnabled);
    onAdvanceCut(effectiveActor);
  };

  const handleFoldStep = () => {
    if (!isFolder || !relay.passedLeafReady) return;
    playChime(relay.foldStep === 2 ? 'success' : 'beat', soundEnabled);
    onAdvanceFold(effectiveActor);
  };

  const handleFoldPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isFolder || !relay.passedLeafReady || event.button !== 0) return;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    setFoldDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleFoldPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dist = Math.hypot(
      event.clientX - dragStartRef.current.x,
      event.clientY - dragStartRef.current.y
    );
    if (dist >= 34) {
      dragStartRef.current = null;
      setFoldDragging(false);
      handleFoldStep();
    }
  };

  const handleFoldPointerEnd = () => {
    dragStartRef.current = null;
    setFoldDragging(false);
  };

  return (
    <section
      className="romantic-activity leaf-relay-activity"
      aria-label="ช่วยกันพับใบตองแบบส่งต่อเรียลไทม์"
    >
      <div className="dialogue-bubble">
        <p>
          <strong>ป้าบัว:</strong> งานกระทงสวยต้องค่อยๆ ทำด้วยกันนะลูก — คนหนึ่งเจียนใบตองตามเส้น
          พอเจียนเสร็จใบตองสดจะส่งข้ามโต๊ะไปให้อีกคนลากพับเป็นกลีบต่อทันทีเลย!
        </p>
      </div>

      <div className="activity-role-bar">
        <div className="role-pill role-pill--rower">
          <span>✂️ คนเจียนใบตอง:</span>
          <strong>{cutterName}</strong>
        </div>
        <div className="role-pill role-pill--picker">
          <span>🌿 คนพับกลีบ:</span>
          <strong>{folderName}</strong>
        </div>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={handleSwap}
        >
          ⇄ สลับหน้าที่กัน
        </button>
      </div>

      {!bothOnline && (
        <div className="solo-preview-bar" role="group" aria-label="สลับฝั่งเล่นระหว่างรอคู่รัก">
          <span>กำลังรอแฟนเข้าห้อง · ลองสลับฝั่งรับ-ส่งใบตองดูได้:</span>
          <div className="solo-preview-bar__actions">
            {(['p1', 'p2'] as const).map((pid) => (
              <button
                key={pid}
                type="button"
                className={`btn btn--sm ${soloRoleView === pid ? 'btn--primary' : 'btn--secondary'}`}
                aria-pressed={soloRoleView === pid}
                onClick={() => setSoloRoleView(pid)}
              >
                มุมมอง {players[pid].name} ({relay.cutter === pid ? 'คนเจียน' : 'คนพับ'})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="leaf-relay-stage">
        {/* Station 1: Cutter */}
        <article
          className={`leaf-station ${!relay.passedLeafReady ? 'is-active' : 'is-waiting'}`}
        >
          <header className="leaf-station__head">
            <span className="leaf-station__step">ขั้นที่ 1 · โต๊ะเจียนใบตอง</span>
            <strong>{cutterName}</strong>
          </header>

          <div className="leaf-board">
            <svg viewBox="0 0 180 120" className="leaf-svg" aria-hidden="true">
              <path
                d="M20 96 Q54 24 156 26 Q132 96 20 96 Z"
                fill="#15803D"
                stroke="#86EFAC"
                strokeWidth="2"
              />
              <path
                d="M24 94 Q88 60 152 28"
                fill="none"
                stroke="#BBF7D0"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              {[0, 1, 2].map((idx) => {
                const done = relay.passedLeafReady || relay.cutStep > idx;
                const cx = 56 + idx * 34;
                const cy = 76 - idx * 20;
                return (
                  <circle
                    key={idx}
                    cx={cx}
                    cy={cy}
                    r={done ? 7 : 9}
                    fill={done ? '#FDE68A' : 'rgba(251, 191, 36, 0.25)'}
                    stroke="#FDE68A"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>
            <p className="leaf-board__caption">
              ทรงปัจจุบัน: <strong>{shapeMeta.name}</strong>
            </p>
          </div>

          {relay.passedLeafReady ? (
            <p className="status-badge status-badge--ok">
              ✓ ส่งใบตองที่เจียนแล้วข้ามไปให้ {folderName} พับกลีบอยู่!
            </p>
          ) : isCutter ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleCutPoint}
            >
              ✂️ {shapeMeta.cutHints[Math.min(2, relay.cutStep)]} ({relay.cutStep}/3)
            </button>
          ) : (
            <p className="status-badge">
              กำลังรอ {cutterName} เจียนใบตองส่งมาให้ ({relay.cutStep}/3)
            </p>
          )}
        </article>

        {/* Live Transfer Bridge */}
        <div
          className={`leaf-transfer-bridge ${relay.passedLeafReady ? 'is-flowing' : ''}`}
          aria-hidden="true"
        >
          <span>{relay.passedLeafReady ? '🍃 ส่งต่อแล้ว →' : '→'}</span>
        </div>

        {/* Station 2: Folder */}
        <article
          className={`leaf-station ${relay.passedLeafReady ? 'is-active' : 'is-waiting'}`}
        >
          <header className="leaf-station__head">
            <span className="leaf-station__step">ขั้นที่ 2 · โต๊ะพับกลีบ</span>
            <strong>{folderName}</strong>
          </header>

          <div
            className={`leaf-board leaf-board--foldable ${foldDragging ? 'is-dragging' : ''}`}
            onPointerDown={handleFoldPointerDown}
            onPointerMove={handleFoldPointerMove}
            onPointerUp={handleFoldPointerEnd}
            onPointerCancel={handleFoldPointerEnd}
          >
            {relay.passedLeafReady ? (
              <>
                <svg viewBox="0 0 180 120" className="leaf-svg" aria-hidden="true">
                  <path
                    d={
                      relay.foldStep === 0
                        ? 'M35 95 L90 22 L145 95 Z'
                        : relay.foldStep === 1
                          ? 'M52 95 L90 20 L142 95 L90 78 Z'
                          : 'M62 96 L90 16 L118 96 Q90 80 62 96 Z'
                    }
                    fill="#16A34A"
                    stroke="#FDE68A"
                    strokeWidth="2.5"
                  />
                  {relay.foldStep >= 2 && (
                    <circle cx="90" cy="74" r="5" fill="#FDE68A" />
                  )}
                </svg>
                <p className="leaf-board__caption">
                  {isFolder
                    ? 'ลากนิ้ว/เมาส์บนใบตอง หรือแตะปุ่มด้านล่างเพื่อพับกลีบ'
                    : `${folderName} กำลังบรรจงพับ${shapeMeta.name} (${relay.foldStep}/3)`}
                </p>
              </>
            ) : (
              <p className="leaf-board__empty">
                รอรับใบตองสดที่ {cutterName} กำลังเจียนส่งมา…
              </p>
            )}
          </div>

          {!relay.passedLeafReady ? (
            <p className="status-badge">พร้อมรับใบตองจากโต๊ะเจียน</p>
          ) : isFolder ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleFoldStep}
            >
              🌿 {shapeMeta.foldHints[Math.min(2, relay.foldStep)]} ({relay.foldStep}/3)
            </button>
          ) : (
            <p className="status-badge">
              {folderName} กำลังพับกลีบที่คุณเพิ่งส่งไปให้ ({relay.foldStep}/3)
            </p>
          )}
        </article>
      </div>

      <div className="finished-petals-tray" aria-label="กลีบใบตองที่ช่วยกันพับเสร็จแล้ว">
        {LEAF_SHAPES_ORDER.map((shapeId) => {
          const done = relay.finishedPetals.includes(shapeId);
          return (
            <div
              key={shapeId}
              className={`petal-badge ${done ? 'is-done' : ''}`}
            >
              <span>{done ? '✓' : '○'}</span>
              <span>{SHAPE_INFO[shapeId].name}</span>
            </div>
          );
        })}
      </div>

      {relay.completed && (
        <div className="romantic-reward-banner" role="status">
          🌿 ป้าบัวยิ้มปลื้มใจ! ทั้งคู่ช่วยกันเจียนและพับครบทั้ง 3 แบบแล้ว — ได้รับ{' '}
          <strong>กลีบใบตองฝีมือสองเรา</strong> สำหรับนำไปตกแต่งกระทงคู่กัน
        </div>
      )}
    </section>
  );
}
