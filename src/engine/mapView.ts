// The Tagus estuary: land drawn from the OpenStreetMap mask, town names and real buoys.
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
  type Camera,
} from '@babylonjs/core';
import maskUrl from '../assets/map/tagus-mask.png?url';
import metaJson from '../assets/map/tagus.json';
import { LandMask, type MapMeta } from '../world/landMask';
import { waveHeight } from './waves';

export interface SeaMark {
  type: string;
  category: string;
  colour: string;
  name: string;
  x: number;
  y: number;
}

export type TagusMeta = MapMeta & { seamarks?: SeaMark[]; source: string };
export const TAGUS_META = metaJson as TagusMeta;

/** Download and decode the mask (the red channel is the water map). */
export async function loadTagusMask(): Promise<{ mask: LandMask; image: HTMLImageElement }> {
  const image = new Image();
  image.src = maskUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const rgba = ctx.getImageData(0, 0, image.width, image.height).data;
  const water = new Uint8Array(image.width * image.height);
  for (let i = 0; i < water.length; i++) water[i] = rgba[i * 4];
  return { mask: new LandMask(TAGUS_META, water), image };
}

Effect.ShadersStore.landVertexShader = /* glsl */ `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 viewProjection;
uniform sampler2D mask;
uniform vec2 northWest;
uniform vec2 size;
varying vec3 vWorld;
varying vec2 vUV;
void main() {
  vec4 wp = world * vec4(position, 1.0);
  vUV = vec2((wp.x - northWest.x) / size.x, 1.0 - (northWest.y - wp.z) / size.y);
  float inland = 1.0 - texture2D(mask, vUV).g;
  wp.y = 0.7 + 3.0 * smoothstep(0.0, 1.0, inland);
  vWorld = wp.xyz;
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
varying vec2 vUV;
void main() {
  vec4 m = texture2D(mask, vUV);
  if (m.r > 0.5) discard;                       // water
  float inland = 1.0 - m.g;
  float noise = 0.5 + 0.25 * sin(vWorld.x * 0.013 + sin(vWorld.z * 0.011) * 3.0) + 0.25 * sin(vWorld.z * 0.031 - vWorld.x * 0.017);
  vec3 sand = vec3(0.78, 0.72, 0.56);
  vec3 field = mix(vec3(0.45, 0.52, 0.33), vec3(0.62, 0.6, 0.45), noise);
  vec3 color = mix(sand, field, smoothstep(0.08, 0.4, inland));
  color *= 0.85 + 0.25 * max(dot(normalize(vec3(0.0, 1.0, 0.0)), normalize(sunDirection)), 0.0);
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

export function createMapView(scene: Scene, mask: LandMask, skyColor: Color3, sunDirection: Vector3, fogDensity: number, labelNames?: string[]): MapView {
  const { width, height } = mask.sizeMetres;
  const c = mask.centre;

  // --- Land: one big sheet; the shader cuts out the water and raises the land inland.
  const land = MeshBuilder.CreateGround('land', { width, height, subdivisionsX: 360, subdivisionsY: Math.round((360 * height) / width) }, scene);
  land.position.set(c.x, 0, c.y);
  const tex = new Texture(maskUrl, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
  tex.wrapU = tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  const mat = new ShaderMaterial('landMat', scene, { vertex: 'land', fragment: 'land' }, {
    attributes: ['position'],
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
  land.material = mat;
  land.isPickable = false;
  land.alwaysSelectAsActiveMesh = true;

  // --- Town names, always facing the camera.
  const labels: Mesh[] = [];
  for (const p of mask.meta.places) {
    // Only the chosen places (or cities and towns); villages would crowd the horizon.
    if (labelNames ? !labelNames.includes(p.name) : p.kind !== 'city' && p.kind !== 'town') continue;
    const big = p.kind === 'city';
    const label = makeLabel(scene, p.name, big);
    label.position.set(p.x, 30, p.y);
    labels.push(label);
  }

  // --- Sea marks from OpenStreetMap / OpenSeaMap.
  const buoys = createSeaMarks(scene, TAGUS_META.seamarks ?? []);

  // Destination marker: a tall post with a flag, visible from far away.
  const marker = new TransformNode('destination', scene);
  const markMat = new StandardMaterial('destinationMat', scene);
  markMat.diffuseColor = new Color3(0.9, 0.55, 0.15);
  markMat.emissiveColor = new Color3(0.6, 0.3, 0.05);
  markMat.fogEnabled = false;
  const post = MeshBuilder.CreateCylinder('destinationPost', { height: 30, diameter: 0.8, tessellation: 8 }, scene);
  post.position.y = 15;
  const flag = MeshBuilder.CreatePlane('destinationFlag', { width: 8, height: 5, sideOrientation: Mesh.DOUBLESIDE }, scene);
  flag.position.set(4, 27, 0);
  for (const m of [post, flag]) {
    m.material = markMat;
    m.parent = marker;
    m.isPickable = false;
  }
  marker.setEnabled(false);

  return {
    setTarget(p) {
      marker.setEnabled(!!p);
      if (p) marker.position.set(p.x, 0, p.y);
    },
    update(time, camera) {
      if (marker.isEnabled()) {
        const d = Vector3.Distance(camera.globalPosition, marker.position);
        marker.scaling.setAll(Math.max(1, d / 400));
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
  ctx.font = `${big ? 'bold ' : ''}${fontPx}px system-ui, sans-serif`;
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

const COLOURS: Record<string, Color3> = {
  red: new Color3(0.85, 0.12, 0.1),
  green: new Color3(0.1, 0.6, 0.25),
  yellow: new Color3(0.95, 0.8, 0.1),
  black: new Color3(0.1, 0.1, 0.1),
  white: new Color3(0.95, 0.95, 0.95),
};

function createSeaMarks(scene: Scene, marks: SeaMark[]): TransformNode[] {
  const mats = new Map<string, StandardMaterial>();
  const material = (colour: string) => {
    const key = colour.split(';')[0] || 'yellow';
    if (!mats.has(key)) {
      const m = new StandardMaterial(`seamark-${key}`, scene);
      m.diffuseColor = COLOURS[key] ?? COLOURS.yellow;
      m.emissiveColor = (COLOURS[key] ?? COLOURS.yellow).scale(0.25);
      mats.set(key, m);
    }
    return mats.get(key)!;
  };
  const nodes: TransformNode[] = [];
  for (const s of marks) {
    const node = new TransformNode(`seamark-${s.name || s.type}`, scene);
    node.position.set(s.x, 0, s.y);
    const beacon = s.type.startsWith('beacon') || s.type.startsWith('light');
    node.metadata = { floats: !beacon };
    const body = MeshBuilder.CreateCylinder('mark', { height: beacon ? 5 : 2.2, diameterTop: beacon ? 0.4 : 0.35, diameterBottom: beacon ? 0.6 : 1.4, tessellation: 12 }, scene);
    body.position.y = beacon ? 2.5 : 0.9;
    body.material = material(s.colour);
    body.parent = node;
    body.isPickable = false;
    // Lateral marks: red cans are cylinders, green ones end in a cone.
    if (s.colour.startsWith('green') || s.category.includes('starboard')) {
      const top = MeshBuilder.CreateCylinder('markTop', { height: 0.9, diameterTop: 0, diameterBottom: 0.6, tessellation: 12 }, scene);
      top.position.y = (beacon ? 5 : 2.2) + 0.4;
      top.material = body.material;
      top.parent = node;
      top.isPickable = false;
    }
    nodes.push(node);
  }
  return nodes;
}
