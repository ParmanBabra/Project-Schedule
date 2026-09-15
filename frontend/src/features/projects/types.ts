/** Types mirroring the backend models (backend/app/core/models.py + scheduling/schemas.py). */

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'
export type BufferMethod = 'ccpm' | 'percent' | 'pert'
export type RiskLevel = 'low' | 'medium' | 'high'

export interface Constraint {
  type: 'SNET'
  date: string
}

export interface Estimate {
  o: number
  m: number
  p: number
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

/** A row of the "create task chain" dialog (TSK-9); remembered per project. */
export interface ChainStep {
  name: string
  duration: number
  enabled: boolean
  parallel: boolean
}

export interface EpicInfo {
  color: string
  description: string
  ownerResourceId: string | null
}

export interface Task {
  id: string
  name: string
  duration: number
  progress: number
  isMilestone: boolean
  constraint: Constraint | null
  color: string | null
  parentId: string | null
  collapsed: boolean
  order: number
  estimate: Estimate | null
  checklist: ChecklistItem[]
  progressFromChecklist: boolean
  epic: EpicInfo | null
}

export interface Dependency {
  id: string
  from: string
  to: string
  type: DependencyType
  lag: number
}

export interface Assignment {
  id: string
  taskId: string
  resourceId: string
  units: number
}

export interface BufferSettings {
  method: BufferMethod
  ccpmRatio: number
  riskLevel: RiskLevel
  percent: number | null
  pertConfidence: 84 | 98
  days: number | null
  managementReservePercent: number
}

export interface Rules {
  nearCriticalFloatDays: number
  progressRollup: 'duration' | 'count' | 'effort'
  lateDetection: 'linear' | 'baseline' | 'overdue'
  overallocationThreshold: number
  lagUnit: 'working' | 'calendar'
  defaultDependency: { type: DependencyType; lag: number }
  schedulingMode: 'auto' | 'manual'
  bufferZones: { yellow: number; red: number }
}

export type TaskHealth = 'done' | 'late' | 'on_track' | 'not_started'

export interface Baseline {
  savedAt: string
  plannedEnd: string
  chainDays: number
  bufferDays: number
  tasks: Record<string, { start: string; end: string }>
}

export interface TaskSchedule {
  id: string
  wbs: string
  isSummary: boolean
  isMilestone: boolean
  duration: number
  start: string
  end: string
  earlyStart: string
  earlyFinish: string
  lateStart: string
  lateFinish: string
  es: number
  ef: number
  ls: number
  lf: number
  totalFloat: number
  freeFloat: number
  isCritical: boolean
  isNearCritical: boolean
  progress: number
  depth: number
  health: TaskHealth
  expectedProgress: number
}

export interface BufferResult {
  method: BufferMethod
  chainDays: number
  days: number
  start: string | null
  end: string | null
  committedEnd: string | null
  managementReserveDays: number
  managementReserveEnd: string | null
  percentUsed: number | null
  note: string | null
  consumedPercent: number | null
  status: 'green' | 'yellow' | 'red' | null
  chainProgress: number
  consumedDays: number | null
  aheadDays: number
  paddingWarning: boolean
  paddingNote: string | null
}

export interface ScheduleSummary {
  taskCount: number
  criticalCount: number
  nearCriticalCount: number
  progress: number
  chainDays: number
  plannedEnd: string | null
  committedEnd: string | null
  lateCount: number
  baselinePlannedEnd: string | null
}

export interface Schedule {
  tasks: Record<string, TaskSchedule>
  criticalPath: string[]
  summary: ScheduleSummary
  buffer: BufferResult
}

export interface Project {
  id: string
  name: string
  startDate: string
  holidays: string[]
  workingDays: number[]
  tasks: Task[]
  dependencies: Dependency[]
  assignments: Assignment[]
  buffer: BufferSettings
  rules: Rules
  baseline: Baseline | null
  chainTemplates: ChainStep[] | null
  createdAt: string
  updatedAt: string
}

export interface ProjectOut extends Project {
  schedule: Schedule
}

export interface ProjectListItem {
  id: string
  name: string
  startDate: string
  plannedEnd: string | null
  committedEnd: string | null
  progress: number
  taskCount: number
  criticalCount: number
  updatedAt: string
}

export interface ProjectCreate {
  name: string
  startDate: string
  workingDays?: number[]
  holidays?: string[]
}

export interface ProjectUpdate {
  name?: string
  startDate?: string
  workingDays?: number[]
  holidays?: string[]
}

export interface TaskCreate {
  name: string
  duration?: number
  progress?: number
  isMilestone?: boolean
  parentId?: string | null
  constraint?: Constraint | null
  color?: string | null
  estimate?: Estimate | null
  afterId?: string | null
}

export interface TaskUpdate {
  name?: string
  duration?: number
  progress?: number
  isMilestone?: boolean
  constraint?: Constraint | null
  clearConstraint?: boolean
  color?: string | null
  collapsed?: boolean
  estimate?: Estimate | null
  clearEstimate?: boolean
  checklist?: Array<{ id?: string; text: string; done: boolean }>
  progressFromChecklist?: boolean
  epic?: EpicInfo
  clearEpic?: boolean
}

export interface EpicTaskIn {
  name: string
  duration?: number
  checklist?: string[]
}

export interface EpicCreate {
  name: string
  color?: string
  description?: string
  ownerResourceId?: string | null
  tasks?: EpicTaskIn[]
  existingTaskIds?: string[]
  sequential?: boolean
  position?: 'end' | 'after'
  afterTaskId?: string | null
  parentId?: string | null
}

export interface EpicBulkCreate {
  epics: EpicCreate[]
  linkEpics?: boolean
}

export interface EpicUpdate {
  name?: string
  color?: string
  description?: string
  ownerResourceId?: string | null
  clearOwner?: boolean
}

export interface ChainBody {
  steps: ChainStep[]
  prefixWithSource: boolean
  groupName: string | null
  copyAssignees: boolean
  remember: boolean
}

export interface DependencyCreate {
  from: string
  to: string
  type?: DependencyType
  lag?: number
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown }
}

// ------------------------------------------------------------ resources

export type ResourceType = 'person' | 'equipment'

export interface Resource {
  id: string
  name: string
  type: ResourceType
  capacityPerDay: number
  color: string
  daysOff: string[]
}

export interface ResourceOut extends Resource {
  assignmentCount: number
  projectCount: number
}

export interface ResourceCreate {
  name: string
  type?: ResourceType
  capacityPerDay?: number
  color?: string | null
  daysOff?: string[]
}

export type ResourceUpdate = Partial<Omit<Resource, 'id'>>

export interface WorkloadItem {
  projectId: string
  projectName: string
  taskId: string
  taskName: string
  units: number
}

export interface WorkloadDay {
  date: string
  load: number
  capacity: number
  over: boolean
  off: boolean
  items: WorkloadItem[]
}

export interface ResourceWorkload {
  resource: Resource
  days: WorkloadDay[]
  peak: number
  overDays: number
}

export interface Overallocation {
  resourceId: string
  resourceName: string
  date: string
  load: number
  capacity: number
  items: WorkloadItem[]
}

export interface WorkloadResponse {
  from: string
  to: string
  threshold: number
  resources: ResourceWorkload[]
  overallocations: Overallocation[]
}
