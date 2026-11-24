import * as THREE from 'three';
import { PIER_WALKABLE_RECT, SOLID_OBSTACLES, circleIntersectsRect } from '../../domain/worldMap';
import { type FestivalAssets, type FestivalModel, type ModelBatch, type ModelPlacement } from './assets';
import { addContactOcclusion, type GroundPool } from './lighting';
import { riverBankZ, seededRandom, toWorldX, toWorldZ, WATER_LEVEL } from './space';
import { createGlowSprite } from '../textures';
import type { GraphicsProfile } from '../graphics';

export interface RiverLight {
  x: number;
  z: number;
  strength: number;
  warmth: number;
}

export interface SwayingProp {
  object: THREE.Object3D;
  phase: number;
  amplitude: number;
}

export interface Scenery {
  riverLights: RiverLight[];
  swaying: SwayingProp[];
  boat: THREE.Group;
  windTime: { value: number };
  swayHangingLanterns(time: number): void;
  updateDetail(camera: THREE.PerspectiveCamera, graphics: GraphicsProfile): void;
}

interface PlantPopulation {
  plants: ModelPlacement[];
  full: ModelBatch;
  distant?: ModelBatch;
  radius: number;
  showingFull: ModelPlacement[];
  showingDistant: ModelPlacement[];
}

const WOODLAND = [
  [130, 347, 1.09], [1330, 501, 1.18], [345, 431, 0.86], [602, 357, 1.0],
  [881, 530, 0.98], [1086, 402, 0.88], [1290, 369, 0.87], [1039, 622, 0.67],
  [121, 105, 1.12], [224, 69, 1.04], [381, 92, 0.98], [521, 79, 1.19],
  [647, 75, 1.38], [775, 61, 1.07], [860, 117, 0.76], [1090, 83, 1.26],
  [1270, 57, 1.29], [1388, 109, 0.97], [1470, 240, 1.09], [-50, 277, 1.13],
];

const PALMS = [
  [155, 684, 1.04], [320, 692, 0.85], [544, 689, 0.88], [1114, 688, 1.0],
  [1218, 646, 0.90], [1401, 670, 1.16], [1150, 528, 0.72], [1217, 114, 0.94],
  [290, 114, 1.0], [588, 162, 0.82], [809, 156, 0.99], [129, 460, 0.87],
  [109, 217, 1.05], [358, 337, 0.83], [925, 460, 0.80], [1354, 237, 0.81],
];

const GARDENS = [
  [174, 477, 65, 35], [235, 592, 100, 42], [347, 399, 74, 41], [374, 579, 58, 24],
  [492, 390, 89, 43], [556, 556, 42, 25], [599, 495, 36, 40], [647, 549, 35, 23],
  [806, 604, 55, 21], [894, 503, 62, 47], [968, 596, 61, 35], [1090, 521, 100, 50],
  [1192, 459, 69, 47], [1325, 553, 95, 50], [1278, 317, 54, 36], [1053, 362, 58, 30],
  [900, 284, 51, 36], [798, 232, 53, 36], [572, 299, 71, 30], [438, 274, 56, 32],
  [340, 249, 40, 29], [206, 304, 68, 42], [220, 99, 63, 31], [494, 130, 95, 30],
  [659, 112, 69, 36], [1093, 120, 42, 27], [1280, 96, 62, 25],
];

function placement(px: number, py: number, scale = 1, yaw = 0, y = 0): ModelPlacement {
  return { x: toWorldX(px), y, z: toWorldZ(py), scale, yaw };
}

function addPlantWind(group: THREE.Group, time: { value: number }): void {
  group.traverse((child) => {
    if (!(child instanceof THREE.InstancedMesh) || !(child.material instanceof THREE.MeshStandardMaterial)) return;
    const material = child.material.clone();
    material.onBeforeCompile = (shader) => {
      shader.uniforms.festivalWindTime = time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float festivalWindTime;')
        .replace('#include <begin_vertex>', /* glsl */ `
          #include <begin_vertex>
          vec2 rooted = instanceMatrix[3].xz;
          float gust = festivalWindTime * 1.09 + rooted.x * 0.64 + rooted.y * 0.52;
          float tip = clamp(position.y * 1.58, 0.0, 1.0);
          transformed.xz += vec2(sin(gust), 0.5 * cos(gust * 1.28)) * tip * tip * 0.17;
        `);
    };
    material.customProgramCacheKey = () => 'festival foliage breeze';
    child.material = material;
  });
}

