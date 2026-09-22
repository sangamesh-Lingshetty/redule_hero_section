import * as THREE from 'three';
import type { PipelineStage, PipelineStageId } from '../config/pipeline';

export interface NodeMaterials {
  surface: THREE.MeshStandardMaterial;
  core: THREE.MeshStandardMaterial;
  edge: THREE.LineBasicMaterial;
  edgeMuted: THREE.LineBasicMaterial;
  accent: THREE.MeshBasicMaterial;
}

export type NodeVisualState = 'idle' | 'active' | 'completed';

export interface NodeStateMaterials {
  core: THREE.MeshStandardMaterial;
  edge: THREE.LineBasicMaterial;
  edgeMuted: THREE.LineBasicMaterial;
  accent: THREE.MeshBasicMaterial;
}

export interface SemanticSignalRuntime {
  mesh: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  path: THREE.Curve<THREE.Vector3>;
}

export interface NodeSemanticParts {
  contextModules: THREE.Object3D[];
  packets: THREE.Object3D[];
  workers: THREE.Object3D[];
  inputs: THREE.Object3D[];
  locks: THREE.Object3D[];
  branches: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
  ports: THREE.Object3D[];
  toolPorts: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
  verification: THREE.Object3D[];
  signals: SemanticSignalRuntime[];
  workspaceRoutes: THREE.LineSegments<
    THREE.BufferGeometry,
    THREE.LineBasicMaterial
  >[];
  agentLinks: THREE.LineSegments<
    THREE.BufferGeometry,
    THREE.LineBasicMaterial
  >[];
  eventRecordLines: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
  inputRoutes: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>[];
  branchPaths: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>[];
  toolRoutes: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>[];
  selectedRoute?: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  check?: THREE.Object3D;
}

export interface NodeRuntime {
  id: PipelineStageId;
  state: NodeVisualState;
  phase: number;
  root: THREE.Group;
  core: THREE.Object3D;
  frame?: THREE.Object3D;
  rings: THREE.Object3D[];
  mechanisms: THREE.Object3D[];
  secondary: THREE.Object3D[];
  semantic: NodeSemanticParts;
  materials: NodeStateMaterials;
  basePosition: THREE.Vector3;
  baseScale: THREE.Vector3;
}

interface NodeParts {
  core: THREE.Object3D;
  frame?: THREE.Object3D;
  rings: THREE.Object3D[];
  mechanisms: THREE.Object3D[];
  secondary: THREE.Object3D[];
  semantic: NodeSemanticParts;
}

const NODE_SCALE = 1.02;

export function createNodeMaterials(): NodeMaterials {
  return {
    surface: new THREE.MeshStandardMaterial({
      color: 0x0c1a1f,
      emissive: 0x032129,
      emissiveIntensity: 0.09,
      metalness: 0.68,
      roughness: 0.4,
    }),
    core: new THREE.MeshStandardMaterial({
      color: 0x12343d,
      emissive: 0x07899c,
      emissiveIntensity: 0.14,
      metalness: 0.55,
      roughness: 0.3,
    }),
    edge: new THREE.LineBasicMaterial({
      color: 0x55dcee,
      transparent: true,
      opacity: 0.52,
    }),
    edgeMuted: new THREE.LineBasicMaterial({
      color: 0x2b8997,
      transparent: true,
      opacity: 0.2,
    }),
    accent: new THREE.MeshBasicMaterial({
      color: 0x43d8eb,
      transparent: true,
      opacity: 0.42,
    }),
  };
}

function createSemanticParts(): NodeSemanticParts {
  return {
    contextModules: [],
    packets: [],
    workers: [],
    inputs: [],
    locks: [],
    branches: [],
    ports: [],
    toolPorts: [],
    verification: [],
    signals: [],
    workspaceRoutes: [],
    agentLinks: [],
    eventRecordLines: [],
    inputRoutes: [],
    branchPaths: [],
    toolRoutes: [],
  };
}

