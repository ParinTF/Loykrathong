export type PlayerId = 'p1' | 'p2';

export type PlayMode = 'local' | 'online';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type SkinToneId =
  | 'porcelain'
  | 'warm-ivory'
  | 'golden-tan'
  | 'caramel'
  | 'deep-amber';

export type HairStyleId =
  | 'short-classic'
  | 'long-silky'
  | 'wavy-bob'
  | 'high-ponytail'
  | 'curly-crop';

export type HairColorId = 'obsidian' | 'espresso' | 'chestnut' | 'honey-gold';

export type OutfitId =
  | 'chut-thai-gold'
  | 'silk-lotus'
  | 'emerald-sabai'
  | 'lanna-cream';

export type PortraitStatus = 'absent' | 'ready' | 'invalid';

export interface PlayerPortrait {
  status: PortraitStatus;
  dataUrl: string | null;
  mimeType: string | null;
  error: string | null;
  updatedAt: string | null;
}

export interface PlayerCustomization {
  skinTone: SkinToneId;
  hairStyle: HairStyleId;
  hairColor: HairColorId;
  outfit: OutfitId;
}

export interface PlayerPosition {
  x: number;
  y: number;
  facing: Direction;
}

export interface PlayerProfile {
  id: PlayerId;
  name: string;
  customization: PlayerCustomization;
  portrait: PlayerPortrait;
  position: PlayerPosition;
}

export type MaterialId = 'banana-leaf' | 'lotus-blossom' | 'candle-incense';

export type KrathongBaseId = 'classic-banana' | 'golden-coconut' | 'heart-bread';
export type KrathongFlowerId = 'pink-lotus' | 'golden-marigold' | 'crimson-rose';
export type KrathongGlowId = 'amber-candle' | 'moonlight-pearl' | 'rose-spark';

export type MinigameId = 'recipe' | 'assembly' | 'rhythm';
export type MinigameStatus = 'pending' | 'passed' | 'failed';

export interface MinigameRecord {
  status: MinigameStatus;
  score: number; // 0..100
  attempts: number;
}

export type MinigamesProgress = Record<MinigameId, MinigameRecord>;

export interface CoopPairProgress {
  p1Done: boolean;
  p2Done: boolean;
  p1Score: number; // 0..50
  p2Score: number; // 0..50
  updatedAt: string | null;
}

export type CoopTasksMap = Record<string, CoopPairProgress>;

export type KrathongQualityTier = 'classic' | 'radiant' | 'celestial';

export interface KrathongQualitySummary {
  totalScore: number; // 0..300
  flowerLevel: 1 | 2 | 3;
  craftLevel: 1 | 2 | 3;
  glowLevel: 1 | 2 | 3;
  tier: KrathongQualityTier;
  tierTitle: string;
}

export interface KrathongDesign {
  base: KrathongBaseId;
  flower: KrathongFlowerId;
  glow: KrathongGlowId;
  wishText: string;
}

export interface ReleasedKrathong {
  id: string;
  design: KrathongDesign;
  quality: KrathongQualitySummary;
  coupleNames: [string, string];
  releasedAt: string;
  x: number;
  y: number;
}

export type QuestStage = 'explore' | 'craft' | 'ceremony' | 'released';

export type SpotKind = 'npc' | 'gather' | 'lantern' | 'pavilion' | 'craft' | 'pier';

