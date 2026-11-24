import type { LeafCutShapeId, LotusBoatState, PlayerId, SharedRoomQuestState } from './types';

export type LeafPhase = 'cut' | 'fold';
export type LeafPoint = readonly [number, number];
export type LeafTrack = readonly [LeafPoint, LeafPoint, LeafPoint];
export type LeafTrace = { type: 'leaf-trace'; phase: LeafPhase; shape: LeafCutShapeId; step: number; points: LeafPoint[] };

export type ActivitySkillCommand =
  | { type: 'boat-aim' | 'boat-stroke'; angle: number }
  | { type: 'boat-pick'; id: string }
  | { type: 'boat-swap' | 'leaf-swap' | 'lantern-ready' }
  | LeafTrace
  | { type: 'lantern-grip'; held: boolean; heat?: number };

export const LEAF_SHAPES_ORDER: readonly LeafCutShapeId[];
export const BOAT_LOTUS_TARGETS: readonly { id: string; x: number; y: number; label: string }[];
export const LANTERN_HEAT: Record<PlayerId, readonly [number, number]>;
export const LANTERN_HOLD_MS: number;
export const LANTERN_COUNTDOWN_MS: number;
export function leafTrack(shape: LeafCutShapeId, phase: LeafPhase, step: number): LeafTrack | null;
export function isLeafTraceValid(track: LeafTrack | null, points: unknown): boolean;
export function canReachLotus(boat: LotusBoatState, flower: { x: number; y: number }): boolean;
export function isLanternHeatReady(role: PlayerId, heat: number): boolean;
export function applyActivitySkill<T extends SharedRoomQuestState>(state: T, author: PlayerId, command: ActivitySkillCommand, now: number): T;
export function advanceLanternClock<T extends SharedRoomQuestState>(state: T, now: number): T;
export function pauseLantern<T extends SharedRoomQuestState>(state: T): T;