function addSemanticSignal(
  parent: THREE.Object3D,
  semantic: NodeSemanticParts,
  points: readonly THREE.Vector3[],
  accent: THREE.MeshBasicMaterial,
  size = 0.045,
): SemanticSignalRuntime {
  const material = accent.clone();
  material.color.set(0xa9f8fd);
  material.opacity = 0;
  material.blending = THREE.AdditiveBlending;
  material.depthWrite = false;
  material.toneMapped = false;
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(size, 0),
    material,
  );
  mesh.scale.setScalar(0.001);
  mesh.renderOrder = 4;
  const path =
    points.length > 2
      ? new THREE.CatmullRomCurve3([...points], false, 'centripetal')
      : new THREE.LineCurve3(points[0], points[1]);
  path.getPoint(0, mesh.position);
  parent.add(mesh);
  const signal = { mesh, path };
  semantic.signals.push(signal);
  return signal;
}

function addBoxWithEdges(
  parent: THREE.Object3D,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  surface: THREE.Material,
  edge: THREE.LineBasicMaterial,
): THREE.Group {
  const wrapper = new THREE.Group();
  const geometry = new THREE.BoxGeometry(...size);
  wrapper.position.set(...position);
  wrapper.add(new THREE.Mesh(geometry, surface));
  wrapper.add(
    new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edge),
  );
  parent.add(wrapper);
  return wrapper;
}

function createLine(
  points: readonly THREE.Vector3[],
  material: THREE.LineBasicMaterial,
): THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([...points]),
    material,
  );
}

function createHexCore(
  materials: NodeMaterials,
  radius: number,
  depth: number,
): THREE.Group {
  const core = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, 6),
    materials.core,
  );
  body.rotation.x = Math.PI / 2;
  core.add(body);

  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.48, radius * 0.48, depth + 0.012, 6),
    materials.accent,
  );
  face.rotation.x = Math.PI / 2;
  core.add(face);
  return core;
}

function addPipelinePort(
  parent: THREE.Object3D,
  materials: NodeMaterials,
  x: number,
): THREE.Group {
  const port = new THREE.Group();
  port.position.x = x;

  const socket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.072, 0.14, 8),
    materials.surface,
  );
  socket.rotation.z = Math.PI / 2;
  port.add(socket);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.078, 0.012, 5, 16),
    materials.accent,
  );
  rim.rotation.y = Math.PI / 2;
  rim.position.x = Math.sign(x) * 0.07;
  port.add(rim);
  parent.add(port);
  return port;
}

function addStationFrame(
  group: THREE.Group,
  materials: NodeMaterials,
  width: number,
  depth = 0.66,
  input = true,
  output = true,
): { frame: THREE.Group; inputPort?: THREE.Group; outputPort?: THREE.Group } {
  const frame = new THREE.Group();
  frame.name = 'station-frame';
  addBoxWithEdges(
    frame,
    [width, 0.08, depth],
    [0, -0.48, 0],
    materials.surface,
    materials.edgeMuted,
  );

  for (const x of [-width * 0.47, width * 0.47]) {
    addBoxWithEdges(
      frame,
      [0.045, 0.24, 0.045],
      [x, -0.34, -depth * 0.42],
      materials.surface,
      materials.edgeMuted,
    );
  }

  const inputPort = input
    ? addPipelinePort(frame, materials, -width * 0.53)
    : undefined;
  const outputPort = output
    ? addPipelinePort(frame, materials, width * 0.53)
    : undefined;
  group.add(frame);
  return { frame, inputPort, outputPort };
}

