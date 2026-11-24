import { useEffect, useRef, useState } from 'react';
import {
  INCENSE_SYMBOLS,
  LEAF_FOLD_TARGETS,
  P1_INCENSE_ORDER,
  P2_INCENSE_ORDER,
  SALA_BELL_TARGETS,
  type CoopChallengeSpec,
} from '../domain/coopChallenges';
import type {
  CoopPairProgress,
  CoopSignalEvent,
  PlayMode,
  PlayerId,
  PlayerProfile,
} from '../domain/types';
import { playChime } from '../game/sound';
import { AvatarPreview } from './AvatarPreview';

interface CoopChallengePanelProps {
  spec: CoopChallengeSpec;
  progress: CoopPairProgress | undefined;
  players: Record<PlayerId, PlayerProfile>;
  playMode: PlayMode;
  myOnlineRole: PlayerId;
  partnerOnline: boolean;
  activeLocalPlayer: PlayerId;
  reducedMotion: boolean;
  soundEnabled: boolean;
  alreadyRewarded: boolean;
  rewardBadgeText: string;
  lastPartnerSignal: CoopSignalEvent | null;
  onSwitchLocalPlayer: (playerId: PlayerId) => void;
  onCompleteHalf: (playerId: PlayerId, halfScore: number) => void;
  onSendSignal?: (spotId: string, action: string, value?: number) => void;
}

type PadState = 'bud' | 'bloom' | 'hazard';

const INITIAL_PADS: PadState[] = ['bloom', 'bud', 'hazard', 'bud', 'bloom', 'hazard'];

