import * as THREE from 'three';

export interface RouteEnergyUniforms
  extends Record<string, THREE.IUniform> {
  uProgress: THREE.IUniform<number>;
  uIntensity: THREE.IUniform<number>;
  uTailLength: THREE.IUniform<number>;
  uColor: THREE.IUniform<THREE.Color>;
  uOpacity: THREE.IUniform<number>;
  uReverse: THREE.IUniform<number>;
}

export interface RouteEnergyMaterial {
  material: THREE.ShaderMaterial;
  uniforms: RouteEnergyUniforms;
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uProgress;
  uniform float uIntensity;
  uniform float uTailLength;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uReverse;

  varying vec2 vUv;

  void main() {
    float routePosition = mix(vUv.x, 1.0 - vUv.x, uReverse);
    float distanceBehindHead = uProgress - routePosition;
    float behindHead = step(0.0, distanceBehindHead);
    float trail = smoothstep(uTailLength, 0.0, distanceBehindHead) * behindHead;
    float head = exp(-pow(distanceBehindHead / 0.022, 2.0));
    float leadingHalo = exp(-pow((routePosition - uProgress) / 0.016, 2.0));
    float edgeFade = smoothstep(0.0, 0.035, uProgress);
    float energy = (trail * 0.58 + head * 1.5 + leadingHalo * 0.22)
      * edgeFade
      * uIntensity;
    float alpha = clamp(energy * uOpacity, 0.0, 1.0);

    if (alpha < 0.002) discard;

    vec3 color = uColor * (0.72 + trail * 0.5 + head * 1.65);
    gl_FragColor = vec4(color, alpha);
  }
`;

export function createRouteEnergyMaterial(): RouteEnergyMaterial {
  const uniforms: RouteEnergyUniforms = {
    uProgress: { value: 0 },
    uIntensity: { value: 0 },
    uTailLength: { value: 0.18 },
    uColor: { value: new THREE.Color(0x72eaf6) },
    uOpacity: { value: 0 },
    uReverse: { value: 0 },
  };

  return {
    uniforms,
    material: new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  };
}
