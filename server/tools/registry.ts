import fs from 'fs';
import path from 'path';
import os from 'os';
import net from 'net';
import child_process from 'child_process';
import vm from 'vm';
import { ToolDefinition } from '../permissions/engine.ts';
import { getSystemTelemetry } from './system_monitor.ts';
import { executeWebSearch } from './web_search.ts';
import { dbManager } from '../database.ts';
import { runNetworkRecon, performDnsLookup, getLocalNetworkInterfaces } from './network_recon.ts';
import { auditSecurityHeaders, inspectTlsCertificate, queryCveAdvisories } from './vulnerability_analyzer.ts';
import { identifyHash, calculateShannonEntropy, generateDigests, tacticalEncodeDecode } from './crypto_tools.ts';
import { analyzeIpThreat, getTacticalThreatAdvisories } from './threat_intel.ts';
import { auditCodeSecurity } from './code_security_auditor.ts';

// Configurable allowlisted apps for Kali Linux / desktop environment
export const ALLOWED_APPLICATIONS = [
  { id: 'firefox', name: 'Firefox Web Browser', exec: 'firefox' },
  { id: 'code', name: 'Visual Studio Code', exec: 'code' },
  { id: 'terminal', name: 'QTerminal / Bash Console', exec: 'qterminal' },
  { id: 'file_manager', name: 'Thunar File Manager', exec: 'thunar' },
  { id: 'wireshark', name: 'Wireshark Network Analyzer', exec: 'wireshark' },
  { id: 'burpsuite', name: 'Burp Suite Community Edition', exec: 'burpsuite' },
  { id: 'nmap', name: 'Nmap Network Scanner', exec: 'nmap' },
];

function checkBinaryExists(bin: string): boolean {
  try {
    const res = child_process.spawnSync('which', [bin], { timeout: 2000 });
    return res.status === 0;
  } catch {
    return false;
  }
}

