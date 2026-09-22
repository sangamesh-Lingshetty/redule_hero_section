import * as THREE from 'three';
import type {
  PipelineStage,
  PipelineStageId,
} from '../config/pipeline';
import type { NodeRuntime } from '../scene/createNode';

interface HoverInteractionOptions {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  nodes: ReadonlyMap<PipelineStageId, NodeRuntime>;
  stages: readonly PipelineStage[];
  onHoverChange(stageId: PipelineStageId | null): void;
}

export interface HoverInteraction {
  update(): void;
  dispose(): void;
}

const STATE_LABELS = {
  idle: 'STANDBY',
  active: 'PROCESSING',
  completed: 'ROUTE COMPLETE',
} as const;

export function createHoverInteraction({
  container,
  canvas,
  camera,
  nodes,
  stages,
  onHoverChange,
}: HoverInteractionOptions): HoverInteraction {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(2, 2);
  const pickables: THREE.Object3D[] = [];
  const pickVolumes: THREE.Mesh[] = [];
  const objectStageIds = new Map<THREE.Object3D, PipelineStageId>();
  const stagesById = new Map(stages.map((stage) => [stage.id, stage]));

  nodes.forEach((node) => {
    node.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        pickables.push(object);
        objectStageIds.set(object, node.id);
      }
    });

    const width = node.id === 'workflows' ? 1.78 : 1.52;
    const pickMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    });
    const pickVolume = new THREE.Mesh(
      new THREE.BoxGeometry(width, 1.12, 0.82),
      pickMaterial,
    );
    pickVolume.name = `${node.id}-hover-target`;
    node.root.add(pickVolume);
    pickables.push(pickVolume);
    pickVolumes.push(pickVolume);
    objectStageIds.set(pickVolume, node.id);
  });

  const tooltip = document.createElement('div');
  tooltip.className = 'node-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.setAttribute('aria-hidden', 'true');

  const eyebrow = document.createElement('span');
  eyebrow.className = 'node-tooltip-eyebrow';
  const title = document.createElement('strong');
  title.className = 'node-tooltip-title';
  const description = document.createElement('span');
  description.className = 'node-tooltip-description';
  const status = document.createElement('span');
  status.className = 'node-tooltip-status';
  tooltip.append(eyebrow, title, description, status);
  container.appendChild(tooltip);

  let hoveredId: PipelineStageId | null = null;
  let pointerClientX = 0;
  let pointerClientY = 0;

  const positionTooltip = (): void => {
    if (!hoveredId) return;

    const containerRect = container.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const localX = pointerClientX - containerRect.left;
    const localY = pointerClientY - containerRect.top;
    const offset = 18;
    const margin = 12;
    const preferredX = localX + offset;
    const left =
      localX > containerRect.width * 0.55 ||
      preferredX + tooltipRect.width > containerRect.width - margin
        ? localX - tooltipRect.width - offset
        : preferredX;
    const preferredTop = localY - tooltipRect.height - offset;
    const top = Math.min(
      preferredTop >= margin ? preferredTop : localY + offset,
      containerRect.height - tooltipRect.height - margin,
    );

    tooltip.style.left = `${Math.max(margin, left)}px`;
    tooltip.style.top = `${top}px`;
  };

  const setHovered = (stageId: PipelineStageId | null): void => {
    if (stageId === hoveredId) return;

    hoveredId = stageId;
    onHoverChange(stageId);
    canvas.classList.toggle('is-node-hovered', stageId !== null);

    if (!stageId) {
      tooltip.classList.remove('is-visible');
      tooltip.setAttribute('aria-hidden', 'true');
      return;
    }

    const stage = stagesById.get(stageId);
    if (!stage) return;
    const stageIndex = stages.findIndex((candidate) => candidate.id === stageId);
    eyebrow.textContent = `NODE ${String(stageIndex + 1).padStart(2, '0')}`;
    title.textContent = stage.label;
    description.textContent = stage.description;
    tooltip.classList.add('is-visible');
    tooltip.setAttribute('aria-hidden', 'false');
    positionTooltip();
  };

  const handlePointerMove = (event: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect();
    pointerClientX = event.clientX;
    pointerClientY = event.clientY;
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const intersection = raycaster.intersectObjects(pickables, false)[0];
    setHovered(
      intersection ? (objectStageIds.get(intersection.object) ?? null) : null,
    );
    positionTooltip();
  };

  const handlePointerLeave = (): void => {
    pointer.set(2, 2);
    setHovered(null);
  };

  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerleave', handlePointerLeave);

  return {
    update(): void {
      if (!hoveredId) return;
      const node = nodes.get(hoveredId);
      if (!node) return;
      status.textContent = STATE_LABELS[node.state];
      status.dataset.state = node.state;
    },
    dispose(): void {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      setHovered(null);
      pickVolumes.forEach((volume) => {
        volume.removeFromParent();
        volume.geometry.dispose();
        if (volume.material instanceof THREE.Material) {
          volume.material.dispose();
        }
      });
      tooltip.remove();
    },
  };
}
