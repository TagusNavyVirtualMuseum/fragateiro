import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Effect,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
} from '@babylonjs/core';
import { createWater, type Water } from './water';

export interface SailingScene {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  water: Water;
  sunDirection: Vector3;
  skyColor: Color3;
  fogDensity: number;
  sky: Sky;
}

const HORIZON = new Color3(0.78, 0.85, 0.9);
const ZENITH = new Color3(0.35, 0.55, 0.8);
// Light haze: the far shore (a few km away) stays visible.
const FOG_DENSITY = 0.00012;

Effect.ShadersStore.skyVertexShader = /* glsl */ `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main() { vDir = position; gl_Position = worldViewProjection * vec4(position, 1.0); }
`;
Effect.ShadersStore.skyFragmentShader = /* glsl */ `
precision highp float;
uniform vec3 horizon;
uniform vec3 zenith;
uniform vec3 sunDirection;
// How far the clouds have drifted (m on the cloud layer), and how much of the sky they cover.
uniform vec2 cloudOffset;
uniform float cloudCover;
varying vec3 vDir;

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
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  vec3 sun = normalize(sunDirection);
  float up = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(horizon, zenith, pow(up, 0.6));
  float s = max(dot(d, sun), 0.0);
  // Soft glow around the sun, brighter near the horizon haze.
  c += vec3(1.0, 0.85, 0.6) * (pow(s, 8.0) * 0.12 + pow(s, 96.0) * 0.25);

  // Clouds: a flat layer seen from below, so they bunch up towards the horizon.
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.06) * 0.9 + cloudOffset;
    float n = fbm(uv * 0.35);
    float density = smoothstep(1.0 - cloudCover, 1.0 - cloudCover + 0.2, n);
    // Fade into the haze near the horizon.
    density *= smoothstep(0.0, 0.08, d.y);
    // Lit from the sun's side, greyer underneath where they are thick.
    float shade = 0.9 + 0.15 * pow(s, 4.0) - 0.12 * smoothstep(0.5, 1.0, density);
    vec3 cloud = vec3(1.0, 0.98, 0.95) * shade;
    c = mix(c, cloud, density * 0.95);
  }

  // The sun's disc, dimmed when a cloud passes in front.
  float disc = smoothstep(0.99955, 0.99975, s);
  c += vec3(1.0, 0.95, 0.8) * disc * 3.0;
  gl_FragColor = vec4(c, 1.0);
}
`;

/** The sky's moving parts. */
export interface Sky {
  /** Call every frame: clouds drift downwind (wind speed in m/s, from = radians). */
  update(dt: number, windFrom: number, windSpeed: number): void;
}

export function createSailingScene(canvas: HTMLCanvasElement): SailingScene {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, antialias: true });
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene(engine);
  scene.clearColor = new Color4(HORIZON.r, HORIZON.g, HORIZON.b, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = FOG_DENSITY;
  scene.fogColor = HORIZON;
  scene.ambientColor = new Color3(0.3, 0.3, 0.3);

  // Afternoon sun, low enough (about 18°) for its disc to show above the horizon.
  const sunDirection = new Vector3(-0.4, 0.24, -0.6).normalize();
  const sun = new DirectionalLight('sun', sunDirection.scale(-1), scene);
  sun.intensity = 2.2;
  const skyLight = new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
  skyLight.intensity = 0.9;
  skyLight.groundColor = new Color3(0.25, 0.3, 0.32);

  const dome = MeshBuilder.CreateSphere('skyDome', { diameter: 30000, segments: 16, sideOrientation: 1 }, scene);
  const skyMat = new ShaderMaterial('skyMat', scene, { vertex: 'sky', fragment: 'sky' }, {
    attributes: ['position'],
    uniforms: ['worldViewProjection', 'horizon', 'zenith', 'sunDirection', 'cloudOffset', 'cloudCover'],
  });
  skyMat.setColor3('horizon', HORIZON);
  skyMat.setColor3('zenith', ZENITH);
  skyMat.setVector3('sunDirection', sunDirection);
  skyMat.setFloat('cloudCover', 0.5);
  const cloudOffset = new Vector2(0, 0);
  skyMat.setVector2('cloudOffset', cloudOffset);
  const sky: Sky = {
    update(dt, windFrom, windSpeed) {
      // Clouds move with the wind aloft, a little faster than at the surface; the layer is
      // in units of about 1 km, so this is a slow drift.
      const k = (windSpeed * 1.5 * dt) / 1000;
      cloudOffset.x -= Math.sin(windFrom) * k;
      cloudOffset.y -= Math.cos(windFrom) * k;
      skyMat.setVector2('cloudOffset', cloudOffset);
    },
  };
  skyMat.disableDepthWrite = true;
  dome.material = skyMat;
  dome.infiniteDistance = true;
  dome.isPickable = false;
  dome.applyFog = false;

  const camera = new ArcRotateCamera('camera', -Math.PI / 2, 1.25, 45, Vector3.Zero(), scene);
  camera.attachControl(canvas, true);
  camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
  camera.lowerRadiusLimit = 12;
  camera.upperRadiusLimit = 220;
  camera.upperBetaLimit = 1.48;
  camera.lowerBetaLimit = 0.2;
  camera.wheelDeltaPercentage = 0.01;
  camera.minZ = 0.5;
  camera.maxZ = 40000;

  const water = createWater(scene, HORIZON, sunDirection, FOG_DENSITY);

  window.addEventListener('resize', () => engine.resize());
  return { engine, scene, camera, water, sunDirection, skyColor: HORIZON, fogDensity: FOG_DENSITY, sky };
}
