import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  isLeafTraceValid, LEAF_SHAPES_ORDER, leafTrack,
  type ActivitySkillCommand, type LeafPhase, type LeafPoint, type LeafTrack,
} from '../../domain/activitySkills.mjs';
import type { LeafCutShapeId, LeafRelayState, PlayerId, PlayerProfile } from '../../domain/types';
import { playChime } from '../../game/sound';
import { HudIcon } from '../hud/HudPrimitives';

interface LeafFoldRelayActivityProps {
  relay: LeafRelayState;
  players: Record<PlayerId, PlayerProfile>;
  myRole: PlayerId;
  bothOnline: boolean;
  soundEnabled: boolean;
  onCommand: (command: ActivitySkillCommand) => void;
}

const SHAPE_NAME: Record<LeafCutShapeId, string> = {
  swan: 'กลีบหงส์อ่อนช้อย', lotus: 'กลีบบัวหลวงรับจันทร์', garuda: 'กลีบเล็บครุฑโบราณ',
};
const SHAPE_PATH: Record<LeafCutShapeId, string> = {
  swan: 'M12 83Q30 46 70 27Q82 17 90 35Q96 55 72 71Q48 87 12 83Z',
  lotus: 'M18 75Q26 48 50 19Q75 45 86 75Q49 95 18 75Z',
  garuda: 'M12 82L29 46L43 58L56 13L67 44L87 40L77 84Q46 93 12 82Z',
};

function pointsText(points: readonly LeafPoint[]): string {
  return points.map(([x,y]) => x * 100 + ',' + y * 100).join(' ');
}

function PrecisionLeafBoard({ shape, phase, step, track, editable, onTrace }: {
  shape: LeafCutShapeId; phase: LeafPhase; step: number; track: LeafTrack; editable: boolean;
  onTrace: (points: LeafPoint[]) => void;
}) {
  const drawing = useRef<{ pointer: number; points: LeafPoint[] } | null>(null);
  const liveTrace = useRef<SVGPolylineElement>(null);
  const [keyboardStep, setKeyboardStep] = useState(0);
  const [feedback, setFeedback] = useState('');

  function pointAt(event: ReactPointerEvent<HTMLDivElement>): LeafPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    return [clamp((event.clientX - rect.left) / (rect.width || 1)), clamp((event.clientY - rect.top) / (rect.height || 1))];
  }

  function draw(points: LeafPoint[]) {
    liveTrace.current?.setAttribute('points', pointsText(points));
  }

  function score(points: LeafPoint[]) {
    setKeyboardStep(0);
    if (!isLeafTraceValid(track, points)) {
      draw([]);
      setFeedback('รอยหลุดจากแนวทอง ลองลากจากจุดเริ่มไปผ่านจุดกลางใหม่');
      return;
    }
    setFeedback('รอยตรงแนวแล้ว กำลังส่งให้ทั้งสองเครื่อง');
    onTrace(points);
  }

  function start(event: ReactPointerEvent<HTMLDivElement>) {
    if (!editable || drawing.current || event.button !== 0) return;
    const point = pointAt(event);
    if (Math.hypot(point[0] - track[0][0], point[1] - track[0][1]) > .085) {
      setFeedback('เริ่มลากที่จุด 1 ก่อน');
      return;
    }
    event.preventDefault();
    drawing.current = { pointer: event.pointerId, points: [point] };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setFeedback('');
    draw([point]);
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const active = drawing.current;
    if (!active || active.pointer !== event.pointerId) return;
    const point = pointAt(event);
    const last = active.points.at(-1)!;
    if (Math.hypot(last[0] - point[0], last[1] - point[1]) < .012 || active.points.length >= 89) return;
    active.points.push(point);
    draw(active.points);
  }

  function finish(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const active = drawing.current;
    if (!active || active.pointer !== event.pointerId) return;
    drawing.current = null;
    if (cancelled) {
      draw([]);
      return;
    }
    score([...active.points, pointAt(event)]);
  }

  function keyboardTrace(index: number) {
    if (!editable) return;
    if (index !== keyboardStep) {
      setKeyboardStep(0);
      setFeedback('เลือกจุด 1 → 2 → 3 ตามทิศของเส้นทอง');
      return;
    }
    if (index === track.length - 1) score([...track]);
    else {
      setKeyboardStep(index + 1);
      setFeedback('ผ่านจุด ' + (index + 1) + ' แล้ว ไปยังจุดถัดไป');
    }
  }

  return (
    <>
      <div className="leaf-workboard" data-editable={editable} aria-label={phase === 'cut' ? 'กระดานเจียนใบตอง' : 'กระดานพับกลีบ'}
        onPointerDown={start} onPointerMove={move} onPointerUp={finish}
        onPointerCancel={(event) => finish(event, true)} onLostPointerCapture={(event) => finish(event, true)}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="leaf-workboard__leaf" d={SHAPE_PATH[shape]} />
          <path className="leaf-workboard__vein" d="M15 81 Q52 55 83 44 M31 71L29 60 M43 64L38 49 M58 55L51 39 M68 49L63 32" />
          <polyline className="leaf-workboard__guide" points={pointsText(track)} />
          <polyline className="leaf-workboard__trace" ref={liveTrace} points="" />
        </svg>
        {track.map(([x,y], index) => (
          <button type="button" key={index} className="leaf-workboard__target"
            style={{ left: x * 100 + '%', top: y * 100 + '%' }}
            disabled={!editable} data-passed={index < keyboardStep}
            aria-label={'จุด ' + (index + 1) + ' ของรอย' + (phase === 'cut' ? 'เจียน' : 'พับ') + 'ที่ ' + (step + 1)}
            onClick={(event) => { if (event.detail === 0) keyboardTrace(index); }}>
            {index + 1}
          </button>
        ))}
      </div>
      <p className="skill-feedback" role="status">{feedback || (editable ? 'ลากตามแนวทอง 1 → 2 → 3 หรือใช้ Tab และ Enter เลือกจุดตามลำดับ' : 'ดูความคืบหน้าของอีกคนจากกระดานนี้')}</p>
    </>
  );
}

