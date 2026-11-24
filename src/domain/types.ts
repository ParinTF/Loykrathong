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

export type AccessoryId = 'none' | 'gold-lotus' | 'jasmine-pin';

export type GenderId = 'female' | 'male' | 'nonbinary';

export type PortraitStatus = 'absent' | 'ready' | 'invalid';

export interface PlayerPortrait {
  status: PortraitStatus;
  dataUrl: string | null;
  mimeType: string | null;
  error: string | null;
  updatedAt: string | null;
}

export interface PlayerCustomization {
  gender: GenderId;
  skinTone: SkinToneId;
  hairStyle: HairStyleId;
  hairColor: HairColorId;
  outfit: OutfitId;
  accessory: AccessoryId;
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

export type KrathongStickerKind =
  | 'pink-lotus'
  | 'marigold'
  | 'crimson-rose'
  | 'white-jasmine'
  | 'folded-leaf'
  | 'heart-charm'
  | 'candle-spark';

export interface KrathongDecorationItem {
  id: string;
  kind: KrathongStickerKind;
  x: number; // 12..88 inside shared krathong canvas
  y: number; // 12..88 inside shared krathong canvas
  scale: number;
  placedBy: PlayerId;
}

export interface KrathongDesign {
  base: KrathongBaseId;
  flower: KrathongFlowerId;
  glow: KrathongGlowId;
  wishText: string;
  decorations: KrathongDecorationItem[];
}

// --- Activity 01: Boat Lotus Gathering ---
export interface LotusBoatState {
  rower: PlayerId;
  boatX: number; // 8..92
  boatY: number; // 14..86
  boatAngle: number;
  collectedIds: string[];
  completed: boolean;
}

// --- Activity 02: Banana Leaf Relay Folding ---
export type LeafCutShapeId = 'swan' | 'lotus' | 'garuda';

export interface LeafRelayState {
  cutter: PlayerId;
  cutStep: number; // 0..3
  currentShape: LeafCutShapeId;
  passedLeafReady: boolean;
  foldStep: number; // 0..3
  finishedPetals: LeafCutShapeId[];
  completed: boolean;
}

// --- Activity 03: Blind Fortune Paper Q&A ---
export interface FortunePaperState {
  promptIndex: number;
  p1Answer: string;
  p2Answer: string;
  p1Locked: boolean;
  p2Locked: boolean;
  revealed: boolean;
  completed: boolean;
}

// --- Activity 04: Meaningful Single Sky Lantern ---
export interface SkyLanternState {
  p1Wish: string;
  p2Wish: string;
  p1Lit: boolean;
  p2Lit: boolean;
  p1ReadyRelease: boolean;
  p2ReadyRelease: boolean;
  released: boolean;
  releasedAt: string | null;
  p1Grip?: boolean;
  p2Grip?: boolean;
  warmUntil?: number | null;
  liftAt?: number | null;
}

// --- Activity 07: Scenic Viewpoint & Couple Photo Booth ---
export type CouplePoseId = 'sit-moon' | 'hold-hands' | 'warm-hug' | 'heart-hands';
export type PhotoBackdropId = 'sala' | 'yipeng' | 'river' | 'cream-minimal';
export type PhotoBoothLayoutId = 'polaroid' | 'strip-4';
export type PhotoStripThemeId = 'moonlight-romance' | 'ivory-memories' | 'love-letter' | 'golden-festival';
export type PhotoBoothFilterId = 'natural' | 'warm-candle' | 'moonlight-film' | 'classic-bw';

export interface CouplePhotoMemory {
  id: string;
  pose: CouplePoseId;
  backdrop: PhotoBackdropId;
  layout?: PhotoBoothLayoutId;
  frameTheme?: PhotoStripThemeId;
  caption: string;
  coupleNames: [string, string];
  takenAt: string;
  compositeDataUrl?: string | null;
}

export interface PhotoBoothShutter {
  sessionId: string;
  layout: PhotoBoothLayoutId;
  frameTheme?: PhotoStripThemeId;
  backdrop: PhotoBackdropId;
  pose: CouplePoseId;
  caption: string;
}

export type PhotoBoothEvent =
  | {
      type: 'photobooth_frame';
      playerId: PlayerId;
      dataUrl: string;
      mirrored: boolean;
      filter: PhotoBoothFilterId;
      ts: number;
    }
  | {
      type: 'photobooth_cam_state';
      playerId: PlayerId;
      active: boolean;
      ts: number;
    }
  | (PhotoBoothShutter & {
      type: 'photobooth_shutter';
      playerId: PlayerId;
      ts: number;
    })
  | {
      type: 'photobooth_snap';
      playerId: PlayerId;
      sessionId: string;
      shotIndex: number;
      dataUrl: string | null;
      ts: number;
    };

// --- Activity 08: Synchronized Pier Ceremony ---
export interface PierCeremonyState {
  p1Ready: boolean;
  p2Ready: boolean;
}

export interface ReleasedKrathong {
  id: string;
  design: KrathongDesign;
  coupleNames: [string, string];
  releasedAt: string;
  x: number;
  y: number;
}

export type QuestStage = 'explore' | 'craft' | 'ceremony' | 'released';

export type SpotKind =
  | 'npc'
  | 'gather'
  | 'lantern'
  | 'pavilion'
  | 'photo'
  | 'craft'
  | 'pier';

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
export const GRAPHICS_QUALITIES = ['auto', 'low', 'medium', 'high', 'ultra'] as const;
export type GraphicsQuality = (typeof GRAPHICS_QUALITIES)[number];

export interface AppSettings {
  activePlayer: PlayerId;
  followPartner: boolean;
  reducedMotionOverride: ReducedMotionPreference;
  soundEnabled: boolean;
  graphicsQuality: GraphicsQuality;
  musicEnabled: boolean;
  highContrast: boolean;
  showTouchControls: boolean;
}

export type PresentationSettings = Pick<
  AppSettings,
  'graphicsQuality' | 'musicEnabled' | 'highContrast' | 'showTouchControls'
>;

export interface SharedRoomQuestState {
  inventory: Record<MaterialId, boolean>;
  lotusBoat: LotusBoatState;
  leafRelay: LeafRelayState;
  fortunePaper: FortunePaperState;
  skyLantern: SkyLanternState;
  activePose: CouplePoseId;
  photoMemories: CouplePhotoMemory[];
  pierCeremony: PierCeremonyState;
  krathongCrafted: boolean;
  krathongDesign: KrathongDesign;
  releasedKrathongs: ReleasedKrathong[];
  questStage: QuestStage;
  lastEventLog: string;
}

export interface GameState {
  schemaVersion: 2;
  screen: 'setup' | 'world';
  myRole: PlayerId;
  players: Record<PlayerId, PlayerProfile>;
  settings: AppSettings;
  inventory: Record<MaterialId, boolean>;
  lotusBoat: LotusBoatState;
  leafRelay: LeafRelayState;
  fortunePaper: FortunePaperState;
  skyLantern: SkyLanternState;
  activePose: CouplePoseId;
  photoMemories: CouplePhotoMemory[];
  pierCeremony: PierCeremonyState;
  questStage: QuestStage;
  krathongCrafted: boolean;
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

export interface CoopSignalEvent {
  playerId: PlayerId;
  spotId: string;
  action: string;
  value?: number;
  x?: number;
  y?: number;
  ts: number;
}

export type GameAction =
  | { type: 'HYDRATE_STATE'; payload: GameState }
  | { type: 'ENTER_WORLD' }
  | { type: 'OPEN_SETUP' }
  | { type: 'SET_MY_ROLE'; role: PlayerId }
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
  | { type: 'SET_PRESENTATION_SETTINGS'; patch: Partial<PresentationSettings> }
  | {
      type: 'MOVE_PLAYER';
      playerId: PlayerId;
      dx: number;
      dy: number;
      facing?: Direction;
    }
  | { type: 'SET_NEARBY_SPOT'; spotId: string | null }
  // Activity 03: Blind Fortune Paper
  | { type: 'SET_FORTUNE_PROMPT'; promptIndex: number }
  | { type: 'SET_FORTUNE_ANSWER'; playerId: PlayerId; answer: string }
  | { type: 'LOCK_FORTUNE_ANSWER'; playerId: PlayerId }
  | { type: 'RESET_FORTUNE_ROUND'; promptIndex?: number }
  // Activity 04: Single Sky Lantern
  | { type: 'SET_LANTERN_WISH'; playerId: PlayerId; wish: string }
  // Activity 06: Shared Krathong Studio
  | { type: 'UPDATE_KRATHONG_DESIGN'; patch: Partial<KrathongDesign> }
  | { type: 'ADD_KRATHONG_DECORATION'; item: KrathongDecorationItem }
  | { type: 'MOVE_KRATHONG_DECORATION'; id: string; x: number; y: number }
  | { type: 'REMOVE_KRATHONG_DECORATION'; id: string }
  | { type: 'CLEAR_KRATHONG_DECORATIONS' }
  | { type: 'CRAFT_KRATHONG'; byPlayer: PlayerId }
  // Activity 07: Scenic Viewpoint & Photo Booth
  | { type: 'SET_COUPLE_POSE'; pose: CouplePoseId }
  | {
      type: 'SAVE_PHOTO_MEMORY';
      pose: CouplePoseId;
      backdrop: PhotoBackdropId;
      layout?: PhotoBoothLayoutId;
      frameTheme?: PhotoStripThemeId;
      caption: string;
      compositeDataUrl?: string | null;
      timestamp?: string;
    }
  // Activity 08: Pier Synchronized Release
  | { type: 'TOGGLE_PIER_READY'; playerId: PlayerId; ready?: boolean }
  | { type: 'RELEASE_KRATHONG'; byPlayer: PlayerId; timestamp?: string }
  | { type: 'START_ANOTHER_KRATHONG' }
  // Online sync
  | {
      type: 'APPLY_ONLINE_SNAPSHOT';
      myRole: PlayerId;
      players: Record<PlayerId, PlayerProfile>;
      shared: SharedRoomQuestState;
      preserveMyProfile?: boolean;
      preserveMyPosition?: boolean;
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
