import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

export interface DbConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface DbMessage {
  id: number;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'voice' | 'text';
  created_at: string;
}

export interface DbToolCall {
  id: string;
  message_id?: number | null;
  tool: string;
  args_json: string;
  risk: 'READ_ONLY' | 'LOW_RISK' | 'REQUIRES_CONFIRMATION' | 'BLOCKED_BY_DEFAULT';
  decision: 'ALLOWED' | 'CONFIRMED' | 'REJECTED' | 'BLOCKED';
  result_json: string;
  created_at: string;
}

export interface DbPendingAction {
  id: string;
  tool: string;
  args_json: string;
  impact_text: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  expires_at: string;
}

export interface DbAuditLog {
  id: string;
  ts: string;
  actor: string;
  event: string;
  details_json: string;
}

export interface DbProject {
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

export interface DbTask {
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
  relevant_files_json: string;
  checkpoint_data_json: string;
  completion_evidence_json: string;
  error_info: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface DbTaskStep {
  id: string;
  task_id: string;
  step_number: number;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  output: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface DbTaskCheckpoint {
  id: string;
  task_id: string;
  checkpoint_name: string;
  state_data_json: string;
  created_at: string;
}

export interface DbSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  active_project_id: string | null;
  active_task_id: string | null;
  summary: string | null;
  suggested_next_action: string | null;
  exit_reason: 'clean_shutdown' | 'crashed' | 'interrupted' | 'active';
}

export interface DbWorkspaceActivity {
  id: string;
  session_id: string | null;
  action_type: string;
  target: string;
  details_json: string;
  verified: number;
  created_at: string;
}

export interface DbMemoryRecord {
  id: string;
  key: string;
  category: 'project' | 'preference' | 'architecture' | 'user_instruction';
  content: string;
  confidence: number;
  source: 'user_explicit' | 'verified_system' | 'inferred_summary';
  created_at: string;
  updated_at: string;
}

export interface SessionRecoveryState {
  currentSessionId: string;
  previousSession: DbSession | null;
  interruptedTasks: DbTask[];
  lastActiveProject: DbProject | null;
  lastActiveTask: DbTask | null;
  resumeSummary: string;
  suggestedNextAction: string;
}

export function sanitizeMemoryContent(content: string): string {
  if (!content) return '';
  return content
    .replace(/(?:AIzaSy[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9_-]{10,}|Bearer\s+[A-Za-z0-9_.-]+|[a-f0-9]{32,64})/gi, '[REDACTED_SECRET]')
    .replace(/(api[_-]?key|password|secret|token)\s*[:=]\s*["']?[^"'\s]+["']?/gi, '$1=[REDACTED]');
}

class DatabaseManager {
  private db: SqlJsDatabase | null = null;
  private dbPath: string = path.resolve(process.cwd(), 'edith.db');
  private initPromise: Promise<void> | null = null;
  private currentSessionId: string | null = null;
  private recoveryState: SessionRecoveryState | null = null;

  public async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const SQL = await initSqlJs();
      if (fs.existsSync(this.dbPath)) {
        try {
          const fileBuffer = fs.readFileSync(this.dbPath);
          this.db = new SQL.Database(fileBuffer);
        } catch {
          this.db = new SQL.Database();
        }
      } else {
        this.db = new SQL.Database();
      }

      this.db.run('PRAGMA foreign_keys = ON;');

      // 1. Conversations
      this.db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // 2. Messages
      this.db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          source TEXT DEFAULT 'text',
          created_at TEXT NOT NULL,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
      `);

      try {
        this.db.run('ALTER TABLE messages ADD COLUMN source TEXT DEFAULT "text";');
      } catch {
        // column already exists
      }

      // 3. Tool Calls
      this.db.run(`
        CREATE TABLE IF NOT EXISTS tool_calls (
          id TEXT PRIMARY KEY,
          message_id INTEGER,
          tool TEXT NOT NULL,
          args_json TEXT NOT NULL,
          risk TEXT NOT NULL,
          decision TEXT NOT NULL,
          result_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
        );
      `);

      // 4. Pending Actions (for approval dialog)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS pending_actions (
          id TEXT PRIMARY KEY,
          tool TEXT NOT NULL,
          args_json TEXT NOT NULL,
          impact_text TEXT NOT NULL,
          status TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );
      `);

