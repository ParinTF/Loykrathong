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

describe('Three.js 3D Festival World, Avatars, Score-Free Offerings & Release Cinematic', () => {
  it('constructs both character rigs (with accessories) and loads Blender offerings without quality-score gating', async () => {
    const state = createInitialGameState();
    state.players.p1.customization.accessory = 'gold-lotus';

    const p1Rig = buildCharacter3DRig(state.players.p1);
    const p2Rig = buildCharacter3DRig(state.players.p2);
    expect(p1Rig.root).toBeInstanceOf(THREE.Group);
    expect(p2Rig.root).toBeInstanceOf(THREE.Group);
    expect(p1Rig.bodyPivot.children.length).toBeGreaterThan(6);

    const glb = readFileSync('public/models/festival/offerings.glb');
    const data = new ArrayBuffer(glb.byteLength);
    new Uint8Array(data).set(glb);
    const { scene } = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(data, '');
    const parts = new Map<FestivalModel, THREE.Object3D>();
    for (const name of [
      'BananaKrathong',
      'CoconutKrathong',
      'HeartKrathong',
      'LotusCrown',
      'MarigoldCrown',
      'RoseCrown',
    ] as const) {
      const object = scene.getObjectByName(name);
      expect(object).toBeDefined();
      if (object) parts.set(name, object);
    }
    const assets = new FestivalAssets(parts);
    const ambient = createOffering(assets, state.krathongDesign, 'ambient');
    const couple = createOffering(assets, state.krathongDesign, 'couple');
    expect(couple.group.children.length).toBeGreaterThan(
      ambient.group.children.length
    );
    expect(couple.group.scale.x).toBeGreaterThan(ambient.group.scale.x);
    expect(
      new THREE.Box3()
        .setFromObject(ambient.group)
        .getSize(new THREE.Vector3()).x
    ).toBeGreaterThan(0.9);
  });

  it('cycles 3D camera presets, transforms orbit vectors, and triggers/stops release cinematic cleanly', () => {
    const state = createInitialGameState();
    const scene = new FestivalScene(
      state,
      { onMove: vi.fn(), onInteractSpot: vi.fn() },
      false
    );

    const northMove = scene.transformInputVector(0, -1);
    expect(northMove.dx).toBeCloseTo(0, 5);
    expect(northMove.dy).toBeCloseTo(-1, 5);

    expect(scene.cycleCameraPreset()).toBe('close');
    expect(scene.cycleCameraPreset()).toBe('overview');
    expect(scene.cycleCameraPreset()).toBe('follow');

    const onDone = vi.fn();
    scene.startReleaseCinematic('krathong-1', onDone);
    scene.stopReleaseCinematic();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
