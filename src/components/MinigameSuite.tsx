import { useEffect, useId, useRef, useState } from 'react';
import {
  ASSEMBLY_MAX_SLIPS,
  ASSEMBLY_STEPS,
  ASSEMBLY_TILES_DISPLAY_ORDER,
  RECIPE_DURATION_SECONDS,
  RECIPE_MAX_MISTAKES,
  RECIPE_TARGET_IDS,
  RECIPE_TRAY_ITEMS,
  RHYTHM_PASS_THRESHOLD,
  RHYTHM_TOTAL_BEATS,
  areAllMinigamesPassed,
  checkAssemblyTap,
  computeKrathongQuality,
  evaluateAssemblyResult,
  evaluateRecipeResult,
  evaluateRhythmResult,
  isMinigameUnlocked,
  judgeRhythmTap,
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

export function MinigameSuite({
  progress,
  reducedMotion,
  soundEnabled = false,
  onCompleteMinigame,
  onResetMinigame,
}: MinigameSuiteProps) {
  const rhythmZoneHintId = useId();
  const initialActive: MinigameId =
    progress.recipe.status !== 'passed'
      ? 'recipe'
      : progress.assembly.status !== 'passed'
        ? 'assembly'
        : 'rhythm';
  const [activeGame, setActiveGame] = useState<MinigameId>(initialActive);

  // --- Game 1: Recipe state ---
  const [recipeRunning, setRecipeRunning] = useState(false);
  const [recipeSelected, setRecipeSelected] = useState<string[]>([]);
  const [recipeMistakes, setRecipeMistakes] = useState(0);
  const [recipeSeconds, setRecipeSeconds] = useState(RECIPE_DURATION_SECONDS);
  const [recipeFeedback, setRecipeFeedback] = useState(
    'กดเริ่มเพื่อคัดเลือกวัตถุดิบ 4 อย่างตามสูตร'
  );

  // --- Game 2: Assembly sequence state ---
  const [placedCount, setPlacedCount] = useState(0);
  const [assemblySlips, setAssemblySlips] = useState(0);
  const [assemblyFeedback, setAssemblyFeedback] = useState(
    'แตะหรือลากชิ้นส่วนเรียงลำดับจาก 1 ถึง 4'
  );

  // --- Game 3: Rhythm beat state ---
  const [rhythmRunning, setRhythmRunning] = useState(false);
  const [beatPos, setBeatPos] = useState(0.5);
  const [beatIndex, setBeatIndex] = useState(0);
  const [rhythmPoints, setRhythmPoints] = useState(0);
  const [rhythmFeedback, setRhythmFeedback] = useState(
    'กดเริ่ม แล้วแตะปุ่ม "แตะให้ตรงแสง" (หรือ Spacebar / Enter) เมื่อจังหวะเข้าเป้ากลาง 5 ครั้ง'
  );
  const [rhythmLiveCue, setRhythmLiveCue] = useState('');
  const rhythmDirRef = useRef(1);
  const beatPosRef = useRef(0.5);
  const prevInSweetspotRef = useRef(false);
  const lastLiveCueAtRef = useRef(0);
  const rhythmTapBtnRef = useRef<HTMLButtonElement>(null);

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
          });
          setRecipeFeedback('หมดเวลาแล้ว! กด "ลองใหม่" เพื่อคัดวัสดุอีกครั้ง');
          onCompleteMinigame('recipe', res.passed, res.score);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [recipeRunning, recipeSelected, recipeMistakes, onCompleteMinigame]);

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
        setRhythmLiveCue(
          `จังหวะที่ ${beatIndex + 1} เข้าเป้ากลางแล้ว กดตอนนี้`
        );
      }
    }
    prevInSweetspotRef.current = inCenter;
  }, [beatPos, rhythmRunning, beatIndex, soundEnabled]);

  const startRecipe = () => {
    onResetMinigame('recipe');
    setRecipeSelected([]);
    setRecipeMistakes(0);
    setRecipeSeconds(RECIPE_DURATION_SECONDS);
    setRecipeFeedback('เลือกวัตถุดิบที่ถูกต้องทั้ง 4 ชิ้นให้ทันเวลา!');
    setRecipeRunning(true);
  };

  const handleRecipePick = (itemId: string) => {
    if (!recipeRunning) return;
    const item = RECIPE_TRAY_ITEMS.find((i) => i.id === itemId);
    if (!item || recipeSelected.includes(itemId)) return;

    if (item.isTarget) {
      const nextSelected = [...recipeSelected, itemId];
      setRecipeSelected(nextSelected);
      if (nextSelected.length === RECIPE_TARGET_IDS.length) {
        setRecipeRunning(false);
        const res = evaluateRecipeResult({
          selectedIds: nextSelected,
          mistakes: recipeMistakes,
          remainingSeconds: recipeSeconds,
        });
        setRecipeFeedback(`เยี่ยมมาก! คัดวัสดุครบสูตรได้ ${res.score} คะแนน`);
        onCompleteMinigame('recipe', res.passed, res.score);
      } else {
        setRecipeFeedback(
          `เก็บ "${item.label}" แล้ว (${nextSelected.length}/${RECIPE_TARGET_IDS.length})`
        );
      }
    } else {
      const nextMistakes = recipeMistakes + 1;
      setRecipeMistakes(nextMistakes);
      if (nextMistakes >= RECIPE_MAX_MISTAKES) {
        setRecipeRunning(false);
        const res = evaluateRecipeResult({
          selectedIds: recipeSelected,
          mistakes: nextMistakes,
          remainingSeconds: recipeSeconds,
        });
        setRecipeFeedback(
          `เลือกวัสดุผิดครบ ${RECIPE_MAX_MISTAKES} ครั้ง กด "ลองใหม่" ได้เลย`
        );
        onCompleteMinigame('recipe', res.passed, res.score);
      } else {
        setRecipeFeedback(
          `"${item.label}" ไม่ได้อยู่ในสูตรกระทง (พลาด ${nextMistakes}/${RECIPE_MAX_MISTAKES})`
        );
      }
    }
  };

  const startAssembly = () => {
    onResetMinigame('assembly');
    setPlacedCount(0);
    setAssemblySlips(0);
    setAssemblyFeedback('เริ่มจากชิ้นที่ 1: ฐานหยวกกล้วย');
  };

  const handleAssemblyChoice = (itemId: string) => {
    if (progress.assembly.status === 'passed' || progress.assembly.status === 'failed') {
      return;
    }
    const check = checkAssemblyTap(placedCount, itemId);
    if (check.correct) {
      setPlacedCount(check.nextPlacedCount);
      if (check.nextPlacedCount === ASSEMBLY_STEPS.length) {
        const res = evaluateAssemblyResult({
          placedCount: check.nextPlacedCount,
          slips: assemblySlips,
        });
        setAssemblyFeedback(`ประกอบกระทงครบ 4 ชั้นอย่างประณีต! ได้ ${res.score} คะแนน`);
        onCompleteMinigame('assembly', res.passed, res.score);
      } else {
        const nextStep = ASSEMBLY_STEPS[check.nextPlacedCount];
        setAssemblyFeedback(`ถูกต้อง! ขั้นต่อไปเลือก "${nextStep.label}"`);
      }
    } else {
      const nextSlips = assemblySlips + 1;
      setAssemblySlips(nextSlips);
      if (nextSlips >= ASSEMBLY_MAX_SLIPS) {
        const res = evaluateAssemblyResult({
          placedCount,
          slips: nextSlips,
        });
        setAssemblyFeedback('เรียงลำดับพลาดครบ 3 ครั้ง ลองประกอบใหม่อีกครั้งนะ');
        onCompleteMinigame('assembly', res.passed, res.score);
      } else {
        setAssemblyFeedback(
          `ยังไม่ถึงขั้นนั้น ต้องวาง "${check.expectedItem.label}" ก่อน (พลาด ${nextSlips}/${ASSEMBLY_MAX_SLIPS})`
        );
      }
    }
  };

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
  const rhythmDistance = Math.abs(beatPos - 0.5);
  const rhythmZone: 'center' | 'near' | 'outer' =
    rhythmDistance <= 0.13 ? 'center' : rhythmDistance <= 0.27 ? 'near' : 'outer';

  return (
    <div className="minigame-suite">
      <nav className="minigame-tabs" aria-label="ด่านมินิเกมประดิษฐ์กระทง">
        {(
          [
            { id: 'recipe', label: '1. คัดวัสดุ' },
            { id: 'assembly', label: '2. ประกอบลำดับ' },
            { id: 'rhythm', label: '3. แสงจังหวะ' },
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
        <section className="minigame-panel" aria-label="ด่านที่ 1 คัดวัสดุตามสูตร">
          <div className="minigame-panel__top">
            <p className="minigame-desc">
              สูตรคู่รัก: <strong>ใบตองตานีสด, หยวกกล้วย, ดอกบัวชมพู, เทียนหอมคู่</strong>
            </p>
            <div className="minigame-stats">
              <span>เวลา: {recipeSeconds} วินาที</span>
              <span>พลาด: {recipeMistakes}/{RECIPE_MAX_MISTAKES}</span>
            </div>
          </div>
          <progress
            className="minigame-progress"
            value={recipeSelected.length}
            max={RECIPE_TARGET_IDS.length}
            aria-label="จำนวนวัสดุที่คัดเลือกถูกต้อง"
          />

          <div className="recipe-grid">
            {RECIPE_TRAY_ITEMS.map((item) => {
              const picked = recipeSelected.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`btn recipe-card ${picked ? 'is-picked' : ''}`}
                  disabled={!recipeRunning || picked}
                  aria-pressed={picked}
                  onClick={() => handleRecipePick(item.id)}
                >
                  {picked ? `✓ ${item.label}` : item.label}
                </button>
              );
            })}
          </div>

          <p className="minigame-feedback" role="status" aria-live="polite">
            {recipeFeedback}
          </p>

          <div className="minigame-actions">
            {!recipeRunning && (
              <button type="button" className="btn btn--primary" onClick={startRecipe}>
                {progress.recipe.status === 'pending' ? 'เริ่มด่าน 1' : 'เล่นด่าน 1 ซ้ำ'}
              </button>
            )}
            {progress.recipe.status === 'passed' && (
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setActiveGame('assembly')}
              >
                ไปด่าน 2: ประกอบกระทง
              </button>
            )}
          </div>
        </section>
      )}

      {activeGame === 'assembly' && (
        <section className="minigame-panel" aria-label="ด่านที่ 2 ประกอบลำดับชั้นกระทง">
          <div className="minigame-panel__top">
            <p className="minigame-desc">
              แตะชิ้นส่วนตามลำดับ <strong>1 → 2 → 3 → 4</strong> หรือลากมาวางในช่องประกอบ
            </p>
            <div className="minigame-stats">
              <span>ประกอบแล้ว: {placedCount}/4</span>
              <span>พลาด: {assemblySlips}/{ASSEMBLY_MAX_SLIPS}</span>
            </div>
          </div>

          <div
            className="assembly-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const itemId = e.dataTransfer.getData('text/plain');
              if (itemId) handleAssemblyChoice(itemId);
            }}
          >
            {ASSEMBLY_STEPS.map((step, index) => {
              const filled = index < placedCount;
              return (
                <div
                  key={step.id}
                  className={`assembly-slot ${filled ? 'is-filled' : ''}`}
                >
                  {filled ? `✓ ${step.label}` : `รอขั้นที่ ${index + 1}`}
                </div>
              );
            })}
          </div>

          <div className="assembly-tiles">
            {ASSEMBLY_TILES_DISPLAY_ORDER.map((item) => {
              const alreadyPlaced = item.stepOrder <= placedCount;
              return (
                <button
                  key={item.id}
                  type="button"
                  draggable={!alreadyPlaced && progress.assembly.status !== 'failed'}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
                  className={`btn assembly-tile ${alreadyPlaced ? 'is-placed' : ''}`}
                  disabled={
                    alreadyPlaced ||
                    progress.assembly.status === 'failed' ||
                    progress.assembly.status === 'passed'
                  }
                  onClick={() => handleAssemblyChoice(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <p className="minigame-feedback" role="status" aria-live="polite">
            {assemblyFeedback}
          </p>

          <div className="minigame-actions">
            <button type="button" className="btn btn--secondary" onClick={startAssembly}>
              {progress.assembly.status === 'failed' ? 'ประกอบใหม่ (Retry)' : 'เริ่มเรียงใหม่'}
            </button>
            {progress.assembly.status === 'passed' && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setActiveGame('rhythm')}
              >
                ไปด่าน 3: ประดับแสงตามจังหวะ
              </button>
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
                : 'แตะให้ตรงโซนสีทองตรงกลางทั้งหมด 5 จังหวะ เพื่อจุดประกายกระทง'}
            </p>
            <div className="minigame-stats">
              <span>จังหวะ: {beatIndex}/{RHYTHM_TOTAL_BEATS}</span>
              <span>คะแนน: {rhythmPoints}/100</span>
            </div>
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