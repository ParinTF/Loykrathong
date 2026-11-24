import type { Direction, PlayerId, Rect, WorldSpot } from './types';

export const WORLD_WIDTH = 1440;
export const WORLD_HEIGHT = 960;
export const PLAYER_RADIUS = 18;
export const RIVER_BANK_Y = 708;

export const SPAWN_POSITIONS: Record<PlayerId, { x: number; y: number; facing: Direction }> = {
  p1: { x: 690, y: 585, facing: 'up' },
  p2: { x: 750, y: 585, facing: 'up' },
};

export const PIER_WALKABLE_RECT: Rect = {
  x: 848,
  y: 648,
  w: 184,
  h: 196,
  label: 'ท่าน้ำแสงจันทร์ (สะพานไม้)',
};

export const SOLID_OBSTACLES: Rect[] = [
  // Bamboo lantern arch posts in Yi Peng courtyard
  { x: 164, y: 128, w: 36, h: 48, label: 'เสาซุ้มโคมซ้าย' },
  { x: 316, y: 128, w: 36, h: 48, label: 'เสาซุ้มโคมขวา' },
  // Market stalls
  { x: 904, y: 112, w: 152, h: 76, label: 'ร้านดอกไม้ป้าบัว' },
  { x: 1156, y: 148, w: 152, h: 76, label: 'ร้านเครื่องหอมลุงมั่น' },
  // Couple pavilion pillars (top edge, bottom remains open for entry)
  { x: 416, y: 424, w: 148, h: 48, label: 'หลังคาศาลาคู่รัก' },
  // Crafting pavilion table
  { x: 702, y: 392, w: 116, h: 52, label: 'โต๊ะประดิษฐ์กระทง' },
  // Scenic trees / planters
  { x: 96, y: 316, w: 68, h: 64, label: 'ต้นลีลาวดีฝั่งตะวันตก' },
  { x: 1296, y: 468, w: 68, h: 64, label: 'ต้นไทรริมคลอง' },
  // Lotus pond rim (non-walkable water feature in garden)
  { x: 120, y: 566, w: 124, h: 76, label: 'สระบัวหิ่งห้อย' },
];

export const WORLD_SPOTS: WorldSpot[] = [
  {
    id: 'npc-bua',
    kind: 'npc',
    title: 'ซุ้มใบตองป้าบัว',
    subtitle: 'รับใบตองสดและหยวกกล้วยสำหรับพับกลีบกระทง',
    zoneName: 'ตลาดริมคลอง',
    npcName: 'ป้าบัว',
    x: 980,
    y: 222,
    radius: 76,
    grantsMaterial: 'banana-leaf',
  },
  {
    id: 'gather-lotus',
    kind: 'gather',
    title: 'แปลงบัวริมตลิ่ง',
    subtitle: 'เก็บดอกบัวชมพูและกลีบดอกไม้คู่รัก',
    zoneName: 'สวนหิ่งห้อย',
    x: 242,
    y: 516,
    radius: 78,
    grantsMaterial: 'lotus-blossom',
  },
  {
    id: 'npc-man',
    kind: 'npc',
    title: 'ซุ้มเครื่องหอมลุงมั่น',
    subtitle: 'รับธูป เทียนหอม และสายสิญจน์มงคล',
    zoneName: 'ตลาดริมคลอง',
    npcName: 'ลุงมั่น',
    x: 1232,
    y: 256,
    radius: 76,
    grantsMaterial: 'candle-incense',
  },
  {
    id: 'lantern-1',
    kind: 'lantern',
    title: 'ซุ้มโคมยี่เป็งฝั่งเหนือ',
    subtitle: 'จุดโคมอธิษฐานดวงที่ 1 ใต้ซุ้มไผ่',
    zoneName: 'ลานโคมยี่เป็ง',
    x: 258,
    y: 218,
    radius: 74,
  },
  {
    id: 'lantern-2',
    kind: 'lantern',
    title: 'โคมคู่กลางลาน',
    subtitle: 'จุดโคมอธิษฐานดวงที่ 2 เคียงข้างกัน',
    zoneName: 'ลานโคมยี่เป็ง',
    x: 492,
    y: 186,
    radius: 74,
  },
  {
    id: 'lantern-3',
    kind: 'lantern',
    title: 'โคมริมทางเดินทอง',
    subtitle: 'จุดโคมอธิษฐานดวงที่ 3 ส่องทางสู่ท่าน้ำ',
    zoneName: 'ลานโคมยี่เป็ง',
    x: 682,
    y: 244,
    radius: 74,
  },
  {
    id: 'pavilion-blessing',
    kind: 'pavilion',
    title: 'ศาลาคู่รักแสงจันทร์',
    subtitle: 'พักชมหิ่งห้อยและบรรเลงระฆังแสงจันทร์รับคำอวยพรคู่กัน',
    zoneName: 'สวนหิ่งห้อย',
    x: 490,
    y: 514,
    radius: 80,
  },
  {
    id: 'craft-bench',
    kind: 'craft',
    title: 'โต๊ะประดิษฐ์กระทงคู่',
    subtitle: 'ประกอบกระทงจากวัสดุทั้ง 3 อย่างและเขียนคำอธิษฐาน',
    zoneName: 'ลานกลางงาน',
    x: 760,
    y: 472,
    radius: 78,
  },
  {
    id: 'pier-royal',
    kind: 'pier',
    title: 'ท่าน้ำแสงจันทร์',
    subtitle: 'ทำพิธีขอขมาพระแม่คงคาและปล่อยกระทงลงสู่สายน้ำ',
    zoneName: 'ริมแม่น้ำ',
    x: 940,
    y: 782,
    radius: 86,
  },
];

