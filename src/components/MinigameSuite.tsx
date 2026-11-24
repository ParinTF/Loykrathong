import { useEffect, useId, useRef, useState } from 'react';
import {
  ASSEMBLY_MAX_SLIPS,
  ASSEMBLY_STEPS,
  RECIPE_DURATION_SECONDS,
  RECIPE_MAX_MISTAKES,
  RECIPE_TARGET_IDS,
  RECIPE_TRAY_ITEMS,
  RHYTHM_PASS_THRESHOLD,
  RHYTHM_TOTAL_BEATS,
  areAllMinigamesPassed,
  computeKrathongQuality,
  evaluateAssemblyResult,
  evaluateRecipeResult,
  evaluateRhythmResult,
  isMinigameUnlocked,
  judgeRhythmTap,
  judgeStackDrop,
  judgeStreamScoop,
} from '../domain/minigames';
import type { MinigameId, MinigamesProgress } from '../domain/types';
import { playChime } from '../game/sound';

interface MinigameSuiteProps {
  progress: MinigamesProgress;
  reducedMotion: boolean;
  soundEnabled?: boolean;
  onCompleteMinigame: (gameId: MinigameId, passed: boolean, score: number) => void;
  onResetMinigame: (gameId: MinigameId) => void;
}

const STREAM_ZONES = [
  { label: 'ซ้ายสุด', norm: 0.14 },
  { label: 'ใกล้กลาง', norm: 0.32 },
  { label: 'วงกระชอนทอง', norm: 0.5 },
  { label: 'ใกล้กลางขวา', norm: 0.68 },
  { label: 'ขวาสุด', norm: 0.86 },
];

