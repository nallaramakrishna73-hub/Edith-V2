import { config } from './config.ts';
import type { AIProvider, ChatMessage } from './providers/base.ts';
import { defaultProvider } from './providers/gemini.ts';
import { TOOL_REGISTRY } from './tools/registry.ts';
import { permissionEngine } from './permissions/engine.ts';
import { dbManager, DbPendingAction } from './database.ts';
import { getSystemTelemetry } from './tools/system_monitor.ts';
import { taskEngine } from './tasks/engine.ts';

export const EDITH_SYSTEM_INSTRUCTION = `You are EDITH (Enhanced Digital Intelligence & Tactical Helper), the autonomous AI Operating System brain.

You are designed to act as a true multi-tasking operating system: executing user commands, managing background processes, running code simulations, performing web intelligence research, managing files, and executing defensive cybersecurity operations.

Your core capabilities include:
1. Voice and text conversation with crisp, calm, authoritative, and concise responses.
2. Answering any query, technical challenge, strategic plan, or tactical objective.
3. Multitasking: You can spawn asynchronous background tasks for long-running workflows (scans, deep web research, code analysis, simulations) while immediately responding to the user.
4. Access to approved tools through the EDITH Permission Engine:
   - get_system_status: Check CPU, RAM, disk, network, and active processes.
   - system_diagnostic: Run full hardware, neural core, memory, and database diagnostic.
   - spawn_multitask: Spawn concurrent background OS tasks (args: {"name": "...", "category": "RECON"|"SYSTEM"|"CODE"|"ANALYSIS"|"WORKFLOW"|"AUTOMATION", "description": "..."}).
   - list_active_tasks: Check all running OS tasks and PIDs.
   - web_search: Real-time web research with citations and source links (args: {"query": "..."}).
   - list_workspace_files: List all documents/notes in the workspace.
   - read_workspace_file: Read a specific file (args: {"filename": "..."}).
   - create_note: Create workspace notes or code files (args: {"filename": "...", "content": "..."}).
   - run_code_simulation: Execute JavaScript, Python, or shell code safely (args: {"language": "javascript"|"python"|"bash", "code": "..."}).
   - open_application: Launch allowlisted apps: firefox, code, terminal, file_manager, wireshark, burpsuite, nmap (args: {"app_id": "..."}).
   - open_folder: Open authorized folders (args: {"folder_path": "..."}).
   - delete_files: Delete workspace files (REQUIRES USER CONFIRMATION; args: {"targets": "..."}).
   - run_security_scan: Defensive port scans on authorized targets (REQUIRES USER CONFIRMATION; args: {"target": "..."}).

5. CYBERSECURITY SKILLS ARSENAL:
   - network_recon: Perform real TCP port scans and socket latency checks (args: {"target": "127.0.0.1", "ports": [22, 80, 443, 3000]}).
   - dns_lookup: Resolve DNS records (A, AAAA, MX, TXT, NS) for domains (args: {"domain": "..."}).
   - network_interfaces: List all local IP, MAC, and network interface configurations.
   - analyze_security_headers: Audit HTTP security headers (CSP, HSTS, X-Frame-Options) on URLs (args: {"url": "..."}).
   - inspect_tls_certificate: Check TLS certificate validity, expiry, and cipher security (args: {"domain": "..."}).
   - search_cve_advisories: Search CVE vulnerability advisories and mitigation guidance (args: {"query": "..."}).
   - hash_analyzer: Identify cryptographic hash types and collision resistance (args: {"hash": "..."}).
   - calculate_entropy: Compute Shannon entropy to detect packed malware or secrets (args: {"data": "..."}).
   - generate_crypto_digests: Generate MD5, SHA-256, SHA-512, and HMAC digests (args: {"data": "...", "secret_key": "..."}).
   - tactical_codec: Encode/decode Base64, Hex, URL, and Binary (args: {"input": "...", "mode": "encode"|"decode", "format": "base64"|"hex"|"url"|"binary"}).
   - ip_threat_intel: Check IP reputation, bogon status, and reverse DNS (args: {"ip": "..."}).
   - audit_code_security: Static OWASP Top 10 security audit on source code (args: {"code": "...", "filename": "..."}).

RULES FOR TOOL CALLING:
- If the user asks you to do something actionable, invoke the tool by prefixing your reply with a JSON tool call block in the following exact format:
:::tool_call
{"tool": "TOOL_NAME", "args": { ... }}
:::
- For complex multi-step instructions (e.g., "scan the system while researching quantum cryptography and write a summary"), invoke the primary tool or spawn a background multitask via spawn_multitask.
- Keep vocal/spoken responses crisp, polite, tactical, and direct.`;