export function LeafFoldRelayActivity({ relay, players, myRole, bothOnline, soundEnabled, onCommand }: LeafFoldRelayActivityProps) {
  const folder = relay.cutter === 'p1' ? 'p2' : 'p1';
  const phase = relay.passedLeafReady ? 'fold' : 'cut';
  const worker = phase === 'cut' ? relay.cutter : folder;
  const step = phase === 'cut' ? relay.cutStep : relay.foldStep;
  const track = leafTrack(relay.currentShape, phase, step);
  const editable = bothOnline && myRole === worker;

  return (
    <section className="romantic-activity leaf-relay-activity" aria-label="ช่วยกันพับใบตองแบบส่งต่อเรียลไทม์">
      <div className="activity-role-bar">
        <div className="role-pill role-pill--rower"><span>คนเจียนใบตอง:</span><strong>{players[relay.cutter].name}</strong></div>
        <div className="role-pill role-pill--picker"><span>คนพับกลีบ:</span><strong>{players[folder].name}</strong></div>
        <button type="button" className="btn btn--secondary btn--sm"
          disabled={!bothOnline || myRole !== relay.cutter || relay.cutStep > 0 || relay.completed}
          onClick={() => onCommand({ type: 'leaf-swap' })}>ส่งหน้าที่เจียนใบตอง</button>
      </div>
      <p className="activity-gentle-note">เจียนให้ครบสามแนวแล้วส่งใบตองให้อีกคนพับ ทำกลีบให้ครบทั้งสามทรง</p>
      {!bothOnline && <p className="status-badge" role="status">รอให้อีกคนออนไลน์ก่อนเริ่มทำใบตอง</p>}
      {!relay.completed && track && (
        <>
          <div className="leaf-workboard__heading">
            <strong>{phase === 'cut' ? 'เจียนใบตอง' : 'พับใบตองที่ส่งต่อมา'} · แนว {step + 1}/3</strong>
            <span>{SHAPE_NAME[relay.currentShape]} · {players[worker].name}</span>
          </div>
          <PrecisionLeafBoard key={relay.currentShape + phase + step + worker + editable}
            shape={relay.currentShape} phase={phase} step={step} track={track} editable={editable} onTrace={(points) => {
              playChime('beat', soundEnabled);
              onCommand({ type: 'leaf-trace', shape: relay.currentShape, phase, step, points });
            }} />
        </>
      )}
      <div className="finished-petals-tray" aria-label="กลีบใบตองที่ทำเสร็จแล้ว">
        {LEAF_SHAPES_ORDER.map((shape) => (
          <div key={shape} className={'petal-badge' + (relay.finishedPetals.includes(shape) ? ' is-done' : '')}>
            <HudIcon name={relay.finishedPetals.includes(shape) ? 'check' : 'lotus'} />
            <span>{SHAPE_NAME[shape]}</span>
          </div>
        ))}
      </div>
      {relay.completed && <p className="romantic-reward-banner" role="status">ทำครบทั้งสามทรงแล้ว ได้รับกลีบใบตองฝีมือสองเรา</p>}
    </section>
  );
}
