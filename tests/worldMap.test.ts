import { describe, expect, it } from 'vitest';
import {
  PIER_WALKABLE_RECT,
  RIVER_BANK_Y,
  SPAWN_POSITIONS,
  WORLD_SPOTS,
  findNearestSpot,
  isPositionWalkable,
  resolveMovement,
} from '../src/domain/worldMap';

describe('World map collision and spot proximity', () => {
  it('spawns both players on walkable tiles', () => {
    expect(isPositionWalkable(SPAWN_POSITIONS.p1.x, SPAWN_POSITIONS.p1.y)).toBe(true);
    expect(isPositionWalkable(SPAWN_POSITIONS.p2.x, SPAWN_POSITIONS.p2.y)).toBe(true);
  });

  it('blocks walking directly into deep river outside the wooden pier, while allowing walking onto the pier', () => {
    expect(isPositionWalkable(400, RIVER_BANK_Y + 40)).toBe(false);

    const pierCenterX = PIER_WALKABLE_RECT.x + PIER_WALKABLE_RECT.w / 2;
    const pierInsideY = PIER_WALKABLE_RECT.y + 60;
    expect(isPositionWalkable(pierCenterX, pierInsideY)).toBe(true);

    // Sliding along river edge stops cleanly before entering water
    const blocked = resolveMovement(400, RIVER_BANK_Y - 22, 0, 30);
    expect(blocked.y).toBeLessThanOrEqual(RIVER_BANK_Y - 18);
  });

  it('detects every world spot when player approaches within its interaction radius', () => {
    for (const spot of WORLD_SPOTS) {
      const found = findNearestSpot(spot.x, spot.y);
      expect(found?.id).toBe(spot.id);
    }
    expect(findNearestSpot(SPAWN_POSITIONS.p1.x, SPAWN_POSITIONS.p1.y)).toBeNull();
  });
});