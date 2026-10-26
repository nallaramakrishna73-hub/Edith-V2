import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config.ts';

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
  executable?: string;
  args?: string[];
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  output: string;
  exitCode?: number;
  createdAt: number;
  completedAt?: number;
}

export const ALLOWED_BRIDGE_EXECUTABLES = [
  'nmap',
  'nikto',
  'sqlmap',
  'wireshark',
  'burpsuite',
  'hydra',
  'john',
  'hashcat',
  'aircrack-ng',
  'msfconsole',
  'gobuster',
  'dirb',
  'netdiscover',
  'arp-scan',
  'tshark',
  'uname',
  'whoami',
  'hostname',
  'ip',
  'ps',
  'df',
  'which',
  'ping',
  'dig',
  'traceroute',
] as const;

export interface CommandValidationResult {
  valid: boolean;
  error?: string;
  executable?: string;
  args?: string[];
  sanitizedCommand?: string;
}

export function validateBridgeCommand(command: string): CommandValidationResult {
  const trimmed = command.trim();
  if (!trimmed) {
    return { valid: false, error: 'Empty command string.' };
  }

  // Strictly disallow shell chaining & injection metacharacters
  const dangerousMetaRegex = /[;&|`$><\n\r()]/;
  if (dangerousMetaRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'Command contains prohibited shell operators or metacharacters (; & | ` $ > < \\n ()). Unrestricted shell execution is blocked by EDITH security constitution.',
    };
  }

  // Tokenize safely
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const exe = tokens[0].toLowerCase();

  // Allow only registered executables
  const isAllowed = (ALLOWED_BRIDGE_EXECUTABLES as readonly string[]).includes(exe);
  if (!isAllowed) {
    return {
      valid: false,
      error: `Executable '${exe}' is not permitted by the Kali bridge action registry. Allowed tools: ${ALLOWED_BRIDGE_EXECUTABLES.slice(0, 8).join(', ')}...`,
    };
  }

  // Sensitive paths check in arguments
  for (let i = 1; i < tokens.length; i++) {
    const arg = tokens[i].toLowerCase();
    if (
      arg.includes('/etc/shadow') ||
      arg.includes('/etc/sudoers') ||
      arg.includes('/root/.ssh') ||
      arg.includes('/id_rsa') ||
      arg.includes('../')
    ) {
      return {
        valid: false,
        error: `Argument '${tokens[i]}' accesses prohibited sensitive system locations.`,
      };
    }
  }

  return {
    valid: true,
    executable: exe,
    args: tokens.slice(1),
    sanitizedCommand: tokens.join(' '),
  };
}

class KaliBridgeManager {
  private agent: KaliAgentInfo | null = null;
  private commandQueue: KaliCommandJob[] = [];
  private history: KaliCommandJob[] = [];
  private bridgeToken: string;
  private tokenFilePath: string = path.resolve(process.cwd(), '.bridge_token');
  private readonly MAX_OUTPUT_BYTES = 64 * 1024; // 64KB output limit

  constructor() {
    this.bridgeToken = this.initializeBridgeToken();

    // Check heartbeat expiration every 10 seconds
    setInterval(() => {
      if (this.agent && Date.now() - this.agent.lastHeartbeat > 25000) {
        this.agent.status = 'OFFLINE';
      }
    }, 10000);
  }

  private initializeBridgeToken(): string {
    if (config.BRIDGE_TOKEN && config.BRIDGE_TOKEN.trim().length >= 16) {
      return config.BRIDGE_TOKEN.trim();
    }

    try {
      if (fs.existsSync(this.tokenFilePath)) {
        const stored = fs.readFileSync(this.tokenFilePath, 'utf-8').trim();
        if (stored.length >= 16) {
          return stored;
        }
      }
    } catch {
      // fallback to generate
    }

    const generated = crypto.randomBytes(32).toString('hex');
    try {
      fs.writeFileSync(this.tokenFilePath, generated, { mode: 0o600 });
    } catch (e) {
      console.warn('Could not persist .bridge_token file:', e);
    }
    return generated;
  }

  public getBridgeToken(): string {
    return this.bridgeToken;
  }

  public verifyToken(candidateToken?: string | null): boolean {
    if (!candidateToken || typeof candidateToken !== 'string') return false;
    const tokenClean = candidateToken.replace(/^Bearer\s+/i, '').trim();
    if (tokenClean.length === 0) return false;

    const expectedBuf = Buffer.from(this.bridgeToken);
    const candidateBuf = Buffer.from(tokenClean);

    if (expectedBuf.length !== candidateBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, candidateBuf);
  }

  public registerAgent(info: Omit<KaliAgentInfo, 'status' | 'lastHeartbeat'>): KaliAgentInfo {
    this.agent = {
      ...info,
      lastHeartbeat: Date.now(),
      status: 'ONLINE',
    };
    return this.agent;
  }

  public heartbeat(agentId: string): boolean {
    if (this.agent && this.agent.agentId === agentId) {
      this.agent.lastHeartbeat = Date.now();
      this.agent.status = 'ONLINE';
      return true;
    }
    return false;
  }

  public getStatus(): {
    agent: KaliAgentInfo | null;
    isConnected: boolean;
    queueLength: number;
    actionRegistry: readonly string[];
  } {
    const isConnected = Boolean(this.agent && this.agent.status === 'ONLINE');
    return {
      agent: this.agent,
      isConnected,
      queueLength: this.commandQueue.length,
      actionRegistry: ALLOWED_BRIDGE_EXECUTABLES,
    };
  }

  public queueCommand(command: string): KaliCommandJob {
    const validation = validateBridgeCommand(command);
    if (!validation.valid || !validation.sanitizedCommand) {
      throw new Error(validation.error || 'Invalid bridge command.');
    }

    const job: KaliCommandJob = {
      id: crypto.randomUUID(),
      command: validation.sanitizedCommand,
      executable: validation.executable,
      args: validation.args,
      status: 'QUEUED',
      output: '',
      createdAt: Date.now(),
    };

    this.commandQueue.push(job);
    this.history.unshift(job);
    if (this.history.length > 50) this.history.pop();

    return job;
  }

  public getNextCommand(): KaliCommandJob | null {
    const job = this.commandQueue.find((j) => j.status === 'QUEUED');
    if (job) {
      job.status = 'RUNNING';
      return job;
    }
    return null;
  }

  public submitResult(jobId: string, output: string, exitCode: number): boolean {
    const job = this.history.find((j) => j.id === jobId);
    if (job) {
      let finalOutput = String(output || '');
      if (Buffer.byteLength(finalOutput) > this.MAX_OUTPUT_BYTES) {
        finalOutput = finalOutput.slice(0, this.MAX_OUTPUT_BYTES) + '\n[... truncated by EDITH 64KB output limit]';
      }

      job.output = finalOutput;
      job.exitCode = exitCode;
      job.status = exitCode === 0 ? 'COMPLETED' : 'FAILED';
      job.completedAt = Date.now();

      // Remove from queue
      this.commandQueue = this.commandQueue.filter((j) => j.id !== jobId);
      return true;
    }
    return false;
  }

  public getHistory(): KaliCommandJob[] {
    return this.history;
  }

  public getJob(id: string): KaliCommandJob | undefined {
    return this.history.find((j) => j.id === id);
  }
}

export const kaliBridge = new KaliBridgeManager();
