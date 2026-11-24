import {
  areAllMinigamesPassed,
  computeKrathongQuality,
  createInitialMinigames,
} from './minigames';
import type {
  Direction,
  GameAction,
  GameState,
  KrathongDesign,
  MaterialId,
  MinigameId,
  PlayerId,
  PlayerPortrait,
  PlayerProfile,
  SharedRoomQuestState,
} from './types';
import {
  LANTERN_SPOTS,
  PLAYER_RADIUS,
  SPAWN_POSITIONS,
  findNearestSpot,
  isPositionWalkable,
  resolveMovement,
} from './worldMap';

export const MATERIAL_LABELS: Record<MaterialId, { name: string; hint: string }> = {
  'banana-leaf': {
    name: 'ใบตองและหยวกกล้วย',
    hint: 'คุยกับป้าบัวที่ตลาดริมคลอง',
  },
  'lotus-blossom': {
    name: 'ดอกบัวชมพูคู่รัก',
    hint: 'เก็บที่แปลงบัวสวนหิ่งห้อย',
  },
  'candle-incense': {
    name: 'ธูปเทียนมงคล',
    hint: 'คุยกับลุงมั่นที่ร้านเครื่องหอม',
  },
};

export const MINIGAME_TITLES: Record<MinigameId, string> = {
  recipe: 'ด่าน 1: ช้อนคัดยอดวัสดุสายน้ำ',
  assembly: 'ด่าน 2: วางชั้นกระทงตรงแกนทอง',
  rhythm: 'ด่าน 3: ประดับแสงเทียนตามจังหวะ',
};

export function createEmptyPortrait(): PlayerPortrait {
  return {
    status: 'absent',
    dataUrl: null,
    mimeType: null,
    error: null,
    updatedAt: null,
  };
}

export function createDefaultKrathongDesign(): KrathongDesign {
  return {
    base: 'classic-banana',
    flower: 'pink-lotus',
    glow: 'amber-candle',
    wishText: 'ขอให้เราสองคนเดินเคียงข้างกันอย่างอบอุ่นในทุกเทศกาล',
  };
}

export function createDefaultPlayers(): Record<PlayerId, PlayerProfile> {
  return {
    p1: {
      id: 'p1',
      name: 'ฟ้าใส',
      customization: {
        skinTone: 'warm-ivory',
        hairStyle: 'long-silky',
        hairColor: 'obsidian',
        outfit: 'silk-lotus',
      },
      portrait: createEmptyPortrait(),
      position: { ...SPAWN_POSITIONS.p1 },
    },
    p2: {
      id: 'p2',
      name: 'ต้นกล้า',
      customization: {
        skinTone: 'golden-tan',
        hairStyle: 'short-classic',
        hairColor: 'espresso',
        outfit: 'chut-thai-gold',
      },
      portrait: createEmptyPortrait(),
      position: { ...SPAWN_POSITIONS.p2 },
    },
  };
}

export function createInitialGameState(): GameState {
  return {
    schemaVersion: 1,
    screen: 'setup',
    players: createDefaultPlayers(),
    settings: {
      activePlayer: 'p1',
      followPartner: true,
      reducedMotionOverride: 'system',
      soundEnabled: true,
    },
    inventory: {
      'banana-leaf': false,
      'lotus-blossom': false,
      'candle-incense': false,
    },
    litLanternIds: [],
    pavilionBlessed: false,
    contributedBy: { p1: 0, p2: 0 },
    questStage: 'explore',
    minigames: createInitialMinigames(),
    krathongCrafted: false,
    coopTasks: {},
    krathongDesign: createDefaultKrathongDesign(),
    releasedKrathongs: [],
    nearbySpotId: null,
    lastEventLog: 'ยินดีต้อนรับสู่คืนเพ็ญริมน้ำ ปรับแต่งตัวละครคู่รักแล้วออกสำรวจงานกันเลย',
  };
}

export function extractSharedQuestState(state: GameState): SharedRoomQuestState {
  return {
    inventory: state.inventory,
    litLanternIds: state.litLanternIds,
    pavilionBlessed: state.pavilionBlessed,
    contributedBy: state.contributedBy,
    questStage: state.questStage,
    minigames: state.minigames,
    krathongCrafted: state.krathongCrafted,
    coopTasks: state.coopTasks,
    krathongDesign: state.krathongDesign,
    releasedKrathongs: state.releasedKrathongs,
    lastEventLog: state.lastEventLog,
  };
}

