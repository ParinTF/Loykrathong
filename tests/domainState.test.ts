import { describe, expect, it } from 'vitest';
import { advanceLanternClock, applyActivitySkill, BOAT_LOTUS_TARGETS, leafTrack, LEAF_SHAPES_ORDER, type ActivitySkillCommand } from '../src/domain/activitySkills.mjs';
import {
  countSharedMemories,
  createInitialGameState,
  gameReducer,
} from '../src/domain/reducer';

describe('DomainState romantic co-op activities ', () => {
  it('updates two couple profiles including accessories and resets cleanly', () => {
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
      patch: {
        outfit: 'emerald-sabai',
        skinTone: 'caramel',
        accessory: 'gold-lotus',
      },
    });
    state = gameReducer(state, { type: 'SET_ACTIVE_PLAYER', playerId: 'p2' });

    expect(state.players.p1.name).toBe('ชมพู');
    expect(state.players.p2.name).toBe('นที');
    expect(state.players.p2.customization.outfit).toBe('emerald-sabai');
    expect(state.players.p2.customization.accessory).toBe('gold-lotus');
    expect(state.settings.activePlayer).toBe('p2');

    const reset = gameReducer(state, { type: 'RESET_GAME' });
    expect(reset.players.p1.name).toBe('ฟ้าใส');
    expect(reset.players.p2.name).toBe('ต้นกล้า');
    expect(reset.screen).toBe('setup');
  });

  it('requires a steerable side approach to flowers and role-owned leaf traces', () => {
    let state = createInitialGameState();
    expect(applyActivitySkill(state, 'p2', { type: 'boat-stroke', angle: 0 }, 0)).toBe(state);
    const aimed = applyActivitySkill(state, 'p1', { type: 'boat-aim', angle: 90 }, 0);
    expect([aimed.lotusBoat.boatX, aimed.lotusBoat.boatY]).toEqual([16, 52]);
    const moved = applyActivitySkill(aimed, 'p1', { type: 'boat-stroke', angle: 90 }, 0);
    expect(moved.lotusBoat.boatY).toBe(59);
    state = applyActivitySkill(state, 'p1', { type: 'boat-swap' }, 0);
    expect(state.lotusBoat.rower).toBe('p2');

    for (const flower of BOAT_LOTUS_TARGETS) {
      state = { ...state, lotusBoat: { ...state.lotusBoat, boatX: flower.x - 7, boatY: flower.y, boatAngle: 0 } };
      const pick = { type: 'boat-pick' as const, id: flower.id };
      expect(applyActivitySkill(state, 'p1', pick, 0)).toBe(state);
      state = applyActivitySkill(state, 'p2', { type: 'boat-aim', angle: 90 }, 0);
      expect(applyActivitySkill(state, 'p2', pick, 0)).toBe(state);
      state = applyActivitySkill(state, 'p1', pick, 0);
      expect(applyActivitySkill(state, 'p1', pick, 0)).toBe(state);
    }
    expect(state.lotusBoat.completed).toBe(true);
    expect(state.inventory['lotus-blossom']).toBe(true);

    for (const shape of LEAF_SHAPES_ORDER) {
      for (const phase of ['cut', 'fold'] as const) {
        const worker = phase === 'cut' ? 'p1' : 'p2';
        for (let step = 0; step < 3; step += 1) {
          const points = [...leafTrack(shape, phase, step)!];
          const trace: ActivitySkillCommand = { type: 'leaf-trace', shape, phase, step, points };
          expect(applyActivitySkill(state, 'p1' === worker ? 'p2' : 'p1', trace, 0)).toBe(state);
          expect(applyActivitySkill(state, worker, { ...trace, points: [points[0], points[0], points[2]] }, 0)).toBe(state);
          expect(applyActivitySkill(state, worker, { ...trace, points: [...points].reverse() }, 0)).toBe(state);
          state = applyActivitySkill(state, worker, trace, 0);
          expect(applyActivitySkill(state, worker, trace, 0)).toBe(state);
        }
      }
    }
    expect(state.leafRelay.finishedPetals).toEqual(LEAF_SHAPES_ORDER);
    expect(state.inventory['banana-leaf']).toBe(true);
  });

  it('supports Activity 03 (blind fortune Q&A reveal), Activity 04 (1 sky lantern), Activity 06 (shared krathong studio), Activity 07 (photos), and Activity 08 (score-free release without forced gates)', () => {
    let state = createInitialGameState();
    state = gameReducer(state, { type: 'ENTER_WORLD' });

    // Couples can release a krathong immediately without being forced to finish every minigame first
    const earlyRelease = gameReducer(state, {
      type: 'RELEASE_KRATHONG',
      byPlayer: 'p1',
      timestamp: '2026-11-24T12:00:00.000Z',
    });
    expect(earlyRelease.releasedKrathongs).toHaveLength(1);
    expect('quality' in earlyRelease.releasedKrathongs[0]).toBe(false);

    // 03: Blind Fortune Paper stays hidden until BOTH lock
    state = gameReducer(state, {
      type: 'SET_FORTUNE_ANSWER',
      playerId: 'p1',
      answer: 'ไปดูแสงเหนือที่ไอซ์แลนด์ด้วยกัน',
    });
    state = gameReducer(state, { type: 'LOCK_FORTUNE_ANSWER', playerId: 'p1' });
    expect(state.fortunePaper.revealed).toBe(false);
    expect(state.inventory['candle-incense']).toBe(false);

    state = gameReducer(state, {
      type: 'SET_FORTUNE_ANSWER',
      playerId: 'p2',
      answer: 'ไปเชียงใหม่ตอนหน้าหนาวด้วยกัน',
    });
    state = gameReducer(state, { type: 'LOCK_FORTUNE_ANSWER', playerId: 'p2' });
    expect(state.fortunePaper.revealed).toBe(true);
    expect(state.inventory['candle-incense']).toBe(true);

    // 04: Both players must set heat, maintain overlap, and ready the release.
    state = gameReducer(state, { type: 'SET_LANTERN_WISH', playerId: 'p1', wish: 'ขอให้มีรอยยิ้มทุกวัน' });
    state = gameReducer(state, { type: 'SET_LANTERN_WISH', playerId: 'p2', wish: 'ขอให้ได้กลับมาพบกัน' });
    expect(applyActivitySkill(state, 'p1', { type: 'lantern-ready' }, 0)).toBe(state);
    expect(applyActivitySkill(state, 'p1', { type: 'lantern-grip', held: true, heat: 25 }, 0)).toBe(state);
    state = applyActivitySkill(state, 'p1', { type: 'lantern-grip', held: true, heat: 50 }, 0);
    expect(advanceLanternClock(state, 3000)).toBe(state);
    state = applyActivitySkill(state, 'p2', { type: 'lantern-grip', held: true, heat: 65 }, 3000);
    expect(advanceLanternClock(state, 4000)).toBe(state);
    state = applyActivitySkill(state, 'p2', { type: 'lantern-grip', held: false }, 4000);
    expect(advanceLanternClock(state, 6000)).toBe(state);
    state = applyActivitySkill(state, 'p2', { type: 'lantern-grip', held: true, heat: 65 }, 6000);
    expect(advanceLanternClock(state, 7799)).toBe(state);
    state = advanceLanternClock(state, 7800);
    expect(state.skyLantern.p1Lit && state.skyLantern.p2Lit).toBe(true);
    state = applyActivitySkill(state, 'p1', { type: 'lantern-ready' }, 8000);
    state = applyActivitySkill(state, 'p2', { type: 'lantern-ready' }, 8100);
    expect(advanceLanternClock(state, 11099)).toBe(state);
    state = advanceLanternClock(state, 11100);
    expect(state.skyLantern.released).toBe(true);

    // 06: Shared Krathong Studio drag/place decorations
    state = gameReducer(state, {
      type: 'ADD_KRATHONG_DECORATION',
      item: {
        id: 'heart-1',
        kind: 'heart-charm',
        x: 50,
        y: 50,
        scale: 1,
        placedBy: 'p2',
      },
    });
    state = gameReducer(state, {
      type: 'MOVE_KRATHONG_DECORATION',
      id: 'heart-1',
      x: 62,
      y: 44,
    });
    const moved = state.krathongDesign.decorations.find((d) => d.id === 'heart-1');
    expect(moved?.x).toBe(62);
    expect(moved?.y).toBe(44);
    state = gameReducer(state, { type: 'CRAFT_KRATHONG', byPlayer: 'p1' });
    expect(state.krathongCrafted).toBe(true);

    // 07: Scenic Viewpoint Pose & Photo Memory
    state = gameReducer(state, { type: 'SET_COUPLE_POSE', pose: 'warm-hug' });
    state = gameReducer(state, {
      type: 'SAVE_PHOTO_MEMORY',
      pose: 'warm-hug',
      backdrop: 'river',
      caption: 'กอดอุ่นๆ ริมน้ำคืนเพ็ญ',
      timestamp: '2026-11-24T12:15:00.000Z',
    });
    expect(state.photoMemories).toHaveLength(1);

    // 08: Synchronized Pier Ceremony
    state = gameReducer(state, { type: 'TOGGLE_PIER_READY', playerId: 'p1' });
    state = gameReducer(state, { type: 'TOGGLE_PIER_READY', playerId: 'p2' });
    expect(state.pierCeremony).toEqual({ p1Ready: true, p2Ready: true });
    state = gameReducer(state, {
      type: 'RELEASE_KRATHONG',
      byPlayer: 'p2',
      timestamp: '2026-11-24T12:20:00.000Z',
    });
    expect(state.questStage).toBe('released');
    expect(state.pierCeremony).toEqual({ p1Ready: false, p2Ready: false });
    expect(countSharedMemories(state)).toBe(5);
  });
});
