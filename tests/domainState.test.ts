import { describe, expect, it } from 'vitest';
import {
  BOAT_LOTUS_TARGETS,
  countSharedMemories,
  createInitialGameState,
  gameReducer,
} from '../src/domain/reducer';

describe('DomainState romantic co-op activities (zero scores, zero timers, zero forced gates)', () => {
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

  it('supports Activity 01 (boat lotus gathering with role swap) and Activity 02 (leaf cut -> live pass -> fold relay)', () => {
    let state = createInitialGameState();
    state = gameReducer(state, { type: 'ENTER_WORLD' });

    // 01: Swap rower from p1 to p2 and pick all 5 lotuses
    state = gameReducer(state, {
      type: 'UPDATE_LOTUS_BOAT',
      patch: { rower: 'p2', boatX: 30, boatY: 32 },
    });
    expect(state.lotusBoat.rower).toBe('p2');

    for (const target of BOAT_LOTUS_TARGETS) {
      state = gameReducer(state, {
        type: 'PICK_BOAT_LOTUS',
        lotusId: target.id,
        byPlayer: 'p1',
      });
    }
    expect(state.lotusBoat.completed).toBe(true);
    expect(state.inventory['lotus-blossom']).toBe(true);

    // 02: Cut 3 times -> passes leaf to folder -> fold 3 times across 3 petal shapes
    for (let petal = 0; petal < 3; petal += 1) {
      expect(state.leafRelay.passedLeafReady).toBe(false);
      state = gameReducer(state, { type: 'ADVANCE_LEAF_CUT', byPlayer: 'p1' });
      state = gameReducer(state, { type: 'ADVANCE_LEAF_CUT', byPlayer: 'p1' });
      state = gameReducer(state, { type: 'ADVANCE_LEAF_CUT', byPlayer: 'p1' });
      expect(state.leafRelay.passedLeafReady).toBe(true);

      state = gameReducer(state, { type: 'ADVANCE_LEAF_FOLD', byPlayer: 'p2' });
      state = gameReducer(state, { type: 'ADVANCE_LEAF_FOLD', byPlayer: 'p2' });
      state = gameReducer(state, { type: 'ADVANCE_LEAF_FOLD', byPlayer: 'p2' });
      expect(state.leafRelay.passedLeafReady).toBe(false);
    }

    expect(state.leafRelay.finishedPetals).toEqual(['swan', 'lotus', 'garuda']);
    expect(state.leafRelay.completed).toBe(true);
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

    // 04: Single meaningful Sky Lantern
    state = gameReducer(state, {
      type: 'SET_LANTERN_WISH',
      playerId: 'p1',
      wish: 'ขอให้มีรอยยิ้มทุกวัน',
    });
    state = gameReducer(state, { type: 'LIGHT_LANTERN_SIDE', playerId: 'p1' });
    state = gameReducer(state, { type: 'LIGHT_LANTERN_SIDE', playerId: 'p2' });
    state = gameReducer(state, { type: 'READY_RELEASE_LANTERN', playerId: 'p1' });
    state = gameReducer(state, { type: 'READY_RELEASE_LANTERN', playerId: 'p2' });
    state = gameReducer(state, {
      type: 'COMPLETE_LANTERN_RELEASE',
      timestamp: '2026-11-24T12:10:00.000Z',
    });
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
