import * as THREE from 'three';
import type {
  PipelinePosition,
  PipelineStage,
  PipelineStageId,
} from '../config/pipeline';
import {
  createRouteEnergyMaterial,
  type RouteEnergyUniforms,
} from './materials/createRouteEnergyMaterial';

const ROUTE_SEGMENTS = 48;
const TRAIL_POINT_COUNT = 4;

export type ConnectionVisualState = 'base' | 'processing' | 'completed';

export interface ConnectionRuntime {
  fromId: PipelineStageId;
  toId: PipelineStageId;
  state: ConnectionVisualState;
  route: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  energyRoute: THREE.Mesh<THREE.TubeGeometry, THREE.ShaderMaterial>;
  energyUniforms: RouteEnergyUniforms;
  material: THREE.MeshBasicMaterial;
  start: THREE.Vector3;
  end: THREE.Vector3;
  curve: THREE.QuadraticBezierCurve3;
}

export interface ConnectionSystemRuntime {
  group: THREE.Group;
  connections: ConnectionRuntime[];
  pulse: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  pulseShell: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  pulseTrail: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>[];
  setLayout(positions: readonly PipelinePosition[]): void;
}

function createRouteCurve(
  start: THREE.Vector3,
  end: THREE.Vector3,
): THREE.QuadraticBezierCurve3 {
  const control = start.clone().lerp(end, 0.5);
  control.y += 0.035;
  control.z += 0.16;
  return new THREE.QuadraticBezierCurve3(start, control, end);
}

function setRouteLayout(
  connection: ConnectionRuntime,
  from: PipelinePosition,
  to: PipelinePosition,
  fromClearance: number,
  toClearance: number,
): void {
  connection.start.set(...from);
  connection.end.set(...to);
  const direction = connection.end
    .clone()
    .sub(connection.start)
    .normalize();

  connection.start.addScaledVector(direction, fromClearance);
  connection.end.addScaledVector(direction, -toClearance);
  connection.curve = createRouteCurve(connection.start, connection.end);

  connection.route.geometry.dispose();
  connection.energyRoute.geometry.dispose();
  connection.route.geometry = new THREE.TubeGeometry(
    connection.curve,
    ROUTE_SEGMENTS,
    0.01,
    4,
    false,
  );
  connection.energyRoute.geometry = new THREE.TubeGeometry(
    connection.curve,
    ROUTE_SEGMENTS,
    0.02,
    6,
    false,
  );
}

export function createConnections(
  stages: readonly PipelineStage[],
  baseMaterial: THREE.MeshBasicMaterial,
): ConnectionSystemRuntime {
  const connections = new THREE.Group();
  connections.name = 'pipeline-connections';
  const runtimes: ConnectionRuntime[] = [];

  for (let index = 0; index < stages.length - 1; index += 1) {
    const start = new THREE.Vector3(...stages[index].position);
    const end = new THREE.Vector3(...stages[index + 1].position);
    const direction = end.clone().sub(start).normalize();

    start.addScaledVector(direction, stages[index].connectorClearance);
    end.addScaledVector(
      direction,
      -stages[index + 1].connectorClearance,
    );

    const curve = createRouteCurve(start, end);
    const geometry = new THREE.TubeGeometry(
      curve,
      ROUTE_SEGMENTS,
      0.01,
      4,
      false,
    );
    const material = baseMaterial.clone();
    const route = new THREE.Mesh(geometry, material);
    route.name = `${stages[index].id}-to-${stages[index + 1].id}`;
    route.renderOrder = 1;
    connections.add(route);
    const energy = createRouteEnergyMaterial();
    const energyRoute = new THREE.Mesh(
      new THREE.TubeGeometry(curve, ROUTE_SEGMENTS, 0.02, 6, false),
      energy.material,
    );
    energyRoute.name = `${route.name}-energy`;
    energyRoute.renderOrder = 2;
    connections.add(energyRoute);
    runtimes.push({
      fromId: stages[index].id,
      toId: stages[index + 1].id,
      state: 'base',
      route,
      energyRoute,
      energyUniforms: energy.uniforms,
      material,
      start,
      end,
      curve,
    });
  }

  const pulse = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.1, 0),
    new THREE.MeshBasicMaterial({
      color: 0xb8fbff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  pulse.name = 'pipeline-pulse';
  pulse.visible = false;
  pulse.renderOrder = 4;
  connections.add(pulse);

  const pulseShellGeometry = new THREE.OctahedronGeometry(0.145, 0);
  const pulseShell = new THREE.LineSegments(
    new THREE.EdgesGeometry(pulseShellGeometry),
    new THREE.LineBasicMaterial({
      color: 0xa0f2f9,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  pulseShellGeometry.dispose();
  pulseShell.name = 'pipeline-pulse-shell';
  pulseShell.visible = false;
  pulseShell.renderOrder = 3;
  connections.add(pulseShell);

  const trailGeometry = new THREE.OctahedronGeometry(0.052, 0);
  const pulseTrail = Array.from({ length: TRAIL_POINT_COUNT }, (_, index) => {
    const trail = new THREE.Mesh(
      trailGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x68dce9,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    trail.name = `pipeline-pulse-trail-${index + 1}`;
    trail.visible = false;
    trail.renderOrder = 3;
    connections.add(trail);
    return trail;
  });

  const setLayout = (positions: readonly PipelinePosition[]): void => {
    if (positions.length !== stages.length) {
      throw new Error('Connection layout must include every pipeline stage.');
    }

    for (let index = 0; index < runtimes.length; index += 1) {
      setRouteLayout(
        runtimes[index],
        positions[index],
        positions[index + 1],
        stages[index].connectorClearance,
        stages[index + 1].connectorClearance,
      );
    }
  };

  return {
    group: connections,
    connections: runtimes,
    pulse,
    pulseShell,
    pulseTrail,
    setLayout,
  };
}