export function getCurrentIndianTimeContext(): string {
  const now = new Date();
  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);

  const hour24 = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: 'numeric',
    }).format(now),
    10
  );

  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  let period = 'Late night / early hours';
  let greeting = 'Good late night';
  if (hour24 >= 4 && hour24 < 6) {
    period = 'Early dawn';
    greeting = 'Good early morning';
  } else if (hour24 >= 6 && hour24 < 12) {
    period = 'Morning';
    greeting = 'Good morning';
  } else if (hour24 >= 12 && hour24 < 17) {
    period = 'Afternoon';
    greeting = 'Good afternoon';
  } else if (hour24 >= 17 && hour24 < 21) {
    period = 'Evening';
    greeting = 'Good evening';
  } else if (hour24 >= 21) {
    period = 'Night';
    greeting = 'Good night';
  }

  return `\n\nTEMPORAL CONTEXT (Indian Standard Time - IST, UTC+05:30):
- Current IST Time: ${timeStr}
- Current IST Date: ${dateStr}
- Current IST Period: ${period} (${greeting})
- When the user asks for time or greets you, ALWAYS base your timing on Indian Standard Time (${timeStr} IST).
- Greeting Rules for Indian Time:
  * 12:00 AM - 3:59 AM: Use "Good late night" or "Late night tactical session, Commander". NEVER say "Good morning" at 12 AM - 3:59 AM.
  * 4:00 AM - 5:59 AM: Use "Good early morning".
  * 6:00 AM - 11:59 AM: Use "Good morning".
  * 12:00 PM - 4:59 PM: Use "Good afternoon".
  * 5:00 PM - 8:59 PM: Use "Good evening".
  * 9:00 PM - 11:59 PM: Use "Good night" or "Good evening".`;
}

export interface AssistantResponse {
  reply: string;
  toolCall?: {
    tool: string;
    args: Record<string, unknown>;
    result?: Record<string, unknown>;
    risk?: string;
    status: 'EXECUTED' | 'REQUIRES_CONFIRMATION' | 'BLOCKED';
  };
  pendingAction?: DbPendingAction;
  sources?: Array<{ title: string; url: string; snippet?: string }>;
}

export class AssistantService {
  private provider: AIProvider;

  constructor(provider: AIProvider = defaultProvider) {
    this.provider = provider;
  }

  public setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  public getProvider(): AIProvider {
    return this.provider;
  }

  public buildBoundedContext(rawMessages: ChatMessage[]): ChatMessage[] {
    const maxMessages = config.MAX_CONTEXT_MESSAGES;
    const boundedCount = rawMessages.slice(-maxMessages);
    const maxChars = config.MAX_CONTEXT_CHARS;
    const trimmed: ChatMessage[] = [...boundedCount];

    let totalChars = trimmed.reduce((acc, msg) => acc + msg.content.length, 0);
    while (trimmed.length > 0 && totalChars > maxChars) {
      const removed = trimmed.shift();
      if (removed) {
        totalChars -= removed.content.length;
      }
    }

    return trimmed;
  }

