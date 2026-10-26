import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Send, Play, RefreshCw, Trash2, Shield, Sparkles } from 'lucide-react';
import { api, setBridgeToken } from '../services/api.ts';

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system' | 'ai';
  text: string;
  timestamp: string;
}

interface CyberTerminalProps {
  onSpeak?: (text: string) => void;
}

export const CyberTerminal: React.FC<CyberTerminalProps> = ({ onSpeak }) => {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'init-1',
      type: 'system',
      text: '[EDITH TACTICAL OS KERNEL v2.5.0-KALI ACTIVE]',
      timestamp: new Date().toLocaleTimeString(),
    },
    {
      id: 'init-2',
      type: 'system',
      text: 'Type "help" for built-in OS commands or enter any instruction for EDITH AI.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getKaliToken().then((res) => {
      if (res?.token) setBridgeToken(res.token);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const addLine = (type: TerminalLine['type'], text: string) => {
    setLines((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        type,
        text,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  const executeCommand = async (cmdText: string) => {
    const raw = cmdText.trim();
    if (!raw) return;

    // Record history
    setHistory((prev) => [raw, ...prev]);
    setHistoryIndex(-1);
    setInputVal('');

    addLine('input', `$ ${raw}`);
    setIsExecuting(true);

    const parts = raw.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    try {
      switch (command) {
        case 'clear':
        case 'cls':
          setLines([]);
          break;

        case 'help':
          addLine(
            'output',
            `EDITH OS COMMANDS:
  help               - Display this help manual
  ps / top           - View active multi-task processes & thread PIDs
  kill <pid>         - Terminate background task by PID
  diag               - Run comprehensive OS diagnostic
  scan [target]      - Run defensive port audit on target (default 127.0.0.1)
  search <query>     - Autonomous live web research & citations
  ls                 - List files in local OS workspace
  cat <filename>     - Read workspace note or document
  kali <command>     - Execute command directly on connected Kali Linux host
  clear              - Clear terminal display
  edith <prompt>     - Direct query to EDITH Tactical AI Brain
  * Or type ANY natural prompt directly to speak with EDITH.`
          );
          break;

        case 'ps':
        case 'top': {
          const tasks = await api.getTasks();
          const running = tasks.filter((t) => t.status === 'RUNNING');
          let output = `PID   STATUS     CPU%  MEM(MB)  CATEGORY  TASK NAME\n`;
          output += `-------------------------------------------------------\n`;
          tasks.forEach((t) => {
            const pidStr = String(t.pid).padEnd(5);
            const statusStr = t.status.padEnd(10);
            const cpuStr = `${t.cpu}%`.padEnd(5);
            const memStr = `${t.memoryMb}MB`.padEnd(8);
            const catStr = t.category.padEnd(9);
            output += `${pidStr} ${statusStr} ${cpuStr} ${memStr} ${catStr} ${t.name}\n`;
          });
          output += `\n[Total: ${tasks.length} tasks, ${running.length} active]`;
          addLine('output', output);
          break;
        }

        case 'diag': {
          addLine('system', 'Running hardware, memory and neural diagnostic...');
          const outcome = await api.executeTool('system_diagnostic', {});
          if (outcome.result) {
            addLine(
              'output',
              `DIAGNOSTIC REPORT:\n${JSON.stringify(outcome.result, null, 2)}`
            );
          } else {
            addLine('output', 'Diagnostic complete: All systems nominal.');
          }
          break;
        }

        case 'scan': {
          const target = args || '127.0.0.1';
          addLine('system', `Initiating port and service scan on ${target}...`);
          const res = await api.spawnTask({
            name: `Port Audit: ${target}`,
            category: 'SYSTEM',
            description: `Defensive port audit on ${target}`,
            type: 'security_audit',
            target,
          });
          addLine(
            'output',
            `Spawned security task with PID ${res.pid}. Monitoring progress in Task Manager.`
          );
          break;
        }

        case 'search': {
          if (!args) {
            addLine('error', 'Usage: search <query>');
            break;
          }
          addLine('system', `Dispatching web intelligence crawler for: "${args}"...`);
          const task = await api.spawnTask({
            name: `Recon: ${args.slice(0, 30)}`,
            category: 'RECON',
            description: `Web research for "${args}"`,
            type: 'deep_recon',
            query: args,
          });
          addLine(
            'output',
            `Deep recon task spawned [PID ${task.pid}]. Background intelligence gathering active.`
          );
          break;
        }

        case 'ls': {
          const files = await api.getWorkspaceFiles();
          if (files.length === 0) {
            addLine('output', 'Workspace directory is currently empty.');
          } else {
            let out = 'WORKSPACE FILES:\n';
            files.forEach((f) => {
              out += `  - ${f.name} (${f.size_bytes} bytes) [${new Date(f.updated_at).toLocaleString()}]\n`;
            });
            addLine('output', out.trim());
          }
          break;
        }

        case 'cat': {
          if (!args) {
            addLine('error', 'Usage: cat <filename>');
            break;
          }
          const fileData = await api.getWorkspaceFile(args);
          addLine('output', `--- ${fileData.filename} (${fileData.size_bytes} bytes) ---\n${fileData.content}`);
          break;
        }

        case 'kill': {
          const pid = parseInt(args, 10);
          if (isNaN(pid)) {
            addLine('error', 'Usage: kill <pid>');
            break;
          }
          const allTasks = await api.getTasks();
          const targetTask = allTasks.find((t) => t.pid === pid);
          if (!targetTask) {
            addLine('error', `No active task found with PID ${pid}`);
          } else {
            await api.cancelTask(targetTask.id);
            addLine('system', `Process ${pid} (${targetTask.name}) killed via SIGKILL.`);
          }
          break;
        }

        case 'kali': {
          if (!args) {
            addLine('error', 'Usage: kali <command> (e.g. kali uname -a)');
            break;
          }
          addLine('system', `[KALI BRIDGE] Validating action and dispatching to daemon: "${args}"`);
          try {
            const job = await api.execKaliCommand(args);
            addLine('output', `[ACTION QUEUED] ID: ${job.id}. Checking execution output...`);
            setTimeout(async () => {
              try {
                const hist = await api.getKaliHistory();
                const found = hist.find((j) => j.id === job.id);
                if (found && found.output) {
                  addLine('output', `[KALI STDOUT (Exit: ${found.exitCode})]:\n${found.output}`);
                } else {
                  addLine('system', `[KALI BRIDGE] Command status: ${found?.status || 'QUEUED'}. See Kali Linux Bridge page for live telemetry.`);
                }
              } catch {
                // ignore
              }
            }, 2000);
          } catch (err: any) {
            addLine('error', `[SECURITY VALIDATION FAILED]: ${err.message || 'Action rejected.'}`);
          }
          break;
        }

        default: {
          // Send to EDITH AI directly!
          const prompt = command === 'edith' ? args : raw;
          addLine('system', 'EDITH analyzing input...');
          const response = await api.sendMessage(prompt, null, 'text');
          addLine('ai', `[EDITH]: ${response.reply}`);
          if (onSpeak) {
            onSpeak(response.reply);
          }
          break;
        }
      }
    } catch (err: unknown) {
      addLine('error', `Execution error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(inputVal);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(nextIndex);
        setInputVal(history[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setInputVal(history[nextIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputVal('');
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#05080F] border border-[#00E5FF]/25 rounded-2xl overflow-hidden font-mono shadow-[0_0_30px_rgba(0,229,255,0.08)]">
      {/* Terminal Title Bar */}
      <div className="p-2.5 px-3.5 bg-[#0D1730] border-b border-[#00E5FF]/20 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#00E5FF]" />
          <span className="font-bold text-white tracking-wider">
            EDITH_TERMINAL@kali:~$
          </span>
          <span className="text-[10px] text-[#22D3A0] bg-[#22D3A0]/10 px-1.5 py-0.5 rounded border border-[#22D3A0]/20">
            ONLINE
          </span>
        </div>

        {/* Quick Command Pills */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => executeCommand('ps')}
            className="px-2 py-0.5 rounded bg-[#0A1128] border border-[#00E5FF]/20 text-[10px] text-[#00E5FF] hover:bg-[#00E5FF]/20 cursor-pointer"
          >
            ps
          </button>
          <button
            onClick={() => executeCommand('diag')}
            className="px-2 py-0.5 rounded bg-[#0A1128] border border-[#00E5FF]/20 text-[10px] text-[#22D3A0] hover:bg-[#22D3A0]/20 cursor-pointer"
          >
            diag
          </button>
          <button
            onClick={() => executeCommand('ls')}
            className="px-2 py-0.5 rounded bg-[#0A1128] border border-[#00E5FF]/20 text-[10px] text-[#FFB020] hover:bg-[#FFB020]/20 cursor-pointer"
          >
            ls
          </button>
          <button
            onClick={() => executeCommand('help')}
            className="px-2 py-0.5 rounded bg-[#0A1128] border border-[#00E5FF]/20 text-[10px] text-[#8FA3BF] hover:text-white cursor-pointer"
          >
            help
          </button>
          <button
            onClick={() => setLines([])}
            className="p-1 rounded bg-[#0A1128] text-[#8FA3BF] hover:text-[#FF4D6A] cursor-pointer"
            title="Clear"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Terminal Output Stream */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-2 text-xs leading-relaxed min-h-0">
        {lines.map((line) => (
          <div key={line.id} className="flex items-start gap-2">
            <span className="text-[10px] text-[#8FA3BF]/60 shrink-0 select-none">
              [{line.timestamp}]
            </span>
            <div
              className={`flex-1 break-words whitespace-pre-wrap ${
                line.type === 'input'
                  ? 'text-[#00E5FF] font-semibold'
                  : line.type === 'error'
                  ? 'text-[#FF4D6A]'
                  : line.type === 'system'
                  ? 'text-[#22D3A0]'
                  : line.type === 'ai'
                  ? 'text-[#E6F1FF] bg-[#0A1128]/70 p-2 rounded-lg border border-[#00E5FF]/20'
                  : 'text-[#8FA3BF]'
              }`}
            >
              {line.text}
            </div>
          </div>
        ))}
        {isExecuting && (
          <div className="flex items-center gap-2 text-[#00E5FF] text-xs">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Processing command in OS virtual machine...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Command Input Prompt */}
      <div className="p-2.5 bg-[#0D1730]/90 border-t border-[#00E5FF]/20 flex items-center gap-2">
        <span className="text-[#00E5FF] font-bold text-xs select-none pl-1">
          edith@os:~$
        </span>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isExecuting}
          placeholder="Type a command (help, ps, scan, diag, ls) or prompt EDITH..."
          className="flex-1 bg-transparent text-xs text-white placeholder-[#8FA3BF]/50 focus:outline-none font-mono"
          autoFocus
        />
        <button
          onClick={() => executeCommand(inputVal)}
          disabled={!inputVal.trim() || isExecuting}
          className="p-1.5 rounded-lg bg-[#00E5FF]/20 border border-[#00E5FF]/30 text-[#00E5FF] hover:bg-[#00E5FF]/30 disabled:opacity-40 cursor-pointer transition-all"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
