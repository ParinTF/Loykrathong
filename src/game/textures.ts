import * as THREE from 'three';
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
  PlayerId,
  PlayerProfile,
} from '../domain/types';

export interface Festival3DTextureBank {
  grass: THREE.CanvasTexture;
  sandstone: THREE.CanvasTexture;
  teak: THREE.CanvasTexture;
  water: THREE.CanvasTexture;
  goldGlow: THREE.CanvasTexture;
  pinkGlow: THREE.CanvasTexture;
  tealGlow: THREE.CanvasTexture;
}

export interface Character3DRig {
  id: PlayerId;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  activeRing: THREE.Mesh;
  nameSprite: THREE.Sprite;
  emoteSprite: THREE.Sprite;
  portraitSprite: THREE.Sprite | null;
  lastNameText: string;
  lastConfigKey: string;
  lastPortraitKey: string | null;
  targetYaw: number;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function createFestival3DTextures(): Festival3DTextureBank {
  // 1. Lush botanical night lawn texture
  const grassCanvas = makeCanvas(256, 256);
  const gCtx = grassCanvas.getContext('2d');
  if (gCtx) {
    gCtx.fillStyle = '#0D2628';
    gCtx.fillRect(0, 0, 256, 256);
    const patches = [
      { x: 48, y: 52, r: 54, c: 'rgba(20, 83, 45, 0.5)' },
      { x: 186, y: 74, r: 62, c: 'rgba(17, 94, 89, 0.42)' },
      { x: 112, y: 188, r: 68, c: 'rgba(22, 101, 52, 0.38)' },
      { x: 214, y: 208, r: 46, c: 'rgba(15, 118, 110, 0.35)' },
    ];
    for (const p of patches) {
      gCtx.fillStyle = p.c;
      gCtx.beginPath();
      gCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      gCtx.fill();
    }
    gCtx.strokeStyle = 'rgba(52, 211, 153, 0.28)';
    gCtx.lineWidth = 2;
    for (let i = 0; i < 28; i += 1) {
      const tx = ((i * 73) % 236) + 10;
      const ty = ((i * 137) % 236) + 12;
      gCtx.beginPath();
      gCtx.moveTo(tx, ty);
      gCtx.lineTo(tx - 4, ty - 10);
      gCtx.moveTo(tx, ty);
      gCtx.lineTo(tx + 3, ty - 11);
      gCtx.stroke();
    }
    // Fallen marigold & pink lotus petals
    const petals = [
      [64, 90, '#FBBF24'],
      [178, 152, '#F472B6'],
      [212, 68, '#FEF3C7'],
      [38, 210, '#F59E0B'],
    ] as const;
    for (const [px, py, col] of petals) {
      gCtx.fillStyle = col;
      gCtx.beginPath();
      gCtx.arc(px, py, 3.2, 0, Math.PI * 2);
      gCtx.fill();
    }
  }
  const grass = new THREE.CanvasTexture(grassCanvas);
  grass.colorSpace = THREE.SRGBColorSpace;
  grass.wrapS = THREE.RepeatWrapping;
  grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(16, 11);

  // 2. Warm Sukhothai sandstone & brick paver texture
  const stoneCanvas = makeCanvas(256, 256);
  const sCtx = stoneCanvas.getContext('2d');
  if (sCtx) {
    sCtx.fillStyle = '#382B47';
    sCtx.fillRect(0, 0, 256, 256);
    const blocks = [
      { x: 6, y: 6, w: 114, h: 74, c: '#5B4366' },
      { x: 128, y: 6, w: 122, h: 74, c: '#664B6E' },
      { x: 6, y: 88, w: 76, h: 78, c: '#61476B' },
      { x: 90, y: 88, w: 160, h: 78, c: '#533E5E' },
      { x: 6, y: 174, w: 152, h: 76, c: '#5E4568' },
      { x: 166, y: 174, w: 84, h: 76, c: '#4F3B5A' },
    ];
    for (const b of blocks) {
      sCtx.fillStyle = b.c;
      sCtx.beginPath();
      sCtx.roundRect(b.x, b.y, b.w, b.h, 10);
      sCtx.fill();
      sCtx.strokeStyle = 'rgba(253, 230, 138, 0.26)';
      sCtx.lineWidth = 2;
      sCtx.stroke();
    }
  }
  const sandstone = new THREE.CanvasTexture(stoneCanvas);
  sandstone.colorSpace = THREE.SRGBColorSpace;
  sandstone.wrapS = THREE.RepeatWrapping;
  sandstone.wrapT = THREE.RepeatWrapping;

  // 3. Carved Thai teakwood plank texture
  const teakCanvas = makeCanvas(256, 256);
  const tCtx = teakCanvas.getContext('2d');
  if (tCtx) {
    tCtx.fillStyle = '#6D3B1E';
    tCtx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      tCtx.fillStyle = y % 64 === 0 ? '#784222' : '#63351A';
      tCtx.fillRect(0, y, 256, 30);
      tCtx.fillStyle = '#3E200E';
      tCtx.fillRect(0, y + 30, 256, 2);
      tCtx.fillStyle = 'rgba(253, 230, 138, 0.35)';
      tCtx.beginPath();
      tCtx.arc(14, y + 15, 2.2, 0, Math.PI * 2);
      tCtx.arc(242, y + 15, 2.2, 0, Math.PI * 2);
      tCtx.fill();
    }
  }
  const teak = new THREE.CanvasTexture(teakCanvas);
  teak.colorSpace = THREE.SRGBColorSpace;
  teak.wrapS = THREE.RepeatWrapping;
  teak.wrapT = THREE.RepeatWrapping;
  teak.repeat.set(2, 5);

