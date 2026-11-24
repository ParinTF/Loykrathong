import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const LIBRARIES = {
  'architecture.glb': ['Sala', 'FlowerStall', 'IncenseStall', 'LanternGate', 'CraftBench', 'Pier', 'Bridge', 'DistantStall'],
  'offerings.glb': ['PaperLantern', 'LampPost', 'CeremonyPost', 'Lotus', 'Longboat', 'BananaKrathong',
    'CoconutKrathong', 'HeartKrathong', 'LotusCrown', 'MarigoldCrown', 'RoseCrown'],
  'nature.glb': ['PalmTree', 'FanPalm', 'CanopyTree', 'FlowerBush', 'MossRock', 'MeadowGrass', 'Fern', 'FieldFlowers',
    'PalmTreeLOD', 'FanPalmLOD', 'CanopyTreeLOD', 'FlowerBushLOD'],
} as const;

export type FestivalModel = (typeof LIBRARIES)[keyof typeof LIBRARIES][number];

export interface ModelPlacement {
  x: number;
  y: number;
  z: number;
  scale?: number;
  yaw?: number;
  roll?: number;
  tint?: number;
}

export interface ModelBatch {
  group: THREE.Group;
  update(placements: ModelPlacement[]): void;
}

function setPlacement(object: THREE.Object3D, placement: ModelPlacement): void {
  object.position.set(placement.x, placement.y, placement.z);
  object.rotation.set(0, placement.yaw ?? 0, placement.roll ?? 0);
  object.scale.setScalar(placement.scale ?? 1);
}

export class FestivalAssets {
  private readonly sharedGeometries = new Set<THREE.BufferGeometry>();
  private readonly sharedMaterials = new Set<THREE.Material>();
  private readonly sharedTextures = new Set<THREE.Texture>();

  constructor(private readonly models: Map<FestivalModel, THREE.Object3D>) {
    for (const object of models.values()) {
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        this.sharedGeometries.add(child.geometry);
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
          this.sharedMaterials.add(material);
          if (material.transparent && material instanceof THREE.MeshStandardMaterial) {
            material.transparent = false;
            material.alphaTest = 0.39;
            material.depthWrite = true;
          }
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) this.sharedTextures.add(value);
          }
        }
      });
    }
  }

  private template(name: FestivalModel): THREE.Object3D {
    const object = this.models.get(name);
    if (!object) throw new Error(`Missing festival model: ${name}`);
    return object;
  }

  create(name: FestivalModel, placement: ModelPlacement, castsShadow = true): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    const model = this.template(name).clone(true);
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = castsShadow;
        child.receiveShadow = true;
      }
    });
    setPlacement(group, placement);
    group.add(model);
    return group;
  }

  instances(name: FestivalModel, placements: ModelPlacement[], castsShadow = false): THREE.Group {
    return this.batch(name, placements, castsShadow).group;
  }

  batch(name: FestivalModel, placements: ModelPlacement[], castsShadow = false, moving = false): ModelBatch {
    const group = new THREE.Group();
    group.name = `${name} instances`;
    if (placements.length === 0) return { group, update() {} };
    const model = this.template(name);
    model.updateWorldMatrix(true, true);
    const parentInverse = model.parent?.matrixWorld.clone().invert() ?? new THREE.Matrix4();
    const transform = new THREE.Object3D();
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const geometryParts: { instances: THREE.InstancedMesh; local: THREE.Matrix4 }[] = [];

    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const local = new THREE.Matrix4().multiplyMatrices(parentInverse, child.matrixWorld);
      const instances = new THREE.InstancedMesh(child.geometry, child.material, placements.length);
      for (const [index, placement] of placements.entries()) {
        setPlacement(transform, placement);
        transform.updateMatrix();
        instances.setMatrixAt(index, matrix.multiplyMatrices(transform.matrix, local));
        instances.setColorAt(index, color.setHex(placement.tint ?? 0xffffff));
      }
      instances.computeBoundingSphere();
      instances.castShadow = castsShadow;
      instances.receiveShadow = true;
      if (moving) {
        instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        instances.instanceColor?.setUsage(THREE.DynamicDrawUsage);
        instances.frustumCulled = false;
      }
      geometryParts.push({ instances, local });
      group.add(instances);
    });
    return {
      group,
      update(poses) {
        for (const [index, pose] of poses.entries()) {
          setPlacement(transform, pose);
          transform.updateMatrix();
          color.setHex(pose.tint ?? 0xffffff);
          for (const { instances, local } of geometryParts) {
            instances.setMatrixAt(index, matrix.multiplyMatrices(transform.matrix, local));
            instances.setColorAt(index, color);
          }
        }
        for (const { instances } of geometryParts) {
          instances.count = poses.length;
          instances.instanceMatrix.needsUpdate = true;
          if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
        }
      },
    };
  }

  dispose(root: THREE.Object3D): void {
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    const geometries = new Set<THREE.BufferGeometry>();
    root.traverse((child) => {
      if (child instanceof THREE.InstancedMesh) child.dispose();
      if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.Line) {
        if (!this.sharedGeometries.has(child.geometry)) geometries.add(child.geometry);
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
      } else if (child instanceof THREE.Sprite) {
        materials.add(child.material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) {
      if (this.sharedMaterials.has(material)) continue;
      for (const texture of Object.values(material)) {
        if (texture instanceof THREE.Texture && !this.sharedTextures.has(texture)) textures.add(texture);
      }
      material.dispose();
    }
    for (const texture of textures) texture.dispose();
  }
}

let readyAssets: FestivalAssets | null = null;
let preload: Promise<FestivalAssets> | null = null;

export function preloadFestivalModels(): Promise<FestivalAssets> {
  if (!preload) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    preload = Promise.all(Object.entries(LIBRARIES).map(async ([file, names]) => {
      const url = `${import.meta.env.BASE_URL}models/festival/${file}`;
      const { scene } = await loader.loadAsync(url);
      return names.map((name): [FestivalModel, THREE.Object3D] => {
        const model = scene.getObjectByName(name);
        if (!model) throw new Error(`${file} does not contain ${name}`);
        return [name, model];
      });
    })).then((parts) => {
      readyAssets = new FestivalAssets(new Map(parts.flat()));
      return readyAssets;
    }).catch((error) => {
      preload = null;
      throw error;
    });
  }
  return preload;
}

export function getFestivalModels(): FestivalAssets {
  if (!readyAssets) throw new Error('Preload the festival GLBs before mounting the scene');
  return readyAssets;
}
