
import { memo, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Direction } from '../domain/types';
import { HudIcon, HudIconButton } from './hud/HudPrimitives';

interface TouchControlsProps {
  activePlayerName: string;
  alwaysVisible: boolean;
  onVectorChange: (vx: number, vy: number) => void;
  onNudgeStep: (dx: number, dy: number, facing: Direction) => void;
}

const directions = [
  { facing: 'up', label: 'เดินขึ้น', x: 0, y: -1 },
  { facing: 'left', label: 'เดินซ้าย', x: -1, y: 0 },
  { facing: 'right', label: 'เดินขวา', x: 1, y: 0 },
  { facing: 'down', label: 'เดินลง', x: 0, y: 1 },
] as const;

export const TouchControls = memo(function TouchControls({
  activePlayerName, alwaysVisible, onVectorChange, onNudgeStep,
}: TouchControlsProps) {
  const [mode, setMode] = useState<'joystick' | 'dpad'>('joystick');
  const knob = useRef<HTMLSpanElement>(null);
  const pointer = useRef<number | null>(null);
  const center = useRef({ x: 0, y: 0, radius: 34 });
  const holdTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    window.clearInterval(holdTimer.current);
    onVectorChange(0, 0);
  }, [onVectorChange]);

  function move(clientX: number, clientY: number) {
    const { x, y, radius } = center.current;
    const dx = clientX - x;
    const dy = clientY - y;
    const scale = radius / Math.max(radius, Math.hypot(dx, dy));
    const kx = dx * scale;
    const ky = dy * scale;
    if (knob.current) knob.current.style.translate = `${kx}px ${ky}px`;
    onVectorChange(kx / radius, ky / radius);
  }

  function startStick(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointer.current !== null) return;
    const frame = event.currentTarget.getBoundingClientRect();
    center.current = { x: frame.left + frame.width / 2, y: frame.top + frame.height / 2, radius: Math.max(28, frame.width * 0.35) };
    pointer.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (document.activeElement instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      document.activeElement.blur();
    }
    move(event.clientX, event.clientY);
  }

  function stopStick(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    if (knob.current) knob.current.style.translate = '0px 0px';
    onVectorChange(0, 0);
  }

  function stopHold() {
    window.clearInterval(holdTimer.current);
    holdTimer.current = undefined;
    onVectorChange(0, 0);
  }

  function startHold(dx: number, dy: number, facing: Direction) {
    window.clearInterval(holdTimer.current);
    onVectorChange(dx, dy);
    onNudgeStep(dx * 14, dy * 14, facing);
    holdTimer.current = window.setInterval(() => onNudgeStep(dx * 10, dy * 10, facing), 80);
  }

  return (
    <div className="hud-touch" data-always-visible={alwaysVisible} role="group" aria-label="การเดินบนหน้าจอ">
      {mode === 'joystick' ? (
        <div className="hud-stick" aria-label={'จอยสติ๊กเดิน ' + activePlayerName}
          onPointerDown={startStick} onPointerMove={(event) => {
            if (pointer.current === event.pointerId) move(event.clientX, event.clientY);
          }} onPointerUp={stopStick} onPointerCancel={stopStick} onLostPointerCapture={stopStick}>
          <HudIcon name="compass" />
          <span ref={knob} className="hud-stick__knob" />
        </div>
      ) : (
        <div className="hud-dpad">
          {directions.map(({ facing, label, x, y }) => (
            <HudIconButton key={facing} icon={facing} label={label} className={`hud-dpad__${facing}`}
              onPointerDown={() => startHold(x, y, facing)} onPointerUp={stopHold}
              onPointerLeave={stopHold} onPointerCancel={stopHold}
              onClick={() => onNudgeStep(x * 24, y * 24, facing)} />
          ))}
        </div>
      )}
      <HudIconButton icon={mode === 'joystick' ? 'pad' : 'compass'} className="hud-touch__toggle"
        label={mode === 'joystick' ? 'สลับเป็นปุ่มทิศทาง' : 'สลับเป็นจอยสติ๊ก'}
        onClick={() => {
          stopHold();
          pointer.current = null;
          setMode((value) => value === 'joystick' ? 'dpad' : 'joystick');
        }} />
    </div>
  );
});
