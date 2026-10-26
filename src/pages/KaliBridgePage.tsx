import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Shield,
  Activity,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Send,
  RefreshCw,
  Cpu,
  Server,
  Zap,
  Radio,
  FileCode,
  HardDrive,
  Clock,
  Play,
} from 'lucide-react';
import { api, setBridgeToken } from '../services/api.ts';
import { KaliAgentInfo, KaliCommandJob, KaliStatusResponse } from '../types/api.ts';

const SAMPLE_COMMANDS = [
  { label: 'System Kernel', cmd: 'uname -a' },
  { label: 'Host & User', cmd: 'whoami' },
  { label: 'Network IPs', cmd: 'ip -brief addr' },
  { label: 'Top Processes', cmd: 'ps aux' },
  { label: 'Disk Allocation', cmd: 'df -h /' },
  { label: 'Installed Security Tools', cmd: 'which nmap sqlmap wireshark gobuster hydra nikto' },
];

export const KaliBridgePage: React.FC = () => {
  const [statusData, setStatusData] = useState<KaliStatusResponse>({
    agent: null,
    isConnected: false,
    queueLength: 0,
  });
  const [history, setHistory] = useState<KaliCommandJob[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [selectedJob, setSelectedJob] = useState<KaliCommandJob | null>(null);
  const [bridgeToken, setBridgeTokenState] = useState<string>('');
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const fetchStatus = async () => {
    try {
      const res = await api.getKaliStatus();
      setStatusData(res);
      const hist = await api.getKaliHistory();
      setHistory(hist);
      if (hist.length > 0 && !selectedJob) {
        setSelectedJob(hist[0]);
      }
    } catch (e) {
      console.warn('Failed to fetch Kali bridge status:', e);
    }
  };

  useEffect(() => {
    // Fetch local bridge authentication token
    api.getKaliToken().then((res) => {
      if (res && res.token) {
        setBridgeToken(res.token);
        setBridgeTokenState(res.token);
      }
    }).catch(() => {});

    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleExecute = async (cmdToSend?: string) => {
    const cmd = (cmdToSend || commandInput).trim();
    if (!cmd || executing) return;

    setExecuting(true);
    try {
      const job = await api.execKaliCommand(cmd);
      setCommandInput('');
      setSelectedJob(job);
      await fetchStatus();
    } catch (err: any) {
      alert(`Command rejected: ${err.message || 'Execution error'}`);
      console.error('Execution queue failed:', err);
    } finally {
      setExecuting(false);
    }
  };

  const curlCommand = `python3 public/edith-agent.py --token ${bridgeToken || '<session-token>'}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#00E5FF]/15">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="w-6 h-6 text-[#00E5FF]" />
            <h1 className="text-xl md:text-2xl font-bold font-['Orbitron',sans-serif] text-white tracking-wide">
              KALI LINUX OS INTEGRATION BRIDGE
            </h1>
          </div>
          <p className="text-xs text-[#8FA3BF] font-mono mt-1">
            NATIVE DAEMON LINK · SYSTEM ACCESS · OFFENSIVE &amp; DEFENSIVE ARSENAL
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0D1730] border border-[#00E5FF]/20">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                statusData.isConnected
                  ? 'bg-[#22D3A0] shadow-[0_0_10px_#22D3A0]'
                  : 'bg-[#FF3366] shadow-[0_0_10px_#FF3366]'
              }`}
            />
            <span className="text-xs font-mono font-bold text-white uppercase">
              {statusData.isConnected ? 'KALI DAEMON ONLINE' : 'BRIDGE STANDBY'}
            </span>
          </div>

          <button
            onClick={fetchStatus}
            className="p-2 rounded-lg bg-[#0D1730] hover:bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20 transition-all cursor-pointer"
            title="Refresh Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Install Banner / Agent Info */}
      {!statusData.isConnected ? (
        <div className="p-6 rounded-xl bg-[#0D1730]/90 border border-[#00E5FF]/40 shadow-[0_0_30px_rgba(0,229,255,0.12)] space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#00E5FF]">
                <Radio className="w-5 h-5 animate-pulse" />
                <h3 className="text-sm font-bold font-['Orbitron',sans-serif] text-white">
                  CONNECT YOUR NATIVE KALI LINUX TERMINAL
                </h3>
              </div>
              <p className="text-xs text-[#8FA3BF] leading-relaxed max-w-3xl">
                To grant EDITH direct access to your local Kali Linux system, execute the lightweight bridge daemon on your machine.
                This enables authorized command execution, port scanning, network telemetry, and native security tools.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-[#8FA3BF]">
              <span>Run this command inside your Kali Linux terminal:</span>
              <span className="text-[#00E5FF]">Python 3.8+ required</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[#05080F] border border-[#00E5FF]/30 font-mono text-xs text-[#22D3A0] overflow-x-auto">
              <span className="text-[#8FA3BF] select-none">$</span>
              <span className="flex-1 select-all">{curlCommand}</span>
              <button
                onClick={() => copyToClipboard(curlCommand)}
                className="flex items-center gap-1 px-3 py-1 rounded bg-[#00E5FF]/20 hover:bg-[#00E5FF]/30 text-[#00E5FF] border border-[#00E5FF]/40 text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                {copiedCurl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#22D3A0]" />
                    <span className="text-[#22D3A0]">COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>COPY COMMAND</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono text-[#8FA3BF]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#22D3A0]" /> Zero external dependencies (uses standard python3 library)
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#22D3A0]" /> Non-intrusive polling over HTTP/WS
            </span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#0D1730]/80 border border-[#00E5FF]/20 space-y-1">
            <span className="text-[11px] font-mono text-[#8FA3BF] block uppercase">Connected Hostname</span>
            <span className="text-sm font-mono font-bold text-white flex items-center gap-1.5">
              <Server className="w-4 h-4 text-[#00E5FF]" />
              {statusData.agent?.hostname || 'kali-box'}
            </span>
            <span className="text-[10px] font-mono text-[#22D3A0]">ID: {statusData.agent?.agentId}</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0D1730]/80 border border-[#00E5FF]/20 space-y-1">
            <span className="text-[11px] font-mono text-[#8FA3BF] block uppercase">Kernel &amp; Release</span>
            <span className="text-sm font-mono font-bold text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-[#00E5FF]" />
              {statusData.agent?.osRelease || 'Kali GNU/Linux'}
            </span>
            <span className="text-[10px] font-mono text-[#8FA3BF] truncate block">
              {statusData.agent?.kernel || 'Linux 6.x'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0D1730]/80 border border-[#00E5FF]/20 space-y-1">
            <span className="text-[11px] font-mono text-[#8FA3BF] block uppercase">Host IP Address</span>
            <span className="text-sm font-mono font-bold text-[#00E5FF] flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#00E5FF]" />
              {statusData.agent?.ipAddress || '127.0.0.1'}
            </span>
            <span className="text-[10px] font-mono text-[#22D3A0]">LINK ACTIVE</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0D1730]/80 border border-[#00E5FF]/20 space-y-1">
            <span className="text-[11px] font-mono text-[#8FA3BF] block uppercase">Detected Kali Tools</span>
            <span className="text-sm font-mono font-bold text-[#22D3A0] flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-[#22D3A0]" />
              {statusData.agent?.installedTools.length || 0} Tools Ready
            </span>
            <span className="text-[10px] font-mono text-[#8FA3BF]">Security Suite Verified</span>
          </div>
        </div>
      )}

      {/* Installed Tools Badges */}
      {statusData.agent && statusData.agent.installedTools.length > 0 && (
        <div className="p-4 rounded-xl bg-[#0D1730]/60 border border-[#00E5FF]/20 space-y-2.5">
          <span className="text-xs font-mono font-bold text-[#00E5FF] tracking-wider uppercase block">
            AVAILABLE NATIVE KALI SECURITY ARSENAL
          </span>
          <div className="flex flex-wrap gap-2">
            {statusData.agent.installedTools.map((tool) => (
              <span
                key={tool}
                className="px-2.5 py-1 rounded bg-[#060C1B] border border-[#00E5FF]/30 text-xs font-mono text-[#E6F1FF] flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#22D3A0]" />
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Command Dispatcher & Live Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Input and Quick Actions */}
        <div className="space-y-4 lg:col-span-1">
          <div className="p-4 rounded-xl bg-[#0D1730]/80 border border-[#00E5FF]/20 space-y-3">
            <div className="flex items-center gap-2 text-[#00E5FF]">
              <Terminal className="w-4 h-4" />
              <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase">
                DISPATCH TACTICAL COMMAND
              </h3>
            </div>

            <div className="space-y-2">
              <textarea
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleExecute();
                  }
                }}
                rows={3}
                placeholder="Enter shell command (e.g. nmap -sV 127.0.0.1 or uname -a)..."
                className="w-full p-2.5 rounded-lg bg-[#060C1B] border border-[#00E5FF]/30 text-white font-mono text-xs focus:outline-none focus:border-[#00E5FF] transition-all resize-none"
              />

              <div className="flex items-center justify-between text-[11px] font-mono text-[#8FA3BF]">
                <span>Ctrl + Enter to dispatch</span>
                <button
                  onClick={() => handleExecute()}
                  disabled={!commandInput.trim() || executing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00E5FF] hover:bg-[#00E5FF]/80 text-[#05080F] font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {executing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  DISPATCH
                </button>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="p-4 rounded-xl bg-[#0D1730]/80 border border-[#00E5FF]/20 space-y-3">
            <span className="text-xs font-mono font-bold text-[#8FA3BF] uppercase block">
              DIAGNOSTIC SHORTCUTS
            </span>
            <div className="space-y-1.5">
              {SAMPLE_COMMANDS.map((sample) => (
                <button
                  key={sample.label}
                  onClick={() => handleExecute(sample.cmd)}
                  className="w-full text-left p-2 rounded-lg bg-[#060C1B] hover:bg-[#00E5FF]/10 border border-[#00E5FF]/15 text-xs font-mono text-[#E6F1FF] flex items-center justify-between group transition-all cursor-pointer"
                >
                  <span>{sample.label}</span>
                  <Play className="w-3 h-3 text-[#00E5FF] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>

          {/* History Queue */}
          <div className="p-4 rounded-xl bg-[#0D1730]/80 border border-[#00E5FF]/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#8FA3BF] uppercase">
                RECENT EXECUTIONS ({history.length})
              </span>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {history.length === 0 ? (
                <p className="text-xs font-mono text-[#8FA3BF] italic">No commands dispatched yet.</p>
              ) : (
                history.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className={`w-full text-left p-2 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                      selectedJob?.id === job.id
                        ? 'bg-[#00E5FF]/15 border-[#00E5FF] text-white'
                        : 'bg-[#060C1B] border-[#00E5FF]/10 text-[#8FA3BF] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          job.status === 'COMPLETED'
                            ? 'bg-[#22D3A0]/20 text-[#22D3A0]'
                            : job.status === 'RUNNING'
                            ? 'bg-[#00E5FF]/20 text-[#00E5FF] animate-pulse'
                            : job.status === 'FAILED'
                            ? 'bg-[#FF3366]/20 text-[#FF3366]'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {job.status}
                      </span>
                      <span className="text-[10px] text-[#8FA3BF]">
                        {new Date(job.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="truncate text-white font-semibold">{job.command}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Output Console */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-[#060C1B] border border-[#00E5FF]/30 font-mono flex flex-col min-h-[500px] shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between pb-3 border-b border-[#00E5FF]/15 text-xs text-[#8FA3BF] mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
              <span className="ml-2 text-white font-bold">KALI HOST TERMINAL STDOUT</span>
            </div>

            {selectedJob && (
              <span className="text-[11px] text-[#00E5FF]">
                Exit Code: {selectedJob.exitCode !== undefined ? selectedJob.exitCode : 'Running...'}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 text-xs text-[#E6F1FF] leading-relaxed">
            {selectedJob ? (
              <div className="space-y-3">
                <div className="p-2.5 rounded bg-[#0D1730] border border-[#00E5FF]/20">
                  <span className="text-[#8FA3BF] block text-[11px]">Command Executed:</span>
                  <code className="text-[#22D3A0] font-bold text-xs">$ {selectedJob.command}</code>
                </div>

                <div className="space-y-1">
                  <span className="text-[#8FA3BF] text-[11px] block">Console Output:</span>
                  <pre className="p-3 rounded-lg bg-[#05080F] border border-[#00E5FF]/10 text-xs font-mono text-[#00E5FF] overflow-x-auto whitespace-pre-wrap max-h-96">
                    {selectedJob.output || (selectedJob.status === 'RUNNING' ? 'Executing on Kali host daemon...' : 'No output returned.')}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[#8FA3BF] space-y-3 py-16">
                <Terminal className="w-12 h-12 text-[#00E5FF]/30" />
                <p className="text-center max-w-sm text-xs">
                  Select a command execution from the history or dispatch a command to view live stdout from your Kali Linux box.
                </p>
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
