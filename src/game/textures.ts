import Phaser from 'phaser';
import {
  HAIR_COLORS,
  KRATHONG_BASES,
  KRATHONG_FLOWERS,
  KRATHONG_GLOWS,
  OUTFITS,
  SKIN_TONES,
  findOption,
} from '../domain/customizationCatalog';
import type {
  KrathongDesign,
  KrathongQualityTier,
  PlayerProfile,
} from '../domain/types';

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

export function ensureFestivalTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('festival-glow')) {
    const canvasTex = scene.textures.createCanvas('festival-glow', 128, 128);
    if (canvasTex) {
      const ctx = canvasTex.getContext();
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, 'rgba(253, 224, 71, 0.95)');
      grad.addColorStop(0.4, 'rgba(245, 158, 11, 0.45)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      canvasTex.refresh();
    }
  }

  if (!scene.textures.exists('pink-glow')) {
    const canvasTex = scene.textures.createCanvas('pink-glow', 128, 128);
    if (canvasTex) {
      const ctx = canvasTex.getContext();
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, 'rgba(244, 114, 182, 0.85)');
      grad.addColorStop(0.5, 'rgba(236, 72, 153, 0.3)');
      grad.addColorStop(1, 'rgba(236, 72, 153, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      canvasTex.refresh();
    }
  }

  if (!scene.textures.exists('firefly-dot')) {
    const canvasTex = scene.textures.createCanvas('firefly-dot', 16, 16);
    if (canvasTex) {
      const ctx = canvasTex.getContext();
      const grad = ctx.createRadialGradient(8, 8, 1, 8, 8, 8);
      grad.addColorStop(0, 'rgba(254, 240, 138, 1)');
      grad.addColorStop(0.6, 'rgba(250, 204, 21, 0.5)');
      grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
      canvasTex.refresh();
    }
  }
}

export function drawCharacterToGraphics(
  g: Phaser.GameObjects.Graphics,
  profile: PlayerProfile,
  isActive: boolean
): void {
  g.clear();

  const skin = hexToNumber(
    findOption(SKIN_TONES, profile.customization.skinTone).color
  );
  const hair = hexToNumber(
    findOption(HAIR_COLORS, profile.customization.hairColor).color
  );
  const outfit = findOption(OUTFITS, profile.customization.outfit);
  const outfitMain = hexToNumber(outfit.color);
  const outfitAccent = hexToNumber(outfit.accent ?? '#FDE68A');

  g.fillStyle(0x020617, 0.45);
  g.fillEllipse(0, 18, 34, 14);

  if (isActive) {
    g.lineStyle(2.5, profile.id === 'p1' ? 0x2dd4bf : 0xf472b6, 0.95);
    g.strokeEllipse(0, 16, 40, 18);
  }

  g.fillStyle(outfitMain, 1);
  g.fillRoundedRect(-11, 2, 22, 16, 6);
  g.fillStyle(outfitAccent, 0.92);
  g.fillTriangle(-9, 2, 10, 4, 8, 14);

  g.fillStyle(outfitMain, 1);
  g.fillRoundedRect(-13, -6, 26, 13, 6);
  g.lineStyle(1.5, 0xfef3c7, 0.45);
  g.strokeRoundedRect(-13, -6, 26, 13, 6);

  const hairStyle = profile.customization.hairStyle;
  if (hairStyle === 'long-silky' || hairStyle === 'wavy-bob') {
    g.fillStyle(hair, 1);
    const len = hairStyle === 'long-silky' ? 12 : 4;
    g.fillRoundedRect(-13, -20, 26, 22 + len, 10);
  } else if (hairStyle === 'high-ponytail') {
    g.fillStyle(hair, 1);
    g.fillCircle(0, -28, 7);
  }

  g.fillStyle(skin, 1);
  g.fillCircle(0, -14, 11);
  g.lineStyle(1.5, 0x0f172a, 0.35);
  g.strokeCircle(0, -14, 11);

  g.fillStyle(0x0f172a, 1);
  g.fillCircle(-3.5, -13, 1.5);
  g.fillCircle(3.5, -13, 1.5);

  g.fillStyle(hair, 1);
  if (hairStyle === 'curly-crop') {
    g.fillCircle(-6, -22, 5.5);
    g.fillCircle(0, -24, 6);
    g.fillCircle(6, -22, 5.5);
  } else {
    g.fillEllipse(0, -21, 22, 10);
  }
}

export function syncLocalPortraitTexture(
  scene: Phaser.Scene,
  key: string,
  dataUrl: string | null,
  onReady: (textureKey: string | null) => void
): void {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    onReady(null);
    return;
  }

  if (scene.textures.exists(key)) {
    onReady(key);
    return;
  }

  const img = new Image();
  img.onload = () => {
    if (!scene.sys || !scene.sys.isActive()) return;
    if (scene.textures.exists(key)) {
      onReady(key);
      return;
    }
    const canvasTex = scene.textures.createCanvas(key, 64, 64);
    if (!canvasTex) {
      onReady(null);
      return;
    }
    const ctx = canvasTex.getContext();
    ctx.clearRect(0, 0, 64, 64);
    ctx.save();
    ctx.beginPath();
    ctx.arc(32, 32, 29, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, 64, 64);
    ctx.drawImage(img, 0, 0, 64, 64);
    ctx.restore();
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 32, 29, 0, Math.PI * 2);
    ctx.stroke();
    canvasTex.refresh();
    onReady(key);
  };
  img.onerror = () => onReady(null);
  img.src = dataUrl;
}

export function drawKrathongGraphic(
  g: Phaser.GameObjects.Graphics,
  design: KrathongDesign,
  tier: KrathongQualityTier
): void {
  g.clear();

  const baseColor = hexToNumber(findOption(KRATHONG_BASES, design.base).color);
  const flowerColor = hexToNumber(
    findOption(KRATHONG_FLOWERS, design.flower).color
  );
  const glowColor = hexToNumber(findOption(KRATHONG_GLOWS, design.glow).color);

  g.lineStyle(1.5, 0x93c5fd, tier === 'celestial' ? 0.75 : 0.45);
  g.strokeEllipse(0, 5, tier === 'celestial' ? 54 : 44, 22);

  if (tier === 'celestial') {
    g.fillStyle(glowColor, 0.25);
    g.fillCircle(0, 0, 30);
  } else if (tier === 'radiant') {
    g.fillStyle(glowColor, 0.16);
    g.fillCircle(0, 0, 24);
  }

  g.fillStyle(baseColor, 1);
  g.fillEllipse(0, 3, 34, 18);

  const petalCount = tier === 'celestial' ? 8 : 6;
  for (let i = 0; i < petalCount; i += 1) {
    const angle = (i / petalCount) * Math.PI * 2;
    const px = Math.cos(angle) * 12;
    const py = Math.sin(angle) * 6 + 1;
    g.fillStyle(i % 2 === 0 ? flowerColor : baseColor, 0.95);
    g.fillCircle(px, py, 5);
  }

  g.fillStyle(flowerColor, 1);
  g.fillCircle(0, 0, 7);
  g.fillStyle(0xfef9c3, 1);
  g.fillRect(-2, -10, 4, 10);
  g.fillStyle(glowColor, 1);
  g.fillCircle(0, -13, 4);
}