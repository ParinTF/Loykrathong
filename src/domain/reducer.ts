import type {
  CouplePoseId,
  Direction,
  FortunePaperState,
  GameAction,
  GameState,
  KrathongDecorationItem,
  KrathongDesign,
  LeafRelayState,
  LotusBoatState,
  MaterialId,
  PierCeremonyState,
  PlayerId,
  PlayerPortrait,
  PlayerProfile,
  SharedRoomQuestState,
  SkyLanternState,
} from './types';
import {
  PLAYER_RADIUS,
  SPAWN_POSITIONS,
  findNearestSpot,
  isPositionWalkable,
  resolveMovement,
} from './worldMap';

export const MATERIAL_LABELS: Record<MaterialId, { name: string; hint: string }> = {
  'lotus-blossom': {
    name: 'ดอกบัวชมพูจากสระหิ่งห้อย',
    hint: 'พายเรือเก็บดอกบัวด้วยกันที่สวนหิ่งห้อย',
  },
  'banana-leaf': {
    name: 'กลีบใบตองฝีมือสองเรา',
    hint: 'ช่วยกันเจียนและพับใบตองที่ซุ้มป้าบัว',
  },
  'candle-incense': {
    name: 'ชุดธูปเทียนของขวัญจากลุงมั่น',
    hint: 'เปิดกระดาษคำทำนายของเราสองคนที่ซุ้มลุงมั่น',
  },
};

export const FORTUNE_PROMPTS = [
  'สถานที่ที่อยากจูงมือกันไปเที่ยวมากที่สุดคือที่ไหน?',
  'ความทรงจำระหว่างเราที่นึกถึงทีไรก็ยิ้มออกทุกทีคือตอนไหน?',
  'ถ้าคืนนี้ขอพรให้เราสองคนได้ 1 ข้อ อยากขออะไร?',
  'สิ่งเล็กๆ ที่แฟนทำแล้วใจละลายที่สุดคืออะไร?',
] as const;

export function createEmptyPortrait(): PlayerPortrait {
  return {
    status: 'absent',
    dataUrl: null,
    mimeType: null,
    error: null,
    updatedAt: null,
  };
}

export function createDefaultDecorations(): KrathongDecorationItem[] {
  return [
    { id: 'init-1', kind: 'pink-lotus', x: 36, y: 48, scale: 1, placedBy: 'p1' },
    { id: 'init-2', kind: 'pink-lotus', x: 64, y: 48, scale: 1, placedBy: 'p2' },
    { id: 'init-3', kind: 'candle-spark', x: 50, y: 44, scale: 1.05, placedBy: 'p1' },
  ];
}

export function createDefaultKrathongDesign(): KrathongDesign {
  return {
    base: 'classic-banana',
    flower: 'pink-lotus',
    glow: 'amber-candle',
    wishText:
      'ขอให้เราสองคนเดินเคียงข้างกันอย่างอบอุ่นในทุกเทศกาล แม้ในวันที่อยู่ไกลกัน',
    decorations: createDefaultDecorations(),
  };
}

export function createInitialLotusBoat(): LotusBoatState {
  return {
    rower: 'p1',
    boatX: 16,
    boatY: 52,
    boatAngle: 0,
    collectedIds: [],
    completed: false,
  };
}

export function createInitialLeafRelay(): LeafRelayState {
  return {
    cutter: 'p1',
    cutStep: 0,
    currentShape: 'swan',
    passedLeafReady: false,
    foldStep: 0,
    finishedPetals: [],
    completed: false,
  };
}

export function createInitialFortunePaper(): FortunePaperState {
  return {
    promptIndex: 0,
    p1Answer: '',
    p2Answer: '',
    p1Locked: false,
    p2Locked: false,
    revealed: false,
    completed: false,
  };
}

export function createInitialSkyLantern(): SkyLanternState {
  return {
    p1Wish: '',
    p2Wish: '',
    p1Lit: false,
    p2Lit: false,
    p1ReadyRelease: false,
    p2ReadyRelease: false,
    released: false,
    releasedAt: null,
  };
}

