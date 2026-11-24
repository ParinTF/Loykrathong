import * as THREE from 'three';
import { LANDMARK_ASSETS } from '../domain/landmarks';
import type {
  CoupleEmoteEvent,
  Direction,
  GameState,
  PlayMode,
  PlayerId,
} from '../domain/types';
import {
  PIER_WALKABLE_RECT,
  RIVER_BANK_Y,
  SOLID_OBSTACLES,
  WORLD_HEIGHT,
  WORLD_SPOTS,
  WORLD_WIDTH,
} from '../domain/worldMap';
import {
  buildCharacter3DRig,
  buildKrathong3DGroup,
  createFestival3DTextures,
  createGlowSprite,
  createTextPillSprite,
  syncCharacter3DRig,
  updateTextPillSprite,
  type Character3DRig,
  type Festival3DTextureBank,
} from './textures';

export type CameraPreset = 'follow' | 'close' | 'overview';

export interface SceneBridgeCallbacks {
  onMove: (playerId: PlayerId, dx: number, dy: number, facing: Direction) => void;
  onInteractSpot: (spotId: string) => void;
}

interface Lantern3DVisual {
  id: string;
  bulbMat: THREE.MeshStandardMaterial;
  ringMat: THREE.MeshBasicMaterial;
  glowSprite: THREE.Sprite;
  light: THREE.PointLight;
}

interface Krathong3DVisual {
  id: string;
  group: THREE.Group;
  basePx: number;
  basePy: number;
}

interface SkyLantern3D {
  group: THREE.Group;
  baseX: number;
  baseZ: number;
  y: number;
  speed: number;
  phase: number;
}

const WORLD_SCALE = 0.05; // 20 domain px = 1.0 meter in 3D space (72m x 48m world)

function to3DX(px: number): number {
  return (px - WORLD_WIDTH / 2) * WORLD_SCALE;
}

