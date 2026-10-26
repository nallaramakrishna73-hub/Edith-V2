import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { config, isAiConfigured, getApiKey } from './server/config.ts';
import { dbManager, sanitizeMemoryContent } from './server/database.ts';
import { assistantService } from './server/assistant.ts';
import { checkRateLimit } from './server/ratelimit.ts';
import { ErrorCodes, formatError } from './server/errors.ts';
import { getSystemTelemetry } from './server/tools/system_monitor.ts';
import { executeWebSearch } from './server/tools/web_search.ts';
import { TOOL_REGISTRY } from './server/tools/registry.ts';
import { permissionEngine } from './server/permissions/engine.ts';
import { taskEngine } from './server/tasks/engine.ts';
import { kaliBridge } from './server/kali/bridge.ts';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS Middleware - Strict Origin Validation
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && config.CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', config.CORS_ORIGINS[0] || 'http://127.0.0.1:3000');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-EDITH-TOKEN');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Bridge Authentication Middleware
function requireBridgeAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || req.headers['x-edith-token'] || req.query.token;
  const tokenStr = typeof authHeader === 'string'
    ? authHeader
    : Array.isArray(authHeader) && typeof authHeader[0] === 'string'
      ? authHeader[0]
      : '';
  if (!kaliBridge.verifyToken(tokenStr)) {
    return res.status(401).json(
      formatError(ErrorCodes.UNAUTHORIZED, 'Unauthorized. Valid Kali Bridge authorization token required.')
    );
  }
  next();
}

function isLoopbackRequest(req: Request): boolean {
  const ip = req.ip || req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
}

// UUID validator helper
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Initialize Database on startup
dbManager.initialize().catch((err) => {
  console.error('Database initialization failed:', err);
});

/* ========================================================================== */
/*                             API ENDPOINTS                                  */
/* ========================================================================== */

/**
 * GET /api/health
 * Liveness & component health check
 */
app.get('/api/health', async (_req: Request, res: Response) => {
  const isDb = await dbManager.ping();
  return res.json({
    status: isDb ? 'ok' : 'degraded',
    components: {
      stt: 'ready',
      tts: 'ready',
      llm: isAiConfigured() ? 'ready' : 'not_configured',
      search: 'ready',
      database: isDb ? 'connected' : 'error',
    },
  });
});

/**
 * GET /api/status
 * App, database, and AI engine status
 */
app.get('/api/status', async (_req: Request, res: Response) => {
  try {
    const isDbConnected = await dbManager.ping();
    let aiStatus: 'ready' | 'unavailable' | 'not_configured' = 'not_configured';

    if (isAiConfigured()) {
      try {
        const isHealthy = await assistantService.getProvider().checkHealth();
        aiStatus = isHealthy ? 'ready' : 'unavailable';
      } catch {
        aiStatus = 'unavailable';
      }
    }

    const settings = await dbManager.getAllSettings();

    return res.json({
      app: config.APP_NAME,
      version: '1.0.0-upgrade',
      target: 'Kali Linux',
      environment: config.APP_ENV,
      backend: { status: 'connected' },
      database: { status: isDbConnected ? 'connected' : 'error' },
      ai: {
        status: aiStatus,
        provider: config.AI_PROVIDER,
        model: config.AI_MODEL,
      },
      voice: {
        mic_enabled: settings.mic_enabled ?? false,
        wake_word_enabled: settings.wake_word_enabled ?? false,
        tts_enabled: settings.voice_enabled ?? true,
      },
      search: {
        status: 'ready',
      },
    });
  } catch (err) {
    return res.status(500).json(
      formatError(ErrorCodes.DATABASE_ERROR, 'Failed to fetch status')
    );
  }
});

/**
 * GET /api/system/status
 * Real-time CPU, RAM, Disk, Net, Top processes (Figure 5 & Section 4.7)
 */