export function countCollectedMaterials(
  inventory: Record<MaterialId, boolean>
): number {
  return Object.values(inventory).filter(Boolean).length;
}

export function hasAllMaterials(inventory: Record<MaterialId, boolean>): boolean {
  return countCollectedMaterials(inventory) === 3;
}

export function canCraftKrathong(state: GameState): boolean {
  return hasAllMaterials(state.inventory) && areAllMinigamesPassed(state.minigames);
}

export function canReleaseKrathong(state: GameState): boolean {
  return (
    state.krathongCrafted &&
    hasAllMaterials(state.inventory) &&
    areAllMinigamesPassed(state.minigames)
  );
}

export function getCoupleProgressPercent(state: GameState): number {
  const matCount = countCollectedMaterials(state.inventory);
  let score = matCount * 15; // 0..45
  if (state.minigames.recipe.status === 'passed') score += 10;
  if (state.minigames.assembly.status === 'passed') score += 10;
  if (state.minigames.rhythm.status === 'passed') score += 10;
  if (state.krathongCrafted) score += 10; // 85
  if (state.releasedKrathongs.length > 0) score += 15; // 100
  return Math.min(100, score);
}

export function deriveDirection(dx: number, dy: number, fallback: Direction): Direction {
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'down' : 'up';
}

function partnerFollowStep(
  leader: PlayerProfile,
  partner: PlayerProfile
): PlayerProfile {
  const offsetByFacing: Record<Direction, { ox: number; oy: number }> = {
    up: { ox: 44, oy: 18 },
    down: { ox: -44, oy: -18 },
    left: { ox: 42, oy: 12 },
    right: { ox: -42, oy: 12 },
  };
  const offset = offsetByFacing[leader.position.facing];
  const targetX = leader.position.x + offset.ox;
  const targetY = leader.position.y + offset.oy;

  const dx = targetX - partner.position.x;
  const dy = targetY - partner.position.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 10) {
    return partner;
  }

  const maxStep = Math.min(dist, 5.2);
  const stepX = (dx / dist) * maxStep;
  const stepY = (dy / dist) * maxStep;
  const moved = resolveMovement(
    partner.position.x,
    partner.position.y,
    stepX,
    stepY,
    PLAYER_RADIUS
  );

  if (!moved.moved) {
    const directDx = leader.position.x - partner.position.x;
    const directDy = leader.position.y - partner.position.y;
    const directDist = Math.hypot(directDx, directDy);
    if (directDist > 52) {
      const alt = resolveMovement(
        partner.position.x,
        partner.position.y,
        (directDx / directDist) * maxStep,
        (directDy / directDist) * maxStep,
        PLAYER_RADIUS
      );
      return {
        ...partner,
        position: {
          x: alt.x,
          y: alt.y,
          facing: deriveDirection(directDx, directDy, leader.position.facing),
        },
      };
    }
    return partner;
  }

  return {
    ...partner,
    position: {
      x: moved.x,
      y: moved.y,
      facing: deriveDirection(dx, dy, leader.position.facing),
    },
  };
}

export function sanitizePlayerName(raw: string, fallback: string): string {
  const trimmed = raw.trim().slice(0, 24);
  return trimmed.length > 0 ? trimmed : fallback;
}

