import * as THREE from 'three';
import { RIVER_BANK_Y } from '../../domain/worldMap';
import { MOON_DIRECTION, SKY_HORIZON } from './sky';
import { RIVER_DEPTH, RIVER_WIDTH, WATER_LEVEL, toWorldZ } from './space';
import type { RiverLight } from './scenery';

const WAVE_1 = new THREE.Vector2(0.53, 0.97);
const WAVE_2 = new THREE.Vector2(-1.42, 1.88);
const WAVE_3 = new THREE.Vector2(2.51, 0.84);

export function riverHeight(x: number, z: number, seconds: number): number {
  return WATER_LEVEL + 0.051 * Math.sin(x * WAVE_1.x + z * WAVE_1.y - 1.17 * seconds) +
    0.021 * Math.sin(x * WAVE_2.x + z * WAVE_2.y + 1.51 * seconds) +
    0.013 * Math.sin(x * WAVE_3.x + z * WAVE_3.y - 1.88 * seconds);
}

const WAVES = /* glsl */ `
  uniform float time;
  uniform vec2 wave1, wave2, wave3;
  vec3 wavePhase(vec2 p) {
    return vec3(dot(p, wave1) - time * 1.17, dot(p, wave2) + time * 1.51, dot(p, wave3) - time * 1.88);
  }
`;

export class FestivalRiver {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly posts: THREE.Vector4[];
  private readonly offerings: THREE.Vector4[];