function addWorkspace(group: THREE.Group, materials: NodeMaterials): NodeParts {
  const semantic = createSemanticParts();
  const { frame, outputPort } = addStationFrame(
    group,
    materials,
    1.48,
    0.76,
    false,
    true,
  );

  const boundary = new THREE.Group();
  const boundaryParts = [
    [0, 0.43, 0, 1.34, 0.045, 0.045],
    [-0.66, 0.02, 0, 0.045, 0.82, 0.045],
    [0.66, 0.02, 0, 0.045, 0.82, 0.045],
  ] as const;
  for (const [x, y, z, width, height, depth] of boundaryParts) {
    addBoxWithEdges(
      boundary,
      [width, height, depth],
      [x, y, z],
      materials.surface,
      materials.edgeMuted,
    );
  }
  group.add(boundary);

  addBoxWithEdges(
    group,
    [1.15, 0.07, 0.48],
    [0, -0.27, 0],
    materials.surface,
    materials.edge,
  );

  const contextGroup = new THREE.Group();
  const modulePositions = [-0.4, -0.06, 0.28] as const;
  for (const [index, x] of modulePositions.entries()) {
    const module = addBoxWithEdges(
      contextGroup,
      [0.25, 0.3 + index * 0.035, 0.3],
      [x, -0.07 + index * 0.025, 0.02],
      materials.surface,
      index === 1 ? materials.edge : materials.edgeMuted,
    );
    module.userData.basePosition = module.position.clone();
    semantic.contextModules.push(module);
  }

  for (const x of modulePositions) {
    const routeGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, -0.25, 0.18),
      new THREE.Vector3(0.53, -0.25, 0.18),
    ]);
    const contextRoute = new THREE.LineSegments(
      routeGeometry,
      materials.edgeMuted.clone(),
    );
    contextGroup.add(contextRoute);
    semantic.workspaceRoutes.push(contextRoute);
    addSemanticSignal(
      contextGroup,
      semantic,
      [
        new THREE.Vector3(x, -0.25, 0.18),
        new THREE.Vector3(0.53, -0.25, 0.18),
        new THREE.Vector3(0.52, -0.08, 0.02),
      ],
      materials.accent,
      0.038,
    );
  }
  group.add(contextGroup);

  const core = createHexCore(materials, 0.12, 0.18);
  core.position.set(0.52, -0.08, 0.02);
  group.add(core);

  const packet = new THREE.Mesh(
    new THREE.BoxGeometry(0.105, 0.105, 0.105),
    materials.accent,
  );
  packet.position.set(0.47, -0.08, 0.02);
  packet.scale.setScalar(0.001);
  group.add(packet);
  semantic.packets.push(packet);
  if (outputPort) semantic.ports.push(outputPort);

  return {
    core,
    frame,
    rings: [],
    mechanisms: [boundary],
    secondary: [contextGroup],
    semantic,
  };
}

function addAgents(group: THREE.Group, materials: NodeMaterials): NodeParts {
  const semantic = createSemanticParts();
  const { frame, outputPort } = addStationFrame(group, materials, 1.35);
  const core = createHexCore(materials, 0.27, 0.28);
  core.position.y = 0.02;
  group.add(core);

  const workers = new THREE.Group();
  const workerPositions = [
    new THREE.Vector3(-0.48, 0.29, 0.02),
    new THREE.Vector3(0.48, 0.29, -0.03),
    new THREE.Vector3(0, -0.36, 0.04),
  ];
  const linkPositions: number[] = [];
  for (const position of workerPositions) {
    const worker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.14, 6),
      materials.accent,
    );
    worker.rotation.x = Math.PI / 2;
    worker.position.copy(position);
    worker.userData.basePosition = position.clone();
    workers.add(worker);
    semantic.workers.push(worker);
    linkPositions.push(0, 0.02, 0, position.x, position.y, position.z);
  }
  const links = new THREE.BufferGeometry();
  links.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(linkPositions, 3),
  );
  const agentLinks = new THREE.LineSegments(
    links,
    materials.edgeMuted.clone(),
  );
  workers.add(agentLinks);
  semantic.agentLinks.push(agentLinks);
  for (const position of workerPositions) {
    addSemanticSignal(
      workers,
      semantic,
      [new THREE.Vector3(0, 0.02, 0), position.clone()],
      materials.accent,
      0.04,
    );
  }
  group.add(workers);

  const packet = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.075, 0.075),
    materials.accent,
  );
  packet.position.set(0.48, 0, 0);
  packet.scale.setScalar(0.001);
  group.add(packet);
  semantic.packets.push(packet);
  if (outputPort) semantic.ports.push(outputPort);

  return {
    core,
    frame,
    rings: [],
    mechanisms: [],
    secondary: [workers],
    semantic,
  };
}