  // 4. Shimmering sapphire moonlight river ripple texture
  const waterCanvas = makeCanvas(256, 256);
  const wCtx = waterCanvas.getContext('2d');
  if (wCtx) {
    const grad = wCtx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#081B3E');
    grad.addColorStop(0.5, '#0D2B5E');
    grad.addColorStop(1, '#081B3E');
    wCtx.fillStyle = grad;
    wCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 22; i += 1) {
      const rx = (i * 59) % 220;
      const ry = (i * 43) % 244;
      const rw = 36 + (i % 3) * 20;
      wCtx.fillStyle =
        i % 4 === 0 ? 'rgba(254, 240, 138, 0.24)' : 'rgba(125, 211, 252, 0.18)';
      wCtx.beginPath();
      wCtx.roundRect(rx, ry, rw, 4, 2);
      wCtx.fill();
    }
  }
  const water = new THREE.CanvasTexture(waterCanvas);
  water.colorSpace = THREE.SRGBColorSpace;
  water.wrapS = THREE.RepeatWrapping;
  water.wrapT = THREE.RepeatWrapping;
  water.repeat.set(10, 4);

  const makeGlow = (c0: string, c1: string) => {
    const c = makeCanvas(128, 128);
    const ctx = c.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      g.addColorStop(0, c0);
      g.addColorStop(0.45, c1);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  return {
    grass,
    sandstone,
    teak,
    water,
    goldGlow: makeGlow('rgba(254, 240, 138, 0.95)', 'rgba(245, 158, 11, 0.42)'),
    pinkGlow: makeGlow('rgba(249, 168, 212, 0.92)', 'rgba(236, 72, 153, 0.36)'),
    tealGlow: makeGlow('rgba(153, 246, 228, 0.92)', 'rgba(20, 184, 166, 0.36)'),
  };
}

export function createGlowSprite(
  texture: THREE.Texture,
  scale: number,
  opacity = 0.85
): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

