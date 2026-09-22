import * as THREE from 'three';
import {
  pipelineStages,
  VERIFIED_PROGRESS_START,
  type PipelineStageId,
} from '../config/pipeline';
import { createHoverInteraction } from '../interaction/createHoverInteraction';
import { createAmbientController } from './animation/updateAmbient';
import { createPipelineController } from './animation/updatePipeline';
import { createCameraChoreography } from './camera/createCameraChoreography';
import { createConnections } from './createConnections';
import { createEnvironment } from './createEnvironment';
import {
  createNode,
  createNodeMaterials,
  type NodeRuntime,
} from './createNode';

const MAX_DEVICE_PIXEL_RATIO = 2;
const MOBILE_DEVICE_PIXEL_RATIO = 1.35;
const CAMERA_FOV = 36;
const MOBILE_BREAKPOINT = 640;

interface StageLabelRuntime {
  element: HTMLDivElement;
  status: HTMLSpanElement;
}

interface SceneOverlay {
  elements: StageLabelRuntime[];
  layer: HTMLDivElement;
  systemState: HTMLSpanElement;
  progress: HTMLSpanElement;
  dispose(): void;
}

export interface SceneController {
  readonly progress: number;
  setProgress(progress: number): void;
  cleanup(): void;
}

function createOverlay(container: HTMLElement): SceneOverlay {
  const brand = document.createElement('div');
  brand.className = 'hero-brand';
  brand.setAttribute('aria-hidden', 'true');
  const brandName = document.createElement('strong');
  brandName.textContent = 'REDULE';
  const brandCategory = document.createElement('span');
  brandCategory.textContent = 'AGENTIC OPERATING SYSTEM';
  brand.append(brandName, brandCategory);

  const telemetry = document.createElement('div');
  telemetry.className = 'hero-telemetry';
  telemetry.setAttribute('aria-hidden', 'true');
  const telemetryDot = document.createElement('span');
  telemetryDot.className = 'hero-telemetry-dot';
  const systemState = document.createElement('span');
  systemState.textContent = 'SYS.ONLINE';
  const progress = document.createElement('span');
  progress.className = 'hero-telemetry-progress';
  progress.textContent = '00%';
  telemetry.append(telemetryDot, systemState, progress);

  const layer = document.createElement('div');
  layer.className = 'pipeline-label-layer';
  layer.setAttribute('aria-hidden', 'true');

  const elements = pipelineStages.map((stage) => {
    const label = document.createElement('div');
    label.className = 'pipeline-label';
    label.dataset.state = 'idle';

    const name = document.createElement('span');
    name.className = 'pipeline-label-name';
    name.textContent = stage.label;
    const caption = document.createElement('span');
    caption.className = 'pipeline-label-caption';
    caption.textContent = stage.caption;

    const status = document.createElement('span');
    status.className = 'pipeline-label-status';
    status.textContent = '';
    label.append(name, caption, status);
    layer.appendChild(label);
    return { element: label, status };
  });

  container.append(brand, telemetry, layer);
  return {
    elements,
    layer,
    systemState,
    progress,
    dispose(): void {
      brand.remove();
      telemetry.remove();
      layer.remove();
    },
  };
}

function stageStatus(node: NodeRuntime): string {
  if (node.id === 'events') {
    if (node.state === 'completed' || node.phase >= 0.5) {
      return 'LOCKED';
    }
    return node.state === 'active' ? 'LOCKING' : '';
  }
  if (node.id === 'outcomes') {
    if (node.state === 'completed' || node.phase >= 0.78) {
      return '\u2713 VERIFIED';
    }
    return node.state === 'active' ? 'VERIFYING' : '';
  }
  return '';
}

