// The sailing area's map (the Tagus estuary, the Bassin d'Arcachon or the Ria de Aveiro): land
// drawn from the OpenStreetMap mask, town names and real buoys. Each area's files are only
// downloaded when it is the one open.
import {
  Color3,
  DynamicTexture,
  Effect,
  Mesh,
  MeshBuilder,
  Scene,
  ShaderMaterial,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector2,
  Vector3,
  VertexBuffer,
  type Camera,
} from '@babylonjs/core';
import tagusMask from '../assets/map/tagus-mask.png?url';
import tagusHeight from '../assets/map/tagus-height.png?url';
import tagusJson from '../assets/map/tagus.json';
import arcachonMask from '../assets/map/arcachon-mask.png?url';
import arcachonHeight from '../assets/map/arcachon-height.png?url';
import arcachonJson from '../assets/map/arcachon.json';
import aveiroMask from '../assets/map/aveiro-mask.png?url';
import aveiroHeight from '../assets/map/aveiro-height.png?url';
import aveiroJson from '../assets/map/aveiro.json';
import pasaiaMask from '../assets/map/pasaia-mask.png?url';
import pasaiaHeight from '../assets/map/pasaia-height.png?url';
import pasaiaJson from '../assets/map/pasaia.json';
import azoresMask from '../assets/map/azores-mask.png?url';
import azoresHeight from '../assets/map/azores-height.png?url';
import azoresJson from '../assets/map/azores.json';
import madeiraMask from '../assets/map/madeira-mask.png?url';
import madeiraHeight from '../assets/map/madeira-height.png?url';
import madeiraJson from '../assets/map/madeira.json';
import { getArea, type AreaId } from '../world/area';
import { LandMask, type MapMeta } from '../world/landMask';
import { Terrain, type HeightsMeta } from '../world/terrain';
import { createLandmarks, type BridgeLine } from './landmarks';
import { createArcachonLandmarks } from './landmarksArcachon';
import { createBuoy, seaMarkStyle } from './buoys';
import { addExtraPlaces } from '../world/destinations';
import { waveHeight } from './waves';

export interface SeaMark {
  type: string;
  category: string;
  colour: string;
  name: string;
  x: number;
  y: number;
}

export type TagusMeta = MapMeta & { seamarks?: SeaMark[]; source: string; heights?: HeightsMeta & { source: string }; bridges?: Record<string, BridgeLine> };
const FILES: Record<AreaId, { meta: unknown; mask: string; height: string }> = {
  tejo: { meta: tagusJson, mask: tagusMask, height: tagusHeight },
  arcachon: { meta: arcachonJson, mask: arcachonMask, height: arcachonHeight },
  aveiro: { meta: aveiroJson, mask: aveiroMask, height: aveiroHeight },
  pasaia: { meta: pasaiaJson, mask: pasaiaMask, height: pasaiaHeight },
  azores: { meta: azoresJson, mask: azoresMask, height: azoresHeight },
  madeira: { meta: madeiraJson, mask: madeiraMask, height: madeiraHeight },
};
const AREA = getArea();
const maskUrl = FILES[AREA.id].mask;
const heightUrl = FILES[AREA.id].height;
/** The open area's map: grid, places, sea marks, heights. */
export const MAP_META = FILES[AREA.id].meta as TagusMeta;
addExtraPlaces(MAP_META, AREA.extraPlaces);

/** Pixels of an image (RGBA). */
async function imagePixels(url: string): Promise<{ image: HTMLImageElement; rgba: Uint8ClampedArray }> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  return { image, rgba: ctx.getImageData(0, 0, image.width, image.height).data };
}

/** Download and decode the mask (the red channel is the water map) and the land heights. */
export async function loadMapMask(): Promise<{ mask: LandMask; image: HTMLImageElement; terrain?: Terrain }> {
  const heights = MAP_META.heights;
  const [{ image, rgba }, h] = await Promise.all([imagePixels(maskUrl), heights ? imagePixels(heightUrl) : Promise.resolve(null)]);
  const water = new Uint8Array(image.width * image.height);
  for (let i = 0; i < water.length; i++) water[i] = rgba[i * 4];
  const terrain = heights && h ? Terrain.fromRGBA(heights, MAP_META.northWest, h.rgba) : undefined;
  return { mask: new LandMask(MAP_META, water), image, terrain };
}

