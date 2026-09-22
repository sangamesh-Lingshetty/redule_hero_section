import * as THREE from 'three';
import type { PipelineStageId } from '../../config/pipeline';
import type { NodeRuntime } from '../createNode';

interface MotionProfile {
  phase: number;
  floatAmplitude: number;
  floatRate: number;
  coreAmplitude: number;
  coreRate: number;
}

interface PartState {
  object: THREE.Object3D;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

interface NodeState {
  node: NodeRuntime;
  core: PartState;
  frame?: PartState;
  rings: PartState[];
  mechanisms: PartState[];
  secondary: PartState[];
}

export interface AmbientController {
  readonly enabled: boolean;
  setEnabled(enabled: boolean): void;
  update(elapsedTime: number): void;
  reset(): void;
}

const TWO_PI = Math.PI * 2;

const MOTION_PROFILES: Record<PipelineStageId, MotionProfile> = {
  workspace: {
    phase: 0.2,
    floatAmplitude: 0.01,
    floatRate: 0.33,
    coreAmplitude: 0.01,
    coreRate: 0.36,
  },
  agents: {
    phase: 1.15,
    floatAmplitude: 0.035,
    floatRate: 0.42,
    coreAmplitude: 0.018,
    coreRate: 0.48,
  },
  triggers: {
    phase: 2.35,
    floatAmplitude: 0.028,
    floatRate: 0.5,
    coreAmplitude: 0.014,
    coreRate: 0.62,
  },
  events: {
    phase: 3.4,
    floatAmplitude: 0.012,
    floatRate: 0.3,
    coreAmplitude: 0.008,
    coreRate: 0.32,
  },
  workflows: {
    phase: 4.45,
    floatAmplitude: 0.04,
    floatRate: 0.46,
    coreAmplitude: 0.02,
    coreRate: 0.44,
  },
  tools: {
    phase: 5.3,
    floatAmplitude: 0.024,
    floatRate: 0.38,
    coreAmplitude: 0.014,
    coreRate: 0.4,
  },
  outcomes: {
    phase: 6.1,
    floatAmplitude: 0.01,
    floatRate: 0.28,
    coreAmplitude: 0.01,
    coreRate: 0.28,
  },
};

function capturePart(object: THREE.Object3D): PartState {
  return {
    object,
    position: object.position.clone(),
    rotation: object.rotation.clone(),
    scale: object.scale.clone(),
  };
}

function restorePart(part: PartState): void {
  part.object.position.copy(part.position);
  part.object.rotation.copy(part.rotation);
  part.object.scale.copy(part.scale);
}

function setScale(part: PartState, factor: number): void {
  part.object.scale.set(
    part.scale.x * factor,
    part.scale.y * factor,
    part.scale.z * factor,
  );
}

function wrappedRotation(elapsedTime: number, rate: number): number {
  return (elapsedTime * rate) % TWO_PI;
}

export function createAmbientController(
  nodes: ReadonlyMap<PipelineStageId, NodeRuntime>,
): AmbientController {
  const states = Array.from(nodes.values(), (node): NodeState => ({
    node,
    core: capturePart(node.core),
    frame: node.frame ? capturePart(node.frame) : undefined,
    rings: node.rings.map(capturePart),
    mechanisms: node.mechanisms.map(capturePart),
    secondary: node.secondary.map(capturePart),
  }));
  let enabled = true;

  const reset = (): void => {
    for (const state of states) {
      state.node.root.position.copy(state.node.basePosition);
      state.node.root.scale.copy(state.node.baseScale);
      restorePart(state.core);
      if (state.frame) {
        restorePart(state.frame);
      }
      state.rings.forEach(restorePart);
      state.mechanisms.forEach(restorePart);
      state.secondary.forEach(restorePart);
    }
  };

  const update = (elapsedTime: number): void => {
    if (!enabled) {
      reset();
      return;
    }

    for (const state of states) {
      const { node } = state;
      const profile = MOTION_PROFILES[node.id];
      const floatWave = Math.sin(
        elapsedTime * profile.floatRate + profile.phase,
      );
      const coreWave = Math.sin(
        elapsedTime * profile.coreRate + profile.phase * 0.73,
      );

      restorePart(state.core);
      if (state.frame) {
        restorePart(state.frame);
      }
      state.rings.forEach(restorePart);
      state.mechanisms.forEach(restorePart);
      state.secondary.forEach(restorePart);
      node.root.position.set(
        node.basePosition.x,
        node.basePosition.y + floatWave * profile.floatAmplitude,
        node.basePosition.z,
      );
      node.root.scale.copy(node.baseScale);
      setScale(state.core, 1 + coreWave * profile.coreAmplitude);

      switch (node.id) {
        case 'workspace':
          if (state.frame) {
            setScale(
              state.frame,
              1 + Math.sin(elapsedTime * 0.25 + profile.phase) * 0.002,
            );
          }
          break;
        case 'agents':
          if (state.secondary[0]) {
            state.secondary[0].object.rotation.z =
              state.secondary[0].rotation.z +
              wrappedRotation(elapsedTime, 0.06);
          }
          break;
        case 'triggers':
          break;
        case 'events':
          if (state.mechanisms[0]) {
            state.mechanisms[0].object.position.y =
              state.mechanisms[0].position.y +
              Math.sin(elapsedTime * 0.28 + profile.phase) * 0.012;
          }
          if (state.secondary[0]) {
            state.secondary[0].object.position.x =
              state.secondary[0].position.x +
              Math.sin(elapsedTime * 0.24 + profile.phase) * 0.008;
          }
          break;
        case 'workflows':
          if (state.secondary[0]) {
            state.secondary[0].object.position.z =
              state.secondary[0].position.z +
              Math.sin(elapsedTime * 0.38 + profile.phase) * 0.008;
          }
          break;
        case 'tools': {
          const response = Math.sin(elapsedTime * 0.44 + profile.phase) * 0.025;
          state.core.object.position.x = state.core.position.x + response;
          for (let index = 0; index < state.mechanisms.length; index += 1) {
            const rail = state.mechanisms[index];
            rail.object.position.x =
              rail.position.x + response * (index === 0 ? 0.35 : -0.35);
          }
          break;
        }
        case 'outcomes':
          if (state.rings[0]) {
            state.rings[0].object.rotation.z =
              state.rings[0].rotation.z +
              Math.sin(elapsedTime * 0.11 + profile.phase) * 0.018;
          }
          break;
      }
    }
  };

  return {
    get enabled(): boolean {
      return enabled;
    },
    setEnabled(nextEnabled: boolean): void {
      enabled = nextEnabled;
      if (!enabled) {
        reset();
      }
    },
    update,
    reset,
  };
}
