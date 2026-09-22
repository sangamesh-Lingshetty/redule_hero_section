import * as THREE from 'three';
import { cameraKeyframes } from '../../config/camera';

const REFERENCE_ASPECT = 1.6;
const MOBILE_POSITION = new THREE.Vector3(1.6, 1.3, 16.2);
const MOBILE_TARGET = new THREE.Vector3(0, 0, 0);

export interface CameraChoreography {
  update(
    progress: number,
    aspect: number,
    compact: boolean,
    reducedMotion: boolean,
  ): void;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function smoothstep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function mix(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

export function createCameraChoreography(
  camera: THREE.PerspectiveCamera,
): CameraChoreography {
  const target = new THREE.Vector3();
  let previousFov = camera.fov;

  const applyFov = (fov: number): void => {
    if (Math.abs(previousFov - fov) < 0.001) return;
    previousFov = fov;
    camera.fov = fov;
    camera.updateProjectionMatrix();
  };

  const applyStaticDesktop = (aspect: number): void => {
    const keyframe = cameraKeyframes[0];
    const distanceScale = Math.max(0.82, REFERENCE_ASPECT / aspect);
    camera.position.set(
      keyframe.position[0],
      keyframe.position[1] * distanceScale,
      keyframe.position[2] * distanceScale,
    );
    target.set(...keyframe.target);
    applyFov(keyframe.fov);
    camera.lookAt(target);
  };

  return {
    update(
      progress: number,
      aspect: number,
      compact: boolean,
      reducedMotion: boolean,
    ): void {
      if (compact) {
        camera.position.copy(MOBILE_POSITION);
        applyFov(36);
        camera.lookAt(MOBILE_TARGET);
        return;
      }

      if (reducedMotion) {
        applyStaticDesktop(aspect);
        return;
      }

      const normalizedProgress = clamp01(progress);
      let keyframeIndex = 0;
      for (let index = 0; index < cameraKeyframes.length - 1; index += 1) {
        if (normalizedProgress <= cameraKeyframes[index + 1].progress) {
          keyframeIndex = index;
          break;
        }
        keyframeIndex = index + 1;
      }

      const from = cameraKeyframes[keyframeIndex];
      const to =
        cameraKeyframes[Math.min(keyframeIndex + 1, cameraKeyframes.length - 1)];
      const duration = Math.max(to.progress - from.progress, 0.0001);
      const interpolation = smoothstep(
        (normalizedProgress - from.progress) / duration,
      );
      const distanceScale = Math.max(0.82, REFERENCE_ASPECT / aspect);

      camera.position.set(
        mix(from.position[0], to.position[0], interpolation),
        mix(from.position[1], to.position[1], interpolation) * distanceScale,
        mix(from.position[2], to.position[2], interpolation) * distanceScale,
      );
      target.set(
        mix(from.target[0], to.target[0], interpolation),
        mix(from.target[1], to.target[1], interpolation),
        mix(from.target[2], to.target[2], interpolation),
      );
      applyFov(mix(from.fov, to.fov, interpolation));
      camera.lookAt(target);
    },
  };
}
