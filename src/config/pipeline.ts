export type PipelineStageId =
  | 'workspace'
  | 'agents'
  | 'triggers'
  | 'events'
  | 'workflows'
  | 'tools'
  | 'outcomes';

export type PipelinePosition = readonly [x: number, y: number, z: number];

export interface PipelineStage {
  id: PipelineStageId;
  label: string;
  caption: string;
  description: string;
  position: PipelinePosition;
  mobilePosition: PipelinePosition;
  connectorClearance: number;
  scale?: number;
}

export interface PipelineProgressRange {
  id: PipelineStageId;
  start: number;
  end: number;
}

export const pipelineStages: readonly PipelineStage[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    caption: 'Business context',
    description: 'Tenant / business container',
    position: [-5.4, -1.08, 0.62],
    mobilePosition: [-0.9, 3.3, 0.8],
    connectorClearance: 0.82,
  },
  {
    id: 'agents',
    label: 'Agents',
    caption: 'Autonomous workers',
    description: 'Autonomous AI agents operating within the workspace',
    position: [-3.62, -0.72, 0.12],
    mobilePosition: [0.82, 2.2, -0.15],
    connectorClearance: 0.76,
  },
  {
    id: 'triggers',
    label: 'Triggers',
    caption: 'Webhook \u00b7 Cron \u00b7 Message',
    description: 'Webhooks \u00b7 Cron \u00b7 Inbound Messages',
    position: [-1.83, -0.36, -0.42],
    mobilePosition: [-0.82, 1.1, -0.8],
    connectorClearance: 0.82,
  },
  {
    id: 'events',
    label: 'Events',
    caption: 'Immutable event',
    description: 'Immutable event created from a trigger',
    position: [-0.05, 0, -0.12],
    mobilePosition: [0.82, 0, 0.15],
    connectorClearance: 0.76,
  },
  {
    id: 'workflows',
    label: 'Workflows',
    caption: 'Reason \u00b7 Branch \u00b7 Select',
    description: 'Reasoning and decision layer',
    position: [1.78, 0.36, 0.42],
    mobilePosition: [-0.82, -1.1, 0.85],
    connectorClearance: 0.92,
  },
  {
    id: 'tools',
    label: 'Tools',
    caption: 'CRM \u00b7 Message \u00b7 API \u00b7 Action',
    description: 'Authorized action execution',
    position: [3.62, 0.72, -0.02],
    mobilePosition: [0.82, -2.2, -0.35],
    connectorClearance: 0.8,
  },
  {
    id: 'outcomes',
    label: 'Outcomes',
    caption: 'Verified result',
    description: 'Verified confirmed result',
    position: [5.38, 1.08, 0.52],
    mobilePosition: [-0.12, -3.3, 0.65],
    connectorClearance: 0.72,
  },
] as const;

export const pipelineProgressRanges: readonly PipelineProgressRange[] = [
  { id: 'workspace', start: 0, end: 0.12 },
  { id: 'agents', start: 0.12, end: 0.27 },
  { id: 'triggers', start: 0.27, end: 0.39 },
  { id: 'events', start: 0.39, end: 0.52 },
  { id: 'workflows', start: 0.52, end: 0.7 },
  { id: 'tools', start: 0.7, end: 0.83 },
  { id: 'outcomes', start: 0.83, end: 0.93 },
] as const;

export const VERIFIED_PROGRESS_START = 0.93;
