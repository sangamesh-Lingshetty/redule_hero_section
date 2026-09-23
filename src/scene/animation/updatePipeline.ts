import * as THREE from 'three';
import {
  pipelineProgressRanges,
  VERIFIED_PROGRESS_START,
  type PipelineStageId,
} from '../../config/pipeline';
import type {
  ConnectionRuntime,
  ConnectionSystemRuntime,
  ConnectionVisualState,
} from '../createConnections';
import type {
  NodeRuntime,
  NodeVisualState,
  SemanticSignalRuntime,
} from '../createNode';

interface NodeVisualSnapshot {
  node: NodeRuntime;
  coreEmissive: THREE.Color;
  coreEmissiveIntensity: number;
  accentColor: THREE.Color;
  accentOpacity: number;
  edgeColor: THREE.Color;
  edgeOpacity: number;
  mutedEdgeColor: THREE.Color;
  mutedEdgeOpacity: number;
}

interface ConnectionVisualSnapshot {
  connection: ConnectionRuntime;
  color: THREE.Color;
  opacity: number;
}

export interface PipelineController {
  readonly progress: number;
  readonly autoplayEnabled: boolean;
  setProgress(progress: number): void;
  setAutoplayEnabled(enabled: boolean, elapsedTime?: number): void;
  setHovered(stageId: PipelineStageId | null): void;
  setReducedMotion(reduced: boolean): void;
  setCompact(compact: boolean): void;
  update(elapsedTime: number): void;
  reset(): void;
}

export const PIPELINE_AUTOPLAY_TIMING = {
  idlePause: 0.8,
  execution: 13.9,
  finalHold: 1.3,
  reset: 1.1,
} as const;

const COMPLETED_STRENGTH = 0.5;
const TERMINAL_ACTIVE_STRENGTH = 1.12;
const TERMINAL_COMPLETED_STRENGTH = 0.68;
const FIRST_ACTIVATION_END = 0.16;
const TRAIL_SPACING = 0.16;
const TRAVEL_STARTS: Record<PipelineStageId, number> = {
  workspace: 0.73,
  agents: 0.784,
  triggers: 0.73,
  events: 0.751,
  workflows: 0.82,
  tools: 0.751,
  outcomes: 1,
};

const ACTIVE_CORE_EMISSIVE = new THREE.Color(0x2ce8ff);
const ACTIVE_ACCENT = new THREE.Color(0x62e7f4);
const ACTIVE_EDGE = new THREE.Color(0x72e9f5);
const ACTIVE_MUTED_EDGE = new THREE.Color(0x45becd);
const PROCESSING_CONNECTION = new THREE.Color(0x63deeb);
const SEMANTIC_ROUTE_IDLE = new THREE.Color(0x2b8997);
const SEMANTIC_ROUTE_ACTIVE = new THREE.Color(0x7beaf5);
const WORKFLOW_TARGETS = [0.65, 0.75, 1] as const;
const SELECTED_WORKFLOW_INDEX = 2;
const SELECTED_TOOL_INDEX = 0;

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function smoothstep(start: number, end: number, value: number): number {
  const progress = clamp01((value - start) / Math.max(end - start, 0.0001));
  return progress * progress * (3 - 2 * progress);
}

