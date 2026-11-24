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

describe('World map collision, pier joystick entry, and spot proximity', () => {
  it('spawns both players on walkable tiles', () => {
    expect(isPositionWalkable(SPAWN_POSITIONS.p1.x, SPAWN_POSITIONS.p1.y)).toBe(true);
    expect(isPositionWalkable(SPAWN_POSITIONS.p2.x, SPAWN_POSITIONS.p2.y)).toBe(true);
  });

  it('blocks walking directly into deep river outside the wooden pier, while allowing walking onto the pier', () => {
    expect(isPositionWalkable(400, RIVER_BANK_Y + 40)).toBe(false);

    const pierCenterX = PIER_WALKABLE_RECT.x + PIER_WALKABLE_RECT.w / 2;
    const pierInsideY = PIER_WALKABLE_RECT.y + 80;
    expect(isPositionWalkable(pierCenterX, pierInsideY)).toBe(true);

    // Sliding along river edge stops cleanly before entering water
    const blocked = resolveMovement(400, RIVER_BANK_Y - 22, 0, 30);
    expect(blocked.y).toBeLessThanOrEqual(RIVER_BANK_Y - 18);
  });

  it('allows continuous small joystick steps (<= 3.2px/frame) onto the pier including near pier edges', () => {
    // 1. Straight-down continuous joystick drag from central promenade onto pier-royal
    let x = 940;
    let y = 640;
    for (let frame = 0; frame < 60; frame += 1) {
      const step = resolveMovement(x, y, 0, 3.0);
      x = step.x;
      y = step.y;
    }
    expect(y).toBeGreaterThan(760);
    expect(findNearestSpot(x, y)?.id).toBe('pier-royal');

    // 2. Slightly off-center joystick drag near left pier edge funnels smoothly onto pier instead of snagging
    let edgeX = PIER_WALKABLE_RECT.x + 6;
    let edgeY = RIVER_BANK_Y - 19;
    for (let frame = 0; frame < 65; frame += 1) {
      const step = resolveMovement(edgeX, edgeY, 0.2, 3.1);
      edgeX = step.x;
      edgeY = step.y;
    }
    expect(edgeY).toBeGreaterThan(750);
    expect(findNearestSpot(edgeX, edgeY)?.id).toBe('pier-royal');
  });

  it('detects every world spot when player approaches within its interaction radius', () => {
    for (const spot of WORLD_SPOTS) {
      const found = findNearestSpot(spot.x, spot.y);
      expect(found?.id).toBe(spot.id);
    }
    expect(findNearestSpot(SPAWN_POSITIONS.p1.x, SPAWN_POSITIONS.p1.y)).toBeNull();
  });
});
