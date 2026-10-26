import {
  HealthResponse,
  StatusResponse,
  SystemStats,
  SearchResultItem,
  PendingAction,
  AuditLogItem,
  ConversationSummary,
  ConversationDetail,
  ChatResponse,
  ApiErrorPayload,
  OSTask,
  OSOverview,
  WorkspaceFile,
  KaliAgentInfo,
  KaliCommandJob,
  KaliStatusResponse,
  FirebaseInfo,
  Project,
  PersistentTask,
  TaskStep,
  TaskCheckpoint,
  SessionRecoveryData,
  MemoryRecord,
  WorkspaceActivityItem,
} from '../types/api.ts';

export class ApiClientError extends Error {
  public code: string;
  public status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 35000
): Promise<T> {
  const controller = new AbortController();
  const signal = options.signal || controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      ...options,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
      if (data && data.status === 'error' && data.error) {
        const errPayload = data as ApiErrorPayload;
        throw new ApiClientError(
          errPayload.error.code,
          errPayload.error.message,
          response.status
        );
      }
      throw new ApiClientError(
        'HTTP_ERROR',
        `Request failed with status ${response.status}`,
        response.status
      );
    }

    return data as T;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof ApiClientError) {
      throw err;
    }

    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new ApiClientError(
          'REQUEST_ABORTED',
          'The request was cancelled or timed out.',
          408
        );
      }
      throw new ApiClientError('NETWORK_ERROR', err.message, 0);
    }

    throw new ApiClientError('UNKNOWN_ERROR', 'An unexpected error occurred.', 500);
  }
}

let activeBridgeToken = '';

export function setBridgeToken(token: string) {
  activeBridgeToken = token;
}

export function getStoredBridgeToken(): string {
  return activeBridgeToken;
}