function addTriggers(group: THREE.Group, materials: NodeMaterials): NodeParts {
  const semantic = createSemanticParts();
  const { frame, outputPort } = addStationFrame(group, materials, 1.5);
  const core = addBoxWithEdges(
    group,
    [0.42, 0.62, 0.34],
    [0.34, 0, 0],
    materials.core,
    materials.edge,
  );

  const inputGroup = new THREE.Group();
  const inputPositions = [
    new THREE.Vector3(-0.58, 0.32, 0.03),
    new THREE.Vector3(-0.58, 0, 0.03),
    new THREE.Vector3(-0.58, -0.32, 0.03),
  ];
  for (const [index, position] of inputPositions.entries()) {
    const marker = new THREE.Group();
    marker.position.copy(position);
    if (index === 0) {
      marker.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.15, 0.12),
          materials.accent,
        ),
      );
    } else if (index === 1) {
      marker.add(
        new THREE.Mesh(
          new THREE.TorusGeometry(0.085, 0.016, 5, 16),
          materials.accent,
        ),
      );
      const hand = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.07, 0.018),
        materials.accent,
      );
      hand.position.y = 0.02;
      marker.add(hand);
    } else {
      addBoxWithEdges(
        marker,
        [0.18, 0.12, 0.1],
        [0, 0, 0],
        materials.surface,
        materials.edge,
      );
    }
    marker.userData.basePosition = position.clone();
    inputGroup.add(marker);
    semantic.inputs.push(marker);
    const inputRoute = createLine(
      [position.clone(), new THREE.Vector3(0.12, 0, 0)],
      materials.edgeMuted.clone(),
    );
    inputGroup.add(inputRoute);
    semantic.inputRoutes.push(inputRoute);
  }
  group.add(inputGroup);

  addSemanticSignal(
    group,
    semantic,
    [inputPositions[0], new THREE.Vector3(0.12, 0, 0.08)],
    materials.accent,
    0.042,
  );

  const inboundPacket = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.07, 0.07),
    materials.accent,
  );
  inboundPacket.position.set(-0.58, 0, 0.09);
  inboundPacket.scale.setScalar(0.001);
  group.add(inboundPacket);

  const outboundPacket = inboundPacket.clone();
  outboundPacket.material = materials.accent;
  outboundPacket.position.set(0.46, 0, 0.09);
  group.add(outboundPacket);
  semantic.packets.push(inboundPacket, outboundPacket);
  if (outputPort) semantic.ports.push(outputPort);

  return {
    core,
    frame,
    rings: [],
    mechanisms: [],
    secondary: [inputGroup],
    semantic,
  };
}

function addEvents(group: THREE.Group, materials: NodeMaterials): NodeParts {
  const semantic = createSemanticParts();
  const { outputPort } = addStationFrame(group, materials, 1.4, 0.7);
  const capsule = new THREE.Group();
  for (const [size, position] of [
    [[1.12, 0.055, 0.055], [0, 0.35, 0]],
    [[1.12, 0.055, 0.055], [0, -0.35, 0]],
    [[0.055, 0.7, 0.055], [-0.56, 0, 0]],
    [[0.055, 0.7, 0.055], [0.56, 0, 0]],
  ] as const) {
    addBoxWithEdges(
      capsule,
      size,
      position,
      materials.surface,
      materials.edgeMuted,
    );
  }
  group.add(capsule);

  const core = new THREE.Group();
  addBoxWithEdges(
    core,
    [0.78, 0.42, 0.16],
    [0, 0, 0],
    materials.core,
    materials.edge,
  );
  for (const [index, width] of [0.34, 0.48, 0.27].entries()) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.025, 0.018),
      materials.accent,
    );
    bar.position.set(0.06, 0.11 - index * 0.1, 0.1);
    core.add(bar);
    semantic.eventRecordLines.push(bar);
  }
  const eventId = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.11, 0.025),
    materials.accent,
  );
  eventId.position.set(-0.27, 0.11, 0.1);
  core.add(eventId);
  group.add(core);

  const locks: THREE.Object3D[] = [];
  for (const y of [-0.44, 0.44]) {
    const lock = addBoxWithEdges(
      group,
      [0.52, 0.09, 0.22],
      [0, y, 0.02],
      materials.surface,
      materials.edge,
    );
    lock.userData.baseY = y;
    locks.push(lock);
    semantic.locks.push(lock);
  }

  const inboundPacket = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.075, 0.075),
    materials.accent,
  );
  inboundPacket.position.set(-0.68, 0, 0.1);
  inboundPacket.scale.setScalar(0.001);
  group.add(inboundPacket);
  const outboundPacket = inboundPacket.clone();
  outboundPacket.material = materials.accent;
  outboundPacket.position.set(0.53, 0, 0.1);
  group.add(outboundPacket);
  semantic.packets.push(inboundPacket, outboundPacket);
  if (outputPort) semantic.ports.push(outputPort);

  return {
    core,
    frame: capsule,
    rings: [],
    mechanisms: locks,
    secondary: [capsule],
    semantic,
  };
}