Effect.ShadersStore.landVertexShader = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 world;
uniform mat4 viewProjection;
uniform sampler2D mask;
uniform vec2 northWest;
uniform vec2 size;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUV;
void main() {
  vec4 wp = world * vec4(position, 1.0);
  vUV = vec2((wp.x - northWest.x) / size.x, 1.0 - (northWest.y - wp.z) / size.y);
  vec4 m = texture2D(mask, vUV);
  float inland = 1.0 - m.g;
  // A low bank along the shore; inland, the real ground height (position.y) takes over.
  float bank = 0.6 + 2.5 * smoothstep(0.0, 1.0, inland);
  float h = max(bank, position.y * smoothstep(0.0, 0.06, inland));
  // Off the shore the ground slopes down under the water, so cliffs stand in the water and
  // flat shores shelve gently, instead of the land being cut off in mid-air.
  float onLand = 1.0 - smoothstep(0.3, 0.7, m.r);
  wp.y = mix(-3.0, h, onLand);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(world) * normal);
  gl_Position = viewProjection * wp;
}
`;

Effect.ShadersStore.landFragmentShader = /* glsl */ `
precision highp float;
uniform sampler2D mask;
uniform vec3 cameraPosition;
uniform vec3 skyColor;
uniform vec3 sunDirection;
uniform float fogDensity;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUV;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.1 + vec2(3.1, 7.7); a *= 0.5; }
  return v;
}