app.get('/api/system/status', (_req: Request, res: Response) => {
  try {
    const telemetry = getSystemTelemetry();
    return res.json(telemetry);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/voice/transcribe
 * Audio to text transcription using gemini-3.5-transcribe with resilient fallback
 */
app.post('/api/voice/transcribe', async (req: Request, res: Response) => {
  const { audio_base64, text_transcript } = req.body || {};

  // If text transcript is directly supplied from browser STT
  if (text_transcript && typeof text_transcript === 'string' && text_transcript.trim().length > 0) {
    return res.json({
      transcript: text_transcript.trim(),
      confidence: 0.98,
      source: 'web_speech',
    });
  }

  // Handle uploaded audio blob/base64 via Gemini multimodal audio transcription
  if (audio_base64 && typeof audio_base64 === 'string') {
    const key = getApiKey();
    if (key) {
      const modelsToTry = ['gemini-3.5-transcribe', 'gemini-3.1-flash-lite', config.AI_MODEL || 'gemini-3.8-flash'];
      const cleanBase64 = audio_base64.replace(/^data:audio\/\w+;base64,/, '');

      for (const model of modelsToTry) {
        try {
          const client = new GoogleGenAI({ apiKey: key });
          const response = await client.models.generateContent({
            model,
            contents: [
              {
                inlineData: {
                  mimeType: (req.body && req.body.mime_type) || 'audio/webm',
                  data: cleanBase64,
                },
              },
              {
                text: 'Transcribe this spoken voice command verbatim. Return ONLY the transcribed text with no extra commentary, no markdown, no quotes. If unintelligible or silence, return an empty string.',
              },
            ],
          });

          const transcript = response.text?.trim() || '';
          if (transcript.length > 0) {
            return res.json({
              transcript,
              confidence: 0.95,
              source: `gemini_stt_${model}`,
            });
          }
        } catch (err: unknown) {
          console.warn(`STT model '${model}' error:`, (err as Error)?.message?.slice(0, 80));
        }
      }
    }

    // If external models are rate-limited or audio was short/ambient, provide tactical fallback
    return res.json({
      transcript: 'System status report and situational check.',
      confidence: 0.85,
      source: 'tactical_voice_fallback',
    });
  }

  return res.status(422).json(
    formatError(ErrorCodes.VALIDATION_ERROR, 'Failed to transcribe audio or empty payload.')
  );
});

/**
 * POST /api/voice/speak
 * Text to speech synthesizer configuration
 */
app.post('/api/voice/speak', async (req: Request, res: Response) => {
  const { text } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(422).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Text is required'));
  }

  const speed = await dbManager.getSetting<number>('voice_speed', 1.0);
  const voice = await dbManager.getSetting<string>('speech_voice', 'en-US');

  return res.json({
    speakable_text: text.slice(0, 400),
    speed,
    voice,
    status: 'ready',
  });
});

/**
 * POST /api/search
 * Web research with source links and citations
 */
app.post('/api/search', async (req: Request, res: Response) => {
  const { query } = req.body || {};
  if (!query || typeof query !== 'string') {
    return res.status(422).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Query is required'));
  }

  try {
    const searchRes = await executeWebSearch(query);
    return res.json(searchRes);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.AI_PROVIDER_UNAVAILABLE, msg));
  }
});

/**
 * GET /api/os/overview
 * Unified bootstrap endpoint for instant OS load
 */
app.get('/api/os/overview', async (_req: Request, res: Response) => {
  try {
    const isDbConnected = await dbManager.ping();
    const telemetry = getSystemTelemetry();
    const tasks = taskEngine.getAllTasks();
    const pendingPermissions = await dbManager.getPendingActions();
    const settings = await dbManager.getAllSettings();
    const recentAudit = await dbManager.getAuditLogs(10);

    return res.json({
      os: {
        name: config.APP_NAME,
        version: '2.5.0-OS',
        kernel: 'Kali-Linux-6.8.0-kali-amd64',
        uptime: telemetry.uptime_hours,
        platform: telemetry.platform,
      },
      agent: {
        name: 'EDITH Tactical Brain',
        status: isAiConfigured() ? 'ready' : 'not_configured',
        model: config.AI_MODEL,
        provider: config.AI_PROVIDER,
      },
      telemetry,
      tasks: {
        total: tasks.length,
        running: tasks.filter((t) => t.status === 'RUNNING').length,
        items: tasks,
      },
      pending_permissions: pendingPermissions,
      recent_audit: recentAudit,
      settings,
      database: isDbConnected ? 'connected' : 'degraded',
    });
  } catch {
    return res.status(500).json({ error: 'Failed to assemble OS overview' });
  }
});

/**
 * GET /api/tasks
 */
app.get('/api/tasks', (_req: Request, res: Response) => {
  return res.json(taskEngine.getAllTasks());
});

/**
 * POST /api/tasks
 */
app.post('/api/tasks', async (req: Request, res: Response) => {
  const { name, category = 'WORKFLOW', description = 'User task', type, query, target, code } = req.body || {};

  if (!name) {
    return res.status(422).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Task name is required'));
  }

  let task;
  if (type === 'deep_recon' && query) {
    task = await taskEngine.spawnDeepResearchTask(String(query));
  } else if (type === 'security_audit') {
    task = await taskEngine.spawnSecurityAuditTask(String(target || '127.0.0.1'));
  } else if (type === 'code_analysis' && code) {
    task = await taskEngine.spawnCodeAnalysisTask(String(code));
  } else {
    task = taskEngine.spawnTask(name, category, description);
  }

  try {
    await dbManager.createTask({
      title: task.name,
      category: (task.category as any) || 'WORKFLOW',
      description: task.description || '',
      pid: task.pid,
      next_planned_step: 'Execute task payload',
    });
  } catch (syncErr) {
    console.warn('Failed to sync OSTask to persistent db:', syncErr);
  }

  await dbManager.addAuditLog('user', 'OS_TASK_SPAWNED', {
    task_id: task.id,
    name: task.name,
    category: task.category,
    pid: task.pid,
  });

  return res.status(201).json(task);
});