function to3DZ(py: number): number {
  return (py - WORLD_HEIGHT / 2) * WORLD_SCALE;
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
  private playMode: PlayMode = 'local';
  private myOnlineRole: PlayerId = 'p1';

  private container: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private textures: Festival3DTextureBank | null = null;
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
  private krathongVisuals: Map<string, Krathong3DVisual> = new Map();
  private ambientKrathongs: {
    group: THREE.Group;
    basePx: number;
    basePy: number;
    speed: number;
  }[] = [];
  private skyLanterns: SkyLantern3D[] = [];
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
    this.destroyed = false;
    this.container = container;

    const width = Math.max(320, container.clientWidth || 800);
    const height = Math.max(320, container.clientHeight || 600);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#060C21');
    scene.fog = new THREE.FogExp2('#07102B', 0.0115);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.3, 180);
    camera.position.set(0, 12, 16);
    this.camera = camera;

    this.textures = createFestival3DTextures();

    this.buildSkyAndLighting(scene);
    this.buildWorldTerrainAndWalkways(scene);
    this.buildArchitectureAndLandmarks(scene);
    this.buildInteractiveSpots(scene);
    this.buildPlayers(scene);

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

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
      this.renderer = null;
    }
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
    this.cameraPreset = order[(idx + 1) % order.length];
    return this.cameraPreset;
  }

  public nudgeCameraYaw(deltaRad: number): void {
    this.targetCameraYaw += deltaRad;
  }

  public resetCameraAngle(): void {
    this.targetCameraYaw = 0;
    this.zoomFactor = 1.0;
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
    playMode: PlayMode = 'local',
    myOnlineRole: PlayerId = 'p1'
  ): void {
    this.snapshot = state;
    this.reducedMotion = reducedMotion;
    this.playMode = playMode;
    this.myOnlineRole = myOnlineRole;
    if (!this.scene) return;
    this.refreshVisualState();
  }

  // =========================================================================
  // 3D WORLD CONSTRUCTION
  // =========================================================================

  private buildSkyAndLighting(scene: THREE.Scene): void {
    if (!this.textures) return;

    // Hemisphere + Directional Moonlight
    const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x1e293b, 0.95);
    scene.add(hemi);

    const moonDir = new THREE.DirectionalLight(0xfef3c7, 1.35);
    moonDir.position.set(16, 26, 20);
    moonDir.castShadow = true;
    moonDir.shadow.mapSize.set(1024, 1024);
    moonDir.shadow.camera.near = 2;
    moonDir.shadow.camera.far = 90;
    moonDir.shadow.camera.left = -38;
    moonDir.shadow.camera.right = 38;
    moonDir.shadow.camera.top = 30;
    moonDir.shadow.camera.bottom = -30;
    scene.add(moonDir);

    // Warm zone accent PointLights
    const zoneLights: { x: number; y: number; col: number; intensity: number; dist: number }[] = [
      { x: 380, y: 210, col: 0xf59e0b, intensity: 4.2, dist: 20 },
      { x: 1100, y: 220, col: 0xfbbf24, intensity: 4.5, dist: 22 },
      { x: 490, y: 490, col: 0xf472b6, intensity: 3.8, dist: 18 },
      { x: 760, y: 460, col: 0xfbbf24, intensity: 4.0, dist: 18 },
      { x: 940, y: 780, col: 0x2dd4bf, intensity: 4.2, dist: 20 },
    ];
    for (const zl of zoneLights) {
      const pl = new THREE.PointLight(zl.col, zl.intensity, zl.dist, 1.4);
      pl.position.set(to3DX(zl.x), 3.4, to3DZ(zl.y));
      scene.add(pl);
    }

    // 3D Starfield Dome
    const starCount = 260;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const theta = ((i * 137.5) % 360) * (Math.PI / 180);
      const radius = 48 + (i % 5) * 6;
      const y = 10 + ((i * 29) % 32);
      starPositions[i * 3] = Math.cos(theta) * radius;
      starPositions[i * 3 + 1] = y;
      starPositions[i * 3 + 2] = Math.sin(theta) * radius;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starPoints = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0xfef9c3,
        size: 0.35,
        transparent: true,
        opacity: 0.85,
      })
    );
    scene.add(starPoints);

    // Full Harvest Moon in the 3D Sky
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfef9c3 })
    );
    moonMesh.position.set(20, 20, -34);
    scene.add(moonMesh);

    const moonHalo = createGlowSprite(this.textures.goldGlow, 14, 0.55);
    moonHalo.position.copy(moonMesh.position);
    scene.add(moonHalo);

    // 24 Floating 3D Yi Peng Sky Lanterns (โคมลอยยี่เป็งเต็มท้องฟ้า 3 มิติ!)
    const lanternPaperMat = new THREE.MeshBasicMaterial({
      color: 0xfde68a,
      transparent: true,
      opacity: 0.92,
    });
    const lanternGeo = new THREE.CylinderGeometry(0.24, 0.17, 0.56, 12);

    for (let i = 0; i < 24; i += 1) {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(lanternGeo, lanternPaperMat);
      grp.add(body);
      const glow = createGlowSprite(this.textures.goldGlow, 1.5, 0.65);
      glow.position.y = -0.1;
      grp.add(glow);

      const bx = -32 + ((i * 19) % 64);
      const bz = -24 + ((i * 13) % 44);
      const by = 4.5 + ((i * 3.7) % 15);
      grp.position.set(bx, by, bz);
      scene.add(grp);

      this.skyLanterns.push({
        group: grp,
        baseX: bx,
        baseZ: bz,
        y: by,
        speed: 0.35 + (i % 4) * 0.12,
        phase: i * 0.9,
      });
    }
  }

  private add3DPavedPath(
    scene: THREE.Scene,
    px: number,
    py: number,
    pw: number,
    ph: number
  ): void {
    if (!this.textures) return;
    const w = pw * WORLD_SCALE;
    const d = ph * WORLD_SCALE;
    const cx = to3DX(px + pw / 2);
    const cz = to3DZ(py + ph / 2);

    const pathTex = this.textures.sandstone.clone();
    pathTex.needsUpdate = true;
    pathTex.repeat.set(Math.max(1, w / 3.2), Math.max(1, d / 3.2));

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.1, d),
      new THREE.MeshStandardMaterial({
        map: pathTex,
        roughness: 0.75,
      })
    );
    slab.position.set(cx, 0.05, cz);
    slab.receiveShadow = true;
    scene.add(slab);

    // Golden sandstone curb frame
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.16, 0.07, d + 0.16),
      new THREE.MeshStandardMaterial({
        color: 0xd97706,
        roughness: 0.5,
        metalness: 0.25,
      })
    );
    curb.position.set(cx, 0.03, cz);
    curb.receiveShadow = true;
    scene.add(curb);
  }

  private buildWorldTerrainAndWalkways(scene: THREE.Scene): void {
    if (!this.textures) return;

    // 1. Lush Garden Ground North of Riverbank
    const landDepth = RIVER_BANK_Y * WORLD_SCALE;
    const landWidth = (WORLD_WIDTH + 320) * WORLD_SCALE;
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(landWidth, 0.6, landDepth),
      new THREE.MeshStandardMaterial({
        map: this.textures.grass,
        roughness: 0.88,
      })
    );
    ground.position.set(0, -0.3, to3DZ(RIVER_BANK_Y / 2));
    ground.receiveShadow = true;
    scene.add(ground);

    // 2. Shimmering 3D Moonlight River South of Riverbank
    const riverDepth = (WORLD_HEIGHT - RIVER_BANK_Y + 420) * WORLD_SCALE;
    const riverCenterPy = RIVER_BANK_Y + (WORLD_HEIGHT - RIVER_BANK_Y + 420) / 2;
    const riverMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(landWidth, riverDepth, 32, 16),
      new THREE.MeshStandardMaterial({
        map: this.textures.water,
        roughness: 0.22,
        metalness: 0.55,
      })
    );
    riverMesh.rotation.x = -Math.PI / 2;
    riverMesh.position.set(0, -0.22, to3DZ(riverCenterPy));
    riverMesh.receiveShadow = true;
    scene.add(riverMesh);

    // 3. Carved Stone Embankment Wall with Open Gateway for the Pier!
    const pier = PIER_WALKABLE_RECT;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x473c5c,
      roughness: 0.7,
    });
    const goldCapMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.35,
      metalness: 0.4,
    });

    const leftSpanPx = pier.x + 120;
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(leftSpanPx * WORLD_SCALE, 0.65, 0.42),
      wallMat
    );
    leftWall.position.set(
      to3DX(pier.x - leftSpanPx / 2),
      0.08,
      to3DZ(RIVER_BANK_Y - 6)
    );
    scene.add(leftWall);

    const leftCap = new THREE.Mesh(
      new THREE.BoxGeometry(leftSpanPx * WORLD_SCALE, 0.08, 0.5),
      goldCapMat
    );
    leftCap.position.set(leftWall.position.x, 0.42, leftWall.position.z);
    scene.add(leftCap);

    const rightStartPx = pier.x + pier.w;
    const rightSpanPx = WORLD_WIDTH + 120 - rightStartPx;
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(rightSpanPx * WORLD_SCALE, 0.65, 0.42),
      wallMat
    );
    rightWall.position.set(
      to3DX(rightStartPx + rightSpanPx / 2),
      0.08,
      to3DZ(RIVER_BANK_Y - 6)
    );
    scene.add(rightWall);

    const rightCap = new THREE.Mesh(
      new THREE.BoxGeometry(rightSpanPx * WORLD_SCALE, 0.08, 0.5),
      goldCapMat
    );
    rightCap.position.set(rightWall.position.x, 0.42, rightWall.position.z);
    scene.add(rightCap);

    // 4. 3D Raised Sandstone Walkways & Lotus Mandala Plaza
    this.add3DPavedPath(scene, 172, 178, 1116, 86);
    this.add3DPavedPath(scene, 196, 466, 588, 92);
    this.add3DPavedPath(scene, 706, 232, 112, 410);
    this.add3DPavedPath(scene, 706, 560, 324, 142);
    this.add3DPavedPath(scene, 944, 240, 80, 120);

    // Central 3D Golden Lotus Mandala Disc
    const mandalaX = to3DX(762);
    const mandalaZ = to3DZ(582);
    const mandalaDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(3.1, 3.2, 0.12, 32),
      new THREE.MeshStandardMaterial({ color: 0x4c365e, roughness: 0.6 })
    );
    mandalaDisc.position.set(mandalaX, 0.06, mandalaZ);
    mandalaDisc.receiveShadow = true;
    scene.add(mandalaDisc);

    const mandalaRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.05, 0.08, 8, 36),
      goldCapMat
    );
    mandalaRing.rotation.x = Math.PI / 2;
    mandalaRing.position.set(mandalaX, 0.13, mandalaZ);
    scene.add(mandalaRing);

    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const petal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 0.04, 12),
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? 0xf59e0b : 0xec4899,
          roughness: 0.45,
        })
      );
      petal.position.set(
        mandalaX + Math.cos(a) * 1.5,
        0.13,
        mandalaZ + Math.sin(a) * 1.5
      );
      scene.add(petal);
    }

    // 5. 3D Royal Teakwood Pier (ท่าน้ำแสงจันทร์ 3 มิติ)
    const pierW = pier.w * WORLD_SCALE;
    const pierD = pier.h * WORLD_SCALE;
    const pierCx = to3DX(pier.x + pier.w / 2);
    const pierCz = to3DZ(pier.y + pier.h / 2);

    const pierDeck = new THREE.Mesh(
      new THREE.BoxGeometry(pierW, 0.22, pierD),
      new THREE.MeshStandardMaterial({
        map: this.textures.teak,
        roughness: 0.65,
      })
    );
    pierDeck.position.set(pierCx, 0.09, pierCz);
    pierDeck.receiveShadow = true;
    pierDeck.castShadow = true;
    scene.add(pierDeck);

    // Red & gold ceremonial carpet runner along the pier
    const carpet = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.04, pierD - 0.8),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6 })
    );
    carpet.position.set(pierCx, 0.21, pierCz - 0.15);
    scene.add(carpet);

    // Timber pilings in the water + glowing golden lotus bollards along pier edges
    const postMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
    for (const zOff of [-pierD * 0.42, 0, pierD * 0.42]) {
      for (const xOff of [-pierW / 2 + 0.18, pierW / 2 - 0.18]) {
        const piling = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 1.4, 12),
          postMat
        );
        piling.position.set(pierCx + xOff, 0.22, pierCz + zOff);
        piling.castShadow = true;
        scene.add(piling);

        const finial = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xfef08a })
        );
        finial.position.set(pierCx + xOff, 1.0, pierCz + zOff);
        scene.add(finial);

        const glow = createGlowSprite(this.textures.goldGlow, 1.35, 0.72);
        glow.position.copy(finial.position);
        scene.add(glow);
      }
    }

    // 6. Glowing 3D Walkway Lantern Bollards
    const bollardCoords = [
      [186, 174],
      [386, 174],
      [590, 174],
      [834, 174],
      [1092, 174],
      [702, 340],
      [822, 340],
      [702, 548],
    ];
    for (const [bx, by] of bollardCoords) {
      const wx = to3DX(bx);
      const wz = to3DZ(by);
      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.14, 0.85, 10),
        postMat
      );
      stand.position.set(wx, 0.42, wz);
      stand.castShadow = true;
      scene.add(stand);

      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xfde68a })
      );
      lamp.position.set(wx, 0.92, wz);
      scene.add(lamp);

      const halo = createGlowSprite(this.textures.goldGlow, 1.2, 0.65);
      halo.position.copy(lamp.position);
      scene.add(halo);
    }
  }

  private buildArchitectureAndLandmarks(scene: THREE.Scene): void {
    if (!this.textures) return;

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.3,
      metalness: 0.55,
    });
    const crimsonRoofMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.48,
    });
    const whitePillarMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.45,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5c2d16,
      roughness: 0.72,
    });

    for (const obs of SOLID_OBSTACLES) {
      const ox = to3DX(obs.x + obs.w / 2);
      const oz = to3DZ(obs.y + obs.h / 2);
      const ow = obs.w * WORLD_SCALE;
      const od = obs.h * WORLD_SCALE;

      if (obs.label.includes('ศาลา')) {
        // ===============================================================
        // 3D MULTI-TIERED THAI WATERFRONT SALA PAVILION (ศาลาไทยจัตุรมุข 3D!)
        // ===============================================================
        const salaCenterX = to3DX(obs.x + obs.w / 2);
        const salaCenterZ = to3DZ(obs.y + 72);

        // Reflective lotus moat around Sala
        const moat = new THREE.Mesh(
          new THREE.BoxGeometry(ow + 2.4, 0.08, 7.6),
          new THREE.MeshStandardMaterial({
            color: 0x0e7490,
            roughness: 0.2,
            metalness: 0.5,
          })
        );
        moat.position.set(salaCenterX, 0.02, salaCenterZ);
        scene.add(moat);

        // White marble base & teak platform
        const base = new THREE.Mesh(
          new THREE.BoxGeometry(ow + 0.6, 0.28, 5.8),
          whitePillarMat
        );
        base.position.set(salaCenterX, 0.14, salaCenterZ);
        base.receiveShadow = true;
        scene.add(base);

        const deck = new THREE.Mesh(
          new THREE.BoxGeometry(ow + 0.1, 0.08, 5.3),
          new THREE.MeshStandardMaterial({ map: this.textures.teak, roughness: 0.6 })
        );
        deck.position.set(salaCenterX, 0.3, salaCenterZ);
        deck.receiveShadow = true;
        scene.add(deck);

        // 4 Tall White & Gold Thai Pavilion Columns
        for (const dx of [-ow / 2 + 0.25, ow / 2 - 0.25]) {
          for (const dz of [-2.2, 2.2]) {
            const col = new THREE.Mesh(
              new THREE.CylinderGeometry(0.18, 0.22, 3.1, 14),
              whitePillarMat
            );
            col.position.set(salaCenterX + dx, 1.85, salaCenterZ + dz);
            col.castShadow = true;
            scene.add(col);

            const colRing = new THREE.Mesh(
              new THREE.TorusGeometry(0.21, 0.04, 8, 16),
              goldMat
            );
            colRing.rotation.x = Math.PI / 2;
            colRing.position.set(salaCenterX + dx, 3.25, salaCenterZ + dz);
            scene.add(colRing);
          }
        }

        // 3-Tiered Pitched Crimson & Gold Thai Roof + Chofa Finial Spire!
        const tiers = [
          { y: 3.85, r: 4.9, h: 1.25 },
          { y: 4.65, r: 3.7, h: 1.15 },
          { y: 5.35, r: 2.4, h: 1.1 },
        ];
        for (const t of tiers) {
          const roof = new THREE.Mesh(
            new THREE.ConeGeometry(t.r, t.h, 4),
            crimsonRoofMat
          );
          roof.rotation.y = Math.PI / 4;
          roof.position.set(salaCenterX, t.y, salaCenterZ);
          roof.castShadow = true;
          scene.add(roof);

          const eaveTrim = new THREE.Mesh(
            new THREE.BoxGeometry(t.r * 1.42, 0.1, t.r * 1.42),
            goldMat
          );
          eaveTrim.position.set(salaCenterX, t.y - t.h / 2 + 0.05, salaCenterZ);
          scene.add(eaveTrim);
        }

        // Tall Golden Chofa Spire Finial atop the Sala
        const spire = new THREE.Mesh(
          new THREE.ConeGeometry(0.22, 1.45, 12),
          goldMat
        );
        spire.position.set(salaCenterX, 6.45, salaCenterZ);
        scene.add(spire);
      } else if (obs.label.includes('ร้าน')) {
        // ===============================================================
        // 3D AMPHAWA WOODEN CANAL MARKET STALLS (ร้านป้าบัว & ร้านลุงมั่น 3D!)
        // ===============================================================
        const isBua = obs.label.includes('ป้าบัว');
        const counter = new THREE.Mesh(
          new THREE.BoxGeometry(ow, 1.05, od * 0.7),
          woodMat
        );
        counter.position.set(ox, 0.52, oz);
        counter.castShadow = true;
        counter.receiveShadow = true;
        scene.add(counter);

        // 4 Wooden Roof Posts
        for (const dx of [-ow / 2 + 0.2, ow / 2 - 0.2]) {
          for (const dz of [-od / 2 + 0.2, od / 2 - 0.2]) {
            const p = new THREE.Mesh(
              new THREE.CylinderGeometry(0.11, 0.11, 2.8, 10),
              woodMat
            );
            p.position.set(ox + dx, 1.4, oz + dz);
            p.castShadow = true;
            scene.add(p);
          }
        }

        // Pitched Market Roof + Colorful Thai Silk Awning
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(Math.max(ow, od) * 0.78, 1.25, 4),
          new THREE.MeshStandardMaterial({
            color: isBua ? 0xbe185d : 0xb45309,
            roughness: 0.5,
          })
        );
        roof.rotation.y = Math.PI / 4;
        roof.scale.set(1.25, 1, 0.78);
        roof.position.set(ox, 3.2, oz);
        roof.castShadow = true;
        scene.add(roof);

        // 3D Woven Baskets of Offerings on the Counter
        for (const bx of [-ow * 0.28, 0, ow * 0.28]) {
          const basket = new THREE.Mesh(
            new THREE.CylinderGeometry(0.42, 0.32, 0.28, 14),
            new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
          );
          basket.position.set(ox + bx, 1.18, oz);
          scene.add(basket);

          const goods = new THREE.Mesh(
            new THREE.SphereGeometry(0.32, 12, 10),
            new THREE.MeshStandardMaterial({
              color: isBua ? (bx === 0 ? 0xf472b6 : 0x22c55e) : 0xfef08a,
              roughness: 0.45,
            })
          );
          goods.scale.set(1, 0.55, 1);
          goods.position.set(ox + bx, 1.34, oz);
          scene.add(goods);
        }
      } else if (obs.label.includes('โต๊ะ')) {
        // 3D Sukhothai Krathong Crafting Table
        const tableTop = new THREE.Mesh(
          new THREE.BoxGeometry(ow, 0.18, od),
          woodMat
        );
        tableTop.position.set(ox, 0.95, oz);
        tableTop.castShadow = true;
        tableTop.receiveShadow = true;
        scene.add(tableTop);

        const silkRunner = new THREE.Mesh(
          new THREE.BoxGeometry(ow * 0.85, 0.04, od + 0.12),
          new THREE.MeshStandardMaterial({ color: 0xbe185d, roughness: 0.45 })
        );
        silkRunner.position.set(ox, 1.05, oz);
        scene.add(silkRunner);

        for (const lx of [-ow / 2 + 0.22, ow / 2 - 0.22]) {
          for (const lz of [-od / 2 + 0.22, od / 2 - 0.22]) {
            const leg = new THREE.Mesh(
              new THREE.CylinderGeometry(0.1, 0.1, 0.92, 10),
              woodMat
            );
            leg.position.set(ox + lx, 0.46, oz + lz);
            scene.add(leg);
          }
        }
      } else if (obs.label.includes('สระบัว')) {
        // 3D Firefly Lotus Pond
        const pondWater = new THREE.Mesh(
          new THREE.CylinderGeometry(ow * 0.58, ow * 0.58, 0.12, 28),
          new THREE.MeshStandardMaterial({
            color: 0x0e7490,
            roughness: 0.18,
            metalness: 0.55,
          })
        );
        pondWater.scale.set(1.15, 1, 0.82);
        pondWater.position.set(ox, 0.04, oz);
        scene.add(pondWater);

        const pondRim = new THREE.Mesh(
          new THREE.TorusGeometry(ow * 0.58, 0.18, 10, 32),
          new THREE.MeshStandardMaterial({ color: 0x5eead4, roughness: 0.55 })
        );
        pondRim.rotation.x = Math.PI / 2;
        pondRim.scale.set(1.15, 0.82, 1);
        pondRim.position.set(ox, 0.12, oz);
        scene.add(pondRim);

        // 3D Lily Pads & Pink Lotus Blossoms
        const padOffsets = [
          [-1.2, -0.4],
          [0.2, 0.5],
          [1.3, -0.3],
          [-0.4, 0.8],
        ];
        for (const [pdx, pdz] of padOffsets) {
          const pad = new THREE.Mesh(
            new THREE.CylinderGeometry(0.52, 0.52, 0.04, 16),
            new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 })
          );
          pad.position.set(ox + pdx, 0.12, oz + pdz);
          scene.add(pad);

          const lotus = new THREE.Mesh(
            new THREE.ConeGeometry(0.24, 0.32, 8),
            new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.35 })
          );
          lotus.position.set(ox + pdx, 0.28, oz + pdz);
          scene.add(lotus);
        }
      } else if (obs.label.includes('ต้น')) {
        // 3D Lush Tropical Frangipani & Banyan Trees
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.44, 2.4, 12),
          woodMat
        );
        trunk.position.set(ox, 1.2, oz);
        trunk.castShadow = true;
        scene.add(trunk);

        const leafMat = new THREE.MeshStandardMaterial({
          color: 0x15803d,
          roughness: 0.72,
        });
        const crowns = [
          [0, 3.0, 0, 1.55],
          [-0.95, 2.5, 0.4, 1.1],
          [0.95, 2.55, -0.3, 1.15],
          [0, 2.6, -0.85, 1.05],
        ];
        for (const [cx, cy, cz, cr] of crowns) {
          const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(cr, 16, 14),
            leafMat
          );
          sphere.position.set(ox + cx, cy, oz + cz);
          sphere.castShadow = true;
          scene.add(sphere);
        }
      } else {
        // 3D Tall Yi Peng Bamboo Archway Pillars
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.26, 0.3, 4.2, 12),
          new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 })
        );
        pillar.position.set(ox, 2.1, oz);
        pillar.castShadow = true;
        scene.add(pillar);
      }
    }

    // Overhead 3D Yi Peng Arch Beam & Hanging Octagonal Lanna Lanterns
    const archBeam = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 0.42, 0.52),
      goldMat
    );
    archBeam.position.set(to3DX(258), 4.15, to3DZ(152));
    archBeam.castShadow = true;
    scene.add(archBeam);

    const festoonCols = [0xfbbf24, 0xf472b6, 0x2dd4bf, 0xfb923c];
    for (let i = 0; i < 7; i += 1) {
      const fx = to3DX(210 + i * 72);
      const fz = to3DZ(156 + (i > 2 ? (i - 2) * 18 : 0));
      const lantern = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.16, 0.48, 8),
        new THREE.MeshBasicMaterial({ color: festoonCols[i % festoonCols.length] })
      );
      lantern.position.set(fx, 3.55, fz);
      scene.add(lantern);
    }

    // 3D Framed Real-Location Scenic Photo Billboards beside each zone!
    const loader = new THREE.TextureLoader();
    const billboards = [
      { asset: LANDMARK_ASSETS.yipeng, px: 400, py: 108 },
      { asset: LANDMARK_ASSETS.market, px: 1090, py: 108 },
      { asset: LANDMARK_ASSETS.sala, px: 340, py: 416 },
      { asset: LANDMARK_ASSETS.lotus, px: 158, py: 668 },
      { asset: LANDMARK_ASSETS.sukhothai, px: 874, py: 358 },
      { asset: LANDMARK_ASSETS.river, px: 1126, py: 658 },
    ];
    for (const bb of billboards) {
      const boardGroup = new THREE.Group();
      boardGroup.position.set(to3DX(bb.px), 0, to3DZ(bb.py));

      const postL = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8),
        woodMat
      );
      postL.position.set(-1.6, 1.1, 0);
      const postR = postL.clone();
      postR.position.set(1.6, 1.1, 0);

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 2.1, 0.16),
        goldMat
      );
      frame.position.set(0, 1.75, 0);
      frame.castShadow = true;

      const photoMat = new THREE.MeshBasicMaterial({ color: 0xcbd5e1 });
      const photoPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(3.32, 1.82),
        photoMat
      );
      photoPlane.position.set(0, 1.75, 0.095);

      loader.load(
        bb.asset.imagePath,
        (tex) => {
          if (this.destroyed) {
            tex.dispose();
            return;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          photoMat.map = tex;
          photoMat.color.setHex(0xffffff);
          photoMat.needsUpdate = true;
        },
        undefined,
        () => {
          // Safe fallback if headless/offline
        }
      );

      boardGroup.add(postL, postR, frame, photoPlane);
      scene.add(boardGroup);
    }

    // 3D Ambient Floating Krathongs on the River
    const ambDefs = [
      { basePx: 240, basePy: 795, speed: 0.011 },
      { basePx: 590, basePy: 855, speed: 0.014 },
      { basePx: 1190, basePy: 790, speed: 0.01 },
    ];
    for (const def of ambDefs) {
      const grp = buildKrathong3DGroup(
        {
          base: 'classic-banana',
          flower: 'golden-marigold',
          glow: 'amber-candle',
          wishText: '',
        },
        'classic',
        this.textures.goldGlow
      );
      grp.scale.setScalar(0.85);
      grp.position.set(to3DX(def.basePx), -0.18, to3DZ(def.basePy));
      scene.add(grp);
      this.ambientKrathongs.push({ group: grp, ...def });
    }

    // 3D Orbiting Fireflies
    const fireflyCoords = [
      [175, 470, 0],
      [250, 560, 1.2],
      [335, 495, 2.3],
      [420, 605, 3.4],
      [530, 565, 4.5],
      [610, 445, 5.2],
      [1080, 530, 1.8],
      [1210, 615, 2.9],
    ];
    for (const [fx, fy, phase] of fireflyCoords) {
      const sp = createGlowSprite(this.textures.goldGlow, 0.55, 0.85);
      const ox = to3DX(fx);
      const oz = to3DZ(fy);
      sp.position.set(ox, 1.1, oz);
      scene.add(sp);
      this.fireflies.push({ sprite: sp, ox, oy: 1.1, oz, phase });
    }
  }

  private buildInteractiveSpots(scene: THREE.Scene): void {
    if (!this.textures) return;

    // Nearby active spot golden 3D beacon halo
    const haloGrp = new THREE.Group();
    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.75, 36),
      new THREE.MeshBasicMaterial({
        color: 0xfde68a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
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
          : spot.kind === 'gather' || spot.kind === 'pavilion'
            ? 0xf472b6
            : 0xfbbf24;

      const ringMat = new THREE.MeshBasicMaterial({
        color: ringColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.58,
      });
      const spotRing = new THREE.Mesh(
        new THREE.RingGeometry(0.95, 1.18, 28),
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
        // 3D Ceremony Lantern Pedestal
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.14, 2.5, 10),
          new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.65 })
        );
        post.position.set(0, 1.25, -0.7);
        post.castShadow = true;
        spotGroup.add(post);

        const bulbMat = new THREE.MeshStandardMaterial({
          color: 0x78350f,
          emissive: new THREE.Color(0x78350f),
          emissiveIntensity: 0.4,
        });
        const bulb = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32, 0.24, 0.66, 10),
          bulbMat
        );
        bulb.position.set(0, 2.55, -0.7);
        spotGroup.add(bulb);

        const glowSprite = createGlowSprite(this.textures.goldGlow, 1.3, 0.3);
        glowSprite.position.copy(bulb.position);
        spotGroup.add(glowSprite);

        const light = new THREE.PointLight(0xfbbf24, 0, 12, 1.5);
        light.position.copy(bulb.position);
        spotGroup.add(light);

        this.lanternVisuals.push({
          id: spot.id,
          bulbMat,
          ringMat,
          glowSprite,
          light,
        });
      } else if (spot.kind === 'npc') {
        // 3D NPC Figure (ป้าบัว / ลุงมั่น)
        const isBua = spot.id === 'npc-bua';
        const npcProfile = {
          id: 'p1' as const,
          name: spot.npcName ?? spot.title,
          customization: {
            skinTone: 'golden-tan' as const,
            hairStyle: isBua ? ('wavy-bob' as const) : ('short-classic' as const),
            hairColor: isBua ? ('obsidian' as const) : ('honey-gold' as const),
            outfit: isBua ? ('silk-lotus' as const) : ('emerald-sabai' as const),
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
      label.position.set(0, spot.kind === 'lantern' ? 3.45 : 2.35, 0);
      spotGroup.add(label);

      scene.add(spotGroup);
    }
  }

  private buildPlayers(scene: THREE.Scene): void {
    if (!this.textures) return;
    const p1Rig = buildCharacter3DRig(this.snapshot.players.p1);
    const p2Rig = buildCharacter3DRig(this.snapshot.players.p2);
    scene.add(p1Rig.root, p2Rig.root);
    this.playerRigs = { p1: p1Rig, p2: p2Rig };

    // 3D Romantic Couple Tether Ribbon & Floating Heart when standing close
    const tetherGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const tetherLine = new THREE.Line(
      tetherGeo,
      new THREE.LineBasicMaterial({
        color: 0xf9a8d4,
        transparent: true,
        opacity: 0.65,
      })
    );
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
    if (!this.scene || !this.playerRigs || !this.textures) return;

    const cameraTargetId: PlayerId =
      this.playMode === 'online'
        ? this.myOnlineRole
        : this.snapshot.settings.activePlayer;

    for (const pid of ['p1', 'p2'] as const) {
      const profile = this.snapshot.players[pid];
      const rig = this.playerRigs[pid];
      const wx = to3DX(profile.position.x);
      const wz = to3DZ(profile.position.y);
      const wy = this.getGroundElevation(profile.position.x, profile.position.y);

      rig.root.position.set(wx, wy, wz);
      rig.targetYaw = yawFromFacing(profile.position.facing);
      syncCharacter3DRig(rig, profile, pid === cameraTargetId);
    }

    // Romantic couple proximity tether in 3D
    if (this.coupleTetherLine && this.coupleHeartSprite) {
      const p1Pos = this.snapshot.players.p1.position;
      const p2Pos = this.snapshot.players.p2.position;
      const distPx = Math.hypot(p1Pos.x - p2Pos.x, p1Pos.y - p2Pos.y);
      if (distPx <= 145) {
        const a = this.playerRigs.p1.root.position;
        const b = this.playerRigs.p2.root.position;
        this.coupleTetherLine.geometry.setFromPoints([
          new THREE.Vector3(a.x, a.y + 0.85, a.z),
          new THREE.Vector3(b.x, b.y + 0.85, b.z),
        ]);
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

    // Sync Yi Peng Lantern lighting
    for (const lv of this.lanternVisuals) {
      const lit = this.snapshot.litLanternIds.includes(lv.id);
      lv.bulbMat.color.setHex(lit ? 0xfef08a : 0x78350f);
      lv.bulbMat.emissive.setHex(lit ? 0xfbbf24 : 0x78350f);
      lv.bulbMat.emissiveIntensity = lit ? 1.4 : 0.3;
      lv.glowSprite.scale.setScalar(lit ? 2.6 : 1.1);
      lv.glowSprite.material.opacity = lit ? 0.92 : 0.25;
      lv.ringMat.opacity = lit ? 0.95 : 0.45;
      lv.light.intensity = lit ? 4.8 : 0;
    }

    // Sync 3D Crafted Krathong preview on table
    if (this.craftPreviewGroup) {
      this.craftPreviewGroup.visible = this.snapshot.krathongCrafted;
      if (this.snapshot.krathongCrafted) {
        const sig = `${this.snapshot.krathongDesign.base}|${this.snapshot.krathongDesign.flower}|${this.snapshot.krathongDesign.glow}`;
        if (this.lastCraftSignature !== sig) {
          this.lastCraftSignature = sig;
          while (this.craftPreviewGroup.children.length > 0) {
            this.craftPreviewGroup.remove(this.craftPreviewGroup.children[0]);
          }
          this.craftPreviewGroup.add(
            buildKrathong3DGroup(
              this.snapshot.krathongDesign,
              'radiant',
              this.textures.goldGlow
            )
          );
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
    const existingIds = new Set(this.snapshot.releasedKrathongs.map((k) => k.id));
    for (const [id, kv] of this.krathongVisuals.entries()) {
      if (!existingIds.has(id)) {
        this.scene.remove(kv.group);
        this.krathongVisuals.delete(id);
      }
    }

    for (const item of this.snapshot.releasedKrathongs) {
      if (!this.krathongVisuals.has(item.id)) {
        const grp = buildKrathong3DGroup(
          item.design,
          item.quality.tier,
          this.textures.goldGlow
        );
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

        if (item.quality.tier !== 'classic') {
          const kLight = new THREE.PointLight(0xfbbf24, 2.2, 7, 1.6);
          kLight.position.set(0, 0.65, 0);
          grp.add(kLight);
        }

        grp.position.set(to3DX(item.x), -0.18, to3DZ(item.y));
        this.scene.add(grp);
        this.krathongVisuals.set(item.id, {
          id: item.id,
          group: grp,
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
      this.playMode === 'online'
        ? this.myOnlineRole
        : this.snapshot.settings.activePlayer;
    const target = this.playerRigs[focusId].root.position;
    const { dist, height } = this.getCameraPresetMetrics();
    this.camera.position.set(
      target.x + Math.sin(this.cameraYaw) * dist,
      target.y + height,
      target.z + Math.cos(this.cameraYaw) * dist
    );
    this.camera.lookAt(target.x, target.y + 1.15, target.z);
  }

  private getCameraPresetMetrics(): { dist: number; height: number } {
    const base =
      this.cameraPreset === 'close'
        ? { dist: 8.2, height: 4.3 }
        : this.cameraPreset === 'overview'
          ? { dist: 21.5, height: 16.5 }
          : { dist: 13.5, height: 9.2 };
    return {
      dist: base.dist * this.zoomFactor,
      height: base.height * this.zoomFactor,
    };
  }

  private isModalOpen(): boolean {
    return this.modalBlocked || Boolean(document.querySelector('dialog[open]'));
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

      if (this.playMode === 'online') {
        const myInX = wasdX + arrowX + (touchActive ? this.touchVector.x : 0);
        const myInY = wasdY + arrowY + (touchActive ? this.touchVector.y : 0);
        dispatchCameraRelativeMove(this.myOnlineRole, myInX, myInY);
      } else {
        const activeId = this.snapshot.settings.activePlayer;
        const p1InX =
          wasdX + (touchActive && activeId === 'p1' ? this.touchVector.x : 0);
        const p1InY =
          wasdY + (touchActive && activeId === 'p1' ? this.touchVector.y : 0);
        const p2InX =
          arrowX + (touchActive && activeId === 'p2' ? this.touchVector.x : 0);
        const p2InY =
          arrowY + (touchActive && activeId === 'p2' ? this.touchVector.y : 0);

        dispatchCameraRelativeMove('p1', p1InX, p1InY);
        dispatchCameraRelativeMove('p2', p2InX, p2InY);
      }

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

    // Smooth 3D Follow Camera
    if (this.camera && this.playerRigs) {
      const focusId: PlayerId =
        this.playMode === 'online'
          ? this.myOnlineRole
          : this.snapshot.settings.activePlayer;
      const target = this.playerRigs[focusId].root.position;
      const { dist, height } = this.getCameraPresetMetrics();
      const wantX = target.x + Math.sin(this.cameraYaw) * dist;
      const wantY = target.y + height;
      const wantZ = target.z + Math.cos(this.cameraYaw) * dist;

      const camLerp = this.reducedMotion ? 1 : Math.min(1, dtFactor * 0.14);
      this.camera.position.x += (wantX - this.camera.position.x) * camLerp;
      this.camera.position.y += (wantY - this.camera.position.y) * camLerp;
      this.camera.position.z += (wantZ - this.camera.position.z) * camLerp;
      this.camera.lookAt(target.x, target.y + 1.15, target.z);
    }

    // Environmental 3D Animations (Water ripples, Sky Lanterns, Fireflies, Krathongs)
    if (!this.reducedMotion) {
      if (this.textures) {
        this.textures.water.offset.x = (nowMs * 0.00004) % 1;
        this.textures.water.offset.y = Math.sin(nowMs * 0.0004) * 0.02;
      }

      for (const sl of this.skyLanterns) {
        sl.y += (deltaMs / 1000) * sl.speed;
        if (sl.y > 22) sl.y = 4.2;
        sl.group.position.set(
          sl.baseX + Math.sin(nowMs * 0.0007 + sl.phase) * 0.8,
          sl.y,
          sl.baseZ + Math.cos(nowMs * 0.0006 + sl.phase) * 0.6
        );
      }

      for (const f of this.fireflies) {
        f.sprite.position.set(
          f.ox + Math.sin(nowMs * 0.0014 + f.phase) * 0.85,
          f.oy + Math.sin(nowMs * 0.0022 + f.phase) * 0.32,
          f.oz + Math.cos(nowMs * 0.0017 + f.phase) * 0.65
        );
        f.sprite.material.opacity =
          0.42 + 0.45 * Math.sin(nowMs * 0.003 + f.phase);
      }

      for (const amb of this.ambientKrathongs) {
        const driftPx = (nowMs * amb.speed) % 240;
        amb.group.position.x = to3DX(amb.basePx + driftPx);
        amb.group.position.y =
          -0.18 + Math.sin(nowMs * 0.002 + amb.basePx) * 0.035;
      }

      let idx = 0;
      for (const kv of this.krathongVisuals.values()) {
        const driftPx = (nowMs * 0.015 + idx * 60) % 340;
        kv.group.position.x = to3DX(kv.basePx + driftPx);
        kv.group.position.y = -0.18 + Math.sin(nowMs * 0.0022 + idx) * 0.04;
        kv.group.rotation.y = Math.sin(nowMs * 0.0008 + idx) * 0.25;
        idx += 1;
      }

      if (this.nearbyHaloGroup?.visible) {
        const pulse = 1 + Math.sin(nowMs * 0.005) * 0.08;
        this.nearbyHaloGroup.scale.set(pulse, 1, pulse);
      }
    }
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
            this.playMode === 'online'
              ? this.myOnlineRole
              : this.snapshot.settings.activePlayer;
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
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.container || !this.renderer || !this.camera) return;
        const w = Math.max(240, this.container.clientWidth);
        const h = Math.max(240, this.container.clientHeight);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
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