export function createScene(container: HTMLElement): SceneController {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08090b);
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  const cameraChoreography = createCameraChoreography(camera);

  const nodeMaterials = createNodeMaterials();
  const connectionMaterial = new THREE.MeshBasicMaterial({
    color: 0x2b93a3,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
  });
  const environment = createEnvironment(pipelineStages);
  scene.add(environment.group);
  const connectionSystem = createConnections(
    pipelineStages,
    connectionMaterial,
  );
  scene.add(connectionSystem.group);

  const nodes = new Map<PipelineStageId, NodeRuntime>();
  pipelineStages.forEach((stage) => {
    const node = createNode(stage, nodeMaterials);
    nodes.set(stage.id, node);
    scene.add(node.root);
  });

  const ambient = createAmbientController(nodes);
  const pipeline = createPipelineController(
    nodes,
    connectionSystem,
    pipelineStages.map((stage) => stage.id),
  );
  const clock = new THREE.Clock();

  scene.add(new THREE.AmbientLight(0x8fc8cf, 0.52));
  const keyLight = new THREE.DirectionalLight(0xc8f7ff, 1.25);
  keyLight.position.set(3, 5, 7);
  scene.add(keyLight);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.domElement.setAttribute(
    'aria-label',
    'Interactive Redule agentic operating system pipeline',
  );
  container.appendChild(renderer.domElement);

  const overlay = createOverlay(container);
  const hover = createHoverInteraction({
    container,
    canvas: renderer.domElement,
    camera,
    nodes,
    stages: pipelineStages,
    onHoverChange: (stageId) => pipeline.setHovered(stageId),
  });
  const projectedPosition = new THREE.Vector3();
  const reducedMotionQuery = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  );
  let viewportWidth = 1;
  let viewportHeight = 1;
  let compactLayout = false;
  let scrollControlled = false;
  let reducedMotion = reducedMotionQuery.matches;

  const applyLayout = (compact: boolean): void => {
    if (compact === compactLayout) return;
    compactLayout = compact;
    pipeline.setCompact(compact);
    const positions = pipelineStages.map((stage) =>
      compact ? stage.mobilePosition : stage.position,
    );

    for (let index = 0; index < pipelineStages.length; index += 1) {
      const node = nodes.get(pipelineStages[index].id);
      if (!node) continue;
      node.basePosition.set(...positions[index]);
      node.root.position.copy(node.basePosition);
    }

    connectionSystem.setLayout(positions);
    environment.setCompact(compact);
    container.classList.toggle('is-compact-scene', compact);
  };

  const updateLabels = (): void => {
    let activeId: PipelineStageId | null = null;

    for (let index = 0; index < pipelineStages.length; index += 1) {
      const stage = pipelineStages[index];
      const node = nodes.get(stage.id);
      if (!node) continue;

      projectedPosition.copy(node.root.position).project(camera);
      const label = overlay.elements[index];
      label.element.style.left = `${(projectedPosition.x * 0.5 + 0.5) * viewportWidth}px`;
      label.element.style.top = `${(-projectedPosition.y * 0.5 + 0.5) * viewportHeight}px`;
      label.element.classList.toggle(
        'is-offscreen',
        projectedPosition.x < -0.92 ||
          projectedPosition.x > 0.92 ||
          projectedPosition.y < -0.96 ||
          projectedPosition.y > 0.96,
      );
      if (label.element.dataset.state !== node.state) {
        label.element.dataset.state = node.state;
      }
      const status = stageStatus(node);
      if (label.status.textContent !== status) {
        label.status.textContent = status;
      }
      if (node.state === 'active') {
        activeId = node.id;
      }
    }

    const progressText = `${String(Math.round(pipeline.progress * 100)).padStart(2, '0')}%`;
    if (overlay.progress.textContent !== progressText) {
      overlay.progress.textContent = progressText;
    }
    const systemText =
      pipeline.progress >= VERIFIED_PROGRESS_START
        ? 'RESULT.VERIFIED'
        : activeId
          ? `EXEC.${activeId.toUpperCase()}`
          : 'SYS.ONLINE';
    if (overlay.systemState.textContent !== systemText) {
      overlay.systemState.textContent = systemText;
    }
  };

  const resize = (): void => {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    viewportWidth = width;
    viewportHeight = height;
    applyLayout(width < MOBILE_BREAKPOINT);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    cameraChoreography.update(
      pipeline.progress,
      camera.aspect,
      compactLayout,
      reducedMotion,
    );
    camera.updateMatrixWorld();

    const dprCap = compactLayout
      ? MOBILE_DEVICE_PIXEL_RATIO
      : MAX_DEVICE_PIXEL_RATIO;
    const pixelRatio = Math.min(
      window.devicePixelRatio,
      reducedMotion ? 1.25 : dprCap,
    );
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    updateLabels();
  };

  const applyReducedMotion = (): void => {
    reducedMotion = reducedMotionQuery.matches;
    ambient.setEnabled(!reducedMotion);
    pipeline.setReducedMotion(reducedMotion);

    if (reducedMotion) {
      const currentProgress = pipeline.progress;
      pipeline.setAutoplayEnabled(false);
      pipeline.setProgress(currentProgress);
    } else if (!scrollControlled) {
      pipeline.setAutoplayEnabled(true, clock.getElapsedTime());
    }
    resize();
  };

  const handleReducedMotionChange = (): void => applyReducedMotion();
  const render = (): void => {
    const elapsedTime = clock.getElapsedTime();
    ambient.update(elapsedTime);
    pipeline.update(elapsedTime);
    cameraChoreography.update(
      pipeline.progress,
      camera.aspect,
      compactLayout,
      reducedMotion,
    );
    hover.update();
    updateLabels();
    renderer.render(scene, camera);
  };

  resize();
  applyReducedMotion();
  window.addEventListener('resize', resize);
  reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
  renderer.setAnimationLoop(render);

  const cleanup = (): void => {
    window.removeEventListener('resize', resize);
    reducedMotionQuery.removeEventListener(
      'change',
      handleReducedMotionChange,
    );
    renderer.setAnimationLoop(null);
    clock.stop();
    hover.dispose();
    pipeline.reset();
    ambient.reset();

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
      }
    });
    nodes.forEach((node) => {
      node.semantic.inputRoutes.forEach((route) => route.material.dispose());
      node.semantic.branchPaths.forEach((route) => route.material.dispose());
      node.semantic.toolRoutes.forEach((route) => route.material.dispose());
      node.semantic.workspaceRoutes.forEach((route) => route.material.dispose());
      node.semantic.agentLinks.forEach((route) => route.material.dispose());
      node.semantic.branches.forEach((branch) => branch.material.dispose());
      node.semantic.toolPorts.forEach((port) => port.material.dispose());
      node.semantic.signals.forEach((signal) => signal.mesh.material.dispose());
      node.semantic.selectedRoute?.material.dispose();
      Object.values(node.materials).forEach((material) => material.dispose());
    });
    connectionSystem.connections.forEach((connection) => {
      connection.material.dispose();
      connection.energyRoute.material.dispose();
    });
    connectionSystem.pulse.material.dispose();
    connectionSystem.pulseShell.material.dispose();
    connectionSystem.pulseTrail.forEach((trail) => trail.material.dispose());
    environment.materials.forEach((material) => material.dispose());
    Object.values(nodeMaterials).forEach((material) => material.dispose());
    connectionMaterial.dispose();
    renderer.dispose();
    overlay.dispose();
    renderer.domElement.remove();
    container.classList.remove('is-compact-scene');
  };

  return {
    get progress(): number {
      return pipeline.progress;
    },
    setProgress(progress: number): void {
      scrollControlled = true;
      pipeline.setProgress(progress);
    },
    cleanup,
  };
}
