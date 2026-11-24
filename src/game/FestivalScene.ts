import * as THREE from 'three';
import { getFestivalModels, type FestivalAssets, type ModelBatch, type ModelPlacement } from './festival/assets';
import { createOffering, type FloatingOffering } from './festival/offerings';
import { populateScenery, type RiverLight, type Scenery } from './festival/scenery';
import { FestivalRiver, riverHeight } from './festival/river';
import { addFestivalLights, addPlayerContactShadows } from './festival/lighting';
import { graphicsProfile, rendererPixelRatio, type GraphicsProfile } from './graphics';
export { preloadFestivalModels } from './festival/assets';
import { addFestivalSky } from './festival/sky';
import { addFestivalLandscape } from './festival/terrain';
import { WATER_LEVEL, toWorldX as to3DX, toWorldZ as to3DZ } from './festival/space';
import type {
  CoupleEmoteEvent,
  Direction,
  GameState,
  PlayerId,
} from '../domain/types';
import {
  PIER_WALKABLE_RECT,
  WORLD_SPOTS,
} from '../domain/worldMap';
import {
  buildCharacter3DRig,
  createFestivalGlowTextures,
  createGlowSprite,
  createTextPillSprite,
  syncCharacter3DRig,
  updateTextPillSprite,
  type Character3DRig,
  type FestivalGlowTextures,
} from './textures';

export type CameraPreset = 'follow' | 'close' | 'overview';

export interface SceneBridgeCallbacks {
  onMove: (playerId: PlayerId, dx: number, dy: number, facing: Direction) => void;
  onInteractSpot: (spotId: string) => void;
  onCameraPreset?: (preset: CameraPreset) => void;
}

interface Lantern3DVisual {
  id: string;
  bulbMats: THREE.MeshStandardMaterial[];
  ringMat: THREE.MeshBasicMaterial;
  glowSprite: THREE.Sprite;
}

interface Krathong3DVisual extends FloatingOffering {
  id: string;
  basePx: number;
  basePy: number;
}

interface SkyLantern3D {
  pose: ModelPlacement;
  halo: THREE.Sprite;
  baseX: number;
  baseZ: number;
  y: number;
  speed: number;
  phase: number;
}

function yawFromFacing(facing: Direction): number {
  switch (facing) {
    case 'down':
      return 0;
    case 'right':
      return Math.PI / 2;
    case 'up':
      return Math.PI;
    case 'left':
      return -Math.PI / 2;
  }
}

