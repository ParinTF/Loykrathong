export const LEAF_SHAPES_ORDER = ['swan', 'lotus', 'garuda'];

export const BOAT_LOTUS_TARGETS = [
  { id: 'lotus-1', x: 24, y: 28, label: 'บัวชมพูใต้แสงดาว' },
  { id: 'lotus-2', x: 52, y: 20, label: 'บัวหลวงกลางสระ' },
  { id: 'lotus-3', x: 78, y: 34, label: 'บัวกลีบแก้วริมฝั่ง' },
  { id: 'lotus-4', x: 66, y: 72, label: 'บัวหิ่งห้อยคู่รัก' },
  { id: 'lotus-5', x: 28, y: 74, label: 'บัวจันทร์เพ็ญ' },
];

export const LANTERN_HEAT = { p1: [43, 54], p2: [61, 72] };
export const LANTERN_HOLD_MS = 1800;
export const LANTERN_COUNTDOWN_MS = 3000;

const CUT = {
  swan: [
    [[.15, .77], [.27, .59], [.43, .47]],
    [[.43, .47], [.57, .32], [.75, .26]],
    [[.75, .26], [.84, .45], [.70, .66]],
  ],
  lotus: [
    [[.22, .72], [.31, .49], [.50, .25]],
    [[.50, .25], [.70, .50], [.80, .71]],
    [[.80, .71], [.52, .83], [.22, .72]],
  ],
  garuda: [
    [[.17, .75], [.30, .53], [.45, .61]],
    [[.45, .61], [.56, .20], [.68, .48]],
    [[.68, .48], [.83, .46], [.73, .78]],
  ],
};

const FOLD = [
  [[.24, .74], [.37, .66], [.52, .52]],
  [[.77, .71], [.65, .63], [.48, .51]],
  [[.49, .80], [.48, .64], [.52, .41]],
];