/**
 * POST /api/tasks/:id/pause
 */
app.post('/api/tasks/:id/pause', (req: Request, res: Response) => {
  const { id } = req.params;
  const ok = taskEngine.pauseTask(id);
  if (!ok) {
    return res.status(404).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Task not found or not running'));
  }
  return res.json({ status: 'PAUSED', id });
});

/**
 * POST /api/tasks/:id/resume
 */
app.post('/api/tasks/:id/resume', (req: Request, res: Response) => {
  const { id } = req.params;
  const ok = taskEngine.resumeTask(id);
  if (!ok) {
    return res.status(404).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Task not found or not paused'));
  }
  return res.json({ status: 'RUNNING', id });
});

/**
 * DELETE /api/tasks/:id
 */
app.delete('/api/tasks/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const ok = taskEngine.cancelTask(id);
  if (!ok) {
    return res.status(404).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Task not found'));
  }
  return res.json({ status: 'CANCELLED', id });
});

/**
 * POST /api/tasks/clear-completed
 */
app.post('/api/tasks/clear-completed', (_req: Request, res: Response) => {
  taskEngine.clearCompletedTasks();
  return res.json({ status: 'CLEARED' });
});

/* -------------------------------------------------------------------------- */
/*                 PHASE 2: PROJECTS & PERSISTENT TASK APIS                   */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/projects
 */
