import * as THREE from 'three';
import type { ModelPlacement } from './assets';
import { toWorldX, toWorldZ } from './space';

export function addFestivalLights(scene: THREE.Scene): THREE.DirectionalLight {
  scene.add(new THREE.HemisphereLight(0xb9cffe, 0x59516a, 1.16));
  const moon = new THREE.DirectionalLight(0xc2d5ff, 1.95);
  moon.position.set(-24, 36, -15);
  moon.castShadow = true;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 106;
  moon.shadow.camera.left = -42;
  moon.shadow.camera.right = 42;
  moon.shadow.camera.top = 34;
  moon.shadow.camera.bottom = -39;
  moon.shadow.normalBias = 0.026;
  moon.shadow.bias = -0.00025;
  moon.shadow.radius = 2.4;
  moon.shadow.intensity = 0.68;
  scene.add(moon);

  const fills = [
    [490, 2.42, 534, 0xffb27b, 28, 11],
    [980, 2.32, 195, 0xffbf8b, 31, 10],
    [1232, 2.32, 231, 0xffa96d, 27, 10],
    [760, 1.87, 434, 0xffc58e, 17, 9],
    [941, 1.95, 806, 0xffc183, 22, 10],
    [258, 3.11, 195, 0xffb773, 24, 10],
  ];
  for (const [x, y, z, color, intensity, range] of fills) {
    const lantern = new THREE.PointLight(color, intensity, range, 2);
    lantern.position.set(toWorldX(x), y, toWorldZ(z));
    scene.add(lantern);
  }
  return moon;
}

export interface GroundPool extends ModelPlacement {
  width: number;
  length: number;
}

function contactTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext('2d');
  if (context) {
    const shadow = context.createRadialGradient(24, 24, 1, 24, 24, 23.5);
    shadow.addColorStop(0, 'rgba(26, 34, 43, 0.72)');
    shadow.addColorStop(0.38, 'rgba(26, 34, 43, 0.53)');
    shadow.addColorStop(1, 'rgba(26, 34, 43, 0)');
    context.fillStyle = shadow;
    context.fillRect(0, 0, 48, 48);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function addPlayerContactShadows(players: THREE.Group[]): void {
  const geometry = new THREE.PlaneGeometry(1.4, 1.2).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    map: contactTexture(), transparent: true, opacity: 0.86, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1,
  });
  for (const root of players) {
    root.traverse((object) => { object.castShadow = false; });
    const shadow = new THREE.Mesh(geometry, material);
    shadow.position.set(0, 0.015, -0.02);
    root.add(shadow);
  }
}

export function addContactOcclusion(scene: THREE.Scene, pools: GroundPool[]): void {
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    map: contactTexture(), transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3,
  });
  const decals = new THREE.InstancedMesh(geometry, material, pools.length);
  decals.name = 'Soft contact occlusion';
  const transform = new THREE.Object3D();
  pools.forEach((pool, index) => {
    transform.position.set(pool.x, pool.y, pool.z);
    transform.rotation.y = pool.yaw ?? 0;
    transform.scale.set(pool.width, 1, pool.length);
    transform.updateMatrix();
    decals.setMatrixAt(index, transform.matrix);
  });
  decals.computeBoundingSphere();
  scene.add(decals);
}