  constructor(compact: boolean, lights: RiverLight[]) {
    this.posts = Array.from({ length: 8 }, (_, index) => {
      const light = lights[lights.length - 1 - index];
      return light ? new THREE.Vector4(light.x, light.z, light.strength, light.warmth) : new THREE.Vector4();
    });
    this.offerings = Array.from({ length: 8 }, () => new THREE.Vector4());
    const geometry = new THREE.PlaneGeometry(RIVER_WIDTH, RIVER_DEPTH, compact ? 72 : 112, compact ? 26 : 36);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, WATER_LEVEL, toWorldZ(RIVER_BANK_Y) - 0.28 + RIVER_DEPTH / 2);
    const material = new THREE.ShaderMaterial({
      fog: true,
      defines: { POST_COUNT: this.posts.length, OFFERING_COUNT: this.offerings.length },
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        time: { value: 0 },
        moon: { value: MOON_DIRECTION },
        horizon: { value: SKY_HORIZON },
        wave1: { value: WAVE_1 },
        wave2: { value: WAVE_2 },
        wave3: { value: WAVE_3 },
        bank: { value: toWorldZ(RIVER_BANK_Y) },
        posts: { value: this.posts },
        offerings: { value: this.offerings },
      },
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        ${WAVES}
        varying vec3 vWater;
        void main() {
          vec3 p = position;
          p.y += dot(sin(wavePhase(p.xz)), vec3(0.051, 0.021, 0.013));
          vWater = p;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        ${WAVES}
        uniform vec3 moon, horizon;
        uniform float bank;
        uniform vec4 posts[POST_COUNT];
        uniform vec4 offerings[OFFERING_COUNT];
        varying vec3 vWater;

        vec3 pigment(vec2 p) {
          float pulse = 0.5 + 0.5 * sin(p.x * 0.24 + cos(p.y * 0.26) * 1.62);
          float edge = bank + max(0.14, 0.8 + 0.64 * sin(p.x * 0.16) + 0.35 * sin(p.x * 0.43 + 1.0));
          float shallow = 1.0 - smoothstep(0.11, 4.3, p.y - edge);
          return mix(vec3(0.012, 0.039, 0.076), vec3(0.034, 0.108, 0.107), shallow * (0.63 + 0.27 * pulse));
        }

        float reflectionStreak(vec2 offset, vec2 ray, float wave, float spread) {
          vec2 side = vec2(-ray.y, ray.x);
          float width = dot(offset, side);
          float lengthwise = dot(offset, ray);
          float wobble = sin(lengthwise * 13.0 + wave * 2.5 - time * 1.26) * 0.20;
          float taper = exp(-abs(lengthwise + spread * 0.62) / (spread + 0.15));
          float streak = exp(-pow((width + wobble) / (0.27 + 0.24 * spread), 2.0));
          return streak * taper * (0.32 + 0.68 * pow(0.5 + 0.5 * cos(lengthwise * 16.0 + wave * 7.0), 4.0));
        }

        void main() {
          vec2 p = vWater.xz;
          vec3 phase = wavePhase(p);
          vec3 dc = cos(phase) * vec3(0.051, 0.021, 0.013);
          vec2 slope = dc.x * wave1 + dc.y * wave2 + dc.z * wave3;
          float crosscurrent = p.x * 4.8 + p.y * 8.7 + sin(p.y * 1.83) * 1.3 - 2.2 * time;
          slope += vec2(0.012, 0.033) * cos(crosscurrent);
          vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
          vec3 view = normalize(cameraPosition - vWater);
          vec3 mirrored = reflect(-view, normal);
          float fresnel = 0.08 + 0.83 * pow(1.0 - clamp(dot(normal, view), 0.0, 1.0), 3.5);
          vec3 sky = mix(horizon * 0.66, vec3(0.046, 0.075, 0.155), smoothstep(0.0, 0.68, mirrored.y));
          vec3 water = mix(pigment(p), sky, fresnel);

          float moonAlignment = max(0.0, dot(mirrored, moon));
          float lunarGlints = pow(moonAlignment, 72.0) * 0.36 + pow(moonAlignment, 245.0) * 0.70;
          water += vec3(0.69, 0.76, 0.99) * lunarGlints * (0.56 + 0.44 * cos(crosscurrent));
          float currentShade = 0.5 + 0.5 * sin(phase.x + 0.51 * sin(phase.y * 0.52) + 0.31 * cos(phase.z * 0.49));
          float crest = smoothstep(0.70, 0.94, currentShade) * (0.35 + 0.65 * fresnel);
          water += vec3(0.025, 0.047, 0.066) * crest;

          vec2 ray = normalize(p - cameraPosition.xz + vec2(0.001));
          for (int i = 0; i < POST_COUNT; i++) {
            vec4 light = posts[i];
            vec2 offset = p - light.xy;
            if (light.z > 0.0 && dot(offset, offset) < 64.0) {
              vec3 tint = mix(vec3(0.67, 0.30, 0.38), vec3(1.0, 0.53, 0.18), light.w);
              water += tint * light.z * reflectionStreak(offset, ray, phase.x, 1.58) * 0.42;
            }
          }
          for (int i = 0; i < OFFERING_COUNT; i++) {
            vec4 light = offerings[i];
            vec2 offset = p - light.xy;
            float squareRadius = dot(offset, offset);
            if (light.z > 0.0 && squareRadius < 8.0) {
              float radius = sqrt(squareRadius);
              float shell = pow(0.5 + 0.5 * cos(radius * 18.0 - time * 5.1), 8.0);
              float ripple = shell * smoothstep(0.26, 0.57, radius) * exp(-radius * 1.85);
              ripple *= 1.0 - smoothstep(1.6, 2.7, radius);
              water += vec3(0.35, 0.54, 0.58) * ripple * 0.24;
              vec3 tint = light.w < 0.0 ? vec3(0.48, 0.72, 1.0)
                        : mix(vec3(0.80, 0.45, 0.57), vec3(1.0, 0.62, 0.26), light.w);
              water += tint * light.z * reflectionStreak(offset, ray, phase.y, 0.66) * 0.64;
            }
          }
          gl_FragColor = vec4(water, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'Moonlit river with moving reflected light';
  }

  setLightingBudget(count: number): void {
    const { material } = this.mesh;
    if (material.defines.POST_COUNT === count) return;
    material.defines.POST_COUNT = count;
    material.defines.OFFERING_COUNT = count;
    material.uniforms.posts.value = this.posts.slice(0, count);
    material.uniforms.offerings.value = this.offerings.slice(0, count);
    material.needsUpdate = true;
  }

  update(time: number, lights: RiverLight[]): void {
    this.mesh.material.uniforms.time.value = time;
    const active: THREE.Vector4[] = this.mesh.material.uniforms.offerings.value;
    active.forEach((value, index) => {
      const light = lights[index];
      if (light) value.set(light.x, light.z, light.strength, light.warmth);
      else value.set(0, 0, 0, 0);
    });
  }
}