export function createInitialPierCeremony(): PierCeremonyState {
  return {
    p1Ready: false,
    p2Ready: false,
  };
}

export function createDefaultPlayers(): Record<PlayerId, PlayerProfile> {
  return {
    p1: {
      id: 'p1',
      name: 'ฟ้าใส',
      customization: {
        gender: 'female',
        skinTone: 'warm-ivory',
        hairStyle: 'long-silky',
        hairColor: 'obsidian',
        outfit: 'silk-lotus',
        accessory: 'none',
      },
      portrait: createEmptyPortrait(),
      position: { ...SPAWN_POSITIONS.p1 },
    },
    p2: {
      id: 'p2',
      name: 'ต้นกล้า',
      customization: {
        gender: 'male',
        skinTone: 'golden-tan',
        hairStyle: 'short-classic',
        hairColor: 'espresso',
        outfit: 'chut-thai-gold',
        accessory: 'none',
      },
      portrait: createEmptyPortrait(),
      position: { ...SPAWN_POSITIONS.p2 },
    },
  };
}

export function createInitialGameState(): GameState {
  return {
    schemaVersion: 2,
    screen: 'setup',
    myRole: 'p1',
    players: createDefaultPlayers(),
    settings: {
      activePlayer: 'p1',
      followPartner: true,
      reducedMotionOverride: 'system',
      soundEnabled: true,
      graphicsQuality: 'auto',
      musicEnabled: false,
      highContrast: false,
      showTouchControls: false,
    },
    inventory: {
      'banana-leaf': false,
      'lotus-blossom': false,
      'candle-incense': false,
    },
    lotusBoat: createInitialLotusBoat(),
    leafRelay: createInitialLeafRelay(),
    fortunePaper: createInitialFortunePaper(),
    skyLantern: createInitialSkyLantern(),
    activePose: 'sit-moon',
    photoMemories: [],
    pierCeremony: createInitialPierCeremony(),
    questStage: 'explore',
    krathongCrafted: false,
    krathongDesign: createDefaultKrathongDesign(),
    releasedKrathongs: [],
    nearbySpotId: null,
    lastEventLog:
      'ยินดีต้อนรับสู่ค่ำคืนวันเพ็ญ เดินเล่น แวะถ่ายรูป หรือทำกระทงด้วยกันได้ตามใจชอบเลย',
  };
}

export function extractSharedQuestState(state: GameState): SharedRoomQuestState {
  return {
    inventory: state.inventory,
    lotusBoat: state.lotusBoat,
    leafRelay: state.leafRelay,
    fortunePaper: state.fortunePaper,
    skyLantern: state.skyLantern,
    activePose: state.activePose,
    photoMemories: state.photoMemories,
    pierCeremony: state.pierCeremony,
    krathongCrafted: state.krathongCrafted,
    krathongDesign: state.krathongDesign,
    releasedKrathongs: state.releasedKrathongs,
    questStage: state.questStage,
    lastEventLog: state.lastEventLog,
  };
}

export function countCollectedMaterials(
  inventory: Record<MaterialId, boolean>
): number {
  return Object.values(inventory).filter(Boolean).length;
}

export function countSharedMemories(state: GameState): number {
  let total = 0;
  if (state.lotusBoat.completed) total += 1;
  if (state.leafRelay.completed) total += 1;
  if (state.fortunePaper.revealed) total += 1;
  if (state.skyLantern.released) total += 1;
  if (state.krathongCrafted) total += 1;
  if (state.photoMemories.length > 0) total += 1;
  if (state.releasedKrathongs.length > 0) total += 1;
  return total;
}

export function deriveDirection(
  dx: number,
  dy: number,
  fallback: Direction
): Direction {
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

  if (dist < 6) {
    return {
      ...partner,
      position: {
        ...partner.position,
        facing: leader.position.facing,
      },
    };
  }

  const maxStep = Math.min(dist, 5.4);
  const stepX = (dx / dist) * maxStep;
  const stepY = (dy / dist) * maxStep;
  const resolved = resolveMovement(
    partner.position.x,
    partner.position.y,
    stepX,
    stepY,
    PLAYER_RADIUS
  );

  return {
    ...partner,
    position: {
      x: resolved.x,
      y: resolved.y,
      facing: deriveDirection(stepX, stepY, leader.position.facing),
    },
  };
}

