import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../src/domain/reducer';
import { FestivalScene } from '../src/game/FestivalScene';
import { FestivalAssets, type FestivalModel } from '../src/game/festival/assets';
import { createOffering } from '../src/game/festival/offerings';
import { buildCharacter3DRig } from '../src/game/textures';

describe('Three.js 3D Festival World, Avatars, Krathongs & Camera Math', () => {
  it('constructs both character rigs and loads the Blender offerings with distinct quality tiers', async () => {
    const state = createInitialGameState();

    const p1Rig = buildCharacter3DRig(state.players.p1);
    const p2Rig = buildCharacter3DRig(state.players.p2);
    expect(p1Rig.root).toBeInstanceOf(THREE.Group);
    expect(p2Rig.root).toBeInstanceOf(THREE.Group);
    expect(p1Rig.bodyPivot.children.length).toBeGreaterThan(6);

    const glb = readFileSync('public/models/festival/offerings.glb');
    const data = new ArrayBuffer(glb.byteLength);
    new Uint8Array(data).set(glb);
    const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(data, '');
    const parts = new Map<FestivalModel, THREE.Object3D>();
    for (const name of ['BananaKrathong', 'CoconutKrathong', 'HeartKrathong', 'LotusCrown', 'MarigoldCrown', 'RoseCrown'] as const) {
      const object = scene.getObjectByName(name);
      expect(object).toBeDefined();
      if (object) parts.set(name, object);
    }
    const assets = new FestivalAssets(parts);
    const classic = createOffering(assets, state.krathongDesign, 'classic');
    const celestial = createOffering(assets, state.krathongDesign, 'celestial');
    expect(celestial.group.children.length).toBeGreaterThan(classic.group.children.length);
    expect(celestial.group.scale.x).toBeGreaterThan(classic.group.scale.x);
    expect(new THREE.Box3().setFromObject(classic.group).getSize(new THREE.Vector3()).x).toBeGreaterThan(0.9);
  });

  it('cycles 3D camera presets and transforms movement vectors relative to 360-degree camera orbit', () => {
    const state = createInitialGameState();
    const scene = new FestivalScene(
      state,
      { onMove: vi.fn(), onInteractSpot: vi.fn() },
      false
    );

    // Default yaw = 0: pressing Up (0, -1) moves North (dx = 0, dy = -1)
    const northMove = scene.transformInputVector(0, -1);
    expect(northMove.dx).toBeCloseTo(0, 5);
    expect(northMove.dy).toBeCloseTo(-1, 5);

    // Cycle camera presets: follow -> close -> overview -> follow
    expect(scene.cycleCameraPreset()).toBe('close');
    expect(scene.cycleCameraPreset()).toBe('overview');
    expect(scene.cycleCameraPreset()).toBe('follow');
  });
});