export function MinigameSuite({
  progress,
  reducedMotion,
  soundEnabled = false,
  onCompleteMinigame,
  onResetMinigame,
}: MinigameSuiteProps) {
  const streamCueId = useId();
  const stackCueId = useId();
  const rhythmZoneHintId = useId();

  const initialActive: MinigameId =
    progress.recipe.status !== 'passed'
      ? 'recipe'
      : progress.assembly.status !== 'passed'
        ? 'assembly'
        : 'rhythm';
  const [activeGame, setActiveGame] = useState<MinigameId>(initialActive);

  // =========================================================================
  // GAME 1: สายน้ำช้อนยอดวัสดุทอง (Canal Stream Catcher — Timing & Reflex!)
  // =========================================================================
  const [recipeRunning, setRecipeRunning] = useState(false);
  const [recipeSelected, setRecipeSelected] = useState<string[]>([]);
  const [recipeDismissed, setRecipeDismissed] = useState<string[]>([]);
  const [recipeMistakes, setRecipeMistakes] = useState(0);
  const [recipeSeconds, setRecipeSeconds] = useState(RECIPE_DURATION_SECONDS);
  const [recipeBonus, setRecipeBonus] = useState(0);
  const [streamItemIdx, setStreamItemIdx] = useState(0);
  const [streamPos, setStreamPos] = useState(0.5);
  const [recipeFeedback, setRecipeFeedback] = useState(
    'กดเริ่ม แล้วกด "ช้อนรับเข้าถาดทอง!" เมื่อของมงคลลอยเข้าวงแสงสีทองตรงกลาง (ปัดขยะ/ใบไม้แห้งทิ้ง!)'
  );

  const streamPosRef = useRef(0.5);
  const streamDirRef = useRef(1);
  const scoopBtnRef = useRef<HTMLButtonElement>(null);

  const remainingStreamItems = RECIPE_TRAY_ITEMS.filter(
    (item) =>
      !recipeSelected.includes(item.id) && !recipeDismissed.includes(item.id)
  );
  const currentStreamItem =
    remainingStreamItems.length > 0
      ? remainingStreamItems[streamItemIdx % remainingStreamItems.length]
      : RECIPE_TRAY_ITEMS[0];

  useEffect(() => {
    if (!recipeRunning) return undefined;
    scoopBtnRef.current?.focus();

    if (reducedMotion) {
      const steps = [0.5, 0.68, 0.84, 0.5, 0.32, 0.18];
      let idx = 0;
      streamPosRef.current = steps[0];
      setStreamPos(steps[0]);
      const timer = window.setInterval(() => {
        idx = (idx + 1) % steps.length;
        streamPosRef.current = steps[idx];
        setStreamPos(steps[idx]);
      }, 520);
      return () => window.clearInterval(timer);
    }

    let rafId = 0;
    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(40, now - lastTs) / 1000;
      lastTs = now;
      let next = streamPosRef.current + streamDirRef.current * dt * 1.08;
      if (next >= 0.94) {
        next = 0.94;
        streamDirRef.current = -1;
        setStreamItemIdx((c) => c + 1);
      } else if (next <= 0.06) {
        next = 0.06;
        streamDirRef.current = 1;
        setStreamItemIdx((c) => c + 1);
      }
      streamPosRef.current = next;
      setStreamPos(next);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [recipeRunning, reducedMotion]);

  useEffect(() => {
    if (!recipeRunning) return undefined;
    const id = window.setInterval(() => {
      setRecipeSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          setRecipeRunning(false);
          const res = evaluateRecipeResult({
            selectedIds: recipeSelected,
            mistakes: recipeMistakes,
            remainingSeconds: 0,
            timingBonus: recipeBonus,
          });
          setRecipeFeedback('หมดเวลาแล้ว! กด "เล่นด่าน 1 ซ้ำ" เพื่อช้อนวัสดุอีกครั้ง');
          onCompleteMinigame('recipe', res.passed, res.score);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [recipeRunning, recipeSelected, recipeMistakes, recipeBonus, onCompleteMinigame]);

  const startRecipe = () => {
    onResetMinigame('recipe');
    setRecipeSelected([]);
    setRecipeDismissed([]);
    setRecipeMistakes(0);
    setRecipeBonus(0);
    setStreamItemIdx(0);
    streamPosRef.current = reducedMotion ? 0.5 : 0.24;
    streamDirRef.current = 1;
    setStreamPos(reducedMotion ? 0.5 : 0.24);
    setRecipeSeconds(RECIPE_DURATION_SECONDS);
    setRecipeFeedback('เล็งวงทองตรงกลาง! ของมงคลกด "ช้อนรับ" — ของเสียกด "ปัดทิ้ง"');
    setRecipeRunning(true);
  };

  const handleStreamScoop = (explicitItemId?: string) => {
    if (!recipeRunning) return;
    const item = explicitItemId
      ? RECIPE_TRAY_ITEMS.find((i) => i.id === explicitItemId)
      : currentStreamItem;
    if (!item || recipeSelected.includes(item.id)) return;

    // Direct tray tap uses current stream position if same item, or sweetspot if reducedMotion/keyboard quick-pick
    const posToJudge =
      explicitItemId && explicitItemId !== currentStreamItem.id
        ? item.isTarget
          ? streamPosRef.current
          : 0.5
        : streamPosRef.current;

    const judged = judgeStreamScoop(posToJudge, item);
    if (judged.caught) {
      playChime('pickup', soundEnabled);
      const nextSelected = [...recipeSelected, item.id];
      const addBonus = judged.judgment === 'perfect' ? 4 : 2;
      const nextBonus = recipeBonus + addBonus;
      setRecipeSelected(nextSelected);
      setRecipeBonus(nextBonus);
      setStreamItemIdx((c) => c + 1);

      if (nextSelected.length === RECIPE_TARGET_IDS.length) {
        setRecipeRunning(false);
        const res = evaluateRecipeResult({
          selectedIds: nextSelected,
          mistakes: recipeMistakes,
          remainingSeconds: recipeSeconds,
          timingBonus: nextBonus,
        });
        setRecipeFeedback(
          `เยี่ยมมาก! ช้อนยอดวัสดุครบทั้ง 4 ชิ้น ได้ ${res.score} คะแนน`
        );
        onCompleteMinigame('recipe', res.passed, res.score);
      } else {
        const tag = judged.judgment === 'perfect' ? 'ตรงกลางเป๊ะ!' : 'ช้อนสำเร็จ!';
        setRecipeFeedback(
          `${tag} ได้รับ "${item.label}" (${nextSelected.length}/${RECIPE_TARGET_IDS.length})`
        );
      }
    } else {
      playChime('error', soundEnabled);
      const nextMistakes = recipeMistakes + 1;
      setRecipeMistakes(nextMistakes);
      if (!item.isTarget) {
        setStreamItemIdx((c) => c + 1);
      }
      if (nextMistakes >= RECIPE_MAX_MISTAKES) {
        setRecipeRunning(false);
        const res = evaluateRecipeResult({
          selectedIds: recipeSelected,
          mistakes: nextMistakes,
          remainingSeconds: recipeSeconds,
          timingBonus: recipeBonus,
        });
        setRecipeFeedback(
          `เลือกวัสดุผิดครบ ${RECIPE_MAX_MISTAKES} ครั้ง กด "เล่นด่าน 1 ซ้ำ" ได้เลย`
        );
        onCompleteMinigame('recipe', res.passed, res.score);
      } else if (!item.isTarget) {
        setRecipeFeedback(
          `อุ๊ย! "${item.label}" เป็นสิ่งเจือปน ต้องกดปัดออก (พลาด ${nextMistakes}/${RECIPE_MAX_MISTAKES})`
        );
      } else {
        setRecipeFeedback(
          `ช้อนเร็ว/ช้าไปนิด! รอให้ "${item.label}" ลอยเข้าวงสีทองตรงกลางก่อนนะ (พลาด ${nextMistakes}/${RECIPE_MAX_MISTAKES})`
        );
      }
    }
  };

  const handleSwatDecoy = () => {
    if (!recipeRunning || !currentStreamItem) return;
    if (!currentStreamItem.isTarget) {
      playChime('beat', soundEnabled);
      setRecipeDismissed((prev) => [...prev, currentStreamItem.id]);
      setRecipeBonus((b) => b + 3);
      setStreamItemIdx((c) => c + 1);
      setRecipeFeedback(
        `ปัด "${currentStreamItem.label}" พ้นสายน้ำแล้ว! (+โบนัสรักษ์คลอง)`
      );
    } else {
      // Gently skip to next floating item without penalty so player can cycle
      setStreamItemIdx((c) => c + 1);
      setRecipeFeedback(`ปล่อย "${currentStreamItem.label}" ไหลวนกลับมาใหม่อีกรอบ`);
    }
  };

  // =========================================================================
  // GAME 2: วางชั้นกระทงตรงแกนทอง (Precision Pendulum Stacker — Like Game 3!)
  // =========================================================================
  const [stackRunning, setStackRunning] = useState(false);
  const [placedCount, setPlacedCount] = useState(0);
  const [placedOffsets, setPlacedOffsets] = useState<number[]>([]);
  const [assemblySlips, setAssemblySlips] = useState(0);
  const [assemblyPoints, setAssemblyPoints] = useState(0);
  const [stackPos, setStackPos] = useState(0.5);
  const [assemblyFeedback, setAssemblyFeedback] = useState(
    'กดเริ่มทำชั้นกระทง แล้วจังหวะที่ชิ้นส่วนเลื่อนมาตรงเส้นแกนทองตรงกลางให้กด "วางชั้นกระทง!"'
  );

  const stackPosRef = useRef(0.5);
  const stackDirRef = useRef(1);
  const stackDropBtnRef = useRef<HTMLButtonElement>(null);

  const currentStep =
    ASSEMBLY_STEPS[Math.min(placedCount, ASSEMBLY_STEPS.length - 1)];

  useEffect(() => {
    if (!stackRunning) return undefined;
    stackDropBtnRef.current?.focus();

    if (reducedMotion) {
      const steps = [0.5, 0.66, 0.8, 0.5, 0.34, 0.2];
      let idx = 0;
      stackPosRef.current = steps[0];
      setStackPos(steps[0]);
      const timer = window.setInterval(() => {
        idx = (idx + 1) % steps.length;
        stackPosRef.current = steps[idx];
        setStackPos(steps[idx]);
      }, 500);
      return () => window.clearInterval(timer);
    }

    let rafId = 0;
    let lastTs = performance.now();
    const speedMult = currentStep?.speedMultiplier ?? 1;
    const tick = (now: number) => {
      const dt = Math.min(40, now - lastTs) / 1000;
      lastTs = now;
      let next =
        stackPosRef.current + stackDirRef.current * dt * 1.12 * speedMult;
      if (next >= 0.93) {
        next = 0.93;
        stackDirRef.current = -1;
      } else if (next <= 0.07) {
        next = 0.07;
        stackDirRef.current = 1;
      }
      stackPosRef.current = next;
      setStackPos(next);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [stackRunning, reducedMotion, placedCount, currentStep?.speedMultiplier]);

  const startAssembly = () => {
    onResetMinigame('assembly');
    setPlacedCount(0);
    setPlacedOffsets([]);
    setAssemblySlips(0);
    setAssemblyPoints(0);
    stackPosRef.current = reducedMotion ? 0.5 : 0.22;
    stackDirRef.current = 1;
    setStackPos(reducedMotion ? 0.5 : 0.22);
    setAssemblyFeedback(
      'เล็งให้ตรงแกนทองตรงกลาง แล้วกดวางทีละชั้น (ครบ 4 ชั้น)!'
    );
    setStackRunning(true);
  };

  const handleStackDrop = () => {
    if (
      progress.assembly.status === 'passed' ||
      progress.assembly.status === 'failed'
    ) {
      return;
    }
    const pos = stackRunning ? stackPosRef.current : 0.5;
    const resDrop = judgeStackDrop(pos);

    if (resDrop.aligned) {
      playChime('pickup', soundEnabled);
      const nextCount = placedCount + 1;
      const nextPts = assemblyPoints + resDrop.points;
      setPlacedCount(nextCount);
      setPlacedOffsets((prev) => [...prev, pos]);
      setAssemblyPoints(nextPts);

      if (nextCount >= ASSEMBLY_STEPS.length) {
        setStackRunning(false);
        const evalRes = evaluateAssemblyResult({
          placedCount: nextCount,
          slips: assemblySlips,
          alignmentPoints: nextPts,
        });
        setAssemblyFeedback(
          `ประกอบกระทงครบ 4 ชั้นสมดุลสวยงาม! ได้ ${evalRes.score} คะแนน`
        );
        onCompleteMinigame('assembly', evalRes.passed, evalRes.score);
      } else {
        const nextLayer = ASSEMBLY_STEPS[nextCount];
        const word =
          resDrop.judgment === 'perfect' ? 'ตรงแกนทองเป๊ะ!' : 'วางเข้าแกนดีมาก!';
        setAssemblyFeedback(`${word} เตรียมวาง "${nextLayer.label}" ต่อเลย`);
      }
    } else {
      playChime('error', soundEnabled);
      const nextSlips = assemblySlips + 1;
      setAssemblySlips(nextSlips);
      if (nextSlips >= ASSEMBLY_MAX_SLIPS) {
        setStackRunning(false);
        const evalRes = evaluateAssemblyResult({
          placedCount,
          slips: nextSlips,
          alignmentPoints: assemblyPoints,
        });
        setAssemblyFeedback(
          'วางเบี้ยวหลุดแกนครบ 3 ครั้ง กด "ประกอบใหม่" เพื่อตั้งสมาธิอีกรอบนะ'
        );
        onCompleteMinigame('assembly', evalRes.passed, evalRes.score);
      } else {
        setAssemblyFeedback(
          `เบี้ยวออกนอกแกนทอง! รอจังหวะเข้ากลางแล้ววาง "${currentStep.label}" ใหม่ (พลาด ${nextSlips}/${ASSEMBLY_MAX_SLIPS})`
        );
      }
    }
  };

  // =========================================================================
  // GAME 3: ประดับแสงเทียนตามจังหวะ (Beloved Candlelight Rhythm!)
  // =========================================================================
  const [rhythmRunning, setRhythmRunning] = useState(false);
  const [beatPos, setBeatPos] = useState(0.5);
  const [beatIndex, setBeatIndex] = useState(0);
  const [rhythmPoints, setRhythmPoints] = useState(0);
  const [rhythmFeedback, setRhythmFeedback] = useState(
    'กดเริ่ม แล้วแตะปุ่ม "แตะให้ตรงแสง" (หรือ Spacebar / Enter) เมื่อเปลวเทียนเข้าเป้ากลาง 5 ครั้ง'
  );
  const [rhythmLiveCue, setRhythmLiveCue] = useState('');
  const rhythmDirRef = useRef(1);
  const beatPosRef = useRef(0.5);
  const prevInSweetspotRef = useRef(false);
  const lastLiveCueAtRef = useRef(0);
  const rhythmTapBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!rhythmRunning) return undefined;
    rhythmTapBtnRef.current?.focus();

    if (reducedMotion) {
      const steps = [0.22, 0.38, 0.5, 0.62, 0.78, 0.5];
      let stepIdx = 0;
      const timer = window.setInterval(() => {
        stepIdx = (stepIdx + 1) % steps.length;
        beatPosRef.current = steps[stepIdx];
        setBeatPos(steps[stepIdx]);
      }, 520);
      return () => window.clearInterval(timer);
    }

    let rafId = 0;
    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(40, now - lastTs) / 1000;
      lastTs = now;
      let next = beatPosRef.current + rhythmDirRef.current * dt * 1.18;
      if (next >= 0.94) {
        next = 0.94;
        rhythmDirRef.current = -1;
      } else if (next <= 0.06) {
        next = 0.06;
        rhythmDirRef.current = 1;
      }
      beatPosRef.current = next;
      setBeatPos(next);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [rhythmRunning, reducedMotion]);

  useEffect(() => {
    if (!rhythmRunning) {
      prevInSweetspotRef.current = false;
      return;
    }
    const inCenter = Math.abs(beatPos - 0.5) <= 0.13;
    if (inCenter && !prevInSweetspotRef.current) {
      playChime('beat', soundEnabled);
      const now = Date.now();
      if (now - lastLiveCueAtRef.current >= 750) {
        lastLiveCueAtRef.current = now;
        setRhythmLiveCue(`จังหวะที่ ${beatIndex + 1} เข้าเป้ากลางแล้ว กดตอนนี้`);
      }
    }
    prevInSweetspotRef.current = inCenter;
  }, [beatPos, rhythmRunning, beatIndex, soundEnabled]);

  const startRhythm = () => {
    onResetMinigame('rhythm');
    beatPosRef.current = 0.2;
    rhythmDirRef.current = 1;
    setBeatPos(0.2);
    setBeatIndex(0);
    setRhythmPoints(0);
    setRhythmFeedback('พร้อมแล้ว! แตะปุ่มให้ตรงโซนทองตรงกลาง 5 จังหวะ');
    setRhythmRunning(true);
  };

  const handleRhythmTap = () => {
    if (!rhythmRunning) return;
    const { judgment, points } = judgeRhythmTap(beatPosRef.current);
    const nextPoints = rhythmPoints + points;
    const nextBeat = beatIndex + 1;
    setRhythmPoints(nextPoints);
    setBeatIndex(nextBeat);

    const word =
      judgment === 'perfect'
        ? `สมบูรณ์แบบ! +${points}`
        : judgment === 'good'
          ? `ดีมาก! +${points}`
          : `เฉียดไปนิด +${points}`;

    if (nextBeat >= RHYTHM_TOTAL_BEATS) {
      setRhythmRunning(false);
      const res = evaluateRhythmResult(nextPoints);
      setRhythmFeedback(
        res.passed
          ? `${word} — รวม ${res.score} คะแนน! แสงกระทงเปล่งประกายแล้ว`
          : `${word} — ได้ ${res.score} คะแนน (ต้องได้อย่างน้อย ${RHYTHM_PASS_THRESHOLD}) กดเล่นซ้ำได้`
      );
      onCompleteMinigame('rhythm', res.passed, res.score);
    } else {
      setRhythmFeedback(`${word} (จังหวะที่ ${nextBeat}/${RHYTHM_TOTAL_BEATS})`);
    }
  };

  const allPassed = areAllMinigamesPassed(progress);
  const quality = computeKrathongQuality(progress);

  const streamDist = Math.abs(streamPos - 0.5);
  const streamZone: 'center' | 'near' | 'outer' =
    streamDist <= 0.13 ? 'center' : streamDist <= 0.27 ? 'near' : 'outer';

  const stackDist = Math.abs(stackPos - 0.5);
  const stackZone: 'center' | 'near' | 'outer' =
    stackDist <= 0.13 ? 'center' : stackDist <= 0.27 ? 'near' : 'outer';

  const rhythmDistance = Math.abs(beatPos - 0.5);
  const rhythmZone: 'center' | 'near' | 'outer' =
    rhythmDistance <= 0.13 ? 'center' : rhythmDistance <= 0.27 ? 'near' : 'outer';

  return (
    <div className="minigame-suite">
      <nav className="minigame-tabs" aria-label="ด่านมินิเกมประดิษฐ์กระทง">
        {(
          [
            { id: 'recipe', label: '1. สายน้ำคัดวัสดุ' },
            { id: 'assembly', label: '2. วางชั้นตรงแกน' },
            { id: 'rhythm', label: '3. แสงเทียนจังหวะ' },
          ] as const
        ).map((tab) => {
          const unlocked = isMinigameUnlocked(progress, tab.id);
          const status = progress[tab.id].status;
          return (
            <button
              key={tab.id}
              type="button"
              className={`minigame-tab ${activeGame === tab.id ? 'is-active' : ''} ${
                status === 'passed' ? 'is-passed' : ''
              }`}
              disabled={!unlocked}
              aria-current={activeGame === tab.id ? 'step' : undefined}
              onClick={() => setActiveGame(tab.id)}
            >
              <span>{tab.label}</span>
              <span className="minigame-tab__badge">
                {status === 'passed'
                  ? `ผ่าน (${progress[tab.id].score})`
                  : status === 'failed'
                    ? 'ลองใหม่'
                    : unlocked
                      ? 'พร้อมเล่น'
                      : 'ล็อก'}
              </span>
            </button>
          );
        })}
      </nav>

      {activeGame === 'recipe' && (
        <section className="minigame-panel" aria-label="ด่านที่ 1 สายน้ำช้อนยอดวัสดุทอง">
          <div className="minigame-panel__top">
            <p className="minigame-desc">
              เล็งให้ของมงคลเข้า <strong>วงกระชอนทองตรงกลาง</strong> แล้วกดช้อนรับ! (ระวังใบไม้แห้ง/ขยะ)
            </p>
            <div className="minigame-stats">
              <span>ช้อนแล้ว: {recipeSelected.length}/4</span>
              <span>เวลา: {recipeSeconds}s</span>
              <span>พลาด: {recipeMistakes}/{RECIPE_MAX_MISTAKES}</span>
            </div>
          </div>

          <div className="rhythm-track rhythm-track--canal" aria-hidden="true">
            <div className="rhythm-sweetspot" />
            <div
              className={`floating-stream-token ${
                currentStreamItem?.isTarget ? 'is-sacred' : 'is-decoy'
              }`}
              style={{ left: `${Math.round(streamPos * 100)}%` }}
            >
              <span>{currentStreamItem?.emoji}</span>
            </div>
          </div>

          <div className="arcade-spotlight-row">
            <span
              className={`stream-item-pill ${
                currentStreamItem?.isTarget ? 'is-sacred' : 'is-decoy'
              }`}
            >
              กำลังลอยมา: {currentStreamItem?.emoji}{' '}
              <strong>{currentStreamItem?.label}</strong>{' '}
              {currentStreamItem?.isTarget ? '(ของมงคล — รอเข้ากลางแล้วช้อน!)' : '(สิ่งเจือปน — ห้ามช้อน!)'}
            </span>
          </div>

          <p
            id={streamCueId}
            className={`rhythm-cue-pill ${
              recipeRunning ? `rhythm-cue-pill--${streamZone}` : ''
            }`}
          >
            {!recipeRunning
              ? `จังหวะสายน้ำ (${STREAM_ZONES[2].label}): กดเริ่มด่าน 1 เพื่อช้อนวัสดุตามจังหวะน้ำไหล`
              : !currentStreamItem?.isTarget
                ? '⚠ สิ่งเจือปนกำลังลอยผ่าน — กด "ปัดสิ่งเจือปนออก" หรือปล่อยผ่านไป!'
                : streamZone === 'center'
                  ? `★ "${currentStreamItem.label}" เข้ากลางวงทองเป๊ะ — กดช้อนรับตอนนี้!`
                  : streamZone === 'near'
                    ? `◎ "${currentStreamItem.label}" เข้าขอบวงทองแล้ว ช้อนได้เลย!`
                    : `○ รอให้ "${currentStreamItem.label}" ลอยเข้าวงสีทองตรงกลาง...`}
          </p>

          <div className="recipe-collected-bar" aria-label="ถาดวัสดุสำหรับตรวจสอบ">
            {RECIPE_TRAY_ITEMS.map((item) => {
              const picked = recipeSelected.includes(item.id);
              const dismissed = recipeDismissed.includes(item.id);
              const isCurrent = recipeRunning && currentStreamItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`btn btn--sm recipe-chip ${picked ? 'is-picked' : ''} ${
                    isCurrent ? 'is-current' : ''
                  }`}
                  disabled={!recipeRunning || picked || dismissed}
                  aria-pressed={picked}
                  onClick={() => handleStreamScoop(item.id)}
                >
                  {picked ? `✓ ${item.label}` : `${item.emoji} ${item.label}`}
                </button>
              );
            })}
          </div>

          <p className="minigame-feedback" role="status" aria-live="polite">
            {recipeFeedback}
          </p>

          <div className="minigame-actions">
            {recipeRunning ? (
              <>
                <button
                  ref={scoopBtnRef}
                  type="button"
                  className="btn btn--primary btn--lg"
                  aria-describedby={streamCueId}
                  onClick={() => handleStreamScoop()}
                >
                  ช้อนรับเข้าถาดทอง! ({recipeSelected.length}/{RECIPE_TARGET_IDS.length})
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={handleSwatDecoy}
                >
                  ปัดสิ่งเจือปน / ข้ามชิ้นนี้
                </button>
              </>
            ) : (
              <button type="button" className="btn btn--primary" onClick={startRecipe}>
                {progress.recipe.status === 'pending' ? 'เริ่มด่าน 1' : 'เล่นด่าน 1 ซ้ำ'}
              </button>
            )}
            {progress.recipe.status === 'passed' && !recipeRunning && (
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setActiveGame('assembly')}
              >
                ไปด่าน 2: วางชั้นกระทงตรงแกน
              </button>
            )}
          </div>
        </section>
      )}

      {activeGame === 'assembly' && (
        <section className="minigame-panel" aria-label="ด่านที่ 2 วางชั้นกระทงตรงแกนทอง">
          <div className="minigame-panel__top">
            <p className="minigame-desc">
              จังหวะที่ชิ้นส่วนเลื่อนผ่าน <strong>แกนทองตรงกลาง</strong> ให้กดวางซ้อนทีละชั้น (1 → 4)!
            </p>
            <div className="minigame-stats">
              <span>ตั้งชั้นแล้ว: {placedCount}/4</span>
              <span>พลาด: {assemblySlips}/{ASSEMBLY_MAX_SLIPS}</span>
            </div>
          </div>

          <div className="rhythm-track rhythm-track--stack" aria-hidden="true">
            <div className="rhythm-sweetspot" />
            <div className="stack-center-line" />
            {placedCount < ASSEMBLY_STEPS.length && (
              <div
                className="floating-stream-token is-sacred"
                style={{ left: `${Math.round(stackPos * 100)}%` }}
              >
                <span>{currentStep.emoji}</span>
              </div>
            )}
          </div>

          <div className="stack-tower-stage" aria-label="หอประกอบชั้นกระทง">
            {[...ASSEMBLY_STEPS].reverse().map((step) => {
              const idx = step.stepOrder - 1;
              const filled = idx < placedCount;
              const isCurrent = idx === placedCount && progress.assembly.status !== 'passed';
              const offsetNorm = placedOffsets[idx] ?? 0.5;
              const shiftPx = Math.round((offsetNorm - 0.5) * 90);
              return (
                <div
                  key={step.id}
                  className={`stack-layer-row ${filled ? 'is-filled' : ''} ${
                    isCurrent ? 'is-current' : ''
                  }`}
                >
                  <div
                    className="stack-layer-bar"
                    style={
                      filled
                        ? { transform: `translateX(${shiftPx}px)` }
                        : undefined
                    }
                  >
                    {filled
                      ? `✓ ${step.emoji} ${step.label}`
                      : isCurrent
                        ? `▼ กำลังเล็ง: ${step.emoji} ${step.label}`
                        : `○ รอชั้นที่ ${step.stepOrder}`}
                  </div>
                </div>
              );
            })}
          </div>

          <p
            id={stackCueId}
            className={`rhythm-cue-pill ${
              stackRunning ? `rhythm-cue-pill--${stackZone}` : ''
            }`}
          >
            {!stackRunning
              ? 'กด "เริ่มเล็งวางชั้นกระทง" เพื่อให้ชิ้นส่วนเคลื่อนซ้าย-ขวาเหมือนเกมจังหวะแสงเทียน!'
              : stackZone === 'center'
                ? `★ "${currentStep.label}" ตรงแกนทองเป๊ะ — กดวางตอนนี้เลย!`
                : stackZone === 'near'
                  ? `◎ ใกล้ตรงแกนกลางแล้ว กดวางได้!`
                  : `○ รอให้ "${currentStep.label}" เลื่อนเข้าหาเส้นแกนทอง...`}
          </p>

          <p className="minigame-feedback" role="status" aria-live="polite">
            {assemblyFeedback}
          </p>

          <div className="minigame-actions">
            {stackRunning && placedCount < ASSEMBLY_STEPS.length ? (
              <button
                ref={stackDropBtnRef}
                type="button"
                className="btn btn--primary btn--lg"
                aria-describedby={stackCueId}
                onClick={handleStackDrop}
              >
                วางชั้นกระทงตรงแกน! ({placedCount + 1}/4)
              </button>
            ) : (
              progress.assembly.status !== 'passed' && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={startAssembly}
                >
                  {progress.assembly.status === 'failed'
                    ? 'ประกอบใหม่ (Retry)'
                    : 'เริ่มเล็งวางชั้นกระทง'}
                </button>
              )
            )}
            {progress.assembly.status === 'passed' && (
              <>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={startAssembly}
                >
                  เล่นด่าน 2 ซ้ำเพื่อเพิ่มคะแนน
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setActiveGame('rhythm')}
                >
                  ไปด่าน 3: ประดับแสงเทียนตามจังหวะ
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {activeGame === 'rhythm' && (
        <section className="minigame-panel" aria-label="ด่านที่ 3 ประดับแสงตามจังหวะ">
          <div className="minigame-panel__top">
            <p className="minigame-desc">
              {reducedMotion
                ? 'โหมดลดการเคลื่อนไหว: แสงจะเลื่อนเป็นจังหวะช้าๆ แตะเมื่ออยู่ช่วงกลางสีทอง'
                : 'แตะให้ตรงโซนสีทองตรงกลางทั้งหมด 5 จังหวะ เพื่อจุดประกายแสงเทียนคู่รัก'}
            </p>
            <div className="minigame-stats">
              <span>จังหวะ: {beatIndex}/{RHYTHM_TOTAL_BEATS}</span>
              <span>คะแนน: {rhythmPoints}/100</span>
            </div>
          </div>

          <div className="rhythm-candle-orbs" aria-hidden="true">
            {Array.from({ length: RHYTHM_TOTAL_BEATS }).map((_, idx) => (
              <span
                key={idx}
                className={`candle-orb ${idx < beatIndex ? 'is-lit' : ''}`}
              >
                {idx < beatIndex ? '🕯️' : '○'}
              </span>
            ))}
          </div>

          <div className="rhythm-track" aria-hidden="true">
            <div className="rhythm-sweetspot" />
            <div
              className="rhythm-cursor"
              style={{ left: `${Math.round(beatPos * 100)}%` }}
            />
          </div>

          <p
            id={rhythmZoneHintId}
            className={`rhythm-cue-pill ${
              rhythmRunning ? `rhythm-cue-pill--${rhythmZone}` : ''
            }`}
          >
            {!rhythmRunning
              ? 'สัญญาณจังหวะ: กดเริ่มเพื่อดูสถานะจังหวะและฟังเสียงเตือนเมื่อเข้าเป้ากลาง'
              : rhythmZone === 'center'
                ? '★ จังหวะเข้าเป้ากลางแล้ว — กด Space หรือ Enter ตอนนี้!'
                : rhythmZone === 'near'
                  ? '◎ ใกล้เข้ากลาง เตรียมกด'
                  : '○ แสงกำลังเคลื่อนเข้าสู่ตรงกลาง'}
          </p>

          <span
            className="visually-hidden"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {rhythmLiveCue}
          </span>

          <p className="minigame-feedback" role="status" aria-live="polite">
            {rhythmFeedback}
          </p>

          <div className="minigame-actions">
            {rhythmRunning ? (
              <button
                ref={rhythmTapBtnRef}
                type="button"
                className="btn btn--primary btn--lg"
                aria-describedby={rhythmZoneHintId}
                onClick={handleRhythmTap}
              >
                แตะให้ตรงแสง! ({beatIndex + 1}/{RHYTHM_TOTAL_BEATS})
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={startRhythm}>
                {progress.rhythm.status === 'pending' ? 'เริ่มจับจังหวะแสง' : 'เล่นด่าน 3 ซ้ำ'}
              </button>
            )}
          </div>
        </section>
      )}

      {allPassed && (
        <div className="quality-banner" role="status">
          <strong>ผ่านครบทั้ง 3 ด่านแล้ว!</strong> คุณภาพกระทงปัจจุบัน:{' '}
          <span className="quality-pill">{quality.tierTitle}</span> (รวม {quality.totalScore}/300)
        </div>
      )}
    </div>
  );
}
