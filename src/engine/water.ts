import { Color3, Effect, MeshBuilder, Scene, ShaderMaterial, Vector3, type Mesh } from '@babylonjs/core';
import { WAVES, waveUniforms } from './waves';

const N = WAVES.length;

Effect.ShadersStore.waterVertexShader = /* glsl */ `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 viewProjection;
uniform float time;
uniform float waveScale;
uniform vec4 dirK[${N}];
uniform vec2 ampPhase[${N}];
varying vec3 vWorld;
varying vec3 vNormal;

void main() {
  vec4 wp = world * vec4(position, 1.0);
  float h = 0.0;
  vec2 grad = vec2(0.0);
  for (int i = 0; i < ${N}; i++) {
    vec2 d = dirK[i].xy;
    float k = dirK[i].z;
    float w = dirK[i].w;
    float a = ampPhase[i].x * waveScale;
    float th = k * dot(d, wp.xz) - w * time + ampPhase[i].y;
    h += a * sin(th);
    grad += a * k * cos(th) * d;
  }
  wp.y += h;
  vWorld = wp.xyz;
  vNormal = normalize(vec3(-grad.x, 1.0, -grad.y));
  gl_Position = viewProjection * wp;
}
`;

Effect.ShadersStore.waterFragmentShader = /* glsl */ `
precision highp float;
uniform vec3 cameraPosition;
uniform vec3 sunDirection;
uniform vec3 deepColor;
uniform vec3 shallowColor;
uniform vec3 skyColor;
uniform float fogDensity;
uniform float time;
varying vec3 vWorld;
varying vec3 vNormal;

void main() {
  // Small ripples on top of the big waves, fading out in the distance to avoid shimmer.
  float dist = length(cameraPosition - vWorld);
  float near = exp(-dist / 120.0);
  vec3 big = normalize(mix(vec3(0.0, 1.0, 0.0), vNormal, 0.35 + 0.65 * near));
  vec3 n = normalize(big + near * vec3(
    0.02 * sin(vWorld.x * 1.7 + vWorld.z * 0.6 + time * 1.3) + 0.015 * sin(vWorld.z * 2.9 - vWorld.x * 1.1 - time * 1.1),
    0.0,
    0.02 * cos(vWorld.z * 1.9 - vWorld.x * 0.7 + time * 1.2) + 0.015 * cos(vWorld.x * 3.1 + vWorld.z * 1.3 - time * 0.9)));
  vec3 v = normalize(cameraPosition - vWorld);
  float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 water = mix(deepColor, shallowColor, clamp(n.y * 0.5 - 0.2 + (vWorld.y + 0.3) * 0.6, 0.0, 1.0));
  vec3 color = mix(water, skyColor, fresnel);
  vec3 r = reflect(-sunDirection, n);
  color += vec3(1.0, 0.95, 0.85) * pow(max(dot(r, v), 0.0), 180.0) * 1.5;
  float fog = 1.0 - exp(-pow(dist * fogDensity, 2.0));
  gl_FragColor = vec4(mix(color, skyColor, fog), 1.0);
}
`;

export interface Water {
  mesh: Mesh;
  /** Keep the water patch centred on the camera target. */
  update(time: number, centre: Vector3, cameraPosition: Vector3): void;
}

export function createWater(scene: Scene, skyColor: Color3, sunDirection: Vector3, fogDensity: number): Water {
  const size = 1600;
  const mesh = MeshBuilder.CreateGround('water', { width: size, height: size, subdivisions: 240 }, scene);
  const mat = new ShaderMaterial('waterMat', scene, { vertex: 'water', fragment: 'water' }, {
    attributes: ['position'],
    uniforms: ['world', 'viewProjection', 'time', 'waveScale', 'dirK', 'ampPhase', 'cameraPosition', 'sunDirection', 'deepColor', 'shallowColor', 'skyColor', 'fogDensity'],
  });
  mat.setFloat('waveScale', 1);
  const { dirK, ampPhase } = waveUniforms();
  mat.setArray4('dirK', dirK);
  mat.setArray2('ampPhase', ampPhase);
  mat.setColor3('deepColor', new Color3(0.05, 0.2, 0.26));
  mat.setColor3('shallowColor', new Color3(0.16, 0.38, 0.4));
  mat.setColor3('skyColor', skyColor);
  mat.setVector3('sunDirection', sunDirection.normalizeToNew());
  mat.setFloat('fogDensity', fogDensity);
  mat.backFaceCulling = false;
  mesh.material = mat;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;

  // Beyond the detailed patch: a big flat sheet just below the wave troughs.
  const far = MeshBuilder.CreateGround('waterFar', { width: 60000, height: 60000, subdivisions: 1 }, scene);
  const farMat = mat.clone('waterFarMat');
  farMat.setFloat('waveScale', 0);
  far.material = farMat;
  far.position.y = -0.45;
  far.isPickable = false;
  far.alwaysSelectAsActiveMesh = true;

  const step = size / 240;
  return {
    mesh,
    update(time, centre, cameraPosition) {
      far.position.x = centre.x;
      far.position.z = centre.z;
      farMat.setFloat('time', time);
      farMat.setVector3('cameraPosition', cameraPosition);
      // Snap to the grid so the vertices don't "swim" as the patch follows the boat.
      mesh.position.x = Math.round(centre.x / step) * step;
      mesh.position.z = Math.round(centre.z / step) * step;
      mat.setFloat('time', time);
      mat.setVector3('cameraPosition', cameraPosition);
    },
  };
}