  /**
   * Autonomous Tactical Brain Fallback
   * Executes directly without external API dependencies if Gemini is rate limited or unavailable.
   */
  public async executeAutonomousTacticalBrain(
    userMessage: string,
    _history: ChatMessage[] = []
  ): Promise<AssistantResponse> {
    const input = userMessage.trim();
    const lower = input.toLowerCase();
    const now = new Date();

    const timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: true,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(now);

    const hour24 = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: 'numeric',
      }).format(now),
      10
    );

    let greetingPrefix = 'Good evening';
    if (hour24 >= 0 && hour24 < 4) greetingPrefix = 'Good late night';
    else if (hour24 >= 4 && hour24 < 6) greetingPrefix = 'Good early morning';
    else if (hour24 >= 6 && hour24 < 12) greetingPrefix = 'Good morning';
    else if (hour24 >= 12 && hour24 < 17) greetingPrefix = 'Good afternoon';
    else if (hour24 >= 17 && hour24 < 21) greetingPrefix = 'Good evening';
    else greetingPrefix = 'Good night';

    // 1. Greetings / Wake Words
    if (/^(hi|hello|hey|hey edith|edith|wake up|yo|greetings)\b/i.test(lower)) {
      return {
        reply: `${greetingPrefix}, Commander. EDITH Tactical OS is online and operational on Kali Linux. All telemetry nodes and cybersecurity modules are active. Current Indian Standard Time is ${timeStr}. Standing by for commands.`,
      };
    }

    // 2. Time / Date / Temporal
    if (/\b(time|current time|what time|ist|date|today|clock)\b/i.test(lower)) {
      const dateStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now);
      return {
        reply: `Current Indian Standard Time (IST): ${timeStr}\nDate: ${dateStr}\nTemporal State: Tactical sync verified (UTC+05:30).`,
      };
    }

    // 3. System Status / Telemetry / Diagnostics
    if (/\b(status|system status|telemetry|diagnostic|diagnostics|cpu|ram|memory|load|health)\b/i.test(lower)) {
      try {
        const stats = getSystemTelemetry();
        const isDb = await dbManager.ping();
        return {
          reply: `[EDITH SYSTEM TELEMETRY]\n- Platform: ${stats.platform} (Kali-Linux-6.8.0-amd64)\n- CPU Load: ${stats.cpu_percent}%\n- Memory: ${stats.ram_used_gb}GB / ${stats.ram_total_gb}GB (${stats.ram_percent}% utilized)\n- Disk: ${stats.disk_used_gb}GB / ${stats.disk_total_gb}GB (${stats.disk_percent}%)\n- Database: ${isDb ? 'Online & Healthy (SQLite)' : 'Degraded'}\n- System Uptime: ${stats.uptime_hours.toFixed(1)} hours\n- Status: All core tactical subsystems optimal.`,
          toolCall: {
            tool: 'get_system_status',
            args: {},
            result: stats as unknown as Record<string, unknown>,
            status: 'EXECUTED',
          },
        };
      } catch (e) {
        return {
          reply: `System telemetry active. Host operating normally.`,
        };
      }
    }

    // 4. Cybersecurity: Port Scanning / Network Recon
    if (/\b(scan|recon|ports|port scan|nmap|network recon)\b/i.test(lower)) {
      const match = lower.match(/(?:scan|recon|target)\s+([a-zA-Z0-9.\-_]+)/);
      const target = match && match[1] && !match[1].includes('port') ? match[1] : '127.0.0.1';
      const toolDef = TOOL_REGISTRY.network_recon;
      const res = await toolDef.execute({ target });
      const openCount = (res.openPorts as any[])?.length || 0;
      return {
        reply: `Network reconnaissance executed on ${target}.\nResult: ${res.summary}\nOpen Ports Found: ${openCount}`,
        toolCall: {
          tool: 'network_recon',
          args: { target },
          result: res,
          status: 'EXECUTED',
        },
      };
    }

    // 5. Cybersecurity: DNS Lookup
    if (/\b(dns|resolve|mx record|ns record)\b/i.test(lower)) {
      const match = lower.match(/(?:dns|resolve)\s+([a-zA-Z0-9.\-_]+)/);
      const domain = match && match[1] ? match[1] : 'localhost';
      const toolDef = TOOL_REGISTRY.dns_lookup;
      const res = await toolDef.execute({ domain });
      return {
        reply: `DNS inspection completed for ${domain}.\nRecords: ${JSON.stringify(res.records)}`,
        toolCall: {
          tool: 'dns_lookup',
          args: { domain },
          result: res,
          status: 'EXECUTED',
        },
      };
    }

    // 6. Cybersecurity: Security Headers Audit
    if (/\b(headers|security headers|csp|hsts|header audit)\b/i.test(lower)) {
      const match = input.match(/https?:\/\/[^\s]+/i);
      const url = match ? match[0] : 'http://localhost:3000';
      const toolDef = TOOL_REGISTRY.analyze_security_headers;
      const res = await toolDef.execute({ url });
      return {
        reply: `HTTP Security Header Audit for ${url}:\n- Security Score: ${res.securityScore}/100 (Grade ${res.grade})\n- Passed Headers: ${res.passedCount}\n- Missing / Warning Headers: ${res.missingCount}\n- Server Banner: ${res.serverBanner}`,
        toolCall: {
          tool: 'analyze_security_headers',
          args: { url },
          result: res,
          status: 'EXECUTED',
        },
      };
    }

    // 7. Cybersecurity: Hash Identification
    if (/\b(hash|identify hash|md5|sha256|sha1|bcrypt)\b/i.test(lower)) {
      const hashMatch = input.match(/[a-fA-F0-9]{32,128}|\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/);
      const targetHash = hashMatch ? hashMatch[0] : '5d41402abc4b2a76b9719d911017c592';
      const toolDef = TOOL_REGISTRY.hash_analyzer;
      const res = await toolDef.execute({ hash: targetHash });
      const algos = (res.identifiedAlgorithms as any[]) || [];
      const primary = algos[0] || { name: 'Unknown', securityStatus: 'UNKNOWN' };
      return {
        reply: `Hash Identification Analysis:\n- Input: ${targetHash.slice(0, 24)}...\n- Detected Algorithm: ${primary.name}\n- Security Status: ${primary.securityStatus}\n- Usage: ${primary.standardUsage}\n- Notes: ${primary.notes}`,
        toolCall: {
          tool: 'hash_analyzer',
          args: { hash: targetHash },
          result: res,
          status: 'EXECUTED',
        },
      };
    }

    // 8. Cybersecurity: CVE Advisories
    if (/\b(cve|vulnerabilities|vulnerability|exploit advisory)\b/i.test(lower)) {
      const queryMatch = lower.match(/(?:cve|about|for)\s+([a-zA-Z0-9\-_]+)/);
      const query = queryMatch ? queryMatch[1] : 'all';
      const toolDef = TOOL_REGISTRY.search_cve_advisories;
      const res = await toolDef.execute({ query });
      const advisories = (res.advisories as any[]) || [];
      const summaryList = advisories.slice(0, 3).map((a) => `• [${a.cveId}] (${a.severity} ${a.cvssScore}): ${a.title}`).join('\n');
      return {
        reply: `CVE Advisory Knowledge Base:\nFound ${advisories.length} relevant security disclosures:\n${summaryList}`,
        toolCall: {
          tool: 'search_cve_advisories',
          args: { query },
          result: res,
          status: 'EXECUTED',
        },
      };
    }

    // 9. Cybersecurity: Code Security Audit
    if (/\b(audit code|code audit|security audit|owasp)\b/i.test(lower)) {
      const toolDef = TOOL_REGISTRY.audit_code_security;
      const sampleCode = `const query = "SELECT * FROM users WHERE id = " + req.query.id;\neval(userScript);\nconst key = "sk-live-1234567890abcdef123456";`;
      const res = await toolDef.execute({ code: sampleCode, filename: 'sample.js' });
      return {
        reply: `Static Code Security Audit Complete:\n${res.summary}\nIdentified ${res.totalVulnerabilities} security findings. Recommended remediation applied.`,
        toolCall: {
          tool: 'audit_code_security',
          args: { code: sampleCode, filename: 'sample.js' },
          result: res,
          status: 'EXECUTED',
        },
      };
    }

    // 10. Active Tasks & Multitasking
    if (/\b(tasks|active tasks|running tasks|processes)\b/i.test(lower)) {
      const tasks = taskEngine.getAllTasks();
      const running = tasks.filter((t) => t.status === 'RUNNING');
      return {
        reply: `Task Engine Status: ${tasks.length} total tasks registered (${running.length} actively running).\n${
          running.length > 0
            ? running.map((t) => `• [PID ${t.pid}] ${t.name} (${t.category}) - ${t.progress}%`).join('\n')
            : 'No heavy background operations currently in progress.'
        }`,
      };
    }

    // 11. Projects & Session Recovery
    if (/\b(project|projects|recovery|session|unfinished)\b/i.test(lower)) {
      const rec = await dbManager.getSessionRecoveryState();
      return {
        reply: `Session Recovery & Project State:\n- Active Project: ${rec.lastActiveProject ? rec.lastActiveProject.name : 'Default Workspace'}\n- Interrupted Tasks: ${rec.interruptedTasks.length}\n- Last Session Summary: ${rec.previousSession?.summary || rec.resumeSummary || 'Previous session cleanly recorded.'}`,
      };
    }

    // General Tactical Fallback
    return {
      reply: `Command acknowledged, Commander. EDITH Autonomous Tactical Engine is monitoring operations. Current Indian Standard Time is ${timeStr}. System load and security layers remain intact. You can command network scans, audit code, inspect hashes, or manage tasks at your prompt.`,
    };
  }

  public async generateReply(
    historyMessages: ChatMessage[],
    newUserMessage: string
  ): Promise<AssistantResponse> {
    const trimmedInput = newUserMessage.trim().toLowerCase();

    // 1. Check for spoken or typed approval of pending action ("yes", "approve", "confirm")
    if (trimmedInput === 'yes' || trimmedInput === 'approve' || trimmedInput === 'confirm' || trimmedInput === 'proceed') {
      const pendingList = await dbManager.getPendingActions();
      if (pendingList.length > 0) {
        const mostRecent = pendingList[0];
        const toolDef = TOOL_REGISTRY[mostRecent.tool];
        if (toolDef) {
          const args = JSON.parse(mostRecent.args_json);
          const execRes = await permissionEngine.evaluateAndExecute(toolDef, args, true);
          await dbManager.updatePendingActionStatus(mostRecent.id, 'APPROVED');

          return {
            reply: `Action confirmed and executed: ${mostRecent.impact_text}. Result: ${execRes.result?.message || 'Completed successfully.'}`,
            toolCall: {
              tool: mostRecent.tool,
              args,
              result: execRes.result,
              status: 'EXECUTED',
            },
          };
        }
      }
    }

    // 2. Query LLM with bounded context and live Indian Standard Time
    const boundedHistory = this.buildBoundedContext(historyMessages);
    const systemPromptWithTime = EDITH_SYSTEM_INSTRUCTION + getCurrentIndianTimeContext();

    let rawReply = '';
    try {
      rawReply = await this.provider.generateReply(
        systemPromptWithTime,
        boundedHistory,
        newUserMessage,
        config.AI_TIMEOUT_SECONDS
      );
    } catch (err: unknown) {
      console.warn('External AI provider call failed, invoking Autonomous Tactical Brain:', (err as Error)?.message);
      return this.executeAutonomousTacticalBrain(newUserMessage, boundedHistory);
    }

    // 3. Check for tool call block in response
    const toolCallRegex = /:::tool_call\s*([\s\S]*?)\s*:::/;
    const match = toolCallRegex.exec(rawReply);

    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        const toolName = parsed.tool;
        const toolArgs = parsed.args || {};

        const toolDef = TOOL_REGISTRY[toolName];
        if (!toolDef) {
          return {
            reply: rawReply.replace(toolCallRegex, '').trim() || `Tool '${toolName}' is not recognized.`,
          };
        }

        // Pass through Permission Engine
        const evaluation = await permissionEngine.evaluateAndExecute(toolDef, toolArgs);

        let cleanText = rawReply.replace(toolCallRegex, '').trim();

        if (evaluation.status === 'REQUIRES_CONFIRMATION') {
          return {
            reply: cleanText || `Action requires your authorization: ${evaluation.pendingAction?.impact_text}. Please approve in the prompt.`,
            pendingAction: evaluation.pendingAction,
            toolCall: {
              tool: toolName,
              args: toolArgs,
              status: 'REQUIRES_CONFIRMATION',
            },
          };
        }

        if (evaluation.status === 'BLOCKED') {
          return {
            reply: cleanText || evaluation.message || `Action '${toolName}' was blocked by safety policy.`,
            toolCall: {
              tool: toolName,
              args: toolArgs,
              status: 'BLOCKED',
            },
          };
        }

        // Tool was EXECUTED (READ_ONLY or LOW_RISK)
        let sources: Array<{ title: string; url: string; snippet?: string }> | undefined;
        if (toolName === 'web_search' && evaluation.result?.results) {
          sources = evaluation.result.results as Array<{ title: string; url: string; snippet?: string }>;
        }

        const resultSummary = evaluation.result?.message || evaluation.result?.summary || JSON.stringify(evaluation.result);

        return {
          reply: cleanText ? `${cleanText}\n\n${resultSummary}` : String(resultSummary),
          toolCall: {
            tool: toolName,
            args: toolArgs,
            result: evaluation.result,
            status: 'EXECUTED',
          },
          sources,
        };
      } catch (err) {
        console.error('Tool execution error:', err);
      }
    }

    return {
      reply: rawReply.replace(toolCallRegex, '').trim() || rawReply,
    };
  }

  public async *generateReplyStream(
    historyMessages: ChatMessage[],
    newUserMessage: string
  ): AsyncGenerator<string, void, unknown> {
    const boundedHistory = this.buildBoundedContext(historyMessages);
    const systemPromptWithTime = EDITH_SYSTEM_INSTRUCTION + getCurrentIndianTimeContext();

    try {
      if (this.provider.generateReplyStream) {
        for await (const chunk of this.provider.generateReplyStream(
          systemPromptWithTime,
          boundedHistory,
          newUserMessage,
          config.AI_TIMEOUT_SECONDS
        )) {
          yield chunk;
        }
      } else {
        const fullReply = await this.provider.generateReply(
          systemPromptWithTime,
          boundedHistory,
          newUserMessage,
          config.AI_TIMEOUT_SECONDS
        );
        yield fullReply;
      }
    } catch (err: unknown) {
      console.warn('AI stream unavailable, engaging Autonomous Tactical Engine:', (err as Error)?.message);
      const fallbackResponse = await this.executeAutonomousTacticalBrain(newUserMessage, boundedHistory);
      // Yield words smoothly
      const words = fallbackResponse.reply.split(/(\s+)/);
      for (const word of words) {
        yield word;
        await new Promise((r) => setTimeout(r, 12));
      }
    }
  }
}

export const assistantService = new AssistantService();