function lerpAngle(current: number, target: number, t: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

export class FestivalScene {
  public readonly initialReducedMotion: boolean;
  private callbacks: SceneBridgeCallbacks;
  private snapshot: GameState;
  private reducedMotion = false;
  private partnerPresent = false;

  private container: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private textures: FestivalGlowTextures | null = null;
  private assets: FestivalAssets | null = null;
  private scenery: Scenery | null = null;
  private river: FestivalRiver | null = null;
  private moon: THREE.DirectionalLight | null = null;
  private quality: GraphicsProfile | null = null;
  private nextDetailUpdate = 0;
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private destroyed = false;

  // 3D Camera Orbit & Presets
  private cameraYaw = 0;
  private targetCameraYaw = 0;
  private cameraPreset: CameraPreset = 'follow';
  private zoomFactor = 1.0;
  private orbitDragPointerId: number | null = null;
  private orbitDragStartX = 0;
  private orbitDragStartYaw = 0;
  private pointerMovedDist = 0;

  // Scene Actors
  private playerRigs: Record<PlayerId, Character3DRig> | null = null;
  private prevPositions: Record<PlayerId, { x: number; y: number }> = {
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 0 },
  };
  private walkPhase: Record<PlayerId, number> = { p1: 0, p2: 0 };
  private emoteExpireAt: Record<PlayerId, number> = { p1: 0, p2: 0 };

  private lanternVisuals: Lantern3DVisual[] = [];
  private coupleWishLantern: {
    group: THREE.Group;
    halo: THREE.Sprite;
    y: number;
    baseX: number;
    baseZ: number;
  } | null = null;
  private krathongVisuals: Map<string, Krathong3DVisual> = new Map();
  private renderedReleases: GameState['releasedKrathongs'] | null = null;
  private releaseCinematic: {
    krathongId: string;
    startedAt: number;
    durationMs: number;
    onComplete: () => void;
  } | null = null;
  private ambientKrathongs: (FloatingOffering & {
    basePx: number;
    basePy: number;
  })[] = [];
  private skyLanterns: SkyLantern3D[] = [];
  private skyLanternBatch: ModelBatch | null = null;
  private skyLanternPoses: ModelPlacement[] = [];
  private fireflies: {
    sprite: THREE.Sprite;
    ox: number;
    oy: number;
    oz: number;
    phase: number;
  }[] = [];
  private spotHitMeshes: { spotId: string; mesh: THREE.Object3D }[] = [];
  private nearbyHaloGroup: THREE.Group | null = null;
  private craftPreviewGroup: THREE.Group | null = null;
  private lastCraftSignature = '';
  private coupleTetherLine: THREE.Line | null = null;
  private coupleHeartSprite: THREE.Sprite | null = null;

  // Input State
  private keysDown: Set<string> = new Set();
  private modalBlocked = false;
  private touchVector = { x: 0, y: 0 };
  private interactQueued = false;

  constructor(
    initialState: GameState,
    callbacks: SceneBridgeCallbacks,
    initialReducedMotion = false
  ) {
    this.snapshot = initialState;
    this.callbacks = callbacks;
    this.reducedMotion = initialReducedMotion;
    this.initialReducedMotion = initialReducedMotion;
    this.prevPositions = {
      p1: {
        x: initialState.players.p1.position.x,
        y: initialState.players.p1.position.y,
      },
      p2: {
        x: initialState.players.p2.position.x,
        y: initialState.players.p2.position.y,
      },
    };
  }

  public mount(container: HTMLElement): void {
    this.assets = getFestivalModels();
    this.destroyed = false;
    this.container = container;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const compact = width < 760;

    const renderer = new THREE.WebGLRenderer({
      antialias: !compact,
      powerPreference: 'high-performance',
    });
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#202E49');
    scene.fog = new THREE.FogExp2('#48556D', 0.0175);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(compact ? 64 : 50, width / height, 0.24, 190);
    camera.position.set(0, 12, 16);
    this.camera = camera;

    this.textures = createFestivalGlowTextures();

    this.moon = addFestivalLights(scene);
    this.buildSkyAndLanterns(scene, compact);
    addFestivalLandscape(scene);
    this.scenery = populateScenery(scene, this.assets, this.textures.goldGlow, compact);
    this.river = new FestivalRiver(compact, this.scenery.riverLights);
    scene.add(this.river.mesh);
    this.buildAmbientLife(scene);
    this.buildInteractiveSpots(scene);
    this.buildPlayers(scene);

    this.applyGraphics(width, height);
    this.attachDomListeners(renderer.domElement);
    this.refreshVisualState();
    this.snapCameraImmediate();

    this.lastFrameTime = performance.now();
    const animate = (now: number) => {
      if (this.destroyed) return;
      this.rafId = window.requestAnimationFrame(animate);
      if (document.visibilityState === 'hidden') {
        this.lastFrameTime = now;
        return;
      }
      const deltaMs = Math.min(50, Math.max(1, now - this.lastFrameTime));
      this.lastFrameTime = now;
      this.tick(now, deltaMs);
      if (this.camera && this.quality && now >= this.nextDetailUpdate) {
        this.nextDetailUpdate = now + 120;
        this.scenery?.updateDetail(this.camera, this.quality);
      }
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    this.rafId = window.requestAnimationFrame(animate);
  }

  public destroy(): void {
    this.destroyed = true;
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.detachDomListeners();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.textures) {
      Object.values(this.textures).forEach((tex) => tex.dispose());
      this.textures = null;
    }

    if (this.scene) this.assets?.dispose(this.scene);
    this.moon?.shadow.dispose();
    this.moon = null;
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
      this.renderer = null;
    }
    this.scenery = null;
    this.river = null;
    this.skyLanternBatch = null;
    this.skyLanternPoses = [];
    this.skyLanterns = [];
    this.coupleWishLantern = null;
    this.releaseCinematic = null;
    this.krathongVisuals.clear();
    this.renderedReleases = null;
    this.scene = null;
    this.camera = null;
    this.container = null;
  }

  public setTouchVector(vx: number, vy: number): void {
    this.touchVector.x = vx;
    this.touchVector.y = vy;
  }

  public setModalBlocked(blocked: boolean): void {
    this.modalBlocked = blocked;
    if (blocked) {
      this.touchVector.x = 0;
      this.touchVector.y = 0;
      this.interactQueued = false;
      this.keysDown.clear();
    }
  }

  public cycleCameraPreset(): CameraPreset {
    const order: CameraPreset[] = ['follow', 'close', 'overview'];
    const idx = order.indexOf(this.cameraPreset);
    this.setCameraPreset(order[(idx + 1) % order.length]);
    return this.cameraPreset;
  }

  public setCameraPreset(preset: CameraPreset): void {
    if (this.cameraPreset === preset) return;
    this.cameraPreset = preset;
    this.callbacks.onCameraPreset?.(preset);
    this.nextDetailUpdate = 0;
  }

  public nudgeCameraYaw(deltaRad: number): void {
    this.targetCameraYaw += deltaRad;
  }

  public resetCameraAngle(): void {
    this.targetCameraYaw = 0;
    this.zoomFactor = 1.0;
  }

  public startReleaseCinematic(krathongId: string, onComplete: () => void): void {
    this.releaseCinematic = {
      krathongId,
      startedAt: performance.now(),
      durationMs: this.reducedMotion ? 1600 : 5400,
      onComplete,
    };
  }

  public stopReleaseCinematic(): void {
    if (!this.releaseCinematic) return;
    const cb = this.releaseCinematic.onComplete;
    this.releaseCinematic = null;
    cb();
  }

  public transformInputVector(rawX: number, rawY: number): { dx: number; dy: number } {
    // Rotate input by current cameraYaw so Up/W always walks "into" the 3D view
    const cosY = Math.cos(this.cameraYaw);
    const sinY = Math.sin(this.cameraYaw);
    const forward = -rawY;
    const dx = rawX * cosY + forward * -sinY;
    const dy = rawX * -sinY + forward * -cosY;
    return { dx, dy };
  }

  public showEmote(event: CoupleEmoteEvent): void {
    if (!this.playerRigs) return;
    const rig = this.playerRigs[event.playerId];
    if (!rig) return;
    updateTextPillSprite(rig.emoteSprite, `${event.emoji} ${event.text}`, {
      bgColor: 'rgba(15, 23, 42, 0.94)',
      borderColor: '#FDE68A',
      textColor: '#FEF9C3',
      worldHeight: 0.52,
    });
    rig.emoteSprite.visible = true;
    this.emoteExpireAt[event.playerId] = performance.now() + 4500;
  }

  public updateSnapshot(
    state: GameState,
    reducedMotion: boolean,
    partnerPresent = false
  ): void {
    const changedQuality = this.snapshot.settings.graphicsQuality !== state.settings.graphicsQuality;
    this.snapshot = state;
    this.reducedMotion = reducedMotion;
    this.partnerPresent = partnerPresent;
    if (!this.scene) return;
    if (changedQuality && this.container) this.applyGraphics(this.container.clientWidth, this.container.clientHeight);
    this.refreshVisualState();
  }

  private applyGraphics(width: number, height: number): void {
    if (!width || !height || !this.renderer || !this.camera || !this.moon) return;
    const compact = width < 760 || window.matchMedia('(pointer: coarse)').matches;
    const profile = graphicsProfile(this.snapshot.settings.graphicsQuality, compact);
    this.quality = profile;
    this.renderer.domElement.dataset.graphicsPreset = profile.preset;
    this.renderer.setDrawingBufferSize(width, height, rendererPixelRatio(profile, width, height, window.devicePixelRatio || 1));
    this.camera.aspect = width / height;
    this.camera.fov = width < 760 ? 64 : 50;
    this.camera.updateProjectionMatrix();

    const { shadow } = this.moon;
    if (profile.shadow !== shadow.mapSize.x) {
      shadow.dispose();
      shadow.map = null;
      shadow.mapPass = null;
      shadow.mapSize.setScalar(profile.shadow);
      this.renderer.shadowMap.needsUpdate = profile.shadow > 0;
    }
    this.moon.castShadow = profile.shadow > 0;
    this.renderer.shadowMap.enabled = profile.shadow > 0;
    this.river?.setLightingBudget(profile.waterLights);
    this.nextDetailUpdate = 0;
  }

  // =========================================================================
  // 3D WORLD CONSTRUCTION
  // =========================================================================

  private buildSkyAndLanterns(scene: THREE.Scene, compact: boolean): void {
    if (!this.textures) return;
    addFestivalSky(scene);

    if (!this.assets) return;
    for (let i = 0; i < (compact ? 15 : 24); i += 1) {
      const baseX = -36 + ((i * 19) % 73);
      const baseZ = -46 + ((i * 17) % 108);
      const y = 5.7 + ((i * 3.7) % 17);
      const pose = {
        x: baseX, y, z: baseZ, scale: 0.72 + (i % 4) * 0.08, yaw: i * 0.53,
      };
      const halo = createGlowSprite(this.textures.goldGlow, 1.35, 0.39);
      halo.position.set(baseX, y, baseZ);
      scene.add(halo);
      this.skyLanterns.push({ pose, halo, baseX, baseZ, y, speed: 0.19 + (i % 4) * 0.045, phase: i * 1.07 });
    }
    this.skyLanternPoses = this.skyLanterns.map((lantern) => lantern.pose);
    this.skyLanternBatch = this.assets.batch('PaperLantern', this.skyLanternPoses, false, true);
    scene.add(this.skyLanternBatch.group);
  }

  private buildAmbientLife(scene: THREE.Scene): void {
    const { assets, textures } = this;
    if (!assets || !textures) return;
    const offerings = [
      [256, 762], [421, 809], [558, 753], [655, 864], [805, 899], [874, 869],
      [994, 911], [1076, 845], [1180, 791], [1330, 883], [1490, 925],
    ];
    offerings.forEach(([basePx, basePy], index) => {
      const offering = createOffering(assets, {
        base: 'classic-banana',
        flower: index % 3 === 0 ? 'golden-marigold' : 'pink-lotus',
        glow: 'amber-candle',
        wishText: '',
        decorations: [],
      }, 'ambient');
      offering.group.scale.setScalar(0.76 + (index % 4) * 0.09);
      offering.group.position.set(to3DX(basePx), WATER_LEVEL, to3DZ(basePy));
      scene.add(offering.group);
      this.ambientKrathongs.push({ ...offering, basePx, basePy });
    });

    // Fireflies drift close to the garden and the riverbank.
    const fireflyCoords = [
      [175, 470, 0],
      [250, 560, 1.2],
      [335, 495, 2.3],
      [420, 605, 3.4],
      [530, 565, 4.5],
      [610, 445, 5.2],
      [1080, 530, 1.8],
      [1210, 615, 2.9],
      [648, 625, 0.4],
      [678, 643, 2.8],
      [814, 626, 1.7],
      [861, 510, 3.9],
      [305, 579, 2.4],
      [901, 649, 0.1],
      [1128, 685, 4.2],
      [1275, 416, 2.1],
    ];
    for (const [fx, fy, phase] of fireflyCoords) {
      const sp = createGlowSprite(textures.goldGlow, 0.28 + phase * 0.018, 0.57);
      const ox = to3DX(fx);
      const oz = to3DZ(fy);
      const oy = 0.58 + phase * 0.21;
      sp.position.set(ox, oy, oz);
      scene.add(sp);
      this.fireflies.push({ sprite: sp, ox, oy, oz, phase });
    }
  }

  private buildInteractiveSpots(scene: THREE.Scene): void {
    if (!this.textures || !this.assets) return;

    // Nearby active spot golden 3D beacon halo
    const haloGrp = new THREE.Group();
    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(1.22, 1.29, 44),
      new THREE.MeshBasicMaterial({
        color: 0xfde68a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.73,
      })
    );
    innerRing.rotation.x = -Math.PI / 2;
    haloGrp.add(innerRing);
    haloGrp.visible = false;
    scene.add(haloGrp);
    this.nearbyHaloGroup = haloGrp;

    // Preview krathong on the crafting bench
    const craftPreview = new THREE.Group();
    craftPreview.position.set(to3DX(760), 1.08, to3DZ(418));
    craftPreview.visible = false;
    scene.add(craftPreview);
    this.craftPreviewGroup = craftPreview;

    for (const spot of WORLD_SPOTS) {
      const sx = to3DX(spot.x);
      const sz = to3DZ(spot.y);
      const baseY = this.getGroundElevation(spot.x, spot.y);

      const spotGroup = new THREE.Group();
      spotGroup.position.set(sx, baseY, sz);

      const ringColor =
        spot.kind === 'pier'
          ? 0x2dd4bf
          : spot.kind === 'gather' || spot.kind === 'pavilion' || spot.kind === 'photo'
            ? 0xf472b6
            : 0xfbbf24;

      const ringMat = new THREE.MeshBasicMaterial({
        color: ringColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.39,
      });
      const spotRing = new THREE.Mesh(
        new THREE.RingGeometry(0.74, 0.793, 40),
        ringMat
      );
      spotRing.rotation.x = -Math.PI / 2;
      spotRing.position.y = 0.04;
      spotGroup.add(spotRing);

      // Invisible clickable cylinder for easy 3D raycast interaction
      const hitCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 2.8, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitCyl.position.y = 1.4;
      spotGroup.add(hitCyl);
      this.spotHitMeshes.push({ spotId: spot.id, mesh: hitCyl });

      if (spot.kind === 'lantern') {
        spotGroup.add(this.assets.create('CeremonyPost', { x: 0, y: 0, z: 0 }));
        const lantern = this.assets.create('PaperLantern', { x: 0, y: 2.14, z: -0.66, scale: 0.87 }, false);
        spotGroup.add(lantern);
        const bulbMats: THREE.MeshStandardMaterial[] = [];
        lantern.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial
              && child.material.emissiveIntensity > 1) {
            const material = child.material.clone();
            child.material = material;
            bulbMats.push(material);
          }
        });
        const glowSprite = createGlowSprite(this.textures.goldGlow, 1.3, 0.18);
        glowSprite.position.copy(lantern.position);
        spotGroup.add(glowSprite);

        this.lanternVisuals.push({
          id: spot.id,
          bulbMats,
          ringMat,
          glowSprite,
        });
      } else if (spot.kind === 'npc') {
        // 3D NPC Figure (ป้าบัว / ลุงมั่น)
        const isBua = spot.id === 'npc-bua';
        const npcProfile = {
          id: 'p1' as const,
          name: spot.npcName ?? spot.title,
          customization: {
            gender: isBua ? ('female' as const) : ('male' as const),
            skinTone: 'golden-tan' as const,
            hairStyle: isBua ? ('wavy-bob' as const) : ('short-classic' as const),
            hairColor: isBua ? ('obsidian' as const) : ('honey-gold' as const),
            outfit: isBua ? ('silk-lotus' as const) : ('emerald-sabai' as const),
            accessory: 'none' as const,
          },
          portrait: {
            status: 'absent' as const,
            dataUrl: null,
            mimeType: null,
            error: null,
            updatedAt: null,
          },
          position: { x: spot.x, y: spot.y, facing: 'down' as const },
        };
        const npcRig = buildCharacter3DRig(npcProfile);
        npcRig.activeRing.visible = false;
        npcRig.nameSprite.visible = false;
        npcRig.root.position.set(0, 0, -1.05);
        spotGroup.add(npcRig.root);
      }

      const label = createTextPillSprite(spot.title, {
        bgColor: 'rgba(10, 15, 36, 0.88)',
        borderColor: 'rgba(253, 230, 138, 0.72)',
        worldHeight: 0.48,
      });
      label.position.set(0, spot.kind === 'lantern' ? 3.04 : 2.13, 0);
      spotGroup.add(label);

      scene.add(spotGroup);
    }
  }

  private buildPlayers(scene: THREE.Scene): void {
    if (!this.textures) return;
    const p1Rig = buildCharacter3DRig(this.snapshot.players.p1);
    const p2Rig = buildCharacter3DRig(this.snapshot.players.p2);
    addPlayerContactShadows([p1Rig.root, p2Rig.root]);
    scene.add(p1Rig.root, p2Rig.root);
    this.playerRigs = { p1: p1Rig, p2: p2Rig };

    // 3D Romantic Couple Tether Ribbon & Floating Heart when standing close
    const tetherPositions = new THREE.BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage);
    const tetherGeo = new THREE.BufferGeometry().setAttribute('position', tetherPositions);
    const tetherLine = new THREE.Line(
      tetherGeo,
      new THREE.LineBasicMaterial({
        color: 0xf9a8d4,
        transparent: true,
        opacity: 0.65,
      })
    );
    tetherLine.frustumCulled = false;
    tetherLine.visible = false;
    scene.add(tetherLine);
    this.coupleTetherLine = tetherLine;

    const heartSp = createGlowSprite(this.textures.pinkGlow, 1.25, 0.75);
    heartSp.visible = false;
    scene.add(heartSp);
    this.coupleHeartSprite = heartSp;
  }

  private getGroundElevation(px: number, py: number): number {
    if (
      py >= PIER_WALKABLE_RECT.y &&
      px >= PIER_WALKABLE_RECT.x &&
      px <= PIER_WALKABLE_RECT.x + PIER_WALKABLE_RECT.w
    ) {
      return 0.2;
    }
    if (px >= 412 && px <= 568 && py >= 456 && py <= 558) {
      return 0.34;
    }
    return 0.1;
  }

  // =========================================================================
  // STATE SYNC & VISUAL REFRESH
  // =========================================================================

  private refreshVisualState(): void {
    if (!this.scene || !this.playerRigs || !this.assets) return;

    const cameraTargetId: PlayerId =
      this.snapshot.myRole;

    for (const pid of ['p1', 'p2'] as const) {
      const profile = this.snapshot.players[pid];
      const rig = this.playerRigs[pid];
      const wx = to3DX(profile.position.x);
      const wz = to3DZ(profile.position.y);
      const wy = this.getGroundElevation(profile.position.x, profile.position.y);

      rig.root.visible = pid === this.snapshot.myRole || this.partnerPresent;
      rig.root.position.set(wx, wy, wz);
      rig.targetYaw = yawFromFacing(profile.position.facing);
      syncCharacter3DRig(rig, profile, pid === cameraTargetId);
    }

    // Romantic couple proximity tether in 3D
    if (this.coupleTetherLine && this.coupleHeartSprite) {
      const p1Pos = this.snapshot.players.p1.position;
      const p2Pos = this.snapshot.players.p2.position;
      const distPx = Math.hypot(p1Pos.x - p2Pos.x, p1Pos.y - p2Pos.y);
      if (this.partnerPresent && distPx <= 145) {
        const a = this.playerRigs.p1.root.position;
        const b = this.playerRigs.p2.root.position;
        const positions = this.coupleTetherLine.geometry.getAttribute('position');
        positions.setXYZ(0, a.x, a.y + 0.85, a.z);
        positions.setXYZ(1, b.x, b.y + 0.85, b.z);
        positions.needsUpdate = true;
        this.coupleTetherLine.visible = true;
        this.coupleHeartSprite.position.set(
          (a.x + b.x) / 2,
          (a.y + b.y) / 2 + 1.0,
          (a.z + b.z) / 2
        );
        this.coupleHeartSprite.visible = true;
      } else {
        this.coupleTetherLine.visible = false;
        this.coupleHeartSprite.visible = false;
      }
    }

    // Sync single meaningful Yi Peng Wish Lantern
    const lanternLit =
      this.snapshot.skyLantern.p1Lit ||
      this.snapshot.skyLantern.p2Lit ||
      this.snapshot.skyLantern.released;
    for (const lv of this.lanternVisuals) {
      for (const material of lv.bulbMats) {
        material.color.setHex(lanternLit ? 0xffffff : 0x66513e);
        material.emissiveIntensity = lanternLit ? 1.55 : 0.08;
      }
      lv.glowSprite.scale.setScalar(lanternLit ? 1.72 : 0.85);
      lv.glowSprite.material.opacity = lanternLit ? 0.52 : 0.1;
      lv.ringMat.opacity = lanternLit ? 0.95 : 0.45;
    }

    // Launch radiant 3D Couple Wish Lantern when released
    if (this.snapshot.skyLantern.released && !this.coupleWishLantern && this.textures) {
      const baseX = to3DX(410);
      const baseZ = to3DZ(214);
      const group = this.assets.create(
        'PaperLantern',
        { x: baseX, y: 2.6, z: baseZ, scale: 1.35 },
        false
      );
      const halo = createGlowSprite(this.textures.goldGlow, 2.8, 0.72);
      halo.position.set(0, 0.2, 0);
      group.add(halo);
      const tag = createTextPillSprite(
        `🏮 ${this.snapshot.players.p1.name} ♥ ${this.snapshot.players.p2.name}`,
        {
          bgColor: 'rgba(15, 23, 42, 0.88)',
          borderColor: '#FDE68A',
          textColor: '#FEF3C7',
          worldHeight: 0.46,
        }
      );
      tag.position.set(0, 1.35, 0);
      group.add(tag);
      this.scene.add(group);
      this.coupleWishLantern = { group, halo, y: 2.6, baseX, baseZ };
    } else if (!this.snapshot.skyLantern.released && this.coupleWishLantern) {
      this.scene.remove(this.coupleWishLantern.group);
      this.assets.dispose(this.coupleWishLantern.group);
      this.coupleWishLantern = null;
    }

    // Sync 3D Crafted Krathong preview on table
    if (this.craftPreviewGroup) {
      this.craftPreviewGroup.visible = this.snapshot.krathongCrafted;
      if (this.snapshot.krathongCrafted) {
        const sig = `${this.snapshot.krathongDesign.base}|${this.snapshot.krathongDesign.flower}|${this.snapshot.krathongDesign.glow}|${this.snapshot.krathongDesign.decorations.length}`;
        if (this.lastCraftSignature !== sig) {
          this.lastCraftSignature = sig;
          for (const child of this.craftPreviewGroup.children) this.assets.dispose(child);
          this.craftPreviewGroup.clear();
          const preview = createOffering(this.assets, this.snapshot.krathongDesign, 'couple');
          this.craftPreviewGroup.add(preview.group);
        }
      }
    }

    // Sync nearby spot halo
    if (this.nearbyHaloGroup) {
      const nearbySpot = WORLD_SPOTS.find(
        (s) => s.id === this.snapshot.nearbySpotId
      );
      if (nearbySpot) {
        const hy = this.getGroundElevation(nearbySpot.x, nearbySpot.y) + 0.06;
        this.nearbyHaloGroup.position.set(
          to3DX(nearbySpot.x),
          hy,
          to3DZ(nearbySpot.y)
        );
        this.nearbyHaloGroup.visible = true;
      } else {
        this.nearbyHaloGroup.visible = false;
      }
    }

    // Sync 3D Released Krathongs floating on the Moonlight River
    if (this.renderedReleases === this.snapshot.releasedKrathongs) return;
    this.renderedReleases = this.snapshot.releasedKrathongs;
    const existingIds = new Set(this.snapshot.releasedKrathongs.map((k) => k.id));
    for (const [id, kv] of this.krathongVisuals.entries()) {
      if (!existingIds.has(id)) {
        this.scene.remove(kv.group);
        this.assets.dispose(kv.group);
        this.krathongVisuals.delete(id);
      }
    }

    for (const item of this.snapshot.releasedKrathongs) {
      if (!this.krathongVisuals.has(item.id)) {
        const visual = createOffering(this.assets, item.design, 'couple');
        const grp = visual.group;
        const tag = createTextPillSprite(
          `${item.coupleNames[0]} & ${item.coupleNames[1]}`,
          {
            bgColor: 'rgba(10, 15, 36, 0.86)',
            borderColor: '#FDE68A',
            textColor: '#FEF3C7',
            worldHeight: 0.4,
          }
        );
        tag.position.set(0, 1.05, 0);
        grp.add(tag);

        grp.position.set(to3DX(item.x), WATER_LEVEL, to3DZ(item.y));
        this.scene.add(grp);
        this.krathongVisuals.set(item.id, {
          ...visual,
          id: item.id,
          basePx: item.x,
          basePy: item.y,
        });
      }
    }
  }

  // =========================================================================
  // FRAME LOOP, 3D CAMERA & INPUT
  // =========================================================================

  private snapCameraImmediate(): void {
    if (!this.camera || !this.playerRigs) return;
    const focusId: PlayerId =
      this.snapshot.myRole;
    const target = this.playerRigs[focusId].root.position;
    const { dist, height } = this.getCameraPresetMetrics();
    this.camera.position.set(
      target.x + Math.sin(this.cameraYaw) * dist,
      target.y + height,
      target.z + Math.cos(this.cameraYaw) * dist
    );
    this.camera.lookAt(target.x, target.y + 2.45, target.z);
  }

  private getCameraPresetMetrics(): { dist: number; height: number } {
    const base =
      this.cameraPreset === 'close'
        ? { dist: 8.2, height: 4.3 }
        : this.cameraPreset === 'overview'
          ? { dist: 21.5, height: 16.5 }
          : { dist: 15, height: 6.85 };
    return {
      dist: base.dist * this.zoomFactor,
      height: base.height * this.zoomFactor,
    };
  }

  private isModalOpen(): boolean {
    return this.modalBlocked;
  }

  private isDomInputFocused(): boolean {
    if (this.isModalOpen()) return true;
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      active.getAttribute('contenteditable') === 'true'
    );
  }

  private tick(nowMs: number, deltaMs: number): void {
    const dtFactor = Math.min(deltaMs, 40) / 16.667;
    const speed = 3.45 * dtFactor;

    // Expire floating emote speech bubbles
    for (const pid of ['p1', 'p2'] as const) {
      if (this.emoteExpireAt[pid] > 0 && nowMs >= this.emoteExpireAt[pid]) {
        this.emoteExpireAt[pid] = 0;
        if (this.playerRigs) {
          this.playerRigs[pid].emoteSprite.visible = false;
        }
      }
    }

    // Smooth camera orbit yaw
    this.cameraYaw +=
      (this.targetCameraYaw - this.cameraYaw) *
      (this.reducedMotion ? 1 : Math.min(1, dtFactor * 0.22));

    // Process keyboard + joystick movement
    if (!this.isModalOpen()) {
      const keyboardAllowed = !this.isDomInputFocused();

      if (keyboardAllowed) {
        if (this.keysDown.has('KeyQ')) {
          this.targetCameraYaw -= 0.032 * dtFactor;
        }
        if (this.keysDown.has('KeyR')) {
          this.targetCameraYaw += 0.032 * dtFactor;
        }
      }

      let wasdX = 0;
      let wasdY = 0;
      let arrowX = 0;
      let arrowY = 0;

      if (keyboardAllowed) {
        if (this.keysDown.has('KeyA')) wasdX -= 1;
        if (this.keysDown.has('KeyD')) wasdX += 1;
        if (this.keysDown.has('KeyW')) wasdY -= 1;
        if (this.keysDown.has('KeyS')) wasdY += 1;

        if (this.keysDown.has('ArrowLeft')) arrowX -= 1;
        if (this.keysDown.has('ArrowRight')) arrowX += 1;
        if (this.keysDown.has('ArrowUp')) arrowY -= 1;
        if (this.keysDown.has('ArrowDown')) arrowY += 1;
      }

      const touchActive =
        Math.hypot(this.touchVector.x, this.touchVector.y) > 0.06;

      const dispatchCameraRelativeMove = (
        pid: PlayerId,
        inX: number,
        inY: number
      ) => {
        if (inX === 0 && inY === 0) return;
        const len = Math.hypot(inX, inY);
        const scale = len > 1 ? 1 / len : 1;
        const rotated = this.transformInputVector(inX * scale, inY * scale);
        const dx = rotated.dx * speed;
        const dy = rotated.dy * speed;
        const facing: Direction =
          Math.abs(dx) >= Math.abs(dy)
            ? dx >= 0
              ? 'right'
              : 'left'
            : dy >= 0
              ? 'down'
              : 'up';
        this.callbacks.onMove(pid, dx, dy, facing);
      };

      const inputX = wasdX + arrowX + (touchActive ? this.touchVector.x : 0);
      const inputY = wasdY + arrowY + (touchActive ? this.touchVector.y : 0);
      dispatchCameraRelativeMove(this.snapshot.myRole, inputX, inputY);

      if (this.interactQueued) {
        this.interactQueued = false;
        if (this.snapshot.nearbySpotId) {
          this.callbacks.onInteractSpot(this.snapshot.nearbySpotId);
        }
      }
    }

    // Animate 3D Couple Character facing & walking arm swing / bounce
    if (this.playerRigs) {
      for (const pid of ['p1', 'p2'] as const) {
        const rig = this.playerRigs[pid];
        const curPos = this.snapshot.players[pid].position;
        const prev = this.prevPositions[pid];
        const movedDist = Math.hypot(curPos.x - prev.x, curPos.y - prev.y);
        this.prevPositions[pid] = { x: curPos.x, y: curPos.y };

        rig.bodyPivot.rotation.y = this.reducedMotion
          ? rig.targetYaw
          : lerpAngle(rig.bodyPivot.rotation.y, rig.targetYaw, 0.25);

        if (!this.reducedMotion && movedDist > 0.15) {
          this.walkPhase[pid] += deltaMs * 0.014;
          const swing = Math.sin(this.walkPhase[pid]) * 0.55;
          rig.leftArm.rotation.x = swing;
          rig.rightArm.rotation.x = -swing;
          rig.bodyPivot.position.y = Math.abs(Math.sin(this.walkPhase[pid])) * 0.08;
        } else {
          rig.leftArm.rotation.x *= 0.8;
          rig.rightArm.rotation.x *= 0.8;
          rig.bodyPivot.position.y *= 0.8;
        }
      }
    }

    // Smooth 3D Follow Camera OR Romantic Krathong Release Cinematic
    if (this.camera && this.playerRigs) {
      if (this.releaseCinematic) {
        const elapsed = nowMs - this.releaseCinematic.startedAt;
        const progress = Math.min(1, elapsed / this.releaseCinematic.durationMs);
        const eased = progress * (2 - progress);
        const targetVisual =
          this.krathongVisuals.get(this.releaseCinematic.krathongId) ??
          Array.from(this.krathongVisuals.values()).pop();

        const kPos = targetVisual
          ? targetVisual.group.position
          : new THREE.Vector3(to3DX(960), WATER_LEVEL, to3DZ(860));

        const orbitAngle = -0.35 + eased * 0.75;
        const dist = 4.4 + eased * 2.8;
        const height = 1.65 + eased * 1.45;
        const wantX = kPos.x + Math.sin(orbitAngle) * dist;
        const wantY = kPos.y + height;
        const wantZ = kPos.z + Math.cos(orbitAngle) * dist;

        const lerpRate = this.reducedMotion ? 1 : Math.min(1, dtFactor * 0.085);
        this.camera.position.x += (wantX - this.camera.position.x) * lerpRate;
        this.camera.position.y += (wantY - this.camera.position.y) * lerpRate;
        this.camera.position.z += (wantZ - this.camera.position.z) * lerpRate;
        this.camera.lookAt(kPos.x, kPos.y + 0.55, kPos.z);

        if (elapsed >= this.releaseCinematic.durationMs) {
          const done = this.releaseCinematic.onComplete;
          this.releaseCinematic = null;
          done();
        }
      } else {
        const focusId: PlayerId = this.snapshot.myRole;
        const target = this.playerRigs[focusId].root.position;
        const { dist, height } = this.getCameraPresetMetrics();
        const wantX = target.x + Math.sin(this.cameraYaw) * dist;
        const wantY = target.y + height;
        const wantZ = target.z + Math.cos(this.cameraYaw) * dist;

        const camLerp = this.reducedMotion ? 1 : Math.min(1, dtFactor * 0.14);
        this.camera.position.x += (wantX - this.camera.position.x) * camLerp;
        this.camera.position.y += (wantY - this.camera.position.y) * camLerp;
        this.camera.position.z += (wantZ - this.camera.position.z) * camLerp;
        this.camera.lookAt(target.x, target.y + 2.45, target.z);
      }
    }

    // Drift Couple's Personal Wish Lantern gently upward into the night sky
    if (this.coupleWishLantern && !this.reducedMotion) {
      this.coupleWishLantern.y += (deltaMs / 1000) * 0.42;
      if (this.coupleWishLantern.y > 22) {
        this.coupleWishLantern.y = 7.5;
      }
      this.coupleWishLantern.group.position.set(
        this.coupleWishLantern.baseX + Math.sin(nowMs * 0.00055) * 1.1,
        this.coupleWishLantern.y,
        this.coupleWishLantern.baseZ + Math.cos(nowMs * 0.00048) * 0.9
      );
      this.coupleWishLantern.group.rotation.y += (deltaMs / 1000) * 0.22;
    }

    this.updateWater(nowMs);

    // Environmental 3D Animations
    if (!this.reducedMotion) {
      if (this.scenery) {
        this.scenery.windTime.value = nowMs * 0.001;
        this.scenery.swayHangingLanterns(nowMs * 0.001);
        for (const prop of this.scenery.swaying) {
          prop.object.rotation.z = Math.sin(nowMs * 0.0012 + prop.phase) * prop.amplitude;
        }
        this.scenery.boat.position.y = WATER_LEVEL - 0.11 + Math.sin(nowMs * 0.00165) * 0.037;
        this.scenery.boat.rotation.z = Math.sin(nowMs * 0.0014) * 0.046;
      }

      for (const sl of this.skyLanterns) {
        sl.y += (deltaMs / 1000) * sl.speed;
        if (sl.y > 25) sl.y = 5.6;
        const fade = THREE.MathUtils.smoothstep(sl.y, 5.6, 7.4) *
          (1 - THREE.MathUtils.smoothstep(sl.y, 22.8, 25));
        sl.pose.scale = (0.74 + 0.12 * Math.sin(sl.phase * 0.6)) * Math.max(0.01, fade);
        sl.pose.roll = 0.078 * Math.sin(nowMs * 0.00087 + sl.phase);
        sl.pose.x = sl.baseX + Math.sin(nowMs * 0.0007 + sl.phase) * 0.8;
        sl.pose.y = sl.y;
        sl.pose.z = sl.baseZ + Math.cos(nowMs * 0.0006 + sl.phase) * 0.6;
        sl.halo.position.set(sl.pose.x, sl.pose.y, sl.pose.z);
        sl.halo.scale.setScalar(sl.pose.scale * 1.7);
      }
      this.skyLanternBatch?.update(this.skyLanternPoses);

      for (const f of this.fireflies) {
        f.sprite.position.set(
          f.ox + Math.sin(nowMs * 0.00079 + f.phase) * 0.85,
          f.oy + Math.sin(nowMs * 0.00114 + f.phase) * 0.34,
          f.oz + Math.cos(nowMs * 0.00086 + f.phase) * 0.65
        );
        f.sprite.material.opacity =
          0.24 + 0.44 * (0.5 + 0.5 * Math.sin(nowMs * 0.0017 + f.phase));
      }

      if (this.nearbyHaloGroup?.visible) {
        const pulse = 1 + Math.sin(nowMs * 0.005) * 0.08;
        this.nearbyHaloGroup.scale.set(pulse, 1, pulse);
      }
    }
  }

  private updateWater(nowMs: number): void {
    if (!this.river) return;
    const seconds = this.reducedMotion ? 0 : nowMs * 0.001;
    const lights: RiverLight[] = [];
    const animate = (item: FloatingOffering & { basePx: number; basePy: number }, index: number, strength: number) => {
      const phase = item.basePx * 0.055 + index * 0.91;
      const x = to3DX(item.basePx) + Math.sin(seconds * 0.26 + phase) * 0.84;
      const z = to3DZ(item.basePy) + Math.sin(seconds * 0.36 + phase * 1.44) * 0.18;
      item.group.position.set(x, riverHeight(x, z, seconds) + 0.018, z);
      item.group.rotation.set(Math.sin(seconds * 1.26 + phase) * 0.105, phase + Math.sin(seconds * 0.41 + phase) * 0.19, Math.cos(seconds * 1.48 + phase) * 0.078);
      const flicker = 0.85 + Math.sin(seconds * 7.7 + phase) * 0.085 + Math.sin(seconds * 12.3 + phase) * 0.047;
      item.flame.scale.x = 0.28 * flicker;
      item.flame.scale.y = 0.47 * (0.85 + flicker * 0.17);
      item.flame.material.opacity = 0.83 + flicker * 0.17;
      lights.push({ x, z, strength: flicker * strength, warmth: item.warmth });
    };
    let index = 0;
    for (const visual of this.krathongVisuals.values()) {
      animate(visual, index, 1.08);
      index += 1;
    }
    this.ambientKrathongs.forEach((item, i) => animate(item, i, 0.80));
    if (this.camera) {
      const { x, z } = this.camera.position;
      lights.sort((a, b) => (a.x - x) ** 2 + (a.z - z) ** 2 - (b.x - x) ** 2 - (b.z - z) ** 2);
    }
    this.river.update(seconds, lights);
  }

  // =========================================================================
  // DOM EVENTS (KEYBOARD, ORBIT DRAG, WHEEL ZOOM, 3D RAYCAST CLICK, RESIZE)
  // =========================================================================

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.isDomInputFocused()) return;
    if (
      event.code === 'ArrowUp' ||
      event.code === 'ArrowDown' ||
      event.code === 'ArrowLeft' ||
      event.code === 'ArrowRight'
    ) {
      event.preventDefault();
    }
    this.keysDown.add(event.code);

    if (event.key === 'e' || event.key === 'E') {
      this.interactQueued = true;
    } else if (event.key === 'v' || event.key === 'V') {
      this.cycleCameraPreset();
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keysDown.delete(event.code);
  };

  private onWindowBlur = (): void => {
    this.keysDown.clear();
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (this.isModalOpen() || !this.renderer) return;
    this.orbitDragPointerId = event.pointerId;
    this.orbitDragStartX = event.clientX;
    this.orbitDragStartYaw = this.targetCameraYaw;
    this.pointerMovedDist = 0;
    this.renderer.domElement.setPointerCapture?.(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.orbitDragPointerId !== event.pointerId) return;
    const deltaX = event.clientX - this.orbitDragStartX;
    this.pointerMovedDist = Math.max(this.pointerMovedDist, Math.abs(deltaX));
    this.targetCameraYaw = this.orbitDragStartYaw - deltaX * 0.0065;
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.orbitDragPointerId !== event.pointerId) return;
    this.orbitDragPointerId = null;

    // If it was a clean tap/click (not a camera orbit drag), raycast 3D spots!
    if (
      this.pointerMovedDist < 8 &&
      this.renderer &&
      this.camera &&
      !this.isModalOpen()
    ) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, this.camera);
      const hits = raycaster.intersectObjects(
        this.spotHitMeshes.map((s) => s.mesh),
        false
      );
      if (hits.length > 0) {
        const hitObj = hits[0].object;
        const entry = this.spotHitMeshes.find((s) => s.mesh === hitObj);
        if (entry) {
          const spot = WORLD_SPOTS.find((w) => w.id === entry.spotId);
          const ctrlId =
            this.snapshot.myRole;
          const pos = this.snapshot.players[ctrlId].position;
          if (
            spot &&
            Math.hypot(pos.x - spot.x, pos.y - spot.y) <= spot.radius + 28
          ) {
            this.callbacks.onInteractSpot(spot.id);
          }
        }
      }
    }
  };

  private onWheel = (event: WheelEvent): void => {
    if (this.isModalOpen()) return;
    event.preventDefault();
    const next = this.zoomFactor + (event.deltaY > 0 ? 0.08 : -0.08);
    this.zoomFactor = Math.max(0.68, Math.min(1.42, next));
  };

  private attachDomListeners(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });

    if (typeof ResizeObserver !== 'undefined' && this.container) {
      const initialSize = this.renderer?.getSize(new THREE.Vector2());
      let lastW = initialSize?.x ?? 0;
      let lastH = initialSize?.y ?? 0;
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.container || !this.renderer || !this.camera || !this.scene) return;
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        if (!w || !h || (w === lastW && h === lastH)) return;
        lastW = w;
        lastH = h;
        this.applyGraphics(w, h);
      });
      this.resizeObserver.observe(this.container);
    }
  }

  private detachDomListeners(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    const canvas = this.renderer?.domElement;
    if (canvas) {
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      canvas.removeEventListener('pointermove', this.onPointerMove);
      canvas.removeEventListener('pointerup', this.onPointerUp);
      canvas.removeEventListener('pointercancel', this.onPointerUp);
      canvas.removeEventListener('wheel', this.onWheel);
    }
  }
}