export const LANTERN_SPOTS = WORLD_SPOTS.filter((spot) => spot.kind === 'lantern');

export function circleIntersectsRect(
  cx: number,
  cy: number,
  radius: number,
  rect: Rect
): boolean {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}

export function isPointInsideRect(
  cx: number,
  cy: number,
  radius: number,
  rect: Rect
): boolean {
  return (
    cx - radius >= rect.x &&
    cx + radius <= rect.x + rect.w &&
    cy - radius >= rect.y &&
    cy + radius <= rect.y + rect.h
  );
}

export function isPositionWalkable(
  x: number,
  y: number,
  radius: number = PLAYER_RADIUS
): boolean {
  const minX = 32 + radius;
  const maxX = WORLD_WIDTH - 32 - radius;
  const minY = 56 + radius;
  const maxY = PIER_WALKABLE_RECT.y + PIER_WALKABLE_RECT.h - radius;

  if (x < minX || x > maxX || y < minY || y > maxY) {
    return false;
  }

  // Deep water guard outside the wooden pier.
  // Do NOT enforce a top-edge y>=pier.y barrier here, otherwise small continuous
  // joystick steps (e.g. 3.2px/frame) hit a 4px dead-zone at the bank-to-pier threshold!
  if (y + radius > RIVER_BANK_Y) {
    const insidePierSpan =
      x - radius >= PIER_WALKABLE_RECT.x &&
      x + radius <= PIER_WALKABLE_RECT.x + PIER_WALKABLE_RECT.w &&
      y + radius <= PIER_WALKABLE_RECT.y + PIER_WALKABLE_RECT.h;
    if (!insidePierSpan) {
      return false;
    }
  }

  for (const rect of SOLID_OBSTACLES) {
    if (circleIntersectsRect(x, y, radius, rect)) {
      return false;
    }
  }

  return true;
}

export function resolveMovement(
  fromX: number,
  fromY: number,
  dx: number,
  dy: number,
  radius: number = PLAYER_RADIUS
): { x: number; y: number; moved: boolean } {
  if (dx === 0 && dy === 0) {
    return { x: fromX, y: fromY, moved: false };
  }

  const targetX = fromX + dx;
  const targetY = fromY + dy;

  if (isPositionWalkable(targetX, targetY, radius)) {
    return { x: targetX, y: targetY, moved: true };
  }

  // Smooth pier entrance funneling: when dragging a joystick downward near the
  // pier approach, gently guide the character inward between the wooden railings
  // instead of catching on the left/right riverbank corner.
  if (
    dy > 0 &&
    fromY + radius >= RIVER_BANK_Y - 12 &&
    fromX >= PIER_WALKABLE_RECT.x - 24 &&
    fromX <= PIER_WALKABLE_RECT.x + PIER_WALKABLE_RECT.w + 24
  ) {
    const minPierX = PIER_WALKABLE_RECT.x + radius;
    const maxPierX = PIER_WALKABLE_RECT.x + PIER_WALKABLE_RECT.w - radius;
    const stepMag = Math.max(2.4, Math.hypot(dx, dy));
    let guidedX = fromX;
    if (fromX < minPierX) {
      guidedX = Math.min(minPierX, fromX + stepMag);
    } else if (fromX > maxPierX) {
      guidedX = Math.max(maxPierX, fromX - stepMag);
    }
    if (isPositionWalkable(guidedX, targetY, radius)) {
      return { x: guidedX, y: targetY, moved: true };
    }
    if (guidedX !== fromX && isPositionWalkable(guidedX, fromY, radius)) {
      return { x: guidedX, y: fromY, moved: true };
    }
  }

  // Axis slide so character moves smoothly along obstacles or river bank
  if (dx !== 0 && isPositionWalkable(targetX, fromY, radius)) {
    return { x: targetX, y: fromY, moved: true };
  }

  if (dy !== 0 && isPositionWalkable(fromX, targetY, radius)) {
    return { x: fromX, y: targetY, moved: true };
  }

  return { x: fromX, y: fromY, moved: false };
}

export function findNearestSpot(x: number, y: number): WorldSpot | null {
  let nearest: WorldSpot | null = null;
  let nearestDistSq = Number.POSITIVE_INFINITY;

  for (const spot of WORLD_SPOTS) {
    const dx = x - spot.x;
    const dy = y - spot.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= spot.radius * spot.radius && distSq < nearestDistSq) {
      nearest = spot;
      nearestDistSq = distSq;
    }
  }

  return nearest;
}

export function getSpotById(spotId: string | null): WorldSpot | null {
  if (!spotId) return null;
  if (spotId === 'pavilion-couple') {
    return WORLD_SPOTS.find((s) => s.id === 'pavilion-blessing') ?? null;
  }
  return WORLD_SPOTS.find((s) => s.id === spotId) ?? null;
}