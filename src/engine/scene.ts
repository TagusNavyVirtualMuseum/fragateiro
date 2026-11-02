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
  Vector3,
} from '@babylonjs/core';
import { createWater, type Water } from './water';

export interface SailingScene {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  water: Water;
  sunDirection: Vector3;
}

const HORIZON = new Color3(0.78, 0.85, 0.9);
const ZENITH = new Color3(0.35, 0.55, 0.8);
const FOG_DENSITY = 0.0016;

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
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 c = mix(horizon, zenith, pow(clamp(d.y, 0.0, 1.0), 0.6));
  c += vec3(1.0, 0.9, 0.7) * pow(max(dot(d, normalize(sunDirection)), 0.0), 400.0) * 2.0;
  gl_FragColor = vec4(c, 1.0);
}
`;

export function createSailingScene(canvas: HTMLCanvasElement): SailingScene {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, antialias: true });
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene(engine);
  scene.clearColor = new Color4(HORIZON.r, HORIZON.g, HORIZON.b, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = FOG_DENSITY;
  scene.fogColor = HORIZON;
  scene.ambientColor = new Color3(0.3, 0.3, 0.3);

  const sunDirection = new Vector3(-0.4, 0.55, -0.6).normalize();
  const sun = new DirectionalLight('sun', sunDirection.scale(-1), scene);
  sun.intensity = 2.2;
  const sky = new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
  sky.intensity = 0.9;
  sky.groundColor = new Color3(0.25, 0.3, 0.32);

  const dome = MeshBuilder.CreateSphere('skyDome', { diameter: 3000, segments: 16, sideOrientation: 1 }, scene);
  const skyMat = new ShaderMaterial('skyMat', scene, { vertex: 'sky', fragment: 'sky' }, {
    attributes: ['position'],
    uniforms: ['worldViewProjection', 'horizon', 'zenith', 'sunDirection'],
  });
  skyMat.setColor3('horizon', HORIZON);
  skyMat.setColor3('zenith', ZENITH);
  skyMat.setVector3('sunDirection', sunDirection);
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
  camera.maxZ = 4000;

  const water = createWater(scene, HORIZON, sunDirection, FOG_DENSITY);

  window.addEventListener('resize', () => engine.resize());
  return { engine, scene, camera, water, sunDirection };
}