function easeInOutCubic(value: number): number {
  const progress = clamp01(value);
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function mix(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function intervalProgress(
  value: number,
  start: number,
  end: number,
): number {
  return clamp01((value - start) / Math.max(end - start, 0.0001));
}

function intervalEnvelope(
  value: number,
  start: number,
  end: number,
): number {
  if (value <= start || value >= end) return 0;
  const progress = intervalProgress(value, start, end);
  return Math.sin(progress * Math.PI);
}

function captureNode(node: NodeRuntime): NodeVisualSnapshot {
  return {
    node,
    coreEmissive: node.materials.core.emissive.clone(),
    coreEmissiveIntensity: node.materials.core.emissiveIntensity,
    accentColor: node.materials.accent.color.clone(),
    accentOpacity: node.materials.accent.opacity,
    edgeColor: node.materials.edge.color.clone(),
    edgeOpacity: node.materials.edge.opacity,
    mutedEdgeColor: node.materials.edgeMuted.color.clone(),
    mutedEdgeOpacity: node.materials.edgeMuted.opacity,
  };
}

function captureConnection(
  connection: ConnectionRuntime,
): ConnectionVisualSnapshot {
  return {
    connection,
    color: connection.material.color.clone(),
    opacity: connection.material.opacity,
  };
}

function resetSignals(signals: readonly SemanticSignalRuntime[]): void {
  for (const signal of signals) {
    signal.path.getPoint(0, signal.mesh.position);
    signal.mesh.scale.setScalar(0.001);
    signal.mesh.material.opacity = 0;
  }
}

function setSignal(
  signal: SemanticSignalRuntime | undefined,
  progress: number,
  opacity: number,
  scale = 1,
): void {
  if (!signal) return;
  signal.path.getPoint(clamp01(progress), signal.mesh.position);
  signal.mesh.scale.setScalar(Math.max(0.001, scale));
  signal.mesh.material.opacity = clamp01(opacity);
}

function setSemanticRoute(
  material: THREE.LineBasicMaterial,
  strength: number,
  baseOpacity = 0.16,
): void {
  const active = clamp01(strength);
  material.color
    .copy(SEMANTIC_ROUTE_IDLE)
    .lerp(SEMANTIC_ROUTE_ACTIVE, active);
  material.opacity = Math.min(1, baseOpacity + active * 0.72);
}

function applyStageReaction(
  node: NodeRuntime,
  strength: number,
  phase: number,
  reducedMotion: boolean,
): void {
  const semantic = node.semantic;
  const motionScale = reducedMotion ? 0.45 : 1;
  resetSignals(semantic.signals);

  switch (node.id) {
    case 'workspace': {
      const starts = [0.04, 0.17, 0.3] as const;
      semantic.contextModules.forEach((module, index) => {
        const base = module.userData.basePosition as THREE.Vector3;
        const wake = smoothstep(starts[index], starts[index] + 0.14, phase);
        module.position.set(base.x, base.y + wake * strength * 0.025, base.z);
        module.scale.setScalar(1 + strength * wake * 0.18);

        const signalStart = starts[index] + 0.07;
        const signalEnd = signalStart + 0.2;
        const signalProgress = easeInOutCubic(
          intervalProgress(phase, signalStart, signalEnd),
        );
        const signalEnvelope = intervalEnvelope(
          phase,
          signalStart,
          signalEnd,
        );
        setSignal(
          semantic.signals[index],
          signalProgress,
          signalEnvelope * strength,
          0.75 + signalEnvelope * 0.45,
        );
        const joined = smoothstep(signalStart, signalEnd, phase);
        const routeStrength = Math.max(signalEnvelope, joined * 0.58) * strength;
        const route = semantic.workspaceRoutes[index];
        if (route) setSemanticRoute(route.material, routeStrength, 0.13);
      });

      const packet = semantic.packets[0];
      if (packet) {
        const formation = smoothstep(0.5, 0.63, phase);
        const release = smoothstep(0.63, 0.72, phase);
        packet.scale.setScalar(
          Math.max(0.001, formation * (1 - release) * strength),
        );
        packet.position.set(
          mix(0.47, 0.9, release * motionScale),
          -0.08,
          0.02,
        );
      }
      semantic.ports[0]?.scale.setScalar(
        1 + strength * smoothstep(0.48, 0.68, phase) * 0.24,
      );
      break;
    }
    case 'agents': {
      let linkStrength = 0;
      semantic.workers.forEach((worker, index) => {
        const base = worker.userData.basePosition as THREE.Vector3;
        const signalStart = 0.15 + index * 0.11;
        const signalEnd = signalStart + 0.32;
        const local = intervalProgress(phase, signalStart, signalEnd);
        const response = intervalEnvelope(phase, signalStart, signalEnd);
        const outAndBack =
          local < 0.5
            ? easeInOutCubic(local * 2)
            : 1 - easeInOutCubic((local - 0.5) * 2);
        const settled = smoothstep(signalEnd - 0.04, signalEnd + 0.08, phase);
        worker.position.set(
          mix(base.x, base.x * 0.86, response * motionScale),
          mix(base.y, base.y * 0.86, response * motionScale),
          base.z,
        );
        worker.scale.setScalar(
          1 + strength * (response * 0.3 + settled * 0.08),
        );
        setSignal(
          semantic.signals[index],
          outAndBack,
          response * strength,
          0.78 + response * 0.5,
        );
        linkStrength = Math.max(linkStrength, response, settled * 0.48);
      });
      semantic.agentLinks.forEach((links) => {
        setSemanticRoute(links.material, linkStrength * strength, 0.15);
      });

      const packet = semantic.packets[0];
      if (packet) {
        const formation = smoothstep(0.63, 0.72, phase);
        const release = smoothstep(0.72, 0.78, phase);
        packet.scale.setScalar(
          Math.max(0.001, formation * (1 - release) * strength),
        );
        packet.position.set(mix(0, 0.78, release * motionScale), 0, 0.08);
      }
      break;
    }
    case 'triggers': {
      const inboundProgress = easeInOutCubic(
        intervalProgress(phase, 0.06, 0.38),
      );
      const inboundEnvelope = intervalEnvelope(phase, 0.06, 0.43);
      const gateResponse = smoothstep(0.3, 0.5, phase);
      semantic.inputs.forEach((input, index) => {
        input.scale.setScalar(
          1 + strength * (index === 0 ? inboundEnvelope * 0.3 : 0),
        );
      });
      semantic.inputRoutes.forEach((route, index) => {
        setSemanticRoute(
          route.material,
          index === 0 ? Math.max(inboundEnvelope, gateResponse * 0.7) * strength : 0,
        );
      });
      setSignal(
        semantic.signals[0],
        inboundProgress,
        inboundEnvelope * strength,
        0.82 + inboundEnvelope * 0.5,
      );

      const inbound = semantic.packets[0];
      if (inbound) inbound.scale.setScalar(0.001);
      const outbound = semantic.packets[1];
      if (outbound) {
        const formation = smoothstep(0.54, 0.65, phase);
        const release = smoothstep(0.65, 0.72, phase);
        outbound.scale.setScalar(
          Math.max(0.001, strength * formation * (1 - release)),
        );
        outbound.position.x = mix(0.46, 0.84, release * motionScale);
      }
      break;
    }
    case 'events': {
      const record = smoothstep(0.16, 0.46, phase);
      node.core.scale.setScalar(0.82 + record * 0.18 + strength * 0.025);
      semantic.eventRecordLines.forEach((line, index) => {
        const lineReveal = smoothstep(
          0.17 + index * 0.075,
          0.31 + index * 0.075,
          phase,
        );
        line.scale.set(Math.max(0.1, lineReveal), 1, 1);
      });
      const lock = smoothstep(0.4, 0.65, phase);
      semantic.locks.forEach((binding) => {
        const baseY = binding.userData.baseY as number;
        binding.position.y = mix(baseY, Math.sign(baseY) * 0.31, lock);
        binding.scale.set(1 + lock * 0.05, 1, 1 + lock * 0.05);
      });

      const inbound = semantic.packets[0];
      if (inbound) {
        const arrival = smoothstep(0.04, 0.3, phase);
        const absorbed = smoothstep(0.27, 0.42, phase);
        inbound.scale.setScalar(
          Math.max(0.001, strength * arrival * (1 - absorbed)),
        );
        inbound.position.x = mix(-0.68, -0.2, arrival * motionScale);
      }
      const outbound = semantic.packets[1];
      if (outbound) {
        const formation = smoothstep(0.65, 0.71, phase);
        const release = smoothstep(0.71, 0.75, phase);
        outbound.scale.setScalar(
          Math.max(0.001, strength * formation * (1 - release)),
        );
        outbound.position.x = mix(0.53, 0.82, release * motionScale);
      }
      break;
    }
    case 'workflows': {
      const evaluation = smoothstep(0.1, 0.43, phase);
      const selection = smoothstep(0.5, 0.67, phase);
      semantic.branches.forEach((branch, index) => {
        const selected = index === SELECTED_WORKFLOW_INDEX;
        const rejected = selected ? 0 : selection;
        const retained = selected ? 1 : 1 - rejected * 0.88;
        const branchStrength = evaluation * retained + (selected ? selection * 0.5 : 0);
        branch.scale.setScalar(
          1 + strength * branchStrength * (selected ? 0.31 : 0.2) - rejected * 0.12,
        );
        branch.material.color
          .copy(SEMANTIC_ROUTE_IDLE)
          .lerp(SEMANTIC_ROUTE_ACTIVE, clamp01(branchStrength * strength));
        branch.material.opacity = Math.min(1, 0.24 + branchStrength * strength * 0.72);
      });
      semantic.branchPaths.forEach((path, index) => {
        const selected = index === SELECTED_WORKFLOW_INDEX;
        const retained = selected ? 1 : 1 - selection * 0.88;
        const pathStrength = evaluation * retained + (selected ? selection * 0.58 : 0);
        setSemanticRoute(path.material, pathStrength * strength, 0.14);
      });

      for (let index = 0; index < 3; index += 1) {
        const rejectedFade =
          index === SELECTED_WORKFLOW_INDEX ? 1 : 1 - selection;
        const evaluated = smoothstep(0.08 + index * 0.025, 0.16 + index * 0.025, phase);
        const progress = WORKFLOW_TARGETS[index] * evaluation;
        const hold = 1 - smoothstep(0.66, 0.76, phase);
        setSignal(
          semantic.signals[index],
          progress,
          evaluated * rejectedFade * hold * strength,
          0.82 + (index === SELECTED_WORKFLOW_INDEX ? selection * 0.48 : 0.2),
        );
      }

      if (semantic.selectedRoute) {
        semantic.selectedRoute.material.opacity = selection * strength * 0.9;
      }
      const resolutionProgress = easeInOutCubic(
        intervalProgress(phase, 0.62, 0.78),
      );
      const resolutionEnvelope = intervalEnvelope(phase, 0.6, 0.8);
      setSignal(
        semantic.signals[3],
        resolutionProgress,
        resolutionEnvelope * strength,
        0.9 + resolutionEnvelope * 0.48,
      );

      const packet = semantic.packets[0];
      if (packet) {
        const formation = smoothstep(0.7, 0.78, phase);
        const release = smoothstep(0.78, 0.82, phase);
        packet.scale.setScalar(
          Math.max(0.001, strength * formation * (1 - release)),
        );
        packet.position.x = mix(0.55, 0.9, release * motionScale);
      }
      break;
    }
    case 'tools': {
      const authorization = smoothstep(0.08, 0.24, phase);
      const probeProgress = easeInOutCubic(
        intervalProgress(phase, 0.18, 0.42),
      );
      const selection = smoothstep(0.4, 0.58, phase);
      const executionProgress = easeInOutCubic(
        intervalProgress(phase, 0.4, 0.57),
      );
      const executionEnvelope = intervalEnvelope(phase, 0.38, 0.6);
      const returnProgress = easeInOutCubic(
        intervalProgress(phase, 0.56, 0.71),
      );
      semantic.toolPorts.forEach((port, index) => {
        const selected = index === SELECTED_TOOL_INDEX;
        const probe = intervalEnvelope(phase, 0.16 + index * 0.015, 0.46);
        const portStrength =
          authorization * 0.18 +
          probe * 0.35 +
          (selected ? Math.max(selection * 0.78, executionEnvelope) : 0);
        port.scale.setScalar(1 + strength * portStrength * (selected ? 0.42 : 0.18));
        port.material.color
          .copy(SEMANTIC_ROUTE_IDLE)
          .lerp(SEMANTIC_ROUTE_ACTIVE, clamp01(portStrength * strength));
        port.material.opacity = Math.min(1, 0.25 + portStrength * strength * 0.74);
      });
      semantic.toolRoutes.forEach((route, index) => {
        const selected = index === SELECTED_TOOL_INDEX;
        const probe = intervalEnvelope(phase, 0.16 + index * 0.015, 0.46);
        const routeStrength =
          probe * 0.55 +
          (selected ? Math.max(selection * 0.75, executionEnvelope) : 0);
        setSemanticRoute(route.material, routeStrength * strength, 0.14);
      });

      for (let index = 0; index < semantic.signals.length; index += 1) {
        const selected = index === SELECTED_TOOL_INDEX;
        const probeEnvelope = intervalEnvelope(
          phase,
          0.16 + index * 0.015,
          0.46,
        );
        const returning = selected && phase >= 0.56;
        const executing = selected && phase >= 0.38;
        setSignal(
          semantic.signals[index],
          returning
            ? 1 - returnProgress
            : executing
              ? executionProgress
              : probeProgress,
          (returning
            ? intervalEnvelope(phase, 0.54, 0.73)
            : executing
              ? executionEnvelope
              : probeEnvelope * (selected ? 1 : 1 - selection)) * strength,
          selected ? 1.08 : 0.82,
        );
      }

      const packet = semantic.packets[0];
      if (packet) packet.scale.setScalar(0.001);
      break;
    }
    case 'outcomes': {
      const verification = smoothstep(0.1, 0.86, phase);
      node.core.scale.setScalar(0.84 + verification * 0.16 + strength * 0.035);
      semantic.verification.forEach((segment, index) => {
        const reveal = smoothstep(
          0.13 + index * 0.085,
          0.24 + index * 0.085,
          phase,
        );
        segment.scale.setScalar(0.08 + reveal * 0.92);
      });
      const checkReveal = smoothstep(0.82, 0.96, phase);
      semantic.check?.scale.setScalar(Math.max(0.001, checkReveal));
      const flash = intervalEnvelope(phase, 0.84, 0.99);
      node.materials.core.emissiveIntensity *= 1 + flash * 0.34;
      break;
    }
  }
}

function applyNodeVisual(
  snapshot: NodeVisualSnapshot,
  state: NodeVisualState,
  strength: number,
  phase: number,
  reducedMotion: boolean,
): void {
  const { node } = snapshot;
  const activeRamp =
    state === 'active' ? 0.4 + smoothstep(0, 0.2, phase) * 0.6 : 1;
  const energy = strength * activeRamp;
  const colorMix = clamp01(energy);

  node.state = state;
  node.phase = phase;
  node.materials.core.emissive.lerpColors(
    snapshot.coreEmissive,
    ACTIVE_CORE_EMISSIVE,
    colorMix * 0.56,
  );
  node.materials.core.emissiveIntensity =
    snapshot.coreEmissiveIntensity * (1 + energy * 2.65);
  node.materials.accent.color.lerpColors(
    snapshot.accentColor,
    ACTIVE_ACCENT,
    colorMix * 0.86,
  );
  node.materials.accent.opacity = Math.min(
    1,
    snapshot.accentOpacity + energy * 0.46,
  );
  node.materials.edge.color.lerpColors(
    snapshot.edgeColor,
    ACTIVE_EDGE,
    colorMix * 0.84,
  );
  node.materials.edge.opacity = Math.min(
    1,
    snapshot.edgeOpacity + energy * 0.38,
  );
  node.materials.edgeMuted.color.lerpColors(
    snapshot.mutedEdgeColor,
    ACTIVE_MUTED_EDGE,
    colorMix * 0.76,
  );
  node.materials.edgeMuted.opacity = Math.min(
    1,
    snapshot.mutedEdgeOpacity + energy * 0.34,
  );

  const activeScale = state === 'active' ? 1 + clamp01(energy) * 0.035 : 1;
  node.root.scale.set(
    node.baseScale.x * activeScale,
    node.baseScale.y * activeScale,
    node.baseScale.z * activeScale,
  );
  node.core.scale.multiplyScalar(1 + energy * 0.042);
  applyStageReaction(node, energy, phase, reducedMotion);
}

function applyConnectionVisual(
  snapshot: ConnectionVisualSnapshot,
  state: ConnectionVisualState,
  strength: number,
): void {
  const { connection } = snapshot;
  const isProcessing = state === 'processing';
  connection.state = state;
  connection.material.color.lerpColors(
    snapshot.color,
    PROCESSING_CONNECTION,
    clamp01(strength) * (isProcessing ? 0.95 : 0.72),
  );
  connection.material.opacity = Math.min(
    1,
    snapshot.opacity + strength * (isProcessing ? 0.46 : 0.34),
  );
}

export function createPipelineController(
  nodes: ReadonlyMap<PipelineStageId, NodeRuntime>,
  connectionSystem: ConnectionSystemRuntime,
  orderedIds: readonly PipelineStageId[],
): PipelineController {
  const nodeVisuals = orderedIds.map((id) => {
    const node = nodes.get(id);
    if (!node) throw new Error(`Missing runtime node: ${id}`);
    return captureNode(node);
  });
  const connectionVisuals = connectionSystem.connections.map(captureConnection);
  const nodeStrengths = new Float32Array(nodeVisuals.length);
  const nodePhases = new Float32Array(nodeVisuals.length);
  const connectionStrengths = new Float32Array(connectionVisuals.length);
  const nodeStates: NodeVisualState[] = nodeVisuals.map(() => 'idle');
  const connectionStates: ConnectionVisualState[] = connectionVisuals.map(
    () => 'base',
  );
  const pulse = connectionSystem.pulse;
  const pulseShell = connectionSystem.pulseShell;
  const pulseTrail = connectionSystem.pulseTrail;
  const trailPoint = new THREE.Vector3();
  const totalCycleDuration =
    PIPELINE_AUTOPLAY_TIMING.idlePause +
    PIPELINE_AUTOPLAY_TIMING.execution +
    PIPELINE_AUTOPLAY_TIMING.finalHold +
    PIPELINE_AUTOPLAY_TIMING.reset;
  let currentProgress = 0;
  let currentTime = 0;
  let autoplayEnabled = true;
  let autoplayStartTime = 0;
  let hoveredId: PipelineStageId | null = null;
  let reducedMotion = false;
  let compact = false;

  const hidePulse = (): void => {
    pulse.visible = false;
    pulseShell.visible = false;
    pulse.material.opacity = 0;
    pulseShell.material.opacity = 0;
    for (const trail of pulseTrail) {
      trail.visible = false;
      trail.material.opacity = 0;
    }
  };

  const resetConnectionWaves = (): void => {
    for (const visual of connectionVisuals) {
      const uniforms = visual.connection.energyUniforms;
      uniforms.uProgress.value = 0;
      uniforms.uIntensity.value = 0;
      uniforms.uOpacity.value = 1;
      uniforms.uReverse.value = 0;
      uniforms.uTailLength.value = compact ? 0.12 : 0.18;
    }
    hidePulse();
  };

  const placePulse = (
    connection: ConnectionRuntime,
    progress: number,
    intensity: number,
    reverse: boolean,
  ): void => {
    const travel = clamp01(progress);
    const curveProgress = reverse ? 1 - travel : travel;
    const edgeEnvelope =
      smoothstep(0, 0.055, travel) * (1 - smoothstep(0.985, 1, travel) * 0.45);
    const visibleIntensity = intensity * edgeEnvelope;
    connection.curve.getPoint(curveProgress, pulse.position);
    pulseShell.position.copy(pulse.position);
    pulse.visible = visibleIntensity > 0.001;
    pulseShell.visible = pulse.visible && !reducedMotion;
    const pulseBeat = 0.94 + Math.sin(currentTime * 4.1) * 0.06;
    pulse.scale.setScalar((0.94 + Math.sin(travel * Math.PI) * 0.32) * pulseBeat);
    pulseShell.scale.setScalar(0.94 + Math.sin(travel * Math.PI) * 0.26);
    pulse.material.opacity = visibleIntensity;
    pulseShell.material.opacity = visibleIntensity * 0.58;

    const visibleTrailCount = compact ? 3 : pulseTrail.length;
    for (let index = 0; index < pulseTrail.length; index += 1) {
      const trail = pulseTrail[index];
      const sample = Math.max(0, travel - (index + 1) * TRAIL_SPACING);
      const sampleOnCurve = reverse ? 1 - sample : sample;
      connection.curve.getPoint(sampleOnCurve, trailPoint);
      trail.position.copy(trailPoint);
      trail.visible =
        !reducedMotion && index < visibleTrailCount && visibleIntensity > 0.001;
      const falloff = Math.pow(1 - (index + 1) / (pulseTrail.length + 1), 1.5);
      trail.scale.setScalar(0.92 * falloff);
      trail.material.opacity = visibleIntensity * falloff * 0.62;
    }
  };

  const setConnectionWave = (
    connectionIndex: number,
    progress: number,
    intensity: number,
    reverse = false,
  ): void => {
    const connection = connectionVisuals[connectionIndex]?.connection;
    if (!connection) return;
    const easedProgress = easeInOutCubic(progress);
    connection.energyUniforms.uProgress.value = easedProgress;
    connection.energyUniforms.uIntensity.value = intensity;
    connection.energyUniforms.uOpacity.value = 1;
    connection.energyUniforms.uReverse.value = reverse ? 1 : 0;
    connection.energyUniforms.uTailLength.value = compact ? 0.12 : 0.18;
    placePulse(connection, easedProgress, intensity, reverse);
  };

  const applyVisuals = (resetMix = 0): void => {
    const retained = 1 - smoothstep(0, 1, resetMix);
    for (let index = 0; index < nodeVisuals.length; index += 1) {
      const pipelineStrength = nodeStrengths[index] * retained;
      const hoverStrength = nodeVisuals[index].node.id === hoveredId ? 0.18 : 0;
      const strength = Math.max(pipelineStrength, hoverStrength);
      applyNodeVisual(
        nodeVisuals[index],
        pipelineStrength > 0.001 ? nodeStates[index] : 'idle',
        strength,
        nodePhases[index],
        reducedMotion,
      );
    }

    for (let index = 0; index < connectionVisuals.length; index += 1) {
      const strength = connectionStrengths[index] * retained;
      applyConnectionVisual(
        connectionVisuals[index],
        strength > 0.001 ? connectionStates[index] : 'base',
        strength,
      );
    }

    if (resetMix > 0) {
      pulse.material.opacity *= retained;
      pulseShell.material.opacity *= retained;
      for (const trail of pulseTrail) trail.material.opacity *= retained;
      for (const visual of connectionVisuals) {
        visual.connection.energyUniforms.uIntensity.value *= retained;
      }
    }
  };

  const setIdleVisuals = (): void => {
    nodeStrengths.fill(0);
    nodePhases.fill(0);
    connectionStrengths.fill(0);
    nodeStates.fill('idle');
    connectionStates.fill('base');
    resetConnectionWaves();
    applyVisuals();
  };

  const renderProgress = (progress: number, resetMix = 0): void => {
    currentProgress = clamp01(progress);
    nodeStrengths.fill(0);
    nodePhases.fill(0);
    connectionStrengths.fill(0);
    nodeStates.fill('idle');
    connectionStates.fill('base');
    resetConnectionWaves();

    const connectionCount = connectionVisuals.length;
    const outcomeIndex = nodeVisuals.length - 1;

    if (currentProgress >= VERIFIED_PROGRESS_START) {
      for (let index = 0; index < nodeVisuals.length; index += 1) {
        nodeStates[index] = 'completed';
        nodeStrengths[index] =
          index === outcomeIndex
            ? TERMINAL_COMPLETED_STRENGTH
            : COMPLETED_STRENGTH;
        nodePhases[index] = 1;
      }
      for (let index = 0; index < connectionCount; index += 1) {
        connectionStates[index] = 'completed';
        connectionStrengths[index] = COMPLETED_STRENGTH;
      }
      applyVisuals(resetMix);
      return;
    }

    let segmentIndex = pipelineProgressRanges.length - 1;
    for (let index = 0; index < pipelineProgressRanges.length; index += 1) {
      if (currentProgress < pipelineProgressRanges[index].end) {
        segmentIndex = index;
        break;
      }
    }
    const range = pipelineProgressRanges[segmentIndex];
    const segmentProgress = intervalProgress(
      currentProgress,
      range.start,
      range.end,
    );

    for (let index = 0; index < segmentIndex; index += 1) {
      nodeStates[index] = 'completed';
      nodeStrengths[index] = COMPLETED_STRENGTH;
      nodePhases[index] = 1;
      if (index < connectionCount) {
        connectionStates[index] = 'completed';
        connectionStrengths[index] = COMPLETED_STRENGTH;
      }
    }

    if (segmentIndex < connectionCount) {
      const sourceIndex = segmentIndex;
      const travelStart = TRAVEL_STARTS[range.id];
      const sourceActivation =
        sourceIndex === 0
          ? smoothstep(0, FIRST_ACTIVATION_END, segmentProgress)
          : 1;
      nodeStates[sourceIndex] = 'active';
      nodeStrengths[sourceIndex] = sourceActivation;
      nodePhases[sourceIndex] = segmentProgress;
      if (segmentProgress >= travelStart) {
        const travel = intervalProgress(segmentProgress, travelStart, 1);
        connectionStates[sourceIndex] = 'processing';
        connectionStrengths[sourceIndex] = smoothstep(
          travelStart,
          Math.min(travelStart + 0.1, 1),
          segmentProgress,
        );
        setConnectionWave(sourceIndex, travel, 1);
      }
    } else {
      for (let index = 0; index < connectionCount; index += 1) {
        connectionStates[index] = 'completed';
        connectionStrengths[index] = COMPLETED_STRENGTH;
      }
      nodeStates[outcomeIndex] = 'active';
      nodeStrengths[outcomeIndex] = TERMINAL_ACTIVE_STRENGTH;
      nodePhases[outcomeIndex] = segmentProgress;
    }

    applyVisuals(resetMix);
  };

  const update = (elapsedTime: number): void => {
    currentTime = reducedMotion ? 0 : elapsedTime;
    if (!autoplayEnabled) {
      renderProgress(currentProgress);
      return;
    }

    const cycleTime =
      (elapsedTime - autoplayStartTime + totalCycleDuration) %
      totalCycleDuration;
    const executionStart = PIPELINE_AUTOPLAY_TIMING.idlePause;
    const finalHoldStart =
      executionStart + PIPELINE_AUTOPLAY_TIMING.execution;
    const resetStart = finalHoldStart + PIPELINE_AUTOPLAY_TIMING.finalHold;

    if (cycleTime < executionStart) {
      currentProgress = 0;
      setIdleVisuals();
    } else if (cycleTime < finalHoldStart) {
      renderProgress(
        (cycleTime - executionStart) / PIPELINE_AUTOPLAY_TIMING.execution,
      );
    } else if (cycleTime < resetStart) {
      renderProgress(1);
    } else {
      renderProgress(
        1,
        (cycleTime - resetStart) / PIPELINE_AUTOPLAY_TIMING.reset,
      );
    }
  };

  const reset = (): void => {
    currentProgress = 0;
    setIdleVisuals();
  };

  return {
    get progress(): number {
      return currentProgress;
    },
    get autoplayEnabled(): boolean {
      return autoplayEnabled;
    },
    setProgress(progress: number): void {
      autoplayEnabled = false;
      renderProgress(progress);
    },
    setAutoplayEnabled(enabled: boolean, elapsedTime = 0): void {
      autoplayEnabled = enabled;
      autoplayStartTime = elapsedTime;
      if (!enabled) setIdleVisuals();
    },
    setHovered(stageId: PipelineStageId | null): void {
      hoveredId = stageId;
    },
    setReducedMotion(reduced: boolean): void {
      reducedMotion = reduced;
      if (reduced) {
        for (const trail of pulseTrail) trail.visible = false;
      }
    },
    setCompact(nextCompact: boolean): void {
      compact = nextCompact;
    },
    update,
    reset,
  };
}
