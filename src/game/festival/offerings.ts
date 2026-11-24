import * as THREE from 'three';
import type { KrathongDesign, KrathongQualityTier } from '../../domain/types';
import { type FestivalAssets, type FestivalModel } from './assets';

const BASE_MODELS: Record<KrathongDesign['base'], FestivalModel> = {
  'classic-banana': 'BananaKrathong',
  'golden-coconut': 'CoconutKrathong',
  'heart-bread': 'HeartKrathong',
};
const FLOWER_MODELS: Record<KrathongDesign['flower'], FestivalModel> = {
  'pink-lotus': 'LotusCrown',
  'golden-marigold': 'MarigoldCrown',
  'crimson-rose': 'RoseCrown',
};
const FLAME_TONES = {
  'amber-candle': 0xffe0a0,
  'moonlight-pearl': 0xd6f2ff,
  'rose-spark': 0xffb7c8,
};

function flameTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 80;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const ctx = canvas.getContext('2d');
  if (!ctx) return texture;
  const glow = ctx.createRadialGradient(24, 48, 4, 24, 42, 30);
  glow.addColorStop(0, 'rgba(255, 202, 120, 0.46)');
  glow.addColorStop(0.48, 'rgba(255, 155, 75, 0.12)');
  glow.addColorStop(1, 'rgba(255, 133, 53, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 48, 80);
  const core = ctx.createLinearGradient(0, 60, 0, 17);
  core.addColorStop(0, '#f3b296');
  core.addColorStop(0.24, '#fff9db');
  core.addColorStop(0.59, '#ffec9c');
  core.addColorStop(1, '#f3a05b');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(25, 16);
  ctx.bezierCurveTo(25, 27, 36, 37, 33, 49);
  ctx.bezierCurveTo(30, 62, 17, 61, 14, 52);
  ctx.bezierCurveTo(11, 43, 20, 33, 25, 16);
  ctx.fill();
  return texture;
}

export interface FloatingOffering {
  group: THREE.Group;
  flame: THREE.Sprite;
  warmth: number;
}

export function createOffering(assets: FestivalAssets, design: KrathongDesign, tier: KrathongQualityTier): FloatingOffering {
  const placement = { x: 0, y: 0, z: 0 };
  const group = new THREE.Group();
  group.name = 'Wax and banana-leaf offering';
  group.add(
    assets.create(BASE_MODELS[design.base], placement, false),
    assets.create(FLOWER_MODELS[design.flower], placement, false),
  );
  if (tier !== 'classic') {
    group.add(assets.create(FLOWER_MODELS[design.flower], { ...placement, y: -0.109, scale: 1.27, yaw: 0.48 }, false));
  }
  const scale = tier === 'celestial' ? 1.36 : tier === 'radiant' ? 1.19 : 1;
  group.scale.setScalar(scale);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flameTexture(), color: FLAME_TONES[design.glow], transparent: true, depthWrite: false, toneMapped: false,
  }));
  flame.position.set(0.046, 0.803, 0.103);
  flame.scale.set(0.28, 0.47, 1);
  group.add(flame);
  const warmth = design.glow === 'moonlight-pearl' ? -1 : design.glow === 'rose-spark' ? 0.08 : 0.92;
  return { group, flame, warmth };
}
