import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../src/domain/reducer';
import { FestivalScene } from '../src/game/FestivalScene';
import {
  buildCharacter3DRig,
  buildKrathong3DGroup,
  createFestival3DTextures,
} from '../src/game/textures';

describe('Three.js 3D Festival World, Avatars, Krathongs & Camera Math', () => {
  it('constructs 3D couple character rigs and 3D krathong meshes with distinct tiers', () => {
    const state = createInitialGameState();
    const textures = createFestival3DTextures();

    const p1Rig = buildCharacter3DRig(state.players.p1);
    const p2Rig = buildCharacter3DRig(state.players.p2);
    expect(p1Rig.root).toBeInstanceOf(THREE.Group);
    expect(p2Rig.root).toBeInstanceOf(THREE.Group);
    expect(p1Rig.bodyPivot.children.length).toBeGreaterThan(6);

    const classicKrathong = buildKrathong3DGroup(
      state.krathongDesign,
      'classic',
      textures.goldGlow
    );
    const celestialKrathong = buildKrathong3DGroup(
      state.krathongDesign,
      'celestial',
      textures.goldGlow
    );
    expect(celestialKrathong.children.length).toBeGreaterThan(
      classicKrathong.children.length
    );
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