function addWorkflows(group: THREE.Group, materials: NodeMaterials): NodeParts {
  const semantic = createSemanticParts();
  const { frame, outputPort } = addStationFrame(group, materials, 1.72, 0.72);
  const core = createHexCore(materials, 0.22, 0.22);
  core.position.set(-0.55, 0, 0.02);
  group.add(core);

  const topology = new THREE.Group();
  const branchPositions = [
    new THREE.Vector3(0.08, 0.31, 0.03),
    new THREE.Vector3(0.08, 0, 0.06),
    new THREE.Vector3(0.08, -0.31, 0.03),
  ];
  const mergePosition = new THREE.Vector3(0.64, 0, 0.02);
  for (const position of branchPositions) {
    const branchPath = createLine(
      [new THREE.Vector3(-0.33, 0, 0.02), position, mergePosition],
      materials.edgeMuted.clone(),
    );
    topology.add(branchPath);
    semantic.branchPaths.push(branchPath);
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.12, 6),
      materials.accent.clone(),
    );
    branch.rotation.x = Math.PI / 2;
    branch.position.copy(position);
    branch.userData.basePosition = position.clone();
    topology.add(branch);
    semantic.branches.push(branch);
    addSemanticSignal(
      topology,
      semantic,
      [new THREE.Vector3(-0.33, 0, 0.1), position, mergePosition],
      materials.accent,
      0.04,
    );
  }

  const merge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.14, 6),
    materials.surface,
  );
  merge.rotation.x = Math.PI / 2;
  merge.position.copy(mergePosition);
  topology.add(merge);

  const selectedRoute = createLine(
    [new THREE.Vector3(-0.33, 0, 0.08), branchPositions[2], mergePosition],
    materials.edge.clone(),
  );
  selectedRoute.material.opacity = 0;
  topology.add(selectedRoute);
  semantic.selectedRoute = selectedRoute;
  addSemanticSignal(
    topology,
    semantic,
    [branchPositions[2], mergePosition],
    materials.accent,
    0.047,
  );
  group.add(topology);

  const packet = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.075, 0.075),
    materials.accent,
  );
  packet.position.set(0.55, 0, 0.1);
  packet.scale.setScalar(0.001);
  group.add(packet);
  semantic.packets.push(packet);
  if (outputPort) semantic.ports.push(outputPort);

  return {
    core,
    frame,
    rings: [],
    mechanisms: [],
    secondary: [topology],
    semantic,
  };
}

function addTools(group: THREE.Group, materials: NodeMaterials): NodeParts {
  const semantic = createSemanticParts();
  const { frame, outputPort } = addStationFrame(group, materials, 1.5, 0.72);
  const core = createHexCore(materials, 0.26, 0.28);
  core.position.set(-0.36, 0, 0.02);
  group.add(core);

  const ports = new THREE.Group();
  const portPositions = [
    new THREE.Vector3(0.48, 0.38, 0.02),
    new THREE.Vector3(0.56, 0.13, 0.04),
    new THREE.Vector3(0.56, -0.13, 0.04),
    new THREE.Vector3(0.48, -0.38, 0.02),
  ];
  for (const position of portPositions) {
    const toolRoute = createLine(
      [new THREE.Vector3(-0.1, 0, 0.02), position],
      materials.edgeMuted.clone(),
    );
    ports.add(toolRoute);
    semantic.toolRoutes.push(toolRoute);
    const port = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.16, 8),
      materials.accent.clone(),
    );
    port.rotation.z = Math.PI / 2;
    port.position.copy(position);
    port.userData.basePosition = position.clone();
    ports.add(port);
    semantic.ports.push(port);
    semantic.toolPorts.push(port);
    addSemanticSignal(
      ports,
      semantic,
      [new THREE.Vector3(-0.1, 0, 0.08), position],
      materials.accent,
      0.038,
    );
  }
  group.add(ports);

  const packet = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.075, 0.075),
    materials.accent,
  );
  packet.position.set(-0.12, -0.13, 0.1);
  packet.scale.setScalar(0.001);
  group.add(packet);
  semantic.packets.push(packet);
  if (outputPort) semantic.ports.push(outputPort);

  return {
    core,
    frame,
    rings: [],
    mechanisms: [ports],
    secondary: [ports],
    semantic,
  };
}

