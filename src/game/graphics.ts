import { GRAPHICS_QUALITIES, type GraphicsQuality } from '../domain/types';

const profiles = {
  low: { dpr: 0.85, pixels: 690_000, shadow: 0, detailDistance: 16, grassDistance: 24, waterLights: 3 },
  medium: { dpr: 1.15, pixels: 1_050_000, shadow: 768, detailDistance: 23, grassDistance: 34, waterLights: 5 },
  high: { dpr: 1.55, pixels: 1_650_000, shadow: 1280, detailDistance: 33, grassDistance: 48, waterLights: 7 },
  ultra: { dpr: 2, pixels: 3_400_000, shadow: 2048, detailDistance: 51, grassDistance: 72, waterLights: 8 },
} as const;

export function normalizeGraphicsQuality(value: unknown): GraphicsQuality {
  return GRAPHICS_QUALITIES.find((quality) => quality === value) ?? 'auto';
}

export function graphicsProfile(quality: GraphicsQuality, compact: boolean) {
  const preset = quality === 'auto' ? compact ? 'medium' : 'high' : quality;
  const profile = profiles[preset];
  const automatic = quality === 'auto';
  const pixels = automatic ? Math.min(profile.pixels, 960_000) : profile.pixels;
  const waterLights = automatic ? Math.min(profile.waterLights, 6) : profile.waterLights;
  return { preset, ...profile, pixels, waterLights };
}

export type GraphicsProfile = ReturnType<typeof graphicsProfile>;

export function rendererPixelRatio(profile: GraphicsProfile, width: number, height: number, nativeDpr: number): number {
  return Math.min(nativeDpr, profile.dpr, Math.sqrt(profile.pixels / (width * height)));
}
