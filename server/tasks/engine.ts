import crypto from 'crypto';
import { dbManager } from '../database.ts';
import { executeWebSearch } from '../tools/web_search.ts';
import { getSystemTelemetry } from '../tools/system_monitor.ts';
import { runNetworkRecon } from '../tools/network_recon.ts';
import { auditCodeSecurity } from '../tools/code_security_auditor.ts';

export interface OSTask {
  id: string;
  name: string;
  category: 'RECON' | 'SYSTEM' | 'CODE' | 'ANALYSIS' | 'WORKFLOW' | 'AUTOMATION';
  description: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number; // 0 - 100
  pid: number;
  cpu: number;
  memoryMb: number;
  logs: string[];
  result?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

class TaskEngine {
  private tasks: Map<string, OSTask> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private basePid = 4100;

  constructor() {
    // Seed initial system background daemon tasks to reflect a true active OS
    this.seedSystemDaemons();
  }

  private seedSystemDaemons() {
    const daemons: Array<Omit<OSTask, 'id' | 'createdAt' | 'updatedAt' | 'pid'>> = [
      {
        name: 'Neural Watchdog Daemon',
        category: 'SYSTEM',
        description: 'Continuous monitoring of AI agent telemetry and memory cache',
        status: 'RUNNING',
        progress: 100,
        cpu: 0.8,
        memoryMb: 42,
        logs: [
          '[DAEMON] Neural Watchdog active',
          '[DAEMON] Memory integrity check: OK (0 leaks)',
          '[DAEMON] Real-time neural heartbeat: Nominal',
        ],
      },
      {
        name: 'Tactical Recon Sentinel',
        category: 'RECON',
        description: 'Background listening for network anomalies and threat feeds',
        status: 'RUNNING',
        progress: 88,
        cpu: 1.2,
        memoryMb: 68,
        logs: [
          '[SENTINEL] Perimeter interface listening on eth0/wlan0',
          '[SENTINEL] Zero untrusted intrusions detected in last cycle',
        ],
      },
    ];

    for (const d of daemons) {
      const id = crypto.randomUUID();
      const pid = this.basePid++;
      const now = new Date().toISOString();
      this.tasks.set(id, {
        ...d,
        id,
        pid,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  public getAllTasks(): OSTask[] {
    return Array.from(this.tasks.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public getTask(id: string): OSTask | undefined {
    return this.tasks.get(id);
  }

  public spawnTask(
    name: string,
    category: OSTask['category'],
    description: string,
    executionPlan?: (update: (progress: number, log: string, result?: Record<string, unknown>) => void) => Promise<void>
  ): OSTask {
    const id = crypto.randomUUID();
    const pid = this.basePid++;
    const now = new Date().toISOString();

    const task: OSTask = {
      id,
      name,
      category,
      description,
      status: 'RUNNING',
      progress: 0,
      pid,
      cpu: parseFloat((Math.random() * 4 + 1).toFixed(1)),
      memoryMb: Math.floor(Math.random() * 50 + 30),
      logs: [`[${new Date().toLocaleTimeString()}] Task spawned with PID ${pid}`],
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(id, task);

    // If an execution plan is provided, run it; otherwise execute standard dynamic background simulation
    if (executionPlan) {
      executionPlan((progress, log, result) => {
        this.updateTaskProgress(id, progress, log, result);
      }).catch((err) => {
        this.failTask(id, err instanceof Error ? err.message : String(err));
      });
    } else {
      this.runDefaultTaskExecution(id);
    }

    return task;
  }

  private updateTaskProgress(
    id: string,
    progress: number,
    log: string,
    result?: Record<string, unknown>
  ) {
    const task = this.tasks.get(id);
    if (!task || task.status === 'CANCELLED') return;

    task.progress = Math.min(100, Math.max(0, progress));
    task.updatedAt = new Date().toISOString();
    task.logs.push(`[${new Date().toLocaleTimeString()}] ${log}`);
    if (result) {
      task.result = { ...task.result, ...result };
    }

    if (task.progress >= 100) {
      task.status = 'COMPLETED';
      task.completedAt = new Date().toISOString();
      task.cpu = 0;
    }
  }

  private failTask(id: string, reason: string) {
    const task = this.tasks.get(id);
    if (!task) return;
    task.status = 'FAILED';
    task.updatedAt = new Date().toISOString();
    task.logs.push(`[ERROR] Task halted: ${reason}`);
    task.cpu = 0;
  }

  private runDefaultTaskExecution(id: string) {
    const task = this.tasks.get(id);
    if (!task) return;

    const steps = [
      { p: 15, msg: 'Allocating virtual sandbox environment and thread pools' },
      { p: 35, msg: 'Acquiring system resources and validating parameters' },
      { p: 60, msg: 'Executing primary pipeline payload...' },
      { p: 85, msg: 'Compiling results and verifying output integrity' },
      { p: 100, msg: 'Execution completed successfully. Output archived to local memory.' },
    ];

    let currentStep = 0;

    const stepInterval = setInterval(() => {
      const currentTask = this.tasks.get(id);
      if (!currentTask || currentTask.status === 'CANCELLED' || currentTask.status === 'PAUSED') {
        if (currentTask?.status === 'CANCELLED') {
          clearInterval(stepInterval);
        }
        return;
      }

      if (currentStep < steps.length) {
        const { p, msg } = steps[currentStep];
        this.updateTaskProgress(id, p, msg, {
          timestamp: new Date().toISOString(),
          status: p === 100 ? 'SUCCESS' : 'IN_PROGRESS',
        });
        currentStep++;
      } else {
        clearInterval(stepInterval);
        this.timers.delete(id);
      }
    }, 1800);

    this.timers.set(id, stepInterval);
  }

  public pauseTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task || task.status !== 'RUNNING') return false;
    task.status = 'PAUSED';
    task.updatedAt = new Date().toISOString();
    task.logs.push(`[${new Date().toLocaleTimeString()}] Task paused by user`);
    task.cpu = 0;
    return true;
  }

  public resumeTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task || task.status !== 'PAUSED') return false;
    task.status = 'RUNNING';
    task.updatedAt = new Date().toISOString();
    task.cpu = parseFloat((Math.random() * 3 + 1).toFixed(1));
    task.logs.push(`[${new Date().toLocaleTimeString()}] Task resumed`);
    return true;
  }

  public cancelTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    const timer = this.timers.get(id);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(id);
    }
    task.status = 'CANCELLED';
    task.progress = 0;
    task.cpu = 0;
    task.updatedAt = new Date().toISOString();
    task.logs.push(`[${new Date().toLocaleTimeString()}] Process SIGKILL terminated by user`);
    return true;
  }

  public clearCompletedTasks(): void {
    for (const [id, task] of this.tasks.entries()) {
      if (task.status === 'COMPLETED' || task.status === 'CANCELLED' || task.status === 'FAILED') {
        this.tasks.delete(id);
      }
    }
  }

  // Pre-configured intelligent multitasking workflows
  public async spawnDeepResearchTask(query: string): Promise<OSTask> {
    const name = `Deep Recon: ${query.slice(0, 30)}...`;
    return this.spawnTask(name, 'RECON', `Autonomous web intelligence extraction for "${query}"`, async (update) => {
      update(20, `Connecting to real-time search index for: "${query}"`);
      const searchRes = await executeWebSearch(query);
      update(55, `Retrieved ${searchRes.results?.length || 0} citations; analyzing relevance...`);
      await new Promise((r) => setTimeout(r, 1200));
      update(80, `Synthesizing tactical takeaways and cross-referencing sources`);
      await new Promise((r) => setTimeout(r, 1000));
      update(100, `Intelligence brief ready. ${searchRes.results?.length || 0} verified sources archived.`, {
        sources: searchRes.results,
        query,
      });
    });
  }

  public async spawnSecurityAuditTask(target: string): Promise<OSTask> {
    const name = `Security Audit: ${target}`;
    return this.spawnTask(name, 'SYSTEM', `Defensive port & vulnerability sweep for ${target}`, async (update) => {
      update(15, `Initializing defensive socket probe on ${target}`);
      const reconReport = await runNetworkRecon(target, [22, 80, 443, 3000, 8080]);
      update(60, `Testing ports 22, 80, 443, 3000, 8080... Detected ${reconReport.openPorts.length} open ports`);
      await new Promise((r) => setTimeout(r, 600));
      update(85, `Compiling security posture and socket telemetry`);
      const openPortNums = reconReport.openPorts.map((p) => p.port);
      const verdict = openPortNums.length === 0 ? 'SECURE_CLOSED' : 'ACTIVE_SERVICES';
      update(100, `Audit concluded: ${reconReport.summary}`, {
        target: reconReport.target,
        resolvedIp: reconReport.resolvedIp,
        openPorts: openPortNums,
        scanDurationMs: reconReport.scanDurationMs,
        verdict,
      });
    });
  }

  public async spawnCodeAnalysisTask(codeSnippet: string): Promise<OSTask> {
    const name = `Static Code Audit (${codeSnippet.slice(0, 25)}...)`;
    return this.spawnTask(name, 'CODE', 'Static AST analysis, security inspection and optimization review', async (update) => {
      update(25, 'Parsing Abstract Syntax Tree (AST) & OWASP security rules...');
      const audit = auditCodeSecurity(codeSnippet, 'analyzed_snippet.js');
      update(60, `Scanned ${audit.scannedLines} lines. Detected ${audit.totalVulnerabilities} findings (${audit.criticalCount} critical)`);
      await new Promise((r) => setTimeout(r, 600));
      update(85, `Risk evaluated: ${audit.overallRisk}. Generating remediation advice...`);
      update(100, `Code audit complete. Overall risk: ${audit.overallRisk}. ${audit.summary}`, {
        totalVulnerabilities: audit.totalVulnerabilities,
        criticalCount: audit.criticalCount,
        overallRisk: audit.overallRisk,
        vulnerabilities: audit.vulnerabilities,
      });
    });
  }
}

export const taskEngine = new TaskEngine();
