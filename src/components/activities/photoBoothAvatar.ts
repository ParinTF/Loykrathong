import * as THREE from 'three';
import type { PhotoBackdropId, PlayerId, PlayerProfile } from '../../domain/types';
import { buildCharacter3DRig, type Character3DRig } from '../../game/textures';
import { drawPhotoCover, loadPhotoImage } from './photoBoothImages';

const BACKDROP_LOOKS: Record<PhotoBackdropId, { tint: string; brightness: number; frameShift: number }> = {
  sala: { tint: '#101a3436', brightness: .78, frameShift: 0 },
  yipeng: { tint: '#65345638', brightness: .88, frameShift: -.1 },
  river: { tint: '#11294543', brightness: .77, frameShift: .1 },
  'cream-minimal': { tint: '#c2805950', brightness: .88, frameShift: 0 },
};

const SITTINGS = [
  { yaw: .11, tilt: 0, arm: .09, height: 1.17 },
  { yaw: .28, tilt: .072, arm: .46, height: 1.20 },
  { yaw: -.17, tilt: -.042, arm: .24, height: 1.15 },
  { yaw: .16, tilt: .05, arm: .98, height: 1.19 },
];

async function waitForPortrait(profile: PlayerProfile): Promise<Character3DRig> {
  let portraitReady: (() => void) | undefined;
  const loaded = new Promise<void>((resolve) => { portraitReady = resolve; });
  const rig = buildCharacter3DRig(profile, portraitReady);
  if (!rig.lastPortraitKey) return rig;
  let timer: number | undefined;
  const timeout = new Promise<void>((resolve) => { timer = window.setTimeout(resolve, 1000); });
  await Promise.race([loaded, timeout]);
  window.clearTimeout(timer);
  return rig;
}

function disposeRig(rig: Character3DRig): void {
  rig.lastPortraitKey = null;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  rig.root.traverse((part) => {
    if (part instanceof THREE.Mesh) {
      geometries.add(part.geometry);
      for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
        materials.add(material);
      }
    } else if (part instanceof THREE.Sprite) {
      materials.add(part.material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => {
    if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
    material.dispose();
  });
}

export async function createPhotoBoothAvatarStudio(
  profiles: PlayerProfile[],
  aspect: number,
  backdrop: PhotoBackdropId,
) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  const rigs = new Map<PlayerId, Character3DRig>();
  const dispose = () => {
    rigs.forEach(disposeRig);
    renderer.dispose();
    renderer.forceContextLoss();
  };

  try {
    const background = await loadPhotoImage(`${import.meta.env.BASE_URL}invite/moonlit-festival.webp`);
    if (!background) throw new Error('The festival portrait background could not be loaded.');
    const look = BACKDROP_LOOKS[backdrop] ?? BACKDROP_LOOKS.sala;
    const backdropCanvas = document.createElement('canvas');
    const width = 512;
    const height = Math.round(width / aspect);
    backdropCanvas.width = width * 2;
    backdropCanvas.height = height;
    const backdropContext = backdropCanvas.getContext('2d');
    if (!backdropContext) throw new Error('The festival portrait background could not be rendered.');
    const bleed = width * (.14 + Math.abs(look.frameShift));
    backdropContext.filter = `blur(6px) brightness(${look.brightness})`;
    drawPhotoCover(backdropContext, background, background.naturalWidth, background.naturalHeight,
      -bleed + width * look.frameShift, -bleed, backdropCanvas.width + 2 * bleed, height + 2 * bleed);
    backdropContext.filter = 'none';
    backdropContext.fillStyle = look.tint;
    backdropContext.fillRect(0, 0, backdropCanvas.width, height);

    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, aspect, .1, 15);
    const fill = new THREE.HemisphereLight('#fff1df', '#8c81b2', 1.8);
    const key = new THREE.DirectionalLight('#ffdfb3', 2.3);
    key.position.set(-3, 5, 4);
    const rim = new THREE.DirectionalLight('#95b4fc', 1.9);
    rim.position.set(2, 2, -3);
    scene.add(fill, key, rim);

    for (const profile of profiles) {
      const rig = await waitForPortrait(profile);
      rigs.set(profile.id, rig);
      for (const child of rig.root.children) child.visible = child === rig.bodyPivot;
      rig.root.visible = false;
      scene.add(rig.root);
    }

    return {
      draw(ctx: CanvasRenderingContext2D, player: PlayerId, shot: number,
        x: number, y: number, w: number, h: number) {
        const rig = rigs.get(player)!;
        const direction = player === 'p1' ? 1 : -1;
        const sitting = SITTINGS[shot];
        rigs.forEach((candidate) => { candidate.root.visible = candidate === rig; });
        rig.bodyPivot.rotation.y = sitting.yaw * direction;
        rig.bodyPivot.rotation.z = -sitting.tilt * direction;
        rig.leftArm.rotation.z = player === 'p2' ? -sitting.arm : -.13;
        rig.rightArm.rotation.z = player === 'p1' ? sitting.arm : .13;
        camera.position.set(direction * .025, 1.28, 2.75);
        camera.lookAt(0, sitting.height, 0);
        renderer.render(scene, camera);
        ctx.drawImage(backdropCanvas, player === 'p1' ? 0 : width, 0, width, height, x, y, w, h);
        ctx.drawImage(renderer.domElement, x, y, w, h);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
