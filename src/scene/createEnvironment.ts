import * as THREE from 'three';
import type { PipelineStage } from '../config/pipeline';

export interface EnvironmentRuntime {
  group: THREE.Group;
  materials: THREE.Material[];
  setCompact(compact: boolean): void;
}

const GROUND_Y = -1.7;

function createGrid(material: THREE.LineBasicMaterial): THREE.LineSegments {
  const positions: number[] = [];

  for (let x = -8; x <= 8; x += 1) {
    positions.push(x, GROUND_Y, -5, x, GROUND_Y, 5);
  }
  for (let z = -5; z <= 5; z += 1) {
    positions.push(-8, GROUND_Y, z, 8, GROUND_Y, z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  const grid = new THREE.LineSegments(geometry, material);
  grid.name = 'environment-grid';
  grid.renderOrder = -3;
  return grid;
}

function createStageProjections(
  stages: readonly PipelineStage[],
  lineMaterial: THREE.LineBasicMaterial,
  markerMaterial: THREE.MeshBasicMaterial,
): THREE.Group {
  const projections = new THREE.Group();
  projections.name = 'stage-projections';
  const markerGeometry = new THREE.RingGeometry(0.075, 0.095, 16);

  for (const stage of stages) {
    const [x, y, z] = stage.position;
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, GROUND_Y, z),
      new THREE.Vector3(x, y - 0.54, z),
    ]);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.renderOrder = -2;
    projections.add(line);

    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(x, GROUND_Y + 0.006, z);
    marker.rotation.x = -Math.PI / 2;
    marker.renderOrder = -1;
    projections.add(marker);
  }

  return projections;
}

export function createEnvironment(
  stages: readonly PipelineStage[],
): EnvironmentRuntime {
  const group = new THREE.Group();
  group.name = 'environment';

  const gridMaterial = new THREE.LineBasicMaterial({
    color: 0x245660,
    transparent: true,
    opacity: 0.045,
    depthWrite: false,
  });
  const projectionMaterial = new THREE.LineBasicMaterial({
    color: 0x3fa6b6,
    transparent: true,
    opacity: 0.09,
    depthWrite: false,
  });
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: 0x4bc9da,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const grid = createGrid(gridMaterial);
  const projections = createStageProjections(
    stages,
    projectionMaterial,
    markerMaterial,
  );
  group.add(grid, projections);

  const setCompact = (compact: boolean): void => {
    projections.visible = !compact;
    grid.position.y = compact ? -1.15 : 0;
    grid.scale.set(compact ? 0.58 : 1, 1, compact ? 0.72 : 1);
  };

  return {
    group,
    materials: [gridMaterial, projectionMaterial, markerMaterial],
    setCompact,
  };
}
