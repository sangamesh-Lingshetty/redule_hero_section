import type { PipelinePosition, PipelineStageId } from './pipeline';

export interface CameraKeyframe {
  id: PipelineStageId | 'initial' | 'completed';
  progress: number;
  position: PipelinePosition;
  target: PipelinePosition;
  fov: number;
}

export const cameraKeyframes: readonly CameraKeyframe[] = [
  {
    id: 'initial',
    progress: 0,
    position: [0.35, 2.8, 12.45],
    target: [0, -0.12, 0.02],
    fov: 36.5,
  },
  {
    id: 'workspace',
    progress: 0.035,
    position: [-0.35, 2.75, 12.55],
    target: [-3.6, -0.65, 0.3],
    fov: 37.2,
  },
  {
    id: 'workspace',
    progress: 0.09,
    position: [-0.35, 2.75, 12.55],
    target: [-3.6, -0.65, 0.3],
    fov: 37.2,
  },
  {
    id: 'agents',
    progress: 0.15,
    position: [-0.2, 2.8, 12.5],
    target: [-3.05, -0.48, 0.05],
    fov: 36.8,
  },
  {
    id: 'agents',
    progress: 0.24,
    position: [-0.2, 2.8, 12.5],
    target: [-3.05, -0.48, 0.05],
    fov: 36.8,
  },
  {
    id: 'triggers',
    progress: 0.3,
    position: [-0.05, 2.8, 12.45],
    target: [-1.65, -0.25, -0.2],
    fov: 36.7,
  },
  {
    id: 'triggers',
    progress: 0.37,
    position: [-0.05, 2.8, 12.45],
    target: [-1.65, -0.25, -0.2],
    fov: 36.7,
  },
  {
    id: 'events',
    progress: 0.43,
    position: [0.15, 2.82, 12.4],
    target: [-0.05, 0, -0.08],
    fov: 36.5,
  },
  {
    id: 'events',
    progress: 0.5,
    position: [0.15, 2.82, 12.4],
    target: [-0.05, 0, -0.08],
    fov: 36.5,
  },
  {
    id: 'workflows',
    progress: 0.56,
    position: [0.45, 2.9, 12.3],
    target: [1.45, 0.26, 0.2],
    fov: 36.4,
  },
  {
    id: 'workflows',
    progress: 0.68,
    position: [0.45, 2.9, 12.3],
    target: [1.45, 0.26, 0.2],
    fov: 36.4,
  },
  {
    id: 'tools',
    progress: 0.74,
    position: [0.68, 2.92, 12.4],
    target: [2.9, 0.55, 0.02],
    fov: 36.8,
  },
  {
    id: 'tools',
    progress: 0.81,
    position: [0.68, 2.92, 12.4],
    target: [2.9, 0.55, 0.02],
    fov: 36.8,
  },
  {
    id: 'outcomes',
    progress: 0.86,
    position: [0.88, 2.95, 12.55],
    target: [4.1, 0.78, 0.3],
    fov: 37.2,
  },
  {
    id: 'outcomes',
    progress: 0.93,
    position: [0.88, 2.95, 12.55],
    target: [4.1, 0.78, 0.3],
    fov: 37.2,
  },
  {
    id: 'completed',
    progress: 1,
    position: [0.35, 2.8, 12.45],
    target: [0, -0.12, 0.02],
    fov: 36.5,
  },
] as const;
