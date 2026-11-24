import * as THREE from 'three';
import { riverBankZ, seededRandom, toWorldX, toWorldZ } from './space';

const GROUND_PIGMENTS = [0x194b47, 0x30633f, 0x527447, 0x2d5e58].map((hex) => new THREE.Color(hex));
const BANK_PIGMENTS = [0x416744, 0x607549, 0x5e5d44, 0x2d3738].map((hex) => new THREE.Color(hex));
const STONE_PIGMENTS = [0x82918b, 0x6f7e79, 0x9e9886, 0x829689, 0x777982, 0x938575].map((hex) => new THREE.Color(hex));

interface Surface {
  positions: number[];
  colors: number[];
  indices: number[];
}

function vertex(surface: Surface, x: number, y: number, z: number, color: THREE.Color): void {
  surface.positions.push(x, y, z);
  surface.colors.push(color.r, color.g, color.b);
}

function mesh(surface: Surface, material: THREE.MeshStandardMaterial): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(surface.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(surface.colors, 3));
  geometry.setIndex(surface.indices);
  geometry.computeVertexNormals();
  const result = new THREE.Mesh(geometry, material);
  result.receiveShadow = true;
  return result;
}

function pigment(x: number, z: number): THREE.Color {
  const patches = 0.5 + 0.28 * Math.sin(x * 0.53 + Math.cos(z * 0.35)) + 0.22 * Math.sin(z * 0.42 - x * 0.12);
  const moss = 0.5 + 0.5 * Math.cos(z * 0.29 + x * 0.16);
  return GROUND_PIGMENTS[0].clone().lerp(GROUND_PIGMENTS[1], patches)
    .lerp(GROUND_PIGMENTS[2], moss * patches * 0.64)
    .lerp(GROUND_PIGMENTS[3], (1 - moss) * 0.3);
}

function buildBank(): Surface {
  const surface: Surface = { positions: [], colors: [], indices: [] };
  const columns = 104;
  const inlandRows = 30;
  const bankProfile = [
    { z: -0.56, y: -0.015 },
    { z: -0.06, y: -0.07 },
    { z: 0.24, y: -0.22 },
    { z: 0.62, y: -0.57 },
  ];
  for (let row = 0; row <= inlandRows + bankProfile.length; row += 1) {
    for (let col = 0; col <= columns; col += 1) {
      const x = -63 + (126 * col) / columns;
      const edge = riverBankZ(x);
      const bank = bankProfile[row - inlandRows - 1];
      const z = bank ? edge + bank.z : THREE.MathUtils.lerp(-48, edge - 0.92, row / inlandRows);
      const y = bank ? bank.y : 0.014 + Math.sin(x * 0.27 + 2 * Math.cos(z * 0.6)) * 0.012;
      const color = bank ? BANK_PIGMENTS[row - inlandRows - 1] : pigment(x, z);
      vertex(surface, x, y, z, color);
      if (row && col) {
        const i = row * (columns + 1) + col;
        const upper = i - columns - 1;
        surface.indices.push(upper - 1, i - 1, upper, upper, i - 1, i);
      }
    }
  }
  return surface;
}

interface Path {
  width: number;
  points: readonly [number, number][];
}

const PATHS: Path[] = [
  { width: 3.35, points: [[72, 651], [235, 656], [398, 626], [567, 608], [722, 588], [874, 637], [940, 671], [1110, 650], [1384, 626]] },
  { width: 2.65, points: [[165, 519], [242, 516], [334, 543], [490, 554], [624, 589], [708, 580]] },
  { width: 3.0, points: [[725, 590], [776, 512], [785, 461], [850, 404], [884, 339], [960, 297], [1088, 296], [1230, 280], [1380, 254]] },
  { width: 2.6, points: [[880, 344], [775, 313], [682, 245], [551, 228], [492, 187], [380, 203], [258, 217], [111, 203]] },
  { width: 2.25, points: [[283, 528], [323, 452], [284, 349], [250, 276], [258, 218]] },
];

