import * as THREE from 'three';
import {
  HAIR_COLORS,
  OUTFITS,
  SKIN_TONES,
  findOption,
} from '../domain/customizationCatalog';
import type {
  PlayerId,
  PlayerProfile,
} from '../domain/types';

export interface FestivalGlowTextures {
  goldGlow: THREE.CanvasTexture;
  pinkGlow: THREE.CanvasTexture;
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

export function createFestivalGlowTextures(): FestivalGlowTextures {
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
    goldGlow: makeGlow('rgba(254, 240, 138, 0.95)', 'rgba(245, 158, 11, 0.42)'),
    pinkGlow: makeGlow('rgba(249, 168, 212, 0.92)', 'rgba(236, 72, 153, 0.36)'),
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
