import { describe, expect, it } from 'vitest';
import {
  ASSEMBLY_STEPS,
  RECIPE_TARGET_IDS,
  checkAssemblyTap,
  computeKrathongQuality,
  evaluateAssemblyResult,
  evaluateRecipeResult,
  evaluateRhythmResult,
  judgeRhythmTap,
} from '../src/domain/minigames';
import {
  canCraftKrathong,
  canReleaseKrathong,
  createInitialGameState,
  gameReducer,
} from '../src/domain/reducer';

describe('DomainState & Minigames deterministic logic', () => {
  it('updates two couple profiles, switches active player, and resets cleanly', () => {
    let state = createInitialGameState();
    state = gameReducer(state, {
      type: 'UPDATE_PLAYER_NAME',
      playerId: 'p1',
      name: 'ชมพู',
    });
    state = gameReducer(state, {
      type: 'UPDATE_PLAYER_NAME',
      playerId: 'p2',
      name: 'นที',
    });
    state = gameReducer(state, {
      type: 'UPDATE_PLAYER_CUSTOMIZATION',
      playerId: 'p2',
      patch: { outfit: 'emerald-sabai', skinTone: 'caramel' },
    });
    state = gameReducer(state, { type: 'SET_ACTIVE_PLAYER', playerId: 'p2' });

    expect(state.players.p1.name).toBe('ชมพู');
    expect(state.players.p2.name).toBe('นที');
    expect(state.players.p2.customization.outfit).toBe('emerald-sabai');
    expect(state.settings.activePlayer).toBe('p2');

    const reset = gameReducer(state, { type: 'RESET_GAME' });
    expect(reset.players.p1.name).toBe('ฟ้าใส');
    expect(reset.players.p2.name).toBe('ต้นกล้า');
    expect(reset.screen).toBe('setup');
  });

  it('requires all 3 materials AND all 3 passed minigames before crafting and releasing', () => {
    let state = createInitialGameState();
    state = gameReducer(state, { type: 'ENTER_WORLD' });

    state = gameReducer(state, {
      type: 'COLLECT_MATERIAL',
      material: 'banana-leaf',
      byPlayer: 'p1',
    });
    state = gameReducer(state, {
      type: 'COLLECT_MATERIAL',
      material: 'lotus-blossom',
      byPlayer: 'p2',
    });
    state = gameReducer(state, {
      type: 'COLLECT_MATERIAL',
      material: 'candle-incense',
      byPlayer: 'p1',
    });

    expect(state.questStage).toBe('craft');
    expect(canCraftKrathong(state)).toBe(false);

    // Fail first minigame then retry and pass all 3
    state = gameReducer(state, {
      type: 'COMPLETE_MINIGAME',
      gameId: 'recipe',
      passed: false,
      score: 20,
      byPlayer: 'p1',
    });
    expect(canCraftKrathong(state)).toBe(false);

    state = gameReducer(state, {
      type: 'COMPLETE_MINIGAME',
      gameId: 'recipe',
      passed: true,
      score: 92,
      byPlayer: 'p1',
    });
    state = gameReducer(state, {
      type: 'COMPLETE_MINIGAME',
      gameId: 'assembly',
      passed: true,
      score: 88,
      byPlayer: 'p2',
    });
    state = gameReducer(state, {
      type: 'COMPLETE_MINIGAME',
      gameId: 'rhythm',
      passed: true,
      score: 90,
      byPlayer: 'p1',
    });

    expect(canCraftKrathong(state)).toBe(true);
    state = gameReducer(state, { type: 'CRAFT_KRATHONG', byPlayer: 'p1' });
    expect(state.questStage).toBe('ceremony');
    expect(canReleaseKrathong(state)).toBe(true);

    state = gameReducer(state, {
      type: 'RELEASE_KRATHONG',
      byPlayer: 'p2',
      timestamp: '2026-11-24T12:00:00.000Z',
    });

    expect(state.questStage).toBe('released');
    expect(state.releasedKrathongs).toHaveLength(1);
    expect(state.releasedKrathongs[0].quality.tier).toBe('celestial');
    expect(state.releasedKrathongs[0].quality.totalScore).toBe(270);
  });

  it('evaluates minigames 1, 2, and 3 deterministically for pass and fail cases', () => {
    const recipePass = evaluateRecipeResult({
      selectedIds: RECIPE_TARGET_IDS,
      mistakes: 0,
      remainingSeconds: 12,
    });
    expect(recipePass.passed).toBe(true);
    expect(recipePass.score).toBeGreaterThanOrEqual(80);

    const recipeTimeout = evaluateRecipeResult({
      selectedIds: RECIPE_TARGET_IDS.slice(0, 2),
      mistakes: 1,
      remainingSeconds: 0,
    });
    expect(recipeTimeout.passed).toBe(false);

    const stepCheck1 = checkAssemblyTap(0, ASSEMBLY_STEPS[0].id);
    const stepWrong = checkAssemblyTap(0, ASSEMBLY_STEPS[2].id);
    expect(stepCheck1.correct).toBe(true);
    expect(stepWrong.correct).toBe(false);
    expect(evaluateAssemblyResult({ placedCount: 4, slips: 1 }).passed).toBe(true);
    expect(evaluateAssemblyResult({ placedCount: 2, slips: 3 }).passed).toBe(false);

    expect(judgeRhythmTap(0.5)).toEqual({ judgment: 'perfect', points: 20 });
    expect(judgeRhythmTap(0.72)).toEqual({ judgment: 'good', points: 14 });
    expect(evaluateRhythmResult(80).passed).toBe(true);
    expect(evaluateRhythmResult(30).passed).toBe(false);

    const tierClassic = computeKrathongQuality({
      recipe: { status: 'passed', score: 62, attempts: 1 },
      assembly: { status: 'passed', score: 65, attempts: 1 },
      rhythm: { status: 'passed', score: 56, attempts: 1 },
    });
    expect(tierClassic.tier).toBe('classic');
  });
});