function paver(surface: Surface, corners: THREE.Vector2[], color: THREE.Color, height: number): void {
  const start = surface.positions.length / 3;
  const center = corners.reduce((point, corner) => point.add(corner), new THREE.Vector2()).multiplyScalar(0.25);
  const bevel = corners.flatMap((corner, index) => [
    corner.clone().lerp(corners[(index + 3) % 4], 0.14),
    corner.clone().lerp(corners[(index + 1) % 4], 0.14),
  ]);
  const edgeColor = color.clone().multiplyScalar(0.60);
  for (const point of bevel) vertex(surface, point.x, 0.024, point.y, edgeColor);
  for (const point of bevel) {
    const top = point.clone().lerp(center, 0.07);
    const tone = color.clone().multiplyScalar(0.91 + 0.12 * Math.cos(point.x * 1.9 + point.y * 1.3));
    vertex(surface, top.x, height, top.y, tone);
  }
  for (let index = 0; index < 8; index += 1) {
    const side = start + index;
    const next = start + (index + 1) % 8;
    surface.indices.push(side, side + 8, next, next, side + 8, next + 8);
  }
  for (let index = 1; index < 7; index += 1) {
    surface.indices.push(start + 8, start + 8 + index + 1, start + 8 + index);
  }
}

function buildPavers(): Surface {
  const surface: Surface = { positions: [], colors: [], indices: [] };
  const random = seededRandom(948212);
  for (const path of PATHS) {
    const curve = new THREE.CatmullRomCurve3(path.points.map(([x, z]) => new THREE.Vector3(toWorldX(x), 0, toWorldZ(z))));
    const count = Math.ceil(curve.getLength() / 0.83);
    for (let index = 0; index < count; index += 1) {
      const start = (index + 0.025) / count;
      const end = (index + 0.975) / count;
      const bands = index % 3 === 0 ? [-0.5, -0.23, 0.20, 0.5] : [-0.5, -0.12, 0.24, 0.5];
      const cornersAt = (t: number, offset: number) => {
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        const width = path.width * (0.91 + 0.10 * Math.cos(t * 26.0) + 0.06 * Math.sin(t * 41));
        return new THREE.Vector2(point.x - tangent.z * offset * width, point.z + tangent.x * offset * width);
      };
      for (let band = 0; band < 3; band += 1) {
        const left = bands[band] + 0.013 + random() * 0.018;
        const right = bands[band + 1] - 0.013 - random() * 0.018;
        const color = STONE_PIGMENTS[Math.floor(random() * STONE_PIGMENTS.length)];
        paver(surface, [cornersAt(start, left), cornersAt(end, left), cornersAt(end, right), cornersAt(start, right)], color, 0.07 + random() * 0.027);
      }
    }
  }
  return surface;
}

function weatheredSurface(material: THREE.MeshStandardMaterial, stone: boolean): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFestivalSurface;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFestivalSurface = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */ `
        #include <common>
        varying vec2 vFestivalSurface;
        float surfaceHash(vec2 x) {
          vec3 p = fract(vec3(x.xyx) * 0.1031);
          p += dot(p, p.yzx + 31.32);
          return fract((p.x + p.y) * p.z);
        }
        float surfaceNoise(vec2 p) {
          vec2 cell = floor(p), f = fract(p);
          vec2 k = f * f * (3.0 - 2.0 * f);
          return mix(mix(surfaceHash(cell), surfaceHash(cell + vec2(1, 0)), k.x),
                     mix(surfaceHash(cell + vec2(0, 1)), surfaceHash(cell + vec2(1, 1)), k.x), k.y);
        }
      `)
      .replace('#include <color_fragment>', /* glsl */ `
        #include <color_fragment>
        float mottling = surfaceNoise(vFestivalSurface * ${stone ? '3.8' : '0.73'});
        float grains = surfaceNoise(vFestivalSurface * ${stone ? '23.0' : '11.0'});
        float specks = surfaceHash(floor(vFestivalSurface * ${stone ? '52.0' : '36.0'}));
        float flecks = smoothstep(0.80, 0.96, specks);
        float age = ${stone ? '0.86 + mottling * 0.19' : '0.77 + mottling * 0.35'};
        diffuseColor.rgb *= age + (grains - 0.5) * 0.17 + flecks * 0.08;
        diffuseColor.rgb *= mix(vec3(0.89, 1.0, 0.95), vec3(1.05, 0.98, 0.86), mottling);
      `);
  };
  material.customProgramCacheKey = () => stone ? 'weathered limestone' : 'woodland earth';
}

export function addFestivalLandscape(scene: THREE.Scene): void {
  const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 });
  const pathMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
  weatheredSurface(terrainMaterial, false);
  weatheredSurface(pathMaterial, true);
  const terrain = mesh(buildBank(), terrainMaterial);
  terrain.name = 'Meandering river terrace';
  const paths = mesh(buildPavers(), pathMaterial);
  paths.name = 'Hand-cut limestone lanes';
  scene.add(terrain, paths);
}