function pond(scene: THREE.Scene, assets: FestivalAssets): void {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 48; i += 1) {
    const angle = i * Math.PI * 2 / 48;
    const edge = 1 + 0.06 * Math.cos(angle * 3) + 0.04 * Math.sin(angle * 5);
    const point = [2.9 * Math.cos(angle) * edge, 1.78 * Math.sin(angle) * edge] as const;
    if (i === 0) shape.moveTo(...point);
    else shape.lineTo(...point);
  }
  const water = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({
    color: 0x2d6c73, metalness: 0.34, roughness: 0.24, emissive: 0x1b3034, emissiveIntensity: 0.35,
  }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(toWorldX(182), 0.042, toWorldZ(604));
  water.receiveShadow = true;
  scene.add(water);
  scene.add(assets.instances('Lotus', [
    placement(151, 595, 0.84, 1.1, 0.035),
    placement(185, 615, 1.02, 2.3, 0.035),
    placement(207, 590, 0.78, 4.0, 0.035),
    placement(217, 615, 0.61, 0.8, 0.035),
  ]));
}

export function populateScenery(scene: THREE.Scene, assets: FestivalAssets, glow: THREE.Texture, compact: boolean): Scenery {
  const random = seededRandom(20261124);
  const riverLights: RiverLight[] = [];
  const swaying: SwayingProp[] = [];
  const windTime = { value: 0 };
  const contact: GroundPool[] = [];
  const populations: PlantPopulation[] = [];
  const add = (model: FestivalModel, px: number, py: number, scale = 1, yaw = 0, y = 0) => {
    const object = assets.create(model, placement(px, py, scale, yaw, y));
    scene.add(object);
    return object;
  };
  const haloAt = (x: number, y: number, z: number, size: number, alpha: number) => {
    const halo = createGlowSprite(glow, size, alpha);
    halo.position.set(x, y, z);
    scene.add(halo);
    return halo;
  };
  const addPlants = (species: FestivalModel, plants: ModelPlacement[], distant?: FestivalModel, wind = false) => {
    const full = assets.batch(species, plants, false, true);
    if (wind) addPlantWind(full.group, windTime);
    const low = distant ? assets.batch(distant, plants, false, true) : undefined;
    if (low) {
      low.update([]);
      scene.add(low.group);
    }
    scene.add(full.group);
    const radius = species === 'CanopyTree' || species === 'PalmTree' || species === 'FanPalm' ? 4.2 : 1.35;
    populations.push({ plants, full, distant: low, radius, showingFull: plants, showingDistant: [] });
  };
  const pierX = PIER_WALKABLE_RECT.x + PIER_WALKABLE_RECT.w / 2;
  const pierY = PIER_WALKABLE_RECT.y + PIER_WALKABLE_RECT.h / 2;

  add('Sala', 490, 505);
  add('FlowerStall', 980, 150);
  add('IncenseStall', 1232, 186);
  add('CraftBench', 760, 418);
  add('LanternGate', 258, 152);
  add('Pier', pierX, pierY);
  add('Bridge', 334, 635, 0.96, Math.PI / 2);
  contact.push(
    { ...placement(490, 505, 1, 0, 0.032), width: 8.8, length: 6.25 },
    { ...placement(980, 150, 1, 0, 0.032), width: 7.9, length: 4.54 },
    { ...placement(1232, 186, 1, 0, 0.032), width: 7.9, length: 4.54 },
    { ...placement(760, 418, 1, 0, 0.032), width: 6.2, length: 2.9 },
  );
  const boat = add('Longboat', 1120, 786, 1.14, -0.63, WATER_LEVEL - 0.11);
  pond(scene, assets);

  const lamps = [
    [184, 529], [331, 532], [413, 576], [568, 574], [639, 647], [812, 567],
    [828, 391], [882, 322], [989, 278], [1146, 306], [1259, 303], [1297, 635],
    [1086, 644], [861, 667], [1019, 686], [858, 746], [1022, 744], [868, 826], [1012, 826],
  ];
  const posts = lamps.map(([x, z]) => placement(x, z, z < 710 ? 1 : 0.80, 0, z < 710 ? 0.015 : 0.20));
  scene.add(assets.instances('LampPost', posts));
  posts.forEach((post, index) => {
    haloAt(post.x, post.y + 1.06 * (post.scale ?? 1), post.z, 1.25, 0.30);
    if (index >= 12 || index === 4) {
      riverLights.push({ x: post.x, z: post.z + 1.5, strength: 0.88, warmth: 0.8 });
    }
  });
  for (const [x, y, z, strength] of [
    [441, 2.18, 553, 1.55], [539, 2.18, 553, 1.55], [925, 2.06, 187, 1.45], [1035, 2.06, 187, 1.45],
    [1177, 2.06, 223, 1.35], [1287, 2.06, 223, 1.35], [877, 0.65, 834, 1.2], [1003, 0.65, 834, 1.2],
  ]) {
    haloAt(toWorldX(x), y, toWorldZ(z), strength, 0.31);
  }

  const woodlands = WOODLAND.map(([x, z, scale]) => placement(x, z, scale, random() * 6.28));
  const palms = PALMS.map(([x, z, scale]) => placement(x, z, scale, random() * 6.28));
  for (const [model, plants] of [['CanopyTree', woodlands], ['PalmTree', palms]] as const) {
    contact.push(...plants.map((plant) => ({ ...plant, y: 0.034, width: 2.25 * (plant.scale ?? 1), length: 1.88 * (plant.scale ?? 1) })));
    addPlants(model, plants.slice(3), model === 'PalmTree' ? 'PalmTreeLOD' : 'CanopyTreeLOD');
    for (const place of plants.slice(0, 3)) {
      const object = assets.create(model, place);
      scene.add(object);
      swaying.push({ object, phase: random() * 6.28, amplitude: model === 'PalmTree' ? 0.026 : 0.012 });
    }
  }
  addPlants('FanPalm', [placement(284, 554, 0.58, 1.1), placement(631, 402, 0.58, 3.3),
    placement(1011, 557, 0.69, 2.4), placement(1370, 387, 0.79, 1.8),
    placement(1223, 680, 0.84, 0.65), placement(377, 679, 0.52, -0.38),
  ], 'FanPalmLOD');

  const undergrowth = new Map<FestivalModel, ModelPlacement[]>();
  const plant = (kind: FestivalModel, position: ModelPlacement) => {
    if (!undergrowth.has(kind)) undergrowth.set(kind, []);
    undergrowth.get(kind)?.push(position);
  };
  const kinds = ['MeadowGrass', 'Fern', 'MeadowGrass', 'FieldFlowers', 'FlowerBush', 'MossRock'] as const;
  for (const [x, z, rx, rz] of GARDENS) {
    for (let i = 0; i < (compact ? 8 : 15); i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random());
      const px = x + Math.cos(angle) * radius * rx;
      const pz = z + Math.sin(angle) * radius * rz;
      if (SOLID_OBSTACLES.some((obstacle) => circleIntersectsRect(px, pz, 12, obstacle))) continue;
      const species = kinds[(i + Math.floor(random() * 3)) % kinds.length];
      plant(species, { ...placement(px, pz, 0.64 + random() * 0.88, angle), tint: i % 3 === 0 ? 0xe5e2ba : 0xf2f9eb });
    }
  }
  for (let i = 0; i < (compact ? 65 : 106); i += 1) {
    const x = -37 + i * (74 / (compact ? 65 : 106));
    if (x > toWorldX(841) && x < toWorldX(1044)) continue;
    const z = riverBankZ(x);
    const scale = 0.47 + random() * 0.8;
    plant(i % 4 === 0 ? 'MossRock' : i % 7 === 0 ? 'Fern' : 'MeadowGrass',
      { x, y: -0.045, z: z - 0.43 - random() * 0.57, yaw: random() * 6.28, scale });
    if (i % 9 === 0) {
      plant('Lotus', { x: x - 0.19, y: WATER_LEVEL, z: z + 1.15, scale, yaw: random() * 6.28 });
    }
  }
  for (let i = 0; i < 14; i += 1) {
    const angle = i / 14 * Math.PI * 2;
    plant('MossRock', { x: toWorldX(182) + Math.cos(angle) * 2.77, y: -0.08,
      z: toWorldZ(604) + Math.sin(angle) * 1.72, scale: 0.62 + random() * 0.38, yaw: angle });
  }
  for (const [model, places] of undergrowth) {
    const wind = model === 'MeadowGrass' || model === 'Fern' || model === 'FieldFlowers';
    if (model === 'FlowerBush' || wind) {
      addPlants(model, places, model === 'FlowerBush' ? 'FlowerBushLOD' : undefined, wind);
    } else {
      scene.add(assets.instances(model, places));
    }
  }
  for (const place of undergrowth.get('MossRock') ?? []) {
    if (place.y >= 0) contact.push({ ...place, y: 0.032, width: 1.2 * (place.scale ?? 1), length: 1.03 * (place.scale ?? 1) });
  }
  addContactOcclusion(scene, contact);

  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(128, 15), new THREE.MeshStandardMaterial({
    color: 0x345953, roughness: 1,
  }));
  horizon.rotation.x = -Math.PI / 2;
  horizon.position.set(0, -0.27, 59);
  scene.add(horizon);
  const farTrees = Array.from({ length: 31 }, (_, i) => ({
    x: -63 + i * 4.2 + Math.cos(i * 0.7) * 4, y: -0.27, z: 54 + random() * 8,
    scale: 0.52 + random() * 0.83, yaw: random() * 6.28, tint: 0x88a9c9,
  }));
  scene.add(assets.instances('CanopyTreeLOD', farTrees.filter((_, i) => i % 4 !== 1)));
  scene.add(assets.instances('PalmTreeLOD', farTrees.filter((_, i) => i % 4 === 1)));
  for (const [x, z, scale] of [[-17, 55, 0.57], [18, 57, 0.65], [38, 56, 0.49]]) {
    scene.add(assets.create('DistantStall', { x, y: -0.28, z, scale, yaw: Math.PI }, false));
  }

  const cord = new THREE.MeshStandardMaterial({ color: 0x60483f, roughness: 0.93 });
  const anchors = new Map<string, ModelPlacement>();
  const hanging: ModelPlacement[] = [];
  for (const [sx, sz, ex, ez, height] of [
    [345, 170, 548, 203, 4.2], [568, 256, 755, 282, 3.75], [889, 229, 1100, 267, 4.43],
    [1100, 267, 1308, 260, 4.43], [414, 552, 565, 550, 3.65],
  ]) {
    anchors.set(`${sx}/${sz}`, placement(sx, sz, height / 2.5));
    anchors.set(`${ex}/${ez}`, placement(ex, ez, height / 2.5));
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 11 }, (_, i) => {
      const t = i / 10;
      return new THREE.Vector3(toWorldX(THREE.MathUtils.lerp(sx, ex, t)),
        height - 0.74 * Math.sin(Math.PI * t), toWorldZ(THREE.MathUtils.lerp(sz, ez, t)));
    }));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.015, 4, false), cord));
    for (const t of [0.14, 0.37, 0.63, 0.86]) {
      const { x, y, z } = curve.getPoint(t);
      hanging.push({ x, y: y - 0.28, z, scale: 0.54, yaw: t * 5 });
      haloAt(x, y - 0.28, z, 0.75, 0.31);
    }
  }
  scene.add(assets.instances('CeremonyPost', [...anchors.values()]));
  const lanterns = assets.batch('PaperLantern', hanging, false, true);
  scene.add(lanterns.group);
  const frustum = new THREE.Frustum();
  const frustumMatrix = new THREE.Matrix4();
  const bounds = new THREE.Sphere();
  const samePlants = (a: ModelPlacement[], b: ModelPlacement[]) => a.length === b.length && a.every((plant, index) => plant === b[index]);
  return {
    riverLights, swaying, boat, windTime,
    swayHangingLanterns(time) {
      hanging.forEach((lantern, index) => {
        lantern.roll = Math.sin(time * 1.2 + index * 2.134) * 0.085;
      });
      lanterns.update(hanging);
    },
    updateDetail(camera, graphics) {
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(frustumMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      for (const population of populations) {
        const full: ModelPlacement[] = [];
        const distant: ModelPlacement[] = [];
        const range = population.distant ? graphics.detailDistance : graphics.grassDistance;
        for (const plant of population.plants) {
          const dx = plant.x - camera.position.x;
          const dz = plant.z - camera.position.z;
          const distance = Math.hypot(dx, dz);
          if (!population.distant && distance > range + 4) continue;

          const size = population.radius * (plant.scale ?? 1);
          bounds.center.set(plant.x, plant.y + size * 0.72, plant.z);
          bounds.radius = size + 1.3 + distance * 0.12;
          if (!frustum.intersectsSphere(bounds)) continue;

          const cutoff = population.distant && population.showingFull.includes(plant) ? range + 2 : range;
          if (distance <= cutoff) full.push(plant);
          else if (population.distant) distant.push(plant);
        }
        if (!samePlants(full, population.showingFull)) {
          population.full.update(full);
          population.showingFull = full;
        }
        if (population.distant && !samePlants(distant, population.showingDistant)) {
          population.distant.update(distant);
          population.showingDistant = distant;
        }
      }
    },
  };
}