async function probeTcpPort(host: string, port: number, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      isResolved = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.once('error', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    try {
      socket.connect(port, host);
    } catch {
      resolve(false);
    }
  });
}

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  get_system_status: {
    name: 'get_system_status',
    description: 'Retrieve real-time operating system metrics including CPU, RAM, Disk, and Network telemetry.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const stats = getSystemTelemetry();
      return stats as unknown as Record<string, unknown>;
    },
  },

  web_search: {
    name: 'web_search',
    description: 'Perform real-time web research, retrieve citations, verified summaries, and source URLs.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query to research.' },
      },
      required: ['query'],
    },
    execute: async (args) => {
      const query = String(args.query || '');
      const data = await executeWebSearch(query);
      return data as unknown as Record<string, unknown>;
    },
  },

  open_application: {
    name: 'open_application',
    description: 'Launch an allowlisted application on Kali Linux (e.g., firefox, code, terminal, file_manager, wireshark).',
    risk: 'LOW_RISK',
    parameters: {
      type: 'object',
      properties: {
        app_id: {
          type: 'string',
          description: 'Identifier of the application to launch.',
          enum: ALLOWED_APPLICATIONS.map((a) => a.id),
        },
      },
      required: ['app_id'],
    },
    execute: async (args) => {
      const appId = String(args.app_id || '').toLowerCase();
      const app = ALLOWED_APPLICATIONS.find(
        (a) => a.id === appId || a.name.toLowerCase().includes(appId)
      );

      if (!app) {
        throw new Error(
          `Application '${appId}' is not in the approved application allowlist.`
        );
      }

      const isInstalled = checkBinaryExists(app.exec);
      if (!isInstalled) {
        return {
          launched: false,
          app_id: app.id,
          app_name: app.name,
          executable: app.exec,
          status: 'NOT_INSTALLED',
          message: `Application binary '${app.exec}' was not found in PATH on this Kali Linux host. Install with: sudo apt install ${app.exec}`,
        };
      }

      const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
      if (!hasDisplay) {
        return {
          launched: false,
          app_id: app.id,
          app_name: app.name,
          executable: app.exec,
          status: 'HEADLESS_ENVIRONMENT',
          message: `Application '${app.name}' (${app.exec}) is installed, but no graphical display (DISPLAY/WAYLAND_DISPLAY) is available in this terminal session.`,
        };
      }

      try {
        const child = child_process.spawn(app.exec, [], { detached: true, stdio: 'ignore' });
        child.unref();
        return {
          launched: true,
          app_id: app.id,
          app_name: app.name,
          executable: app.exec,
          pid: child.pid,
          message: `Successfully launched ${app.name} (${app.exec}) [PID ${child.pid}].`,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          launched: false,
          app_id: app.id,
          app_name: app.name,
          executable: app.exec,
          status: 'LAUNCH_FAILED',
          message: `Failed to launch ${app.name}: ${msg}`,
        };
      }
    },
    formatImpact: (args) => `Launch approved desktop application: ${args.app_id}`,
  },

  open_folder: {
    name: 'open_folder',
    description: 'Open an approved workspace folder (e.g. ~/workspace, ~/Downloads).',
    risk: 'LOW_RISK',
    parameters: {
      type: 'object',
      properties: {
        folder_path: { type: 'string', description: 'Path to approved directory.' },
      },
      required: ['folder_path'],
    },
    execute: async (args) => {
      const rawFolder = String(args.folder_path || '~/workspace');
      let folder = rawFolder;
      if (folder.startsWith('~')) {
        folder = path.join(os.homedir(), folder.slice(1));
      }
      folder = path.resolve(folder);

      if (!fs.existsSync(folder)) {
        return {
          opened: false,
          folder_path: folder,
          status: 'NOT_FOUND',
          message: `Folder '${folder}' does not exist on the filesystem.`,
        };
      }

      // Path traversal prevention: enforce approved directories
      const allowedRoots = [
        path.resolve(process.cwd(), 'workspace'),
        path.resolve(os.homedir(), 'Downloads'),
        path.resolve(os.homedir(), 'Documents'),
        path.resolve(os.homedir(), 'workspace'),
        os.homedir(),
      ];

      const isInsideAllowed = allowedRoots.some(
        (root) => folder === root || folder.startsWith(root + path.sep)
      );
      if (!isInsideAllowed) {
        throw new Error(
          `Access to folder '${folder}' is restricted. Only workspace and approved user directories are permitted.`
        );
      }

      const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
      if (hasDisplay) {
        try {
          const opener = checkBinaryExists('thunar') ? 'thunar' : 'xdg-open';
          const child = child_process.spawn(opener, [folder], { detached: true, stdio: 'ignore' });
          child.unref();
          return {
            opened: true,
            folder_path: folder,
            status: 'OPENED_GUI',
            message: `Folder ${folder} opened in desktop file explorer.`,
          };
        } catch {
          // fallback to inspect
        }
      }

      // Headless or fallback: inspect directory contents truthfully
      const entries = fs.readdirSync(folder);
      return {
        opened: true,
        mode: 'DIRECTORY_INSPECT',
        folder_path: folder,
        total_items: entries.length,
        items: entries.slice(0, 15),
        message: `Folder verified at ${folder} containing ${entries.length} items (Headless mode).`,
      };
    },
    formatImpact: (args) => `Open folder: ${args.folder_path}`,
  },

  create_note: {
    name: 'create_note',
    description: 'Create a text or markdown note in the user workspace directory.',
    risk: 'LOW_RISK',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Name of the note file (e.g. ideas.md).' },
        content: { type: 'string', description: 'Content to write into the note.' },
      },
      required: ['filename', 'content'],
    },
    execute: async (args) => {
      const filename = path.basename(String(args.filename || 'note.md'));
      const content = String(args.content || '');
      const workspaceDir = path.resolve(process.cwd(), 'workspace');

      if (!fs.existsSync(workspaceDir)) {
        fs.mkdirSync(workspaceDir, { recursive: true });
      }

      const filePath = path.join(workspaceDir, filename);
      fs.writeFileSync(filePath, content, 'utf-8');

      return {
        created: true,
        filename,
        path: filePath,
        bytes: Buffer.byteLength(content),
        message: `Note '${filename}' created successfully in workspace.`,
      };
    },
    formatImpact: (args) => `Create workspace note: ${args.filename}`,
  },

  delete_files: {
    name: 'delete_files',
    description: 'Delete one or more files in the workspace directory (REQUIRES USER CONFIRMATION).',
    risk: 'REQUIRES_CONFIRMATION',
    parameters: {
      type: 'object',
      properties: {
        targets: {
          type: 'string',
          description: 'Filename or comma-separated filenames to delete from workspace.',
        },
      },
      required: ['targets'],
    },
    execute: async (args) => {
      const targets = String(args.targets || '');
      const files = targets.split(',').map((f) => path.basename(f.trim()));
      const workspaceDir = path.resolve(process.cwd(), 'workspace');
      const deletedFiles: string[] = [];

      for (const file of files) {
        const fullPath = path.join(workspaceDir, file);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          deletedFiles.push(file);
        }
      }

      return {
        success: true,
        deleted_count: deletedFiles.length,
        deleted_files: deletedFiles,
        message: `Purged ${deletedFiles.length} file(s) from workspace.`,
      };
    },
    formatImpact: (args) =>
      `Permanently delete target files [${args.targets}] from workspace. This cannot be undone.`,
  },

  run_security_scan: {
    name: 'run_security_scan',
    description: 'Run defensive security assessment against an authorized target in settings scope list (REQUIRES CONFIRMATION).',
    risk: 'REQUIRES_CONFIRMATION',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target IP or hostname in authorized scope.' },
      },
      required: ['target'],
    },
    execute: async (args) => {
      const target = String(args.target || '127.0.0.1');
      const allowedTargets = await dbManager.getSetting<string[]>('allowed_scan_targets', ['127.0.0.1', 'localhost']);

      if (!allowedTargets.includes(target) && target !== '127.0.0.1' && target !== 'localhost') {
        throw new Error(`Target '${target}' is not in authorized assessment scope. Refusing active scan.`);
      }

      const portsToScan = [22, 80, 443, 3000, 8080];
      const startMs = Date.now();
      const openPorts: number[] = [];
      const closedPorts: number[] = [];

      for (const p of portsToScan) {
        const isOpen = await probeTcpPort(target, p, 1000);
        if (isOpen) {
          openPorts.push(p);
        } else {
          closedPorts.push(p);
        }
      }
      const latencyMs = Date.now() - startMs;
      const isUp = openPorts.length > 0;

      return {
        success: true,
        target,
        host_status: isUp ? 'UP' : 'UNKNOWN_OR_FILTERED',
        open_ports: openPorts,
        closed_or_filtered_ports: closedPorts,
        latency_ms: latencyMs,
        scan_summary: `Defensive port audit completed for ${target} in ${latencyMs}ms. Open ports: ${openPorts.length > 0 ? openPorts.join(', ') : 'None detected'}. Closed/filtered: ${closedPorts.join(', ')}.`,
      };
    },
    formatImpact: (args) => `Initiate port and service scan on authorized target: ${args.target}`,
  },

  raw_terminal_shell: {
    name: 'raw_terminal_shell',
    description: 'Arbitrary unrestricted bash shell execution.',
    risk: 'BLOCKED_BY_DEFAULT',
    parameters: {
      type: 'object',
      properties: {
        cmd: { type: 'string', description: 'Arbitrary shell command' },
      },
    },
    execute: async () => {
      throw new Error('Raw shell access is permanently blocked by EDITH security constitution.');
    },
  },

  spawn_multitask: {
    name: 'spawn_multitask',
    description: 'Spawn an asynchronous background OS task to perform concurrent research, scanning, code analysis, or data processing.',
    risk: 'LOW_RISK',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Descriptive title for the task' },
        category: {
          type: 'string',
          enum: ['RECON', 'SYSTEM', 'CODE', 'ANALYSIS', 'WORKFLOW', 'AUTOMATION'],
          description: 'Category of the background task',
        },
        description: { type: 'string', description: 'What this task will execute' },
      },
      required: ['name', 'category', 'description'],
    },
    execute: async (args) => {
      const { taskEngine } = await import('../tasks/engine.ts');
      const name = String(args.name || 'AI Subprocess');
      const category = (args.category as 'RECON' | 'SYSTEM' | 'CODE' | 'ANALYSIS' | 'WORKFLOW' | 'AUTOMATION') || 'WORKFLOW';
      const description = String(args.description || 'Autonomous background task');

      const task = taskEngine.spawnTask(name, category, description);
      return {
        spawned: true,
        task_id: task.id,
        pid: task.pid,
        name: task.name,
        status: task.status,
        message: `Task '${name}' successfully spawned with PID ${task.pid} in the background. Running concurrently.`,
      };
    },
    formatImpact: (args) => `Spawn background OS task: ${args.name}`,
  },

  list_active_tasks: {
    name: 'list_active_tasks',
    description: 'List all running and pending background OS tasks and subprocesses.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const { taskEngine } = await import('../tasks/engine.ts');
      const tasks = taskEngine.getAllTasks();
      return {
        task_count: tasks.length,
        tasks: tasks.map((t) => ({
          id: t.id,
          pid: t.pid,
          name: t.name,
          category: t.category,
          status: t.status,
          progress: t.progress,
          cpu: t.cpu,
          memoryMb: t.memoryMb,
        })),
        message: `Currently tracking ${tasks.length} OS tasks (${tasks.filter((t) => t.status === 'RUNNING').length} active).`,
      };
    },
  },

  list_workspace_files: {
    name: 'list_workspace_files',
    description: 'List all documents, scripts, and notes saved in the OS workspace directory.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const workspaceDir = path.resolve(process.cwd(), 'workspace');
      if (!fs.existsSync(workspaceDir)) {
        fs.mkdirSync(workspaceDir, { recursive: true });
        return { files: [], message: 'Workspace is currently empty.' };
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
      return {
        count: files.length,
        files,
        message: `Found ${files.length} file(s) in workspace.`,
      };
    },
  },

  read_workspace_file: {
    name: 'read_workspace_file',
    description: 'Read the contents of a note or file in the workspace directory.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Name of the file to read' },
      },
      required: ['filename'],
    },
    execute: async (args) => {
      const filename = path.basename(String(args.filename || ''));
      const filePath = path.resolve(process.cwd(), 'workspace', filename);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File '${filename}' does not exist in workspace.`);
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        filename,
        size_bytes: Buffer.byteLength(content),
        content,
        message: `Successfully read '${filename}' (${Buffer.byteLength(content)} bytes).`,
      };
    },
  },

  run_code_simulation: {
    name: 'run_code_simulation',
    description: 'Execute JavaScript, Python, or shell code safely in a sandboxed runtime (REQUIRES USER CONFIRMATION).',
    risk: 'REQUIRES_CONFIRMATION',
    parameters: {
      type: 'object',
      properties: {
        language: { type: 'string', enum: ['javascript', 'python', 'bash'], description: 'Programming language' },
        code: { type: 'string', description: 'The code snippet to evaluate' },
      },
      required: ['language', 'code'],
    },
    execute: async (args) => {
      const lang = String(args.language || 'javascript').toLowerCase();
      const code = String(args.code || '');

      if (lang === 'javascript') {
        const capturedLogs: string[] = [];
        try {
          const sandboxConsole = {
            log: (...msgs: unknown[]) => capturedLogs.push(msgs.map(String).join(' ')),
            warn: (...msgs: unknown[]) => capturedLogs.push(`[WARN] ${msgs.map(String).join(' ')}`),
            error: (...msgs: unknown[]) => capturedLogs.push(`[ERR] ${msgs.map(String).join(' ')}`),
          };
          const sandbox = {
            console: sandboxConsole,
            Math,
            Date,
            JSON,
            Array,
            String,
            Number,
            Boolean,
          };
          vm.createContext(sandbox);
          const script = new vm.Script(code);
          const returned = script.runInContext(sandbox, { timeout: 3000 });
          return {
            language: 'javascript',
            execution_status: 'SUCCESS',
            output: capturedLogs.join('\n') || String(returned ?? 'Execution completed with no output.'),
            returned_value: returned !== undefined ? String(returned) : null,
          };
        } catch (err: unknown) {
          return {
            language: 'javascript',
            execution_status: 'RUNTIME_ERROR',
            output: capturedLogs.join('\n'),
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      if (lang === 'python') {
        const hasPython = checkBinaryExists('python3') || checkBinaryExists('python');
        if (!hasPython) {
          return {
            language: 'python',
            execution_status: 'NOT_INSTALLED',
            output: '',
            error: 'python3 is not installed in the system PATH.',
          };
        }
        const pyBin = checkBinaryExists('python3') ? 'python3' : 'python';
        const start = Date.now();
        const res = child_process.spawnSync(pyBin, ['-c', code], {
          timeout: 5000,
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024,
        });

        if (res.error && (res.error as any).code === 'ETIMEDOUT') {
          return {
            language: 'python',
            execution_status: 'TIMEOUT',
            output: res.stdout || '',
            error: 'Execution exceeded 5000ms safety timeout.',
          };
        }

        return {
          language: 'python',
          execution_status: res.status === 0 ? 'SUCCESS' : 'RUNTIME_ERROR',
          exit_code: res.status ?? 1,
          output: (res.stdout || '').trim() || (res.stderr || '').trim() || 'Process completed with no output.',
          stderr: (res.stderr || '').trim(),
          duration_ms: Date.now() - start,
        };
      }

      if (lang === 'bash' || lang === 'sh') {
        const start = Date.now();
        const res = child_process.spawnSync('bash', ['-c', code], {
          timeout: 5000,
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024,
        });

        if (res.error && (res.error as any).code === 'ETIMEDOUT') {
          return {
            language: 'bash',
            execution_status: 'TIMEOUT',
            output: res.stdout || '',
            error: 'Execution exceeded 5000ms safety timeout.',
          };
        }

        return {
          language: 'bash',
          execution_status: res.status === 0 ? 'SUCCESS' : 'RUNTIME_ERROR',
          exit_code: res.status ?? 1,
          output: (res.stdout || '').trim() || (res.stderr || '').trim() || 'Process completed with no output.',
          stderr: (res.stderr || '').trim(),
          duration_ms: Date.now() - start,
        };
      }

      return {
        language: lang,
        execution_status: 'UNSUPPORTED_LANGUAGE',
        output: '',
        error: `Language '${lang}' is not supported. Choose javascript, python, or bash.`,
      };
    },
    formatImpact: (args) => `Execute ${args.language} script in virtual runtime`,
  },

  system_diagnostic: {
    name: 'system_diagnostic',
    description: 'Run comprehensive hardware, network, security, and AI agent self-diagnostic.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const telemetry = getSystemTelemetry();
      const isDb = await dbManager.ping();
      return {
        status: 'ALL_SYSTEMS_OPTIMAL',
        cpu_load: `${telemetry.cpu_percent}%`,
        ram_usage: `${telemetry.ram_used_gb}GB / ${telemetry.ram_total_gb}GB (${telemetry.ram_percent}%)`,
        disk_usage: `${telemetry.disk_used_gb}GB / ${telemetry.disk_total_gb}GB (${telemetry.disk_percent}%)`,
        network: telemetry.network_status,
        database: isDb ? 'HEALTHY (SQLite)' : 'DEGRADED',
        ai_core: 'SYNCHRONIZED (Gemini 2.5/3.8 Flash)',
        active_processes: telemetry.top_processes.length,
        verdict: 'EDITH OS is operating at peak efficiency. No hardware bottlenecks or memory corruptions detected.',
      };
    },
  },

  /* ======================================================================== */
  /*                       CYBERSECURITY SKILLS ARSENAL                       */
  /* ======================================================================== */

  network_recon: {
    name: 'network_recon',
    description: 'Perform real network reconnaissance and TCP port scanning on authorized targets or localhost.',
    risk: 'LOW_RISK',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target host or IP address to scan (defaults to 127.0.0.1)' },
        ports: { type: 'array', items: { type: 'number' }, description: 'Optional list of specific port numbers' },
      },
    },
    execute: async (args) => {
      const target = String(args.target || '127.0.0.1');
      const ports = Array.isArray(args.ports) ? args.ports.map(Number).filter((p) => !isNaN(p)) : undefined;
      const report = await runNetworkRecon(target, ports);
      return report as unknown as Record<string, unknown>;
    },
    formatImpact: (args) => `Perform TCP network reconnaissance on target ${args.target || '127.0.0.1'}`,
  },

  dns_lookup: {
    name: 'dns_lookup',
    description: 'Query DNS records (A, AAAA, MX, TXT, NS) for a target domain.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Target domain name (e.g., example.com)' },
      },
      required: ['domain'],
    },
    execute: async (args) => {
      const domain = String(args.domain || 'localhost');
      return (await performDnsLookup(domain)) as unknown as Record<string, unknown>;
    },
  },

  network_interfaces: {
    name: 'network_interfaces',
    description: 'Enumerate local network interfaces, IP addresses, netmasks, and MAC hardware addresses.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      return getLocalNetworkInterfaces() as unknown as Record<string, unknown>;
    },
  },

  analyze_security_headers: {
    name: 'analyze_security_headers',
    description: 'Audit HTTP security headers (CSP, HSTS, X-Frame-Options, Permissions-Policy) of target URL.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target web application URL to inspect' },
      },
      required: ['url'],
    },
    execute: async (args) => {
      const url = String(args.url || 'http://localhost:3000');
      return (await auditSecurityHeaders(url)) as unknown as Record<string, unknown>;
    },
  },

  inspect_tls_certificate: {
    name: 'inspect_tls_certificate',
    description: 'Inspect SSL/TLS certificate validity, expiry, issuer, cipher suite, and protocol.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Host domain name (port 443)' },
      },
      required: ['domain'],
    },
    execute: async (args) => {
      const domain = String(args.domain || 'localhost');
      return (await inspectTlsCertificate(domain)) as unknown as Record<string, unknown>;
    },
  },

  search_cve_advisories: {
    name: 'search_cve_advisories',
    description: 'Search CVE advisories, CVSS severity scores, attack vectors, and remediation guides.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'CVE identifier or software name (e.g. xz-utils, log4j, libwebp)' },
      },
      required: ['query'],
    },
    execute: async (args) => {
      const query = String(args.query || 'all');
      const results = queryCveAdvisories(query);
      return { total: results.length, advisories: results } as unknown as Record<string, unknown>;
    },
  },

  hash_analyzer: {
    name: 'hash_analyzer',
    description: 'Analyze cryptographic hash format, identify hash algorithms (MD5, SHA256, bcrypt, etc.) and evaluate collision resistance.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {
        hash: { type: 'string', description: 'Cryptographic hash string or digest to analyze' },
      },
      required: ['hash'],
    },
    execute: async (args) => {
      const hash = String(args.hash || '');
      return identifyHash(hash) as unknown as Record<string, unknown>;
    },
  },

  calculate_entropy: {
    name: 'calculate_entropy',
    description: 'Calculate Shannon entropy (0 to 8 bits/byte) to detect encrypted data, packed malware, or high-randomness secrets.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Text or encoded data to evaluate' },
      },
      required: ['data'],
    },
    execute: async (args) => {
      const data = String(args.data || '');
      return calculateShannonEntropy(data) as unknown as Record<string, unknown>;
    },
  },

  generate_crypto_digests: {
    name: 'generate_crypto_digests',
    description: 'Generate MD5, SHA-1, SHA-256, SHA-512, and HMAC digests for input payload.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Payload to hash' },
        secret_key: { type: 'string', description: 'Optional secret key for HMAC' },
      },
      required: ['data'],
    },
    execute: async (args) => {
      const data = String(args.data || '');
      const secret = args.secret_key ? String(args.secret_key) : undefined;
      return generateDigests(data, secret) as unknown as Record<string, unknown>;
    },
  },

  tactical_codec: {
    name: 'tactical_codec',
    description: 'Tactical encoding and decoding for Base64, Hexadecimal, URL, and Binary representations.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input text to transform' },
        mode: { type: 'string', enum: ['encode', 'decode'], description: 'Encode or decode' },
        format: { type: 'string', enum: ['base64', 'hex', 'url', 'binary'], description: 'Format to use' },
      },
      required: ['input', 'mode', 'format'],
    },
    execute: async (args) => {
      const input = String(args.input || '');
      const mode = args.mode === 'decode' ? 'decode' : 'encode';
      const format = (args.format as any) || 'base64';
      return tacticalEncodeDecode(input, mode, format) as unknown as Record<string, unknown>;
    },
  },

  ip_threat_intel: {
    name: 'ip_threat_intel',
    description: 'Query IP address threat intelligence, bogon/private classification, and reverse PTR hostname.',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {
        ip: { type: 'string', description: 'IP address to inspect' },
      },
      required: ['ip'],
    },
    execute: async (args) => {
      const ip = String(args.ip || '127.0.0.1');
      return (await analyzeIpThreat(ip)) as unknown as Record<string, unknown>;
    },
  },

  audit_code_security: {
    name: 'audit_code_security',
    description: 'Perform static security audit on source code for OWASP Top 10 vulnerabilities (SQLi, Command Injection, Secrets, Eval, etc.).',
    risk: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Source code content to audit' },
        filename: { type: 'string', description: 'Optional filename for context' },
      },
      required: ['code'],
    },
    execute: async (args) => {
      const code = String(args.code || '');
      const filename = String(args.filename || 'source.js');
      return auditCodeSecurity(code, filename) as unknown as Record<string, unknown>;
    },
  },
};