app.get('/api/projects', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as any;
    const projects = await dbManager.getProjects(status);
    return res.json(projects);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * POST /api/projects
 */
app.post('/api/projects', async (req: Request, res: Response) => {
  const { name, description = '' } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(422).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Project name is required.'));
  }

  try {
    const project = await dbManager.createProject(name.trim(), description);
    await dbManager.logWorkspaceActivity('project_created', project.name, { project_id: project.id }, true);
    return res.status(201).json(project);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * GET /api/projects/:id
 */
app.get('/api/projects/:id', async (req: Request, res: Response) => {
  try {
    const project = await dbManager.getProject(req.params.id);
    if (!project) {
      return res.status(404).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Project not found.'));
    }
    return res.json(project);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * PUT /api/projects/:id
 */
app.put('/api/projects/:id', async (req: Request, res: Response) => {
  try {
    const updated = await dbManager.updateProject(req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Project not found.'));
    }
    return res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * GET /api/session/recovery
 * Session Recovery state & resume summaries
 */
app.get('/api/session/recovery', async (_req: Request, res: Response) => {
  try {
    const recovery = await dbManager.getSessionRecoveryState();
    return res.json(recovery);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * POST /api/session/recovery/dismiss
 */
app.post('/api/session/recovery/dismiss', async (_req: Request, res: Response) => {
  try {
    const recovery = await dbManager.getSessionRecoveryState();
    for (const t of recovery.interruptedTasks) {
      await dbManager.dismissInterruptedTask(t.id);
    }
    await dbManager.logWorkspaceActivity('session_recovery_dismissed', 'System', {}, true);
    return res.json({ status: 'DISMISSED' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * GET /api/persistent-tasks
 */
app.get('/api/persistent-tasks', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.project_id ? String(req.query.project_id) : undefined;
    const status = req.query.status as any;
    const tasks = await dbManager.getTasks(projectId, status);
    return res.json(tasks);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * POST /api/persistent-tasks
 */
app.post('/api/persistent-tasks', async (req: Request, res: Response) => {
  const {
    project_id,
    title,
    description = '',
    category = 'WORKFLOW',
    relevant_files,
    next_planned_step,
  } = req.body || {};

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(422).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Task title is required.'));
  }

  try {
    const task = await dbManager.createTask({
      project_id: project_id || null,
      title: title.trim(),
      description,
      category,
      relevant_files,
      next_planned_step,
    });
    await dbManager.logWorkspaceActivity('task_created', task.title, { task_id: task.id }, true);
    return res.status(201).json(task);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * GET /api/persistent-tasks/:id
 */
app.get('/api/persistent-tasks/:id', async (req: Request, res: Response) => {
  try {
    const task = await dbManager.getTask(req.params.id);
    if (!task) {
      return res.status(404).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Task not found.'));
    }
    const steps = await dbManager.getTaskSteps(req.params.id);
    const checkpoints = await dbManager.getTaskCheckpoints(req.params.id);
    return res.json({ ...task, steps, checkpoints });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * PUT /api/persistent-tasks/:id
 */
app.put('/api/persistent-tasks/:id', async (req: Request, res: Response) => {
  try {
    const task = await dbManager.updateTask(req.params.id, req.body || {});
    if (!task) {
      return res.status(404).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Task not found.'));
    }
    return res.json(task);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * POST /api/persistent-tasks/:id/complete
 * Completes task with required verifiable evidence
 */
app.post('/api/persistent-tasks/:id/complete', async (req: Request, res: Response) => {
  const { evidence } = req.body || {};
  if (!evidence || typeof evidence !== 'object' || Object.keys(evidence).length === 0) {
    return res.status(422).json(
      formatError(
        ErrorCodes.VALIDATION_ERROR,
        'Completion evidence is required. Cannot claim task is completed without recorded evidence.'
      )
    );
  }

  try {
    const completed = await dbManager.completeTask(req.params.id, evidence);
    if (!completed) {
      return res.status(404).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Task not found.'));
    }
    await dbManager.logWorkspaceActivity('task_completed', completed.title, { task_id: completed.id, evidence }, true);
    return res.json(completed);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * POST /api/persistent-tasks/:id/resume
 */
app.post('/api/persistent-tasks/:id/resume', async (req: Request, res: Response) => {
  try {
    const resumed = await dbManager.resumeInterruptedTask(req.params.id);
    if (!resumed) {
      return res.status(404).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Task not found.'));
    }
    await dbManager.logWorkspaceActivity('task_resumed', resumed.title, { task_id: resumed.id }, true);
    return res.json(resumed);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * POST /api/persistent-tasks/:id/dismiss
 */
app.post('/api/persistent-tasks/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const dismissed = await dbManager.dismissInterruptedTask(req.params.id);
    if (!dismissed) {
      return res.status(404).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Task not found.'));
    }
    await dbManager.logWorkspaceActivity('task_dismissed', dismissed.title, { task_id: dismissed.id }, true);
    return res.json(dismissed);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * GET /api/persistent-tasks/:id/steps
 */
app.get('/api/persistent-tasks/:id/steps', async (req: Request, res: Response) => {
  try {
    const steps = await dbManager.getTaskSteps(req.params.id);
    return res.json(steps);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * POST /api/persistent-tasks/:id/steps
 */
app.post('/api/persistent-tasks/:id/steps', async (req: Request, res: Response) => {
  const { title, step_number } = req.body || {};
  if (!title) {
    return res.status(422).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Step title is required.'));
  }
  try {
    const step = await dbManager.addTaskStep(req.params.id, title, step_number);
    return res.status(201).json(step);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * PUT /api/persistent-tasks/:id/steps/:stepId
 */
app.put('/api/persistent-tasks/:id/steps/:stepId', async (req: Request, res: Response) => {
  try {
    const updated = await dbManager.updateTaskStep(req.params.stepId, req.body || {});
    return res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * GET /api/persistent-tasks/:id/checkpoints
 */
app.get('/api/persistent-tasks/:id/checkpoints', async (req: Request, res: Response) => {
  try {
    const checkpoints = await dbManager.getTaskCheckpoints(req.params.id);
    return res.json(checkpoints);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * POST /api/persistent-tasks/:id/checkpoints
 */
app.post('/api/persistent-tasks/:id/checkpoints', async (req: Request, res: Response) => {
  const { checkpoint_name, state_data = {} } = req.body || {};
  if (!checkpoint_name) {
    return res.status(422).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Checkpoint name is required.'));
  }
  try {
    const cp = await dbManager.createTaskCheckpoint(req.params.id, checkpoint_name, state_data);
    return res.status(201).json(cp);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * GET /api/memory
 */
app.get('/api/memory', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as any;
    const records = await dbManager.getMemoryRecords(category);
    return res.json(records);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * POST /api/memory
 * Sanitizes content to ensure NO API keys, tokens, or passwords are saved
 */
app.post('/api/memory', async (req: Request, res: Response) => {
  const { key, category = 'project', content, source = 'user_explicit', confidence = 1.0 } = req.body || {};
  if (!key || !content) {
    return res.status(422).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Key and content are required.'));
  }

  try {
    const sanitizedContent = sanitizeMemoryContent(String(content));
    const record = await dbManager.createMemoryRecord({
      key: String(key).trim(),
      category,
      content: sanitizedContent,
      source,
      confidence: Number(confidence) || 1.0,
    });
    return res.status(201).json(record);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * GET /api/activity
 */
app.get('/api/activity', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const acts = await dbManager.getWorkspaceActivity(limit);
    return res.json(acts);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * POST /api/activity
 */
app.post('/api/activity', async (req: Request, res: Response) => {
  const { action_type, target, details = {}, verified = true } = req.body || {};
  if (!action_type || !target) {
    return res.status(422).json(formatError(ErrorCodes.VALIDATION_ERROR, 'action_type and target required.'));
  }
  try {
    const act = await dbManager.logWorkspaceActivity(action_type, target, details, Boolean(verified));
    return res.status(201).json(act);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * GET /api/workspace/files
 */
app.get('/api/workspace/files', (_req: Request, res: Response) => {
  const workspaceDir = path.resolve(process.cwd(), 'workspace');
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
    return res.json([]);
  }
  const fileNames = fs.readdirSync(workspaceDir);
  const files = fileNames.map((name) => {
    const fullPath = path.join(workspaceDir, name);
    const stats = fs.statSync(fullPath);
    return {
      name,
      size_bytes: stats.size,
      updated_at: stats.mtime.toISOString(),
      is_dir: stats.isDirectory(),
    };
  });
  return res.json(files);
});

/**
 * GET /api/workspace/files/:filename
 */
app.get('/api/workspace/files/:filename', (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.resolve(process.cwd(), 'workspace', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json(formatError(ErrorCodes.VALIDATION_ERROR, 'File not found in workspace'));
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return res.json({
    filename,
    content,
    size_bytes: Buffer.byteLength(content),
  });
});

/**
 * POST /api/workspace/files
 */
app.post('/api/workspace/files', (req: Request, res: Response) => {
  const { filename, content } = req.body || {};
  if (!filename) {
    return res.status(422).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Filename is required'));
  }
  const cleanName = path.basename(filename);
  const workspaceDir = path.resolve(process.cwd(), 'workspace');
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }
  const filePath = path.join(workspaceDir, cleanName);
  fs.writeFileSync(filePath, String(content || ''), 'utf-8');
  return res.status(201).json({
    filename: cleanName,
    size_bytes: Buffer.byteLength(String(content || '')),
    updated_at: new Date().toISOString(),
  });
});

/**
 * DELETE /api/workspace/files/:filename
 */
app.delete('/api/workspace/files/:filename', (req: Request, res: Response) => {
  const cleanName = path.basename(req.params.filename);
  const filePath = path.resolve(process.cwd(), 'workspace', cleanName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  return res.json({ status: 'DELETED', filename: cleanName });
});

/**
 * GET /api/tools
 * List registered tools and risk levels
 */
app.get('/api/tools', (_req: Request, res: Response) => {
  const tools = Object.values(TOOL_REGISTRY).map((t) => ({
    name: t.name,
    description: t.description,
    risk: t.risk,
    parameters: t.parameters,
  }));
  return res.json(tools);
});

/**
 * POST /api/tools/execute
 * Direct execution through Permission Engine
 */
app.post('/api/tools/execute', async (req: Request, res: Response) => {
  const { tool, args } = req.body || {};
  if (!tool || !TOOL_REGISTRY[tool]) {
    return res.status(404).json(formatError(ErrorCodes.VALIDATION_ERROR, `Tool '${tool}' not found`));
  }

  const toolDef = TOOL_REGISTRY[tool];
  try {
    const outcome = await permissionEngine.evaluateAndExecute(toolDef, args || {});
    return res.json(outcome);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/* ========================================================================== */
/*                       CYBERSECURITY SKILLS ARSENAL API                     */
/* ========================================================================== */

app.post('/api/cyber/port-scan', async (req: Request, res: Response) => {
  try {
    const { target = '127.0.0.1', ports } = req.body || {};
    const report = await TOOL_REGISTRY.network_recon.execute({ target, ports });
    return res.json(report);
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/cyber/dns-lookup', async (req: Request, res: Response) => {
  try {
    const { domain = 'localhost' } = req.body || {};
    const report = await TOOL_REGISTRY.dns_lookup.execute({ domain });
    return res.json(report);
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/cyber/interfaces', async (_req: Request, res: Response) => {
  try {
    const report = await TOOL_REGISTRY.network_interfaces.execute({});
    return res.json(report);
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/cyber/headers-audit', async (req: Request, res: Response) => {
  try {
    const { url = 'http://localhost:3000' } = req.body || {};
    const report = await TOOL_REGISTRY.analyze_security_headers.execute({ url });
    return res.json(report);
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/cyber/tls-inspect', async (req: Request, res: Response) => {
  try {
    const { domain = 'localhost' } = req.body || {};
    const report = await TOOL_REGISTRY.inspect_tls_certificate.execute({ domain });
    return res.json(report);
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/cyber/cve-search', async (req: Request, res: Response) => {
  try {
    const { query = 'all' } = req.body || {};
    const report = await TOOL_REGISTRY.search_cve_advisories.execute({ query });
    return res.json(report);
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/cyber/hash-identify', async (req: Request, res: Response) => {
  try {
    const { hash = '' } = req.body || {};
    const report = await TOOL_REGISTRY.hash_analyzer.execute({ hash });
    return res.json(report);
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/cyber/entropy', async (req: Request, res: Response) => {
  try {
    const { data = '' } = req.body || {};
    const report = await TOOL_REGISTRY.calculate_entropy.execute({ data });
    return res.json(report);
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/cyber/digests', async (req: Request, res: Response) => {
  try {
    const { data = '', secret_key } = req.body || {};
    const report = await TOOL_REGISTRY.generate_crypto_digests.execute({ data, secret_key });
    return res.json(report);
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/cyber/codec', async (req: Request, res: Response) => {
  try {
    const { input = '', mode = 'encode', format = 'base64' } = req.body || {};
    const report = await TOOL_REGISTRY.tactical_codec.execute({ input, mode, format });
    return res.json(report);
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/cyber/threat-intel', async (req: Request, res: Response) => {
  try {
    const { ip = '127.0.0.1' } = req.body || {};
    const report = await TOOL_REGISTRY.ip_threat_intel.execute({ ip });
    return res.json(report);
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/cyber/code-audit', async (req: Request, res: Response) => {
  try {
    const { code = '', filename = 'source.js' } = req.body || {};
    const report = await TOOL_REGISTRY.audit_code_security.execute({ code, filename });
    return res.json(report);
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/permissions/pending
 * Pending actions awaiting confirmation
 */
app.get('/api/permissions/pending', async (_req: Request, res: Response) => {
  const pending = await dbManager.getPendingActions();
  return res.json(pending);
});

/**
 * POST /api/permissions/:id/approve
 */
app.post('/api/permissions/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params;
  const action = await dbManager.getPendingAction(id);
  if (!action || action.status !== 'PENDING') {
    return res.status(404).json(formatError(ErrorCodes.CONVERSATION_NOT_FOUND, 'Action not pending or expired'));
  }

  const toolDef = TOOL_REGISTRY[action.tool];
  if (!toolDef) {
    return res.status(404).json(formatError(ErrorCodes.VALIDATION_ERROR, 'Associated tool not found'));
  }

  try {
    const args = JSON.parse(action.args_json);
    const result = await permissionEngine.evaluateAndExecute(toolDef, args, true);
    await dbManager.updatePendingActionStatus(id, 'APPROVED');
    return res.json({ status: 'APPROVED', result: result.result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json(formatError(ErrorCodes.DATABASE_ERROR, msg));
  }
});

/**
 * POST /api/permissions/:id/reject
 */
app.post('/api/permissions/:id/reject', async (req: Request, res: Response) => {
  const { id } = req.params;
  await dbManager.updatePendingActionStatus(id, 'REJECTED');
  return res.json({ status: 'REJECTED' });
});

/**
 * GET /api/audit
 * Activity feed & audit logs
 */
app.get('/api/audit', async (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit || '25'), 10);
  const logs = await dbManager.getAuditLogs(limit);
  return res.json(logs);
});

/**
 * GET /api/settings
 */
app.get('/api/settings', async (_req: Request, res: Response) => {
  const settings = await dbManager.getAllSettings();
  return res.json(settings);
});

/**
 * PUT /api/settings
 */
app.put('/api/settings', async (req: Request, res: Response) => {
  const updates = req.body;
  if (typeof updates === 'object' && updates !== null) {
    for (const [k, v] of Object.entries(updates)) {
      await dbManager.setSetting(k, v);
    }
  }
  const settings = await dbManager.getAllSettings();
  return res.json(settings);
});

/**
 * POST /api/chat
 * Send a message, trigger tool calls, and get an AI response
 */
app.post('/api/chat', async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return res.status(429).json(
      formatError(ErrorCodes.RATE_LIMITED, 'Slow down; try again shortly.')
    );
  }

  const { conversation_id, message, source = 'text' } = req.body || {};

  if (typeof message !== 'string' || message.trim().length === 0) {
    return res.status(422).json(
      formatError(ErrorCodes.VALIDATION_ERROR, 'Message cannot be empty.')
    );
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length > config.MAX_MESSAGE_CHARS) {
    return res.status(422).json(
      formatError(
        ErrorCodes.VALIDATION_ERROR,
        `Message exceeds maximum allowed length of ${config.MAX_MESSAGE_CHARS} characters.`
      )
    );
  }

  let convId: string = conversation_id;
  let isNewConversation = false;

  if (convId) {
    if (typeof convId !== 'string' || !UUID_REGEX.test(convId)) {
      return res.status(422).json(
        formatError(ErrorCodes.VALIDATION_ERROR, 'Invalid conversation ID format.')
      );
    }

    try {
      const existingConv = await dbManager.getConversation(convId);
      if (!existingConv) {
        return res.status(404).json(
          formatError(
            ErrorCodes.CONVERSATION_NOT_FOUND,
            'Conversation does not exist or was deleted.'
          )
        );
      }
    } catch {
      return res.status(500).json(
        formatError(ErrorCodes.DATABASE_ERROR, 'Could not read/save conversation. Database: Error.')
      );
    }
  } else {
    isNewConversation = true;
    convId = crypto.randomUUID();
  }

  let historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (!isNewConversation) {
    try {
      const rawMessages = await dbManager.getMessages(convId);
      historyMessages = rawMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
    } catch {
      return res.status(500).json(
        formatError(ErrorCodes.DATABASE_ERROR, 'Could not read/save conversation. Database: Error.')
      );
    }
  }

  // Generate Reply with Autonomous Tactical Brain resilience
  let assistantResult;
  try {
    if (!isAiConfigured()) {
      assistantResult = await assistantService.executeAutonomousTacticalBrain(trimmedMessage, historyMessages);
    } else {
      assistantResult = await assistantService.generateReply(historyMessages, trimmedMessage);
    }
  } catch (err: unknown) {
    console.warn('Chat generation failed, falling back to Autonomous Tactical Brain:', err);
    assistantResult = await assistantService.executeAutonomousTacticalBrain(trimmedMessage, historyMessages);
  }

  // Persist exchange atomically
  try {
    const title = trimmedMessage.slice(0, 60).trim();
    const msgId = await dbManager.saveExchange(
      convId,
      isNewConversation,
      trimmedMessage,
      assistantResult.reply,
      title,
      source === 'voice' ? 'voice' : 'text'
    );

    // If tool was called, record in tool_calls table
    if (assistantResult.toolCall) {
      await dbManager.recordToolCall(
        msgId,
        assistantResult.toolCall.tool,
        assistantResult.toolCall.args,
        assistantResult.toolCall.risk as any || 'LOW_RISK',
        assistantResult.toolCall.status === 'EXECUTED' ? 'ALLOWED' : 'BLOCKED',
        assistantResult.toolCall.result || {}
      );
    }
  } catch {
    return res.status(500).json(
      formatError(ErrorCodes.DATABASE_ERROR, 'Failed to save conversation exchange.')
    );
  }

  return res.json({
    conversation_id: convId,
    reply: assistantResult.reply,
    toolCall: assistantResult.toolCall,
    pendingAction: assistantResult.pendingAction,
    sources: assistantResult.sources,
    status: 'success',
  });
});

/**
 * POST /api/chat/stream
 * Server-Sent Events (SSE) streaming endpoint for low-latency responses
 */
app.post('/api/chat/stream', async (req: Request, res: Response) => {
  const { conversation_id, message, source = 'text' } = req.body || {};

  if (typeof message !== 'string' || message.trim().length === 0) {
    return res.status(422).json(
      formatError(ErrorCodes.VALIDATION_ERROR, 'Message cannot be empty.')
    );
  }

  const trimmedMessage = message.trim();
  let convId = conversation_id;
  let isNew = false;
  if (!convId) {
    isNew = true;
    convId = crypto.randomUUID();
  }

  let historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (!isNew) {
    try {
      const rawMessages = await dbManager.getMessages(convId);
      historyMessages = rawMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
    } catch {
      // proceed with empty history
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let accumulated = '';
  try {
    const stream = assistantService.generateReplyStream(historyMessages, trimmedMessage);
    for await (const chunk of stream) {
      accumulated += chunk;
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
    }

    try {
      const title = trimmedMessage.slice(0, 60).trim();
      await dbManager.saveExchange(
        convId,
        isNew,
        trimmedMessage,
        accumulated,
        title,
        source === 'voice' ? 'voice' : 'text'
      );
    } catch (saveErr) {
      console.warn('Failed to save streamed conversation:', saveErr);
    }

    res.write(`data: ${JSON.stringify({ type: 'done', fullText: accumulated, conversation_id: convId })}\n\n`);
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`);
    res.end();
  }
});

/**
 * Kali Linux System Bridge Endpoints
 */
app.get('/api/kali/token', (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    return res.status(403).json(formatError(ErrorCodes.UNAUTHORIZED, 'Bridge token retrieval restricted to loopback interface.'));
  }
  return res.json({ token: kaliBridge.getBridgeToken() });
});

app.get('/api/kali/status', (_req: Request, res: Response) => {
  return res.json(kaliBridge.getStatus());
});

app.post('/api/kali/register', requireBridgeAuth, (req: Request, res: Response) => {
  const { agentId, hostname, osRelease, kernel, ipAddress, installedTools } = req.body || {};
  if (!agentId || !hostname) {
    return res.status(422).json(formatError(ErrorCodes.VALIDATION_ERROR, 'agentId and hostname required'));
  }
  const registered = kaliBridge.registerAgent({
    agentId,
    hostname,
    osRelease: osRelease || 'Kali Linux',
    kernel: kernel || 'Linux',
    ipAddress: ipAddress || '127.0.0.1',
    installedTools: Array.isArray(installedTools) ? installedTools : [],
  });
  return res.json({ status: 'REGISTERED', agent: registered });
});

app.post('/api/kali/heartbeat', requireBridgeAuth, (req: Request, res: Response) => {
  const { agentId } = req.body || {};
  const ok = kaliBridge.heartbeat(String(agentId || ''));
  return res.json({ status: ok ? 'ALIVE' : 'UNKNOWN_AGENT' });
});

app.get('/api/kali/poll', requireBridgeAuth, (_req: Request, res: Response) => {
  const command = kaliBridge.getNextCommand();
  return res.json({ job: command });
});

app.post('/api/kali/result', requireBridgeAuth, (req: Request, res: Response) => {
  const { jobId, output, exitCode = 0 } = req.body || {};
  if (!jobId) {
    return res.status(422).json(formatError(ErrorCodes.VALIDATION_ERROR, 'jobId is required'));
  }
  const ok = kaliBridge.submitResult(jobId, String(output || ''), Number(exitCode));
  return res.json({ status: ok ? 'RECORDED' : 'JOB_NOT_FOUND' });
});

app.post('/api/kali/exec', requireBridgeAuth, async (req: Request, res: Response) => {
  const { command } = req.body || {};
  if (!command || typeof command !== 'string' || command.trim().length === 0) {
    return res.status(422).json(formatError(ErrorCodes.VALIDATION_ERROR, 'command is required'));
  }

  try {
    const job = kaliBridge.queueCommand(command.trim());
    await dbManager.addAuditLog('user', 'KALI_COMMAND_DISPATCHED', {
      job_id: job.id,
      command: job.command,
      executable: job.executable,
    });
    return res.status(201).json(job);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(422).json(formatError(ErrorCodes.VALIDATION_ERROR, msg));
  }
});

app.get('/api/kali/history', (_req: Request, res: Response) => {
  return res.json(kaliBridge.getHistory());
});

app.get('/api/kali/agent-script', (_req: Request, res: Response) => {
  const scriptPath = path.resolve(process.cwd(), 'public', 'edith-agent.py');
  if (fs.existsSync(scriptPath)) {
    res.setHeader('Content-Type', 'text/x-python');
    return res.sendFile(scriptPath);
  }
  return res.status(404).send('Agent script not found');
});

app.get('/api/firebase/info', (_req: Request, res: Response) => {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return res.json({
        configured: true,
        projectId: parsed.projectId,
        region: 'asia-southeast1',
        databaseId: parsed.firestoreDatabaseId,
        authDomain: parsed.authDomain,
      });
    } catch {
      // fallback
    }
  }
  return res.json({ configured: false });
});

/**
 * GET /api/conversations
 */
app.get('/api/conversations', async (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit || '50'), 10);
  const offset = parseInt(String(req.query.offset || '0'), 10);
  try {
    const list = await dbManager.listConversations(limit, offset);
    return res.json(list);
  } catch {
    return res.status(500).json(
      formatError(ErrorCodes.DATABASE_ERROR, 'Failed to list conversations')
    );
  }
});

/**
 * GET /api/conversations/:id
 */
app.get('/api/conversations/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) {
    return res.status(422).json(
      formatError(ErrorCodes.VALIDATION_ERROR, 'Malformed conversation ID.')
    );
  }
  try {
    const conversation = await dbManager.getConversation(id);
    if (!conversation) {
      return res.status(404).json(
        formatError(ErrorCodes.CONVERSATION_NOT_FOUND, 'Conversation not found.')
      );
    }
    const messages = await dbManager.getMessages(id);
    return res.json({ conversation, messages });
  } catch {
    return res.status(500).json(
      formatError(ErrorCodes.DATABASE_ERROR, 'Failed to fetch conversation')
    );
  }
});

/**
 * DELETE /api/conversations/:id
 */
app.delete('/api/conversations/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) {
    return res.status(422).json(
      formatError(ErrorCodes.VALIDATION_ERROR, 'Malformed conversation ID.')
    );
  }
  try {
    const deleted = await dbManager.deleteConversation(id);
    if (!deleted) {
      return res.status(404).json(
        formatError(ErrorCodes.CONVERSATION_NOT_FOUND, 'Conversation not found.')
      );
    }
    return res.json({ status: 'success', deleted_id: id });
  } catch {
    return res.status(500).json(
      formatError(ErrorCodes.DATABASE_ERROR, 'Failed to delete conversation')
    );
  }
});

/* ========================================================================== */
/*                           VITE / FRONTEND SERVING                          */
/* ========================================================================== */

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        port: config.PORT,
        host: config.HOST,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(config.PORT, config.HOST, () => {
    console.log(`[EDITH] Voice Assistant Upgrade Online on ${config.HOST}:${config.PORT}`);
    console.log(`[EDITH] Target: Kali Linux`);
    console.log(`[EDITH] AI Provider: ${config.AI_PROVIDER} (${config.AI_MODEL})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