      // 5. System Settings
      this.db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL
        );
      `);

      // 6. Audit Log
      this.db.run(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id TEXT PRIMARY KEY,
          ts TEXT NOT NULL,
          actor TEXT NOT NULL,
          event TEXT NOT NULL,
          details_json TEXT NOT NULL
        );
      `);

      // 7. Search Cache
      this.db.run(`
        CREATE TABLE IF NOT EXISTS search_cache (
          query TEXT PRIMARY KEY,
          results_json TEXT NOT NULL,
          fetched_at TEXT NOT NULL
        );
      `);

      // 8. Performance & Integrity Indices
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_tool_calls_msg ON tool_calls(message_id);
        CREATE INDEX IF NOT EXISTS idx_pending_actions_stat ON pending_actions(status);
        CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(ts);
      `);

      // 9. Phase 2: Projects
      this.db.run(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // 10. Phase 2: Tasks
      this.db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT 'WORKFLOW',
          status TEXT NOT NULL DEFAULT 'pending',
          progress INTEGER NOT NULL DEFAULT 0,
          pid INTEGER,
          last_completed_step TEXT,
          next_planned_step TEXT,
          relevant_files_json TEXT NOT NULL DEFAULT '[]',
          checkpoint_data_json TEXT NOT NULL DEFAULT '{}',
          completion_evidence_json TEXT NOT NULL DEFAULT '{}',
          error_info TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
        );
      `);

      // 11. Phase 2: Task Steps
      this.db.run(`
        CREATE TABLE IF NOT EXISTS task_steps (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          step_number INTEGER NOT NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          output TEXT,
          created_at TEXT NOT NULL,
          completed_at TEXT,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
      `);

      // 12. Phase 2: Task Checkpoints
      this.db.run(`
        CREATE TABLE IF NOT EXISTS task_checkpoints (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          checkpoint_name TEXT NOT NULL,
          state_data_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
      `);

      // 13. Phase 2: Sessions
      this.db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          active_project_id TEXT,
          active_task_id TEXT,
          summary TEXT,
          suggested_next_action TEXT,
          exit_reason TEXT NOT NULL DEFAULT 'active'
        );
      `);

      // 14. Phase 2: Workspace Activity (Distinguishes verified vs AI-generated)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS workspace_activity (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          action_type TEXT NOT NULL,
          target TEXT NOT NULL,
          details_json TEXT NOT NULL DEFAULT '{}',
          verified INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
        );
      `);

      // 15. Phase 2: Memory Records (Key-Value Knowledge and User Instructions)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS memory_records (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'project',
          content TEXT NOT NULL,
          confidence REAL NOT NULL DEFAULT 1.0,
          source TEXT NOT NULL DEFAULT 'verified_system',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // Phase 2 Indices
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_task_steps_task ON task_steps(task_id);
        CREATE INDEX IF NOT EXISTS idx_task_checkpoints_task ON task_checkpoints(task_id);
        CREATE INDEX IF NOT EXISTS idx_workspace_activity_session ON workspace_activity(session_id);
        CREATE INDEX IF NOT EXISTS idx_memory_records_key ON memory_records(key);
      `);

      // Seed default settings if empty
      this.seedDefaultSettings();

      // Seed default project if empty
      this.seedDefaultProject();

      // Perform Session Recovery (Detect interrupted tasks and crash recovery)
      this.performSessionRecovery();

      this.saveToDisk();
    })();

    return this.initPromise;
  }

  private seedDefaultSettings(): void {
    if (!this.db) return;
    const defaults: Record<string, unknown> = {
      mic_enabled: false,
      voice_enabled: true,
      wake_word_enabled: false,
      wake_phrase: 'Hey EDITH',
      voice_speed: 1.0,
      speech_voice: 'en-US',
      speech_voice_id: 'XZXyuzPdidXaSa10PmVA',
      speech_voice_name: 'EDITH Tactical Voice (XZXyuzPdidXaSa10PmVA)',
      firebase_sync_enabled: true,
      kali_bridge_enabled: true,
      workspace_dir: '~/workspace',
      allowed_scan_targets: ['127.0.0.1', 'localhost', '192.168.1.0/24'],
      allowed_applications: ['firefox', 'code', 'terminal', 'thunar', 'burpsuite', 'wireshark'],
      privacy_retention_days: 30,
    };

    for (const [key, val] of Object.entries(defaults)) {
      try {
        const stmt = this.db.prepare('SELECT key FROM settings WHERE key = :k');
        stmt.bind({ ':k': key });
        if (!stmt.step()) {
          this.db.run('INSERT INTO settings (key, value_json) VALUES (?, ?)', [
            key,
            JSON.stringify(val),
          ]);
        }
        stmt.free();
      } catch {
        // ignore
      }
    }
  }

  private saveToDisk(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (err) {
      console.error('Failed to persist SQLite database to disk:', err);
    }
  }

  public async ping(): Promise<boolean> {
    await this.initialize();
    if (!this.db) return false;
    try {
      const result = this.db.exec('SELECT 1 as alive;');
      return Boolean(result.length > 0 && result[0].values.length > 0);
    } catch {
      return false;
    }
  }

  public async getConversation(id: string): Promise<DbConversation | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      'SELECT id, title, created_at, updated_at FROM conversations WHERE id = :id'
    );
    stmt.bind({ ':id': id });

    if (stmt.step()) {
      const row = stmt.getAsObject() as unknown as DbConversation;
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  public async listConversations(limit = 50, offset = 0): Promise<DbConversation[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT 
        c.id, 
        c.title, 
        c.created_at, 
        c.updated_at,
        COUNT(m.id) as message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      GROUP BY c.id
      ORDER BY c.updated_at DESC
      LIMIT :limit OFFSET :offset
    `);

    stmt.bind({ ':limit': limit, ':offset': offset });

    const results: DbConversation[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: String(row.id),
        title: String(row.title),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        message_count: Number(row.message_count || 0),
      });
    }
    stmt.free();
    return results;
  }

  public async getMessages(conversationId: string): Promise<DbMessage[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT id, conversation_id, role, content, source, created_at
      FROM messages
      WHERE conversation_id = :cid
      ORDER BY id ASC
    `);

    stmt.bind({ ':cid': conversationId });

    const messages: DbMessage[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      messages.push({
        id: Number(row.id),
        conversation_id: String(row.conversation_id),
        role: row.role as 'user' | 'assistant',
        content: String(row.content),
        source: (row.source as 'voice' | 'text') || 'text',
        created_at: String(row.created_at),
      });
    }
    stmt.free();
    return messages;
  }

  public async saveExchange(
    conversationId: string,
    isNew: boolean,
    userMessage: string,
    assistantReply: string,
    title?: string,
    source: 'voice' | 'text' = 'text'
  ): Promise<number> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();

    try {
      this.db.run('BEGIN TRANSACTION;');

      if (isNew) {
        const convTitle = title || userMessage.slice(0, 60).trim();
        this.db.run(
          'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?);',
          [conversationId, convTitle, now, now]
        );
      } else {
        this.db.run('UPDATE conversations SET updated_at = ? WHERE id = ?;', [
          now,
          conversationId,
        ]);
      }

      this.db.run(
        'INSERT INTO messages (conversation_id, role, content, source, created_at) VALUES (?, ?, ?, ?, ?);',
        [conversationId, 'user', userMessage, source, now]
      );

      this.db.run(
        'INSERT INTO messages (conversation_id, role, content, source, created_at) VALUES (?, ?, ?, ?, ?);',
        [conversationId, 'assistant', assistantReply, source, now]
      );

      // Fetch last insert id
      const res = this.db.exec('SELECT last_insert_rowid() as id;');
      const lastId = res[0]?.values[0]?.[0] ? Number(res[0].values[0][0]) : 0;

      this.db.run('COMMIT;');
      this.saveToDisk();
      return lastId;
    } catch (error) {
      try {
        this.db.run('ROLLBACK;');
      } catch {
        // ignore
      }
      throw error;
    }
  }

  public async deleteConversation(id: string): Promise<boolean> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const conv = await this.getConversation(id);
    if (!conv) return false;

    try {
      this.db.run('BEGIN TRANSACTION;');
      this.db.run('DELETE FROM messages WHERE conversation_id = ?;', [id]);
      this.db.run('DELETE FROM conversations WHERE id = ?;', [id]);
      this.db.run('COMMIT;');
      this.saveToDisk();
      return true;
    } catch (err) {
      try {
        this.db.run('ROLLBACK;');
      } catch {
        // ignore
      }
      throw err;
    }
  }

  /* ---------------------- AUDIT LOGGING & ACTIVITY ------------------------ */

  public async addAuditLog(
    actor: string,
    event: string,
    details: Record<string, unknown>
  ): Promise<void> {
    await this.initialize();
    if (!this.db) return;
    const id = crypto.randomUUID();
    const ts = new Date().toISOString();
    try {
      this.db.run(
        'INSERT INTO audit_log (id, ts, actor, event, details_json) VALUES (?, ?, ?, ?, ?)',
        [id, ts, actor, event, JSON.stringify(details)]
      );
      this.saveToDisk();
    } catch (e) {
      console.error('Failed to log audit event:', e);
    }
  }

  public async getAuditLogs(limit = 20): Promise<DbAuditLog[]> {
    await this.initialize();
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare(
        'SELECT id, ts, actor, event, details_json FROM audit_log ORDER BY ts DESC LIMIT :limit'
      );
      stmt.bind({ ':limit': limit });
      const logs: DbAuditLog[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        logs.push({
          id: String(row.id),
          ts: String(row.ts),
          actor: String(row.actor),
          event: String(row.event),
          details_json: String(row.details_json),
        });
      }
      stmt.free();
      return logs;
    } catch {
      return [];
    }
  }

  /* ------------------- PENDING ACTIONS & PERMISSIONS --------------------- */

  public async createPendingAction(
    tool: string,
    args: Record<string, unknown>,
    impactText: string,
    expiresInSeconds = 60
  ): Promise<DbPendingAction> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    const action: DbPendingAction = {
      id,
      tool,
      args_json: JSON.stringify(args),
      impact_text: impactText,
      status: 'PENDING',
      expires_at: expiresAt,
    };

    this.db.run(
      'INSERT INTO pending_actions (id, tool, args_json, impact_text, status, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [action.id, action.tool, action.args_json, action.impact_text, action.status, action.expires_at]
    );
    this.saveToDisk();

    await this.addAuditLog('system', 'PENDING_ACTION_CREATED', {
      action_id: id,
      tool,
      impact: impactText,
    });

    return action;
  }

  public async getPendingActions(): Promise<DbPendingAction[]> {
    await this.initialize();
    if (!this.db) return [];
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      'SELECT id, tool, args_json, impact_text, status, expires_at FROM pending_actions WHERE status = "PENDING" AND expires_at > :now ORDER BY expires_at ASC'
    );
    stmt.bind({ ':now': now });
    const list: DbPendingAction[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      list.push({
        id: String(row.id),
        tool: String(row.tool),
        args_json: String(row.args_json),
        impact_text: String(row.impact_text),
        status: row.status as 'PENDING',
        expires_at: String(row.expires_at),
      });
    }
    stmt.free();
    return list;
  }

  public async getPendingAction(id: string): Promise<DbPendingAction | null> {
    await this.initialize();
    if (!this.db) return null;
    const stmt = this.db.prepare(
      'SELECT id, tool, args_json, impact_text, status, expires_at FROM pending_actions WHERE id = :id'
    );
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const row = stmt.getAsObject() as unknown as DbPendingAction;
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  public async updatePendingActionStatus(
    id: string,
    status: 'APPROVED' | 'REJECTED' | 'EXPIRED'
  ): Promise<void> {
    await this.initialize();
    if (!this.db) return;
    this.db.run('UPDATE pending_actions SET status = ? WHERE id = ?', [status, id]);
    this.saveToDisk();
    await this.addAuditLog('user', `PENDING_ACTION_${status}`, { action_id: id });
  }

  /* --------------------------- TOOL CALLS -------------------------------- */

  public async recordToolCall(
    messageId: number | null,
    tool: string,
    args: Record<string, unknown>,
    risk: 'READ_ONLY' | 'LOW_RISK' | 'REQUIRES_CONFIRMATION' | 'BLOCKED_BY_DEFAULT',
    decision: 'ALLOWED' | 'CONFIRMED' | 'REJECTED' | 'BLOCKED',
    result: Record<string, unknown>
  ): Promise<void> {
    await this.initialize();
    if (!this.db) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.run(
      'INSERT INTO tool_calls (id, message_id, tool, args_json, risk, decision, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        messageId,
        tool,
        JSON.stringify(args),
        risk,
        decision,
        JSON.stringify(result),
        now,
      ]
    );
    this.saveToDisk();
  }

  /* -------------------------- SETTINGS ----------------------------------- */

  public async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    await this.initialize();
    if (!this.db) return defaultValue;
    const stmt = this.db.prepare('SELECT value_json FROM settings WHERE key = :k');
    stmt.bind({ ':k': key });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      try {
        return JSON.parse(String(row.value_json)) as T;
      } catch {
        return defaultValue;
      }
    }
    stmt.free();
    return defaultValue;
  }

  public async setSetting(key: string, value: unknown): Promise<void> {
    await this.initialize();
    if (!this.db) return;
    this.db.run(
      'INSERT OR REPLACE INTO settings (key, value_json) VALUES (?, ?)',
      [key, JSON.stringify(value)]
    );
    this.saveToDisk();
  }

  public async getAllSettings(): Promise<Record<string, unknown>> {
    await this.initialize();
    if (!this.db) return {};
    const stmt = this.db.prepare('SELECT key, value_json FROM settings');
    const settings: Record<string, unknown> = {};
    while (stmt.step()) {
      const row = stmt.getAsObject();
      try {
        settings[String(row.key)] = JSON.parse(String(row.value_json));
      } catch {
        settings[String(row.key)] = String(row.value_json);
      }
    }
    stmt.free();
    return settings;
  }

  /* -------------------------- SEARCH CACHE ------------------------------- */

  public async getCachedSearch(query: string): Promise<Record<string, unknown>[] | null> {
    await this.initialize();
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT results_json FROM search_cache WHERE query = :q');
    stmt.bind({ ':q': query.trim().toLowerCase() });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      try {
        return JSON.parse(String(row.results_json));
      } catch {
        return null;
      }
    }
    stmt.free();
    return null;
  }

  public async setCachedSearch(
    query: string,
    results: Record<string, unknown>[]
  ): Promise<void> {
    await this.initialize();
    if (!this.db) return;
    const now = new Date().toISOString();
    this.db.run(
      'INSERT OR REPLACE INTO search_cache (query, results_json, fetched_at) VALUES (?, ?, ?)',
      [query.trim().toLowerCase(), JSON.stringify(results), now]
    );
    this.saveToDisk();
  }

  /* ======================================================================== */
  /*               PHASE 2: PROJECTS, TASKS & SESSION RECOVERY                 */
  /* ======================================================================== */

  private seedDefaultProject(): void {
    if (!this.db) return;
    try {
      const stmt = this.db.prepare('SELECT id FROM projects LIMIT 1');
      if (!stmt.step()) {
        const now = new Date().toISOString();
        this.db.run(
          'INSERT INTO projects (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            'proj-core-ops',
            'Tactical Security & OS Operations',
            'Default persistent workspace for EDITH operating system workflows',
            'active',
            now,
            now,
          ]
        );
      }
      stmt.free();
    } catch (e) {
      console.warn('Project seed notice:', e);
    }
  }

  public performSessionRecovery(): SessionRecoveryState {
    if (!this.db) {
      return {
        currentSessionId: 'uninitialized',
        previousSession: null,
        interruptedTasks: [],
        lastActiveProject: null,
        lastActiveTask: null,
        resumeSummary: 'Database not initialized.',
        suggestedNextAction: 'Initialize database connection.',
      };
    }

    const now = new Date().toISOString();
    let previousSession: DbSession | null = null;
    const interruptedTasks: DbTask[] = [];

    try {
      // 1. Inspect previous active session (if system shutdown or crashed)
      const prevStmt = this.db.prepare(
        'SELECT id, started_at, ended_at, active_project_id, active_task_id, summary, suggested_next_action, exit_reason FROM sessions WHERE exit_reason = "active" ORDER BY started_at DESC LIMIT 1'
      );
      if (prevStmt.step()) {
        const row = prevStmt.getAsObject();
        previousSession = {
          id: String(row.id),
          started_at: String(row.started_at),
          ended_at: String(row.ended_at || ''),
          active_project_id: row.active_project_id ? String(row.active_project_id) : null,
          active_task_id: row.active_task_id ? String(row.active_task_id) : null,
          summary: row.summary ? String(row.summary) : null,
          suggested_next_action: row.suggested_next_action ? String(row.suggested_next_action) : null,
          exit_reason: 'active',
        };

        // Mark previous session as interrupted
        this.db.run('UPDATE sessions SET exit_reason = "interrupted", ended_at = ? WHERE id = ?', [
          now,
          previousSession.id,
        ]);
      }
      prevStmt.free();

      // 2. Detect tasks that were in_progress during crash/restart and mark as interrupted
      const tasksStmt = this.db.prepare('SELECT * FROM tasks WHERE status = "in_progress"');
      while (tasksStmt.step()) {
        const row = tasksStmt.getAsObject();
        const task: DbTask = {
          id: String(row.id),
          project_id: row.project_id ? String(row.project_id) : null,
          title: String(row.title),
          description: String(row.description || ''),
          category: (row.category as DbTask['category']) || 'WORKFLOW',
          status: 'interrupted',
          progress: Number(row.progress || 0),
          pid: row.pid ? Number(row.pid) : null,
          last_completed_step: row.last_completed_step ? String(row.last_completed_step) : null,
          next_planned_step: row.next_planned_step ? String(row.next_planned_step) : null,
          relevant_files_json: String(row.relevant_files_json || '[]'),
          checkpoint_data_json: String(row.checkpoint_data_json || '{}'),
          completion_evidence_json: String(row.completion_evidence_json || '{}'),
          error_info: 'Interrupted by system restart/shutdown. Checkpoint and state preserved.',
          created_at: String(row.created_at),
          updated_at: now,
          completed_at: null,
        };

        this.db.run(
          'UPDATE tasks SET status = "interrupted", error_info = ?, updated_at = ? WHERE id = ?',
          [task.error_info, now, task.id]
        );

        interruptedTasks.push(task);
      }
      tasksStmt.free();

      // 3. Create fresh active session row
      const newSessionId = crypto.randomUUID();
      const lastActiveProjId = previousSession?.active_project_id || 'proj-core-ops';
      const lastActiveTaskId = interruptedTasks[0]?.id || previousSession?.active_task_id || null;

      this.db.run(
        'INSERT INTO sessions (id, started_at, active_project_id, active_task_id, exit_reason) VALUES (?, ?, ?, ?, "active")',
        [newSessionId, now, lastActiveProjId, lastActiveTaskId]
      );
      this.currentSessionId = newSessionId;

      // 4. Log workspace activity
      this.logWorkspaceActivity(
        'session_started',
        newSessionId,
        {
          recovered_tasks: interruptedTasks.length,
          previous_session: previousSession?.id || null,
        },
        1
      );

      // 5. Build resume summary and suggested action
      let resumeSummary = 'EDITH Clean Boot: Session initialized. Ready for operations.';
      let suggestedNextAction = 'Launch new workflow or select an existing project.';

      if (interruptedTasks.length > 0) {
        resumeSummary = `EDITH Session Recovery: Detected ${interruptedTasks.length} task(s) interrupted by prior shutdown. Progress and checkpoints preserved.`;
        suggestedNextAction = `Resume task '${interruptedTasks[0].title}' from step '${interruptedTasks[0].last_completed_step || 'initial'}' or dismiss.`;
      } else if (previousSession?.summary) {
        resumeSummary = `Recovered from session ${previousSession.id.slice(0, 8)}. Previous summary: ${previousSession.summary}`;
      }

      let lastActiveProject: DbProject | null = null;
      if (lastActiveProjId) {
        const projStmt = this.db.prepare('SELECT * FROM projects WHERE id = :id');
        projStmt.bind({ ':id': lastActiveProjId });
        if (projStmt.step()) {
          const p = projStmt.getAsObject();
          lastActiveProject = {
            id: String(p.id),
            name: String(p.name),
            description: String(p.description),
            status: p.status as DbProject['status'],
            created_at: String(p.created_at),
            updated_at: String(p.updated_at),
          };
        }
        projStmt.free();
      }

      this.recoveryState = {
        currentSessionId: newSessionId,
        previousSession,
        interruptedTasks,
        lastActiveProject,
        lastActiveTask: interruptedTasks[0] || null,
        resumeSummary,
        suggestedNextAction,
      };

      this.saveToDisk();
      return this.recoveryState;
    } catch (err) {
      console.error('Session recovery error:', err);
      return {
        currentSessionId: this.currentSessionId || 'session-fallback',
        previousSession: null,
        interruptedTasks: [],
        lastActiveProject: null,
        lastActiveTask: null,
        resumeSummary: 'Session recovery completed with fallback mode.',
        suggestedNextAction: 'Review project cockpit.',
      };
    }
  }

  public getSessionRecoveryState(): SessionRecoveryState {
    if (this.recoveryState) return this.recoveryState;
    return this.performSessionRecovery();
  }

  /* ------------------- PROJECTS (CRUD & Memory) --------------------------- */

  public async createProject(name: string, description = ''): Promise<DbProject> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    const id = `proj-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const proj: DbProject = {
      id,
      name: name.trim(),
      description: description.trim(),
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    this.db.run(
      'INSERT INTO projects (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [proj.id, proj.name, proj.description, proj.status, proj.created_at, proj.updated_at]
    );

    this.logWorkspaceActivity('project_created', proj.name, { project_id: id }, 1);
    this.saveToDisk();
    return proj;
  }

  public async getProjects(status?: DbProject['status']): Promise<DbProject[]> {
    await this.initialize();
    if (!this.db) return [];
    let sql = 'SELECT * FROM projects';
    const params: string[] = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY updated_at DESC';
    const stmt = this.db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const list: DbProject[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      list.push({
        id: String(r.id),
        name: String(r.name),
        description: String(r.description || ''),
        status: r.status as DbProject['status'],
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
      });
    }
    stmt.free();
    return list;
  }

  public async getProject(id: string): Promise<DbProject | null> {
    await this.initialize();
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = :id');
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const r = stmt.getAsObject();
      stmt.free();
      return {
        id: String(r.id),
        name: String(r.name),
        description: String(r.description || ''),
        status: r.status as DbProject['status'],
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
      };
    }
    stmt.free();
    return null;
  }

  public async updateProject(id: string, updates: Partial<DbProject>): Promise<DbProject | null> {
    await this.initialize();
    if (!this.db) return null;
    const existing = await this.getProject(id);
    if (!existing) return null;

    const updated: DbProject = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.db.run(
      'UPDATE projects SET name = ?, description = ?, status = ?, updated_at = ? WHERE id = ?',
      [updated.name, updated.description, updated.status, updated.updated_at, id]
    );

    this.saveToDisk();
    return updated;
  }

  /* ------------------- TASKS (Persistent Task Management) ----------------- */

  public async createTask(taskData: {
    title: string;
    description?: string;
    project_id?: string | null;
    category?: DbTask['category'];
    status?: TaskStatus;
    pid?: number;
    relevant_files?: string[];
    steps?: string[];
    next_planned_step?: string;
  }): Promise<DbTask> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const id = `task-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const task: DbTask = {
      id,
      project_id: taskData.project_id || 'proj-core-ops',
      title: taskData.title.trim(),
      description: (taskData.description || '').trim(),
      category: taskData.category || 'WORKFLOW',
      status: taskData.status || 'in_progress',
      progress: 0,
      pid: taskData.pid || null,
      last_completed_step: null,
      next_planned_step: taskData.next_planned_step || taskData.steps?.[0] || 'Initialize process pipeline',
      relevant_files_json: JSON.stringify(taskData.relevant_files || []),
      checkpoint_data_json: JSON.stringify({ initial_state: 'READY' }),
      completion_evidence_json: '{}',
      error_info: null,
      created_at: now,
      updated_at: now,
      completed_at: null,
    };

    this.db.run(
      `INSERT INTO tasks (
        id, project_id, title, description, category, status, progress, pid,
        last_completed_step, next_planned_step, relevant_files_json, checkpoint_data_json,
        completion_evidence_json, error_info, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.project_id,
        task.title,
        task.description,
        task.category,
        task.status,
        task.progress,
        task.pid,
        task.last_completed_step,
        task.next_planned_step,
        task.relevant_files_json,
        task.checkpoint_data_json,
        task.completion_evidence_json,
        task.error_info,
        task.created_at,
        task.updated_at,
        task.completed_at,
      ]
    );

    // Insert steps if provided
    if (taskData.steps && taskData.steps.length > 0) {
      taskData.steps.forEach((stepTitle, idx) => {
        const stepId = `step-${crypto.randomUUID().slice(0, 8)}`;
        this.db?.run(
          'INSERT INTO task_steps (id, task_id, step_number, title, status, created_at) VALUES (?, ?, ?, ?, "pending", ?)',
          [stepId, task.id, idx + 1, stepTitle, now]
        );
      });
    }

    this.logWorkspaceActivity('task_created', task.title, { task_id: task.id }, 1);
    this.saveToDisk();
    return task;
  }

  public async getTasks(
    filterOrProjectId?: string | { projectId?: string; status?: TaskStatus },
    statusFilter?: TaskStatus
  ): Promise<DbTask[]> {
    await this.initialize();
    if (!this.db) return [];

    let projectId: string | undefined;
    let status: TaskStatus | undefined;

    if (typeof filterOrProjectId === 'string') {
      projectId = filterOrProjectId;
      status = statusFilter;
    } else if (filterOrProjectId && typeof filterOrProjectId === 'object') {
      projectId = filterOrProjectId.projectId;
      status = filterOrProjectId.status;
    }

    let sql = 'SELECT * FROM tasks';
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (projectId) {
      conditions.push('project_id = ?');
      params.push(projectId);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY updated_at DESC';

    const stmt = this.db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }

    const tasks: DbTask[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      tasks.push({
        id: String(r.id),
        project_id: r.project_id ? String(r.project_id) : null,
        title: String(r.title),
        description: String(r.description || ''),
        category: (r.category as DbTask['category']) || 'WORKFLOW',
        status: (r.status as TaskStatus) || 'pending',
        progress: Number(r.progress || 0),
        pid: r.pid ? Number(r.pid) : null,
        last_completed_step: r.last_completed_step ? String(r.last_completed_step) : null,
        next_planned_step: r.next_planned_step ? String(r.next_planned_step) : null,
        relevant_files_json: String(r.relevant_files_json || '[]'),
        checkpoint_data_json: String(r.checkpoint_data_json || '{}'),
        completion_evidence_json: String(r.completion_evidence_json || '{}'),
        error_info: r.error_info ? String(r.error_info) : null,
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
        completed_at: r.completed_at ? String(r.completed_at) : null,
      });
    }
    stmt.free();
    return tasks;
  }

  public async getTask(id: string): Promise<DbTask | null> {
    await this.initialize();
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = :id');
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const r = stmt.getAsObject();
      stmt.free();
      return {
        id: String(r.id),
        project_id: r.project_id ? String(r.project_id) : null,
        title: String(r.title),
        description: String(r.description || ''),
        category: (r.category as DbTask['category']) || 'WORKFLOW',
        status: (r.status as TaskStatus) || 'pending',
        progress: Number(r.progress || 0),
        pid: r.pid ? Number(r.pid) : null,
        last_completed_step: r.last_completed_step ? String(r.last_completed_step) : null,
        next_planned_step: r.next_planned_step ? String(r.next_planned_step) : null,
        relevant_files_json: String(r.relevant_files_json || '[]'),
        checkpoint_data_json: String(r.checkpoint_data_json || '{}'),
        completion_evidence_json: String(r.completion_evidence_json || '{}'),
        error_info: r.error_info ? String(r.error_info) : null,
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
        completed_at: r.completed_at ? String(r.completed_at) : null,
      };
    }
    stmt.free();
    return null;
  }

  public async updateTask(id: string, updates: Partial<DbTask>): Promise<DbTask | null> {
    await this.initialize();
    if (!this.db) return null;
    const task = await this.getTask(id);
    if (!task) return null;

    const merged: DbTask = {
      ...task,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.db.run(
      `UPDATE tasks SET
        project_id = ?, title = ?, description = ?, category = ?, status = ?,
        progress = ?, pid = ?, last_completed_step = ?, next_planned_step = ?,
        relevant_files_json = ?, checkpoint_data_json = ?, completion_evidence_json = ?,
        error_info = ?, updated_at = ?, completed_at = ?
      WHERE id = ?`,
      [
        merged.project_id,
        merged.title,
        merged.description,
        merged.category,
        merged.status,
        merged.progress,
        merged.pid,
        merged.last_completed_step,
        merged.next_planned_step,
        merged.relevant_files_json,
        merged.checkpoint_data_json,
        merged.completion_evidence_json,
        merged.error_info,
        merged.updated_at,
        merged.completed_at,
        id,
      ]
    );

    this.saveToDisk();
    return merged;
  }

  public async completeTask(
    taskId: string,
    evidence: Record<string, unknown>
  ): Promise<DbTask | null> {
    await this.initialize();
    if (!this.db) return null;
    const task = await this.getTask(taskId);
    if (!task) return null;

    const now = new Date().toISOString();
    const updated = await this.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      completed_at: now,
      completion_evidence_json: JSON.stringify(evidence),
      last_completed_step: task.next_planned_step || 'Execution finished',
      next_planned_step: null,
      error_info: null,
    });

    this.logWorkspaceActivity('task_completed', task.title, { evidence }, 1);
    return updated;
  }

  public async dismissInterruptedTask(
    taskId: string,
    newStatus: TaskStatus = 'failed',
    resolutionNote = 'Dismissed by user'
  ): Promise<DbTask | null> {
    const updated = await this.updateTask(taskId, {
      status: newStatus,
      error_info: resolutionNote,
    });

    if (this.recoveryState) {
      this.recoveryState.interruptedTasks = this.recoveryState.interruptedTasks.filter(
        (t) => t.id !== taskId
      );
    }

    this.logWorkspaceActivity('task_dismissed', taskId, { newStatus, resolutionNote }, 1);
    return updated;
  }

  public async resumeInterruptedTask(taskId: string): Promise<DbTask | null> {
    const task = await this.getTask(taskId);
    if (!task) return null;

    const updated = await this.updateTask(taskId, {
      status: 'in_progress',
      error_info: null,
    });

    if (this.recoveryState) {
      this.recoveryState.interruptedTasks = this.recoveryState.interruptedTasks.filter(
        (t) => t.id !== taskId
      );
    }

    this.logWorkspaceActivity('task_resumed', task.title, { taskId }, 1);
    return updated;
  }

  /* ------------------- TASK STEPS & CHECKPOINTS --------------------------- */

  public async addTaskStep(
    taskId: string,
    arg2: string | number,
    arg3?: string | number
  ): Promise<DbTaskStep> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    let title: string;
    let stepNumber: number;

    if (typeof arg2 === 'string') {
      title = arg2.trim();
      stepNumber = typeof arg3 === 'number' ? arg3 : 1;
    } else {
      stepNumber = arg2;
      title = String(arg3 || '').trim();
    }

    const id = `step-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const step: DbTaskStep = {
      id,
      task_id: taskId,
      step_number: stepNumber,
      title,
      status: 'pending',
      output: null,
      created_at: now,
      completed_at: null,
    };

    this.db.run(
      'INSERT INTO task_steps (id, task_id, step_number, title, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [step.id, step.task_id, step.step_number, step.title, step.status, step.created_at]
    );

    this.saveToDisk();
    return step;
  }

  public async updateTaskStep(
    stepId: string,
    updates: Partial<DbTaskStep>
  ): Promise<DbTaskStep | null> {
    await this.initialize();
    if (!this.db) return null;

    const stmt = this.db.prepare('SELECT * FROM task_steps WHERE id = :id');
    stmt.bind({ ':id': stepId });
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const r = stmt.getAsObject();
    stmt.free();

    const merged: DbTaskStep = {
      id: String(r.id),
      task_id: String(r.task_id),
      step_number: Number(r.step_number),
      title: String(r.title),
      status: (r.status as DbTaskStep['status']) || 'pending',
      output: r.output ? String(r.output) : null,
      created_at: String(r.created_at),
      completed_at: r.completed_at ? String(r.completed_at) : null,
      ...updates,
    };

    this.db.run(
      'UPDATE task_steps SET title = ?, status = ?, output = ?, completed_at = ? WHERE id = ?',
      [merged.title, merged.status, merged.output, merged.completed_at, stepId]
    );

    this.saveToDisk();
    return merged;
  }

  public async getTaskSteps(taskId: string): Promise<DbTaskStep[]> {
    await this.initialize();
    if (!this.db) return [];
    const stmt = this.db.prepare(
      'SELECT * FROM task_steps WHERE task_id = :tid ORDER BY step_number ASC'
    );
    stmt.bind({ ':tid': taskId });
    const steps: DbTaskStep[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      steps.push({
        id: String(r.id),
        task_id: String(r.task_id),
        step_number: Number(r.step_number),
        title: String(r.title),
        status: (r.status as DbTaskStep['status']) || 'pending',
        output: r.output ? String(r.output) : null,
        created_at: String(r.created_at),
        completed_at: r.completed_at ? String(r.completed_at) : null,
      });
    }
    stmt.free();
    return steps;
  }

  public async createTaskCheckpoint(
    taskId: string,
    checkpointName: string,
    stateData: Record<string, unknown>
  ): Promise<DbTaskCheckpoint> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    const id = `chk-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const chk: DbTaskCheckpoint = {
      id,
      task_id: taskId,
      checkpoint_name: checkpointName.trim(),
      state_data_json: JSON.stringify(stateData),
      created_at: now,
    };

    this.db.run(
      'INSERT INTO task_checkpoints (id, task_id, checkpoint_name, state_data_json, created_at) VALUES (?, ?, ?, ?, ?)',
      [chk.id, chk.task_id, chk.checkpoint_name, chk.state_data_json, chk.created_at]
    );

    // Also update task checkpoint data
    await this.updateTask(taskId, {
      checkpoint_data_json: chk.state_data_json,
    });

    this.saveToDisk();
    return chk;
  }

  public async getTaskCheckpoints(taskId: string): Promise<DbTaskCheckpoint[]> {
    await this.initialize();
    if (!this.db) return [];
    const stmt = this.db.prepare(
      'SELECT * FROM task_checkpoints WHERE task_id = :tid ORDER BY created_at DESC'
    );
    stmt.bind({ ':tid': taskId });
    const list: DbTaskCheckpoint[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      list.push({
        id: String(r.id),
        task_id: String(r.task_id),
        checkpoint_name: String(r.checkpoint_name),
        state_data_json: String(r.state_data_json),
        created_at: String(r.created_at),
      });
    }
    stmt.free();
    return list;
  }

  /* ------------------- WORKSPACE ACTIVITY (Verified Logging) -------------- */

  public logWorkspaceActivity(
    actionType: string,
    target: string,
    details: Record<string, unknown> = {},
    verified: number | boolean = 1
  ): DbWorkspaceActivity {
    const isVerified = Boolean(verified) ? 1 : 0;
    const id = `act-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const act: DbWorkspaceActivity = {
      id,
      session_id: this.currentSessionId,
      action_type: actionType,
      target,
      details_json: JSON.stringify(details),
      verified: isVerified,
      created_at: now,
    };
    if (this.db) {
      try {
        this.db.run(
          'INSERT INTO workspace_activity (id, session_id, action_type, target, details_json, verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            act.id,
            act.session_id,
            act.action_type,
            act.target,
            act.details_json,
            act.verified,
            act.created_at,
          ]
        );
      } catch (e) {
        console.warn('Activity logging warning:', e);
      }
    }
    return act;
  }

  public async getWorkspaceActivity(limit = 30): Promise<DbWorkspaceActivity[]> {
    await this.initialize();
    if (!this.db) return [];
    const stmt = this.db.prepare(
      'SELECT * FROM workspace_activity ORDER BY created_at DESC LIMIT :limit'
    );
    stmt.bind({ ':limit': limit });
    const list: DbWorkspaceActivity[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      list.push({
        id: String(r.id),
        session_id: r.session_id ? String(r.session_id) : null,
        action_type: String(r.action_type),
        target: String(r.target),
        details_json: String(r.details_json || '{}'),
        verified: Number(r.verified || 1),
        created_at: String(r.created_at),
      });
    }
    stmt.free();
    return list;
  }

  /* ------------------- MEMORY RECORDS (Safe Knowledge Store) -------------- */

  public async createMemoryRecord(
    keyOrData:
      | string
      | {
          key: string;
          category?: DbMemoryRecord['category'];
          content: string;
          confidence?: number;
          source?: DbMemoryRecord['source'];
        },
    category?: DbMemoryRecord['category'],
    content?: string,
    confidence = 1.0,
    source: DbMemoryRecord['source'] = 'verified_system'
  ): Promise<DbMemoryRecord> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    let key: string;
    let cat: DbMemoryRecord['category'];
    let text: string;
    let conf: number;
    let src: DbMemoryRecord['source'];

    if (typeof keyOrData === 'object' && keyOrData !== null) {
      key = keyOrData.key;
      cat = keyOrData.category || 'project';
      text = keyOrData.content;
      conf = keyOrData.confidence ?? 1.0;
      src = keyOrData.source || 'verified_system';
    } else {
      key = String(keyOrData);
      cat = category || 'project';
      text = content || '';
      conf = confidence;
      src = source;
    }

    // Memory Safety: Sanitize secrets/keys before saving
    const sanitized = sanitizeMemoryContent(text);
    const id = `mem-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const record: DbMemoryRecord = {
      id,
      key: key.trim().toLowerCase(),
      category: cat,
      content: sanitized,
      confidence: Math.max(0, Math.min(1.0, conf)),
      source: src,
      created_at: now,
      updated_at: now,
    };

    this.db.run(
      'INSERT OR REPLACE INTO memory_records (id, key, category, content, confidence, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        record.id,
        record.key,
        record.category,
        record.content,
        record.confidence,
        record.source,
        record.created_at,
        record.updated_at,
      ]
    );

    this.saveToDisk();
    return record;
  }

  public async getMemoryRecords(category?: DbMemoryRecord['category']): Promise<DbMemoryRecord[]> {
    await this.initialize();
    if (!this.db) return [];

    let sql = 'SELECT * FROM memory_records';
    const params: string[] = [];
    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }
    sql += ' ORDER BY updated_at DESC';

    const stmt = this.db.prepare(sql);
    if (params.length > 0) stmt.bind(params);

    const records: DbMemoryRecord[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      records.push({
        id: String(r.id),
        key: String(r.key),
        category: (r.category as DbMemoryRecord['category']) || 'project',
        content: String(r.content),
        confidence: Number(r.confidence || 1.0),
        source: (r.source as DbMemoryRecord['source']) || 'verified_system',
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
      });
    }
    stmt.free();
    return records;
  }
}

export const dbManager = new DatabaseManager();