void main() {
  vec4 m = texture2D(mask, vUV);
  // Ground under the water is drawn by the water itself (the coastline keeps the detail of
  // the 20 m water map on flat shores; cliffs keep their face down to the water).
  if (m.r > 0.5 && vWorld.y < 0.15) discard;
  float inland = 1.0 - m.g;
  vec3 n = normalize(vNormal);
  float slope = 1.0 - n.y;
  vec2 p = vWorld.xz;
  // The Lisbon countryside in late summer: dry golden grass, patches of green fields and
  // olive scrub, darker pine woods on the hills, bare rock on steep slopes and sand at the
  // shore. Large patches (about 1 km) mixed with smaller ones (fields of 100-200 m).
  float big = fbm(p * 0.0011);
  float small = fbm(p * 0.006 + 11.0);
  vec3 dryGrass = vec3(0.62, 0.56, 0.38);
  vec3 greenField = vec3(0.40, 0.46, 0.27);
  vec3 scrub = vec3(0.37, 0.39, 0.26);
  vec3 soil = vec3(0.56, 0.46, 0.34);
  vec3 pine = vec3(0.20, 0.27, 0.16);
  vec3 rock = vec3(0.60, 0.57, 0.50);
  vec3 sand = vec3(0.80, 0.75, 0.60);
  vec3 color = mix(dryGrass, greenField, smoothstep(0.45, 0.62, big));
  color = mix(color, soil, smoothstep(0.62, 0.72, small) * 0.7);
  color = mix(color, scrub, smoothstep(0.5, 0.7, small) * smoothstep(0.35, 0.55, big) * 0.6);
  // Woods: more of them on higher ground.
  float wood = smoothstep(0.55, 0.7, big + 0.25 * smoothstep(30.0, 150.0, vWorld.y) + 0.15 * (small - 0.5));
  color = mix(color, pine, wood * 0.85);
  // Steep ground (cliffs, valley sides) shows bare rock.
  color = mix(color, rock, smoothstep(0.25, 0.5, slope));
  // A narrow strip of sand along low shores only (not on quays, cliffs or high ground).
  float beach = (1.0 - smoothstep(0.02, 0.1, inland)) * (1.0 - smoothstep(2.0, 4.0, vWorld.y)) * (1.0 - smoothstep(0.15, 0.3, slope));
  color = mix(color, sand, beach);
  // Ground under the water line (seen through the shallows) darkens like wet sand and mud.
  color *= mix(0.55, 1.0, smoothstep(-1.5, 0.3, vWorld.y));
  // Slopes facing the sun are lit, the others in shade: this is what shows the relief.
  float light = max(dot(n, normalize(sunDirection)), 0.0);
  color *= 0.6 + 0.65 * light;
  float dist = length(cameraPosition - vWorld);
  float fog = 1.0 - exp(-pow(dist * fogDensity, 2.0));
  gl_FragColor = vec4(mix(color, skyColor, fog), 1.0);
}
`;

export interface MapView {
  /** Call every frame (bobs the buoys, keeps labels readable). */
  update(time: number, camera: Camera): void;
  /** Show a marker post at a destination (or none). */
  setTarget(p: { x: number; y: number } | null): void;
}

export function createMapView(scene: Scene, mask: LandMask, skyColor: Color3, sunDirection: Vector3, fogDensity: number, labelNames?: string[], terrain?: Terrain): MapView {
  const { width, height } = mask.sizeMetres;

  // --- Land, in tiles at the real ground heights: every tile with land has a coarse version
  // (250 m between vertices); tiles near the camera also get a detailed one (50 m). The
  // shader cuts out the water and keeps a low bank along the shore.
  const tex = new Texture(maskUrl, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
  tex.wrapU = tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  const mat = new ShaderMaterial('landMat', scene, { vertex: 'land', fragment: 'land' }, {
    attributes: ['position', 'normal'],
    uniforms: ['world', 'viewProjection', 'northWest', 'size', 'cameraPosition', 'skyColor', 'sunDirection', 'fogDensity'],
    samplers: ['mask'],
  });
  mat.setTexture('mask', tex);
  mat.setVector2('northWest', new Vector2(mask.meta.northWest.x, mask.meta.northWest.y));
  mat.setVector2('size', new Vector2(width, height));
  mat.setColor3('skyColor', skyColor);
  mat.setVector3('sunDirection', sunDirection);
  mat.setFloat('fogDensity', fogDensity);
  mat.backFaceCulling = false;

  const TILE = 4000; // m
  const NEAR = 6000; // m: detailed tiles within this distance of the camera
  const makeTile = (cx: number, cz: number, subdivisions: number): Mesh => {
    const t = MeshBuilder.CreateGround('land', { width: TILE, height: TILE, subdivisions, updatable: true }, scene);
    t.position.set(cx, 0, cz);
    if (terrain) {
      const pos = t.getVerticesData(VertexBuffer.PositionKind)!;
      for (let i = 0; i < pos.length; i += 3) pos[i + 1] = Math.max(0, terrain.heightAt(cx + pos[i], cz + pos[i + 2]));
      t.updateVerticesData(VertexBuffer.PositionKind, pos);
      t.createNormals(false);
      t.refreshBoundingInfo();
    }
    t.material = mat;
    t.isPickable = false;
    return t;
  };
  const tiles: { cx: number; cz: number; low: Mesh; high?: Mesh }[] = [];
  const nw = mask.meta.northWest;
  for (let z = nw.y - height; z < nw.y; z += TILE) {
    for (let x = nw.x; x < nw.x + width; x += TILE) {
      // Only tiles with some land in them.
      let land = false;
      for (let a = 0; a <= TILE && !land; a += 100) for (let b = 0; b <= TILE && !land; b += 100) land = !mask.isWater(x + a, z + b);
      if (!land) continue;
      tiles.push({ cx: x + TILE / 2, cz: z + TILE / 2, low: makeTile(x + TILE / 2, z + TILE / 2, 16) });
    }
  }
  const updateTiles = (camera: Camera) => {
    const p = camera.globalPosition;
    for (const t of tiles) {
      const d = Math.max(0, Math.hypot(p.x - t.cx, p.z - t.cz) - TILE * 0.7);
      if (d < NEAR && !t.high) t.high = makeTile(t.cx, t.cz, 80);
      else if (d > NEAR + 1500 && t.high) {
        t.high.dispose();
        t.high = undefined;
      }
      t.low.setEnabled(!t.high);
    }
  };

  // --- Town names, always facing the camera.
  const labels: Mesh[] = [];
  for (const p of mask.meta.places) {
    // Only the chosen places (or cities and towns); villages would crowd the horizon.
    if (labelNames ? !labelNames.includes(p.name) : p.kind !== 'city' && p.kind !== 'town') continue;
    const big = p.kind === 'city';
    const label = makeLabel(scene, p.name, big);
    label.position.set(p.x, (terrain ? Math.max(0, terrain.heightAt(p.x, p.y)) : 0) + 30, p.y);
    labels.push(label);
  }

  // --- Landmarks: the Tagus bridges, towers and lighthouses; Arcachon's lighthouse, piers
  // and huts on stilts.
  const landmarks =
    AREA.id === 'tejo' ? createLandmarks(scene, mask, terrain, mask.meta.origin, MAP_META.bridges) : AREA.id === 'arcachon' ? createArcachonLandmarks(scene, mask, terrain, mask.meta.origin) : [];
  for (const l of landmarks) {
    const label = makeLabel(scene, l.name, false);
    label.position.set(l.x, l.height, l.y);
    labels.push(label);
  }

  // --- Sea marks from OpenStreetMap / OpenSeaMap.
  const buoys = createSeaMarks(scene, MAP_META.seamarks ?? []);

  // Where to go: a small arrow pointing down at the spot, bobbing gently and turning, with a
  // ring on the water. It keeps about the same size on screen whatever the distance.
  const marker = new TransformNode('destination', scene);
  const markMat = new StandardMaterial('destinationMat', scene);
  markMat.diffuseColor = new Color3(0.95, 0.6, 0.15);
  markMat.emissiveColor = new Color3(0.75, 0.4, 0.08);
  markMat.specularColor = Color3.Black();
  markMat.fogEnabled = false;
  const arrow = new TransformNode('destinationArrow', scene);
  arrow.parent = marker;
  const head = MeshBuilder.CreateCylinder('destinationHead', { height: 3, diameterTop: 3.2, diameterBottom: 0, tessellation: 4 }, scene);
  head.position.y = 1.5;
  const shaft = MeshBuilder.CreateBox('destinationShaft', { width: 1, height: 3, depth: 1 }, scene);
  shaft.position.y = 4.5;
  const ring = MeshBuilder.CreateTorus('destinationRing', { diameter: 7, thickness: 0.35, tessellation: 32 }, scene);
  ring.position.y = 0.3;
  for (const m of [head, shaft]) m.parent = arrow;
  ring.parent = marker;
  for (const m of [head, shaft, ring]) {
    m.material = markMat;
    m.isPickable = false;
  }
  marker.setEnabled(false);

  return {
    setTarget(p) {
      marker.setEnabled(!!p);
      if (p) marker.position.set(p.x, 0, p.y);
    },
    update(time, camera) {
      updateTiles(camera);
      if (marker.isEnabled()) {
        const d = Vector3.Distance(camera.globalPosition, marker.position);
        const k = Math.max(1, d / 110);
        arrow.scaling.setAll(k);
        ring.scaling.setAll(Math.min(k, 6));
        arrow.position.y = k * (5 + 1.5 * Math.sin(time * 2.5));
        arrow.rotation.y = time * 1.2;
        marker.position.y = waveHeight(marker.position.x, marker.position.z, time);
      }
      for (const b of buoys) if (b.metadata?.floats) b.position.y = waveHeight(b.position.x, b.position.z, time);
      // Keep labels a readable size on screen, whatever the distance.
      for (const l of labels) {
        const d = Vector3.Distance(camera.globalPosition, l.position);
        l.scaling.setAll(Math.max(0.1, Math.min(4, d / 4000)));
      }
    },
  };
}

function makeLabel(scene: Scene, text: string, big: boolean): Mesh {
  const fontPx = 64;
  const w = Math.max(256, Math.ceil(text.length * fontPx * 0.62) + 48);
  const dt = new DynamicTexture(`label-${text}`, { width: w, height: 96 }, scene, true);
  dt.hasAlpha = true;
  const ctx = dt.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, w, 96);
  ctx.font = `${fontPx}px 'IM Fell English', Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(20, 35, 45, 0.85)';
  ctx.strokeText(text, w / 2, 50);
  ctx.fillStyle = big ? '#fff6e0' : '#e8eef0';
  ctx.fillText(text, w / 2, 50);
  dt.update();
  const metresHigh = big ? 60 : 42;
  const plane = MeshBuilder.CreatePlane(`label-${text}`, { width: (metresHigh * w) / 96, height: metresHigh }, scene);
  const m = new StandardMaterial(`label-${text}`, scene);
  m.diffuseTexture = dt;
  m.emissiveColor = Color3.White();
  m.disableLighting = true;
  m.useAlphaFromDiffuseTexture = true;
  m.backFaceCulling = false;
  m.fogEnabled = false;
  plane.material = m;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  plane.renderingGroupId = 1;
  return plane;
}


function createSeaMarks(scene: Scene, marks: SeaMark[]): TransformNode[] {
  const nodes: TransformNode[] = [];
  for (const s of marks) {
    const node = new TransformNode(`seamark-${s.name || s.type}`, scene);
    node.position.set(s.x, 0, s.y);
    const beacon = s.type.startsWith('beacon') || s.type.startsWith('light');
    node.metadata = { floats: !beacon };
    const buoy = createBuoy(scene, `seamark-${nodes.length}`, seaMarkStyle(s.type, s.colour, s.category));
    // Beacons stand on the bottom, their float hidden under water and the tower raised.
    if (beacon) buoy.position.y = 1.5;
    buoy.parent = node;
    nodes.push(node);
  }
  return nodes;
}