export function createTextPillSprite(
  text: string,
  options?: {
    bgColor?: string;
    borderColor?: string;
    textColor?: string;
    worldHeight?: number;
    fontSize?: number;
  }
): THREE.Sprite {
  const bgColor = options?.bgColor ?? 'rgba(10, 15, 36, 0.88)';
  const borderColor = options?.borderColor ?? 'rgba(253, 230, 138, 0.8)';
  const textColor = options?.textColor ?? '#F8FAFC';
  const worldHeight = options?.worldHeight ?? 0.52;
  const fontSize = options?.fontSize ?? 30;

  const canvas = makeCanvas(512, 96);
  const ctx = canvas.getContext('2d');
  let aspect = 512 / 96;

  if (ctx) {
    const fontSpec = `700 ${fontSize}px "Noto Sans Thai", "Sarabun", "Leelawadee UI", system-ui, sans-serif`;
    ctx.font = fontSpec;
    const measured = Math.ceil(ctx.measureText(text || ' ').width);
    const w = Math.max(140, Math.min(900, measured + 56));
    const h = 76;
    canvas.width = w;
    canvas.height = h;
    aspect = w / h;

    ctx.font = fontSpec;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 34);
    ctx.fill();

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(worldHeight * aspect, worldHeight, 1);
  sprite.renderOrder = 20;
  return sprite;
}

export function updateTextPillSprite(
  sprite: THREE.Sprite,
  text: string,
  options?: {
    bgColor?: string;
    borderColor?: string;
    textColor?: string;
    worldHeight?: number;
  }
): void {
  const replacement = createTextPillSprite(text, options);
  const oldMat = sprite.material;
  oldMat.map?.dispose();
  oldMat.dispose();
  sprite.material = replacement.material;
  sprite.scale.copy(replacement.scale);
}

export function buildCharacter3DRig(profile: PlayerProfile): Character3DRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Soft shadow disc on ground
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 20),
    new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  // Active player selection ring
  const ringColor = profile.id === 'p1' ? 0x2dd4bf : 0xf472b6;
  const activeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.48, 0.6, 28),
    new THREE.MeshBasicMaterial({
      color: ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    })
  );
  activeRing.rotation.x = -Math.PI / 2;
  activeRing.position.y = 0.03;
  root.add(activeRing);

  const leftArm = new THREE.Mesh();
  const rightArm = new THREE.Mesh();

  const nameSprite = createTextPillSprite(profile.name || 'ผู้เล่น', {
    bgColor:
      profile.id === 'p1' ? 'rgba(13, 148, 136, 0.92)' : 'rgba(219, 39, 119, 0.92)',
    borderColor: '#FEF3C7',
    worldHeight: 0.46,
  });
  nameSprite.position.set(0, 2.08, 0);
  root.add(nameSprite);

  const emoteSprite = createTextPillSprite('', {
    bgColor: 'rgba(15, 23, 42, 0.94)',
    borderColor: '#FDE68A',
    textColor: '#FEF9C3',
    worldHeight: 0.5,
  });
  emoteSprite.position.set(0, 2.68, 0);
  emoteSprite.visible = false;
  root.add(emoteSprite);

  const rig: Character3DRig = {
    id: profile.id,
    root,
    bodyPivot,
    leftArm,
    rightArm,
    activeRing,
    nameSprite,
    emoteSprite,
    portraitSprite: null,
    lastNameText: profile.name,
    lastConfigKey: '',
    lastPortraitKey: null,
    targetYaw: 0,
  };

  syncCharacter3DRig(rig, profile, true);
  return rig;
}