function computeActiveNearbySpotId(
  players: Record<PlayerId, PlayerProfile>,
  activePlayer: PlayerId
): string | null {
  const activePos = players[activePlayer].position;
  return findNearestSpot(activePos.x, activePos.y)?.id ?? null;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'HYDRATE_STATE': {
      const p1Pos = isPositionWalkable(
        action.payload.players.p1.position.x,
        action.payload.players.p1.position.y
      )
        ? action.payload.players.p1.position
        : { ...SPAWN_POSITIONS.p1 };
      const p2Pos = isPositionWalkable(
        action.payload.players.p2.position.x,
        action.payload.players.p2.position.y
      )
        ? action.payload.players.p2.position
        : { ...SPAWN_POSITIONS.p2 };

      const hydratedPlayers: Record<PlayerId, PlayerProfile> = {
        p1: { ...action.payload.players.p1, position: p1Pos },
        p2: { ...action.payload.players.p2, position: p2Pos },
      };

      return {
        ...action.payload,
        players: hydratedPlayers,
        nearbySpotId: computeActiveNearbySpotId(
          hydratedPlayers,
          action.payload.settings.activePlayer
        ),
      };
    }

    case 'ENTER_WORLD': {
      const p1Name = sanitizePlayerName(state.players.p1.name, 'ฟ้าใส');
      const p2Name = sanitizePlayerName(state.players.p2.name, 'ต้นกล้า');
      const nextPlayers: Record<PlayerId, PlayerProfile> = {
        p1: { ...state.players.p1, name: p1Name },
        p2: { ...state.players.p2, name: p2Name },
      };
      return {
        ...state,
        screen: 'world',
        players: nextPlayers,
        nearbySpotId: computeActiveNearbySpotId(
          nextPlayers,
          state.settings.activePlayer
        ),
        lastEventLog: `${p1Name} และ ${p2Name} เดินเข้าสู่งานลอยกระทงริมน้ำแล้ว`,
      };
    }

    case 'OPEN_SETUP':
      return {
        ...state,
        screen: 'setup',
      };

    case 'UPDATE_PLAYER_NAME': {
      const nextName = action.name.slice(0, 24);
      const target = state.players[action.playerId];
      return {
        ...state,
        players: {
          ...state.players,
          [action.playerId]: {
            ...target,
            name: nextName,
          },
        },
      };
    }

    case 'UPDATE_PLAYER_CUSTOMIZATION': {
      const target = state.players[action.playerId];
      return {
        ...state,
        players: {
          ...state.players,
          [action.playerId]: {
            ...target,
            customization: {
              ...target.customization,
              ...action.patch,
            },
          },
        },
      };
    }

    case 'SET_PLAYER_PORTRAIT': {
      const target = state.players[action.playerId];
      return {
        ...state,
        players: {
          ...state.players,
          [action.playerId]: {
            ...target,
            portrait: action.portrait,
          },
        },
      };
    }

    case 'CLEAR_PLAYER_PORTRAIT': {
      const target = state.players[action.playerId];
      return {
        ...state,
        players: {
          ...state.players,
          [action.playerId]: {
            ...target,
            portrait: createEmptyPortrait(),
          },
        },
      };
    }

    case 'SET_ACTIVE_PLAYER':
      return {
        ...state,
        settings: {
          ...state.settings,
          activePlayer: action.playerId,
        },
        nearbySpotId: computeActiveNearbySpotId(state.players, action.playerId),
      };

    case 'TOGGLE_FOLLOW_PARTNER':
      return {
        ...state,
        settings: {
          ...state.settings,
          followPartner: !state.settings.followPartner,
        },
        nearbySpotId: computeActiveNearbySpotId(
          state.players,
          state.settings.activePlayer
        ),
        lastEventLog: !state.settings.followPartner
          ? 'เปิดโหมดเดินคู่กัน: อีกฝ่ายจะเดินเคียงข้างอัตโนมัติ'
          : 'เปิดโหมดแยกเดินอิสระ',
      };

    case 'SET_FOLLOW_PARTNER':
      if (state.settings.followPartner === action.enabled) return state;
      return {
        ...state,
        settings: {
          ...state.settings,
          followPartner: action.enabled,
        },
      };

    case 'SET_REDUCED_MOTION':
      return {
        ...state,
        settings: {
          ...state.settings,
          reducedMotionOverride: action.mode,
        },
      };

    case 'TOGGLE_SOUND':
      return {
        ...state,
        settings: {
          ...state.settings,
          soundEnabled: !state.settings.soundEnabled,
        },
      };

    case 'MOVE_PLAYER': {
      const mover = state.players[action.playerId];
      const moved = resolveMovement(
        mover.position.x,
        mover.position.y,
        action.dx,
        action.dy,
        PLAYER_RADIUS
      );
      const facing =
        action.facing ?? deriveDirection(action.dx, action.dy, mover.position.facing);

      const updatedMover: PlayerProfile = {
        ...mover,
        position: {
          x: moved.x,
          y: moved.y,
          facing,
        },
      };

      const partnerId: PlayerId = action.playerId === 'p1' ? 'p2' : 'p1';
      let updatedPartner = state.players[partnerId];
      if (state.settings.followPartner && action.playerId === state.settings.activePlayer) {
        updatedPartner = partnerFollowStep(updatedMover, updatedPartner);
      }

      const activePlayerProfile =
        state.settings.activePlayer === action.playerId ? updatedMover : updatedPartner;
      const nearby = findNearestSpot(
        activePlayerProfile.position.x,
        activePlayerProfile.position.y
      );

      return {
        ...state,
        players: {
          ...state.players,
          [action.playerId]: updatedMover,
          [partnerId]: updatedPartner,
        },
        nearbySpotId: nearby?.id ?? null,
      };
    }

    case 'SET_NEARBY_SPOT':
      if (state.nearbySpotId === action.spotId) return state;
      return {
        ...state,
        nearbySpotId: action.spotId,
      };

    case 'RECORD_COOP_HALF': {
      const prev = state.coopTasks[action.taskKey] ?? {
        p1Done: false,
        p2Done: false,
        p1Score: 0,
        p2Score: 0,
        updatedAt: null,
      };
      const clamped = Math.max(0, Math.min(50, Math.round(action.halfScore)));
      const nextEntry =
        action.playerId === 'p1'
          ? {
              ...prev,
              p1Done: true,
              p1Score: Math.max(prev.p1Score, clamped),
              updatedAt: new Date().toISOString(),
            }
          : {
              ...prev,
              p2Done: true,
              p2Score: Math.max(prev.p2Score, clamped),
              updatedAt: new Date().toISOString(),
            };
      const actorName = sanitizePlayerName(
        state.players[action.playerId].name,
        action.playerId === 'p1' ? 'ผู้เล่น 1' : 'ผู้เล่น 2'
      );
      const bothDone = nextEntry.p1Done && nextEntry.p2Done;
      return {
        ...state,
        coopTasks: {
          ...state.coopTasks,
          [action.taskKey]: nextEntry,
        },
        lastEventLog: bothDone
          ? `ทั้งคู่ช่วยกันผ่านภารกิจคู่รักสำเร็จแล้ว! กดรับรางวัลด้วยกันได้เลย`
          : `${actorName} ทำส่วนของตัวเองสำเร็จแล้ว! รอคู่รักอีกฝ่ายมาช่วยต่อให้ครบ`,
      };
    }

    case 'RESET_COOP_TASK': {
      if (!state.coopTasks[action.taskKey]) return state;
      const nextCoop = { ...state.coopTasks };
      delete nextCoop[action.taskKey];
      return {
        ...state,
        coopTasks: nextCoop,
      };
    }

    case 'COLLECT_MATERIAL': {
      const alreadyHas = state.inventory[action.material];
      const nextInventory = {
        ...state.inventory,
        [action.material]: true,
      };
      const nextQuestStage =
        state.questStage === 'explore' && hasAllMaterials(nextInventory)
          ? 'craft'
          : state.questStage;
      const label = MATERIAL_LABELS[action.material].name;
      const actorName = sanitizePlayerName(
        state.players[action.byPlayer].name,
        action.byPlayer === 'p1' ? 'ผู้เล่น 1' : 'ผู้เล่น 2'
      );

      return {
        ...state,
        inventory: nextInventory,
        questStage: nextQuestStage,
        contributedBy: alreadyHas
          ? state.contributedBy
          : {
              ...state.contributedBy,
              [action.byPlayer]: state.contributedBy[action.byPlayer] + 1,
            },
        lastEventLog:
          action.message ??
          (alreadyHas
            ? `${actorName} ตรวจเช็ก${label}ที่มีอยู่แล้ว`
            : hasAllMaterials(nextInventory)
              ? `${actorName} เก็บ${label}ครบทั้ง 3 อย่างแล้ว! ไปที่โต๊ะประดิษฐ์กระทงเพื่อเล่น 3 ด่านประดิษฐ์กันเถอะ`
              : `${actorName} เก็บ${label}เรียบร้อย (${countCollectedMaterials(nextInventory)}/3)`),
      };
    }

    case 'LIGHT_LANTERN': {
      if (state.litLanternIds.includes(action.lanternId)) {
        return {
          ...state,
          lastEventLog: 'โคมดวงนี้ส่องสว่างอบอุ่นอยู่แล้ว',
        };
      }
      const nextLit = [...state.litLanternIds, action.lanternId];
      const actorName = sanitizePlayerName(
        state.players[action.byPlayer].name,
        action.byPlayer === 'p1' ? 'ผู้เล่น 1' : 'ผู้เล่น 2'
      );
      return {
        ...state,
        litLanternIds: nextLit,
        contributedBy: {
          ...state.contributedBy,
          [action.byPlayer]: state.contributedBy[action.byPlayer] + 1,
        },
        lastEventLog: `${actorName} จุดโคมยี่เป็งส่องแสงแล้ว (${nextLit.length}/${LANTERN_SPOTS.length} ดวง)`,
      };
    }

    case 'BLESS_PAVILION': {
      const p1Name = sanitizePlayerName(state.players.p1.name, 'ฟ้าใส');
      const p2Name = sanitizePlayerName(state.players.p2.name, 'ต้นกล้า');
      return {
        ...state,
        pavilionBlessed: true,
        contributedBy: state.pavilionBlessed
          ? state.contributedBy
          : {
              ...state.contributedBy,
              [action.byPlayer]: state.contributedBy[action.byPlayer] + 1,
            },
        lastEventLog: `${p1Name} และ ${p2Name} อธิษฐานรับแสงจันทร์ร่วมกันที่ศาลาคู่รัก`,
      };
    }

    case 'COMPLETE_MINIGAME': {
      const prev = state.minigames[action.gameId];
      const clampedScore = Math.max(0, Math.min(100, Math.round(action.score)));
      const nextRecord = {
        status: action.passed ? ('passed' as const) : ('failed' as const),
        score: action.passed ? Math.max(prev.score, clampedScore) : clampedScore,
        attempts: prev.attempts + 1,
      };
      const nextMinigames = {
        ...state.minigames,
        [action.gameId]: nextRecord,
      };
      const title = MINIGAME_TITLES[action.gameId];
      return {
        ...state,
        minigames: nextMinigames,
        contributedBy: action.passed
          ? {
              ...state.contributedBy,
              [action.byPlayer]: state.contributedBy[action.byPlayer] + 1,
            }
          : state.contributedBy,
        lastEventLog: action.passed
          ? `ผ่าน${title} (${clampedScore} คะแนน)!`
          : `ยังไม่ผ่าน${title} สามารถกดเล่นซ้ำได้ทันที`,
      };
    }

    case 'RESET_MINIGAME': {
      const prev = state.minigames[action.gameId];
      return {
        ...state,
        minigames: {
          ...state.minigames,
          [action.gameId]: {
            status: 'pending',
            score: 0,
            attempts: prev.attempts,
          },
        },
      };
    }

    case 'UPDATE_KRATHONG_DESIGN':
      return {
        ...state,
        krathongDesign: {
          ...state.krathongDesign,
          ...action.patch,
        },
      };

    case 'CRAFT_KRATHONG': {
      if (!hasAllMaterials(state.inventory)) {
        return {
          ...state,
          lastEventLog: 'ต้องเก็บวัสดุให้ครบทั้ง 3 อย่างก่อนประดิษฐ์กระทง',
        };
      }
      if (!areAllMinigamesPassed(state.minigames)) {
        return {
          ...state,
          lastEventLog: 'กรุณาเล่นมินิเกมประดิษฐ์กระทงให้ผ่านครบทั้ง 3 ด่านก่อนนำไปลอย',
        };
      }
      const actorName = sanitizePlayerName(
        state.players[action.byPlayer].name,
        action.byPlayer === 'p1' ? 'ผู้เล่น 1' : 'ผู้เล่น 2'
      );
      const quality = computeKrathongQuality(state.minigames);
      return {
        ...state,
        krathongCrafted: true,
        questStage: 'ceremony',
        contributedBy: {
          ...state.contributedBy,
          [action.byPlayer]: state.contributedBy[action.byPlayer] + 1,
        },
        lastEventLog: `${actorName} ประกอบกระทงระดับ "${quality.tierTitle}" สำเร็จ! เดินไปที่ท่าน้ำแสงจันทร์เพื่อทำพิธี`,
      };
    }

    case 'RELEASE_KRATHONG': {
      if (!canReleaseKrathong(state)) {
        return {
          ...state,
          lastEventLog: 'กรุณาประดิษฐ์กระทงให้ผ่านครบทุกด่านก่อนทำพิธีลอยกระทง',
        };
      }
      const p1Name = sanitizePlayerName(state.players.p1.name, 'ฟ้าใส');
      const p2Name = sanitizePlayerName(state.players.p2.name, 'ต้นกล้า');
      const releasedAt = action.timestamp ?? new Date().toISOString();
      const index = state.releasedKrathongs.length;
      const quality = computeKrathongQuality(state.minigames);
      const newEntry = {
        id: `krathong-${index + 1}`,
        design: {
          ...state.krathongDesign,
          wishText:
            state.krathongDesign.wishText.trim() ||
            'ขอให้ความรักสว่างไสวดั่งแสงเทียนในคืนเพ็ญ',
        },
        quality,
        coupleNames: [p1Name, p2Name] as [string, string],
        releasedAt,
        x: 940 + (index % 3) * 44,
        y: 856 + (index % 2) * 26,
      };
      return {
        ...state,
        questStage: 'released',
        contributedBy: {
          ...state.contributedBy,
          [action.byPlayer]: state.contributedBy[action.byPlayer] + 1,
        },
        releasedKrathongs: [...state.releasedKrathongs, newEntry],
        lastEventLog: `กระทงระดับ "${quality.tierTitle}" ของ ${p1Name} และ ${p2Name} ลอยลงสู่สายน้ำแสงจันทร์แล้ว!`,
      };
    }

    case 'START_ANOTHER_KRATHONG': {
      const preservedCoop = { ...state.coopTasks };
      delete preservedCoop['npc-bua'];
      delete preservedCoop['gather-lotus'];
      delete preservedCoop['npc-man'];
      return {
        ...state,
        inventory: {
          'banana-leaf': false,
          'lotus-blossom': false,
          'candle-incense': false,
        },
        minigames: createInitialMinigames(),
        krathongCrafted: false,
        coopTasks: preservedCoop,
        questStage: 'explore',
        lastEventLog: 'เริ่มเก็บรวบรวมวัสดุและเล่นด่านประดิษฐ์สำหรับกระทงใบใหม่กันได้เลย',
      };
    }

    case 'APPLY_ONLINE_SNAPSHOT': {
      const myRole = action.myRole;
      const incomingMe = action.players[myRole];
      const curMe = state.players[myRole];

      const rawMyPos = action.preserveMyPosition
        ? curMe.position
        : incomingMe?.position ?? curMe.position;
      const safeMyPos = isPositionWalkable(rawMyPos.x, rawMyPos.y)
        ? rawMyPos
        : { ...SPAWN_POSITIONS[myRole] };

      const mergedMe: PlayerProfile = action.preserveMyProfile
        ? {
            ...curMe,
            position: safeMyPos,
          }
        : {
            ...(incomingMe ?? curMe),
            position: safeMyPos,
          };

      const partnerRole: PlayerId = myRole === 'p1' ? 'p2' : 'p1';
      const incomingPartner = action.players[partnerRole] ?? state.players[partnerRole];
      const safePartnerPos = isPositionWalkable(
        incomingPartner.position.x,
        incomingPartner.position.y
      )
        ? incomingPartner.position
        : { ...SPAWN_POSITIONS[partnerRole] };

      const mergedPartner: PlayerProfile = {
        ...incomingPartner,
        position: safePartnerPos,
      };

      const nextPlayers: Record<PlayerId, PlayerProfile> =
        myRole === 'p1'
          ? { p1: mergedMe, p2: mergedPartner }
          : { p1: mergedPartner, p2: mergedMe };

      return {
        ...state,
        players: nextPlayers,
        settings: {
          ...state.settings,
          activePlayer: myRole,
        },
        inventory: action.shared.inventory ?? state.inventory,
        litLanternIds: Array.isArray(action.shared.litLanternIds)
          ? action.shared.litLanternIds
          : state.litLanternIds,
        pavilionBlessed: Boolean(action.shared.pavilionBlessed),
        contributedBy: action.shared.contributedBy ?? state.contributedBy,
        questStage: action.shared.questStage ?? state.questStage,
        minigames: action.shared.minigames ?? state.minigames,
        krathongCrafted: Boolean(action.shared.krathongCrafted),
        coopTasks: action.shared.coopTasks ?? {},
        krathongDesign: action.shared.krathongDesign ?? state.krathongDesign,
        releasedKrathongs: Array.isArray(action.shared.releasedKrathongs)
          ? action.shared.releasedKrathongs
          : state.releasedKrathongs,
        nearbySpotId: computeActiveNearbySpotId(nextPlayers, myRole),
        lastEventLog: action.shared.lastEventLog || state.lastEventLog,
      };
    }

    case 'APPLY_PEER_MOVE': {
      const target = state.players[action.playerId];
      const nextPlayers: Record<PlayerId, PlayerProfile> = {
        ...state.players,
        [action.playerId]: {
          ...target,
          position: action.position,
        },
      };
      return {
        ...state,
        players: nextPlayers,
        nearbySpotId: computeActiveNearbySpotId(
          nextPlayers,
          state.settings.activePlayer
        ),
      };
    }

    case 'APPLY_PEER_PROFILE': {
      const nextPlayers: Record<PlayerId, PlayerProfile> = {
        ...state.players,
        [action.playerId]: action.profile,
      };
      return {
        ...state,
        players: nextPlayers,
        nearbySpotId: computeActiveNearbySpotId(
          nextPlayers,
          state.settings.activePlayer
        ),
      };
    }

    case 'RESET_GAME':
      return createInitialGameState();

    default:
      return state;
  }
}