export function CoopChallengePanel({
  spec,
  progress,
  players,
  playMode,
  myOnlineRole,
  partnerOnline,
  activeLocalPlayer,
  reducedMotion,
  soundEnabled,
  alreadyRewarded,
  rewardBadgeText,
  lastPartnerSignal,
  onSwitchLocalPlayer,
  onCompleteHalf,
  onSendSignal,
}: CoopChallengePanelProps) {
  const pair: CoopPairProgress = progress ?? {
    p1Done: false,
    p2Done: false,
    p1Score: 0,
    p2Score: 0,
    updatedAt: null,
  };

  const controllingPlayer: PlayerId =
    playMode === 'online' ? myOnlineRole : activeLocalPlayer;
  const partnerPlayer: PlayerId = controllingPlayer === 'p1' ? 'p2' : 'p1';
  const myDone = controllingPlayer === 'p1' ? pair.p1Done : pair.p2Done;
  const partnerDone = partnerPlayer === 'p1' ? pair.p1Done : pair.p2Done;

  // --- Mechanic 1: Lotus Pond state ---
  const [lotusRunning, setLotusRunning] = useState(false);
  const [pads, setPads] = useState<PadState[]>(INITIAL_PADS);
  const [lotusCaught, setLotusCaught] = useState(0);
  const [lotusSlips, setLotusSlips] = useState(0);
  const [lotusMsg, setLotusMsg] = useState(
    'กดเริ่มพายเรือเก็บดอกบัว แล้วแตะเฉพาะดอกที่บานสีชมพูเต็มที่ให้ครบ 3 ดอก!'
  );

  // --- Mechanic 2 & 5: Gauge / Wave timing state (Leaf Fold & Sala Bells) ---
  const [gaugeRunning, setGaugeRunning] = useState(false);
  const [gaugePos, setGaugePos] = useState(0.5);
  const [gaugeHits, setGaugeHits] = useState(0);
  const [gaugeSlips, setGaugeSlips] = useState(0);
  const [gaugeMsg, setGaugeMsg] = useState('กดเริ่มเพื่อจับจังหวะประสานมือ 3 รอบ!');
  const gaugePosRef = useRef(0.5);
  const gaugeDirRef = useRef(1);

  // --- Mechanic 3: Incense Memory state ---
  const [memPhase, setMemPhase] = useState<'idle' | 'reveal' | 'input'>('idle');
  const [memStep, setMemStep] = useState(0);
  const [memSlips, setMemSlips] = useState(0);
  const [memMsg, setMemMsg] = useState(
    'กด "ดูสูตรเครื่องหอม" เพื่อจำลำดับ 4 ชิ้นก่อนลงมือเรียง!'
  );

  // --- Mechanic 4: Sky Lantern Lift state ---
  const [lanternRunning, setLanternRunning] = useState(false);
  const [lanternHeat, setLanternHeat] = useState(35);
  const [lanternMsg, setLanternMsg] = useState(
    'กดเริ่มจุดเตาโคม แล้วปั๊มไฟประคองลมร้อนให้อยู่ในช่วง 68%–88% เพื่อล็อกสมดุล!'
  );

  // Reset per-station transient state when switching controllingPlayer or spot
  useEffect(() => {
    setLotusRunning(false);
    setLotusCaught(0);
    setLotusSlips(0);
    setGaugeRunning(false);
    setGaugeHits(0);
    setGaugeSlips(0);
    setMemPhase('idle');
    setMemStep(0);
    setMemSlips(0);
    setLanternRunning(false);
    setLanternHeat(35);
  }, [controllingPlayer, spec.spotId]);

  // Lotus rotation timer
  useEffect(() => {
    if (!lotusRunning || spec.mechanic !== 'lotus-pond') return undefined;
    const patterns: PadState[][] = [
      ['bloom', 'bud', 'hazard', 'bud', 'bloom', 'hazard'],
      ['hazard', 'bloom', 'bud', 'bloom', 'hazard', 'bud'],
      ['bud', 'hazard', 'bloom', 'hazard', 'bud', 'bloom'],
      ['bloom', 'hazard', 'bud', 'bud', 'hazard', 'bloom'],
    ];
    let idx = 0;
    setPads(patterns[0]);
    const interval = window.setInterval(
      () => {
        idx = (idx + 1) % patterns.length;
        setPads(patterns[idx]);
      },
      reducedMotion ? 1250 : 780
    );
    return () => window.clearInterval(interval);
  }, [lotusRunning, spec.mechanic, reducedMotion]);

  // Gauge animation for Leaf Fold & Sala Bells
  useEffect(() => {
    if (
      !gaugeRunning ||
      (spec.mechanic !== 'leaf-fold' && spec.mechanic !== 'sala-bells')
    ) {
      return undefined;
    }
    const targetList =
      spec.mechanic === 'leaf-fold'
        ? LEAF_FOLD_TARGETS[controllingPlayer]
        : SALA_BELL_TARGETS[controllingPlayer];
    const activeTarget = targetList[Math.min(gaugeHits, 2)];

    if (reducedMotion) {
      const steps = [activeTarget, 0.18, 0.82, activeTarget, 0.5];
      let idx = 0;
      gaugePosRef.current = steps[0];
      setGaugePos(steps[0]);
      const id = window.setInterval(() => {
        idx = (idx + 1) % steps.length;
        gaugePosRef.current = steps[idx];
        setGaugePos(steps[idx]);
      }, 540);
      return () => window.clearInterval(id);
    }

    let raf = 0;
    let last = performance.now();
    const speed = 1.15 + gaugeHits * 0.22;
    const tick = (now: number) => {
      const dt = Math.min(40, now - last) / 1000;
      last = now;
      let next = gaugePosRef.current + gaugeDirRef.current * dt * speed;
      if (next >= 0.93) {
        next = 0.93;
        gaugeDirRef.current = -1;
      } else if (next <= 0.07) {
        next = 0.07;
        gaugeDirRef.current = 1;
      }
      gaugePosRef.current = next;
      setGaugePos(next);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [gaugeRunning, spec.mechanic, controllingPlayer, gaugeHits, reducedMotion]);

  // Memory reveal countdown
  useEffect(() => {
    if (memPhase !== 'reveal') return undefined;
    const timer = window.setTimeout(
      () => {
        setMemPhase('input');
        setMemMsg('จำได้ไหมเอ่ย? กดเรียงเครื่องหอมตามลำดับที่เห็นทั้ง 4 ชิ้นเลย!');
      },
      reducedMotion ? 2600 : 1900
    );
    return () => window.clearTimeout(timer);
  }, [memPhase, reducedMotion]);

  // Sky lantern cooling breeze
  useEffect(() => {
    if (!lanternRunning || spec.mechanic !== 'lantern-lift') return undefined;
    const windLevel = spec.spotId.endsWith('3')
      ? 5.5
      : spec.spotId.endsWith('2')
        ? 4.4
        : 3.5;
    const timer = window.setInterval(() => {
      setLanternHeat((prev) => Math.max(12, Math.round(prev - windLevel)));
    }, 220);
    return () => window.clearInterval(timer);
  }, [lanternRunning, spec.mechanic, spec.spotId]);

  const finishMyHalf = (score: number) => {
    playChime('success', soundEnabled);
    onSendSignal?.(spec.spotId, 'half_complete', score);
    onCompleteHalf(controllingPlayer, score);
  };

  // --- Handlers ---
  const handlePadTap = (padIdx: number) => {
    if (!lotusRunning || myDone) return;
    const kind = pads[padIdx];
    if (kind === 'bloom') {
      playChime('pickup', soundEnabled);
      const nextCaught = lotusCaught + 1;
      setLotusCaught(nextCaught);
      // Flip tapped pad to bud immediately so player can't spam same pad
      setPads((prev) => prev.map((p, i) => (i === padIdx ? 'bud' : p)));
      onSendSignal?.(spec.spotId, 'lotus_pick', nextCaught);
      if (nextCaught >= 3) {
        setLotusRunning(false);
        setLotusMsg('เก็บดอกบัวบานครบ 3 ดอกแล้ว! ยอดเยี่ยมมาก!');
        finishMyHalf(50 - lotusSlips * 6);
      } else {
        setLotusMsg(`เก็บดอกบัวชมพูได้แล้ว (${nextCaught}/3 ดอก)!`);
      }
    } else {
      playChime('error', soundEnabled);
      const nextSlips = lotusSlips + 1;
      setLotusSlips(nextSlips);
      if (nextSlips >= 3) {
        setLotusRunning(false);
        setLotusCaught(0);
        setLotusSlips(0);
        setLotusMsg(
          kind === 'hazard'
            ? 'แตะโดนกบน้อยตกใจน้ำกระจายครบ 3 ครั้ง! กดเริ่มเก็บใหม่นะ'
            : 'เด็ดโดนบัวตูมครบ 3 ครั้ง! กดเริ่มเก็บใหม่อีกรอบนะ'
        );
      } else {
        setLotusMsg(
          kind === 'hazard'
            ? `อุ๊ย! แตะโดนกบน้อย 🐸 (พลาด ${nextSlips}/3)`
            : `ดอกนี้ยังตูมอยู่ รอให้บานสีชมพูก่อนนะ (พลาด ${nextSlips}/3)`
        );
      }
    }
  };

  const handleGaugeStrike = () => {
    if (!gaugeRunning || myDone) return;
    const targetList =
      spec.mechanic === 'leaf-fold'
        ? LEAF_FOLD_TARGETS[controllingPlayer]
        : SALA_BELL_TARGETS[controllingPlayer];
    const target = targetList[Math.min(gaugeHits, 2)];
    const dist = Math.abs(gaugePosRef.current - target);

    if (dist <= 0.17) {
      playChime(spec.mechanic === 'sala-bells' ? 'lantern' : 'pickup', soundEnabled);
      const nextHits = gaugeHits + 1;
      setGaugeHits(nextHits);
      onSendSignal?.(spec.spotId, 'strike_ok', nextHits);
      if (nextHits >= 3) {
        setGaugeRunning(false);
        setGaugeMsg('ประณีตไร้ที่ติครบทั้ง 3 จังหวะ!');
        finishMyHalf(50 - gaugeSlips * 6);
      } else {
        setGaugeMsg(`เข้าเป้าสวยงาม! (${nextHits}/3) เตรียมเล็งจุดต่อไป!`);
      }
    } else {
      playChime('error', soundEnabled);
      const nextSlips = gaugeSlips + 1;
      setGaugeSlips(nextSlips);
      if (nextSlips >= 3) {
        setGaugeRunning(false);
        setGaugeHits(0);
        setGaugeSlips(0);
        setGaugeMsg('พลาดจังหวะครบ 3 ครั้ง กดเริ่มประสานมือใหม่ได้เลย!');
      } else {
        setGaugeMsg(`เฉียดเป้าไปนิด! เล็งแถบสีทองใหม่นะ (พลาด ${nextSlips}/3)`);
      }
    }
  };

  const targetMemSequence =
    controllingPlayer === 'p1' ? P1_INCENSE_ORDER : P2_INCENSE_ORDER;

  const handleMemPick = (symbolId: string) => {
    if (memPhase !== 'input' || myDone) return;
    const expected = targetMemSequence[memStep];
    if (symbolId === expected) {
      playChime('pickup', soundEnabled);
      const nextStep = memStep + 1;
      setMemStep(nextStep);
      onSendSignal?.(spec.spotId, 'mem_step', nextStep);
      if (nextStep >= targetMemSequence.length) {
        setMemPhase('idle');
        setMemMsg('เรียงเครื่องหอมถูกต้องครบทั้ง 4 ทิศ!');
        finishMyHalf(50 - memSlips * 8);
      } else {
        setMemMsg(`ถูกต้อง! เลือกชิ้นที่ ${nextStep + 1}/4 ต่อเลย`);
      }
    } else {
      playChime('error', soundEnabled);
      const nextSlips = memSlips + 1;
      setMemSlips(nextSlips);
      if (nextSlips >= 2) {
        setMemPhase('idle');
        setMemStep(0);
        setMemSlips(0);
        setMemMsg('จำสลับลำดับครบ 2 ครั้ง กด "ดูสูตรเครื่องหอม" เพื่อจำใหม่อีกครั้งนะ');
      } else {
        setMemMsg(`ผิดลำดับ! ลองนึกชิ้นที่ ${memStep + 1} ใหม่นะ (พลาด ${nextSlips}/2)`);
      }
    }
  };

  const handlePumpFlame = () => {
    if (!lanternRunning || myDone) return;
    const next = lanternHeat + 17;
    if (next >= 96) {
      playChime('error', soundEnabled);
      setLanternHeat(28);
      setLanternMsg('🔥 ไฟแรงเกินไป โคมเกือบไหม้! ระบบลดไฟลงแล้ว ค่อยๆ ประคองใหม่นะ');
      return;
    }
    playChime('beat', soundEnabled);
    setLanternHeat(next);
    onSendSignal?.(spec.spotId, 'flame_pump', next);
    if (next >= 68 && next <= 88) {
      setLanternMsg('✨ ลมร้อนเข้าโซนทอง (68%–88%) แล้ว! รีบกด "ล็อกสมดุลปล่อยโคม!" เลย!');
    } else {
      setLanternMsg(`กำลังอุ่นโคม (${next}%) — ดันให้ถึงช่วง 68%–88%`);
    }
  };

  const handleLockLantern = () => {
    if (!lanternRunning || myDone) return;
    if (lanternHeat >= 68 && lanternHeat <= 88) {
      setLanternRunning(false);
      setLanternMsg('🏮 ล็อกสมดุลลมร้อนฝั่งของคุณสำเร็จอย่างงดงาม!');
      finishMyHalf(50);
    } else {
      playChime('error', soundEnabled);
      setLanternMsg(
        lanternHeat < 68
          ? `ลมร้อนยังไม่พอ (${lanternHeat}%) ต้องให้อยู่ในช่วง 68%–88% ก่อนกดล็อก!`
          : `ลมร้อนสูงเกินโซน (${lanternHeat}%) รอให้ลดลงมาอยู่ใน 68%–88% นะ!`
      );
    }
  };

  const targetGaugeCenter =
    spec.mechanic === 'leaf-fold'
      ? LEAF_FOLD_TARGETS[controllingPlayer][Math.min(gaugeHits, 2)]
      : SALA_BELL_TARGETS[controllingPlayer][Math.min(gaugeHits, 2)];

  const showPartnerSignalToast =
    lastPartnerSignal &&
    lastPartnerSignal.spotId === spec.spotId &&
    lastPartnerSignal.playerId !== controllingPlayer;

  return (
    <section className="coop-challenge-box" aria-label={spec.title}>
      <div className="coop-challenge-box__header">
        <div>
          <span className="coop-difficulty-pill">{spec.difficultyLabel}</span>
          <h3 className="coop-challenge-box__title">{spec.title}</h3>
        </div>
        {playMode === 'local' && !alreadyRewarded && (
          <div className="coop-local-switcher" role="group" aria-label="สลับผู้เล่นทำภารกิจ">
            {(['p1', 'p2'] as const).map((pid) => {
              const done = pid === 'p1' ? pair.p1Done : pair.p2Done;
              return (
                <button
                  key={pid}
                  type="button"
                  className={`btn btn--sm ${
                    controllingPlayer === pid ? 'btn--primary' : 'btn--secondary'
                  }`}
                  onClick={() => onSwitchLocalPlayer(pid)}
                >
                  {done ? '✓ ' : ''}
                  {players[pid].name} ({pid.toUpperCase()})
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="coop-challenge-box__desc">{spec.instruction}</p>

      <div className="coop-status-cards">
        {(['p1', 'p2'] as const).map((pid) => {
          const done = pid === 'p1' ? pair.p1Done : pair.p2Done;
          const isMe = controllingPlayer === pid;
          return (
            <div
              key={pid}
              className={`coop-partner-card ${done ? 'is-done' : ''} ${
                isMe ? 'is-active-station' : ''
              }`}
            >
              <AvatarPreview profile={players[pid]} size={40} decorative />
              <div className="coop-partner-card__meta">
                <strong>
                  {players[pid].name}{' '}
                  {playMode === 'online' && isMe ? '(คุณ)' : ''}
                  {playMode === 'online' && !isMe ? '(แฟนของคุณ)' : ''}
                </strong>
                <span>
                  {pid === 'p1' ? spec.p1TaskLabel : spec.p2TaskLabel}
                </span>
                <span className="coop-partner-card__badge">
                  {done || alreadyRewarded
                    ? '✓ สำเร็จส่วนนี้แล้ว!'
                    : playMode === 'online' && !isMe && !partnerOnline
                      ? '○ รอแฟนออนไลน์เข้าห้องมาช่วยเล่น...'
                      : isMe
                        ? '● กำลังลงมือเล่นฝั่งนี้'
                        : '○ รออีกฝ่ายทำภารกิจ...'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {showPartnerSignalToast && (
        <p className="coop-live-signal" role="status" aria-live="polite">
          💞 สัญญาณสดจาก {players[partnerPlayer].name}: กำลังช่วยทำภารกิจจุดนี้ไปพร้อมกับคุณ!
        </p>
      )}

      {alreadyRewarded ? (
        <div className="coop-complete-banner" role="status">
          <p className="status-badge status-badge--ok">✓ {rewardBadgeText}</p>
        </div>
      ) : myDone ? (
        <div className="coop-waiting-partner" role="status" aria-live="polite">
          <p>
            🎉 <strong>ยอดเยี่ยม! คุณ ({players[controllingPlayer].name}) ผ่านส่วนของคุณแล้ว!</strong>
          </p>
          {!partnerDone && (
            <p>
              {playMode === 'online'
                ? `กำลังรอให้ ${players[partnerPlayer].name} เล่นส่วนของตัวเองในห้องออนไลน์ให้ผ่าน รางวัลจะปลดล็อกให้ทั้งคู่ทันที!`
                : `กดปุ่มสลับเป็น "${players[partnerPlayer].name} (${partnerPlayer.toUpperCase()})" ด้านบน เพื่อให้คู่รักอีกคนเล่นส่วนที่เหลือให้ครบ!`}
            </p>
          )}
        </div>
      ) : (
        <div className="coop-arena">
          {/* MECHANIC 1: LOTUS POND */}
          {spec.mechanic === 'lotus-pond' && (
            <>
              <div className="coop-stats-row">
                <span>ดอกบัวที่เก็บได้: {lotusCaught}/3</span>
                <span>พลาด: {lotusSlips}/3</span>
              </div>
              <div className="lotus-pond-grid" role="group" aria-label="สระดอกบัว 6 กอ">
                {pads.map((padState, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={!lotusRunning}
                    className={`btn lotus-pad-btn lotus-pad-btn--${padState}`}
                    onClick={() => handlePadTap(idx)}
                  >
                    <span className="lotus-pad-btn__emoji" aria-hidden="true">
                      {padState === 'bloom'
                        ? '🪷'
                        : padState === 'hazard'
                          ? '🐸'
                          : '🌱'}
                    </span>
                    <span className="lotus-pad-btn__label">
                      {padState === 'bloom'
                        ? 'บัวบาน! เก็บเลย'
                        : padState === 'hazard'
                          ? 'กบน้อย ห้ามแตะ'
                          : 'บัวตูม รอก่อน'}
                    </span>
                  </button>
                ))}
              </div>
              <p className="minigame-feedback" role="status" aria-live="polite">
                {lotusMsg}
              </p>
              {!lotusRunning && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setLotusCaught(0);
                    setLotusSlips(0);
                    setLotusMsg('แตะกอบัวที่ขึ้น "🪷 บัวบาน!" ให้ทันก่อนหุบ!');
                    setLotusRunning(true);
                  }}
                >
                  เริ่มพายเรือเก็บดอกบัว ({players[controllingPlayer].name})
                </button>
              )}
            </>
          )}

          {/* MECHANIC 2 & 5: PRECISION SHIFTING GAUGE (LEAF FOLD & SALA BELLS) */}
          {(spec.mechanic === 'leaf-fold' || spec.mechanic === 'sala-bells') && (
            <>
              <div className="coop-stats-row">
                <span>
                  {spec.mechanic === 'sala-bells' ? 'เสียงระฆังกังวาน' : 'พับกลีบสำเร็จ'}:{' '}
                  {gaugeHits}/3
                </span>
                <span>พลาด: {gaugeSlips}/3</span>
              </div>
              <div className="rhythm-track" aria-hidden="true">
                <div
                  className="rhythm-sweetspot"
                  style={{
                    left: `${Math.round((targetGaugeCenter - 0.16) * 100)}%`,
                    width: '32%',
                  }}
                />
                <div
                  className="rhythm-cursor"
                  style={{ left: `${Math.round(gaugePos * 100)}%` }}
                />
              </div>
              <p className="minigame-feedback" role="status" aria-live="polite">
                {gaugeMsg}
              </p>
              <div className="minigame-actions">
                {gaugeRunning ? (
                  <button
                    type="button"
                    className="btn btn--primary btn--lg"
                    onClick={handleGaugeStrike}
                  >
                    {spec.mechanic === 'sala-bells'
                      ? `🔔 เคาะระฆังแสงจันทร์! (${gaugeHits + 1}/3)`
                      : `🌿 เจียน/พับกลีบตรงจุดทอง! (${gaugeHits + 1}/3)`}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => {
                      setGaugeHits(0);
                      setGaugeSlips(0);
                      setGaugeMsg('เล็งแถบสีทองแล้วกดให้ตรงจังหวะทั้ง 3 รอบ!');
                      setGaugeRunning(true);
                    }}
                  >
                    {spec.mechanic === 'sala-bells'
                      ? `เริ่มบรรเลงระฆัง (${players[controllingPlayer].name})`
                      : `เริ่มเจียนและพับใบตอง (${players[controllingPlayer].name})`}
                  </button>
                )}
              </div>
            </>
          )}

          {/* MECHANIC 3: SACRED INCENSE MEMORY */}
          {spec.mechanic === 'incense-memory' && (
            <>
              <div className="coop-stats-row">
                <span>เรียงถูกแล้ว: {memStep}/4</span>
                <span>พลาด: {memSlips}/2</span>
              </div>

              <div className="incense-sequence-strip" aria-live="polite">
                {targetMemSequence.map((symId, idx) => {
                  const sym = INCENSE_SYMBOLS.find((s) => s.id === symId)!;
                  const visible = memPhase === 'reveal' || idx < memStep;
                  return (
                    <div
                      key={`${symId}-${idx}`}
                      className={`incense-slot ${visible ? 'is-revealed' : ''}`}
                    >
                      {visible ? `${sym.emoji} ${sym.label}` : `ขั้นที่ ${idx + 1} (?)`}
                    </div>
                  );
                })}
              </div>

              <div className="recipe-grid">
                {INCENSE_SYMBOLS.map((sym) => (
                  <button
                    key={sym.id}
                    type="button"
                    disabled={memPhase !== 'input'}
                    className="btn"
                    onClick={() => handleMemPick(sym.id)}
                  >
                    {sym.emoji} {sym.label}
                  </button>
                ))}
              </div>

              <p className="minigame-feedback" role="status" aria-live="polite">
                {memMsg}
              </p>

              {memPhase === 'idle' && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setMemStep(0);
                    setMemSlips(0);
                    setMemMsg('ตั้งใจจำลำดับเครื่องหอมทั้ง 4 ชิ้นนี้ไว้ให้ดี...');
                    setMemPhase('reveal');
                  }}
                >
                  ดูสูตรเครื่องหอม ({players[controllingPlayer].name})
                </button>
              )}
            </>
          )}

          {/* MECHANIC 4: DUAL-BURNER SKY LANTERN LIFT */}
          {spec.mechanic === 'lantern-lift' && (
            <>
              <div className="coop-stats-row">
                <span>ความร้อนในโคม: {lanternHeat}%</span>
                <span>โซนลอยตัว: 68%–88%</span>
              </div>
              <div className="lantern-gauge-track" aria-hidden="true">
                <div className="lantern-gauge-target" />
                <div
                  className={`lantern-gauge-fill ${
                    lanternHeat >= 68 && lanternHeat <= 88
                      ? 'is-sweet'
                      : lanternHeat >= 90
                        ? 'is-hot'
                        : ''
                  }`}
                  style={{ width: `${Math.min(100, lanternHeat)}%` }}
                />
              </div>
              <p className="minigame-feedback" role="status" aria-live="polite">
                {lanternMsg}
              </p>
              <div className="minigame-actions">
                {lanternRunning ? (
                  <>
                    <button
                      type="button"
                      className="btn btn--secondary btn--lg"
                      onClick={handlePumpFlame}
                    >
                      🔥 เติมไฟต้านลม (+17%)
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--lg"
                      onClick={handleLockLantern}
                    >
                      🏮 ล็อกสมดุลปล่อยโคม!
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => {
                      setLanternHeat(36);
                      setLanternMsg(
                        'กด "เติมไฟต้านลม" รัวพอประมาณให้เกจเข้าสีทอง 68%–88% แล้วกดล็อกทันที!'
                      );
                      setLanternRunning(true);
                    }}
                  >
                    เริ่มจุดไฟประคองโคม ({players[controllingPlayer].name})
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