export const api = {
  getHealth: (signal?: AbortSignal) =>
    request<HealthResponse>('/api/health', { method: 'GET', signal }, 5000),

  getKaliToken: (signal?: AbortSignal) =>
    request<{ token: string }>('/api/kali/token', { method: 'GET', signal }, 5000),

  getStatus: (signal?: AbortSignal) =>
    request<StatusResponse>('/api/status', { method: 'GET', signal }, 10000),

  transcribeAudio: (
    audioBase64?: string,
    mimeType = 'audio/webm',
    textTranscript?: string,
    signal?: AbortSignal
  ) =>
    request<{ transcript: string; confidence: number; source: string }>(
      '/api/voice/transcribe',
      {
        method: 'POST',
        signal,
        body: JSON.stringify({
          audio_base64: audioBase64,
          mime_type: mimeType,
          text_transcript: textTranscript,
        }),
      },
      25000
    ),

  getSystemStatus: (signal?: AbortSignal) =>
    request<SystemStats>('/api/system/status', { method: 'GET', signal }, 5000),

  searchWeb: (query: string, signal?: AbortSignal) =>
    request<{ query: string; results: SearchResultItem[]; summary: string }>(
      '/api/search',
      {
        method: 'POST',
        signal,
        body: JSON.stringify({ query }),
      },
      15000
    ),

  getTools: (signal?: AbortSignal) =>
    request<Array<{ name: string; description: string; risk: string }>>(
      '/api/tools',
      { method: 'GET', signal },
      5000
    ),

  executeTool: (tool: string, args: Record<string, unknown> = {}, signal?: AbortSignal) =>
    request<{ status: string; result?: Record<string, unknown>; message?: string }>(
      '/api/tools/execute',
      {
        method: 'POST',
        signal,
        body: JSON.stringify({ tool, args }),
      },
      15000
    ),

  getPendingActions: (signal?: AbortSignal) =>
    request<PendingAction[]>('/api/permissions/pending', { method: 'GET', signal }, 5000),

  approveAction: (id: string, signal?: AbortSignal) =>
    request<{ status: string; result?: Record<string, unknown> }>(
      `/api/permissions/${encodeURIComponent(id)}/approve`,
      { method: 'POST', signal },
      10000
    ),

  rejectAction: (id: string, signal?: AbortSignal) =>
    request<{ status: string }>(
      `/api/permissions/${encodeURIComponent(id)}/reject`,
      { method: 'POST', signal },
      10000
    ),

  getAuditLogs: (limit = 25, signal?: AbortSignal) =>
    request<AuditLogItem[]>(`/api/audit?limit=${limit}`, { method: 'GET', signal }, 5000),

  getSettings: (signal?: AbortSignal) =>
    request<Record<string, unknown>>('/api/settings', { method: 'GET', signal }, 5000),

  updateSettings: (updates: Record<string, unknown>, signal?: AbortSignal) =>
    request<Record<string, unknown>>(
      '/api/settings',
      {
        method: 'PUT',
        signal,
        body: JSON.stringify(updates),
      },
      5000
    ),

  sendMessage: (
    message: string,
    conversationId: string | null = null,
    source: 'voice' | 'text' = 'text',
    signal?: AbortSignal
  ) =>
    request<ChatResponse>(
      '/api/chat',
      {
        method: 'POST',
        signal,
        body: JSON.stringify({
          conversation_id: conversationId,
          message,
          source,
        }),
      },
      35000
    ),

  getConversations: (limit = 50, offset = 0, signal?: AbortSignal) =>
    request<ConversationSummary[]>(
      `/api/conversations?limit=${limit}&offset=${offset}`,
      { method: 'GET', signal },
      10000
    ),

  getConversation: (id: string, signal?: AbortSignal) =>
    request<ConversationDetail>(
      `/api/conversations/${encodeURIComponent(id)}`,
      { method: 'GET', signal },
      10000
    ),

  deleteConversation: (id: string, signal?: AbortSignal) =>
    request<{ status: 'success'; deleted_id: string }>(
      `/api/conversations/${encodeURIComponent(id)}`,
      { method: 'DELETE', signal },
      10000
    ),

  getOSOverview: (signal?: AbortSignal) =>
    request<OSOverview>('/api/os/overview', { method: 'GET', signal }, 10000),

  getTasks: (signal?: AbortSignal) =>
    request<OSTask[]>('/api/tasks', { method: 'GET', signal }, 8000),

  spawnTask: (
    body: {
      name: string;
      category?: string;
      description?: string;
      type?: string;
      query?: string;
      target?: string;
      code?: string;
    },
    signal?: AbortSignal
  ) =>
    request<OSTask>(
      '/api/tasks',
      {
        method: 'POST',
        signal,
        body: JSON.stringify(body),
      },
      15000
    ),

  pauseTask: (id: string, signal?: AbortSignal) =>
    request<{ status: string; id: string }>(
      `/api/tasks/${encodeURIComponent(id)}/pause`,
      { method: 'POST', signal },
      8000
    ),

  resumeTask: (id: string, signal?: AbortSignal) =>
    request<{ status: string; id: string }>(
      `/api/tasks/${encodeURIComponent(id)}/resume`,
      { method: 'POST', signal },
      8000
    ),

  cancelTask: (id: string, signal?: AbortSignal) =>
    request<{ status: string; id: string }>(
      `/api/tasks/${encodeURIComponent(id)}`,
      { method: 'DELETE', signal },
      8000
    ),

  clearCompletedTasks: (signal?: AbortSignal) =>
    request<{ status: string }>(
      '/api/tasks/clear-completed',
      { method: 'POST', signal },
      8000
    ),

  getWorkspaceFiles: (signal?: AbortSignal) =>
    request<WorkspaceFile[]>('/api/workspace/files', { method: 'GET', signal }, 8000),

  getWorkspaceFile: (filename: string, signal?: AbortSignal) =>
    request<{ filename: string; content: string; size_bytes: number }>(
      `/api/workspace/files/${encodeURIComponent(filename)}`,
      { method: 'GET', signal },
      8000
    ),

  saveWorkspaceFile: (filename: string, content: string, signal?: AbortSignal) =>
    request<{ filename: string; size_bytes: number; updated_at: string }>(
      '/api/workspace/files',
      {
        method: 'POST',
        signal,
        body: JSON.stringify({ filename, content }),
      },
      10000
    ),

  deleteWorkspaceFile: (filename: string, signal?: AbortSignal) =>
    request<{ status: string; filename: string }>(
      `/api/workspace/files/${encodeURIComponent(filename)}`,
      { method: 'DELETE', signal },
      8000
    ),

  sendMessageStream: async (
    message: string,
    conversationId: string | null = null,
    source: 'voice' | 'text' = 'text',
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<{ fullText: string; conversation_id: string }> => {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, message, source }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new ApiClientError('STREAM_ERROR', err?.error?.message || 'Streaming failed', response.status);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new ApiClientError('STREAM_ERROR', 'No response stream available');
    }

    const decoder = new TextDecoder();
    let fullText = '';
    let finalConvId = conversationId || '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkStr = decoder.decode(value, { stream: true });
      const lines = chunkStr.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk' && data.text) {
              fullText += data.text;
              if (onChunk) onChunk(data.text);
            } else if (data.type === 'done') {
              if (data.fullText) fullText = data.fullText;
              if (data.conversation_id) finalConvId = data.conversation_id;
            } else if (data.type === 'error') {
              throw new ApiClientError('AI_ERROR', data.message || 'Stream generation failed');
            }
          } catch (pErr) {
            if (pErr instanceof ApiClientError) throw pErr;
          }
        }
      }
    }

    return { fullText, conversation_id: finalConvId };
  },

  getKaliStatus: (signal?: AbortSignal) =>
    request<KaliStatusResponse>('/api/kali/status', { method: 'GET', signal }, 5000),

  execKaliCommand: (command: string, signal?: AbortSignal) =>
    request<KaliCommandJob>(
      '/api/kali/exec',
      {
        method: 'POST',
        signal,
        headers: activeBridgeToken ? { Authorization: `Bearer ${activeBridgeToken}` } : {},
        body: JSON.stringify({ command }),
      },
      15000
    ),

  getKaliHistory: (signal?: AbortSignal) =>
    request<KaliCommandJob[]>('/api/kali/history', {
      method: 'GET',
      signal,
      headers: activeBridgeToken ? { Authorization: `Bearer ${activeBridgeToken}` } : {},
    }, 5000),

  getFirebaseInfo: (signal?: AbortSignal) =>
    request<FirebaseInfo>('/api/firebase/info', { method: 'GET', signal }, 5000),

  // Phase 2: Persistent Projects & Memory Endpoints
  getProjects: (status?: string, signal?: AbortSignal) =>
    request<Project[]>(`/api/projects${status ? `?status=${encodeURIComponent(status)}` : ''}`, { method: 'GET', signal }, 8000),

  createProject: (data: { name: string; description?: string }, signal?: AbortSignal) =>
    request<Project>('/api/projects', {
      method: 'POST',
      signal,
      body: JSON.stringify(data),
    }, 8000),

  getProject: (id: string, signal?: AbortSignal) =>
    request<Project>(`/api/projects/${encodeURIComponent(id)}`, { method: 'GET', signal }, 8000),

  updateProject: (id: string, updates: Partial<Project>, signal?: AbortSignal) =>
    request<Project>(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      signal,
      body: JSON.stringify(updates),
    }, 8000),

  // Phase 2: Persistent Tasks & Checkpoints
  getPersistentTasks: (projectId?: string, status?: string, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (projectId) params.append('project_id', projectId);
    if (status) params.append('status', status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<PersistentTask[]>(`/api/persistent-tasks${qs}`, { method: 'GET', signal }, 8000);
  },

  createPersistentTask: (
    data: {
      project_id?: string;
      title: string;
      description?: string;
      category?: string;
      relevant_files?: string[];
      next_planned_step?: string;
    },
    signal?: AbortSignal
  ) =>
    request<PersistentTask>('/api/persistent-tasks', {
      method: 'POST',
      signal,
      body: JSON.stringify(data),
    }, 8000),

  getPersistentTask: (id: string, signal?: AbortSignal) =>
    request<PersistentTask>(`/api/persistent-tasks/${encodeURIComponent(id)}`, { method: 'GET', signal }, 8000),

  updatePersistentTask: (id: string, updates: Partial<PersistentTask>, signal?: AbortSignal) =>
    request<PersistentTask>(`/api/persistent-tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      signal,
      body: JSON.stringify(updates),
    }, 8000),

  completePersistentTask: (id: string, evidence: Record<string, unknown>, signal?: AbortSignal) =>
    request<PersistentTask>(`/api/persistent-tasks/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
      signal,
      body: JSON.stringify({ evidence }),
    }, 8000),

  resumeInterruptedTask: (id: string, signal?: AbortSignal) =>
    request<PersistentTask>(`/api/persistent-tasks/${encodeURIComponent(id)}/resume`, {
      method: 'POST',
      signal,
    }, 8000),

  dismissInterruptedTask: (id: string, signal?: AbortSignal) =>
    request<PersistentTask>(`/api/persistent-tasks/${encodeURIComponent(id)}/dismiss`, {
      method: 'POST',
      signal,
    }, 8000),

  addTaskStep: (taskId: string, title: string, stepNumber?: number, signal?: AbortSignal) =>
    request<TaskStep>(`/api/persistent-tasks/${encodeURIComponent(taskId)}/steps`, {
      method: 'POST',
      signal,
      body: JSON.stringify({ title, step_number: stepNumber }),
    }, 8000),

  updateTaskStep: (taskId: string, stepId: string, updates: Partial<TaskStep>, signal?: AbortSignal) =>
    request<TaskStep>(`/api/persistent-tasks/${encodeURIComponent(taskId)}/steps/${encodeURIComponent(stepId)}`, {
      method: 'PUT',
      signal,
      body: JSON.stringify(updates),
    }, 8000),

  createTaskCheckpoint: (taskId: string, checkpointName: string, stateData: Record<string, unknown>, signal?: AbortSignal) =>
    request<TaskCheckpoint>(`/api/persistent-tasks/${encodeURIComponent(taskId)}/checkpoints`, {
      method: 'POST',
      signal,
      body: JSON.stringify({ checkpoint_name: checkpointName, state_data: stateData }),
    }, 8000),

  // Phase 2: Session Recovery
  getSessionRecovery: (signal?: AbortSignal) =>
    request<SessionRecoveryData>('/api/session/recovery', { method: 'GET', signal }, 8000),

  dismissRecoveryState: (signal?: AbortSignal) =>
    request<{ status: string }>('/api/session/recovery/dismiss', { method: 'POST', signal }, 8000),

  // Phase 2: Memory Records
  getMemoryRecords: (category?: string, signal?: AbortSignal) =>
    request<MemoryRecord[]>(`/api/memory${category ? `?category=${encodeURIComponent(category)}` : ''}`, { method: 'GET', signal }, 8000),

  saveMemoryRecord: (
    data: {
      key: string;
      category: 'project' | 'preference' | 'architecture' | 'user_instruction';
      content: string;
      source?: 'user_explicit' | 'verified_system' | 'inferred_summary';
      confidence?: number;
    },
    signal?: AbortSignal
  ) =>
    request<MemoryRecord>('/api/memory', {
      method: 'POST',
      signal,
      body: JSON.stringify(data),
    }, 8000),

  // Phase 2: Workspace Activity Feed
  getWorkspaceActivity: (limit = 50, signal?: AbortSignal) =>
    request<WorkspaceActivityItem[]>(`/api/activity?limit=${limit}`, { method: 'GET', signal }, 8000),

  // Cybersecurity Arsenal API Methods
  runCyberPortScan: (target = '127.0.0.1', ports?: number[], signal?: AbortSignal) =>
    request<any>('/api/cyber/port-scan', {
      method: 'POST',
      signal,
      body: JSON.stringify({ target, ports }),
    }, 15000),

  runCyberDnsLookup: (domain = 'localhost', signal?: AbortSignal) =>
    request<any>('/api/cyber/dns-lookup', {
      method: 'POST',
      signal,
      body: JSON.stringify({ domain }),
    }, 10000),

  getCyberInterfaces: (signal?: AbortSignal) =>
    request<any>('/api/cyber/interfaces', { method: 'GET', signal }, 8000),

  runCyberHeadersAudit: (url = 'http://localhost:3000', signal?: AbortSignal) =>
    request<any>('/api/cyber/headers-audit', {
      method: 'POST',
      signal,
      body: JSON.stringify({ url }),
    }, 12000),

  runCyberTlsInspect: (domain = 'localhost', signal?: AbortSignal) =>
    request<any>('/api/cyber/tls-inspect', {
      method: 'POST',
      signal,
      body: JSON.stringify({ domain }),
    }, 10000),

  searchCyberCve: (query = 'all', signal?: AbortSignal) =>
    request<any>('/api/cyber/cve-search', {
      method: 'POST',
      signal,
      body: JSON.stringify({ query }),
    }, 8000),

  analyzeCyberHash: (hash: string, signal?: AbortSignal) =>
    request<any>('/api/cyber/hash-identify', {
      method: 'POST',
      signal,
      body: JSON.stringify({ hash }),
    }, 8000),

  calculateCyberEntropy: (data: string, signal?: AbortSignal) =>
    request<any>('/api/cyber/entropy', {
      method: 'POST',
      signal,
      body: JSON.stringify({ data }),
    }, 8000),

  generateCyberDigests: (data: string, secretKey?: string, signal?: AbortSignal) =>
    request<any>('/api/cyber/digests', {
      method: 'POST',
      signal,
      body: JSON.stringify({ data, secret_key: secretKey }),
    }, 8000),

  tacticalCodec: (input: string, mode: 'encode' | 'decode', format: 'base64' | 'hex' | 'url' | 'binary', signal?: AbortSignal) =>
    request<any>('/api/cyber/codec', {
      method: 'POST',
      signal,
      body: JSON.stringify({ input, mode, format }),
    }, 8000),

  getCyberThreatIntel: (ip = '127.0.0.1', signal?: AbortSignal) =>
    request<any>('/api/cyber/threat-intel', {
      method: 'POST',
      signal,
      body: JSON.stringify({ ip }),
    }, 10000),

  auditCodeSecurity: (code: string, filename = 'source.js', signal?: AbortSignal) =>
    request<any>('/api/cyber/code-audit', {
      method: 'POST',
      signal,
      body: JSON.stringify({ code, filename }),
    }, 12000),
};