export function syncCharacter3DRig(
  rig: Character3DRig,
  profile: PlayerProfile,
  isActive: boolean
): void {
  rig.activeRing.visible = isActive;

  const displayName =
    profile.name || (profile.id === 'p1' ? 'ผู้เล่น 1' : 'ผู้เล่น 2');
  if (rig.lastNameText !== displayName) {
    rig.lastNameText = displayName;
    updateTextPillSprite(rig.nameSprite, displayName, {
      bgColor:
        profile.id === 'p1'
          ? 'rgba(13, 148, 136, 0.92)'
          : 'rgba(219, 39, 119, 0.92)',
      borderColor: '#FEF3C7',
      worldHeight: 0.46,
    });
  }

  const configKey = `${profile.customization.skinTone}|${profile.customization.hairStyle}|${profile.customization.hairColor}|${profile.customization.outfit}`;
  if (rig.lastConfigKey !== configKey) {
    rig.lastConfigKey = configKey;
    while (rig.bodyPivot.children.length > 0) {
      const child = rig.bodyPivot.children[0];
      rig.bodyPivot.remove(child);
    }

    const skinHex = findOption(SKIN_TONES, profile.customization.skinTone).color;
    const hairHex = findOption(HAIR_COLORS, profile.customization.hairColor).color;
    const outfitOpt = findOption(OUTFITS, profile.customization.outfit);

    const skinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skinHex),
      roughness: 0.65,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hairHex),
      roughness: 0.55,
    });
    const outfitMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(outfitOpt.color),
      roughness: 0.45,
      metalness: 0.12,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(outfitOpt.accent ?? '#FDE68A'),
      roughness: 0.32,
      metalness: 0.35,
    });

    // Lower Thai silk sarong / chong kraben
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.31, 0.52, 18),
      outfitMat
    );
    skirt.position.y = 0.3;
    skirt.castShadow = true;
    rig.bodyPivot.add(skirt);

    // Golden hem belt
    const belt = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.032, 8, 20),
      accentMat
    );
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.55;
    rig.bodyPivot.add(belt);

    // Upper torso
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.25, 0.48, 18),
      outfitMat
    );
    torso.position.y = 0.78;
    torso.castShadow = true;
    rig.bodyPivot.add(torso);

    // Diagonal Thai Sabai sash across chest
    const sabai = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.14, 0.54),
      accentMat
    );
    sabai.position.set(0, 0.82, 0);
    sabai.rotation.z = -0.48;
    rig.bodyPivot.add(sabai);

    // Arms
    const armGeo = new THREE.CapsuleGeometry(0.075, 0.28, 6, 12);
    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(-0.33, 0.78, 0);
    leftArm.castShadow = true;
    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(0.33, 0.78, 0);
    rightArm.castShadow = true;
    rig.bodyPivot.add(leftArm, rightArm);
    rig.leftArm = leftArm;
    rig.rightArm = rightArm;

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 22, 20),
      skinMat
    );
    head.position.y = 1.34;
    head.castShadow = true;
    rig.bodyPivot.add(head);

    // Eyes & cheeks facing +Z
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const eyeGeo = new THREE.SphereGeometry(0.035, 10, 10);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.1, 1.35, 0.27);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.1, 1.35, 0.27);

    const cheekMat = new THREE.MeshBasicMaterial({
      color: 0xf472b6,
      transparent: true,
      opacity: 0.45,
    });
    const cheekGeo = new THREE.SphereGeometry(0.042, 8, 8);
    const cheekL = new THREE.Mesh(cheekGeo, cheekMat);
    cheekL.position.set(-0.16, 1.29, 0.25);
    const cheekR = new THREE.Mesh(cheekGeo, cheekMat);
    cheekR.position.set(0.16, 1.29, 0.25);
    rig.bodyPivot.add(eyeL, eyeR, cheekL, cheekR);

    // 3D Hairstyles
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.315, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    cap.position.y = 1.36;
    cap.rotation.x = -0.18;
    rig.bodyPivot.add(cap);

    const hs = profile.customization.hairStyle;
    if (hs === 'long-silky') {
      const backHair = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.62, 0.22),
        hairMat
      );
      backHair.position.set(0, 1.12, -0.18);
      rig.bodyPivot.add(backHair);
    } else if (hs === 'wavy-bob') {
      const bob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.31, 0.36, 0.32, 18),
        hairMat
      );
      bob.position.set(0, 1.24, -0.04);
      rig.bodyPivot.add(bob);
    } else if (hs === 'high-ponytail') {
      const tie = new THREE.Mesh(
        new THREE.TorusGeometry(0.08, 0.025, 8, 14),
        accentMat
      );
      tie.position.set(0, 1.62, -0.14);
      const tail = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.42, 14),
        hairMat
      );
      tail.position.set(0, 1.48, -0.26);
      tail.rotation.x = -2.4;
      rig.bodyPivot.add(tie, tail);
    } else if (hs === 'curly-crop') {
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const curl = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 10, 10),
          hairMat
        );
        curl.position.set(Math.cos(a) * 0.22, 1.56, Math.sin(a) * 0.22);
        rig.bodyPivot.add(curl);
      }
    }
  }

  // Sync optional local face photo medallion above character
  const wantPortraitKey =
    profile.portrait.status === 'ready' && profile.portrait.dataUrl
      ? `${profile.id}:${profile.portrait.updatedAt ?? 'ready'}`
      : null;

  if (rig.lastPortraitKey !== wantPortraitKey) {
    rig.lastPortraitKey = wantPortraitKey;
    if (rig.portraitSprite) {
      rig.root.remove(rig.portraitSprite);
      rig.portraitSprite.material.map?.dispose();
      rig.portraitSprite.material.dispose();
      rig.portraitSprite = null;
    }

    if (wantPortraitKey && profile.portrait.dataUrl) {
      const img = new Image();
      img.onload = () => {
        if (rig.lastPortraitKey !== wantPortraitKey) return;
        const c = makeCanvas(128, 128);
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(64, 64, 58, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, 0, 0, 128, 128);
          ctx.restore();
          ctx.strokeStyle = '#FDE68A';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(64, 64, 58, 0, Math.PI * 2);
          ctx.stroke();
        }
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        const sp = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: tex, transparent: true })
        );
        sp.scale.set(0.68, 0.68, 1);
        sp.position.set(0, 1.38, 0.22);
        rig.root.add(sp);
        rig.portraitSprite = sp;
      };
      img.src = profile.portrait.dataUrl;
    }
  }
}

