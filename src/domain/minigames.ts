import type {
  KrathongQualitySummary,
  KrathongQualityTier,
  MinigameId,
  MinigamesProgress,
} from './types';

export interface RecipeOption {
  id: string;
  label: string;
  emoji: string;
  isTarget: boolean;
  category: 'leaf' | 'flower' | 'light' | 'decoy';
}

export const RECIPE_DURATION_SECONDS = 26;
export const RECIPE_MAX_MISTAKES = 3;

export const RECIPE_TRAY_ITEMS: RecipeOption[] = [
  { id: 'banana-tani', label: 'ใบตองตานีสด', emoji: '🌿', isTarget: true, category: 'leaf' },
  { id: 'dry-leaf', label: 'ใบไม้แห้ง', emoji: '🍂', isTarget: false, category: 'decoy' },
  { id: 'banana-trunk', label: 'หยวกกล้วย', emoji: '🎋', isTarget: true, category: 'leaf' },
  { id: 'plastic-bag', label: 'เศษพลาสติก', emoji: '🛍️', isTarget: false, category: 'decoy' },
  { id: 'pink-lotus', label: 'ดอกบัวชมพู', emoji: '🪷', isTarget: true, category: 'flower' },
  { id: 'pebble', label: 'ก้อนกรวด', emoji: '🪨', isTarget: false, category: 'decoy' },
  { id: 'scented-candle', label: 'เทียนหอมคู่', emoji: '🕯️', isTarget: true, category: 'light' },
  { id: 'twig', label: 'กิ่งไม้ผุ', emoji: '🪵', isTarget: false, category: 'decoy' },
];

export const RECIPE_TARGET_IDS = RECIPE_TRAY_ITEMS.filter((i) => i.isTarget).map(
  (i) => i.id
);

export type TimingJudgment = 'perfect' | 'good' | 'miss';

/**
 * Evaluates a catch/stack/rhythm tap in normalized [0..1] track space where 0.5 is dead center.
 */
export function judgeRhythmTap(normalizedPos: number): {
  judgment: TimingJudgment;
  points: number;
} {
  const distanceFromCenter = Math.abs(normalizedPos - 0.5);
  if (distanceFromCenter <= 0.13) {
    return { judgment: 'perfect', points: 20 };
  }
  if (distanceFromCenter <= 0.27) {
    return { judgment: 'good', points: 14 };
  }
  return { judgment: 'miss', points: 4 };
}

export function judgeStreamScoop(
  normalizedPos: number,
  item: RecipeOption
): {
  caught: boolean;
  mistake: boolean;
  judgment: TimingJudgment;
  points: number;
} {
  const dist = Math.abs(normalizedPos - 0.5);
  const inZone = dist <= 0.27;
  if (!item.isTarget) {
    return {
      caught: false,
      mistake: true,
      judgment: 'miss',
      points: 0,
    };
  }
  if (!inZone) {
    return {
      caught: false,
      mistake: true,
      judgment: 'miss',
      points: 0,
    };
  }
  if (dist <= 0.13) {
    return { caught: true, mistake: false, judgment: 'perfect', points: 25 };
  }
  return { caught: true, mistake: false, judgment: 'good', points: 20 };
}

export function evaluateRecipeResult(params: {
  selectedIds: string[];
  mistakes: number;
  remainingSeconds: number;
  timingBonus?: number;
}): { passed: boolean; score: number } {
  const allTargetsPicked = RECIPE_TARGET_IDS.every((id) =>
    params.selectedIds.includes(id)
  );
  if (
    !allTargetsPicked ||
    params.mistakes >= RECIPE_MAX_MISTAKES ||
    params.remainingSeconds <= 0
  ) {
    return {
      passed: false,
      score: Math.max(0, params.selectedIds.length * 12 - params.mistakes * 5),
    };
  }
  const raw =
    66 +
    Math.round(params.remainingSeconds * 1.1) +
    Math.round(params.timingBonus ?? 6) -
    params.mistakes * 8;
  return {
    passed: true,
    score: Math.max(60, Math.min(100, raw)),
  };
}

export interface AssemblyStepItem {
  id: string;
  stepOrder: number; // 1..4
  label: string;
  emoji: string;
  hint: string;
  speedMultiplier: number;
}

export const ASSEMBLY_STEPS: AssemblyStepItem[] = [
  {
    id: 'step-base',
    stepOrder: 1,
    label: '1. ฐานหยวกกล้วย',
    emoji: '🎋',
    hint: 'เล็งให้ฐานหยวกกล้วยตรงแกนทองตรงกลาง',
    speedMultiplier: 1.0,
  },
  {
    id: 'step-petals',
    stepOrder: 2,
    label: '2. กลีบใบตองพับ',
    emoji: '🌿',
    hint: 'วางกลีบใบตองซ้อนทับฐานให้สมมาตร',
    speedMultiplier: 1.18,
  },
  {
    id: 'step-flowers',
    stepOrder: 3,
    label: '3. พวงดอกไม้คู่',
    emoji: '🪷',
    hint: 'ประดับดอกบัวชมพูคู่กลางวงกลีบ',
    speedMultiplier: 1.35,
  },
  {
    id: 'step-candle',
    stepOrder: 4,
    label: '4. ธูปเทียนอธิษฐาน',
    emoji: '🕯️',
    hint: 'ปักธูปเทียนยอดทองให้ตั้งตรงกลางกระทงเป๊ะ!',
    speedMultiplier: 1.52,
  },
];