export interface WorldSpot {
  id: string;
  kind: SpotKind;
  title: string;
  subtitle: string;
  zoneName: string;
  x: number;
  y: number;
  radius: number;
  grantsMaterial?: MaterialId;
  npcName?: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export type ReducedMotionPreference = 'system' | 'reduce' | 'no-preference';

export interface AppSettings {
  activePlayer: PlayerId;
  followPartner: boolean;
  reducedMotionOverride: ReducedMotionPreference;
  soundEnabled: boolean;
}

export interface SharedRoomQuestState {
  inventory: Record<MaterialId, boolean>;
  litLanternIds: string[];
  pavilionBlessed: boolean;
  contributedBy: Record<PlayerId, number>;
  questStage: QuestStage;
  minigames: MinigamesProgress;
  krathongCrafted: boolean;
  coopTasks: CoopTasksMap;
  krathongDesign: KrathongDesign;
  releasedKrathongs: ReleasedKrathong[];
  lastEventLog: string;
}

export interface GameState {
  schemaVersion: 1;
  screen: 'setup' | 'world';
  players: Record<PlayerId, PlayerProfile>;
  settings: AppSettings;
  inventory: Record<MaterialId, boolean>;
  litLanternIds: string[];
  pavilionBlessed: boolean;
  contributedBy: Record<PlayerId, number>;
  questStage: QuestStage;
  minigames: MinigamesProgress;
  krathongCrafted: boolean;
  coopTasks: CoopTasksMap;
  krathongDesign: KrathongDesign;
  releasedKrathongs: ReleasedKrathong[];
  nearbySpotId: string | null;
  lastEventLog: string;
}

export interface CoupleEmoteEvent {
  playerId: PlayerId;
  emoji: string;
  text: string;
  ts: number;
}

export type GameAction =
  | { type: 'HYDRATE_STATE'; payload: GameState }
  | { type: 'ENTER_WORLD' }
  | { type: 'OPEN_SETUP' }
  | { type: 'UPDATE_PLAYER_NAME'; playerId: PlayerId; name: string }
  | {
      type: 'UPDATE_PLAYER_CUSTOMIZATION';
      playerId: PlayerId;
      patch: Partial<PlayerCustomization>;
    }
  | {
      type: 'SET_PLAYER_PORTRAIT';
      playerId: PlayerId;
      portrait: PlayerPortrait;
    }
  | { type: 'CLEAR_PLAYER_PORTRAIT'; playerId: PlayerId }
  | { type: 'SET_ACTIVE_PLAYER'; playerId: PlayerId }
  | { type: 'TOGGLE_FOLLOW_PARTNER' }
  | { type: 'SET_FOLLOW_PARTNER'; enabled: boolean }
  | { type: 'SET_REDUCED_MOTION'; mode: ReducedMotionPreference }
  | { type: 'TOGGLE_SOUND' }
  | {
      type: 'MOVE_PLAYER';
      playerId: PlayerId;
      dx: number;
      dy: number;
      facing?: Direction;
    }
  | { type: 'SET_NEARBY_SPOT'; spotId: string | null }
  | {
      type: 'RECORD_COOP_HALF';
      taskKey: string;
      playerId: PlayerId;
      halfScore: number;
    }
  | { type: 'RESET_COOP_TASK'; taskKey: string }
  | {
      type: 'COLLECT_MATERIAL';
      material: MaterialId;
      byPlayer: PlayerId;
      message?: string;
    }
  | { type: 'LIGHT_LANTERN'; lanternId: string; byPlayer: PlayerId }
  | { type: 'BLESS_PAVILION'; byPlayer: PlayerId }
  | {
      type: 'COMPLETE_MINIGAME';
      gameId: MinigameId;
      passed: boolean;
      score: number;
      byPlayer: PlayerId;
    }
  | { type: 'RESET_MINIGAME'; gameId: MinigameId }
  | { type: 'UPDATE_KRATHONG_DESIGN'; patch: Partial<KrathongDesign> }
  | { type: 'CRAFT_KRATHONG'; byPlayer: PlayerId }
  | { type: 'RELEASE_KRATHONG'; byPlayer: PlayerId; timestamp?: string }
  | { type: 'START_ANOTHER_KRATHONG' }
  | {
      type: 'APPLY_ONLINE_SNAPSHOT';
      myRole: PlayerId;
      players: Record<PlayerId, PlayerProfile>;
      shared: SharedRoomQuestState;
      preserveMyProfile?: boolean;
    }
  | {
      type: 'APPLY_PEER_MOVE';
      playerId: PlayerId;
      position: PlayerPosition;
    }
  | {
      type: 'APPLY_PEER_PROFILE';
      playerId: PlayerId;
      profile: PlayerProfile;
    }
  | { type: 'RESET_GAME' };