function addOutcomes(group: THREE.Group, materials: NodeMaterials): NodeParts {
  const semantic = createSemanticParts();
  const { frame } = addStationFrame(
    group,
    materials,
    1.34,
    0.7,
    true,
    false,
  );
  const core = createHexCore(materials, 0.3, 0.3);
  group.add(core);

  const verificationRing = new THREE.Group();
  for (let index = 0; index < 8; index += 1) {
    const segment = new THREE.Mesh(
      new THREE.TorusGeometry(0.59, 0.025, 5, 12, 0.75),
      materials.accent,
    );
    segment.rotation.z = index * (Math.PI / 4) + 0.08;
    segment.scale.setScalar(0.08);
    verificationRing.add(segment);
    semantic.verification.push(segment);
  }
  group.add(verificationRing);

  const check = new THREE.Group();
  check.position.set(0.02, -0.02, 0.22);
  const shortBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.055, 0.045),
    materials.accent,
  );
  shortBar.position.set(-0.1, -0.06, 0);
  shortBar.rotation.z = -Math.PI / 4;
  check.add(shortBar);
  const longBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.055, 0.045),
    materials.accent,
  );
  longBar.position.set(0.1, 0.03, 0);
  longBar.rotation.z = Math.PI / 4;
  check.add(longBar);
  check.scale.setScalar(0.001);
  group.add(check);
  semantic.check = check;

  return {
    core,
    frame,
    rings: [verificationRing],
    mechanisms: [],
    secondary: [check],
    semantic,
  };
}

function createNodeParts(
  stageId: PipelineStageId,
  node: THREE.Group,
  materials: NodeMaterials,
): NodeParts {
  switch (stageId) {
    case 'workspace':
      return addWorkspace(node, materials);
    case 'agents':
      return addAgents(node, materials);
    case 'triggers':
      return addTriggers(node, materials);
    case 'events':
      return addEvents(node, materials);
    case 'workflows':
      return addWorkflows(node, materials);
    case 'tools':
      return addTools(node, materials);
    case 'outcomes':
      return addOutcomes(node, materials);
  }
}

export function createNode(
  stage: PipelineStage,
  materials: NodeMaterials,
): NodeRuntime {
  const node = new THREE.Group();
  node.name = stage.id;
  node.userData.pipelineStageId = stage.id;
  node.position.set(...stage.position);
  node.scale.setScalar(NODE_SCALE * (stage.scale ?? 1));

  const stateMaterials: NodeStateMaterials = {
    core: materials.core.clone(),
    edge: materials.edge.clone(),
    edgeMuted: materials.edgeMuted.clone(),
    accent: materials.accent.clone(),
  };
  const scopedMaterials: NodeMaterials = {
    surface: materials.surface,
    ...stateMaterials,
  };
  const parts = createNodeParts(stage.id, node, scopedMaterials);

  return {
    id: stage.id,
    state: 'idle',
    phase: 0,
    root: node,
    core: parts.core,
    frame: parts.frame,
    rings: parts.rings,
    mechanisms: parts.mechanisms,
    secondary: parts.secondary,
    semantic: parts.semantic,
    materials: stateMaterials,
    basePosition: node.position.clone(),
    baseScale: node.scale.clone(),
  };
}