export const ASSEMBLY_TILES_DISPLAY_ORDER: AssemblyStepItem[] = [
  ASSEMBLY_STEPS[2],
  ASSEMBLY_STEPS[0],
  ASSEMBLY_STEPS[3],
  ASSEMBLY_STEPS[1],
];

export const ASSEMBLY_MAX_SLIPS = 3;

export function judgeStackDrop(normalizedPos: number): {
  aligned: boolean;
  judgment: TimingJudgment;
  points: number;
} {
  const dist = Math.abs(normalizedPos - 0.5);
  if (dist <= 0.13) {
    return { aligned: true, judgment: 'perfect', points: 25 };
  }
  if (dist <= 0.27) {
    return { aligned: true, judgment: 'good', points: 20 };
  }
  return { aligned: false, judgment: 'miss', points: 0 };
}

export function checkAssemblyTap(
  placedCount: number,
  tappedItemId: string
): { correct: boolean; expectedItem: AssemblyStepItem; nextPlacedCount: number } {
  const expectedItem =
    ASSEMBLY_STEPS[placedCount] ?? ASSEMBLY_STEPS[ASSEMBLY_STEPS.length - 1];
  const correct = expectedItem.id === tappedItemId;
  return {
    correct,
    expectedItem,
    nextPlacedCount: correct ? placedCount + 1 : placedCount,
  };
}

export function evaluateAssemblyResult(params: {
  placedCount: number;
  slips: number;
  alignmentPoints?: number;
}): { passed: boolean; score: number } {
  if (
    params.placedCount < ASSEMBLY_STEPS.length ||
    params.slips >= ASSEMBLY_MAX_SLIPS
  ) {
    return {
      passed: false,
      score: Math.max(0, params.placedCount * 15 - params.slips * 5),
    };
  }
  const baseScore =
    params.alignmentPoints !== undefined
      ? params.alignmentPoints - params.slips * 8
      : 100 - params.slips * 15;
  return {
    passed: true,
    score: Math.max(60, Math.min(100, baseScore)),
  };
}

export const RHYTHM_TOTAL_BEATS = 5;
export const RHYTHM_PASS_THRESHOLD = 55;

export type BeatJudgment = TimingJudgment;

export function evaluateRhythmResult(totalPoints: number): {
  passed: boolean;
  score: number;
} {
  const clamped = Math.max(0, Math.min(100, totalPoints));
  return {
    passed: clamped >= RHYTHM_PASS_THRESHOLD,
    score: clamped,
  };
}

export function createInitialMinigames(): MinigamesProgress {
  return {
    recipe: { status: 'pending', score: 0, attempts: 0 },
    assembly: { status: 'pending', score: 0, attempts: 0 },
    rhythm: { status: 'pending', score: 0, attempts: 0 },
  };
}

export function areAllMinigamesPassed(progress: MinigamesProgress): boolean {
  return (
    progress.recipe.status === 'passed' &&
    progress.assembly.status === 'passed' &&
    progress.rhythm.status === 'passed'
  );
}

export function isMinigameUnlocked(
  progress: MinigamesProgress,
  gameId: MinigameId
): boolean {
  if (gameId === 'recipe') return true;
  if (gameId === 'assembly') return progress.recipe.status === 'passed';
  return (
    progress.recipe.status === 'passed' && progress.assembly.status === 'passed'
  );
}

function scoreToLevel(score: number): 1 | 2 | 3 {
  if (score >= 86) return 3;
  if (score >= 70) return 2;
  return 1;
}

export function computeKrathongQuality(
  progress: MinigamesProgress
): KrathongQualitySummary {
  const totalScore =
    progress.recipe.score + progress.assembly.score + progress.rhythm.score;
  const flowerLevel = scoreToLevel(progress.recipe.score);
  const craftLevel = scoreToLevel(progress.assembly.score);
  const glowLevel = scoreToLevel(progress.rhythm.score);

  let tier: KrathongQualityTier = 'classic';
  let tierTitle = 'เรียบง่ายจริงใจ (1 ดาว)';

  if (areAllMinigamesPassed(progress)) {
    if (totalScore >= 245) {
      tier = 'celestial';
      tierTitle = 'วิจิตรแสงจันทร์ (3 ดาว)';
    } else if (totalScore >= 185) {
      tier = 'radiant';
      tierTitle = 'งดงามอบอุ่น (2 ดาว)';
    }
  }

  return {
    totalScore,
    flowerLevel,
    craftLevel,
    glowLevel,
    tier,
    tierTitle,
  };
}
