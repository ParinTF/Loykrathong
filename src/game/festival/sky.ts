import * as THREE from 'three';
import { seededRandom } from './space';

export const MOON_DIRECTION = new THREE.Vector3(-0.31, 0.145, -0.94).normalize();
export const SKY_HORIZON = new THREE.Color(0x535e86);

function hills(scene: THREE.Scene, radius: number, height: number, color: number, phase: number): void {
  const points: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const base = new THREE.Color(color).lerp(SKY_HORIZON, 0.29);
  const crestColor = new THREE.Color(color);
  for (let i = 0; i <= 144; i += 1) {
    const angle = i * Math.PI * 2 / 144;
    const distance = radius + 2.8 * Math.sin(angle * 3 + phase);
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const crest = height + 2.5 * Math.sin(angle * 8 + phase)
      + 1.22 * Math.sin(angle * 17 + phase * 2) + 0.53 * Math.cos(angle * 27);
    points.push(x, -7, z, x, crest, z);
    colors.push(base.r, base.g, base.b, crestColor.r, crestColor.g, crestColor.b);
    if (i) indices.push(i * 2 - 2, i * 2, i * 2 - 1, i * 2 - 1, i * 2, i * 2 + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  const ridge = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
  ridge.name = 'Hills in the evening haze';
  scene.add(ridge);
}

export function addFestivalSky(scene: THREE.Scene): void {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      moon: { value: MOON_DIRECTION },
      horizon: { value: SKY_HORIZON },
      zenith: { value: new THREE.Color(0x0b1737) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 moon;
      uniform vec3 horizon;
      uniform vec3 zenith;
      varying vec3 vDirection;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        vec3 direction = normalize(vDirection);
        float altitude = smoothstep(-0.10, 0.30, direction.y);
        vec3 sky = mix(horizon, zenith, pow(altitude, 0.62));
        sky += vec3(0.093, 0.034, 0.043) * exp(-abs(direction.y - 0.018) * 13.0);
        float moonDistance = distance(direction, moon);
        float halo = exp(-moonDistance * 11.0) * 0.37 + exp(-moonDistance * 36.0) * 0.3;
        sky += vec3(0.62, 0.48, 0.32) * halo;

        vec2 cloudUV = vec2(atan(direction.x, -direction.z) * 4.2, direction.y * 33.0);
        float clouds = noise(cloudUV) * 0.66 + noise(cloudUV * 2.1 + 35.0) * 0.34;
        clouds = smoothstep(0.56, 0.82, clouds) * smoothstep(-0.02, 0.07, direction.y)
                 * (1.0 - smoothstep(0.28, 0.54, direction.y));
        sky = mix(sky, vec3(0.16, 0.18, 0.30) + halo * 0.3, clouds * 0.34);

        float disc = 1.0 - smoothstep(0.035, 0.037, moonDistance);
        float mare = 0.77 + noise(direction.xz * 111.0 + direction.y * 94.0) * 0.27;
        sky = mix(sky, vec3(1.34, 1.12, 0.79) * mare, disc);
        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(158, 32, 20), material);
  dome.name = 'Painted full-moon sky';
  dome.renderOrder = -100;
  scene.add(dome);

  const random = seededRandom(20261124);
  const stars: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let i = 0; i < 250; i += 1) {
    const azimuth = random() * Math.PI * 2;
    const y = 0.072 + random() * 0.72;
    const radius = Math.sqrt(1 - y * y);
    const direction = new THREE.Vector3(Math.cos(azimuth) * radius, y, Math.sin(azimuth) * radius);
    if (direction.distanceTo(MOON_DIRECTION) < 0.078) continue;
    stars.push(...direction.multiplyScalar(140).toArray());
    color.setHex(i % 3 === 0 ? 0xffe6bd : 0xbad6ff).multiplyScalar(0.45 + random() * 0.48);
    colors.push(color.r, color.g, color.b);
  }
  const constellation = new THREE.BufferGeometry();
  constellation.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
  constellation.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const starPoints = new THREE.Points(constellation, new THREE.PointsMaterial({
    vertexColors: true, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.62, depthWrite: false, fog: false,
  }));
  starPoints.renderOrder = -90;
  scene.add(starPoints);

  hills(scene, 109, 9.0, 0x505479, 0.1);
  hills(scene, 83, 6.3, 0x3e516e, 2.1);
  hills(scene, 65, 4.4, 0x314c61, 4.3);
}
