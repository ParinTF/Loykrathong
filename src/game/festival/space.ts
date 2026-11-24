import { RIVER_BANK_Y, WORLD_HEIGHT, WORLD_WIDTH } from '../../domain/worldMap';

export const WORLD_SCALE = 0.05;
export const WATER_LEVEL = -0.34;
export const RIVER_WIDTH = 128;
export const RIVER_DEPTH = 46;

export function toWorldX(px: number): number {
  return (px - WORLD_WIDTH / 2) * WORLD_SCALE;
}

export function toWorldZ(py: number): number {
  return (py - WORLD_HEIGHT / 2) * WORLD_SCALE;
}

export function riverBankZ(x: number): number {
  const bend = 0.8 + 0.64 * Math.sin(x * 0.16) + 0.35 * Math.sin(x * 0.43 + 1);
  return toWorldZ(RIVER_BANK_Y) + Math.max(0.14, bend);
}

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
