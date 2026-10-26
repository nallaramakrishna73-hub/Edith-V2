export interface HealthResponse {
  status: 'ok' | 'degraded';
  components?: {
    stt: string;
    tts: string;
    llm: string;
    search: string;
    database: string;
  };
}

export interface StatusResponse {
  app: string;
  version: string;
  target?: string;
  environment: string;
  backend: {
    status: 'connected' | 'disconnected';
  };
  database: {
    status: 'connected' | 'error';
  };
  ai: {
    status: 'ready' | 'unavailable' | 'not_configured';
    provider: string;
    model: string;
  };
  voice?: {
    mic_enabled: boolean;
    wake_word_enabled: boolean;
    tts_enabled: boolean;
  };
  search?: {
    status: string;
  };
}

export interface SystemStats {
  cpu_percent: number;
  ram_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
  disk_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  network_status: string;
  uptime_hours: number;
  platform: string;
  top_processes: Array<{
    pid: number;
    name: string;
    cpu_percent: number;
    mem_percent: number;
  }>;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

export interface PendingAction {
  id: string;
  tool: string;
  args_json: string;
  impact_text: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  expires_at: string;
}

export interface AuditLogItem {
  id: string;
  ts: string;
  actor: string;
  event: string;
  details_json: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface MessageItem {
  id: number;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'voice' | 'text';
  created_at: string;
}

export interface ConversationDetail {
  conversation: {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
  };
  messages: MessageItem[];
}

export interface ChatResponse {
  conversation_id: string;
  reply: string;
  toolCall?: {
    tool: string;
    args: Record<string, unknown>;
    result?: Record<string, unknown>;
    status: 'EXECUTED' | 'REQUIRES_CONFIRMATION' | 'BLOCKED';
  };
  pendingAction?: PendingAction;
  sources?: SearchResultItem[];
  status: 'success';
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiErrorPayload {
  status: 'error';
  error: ApiError;
}

export interface OSTask {
  id: string;
  name: string;
  category: 'RECON' | 'SYSTEM' | 'CODE' | 'ANALYSIS' | 'WORKFLOW' | 'AUTOMATION';
  description: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  pid: number;
  cpu: number;
  memoryMb: number;
  logs: string[];
  result?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface WorkspaceFile {
  name: string;
  size_bytes: number;
  updated_at: string;
  is_dir: boolean;
}

export interface OSOverview {
  os: {
    name: string;
    version: string;
    kernel: string;
    uptime: number;
    platform: string;
  };
  agent: {
    name: string;
    status: 'ready' | 'unavailable' | 'not_configured';
    model: string;
    provider: string;
  };
  telemetry: SystemStats;
  tasks: {
    total: number;
    running: number;
    items: OSTask[];
  };
  pending_permissions: PendingAction[];
  recent_audit: AuditLogItem[];
  settings: Record<string, unknown>;
  database: 'connected' | 'degraded';
}

export interface KaliAgentInfo {
  agentId: string;
  hostname: string;
  osRelease: string;
  kernel: string;
  ipAddress: string;
  installedTools: string[];
  lastHeartbeat: number;
  status: 'ONLINE' | 'OFFLINE';
}

export interface KaliCommandJob {
  id: string;
  command: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  output: string;
  exitCode?: number;
  createdAt: number;
  completedAt?: number;
}

export interface KaliStatusResponse {
  agent: KaliAgentInfo | null;
  isConnected: boolean;
  queueLength: number;
}

export interface FirebaseInfo {
  configured: boolean;
  projectId?: string;
  region?: string;
  databaseId?: string;
  authDomain?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived' | 'completed';
  created_at: string;
  updated_at: string;
}

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'waiting_for_approval'
  | 'completed'
  | 'failed'
  | 'interrupted';

export interface TaskStep {
  id: string;
  task_id: string;
  step_number: number;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  output: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface TaskCheckpoint {
  id: string;
  task_id: string;
  checkpoint_name: string;
  state_data: Record<string, unknown>;
  created_at: string;
}

export interface PersistentTask {
  id: string;
  project_id: string | null;
  title: string;
  description: string;
  category: 'RECON' | 'SYSTEM' | 'CODE' | 'ANALYSIS' | 'WORKFLOW' | 'AUTOMATION';
  status: TaskStatus;
  progress: number;
  pid: number | null;
  last_completed_step: string | null;
  next_planned_step: string | null;
  relevant_files: string[];
  checkpoint_data: Record<string, unknown> | null;
  completion_evidence: Record<string, unknown> | null;
  error_info: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  steps?: TaskStep[];
  checkpoints?: TaskCheckpoint[];
}

export interface SessionData {
  id: string;
  started_at: string;
  ended_at: string | null;
  active_project_id: string | null;
  active_task_id: string | null;
  summary: string | null;
  suggested_next_action: string | null;
  exit_reason: 'clean_shutdown' | 'crashed' | 'interrupted' | 'active';
}

export interface SessionRecoveryData {
  currentSessionId: string;
  previousSession: SessionData | null;
  interruptedTasks: PersistentTask[];
  lastActiveProject: Project | null;
  lastActiveTask: PersistentTask | null;
  resumeSummary: string;
  suggestedNextAction: string;
}

export interface MemoryRecord {
  id: string;
  key: string;
  category: 'project' | 'preference' | 'architecture' | 'user_instruction';
  content: string;
  confidence: number;
  source: 'user_explicit' | 'verified_system' | 'inferred_summary';
  created_at: string;
  updated_at: string;
}

export interface WorkspaceActivityItem {
  id: string;
  session_id: string | null;
  action_type: string;
  target: string;
  details: Record<string, unknown>;
  verified: boolean;
  created_at: string;
}

