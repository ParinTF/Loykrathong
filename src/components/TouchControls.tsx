import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Direction, WorldSpot } from '../domain/types';

interface TouchControlsProps {
  activePlayerName: string;
  nearbySpot: WorldSpot | null;
  onVectorChange: (vx: number, vy: number) => void;
  onNudgeStep: (dx: number, dy: number, facing: Direction) => void;
  onInteract: () => void;
}

const JOYSTICK_RADIUS = 36;

export function TouchControls({
  activePlayerName,
  nearbySpot,
  onVectorChange,
  onNudgeStep,
  onInteract,
}: TouchControlsProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [mobilePadMode, setMobilePadMode] = useState<'joystick' | 'dpad'>('joystick');

  const updateFromPointer = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rawX = clientX - cx;
    const rawY = clientY - cy;
    const dist = Math.hypot(rawX, rawY);
    const clamped = Math.min(dist, JOYSTICK_RADIUS);
    const angle = Math.atan2(rawY, rawX);
    const kx = dist > 0 ? Math.cos(angle) * clamped : 0;
    const ky = dist > 0 ? Math.sin(angle) * clamped : 0;
    setKnob({ x: kx, y: ky });
    onVectorChange(kx / JOYSTICK_RADIUS, ky / JOYSTICK_RADIUS);
  };

  const resetStick = () => {
    pointerIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    onVectorChange(0, 0);
  };

  const handlePadDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  };

  const handlePadMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    updateFromPointer(e.clientX, e.clientY);
  };

  const startHold = (dx: number, dy: number, facing: Direction) => {
    onVectorChange(dx, dy);
    onNudgeStep(dx * 14, dy * 14, facing);
    if (holdTimerRef.current) window.clearInterval(holdTimerRef.current);
    holdTimerRef.current = window.setInterval(() => {
      onNudgeStep(dx * 10, dy * 10, facing);
    }, 80);
  };

  const stopHold = () => {
    if (holdTimerRef.current) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    onVectorChange(0, 0);
  };

  return (
    <div
      className="touch-controls"
      data-mobile-pad={mobilePadMode}
      aria-label="แผงควบคุมการเดินและโต้ตอบ"
    >
      <div className="touch-move-cluster">
        <div
          ref={padRef}
          className="joystick-pad"
          aria-label={`จอยสติ๊กสำหรับเดิน (${activePlayerName})`}
          onPointerDown={handlePadDown}
          onPointerMove={handlePadMove}
          onPointerUp={resetStick}
          onPointerCancel={resetStick}
        >
          <div
            className="joystick-knob"
            style={{
              transform: `translate(${knob.x}px, ${knob.y}px)`,
            }}
          />
        </div>

        <div className="dpad-grid" role="group" aria-label="ปุ่มทิศทางแบบแตะ">
          <button
            type="button"
            className="dpad-btn dpad-btn--up"
            aria-label="เดินขึ้น"
            onPointerDown={() => startHold(0, -1, 'up')}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onClick={() => onNudgeStep(0, -24, 'up')}
          >
            ▲
          </button>
          <button
            type="button"
            className="dpad-btn dpad-btn--left"
            aria-label="เดินซ้าย"
            onPointerDown={() => startHold(-1, 0, 'left')}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onClick={() => onNudgeStep(-24, 0, 'left')}
          >
            ◀
          </button>
          <button
            type="button"
            className="dpad-btn dpad-btn--right"
            aria-label="เดินขวา"
            onPointerDown={() => startHold(1, 0, 'right')}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onClick={() => onNudgeStep(24, 0, 'right')}
          >
            ▶
          </button>
          <button
            type="button"
            className="dpad-btn dpad-btn--down"
            aria-label="เดินลง"
            onPointerDown={() => startHold(0, 1, 'down')}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onClick={() => onNudgeStep(0, 24, 'down')}
          >
            ▼
          </button>
        </div>

        <button
          type="button"
          className="btn btn--hud pad-mode-toggle"
          onClick={() =>
            setMobilePadMode((m) => (m === 'joystick' ? 'dpad' : 'joystick'))
          }
        >
          {mobilePadMode === 'joystick' ? 'ปุ่มทิศทาง' : 'จอยสติ๊ก'}
        </button>
      </div>

      <div className="touch-interact-cluster">
        <p className="keyboard-hint">คีย์บอร์ด: WASD (P1) · ลูกศร (P2) · E โต้ตอบ</p>
        <button
          type="button"
          className={`btn btn--interact ${nearbySpot ? 'is-ready' : ''}`}
          disabled={!nearbySpot}
          onClick={onInteract}
        >
          {nearbySpot ? `โต้ตอบ: ${nearbySpot.title}` : 'เดินเข้าใกล้จุดเรืองแสง'}
        </button>
      </div>
    </div>
  );
}