export function leafTrack(shape, phase, step) {
  return (phase === 'cut' ? CUT[shape] : phase === 'fold' ? FOLD : null)?.[step] ?? null;
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const partnerOf = (role) => role === 'p1' ? 'p2' : 'p1';

function distanceFromSegment(point, start, end) {
  const x = end[0] - start[0];
  const y = end[1] - start[1];
  const along = clamp(((point[0] - start[0]) * x + (point[1] - start[1]) * y) / (x * x + y * y), 0, 1);
  return Math.hypot(point[0] - start[0] - along * x, point[1] - start[1] - along * y);
}

export function isLeafTraceValid(track, points) {
  if (!track || !Array.isArray(points) || points.length < 3 || points.length > 90) return false;
  const radius = 0.081;
  let passedGuide = false;
  for (const point of points) {
    if (!Array.isArray(point) || point.length !== 2 ||
      !point.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) return false;
    if (Math.min(distanceFromSegment(point, track[0], track[1]),
      distanceFromSegment(point, track[1], track[2])) > radius) return false;
    if (distance(point, track[1]) <= radius) passedGuide = true;
  }
  return passedGuide && distance(points[0], track[0]) <= radius && distance(points.at(-1), track[2]) <= radius;
}

export function canReachLotus(boat, flower) {
  const dx = flower.x - boat.boatX;
  const dy = flower.y - boat.boatY;
  const angle = boat.boatAngle * Math.PI / 180;
  const ahead = dx * Math.cos(angle) + dy * Math.sin(angle);
  const alongside = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
  return Math.abs(ahead) <= 5 && alongside >= 2.5 && Math.hypot(dx, dy) <= 10;
}

export function isLanternHeatReady(role, heat) {
  const range = LANTERN_HEAT[role];
  return Boolean(range && Number.isFinite(heat) && heat >= range[0] && heat <= range[1]);
}

export function applyActivitySkill(state, author, command, now) {
  if (!command || (author !== 'p1' && author !== 'p2')) return state;
  const boat = state.lotusBoat;
  const leaf = state.leafRelay;
  const lantern = state.skyLantern;

  switch (command.type) {
    case 'boat-aim':
    case 'boat-stroke': {
      if (author !== boat.rower || !Number.isFinite(command.angle)) return state;
      const angle = ((command.angle % 360) + 360) % 360;
      if (command.type === 'boat-aim') {
        return { ...state, lotusBoat: { ...boat, boatAngle: angle } };
      }
      const rad = angle * Math.PI / 180;
      return { ...state, lotusBoat: {
        ...boat, boatAngle: angle,
        boatX: clamp(boat.boatX + Math.cos(rad) * 7, 8, 92),
        boatY: clamp(boat.boatY + Math.sin(rad) * 7, 14, 86),
      } };
    }
    case 'boat-swap':
      if (author !== boat.rower) return state;
      return { ...state, lotusBoat: { ...boat, rower: partnerOf(author) }, lastEventLog: 'ส่งไม้พายให้อีกคนแล้ว' };
    case 'boat-pick': {
      if (author === boat.rower || boat.collectedIds.includes(command.id)) return state;
      const flower = BOAT_LOTUS_TARGETS.find(({ id }) => command.id === id);
      if (!flower || !canReachLotus(boat, flower)) return state;
      const collectedIds = [...boat.collectedIds, flower.id];
      const completed = BOAT_LOTUS_TARGETS.every(({ id }) => collectedIds.includes(id));
      return { ...state, lotusBoat: { ...boat, collectedIds, completed },
        inventory: completed ? { ...state.inventory, 'lotus-blossom': true } : state.inventory,
        lastEventLog: completed ? 'พายเรือเก็บบัวครบทั้งสระแล้ว' : 'เก็บ' + flower.label + 'ขึ้นเรือแล้ว',
      };
    }
    case 'leaf-swap':
      if (author !== leaf.cutter || leaf.cutStep !== 0 || leaf.passedLeafReady || leaf.completed) return state;
      return { ...state, leafRelay: { ...leaf, cutter: partnerOf(author) }, lastEventLog: 'ส่งหน้าที่เจียนใบตองให้อีกคนแล้ว' };
    case 'leaf-trace': {
      if (leaf.completed || command.shape !== leaf.currentShape) return state;
      const cutting = !leaf.passedLeafReady;
      const phase = cutting ? 'cut' : 'fold';
      const step = cutting ? leaf.cutStep : leaf.foldStep;
      if (command.phase !== phase || command.step !== step ||
        author !== (cutting ? leaf.cutter : partnerOf(leaf.cutter)) ||
        !isLeafTraceValid(leafTrack(leaf.currentShape, phase, step), command.points)) return state;

      if (cutting) {
        const cutStep = step + 1;
        return { ...state, leafRelay: { ...leaf, cutStep, passedLeafReady: cutStep === 3 },
          lastEventLog: cutStep === 3 ? 'เจียนใบตองเสร็จแล้ว ส่งให้คู่รักพับกลีบต่อ' : state.lastEventLog };
      }
      if (step < 2) return { ...state, leafRelay: { ...leaf, foldStep: step + 1 } };
      const finishedPetals = [...new Set([...leaf.finishedPetals, leaf.currentShape])];
      const nextShape = LEAF_SHAPES_ORDER.find((shape) => !finishedPetals.includes(shape));
      const completed = !nextShape;
      return { ...state,
        leafRelay: { ...leaf, currentShape: nextShape ?? leaf.currentShape, cutStep: 0, foldStep: 0,
          passedLeafReady: false, finishedPetals, completed },
        inventory: completed ? { ...state.inventory, 'banana-leaf': true } : state.inventory,
        lastEventLog: completed ? 'พับกลีบใบตองครบทั้งสามทรงแล้ว' : 'ได้กลีบอีกหนึ่งทรง เตรียมทำกลีบถัดไปด้วยกัน',
      };
    }
    case 'lantern-grip': {
      if (lantern.released || lantern.p1Lit && lantern.p2Lit || typeof command.held !== 'boolean') return state;
      const field = author === 'p1' ? 'p1Grip' : 'p2Grip';
      const wish = author === 'p1' ? lantern.p1Wish : lantern.p2Wish;
      if (command.held && (!wish.trim() || !isLanternHeatReady(author, command.heat))) return state;
      if (Boolean(lantern[field]) === command.held) return state;
      const next = { ...lantern, [field]: command.held };
      next.warmUntil = next.p1Grip && next.p2Grip ? now + LANTERN_HOLD_MS : null;
      return { ...state, skyLantern: next };
    }
    case 'lantern-ready': {
      if (lantern.released || !lantern.p1Lit || !lantern.p2Lit ||
        !lantern.p1Wish.trim() || !lantern.p2Wish.trim()) return state;
      const field = author === 'p1' ? 'p1ReadyRelease' : 'p2ReadyRelease';
      if (lantern[field]) return state;
      const next = { ...lantern, [field]: true };
      next.liftAt = next.p1ReadyRelease && next.p2ReadyRelease ? now + LANTERN_COUNTDOWN_MS : null;
      return { ...state, skyLantern: next };
    }
    default:
      return state;
  }
}

export function advanceLanternClock(state, now) {
  const lantern = state.skyLantern;
  if (lantern.released) return state;
  if (lantern.warmUntil != null && now >= lantern.warmUntil && lantern.p1Grip && lantern.p2Grip) {
    return { ...state, skyLantern: { ...lantern, p1Lit: true, p2Lit: true, p1Grip: false, p2Grip: false, warmUntil: null },
      lastEventLog: 'ทั้งคู่ประคองไฟสำเร็จ โคมพร้อมปล่อยแล้ว' };
  }
  if (lantern.liftAt != null && now >= lantern.liftAt && lantern.p1ReadyRelease && lantern.p2ReadyRelease) {
    return { ...state, skyLantern: { ...lantern, released: true, releasedAt: new Date(lantern.liftAt).toISOString(), liftAt: null },
      lastEventLog: 'โคมคำอธิษฐานของทั้งสองคนลอยขึ้นฟ้าแล้ว' };
  }
  return state;
}

export function pauseLantern(state) {
  const lantern = state.skyLantern;
  if (lantern.released || !(lantern.p1Grip || lantern.p2Grip || lantern.p1ReadyRelease || lantern.p2ReadyRelease)) return state;
  return { ...state, skyLantern: { ...lantern, p1Grip: false, p2Grip: false, warmUntil: null,
    p1ReadyRelease: false, p2ReadyRelease: false, liftAt: null } };
}