function computeActiveNearbySpotId(
  players: Record<PlayerId, PlayerProfile>,
  activePlayer: PlayerId
): string | null {
  const activePos = players[activePlayer].position;
  return findNearestSpot(activePos.x, activePos.y)?.id ?? null;
}

function clampCanvasCoord(val: number): number {
  return Math.max(12, Math.min(88, Math.round(val)));
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'HYDRATE_STATE': {
      const p1Raw = action.payload.players.p1.position;
      const p2Raw = action.payload.players.p2.position;
      const p1Pos = isPositionWalkable(p1Raw.x, p1Raw.y)
        ? p1Raw
        : { ...SPAWN_POSITIONS.p1 };
      const p2Pos = isPositionWalkable(p2Raw.x, p2Raw.y)
        ? p2Raw
        : { ...SPAWN_POSITIONS.p2 };
      const hydratedPlayers: Record<PlayerId, PlayerProfile> = {
        p1: {
          ...action.payload.players.p1,
          customization: {
            ...createDefaultPlayers().p1.customization,
            ...action.payload.players.p1.customization,
          },
          position: p1Pos,
        },
        p2: {
          ...action.payload.players.p2,
          customization: {
            ...createDefaultPlayers().p2.customization,
            ...action.payload.players.p2.customization,
          },
          position: p2Pos,
        },
      };
      return {
        ...action.payload,
        schemaVersion: 2,
        screen: state.screen === 'world' ? 'world' : action.payload.screen,
        myRole: action.payload.myRole === 'p2' ? 'p2' : 'p1',
        players: hydratedPlayers,
        nearbySpotId: computeActiveNearbySpotId(
          hydratedPlayers,
          action.payload.settings.activePlayer
        ),
      };
    }

    case 'ENTER_WORLD': {
      return {
        ...state,
        screen: 'world',
        nearbySpotId: computeActiveNearbySpotId(
          state.players,
          state.settings.activePlayer
        ),
        lastEventLog: `${state.players.p1.name} และ ${state.players.p2.name} เข้าสู่ค่ำคืนวันเพ็ญริมน้ำแล้ว`,
      };
    }

    case 'OPEN_SETUP':
      return {
        ...state,
        screen: 'setup',
      };

    case 'SET_MY_ROLE':
      return {
        ...state,
        myRole: action.role,
        settings: {
          ...state.settings,
          activePlayer: action.role,
        },
        nearbySpotId: computeActiveNearbySpotId(state.players, action.role),
      };

    case 'UPDATE_PLAYER_NAME': {
      const trimmed = action.name.slice(0, 24);
      return {
        ...state,
        players: {
          ...state.players,
          [action.playerId]: {
            ...state.players[action.playerId],
            name: trimmed,
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
        lastEventLog: `สลับมาควบคุม ${state.players[action.playerId].name}`,
      };

    case 'TOGGLE_FOLLOW_PARTNER': {
      const nextFollow = !state.settings.followPartner;
      return {
        ...state,
        settings: {
          ...state.settings,
          followPartner: nextFollow,
        },
        lastEventLog: nextFollow
          ? 'เปิดโหมดเดินจูงมือคู่กันแล้ว'
          : 'สลับเป็นโหมดแยกเดินสำรวจอิสระ',
      };
    }

    case 'SET_FOLLOW_PARTNER':
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

    case 'SET_PRESENTATION_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.patch,
        },
      };

    case 'MOVE_PLAYER': {
      const leader = state.players[action.playerId];
      const nextFacing =
        action.facing ?? deriveDirection(action.dx, action.dy, leader.position.facing);
      const resolved = resolveMovement(
        leader.position.x,
        leader.position.y,
        action.dx,
        action.dy,
        PLAYER_RADIUS
      );

      if (
        !resolved.moved &&
        nextFacing === leader.position.facing &&
        state.nearbySpotId ===
          (findNearestSpot(leader.position.x, leader.position.y)?.id ?? null)
      ) {
        return state;
      }

      const updatedLeader: PlayerProfile = {
        ...leader,
        position: {
          x: resolved.x,
          y: resolved.y,
          facing: nextFacing,
        },
      };

      const partnerId: PlayerId = action.playerId === 'p1' ? 'p2' : 'p1';
      let updatedPartner = state.players[partnerId];
      if (state.settings.followPartner && resolved.moved) {
        updatedPartner = partnerFollowStep(updatedLeader, updatedPartner);
      }

      const nextPlayers: Record<PlayerId, PlayerProfile> = {
        ...state.players,
        [action.playerId]: updatedLeader,
        [partnerId]: updatedPartner,
      };

      const activePlayer = state.players[state.settings.activePlayer]
        ? state.settings.activePlayer
        : action.playerId;

      return {
        ...state,
        players: nextPlayers,
        nearbySpotId: computeActiveNearbySpotId(nextPlayers, activePlayer),
      };
    }

    case 'SET_NEARBY_SPOT':
      return state.nearbySpotId === action.spotId
        ? state
        : { ...state, nearbySpotId: action.spotId };

    // =========================================================================
    // 03 — กระดาษคำทำนายของเราสองคน (Blind Q&A + Simultaneous Reveal)
    // =========================================================================
    case 'SET_FORTUNE_PROMPT': {
      const idx =
        ((action.promptIndex % FORTUNE_PROMPTS.length) + FORTUNE_PROMPTS.length) %
        FORTUNE_PROMPTS.length;
      return {
        ...state,
        fortunePaper: {
          promptIndex: idx,
          p1Answer: '',
          p2Answer: '',
          p1Locked: false,
          p2Locked: false,
          revealed: false,
          completed: state.fortunePaper.completed,
        },
        lastEventLog: 'เปลี่ยนคำถามกระดาษคำทำนายใบใหม่แล้ว ลองแอบเขียนคำตอบกันเลย',
      };
    }

    case 'SET_FORTUNE_ANSWER': {
      const cleaned = action.answer.slice(0, 140);
      if (action.playerId === 'p1') {
        if (state.fortunePaper.p1Locked) return state;
        return {
          ...state,
          fortunePaper: {
            ...state.fortunePaper,
            p1Answer: cleaned,
          },
        };
      }
      if (state.fortunePaper.p2Locked) return state;
      return {
        ...state,
        fortunePaper: {
          ...state.fortunePaper,
          p2Answer: cleaned,
        },
      };
    }

    case 'LOCK_FORTUNE_ANSWER': {
      const fp = state.fortunePaper;
      const answer = action.playerId === 'p1' ? fp.p1Answer.trim() : fp.p2Answer.trim();
      if (!answer) return state;

      const nextFp: FortunePaperState = {
        ...fp,
        p1Locked: action.playerId === 'p1' ? true : fp.p1Locked,
        p2Locked: action.playerId === 'p2' ? true : fp.p2Locked,
      };
      const bothLocked = nextFp.p1Locked && nextFp.p2Locked;
      if (bothLocked) {
        nextFp.revealed = true;
        nextFp.completed = true;
      }

      const actorName = state.players[action.playerId].name;
      return {
        ...state,
        fortunePaper: nextFp,
        inventory: bothLocked
          ? { ...state.inventory, 'candle-incense': true }
          : state.inventory,
        lastEventLog: bothLocked
          ? `เปิดกระดาษคำทำนายพร้อมกันแล้ว! ลุงมั่นยิ้มอย่างอบอุ่นและมอบชุดธูปเทียนมงคลให้เป็นของขวัญ`
          : `${actorName} ปิดผนึกคำตอบไว้แล้ว รออีกฝ่ายเขียนเสร็จเพื่อเปิดอ่านพร้อมกัน`,
      };
    }

    case 'RESET_FORTUNE_ROUND': {
      const nextIdx =
        typeof action.promptIndex === 'number'
          ? ((action.promptIndex % FORTUNE_PROMPTS.length) + FORTUNE_PROMPTS.length) %
            FORTUNE_PROMPTS.length
          : (state.fortunePaper.promptIndex + 1) % FORTUNE_PROMPTS.length;
      return {
        ...state,
        fortunePaper: {
          promptIndex: nextIdx,
          p1Answer: '',
          p2Answer: '',
          p1Locked: false,
          p2Locked: false,
          revealed: false,
          completed: state.fortunePaper.completed,
        },
        lastEventLog: 'หยิบกระดาษคำทำนายคู่รักใบใหม่มาเขียนต่อกันเลย',
      };
    }

    // =========================================================================
    // 04 — ส่งความปรารถนาขึ้นสู่ท้องฟ้า (1 Meaningful Sky Lantern)
    // =========================================================================
    case 'SET_LANTERN_WISH': {
      if (state.skyLantern.released) return state;
      const cleaned = action.wish.slice(0, 110);
      return {
        ...state,
        skyLantern:
          action.playerId === 'p1'
            ? { ...state.skyLantern, p1Wish: cleaned }
            : { ...state.skyLantern, p2Wish: cleaned },
      };
    }

    // =========================================================================
    // 06 — สร้างกระทงที่มีเพียงใบเดียวในโลก (Real-Time Shared Studio)
    // =========================================================================
    case 'UPDATE_KRATHONG_DESIGN': {
      const nextDesign: KrathongDesign = {
        ...state.krathongDesign,
        ...action.patch,
        decorations:
          action.patch.decorations ?? state.krathongDesign.decorations,
      };
      return {
        ...state,
        krathongDesign: nextDesign,
      };
    }

    case 'ADD_KRATHONG_DECORATION': {
      const current = state.krathongDesign.decorations;
      if (current.length >= 24) return state;
      const clamped: KrathongDecorationItem = {
        ...action.item,
        x: clampCanvasCoord(action.item.x),
        y: clampCanvasCoord(action.item.y),
      };
      return {
        ...state,
        krathongDesign: {
          ...state.krathongDesign,
          decorations: [...current, clamped],
        },
        lastEventLog: `${state.players[clamped.placedBy].name} วางของตกแต่งลงบนกระทงคู่`,
      };
    }

    case 'MOVE_KRATHONG_DECORATION': {
      const nextX = clampCanvasCoord(action.x);
      const nextY = clampCanvasCoord(action.y);
      return {
        ...state,
        krathongDesign: {
          ...state.krathongDesign,
          decorations: state.krathongDesign.decorations.map((item) =>
            item.id === action.id ? { ...item, x: nextX, y: nextY } : item
          ),
        },
      };
    }

    case 'REMOVE_KRATHONG_DECORATION': {
      return {
        ...state,
        krathongDesign: {
          ...state.krathongDesign,
          decorations: state.krathongDesign.decorations.filter(
            (item) => item.id !== action.id
          ),
        },
      };
    }

    case 'CLEAR_KRATHONG_DECORATIONS': {
      return {
        ...state,
        krathongDesign: {
          ...state.krathongDesign,
          decorations: [],
        },
        lastEventLog: 'จัดวางหน้ากระทงใหม่เพื่อตกแต่งด้วยกันอีกครั้ง',
      };
    }

    case 'CRAFT_KRATHONG': {
      const actorName = state.players[action.byPlayer].name;
      return {
        ...state,
        krathongCrafted: true,
        questStage: state.releasedKrathongs.length > 0 ? 'released' : 'ceremony',
        lastEventLog: `${actorName} บันทึกกระทงที่มีเพียงใบเดียวในโลกของเราเรียบร้อย พร้อมพาไปท่าน้ำได้ทุกเมื่อ`,
      };
    }

    // =========================================================================
    // 07 — จุดชมวิวและถ่ายรูปคู่ (Scenic Viewpoints & Couple Photo Memories)
    // =========================================================================
    case 'SET_COUPLE_POSE': {
      const poseNames: Record<CouplePoseId, string> = {
        'sit-moon': 'นั่งเคียงข้างชมจันทร์',
        'hold-hands': 'จับมือกันใต้แสงจันทร์',
        'warm-hug': 'กอดกันอุ่นๆ ริมน้ำ',
        'heart-hands': 'ทำมือรูปหัวใจคู่กัน',
      };
      return {
        ...state,
        activePose: action.pose,
        lastEventLog: `เปลี่ยนท่าคู่รักเป็น “${poseNames[action.pose]}”`,
      };
    }

    case 'SAVE_PHOTO_MEMORY': {
      const p1Name = state.players.p1.name || 'ผู้เล่น 1';
      const p2Name = state.players.p2.name || 'ผู้เล่น 2';
      const takenAt = action.timestamp ?? new Date().toISOString();
      const entry = {
        id: `photo-${state.photoMemories.length + 1}-${takenAt}`,
        pose: action.pose,
        backdrop: action.backdrop,
        layout: action.layout ?? ('polaroid' as const),
        ...(action.layout === 'strip-4' && action.frameTheme ? { frameTheme: action.frameTheme } : {}),
        caption:
          action.caption.trim() ||
          `คืนเพ็ญแสนอบอุ่นของ ${p1Name} และ ${p2Name}`,
        coupleNames: [p1Name, p2Name] as [string, string],
        takenAt,
        compositeDataUrl: action.compositeDataUrl ?? null,
      };
      return {
        ...state,
        activePose: action.pose,
        photoMemories: [...state.photoMemories.slice(-11), entry],
        lastEventLog: `บันทึกภาพคู่จาก Photo Booth ใต้แสงจันทร์เรียบร้อยแล้ว!`,
      };
    }

    // =========================================================================
    // 08 — คำอธิษฐานใต้แสงจันทร์ (Synchronized Release, No Score)
    // =========================================================================
    case 'TOGGLE_PIER_READY': {
      const current =
        action.playerId === 'p1'
          ? state.pierCeremony.p1Ready
          : state.pierCeremony.p2Ready;
      const nextVal = action.ready !== undefined ? action.ready : !current;
      const nextCeremony: PierCeremonyState = {
        ...state.pierCeremony,
        p1Ready: action.playerId === 'p1' ? nextVal : state.pierCeremony.p1Ready,
        p2Ready: action.playerId === 'p2' ? nextVal : state.pierCeremony.p2Ready,
      };
      const actorName = state.players[action.playerId].name;
      return {
        ...state,
        pierCeremony: nextCeremony,
        lastEventLog:
          nextCeremony.p1Ready && nextCeremony.p2Ready
            ? 'ทั้งสองคนพร้อมแล้ว! ค่อยๆ วางกระทงลงสู่สายน้ำแสงจันทร์พร้อมกัน…'
            : nextVal
              ? `${actorName} ประคองกระทงพร้อมปล่อยแล้ว รออีกฝ่ายแตะพร้อมกัน`
              : `${actorName} ยังอยากเขียนคำอธิษฐานเพิ่มอีกนิด`,
      };
    }

    case 'RELEASE_KRATHONG': {
      const p1Name = state.players.p1.name || 'ผู้เล่น 1';
      const p2Name = state.players.p2.name || 'ผู้เล่น 2';
      const releasedAt = action.timestamp ?? new Date().toISOString();
      const index = state.releasedKrathongs.length;
      const newEntry = {
        id: `krathong-${index + 1}-${releasedAt}`,
        design: {
          ...state.krathongDesign,
          wishText:
            state.krathongDesign.wishText.trim() ||
            'ขอให้ความรักของเราสว่างไสวและอบอุ่นเหมือนแสงจันทร์คืนนี้ตลอดไป',
          decorations: [...state.krathongDesign.decorations],
        },
        coupleNames: [p1Name, p2Name] as [string, string],
        releasedAt,
        x: 940 + (index % 3) * 44,
        y: 856 + (index % 2) * 26,
      };
      return {
        ...state,
        krathongCrafted: true,
        questStage: 'released',
        pierCeremony: createInitialPierCeremony(),
        releasedKrathongs: [...state.releasedKrathongs, newEntry],
        lastEventLog: `กระทงของ ${p1Name} และ ${p2Name} ค่อยๆ ลอยออกไปตามสายน้ำแสงจันทร์แล้ว`,
      };
    }

    case 'START_ANOTHER_KRATHONG': {
      return {
        ...state,
        krathongCrafted: false,
        pierCeremony: createInitialPierCeremony(),
        krathongDesign: createDefaultKrathongDesign(),
        questStage: 'explore',
        lastEventLog: 'เริ่มตกแต่งกระทงใบใหม่ด้วยกันได้ตามใจชอบเลย',
      };
    }

    // =========================================================================
    // ONLINE SYNC
    // =========================================================================
    case 'APPLY_ONLINE_SNAPSHOT': {
      const myRole = action.myRole;
      const incomingMe = action.players[myRole];
      const curMe = state.players[myRole];
      const defaults = createDefaultPlayers();

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
            customization: {
              ...defaults[myRole].customization,
              ...(incomingMe?.customization ?? curMe.customization),
            },
            position: safeMyPos,
          };

      const partnerRole: PlayerId = myRole === 'p1' ? 'p2' : 'p1';
      const incomingPartner =
        action.players[partnerRole] ?? state.players[partnerRole];
      const safePartnerPos = isPositionWalkable(
        incomingPartner.position.x,
        incomingPartner.position.y
      )
        ? incomingPartner.position
        : { ...SPAWN_POSITIONS[partnerRole] };

      const mergedPartner: PlayerProfile = {
        ...incomingPartner,
        customization: {
          ...defaults[partnerRole].customization,
          ...incomingPartner.customization,
        },
        position: safePartnerPos,
      };

      const nextPlayers: Record<PlayerId, PlayerProfile> =
        myRole === 'p1'
          ? { p1: mergedMe, p2: mergedPartner }
          : { p1: mergedPartner, p2: mergedMe };

      // Preserve my in-progress un-locked fortune answer locally so server masking never erases my typing
      const incomingFp = action.shared.fortunePaper ?? state.fortunePaper;
      const mergedFp: FortunePaperState = {
        ...incomingFp,
        p1Answer:
          myRole === 'p1' && !incomingFp.revealed && state.fortunePaper.p1Answer
            ? state.fortunePaper.p1Answer
            : incomingFp.p1Answer,
        p2Answer:
          myRole === 'p2' && !incomingFp.revealed && state.fortunePaper.p2Answer
            ? state.fortunePaper.p2Answer
            : incomingFp.p2Answer,
      };

      return {
        ...state,
        myRole,
        players: nextPlayers,
        settings: {
          ...state.settings,
          activePlayer: myRole,
        },
        inventory: action.shared.inventory ?? state.inventory,
        lotusBoat: action.shared.lotusBoat ?? state.lotusBoat,
        leafRelay: action.shared.leafRelay ?? state.leafRelay,
        fortunePaper: mergedFp,
        skyLantern: action.shared.skyLantern ?? state.skyLantern,
        activePose: action.shared.activePose ?? state.activePose,
        photoMemories: Array.isArray(action.shared.photoMemories)
          ? action.shared.photoMemories
          : state.photoMemories,
        pierCeremony: action.shared.pierCeremony ?? state.pierCeremony,
        questStage: action.shared.questStage ?? state.questStage,
        krathongCrafted: Boolean(action.shared.krathongCrafted),
        krathongDesign: action.shared.krathongDesign
          ? {
              ...state.krathongDesign,
              ...action.shared.krathongDesign,
              decorations: Array.isArray(action.shared.krathongDesign.decorations)
                ? action.shared.krathongDesign.decorations
                : state.krathongDesign.decorations,
            }
          : state.krathongDesign,
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
      const defaults = createDefaultPlayers()[action.playerId];
      const nextPlayers: Record<PlayerId, PlayerProfile> = {
        ...state.players,
        [action.playerId]: {
          ...action.profile,
          customization: {
            ...defaults.customization,
            ...action.profile.customization,
          },
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

    case 'RESET_GAME':
      return createInitialGameState();

    default:
      return state;
  }
}