export function buildKrathong3DGroup(
  design: KrathongDesign,
  tier: KrathongQualityTier,
  glowTex: THREE.Texture
): THREE.Group {
  const group = new THREE.Group();
  const baseOpt = findOption(KRATHONG_BASES, design.base);
  const flowerOpt = findOption(KRATHONG_FLOWERS, design.flower);
  const glowOpt = findOption(KRATHONG_GLOWS, design.glow);

  // Water ripple ring
  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(0.56, 0.72, 24),
    new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: tier === 'celestial' ? 0.7 : 0.42,
    })
  );
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.y = 0.02;
  group.add(ripple);

  // Sculpted banana-trunk / coconut / bread base
  const baseMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.36, 0.18, 20),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseOpt.color),
      roughness: 0.55,
    })
  );
  baseMesh.position.y = 0.1;
  group.add(baseMesh);

  // Ring of 3D folded banana-leaf cones (กลีบกระทง 3 มิติ)
  const petalCount = tier === 'celestial' ? 12 : tier === 'radiant' ? 10 : 8;
  const leafMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseOpt.accent ?? baseOpt.color),
    roughness: 0.45,
  });
  const flowerMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(flowerOpt.color),
    roughness: 0.4,
  });

  for (let i = 0; i < petalCount; i += 1) {
    const a = (i / petalCount) * Math.PI * 2;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 6), leafMat);
    cone.position.set(Math.cos(a) * 0.4, 0.24, Math.sin(a) * 0.4);
    cone.rotation.z = -Math.cos(a) * 0.42;
    cone.rotation.x = Math.sin(a) * 0.42;
    group.add(cone);

    const blossom = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 10, 10),
      flowerMat
    );
    blossom.position.set(Math.cos(a) * 0.27, 0.23, Math.sin(a) * 0.27);
    group.add(blossom);
  }

  // Central lotus mound + wax candle + 3 incense sticks + glowing flame
  const centerFlower = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 12),
    flowerMat
  );
  centerFlower.position.y = 0.22;
  group.add(centerFlower);

  const candle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.04, 0.34, 10),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 })
  );
  candle.position.y = 0.42;
  group.add(candle);

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.16, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(glowOpt.color) })
  );
  flame.position.y = 0.64;
  group.add(flame);

  const aura = createGlowSprite(
    glowTex,
    tier === 'celestial' ? 1.85 : tier === 'radiant' ? 1.45 : 1.1,
    0.85
  );
  aura.position.y = 0.56;
  group.add(aura);

  return group;
}
