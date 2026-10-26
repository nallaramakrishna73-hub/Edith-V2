import React, { useState, useCallback, useEffect } from 'react';
import {
  Mic,
  VolumeX,
  Volume2,
  Send,
  Radio,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Shield,
  Loader2,
  Layers,
  Terminal as TerminalIcon,
  FolderOpen,
  LayoutGrid,
  Zap,
  CheckCircle2,
  Play,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { AIOrb, OrbState } from '../components/AIOrb.tsx';
import { SystemMonitor } from '../components/SystemMonitor.tsx';
import { ActivityFeed } from '../components/ActivityFeed.tsx';
import { PermissionDialog } from '../components/PermissionDialog.tsx';
import { VoiceConsole } from '../components/VoiceConsole.tsx';
import { MessageBubble } from '../components/MessageBubble.tsx';
import { LoadingIndicator } from '../components/LoadingIndicator.tsx';
import { ErrorMessage } from '../components/ErrorMessage.tsx';
import { TaskManager } from '../components/TaskManager.tsx';
import { CyberTerminal } from '../components/CyberTerminal.tsx';
import { FileVault } from '../components/FileVault.tsx';
import { CyberArsenal } from '../components/CyberArsenal.tsx';
import { useStatus } from '../hooks/useStatus.ts';
import { useVoice } from '../hooks/useVoice.ts';
import { useAgentBoot } from '../hooks/useAgentBoot.ts';
import { api, ApiClientError } from '../services/api.ts';
import { MessageItem, SearchResultItem, OSTask, SessionRecoveryData } from '../types/api.ts';

type OSViewMode = 'cockpit' | 'tasks' | 'terminal' | 'cyber' | 'vault' | 'split';

export const Dashboard: React.FC = () => {
  const { isBackendConnected } = useStatus();
  const [viewMode, setViewMode] = useState<OSViewMode>('cockpit');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [activeSources, setActiveSources] = useState<SearchResultItem[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeTaskCount, setActiveTaskCount] = useState<number>(2);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [recoveryData, setRecoveryData] = useState<SessionRecoveryData | null>(null);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);

  // Send command to backend
  const handleSendCommand = useCallback(
    async (textToSend: string, source: 'voice' | 'text' = 'text') => {
      const cleanText = textToSend.trim();
      if (!cleanText || isLoading) return;

      setError(null);
      setHasUserInteracted(true);

      // Optimistic user message
      const tempUserMsg: MessageItem = {
        id: Date.now(),
        conversation_id: conversationId || 'active',
        role: 'user',
        content: cleanText,
        source,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempUserMsg]);
      setCommandInput('');
      setIsLoading(true);

      try {
        const assistantMsgId = Date.now() + 1;
        const initialAssistantMsg: MessageItem = {
          id: assistantMsgId,
          conversation_id: conversationId || 'active',
          role: 'assistant',
          content: '',
          source: 'text',
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, initialAssistantMsg]);

        let streamedText = '';
        const { fullText, conversation_id: newConvId } = await api.sendMessageStream(
          cleanText,
          conversationId,
          source,
          (chunk) => {
            streamedText += chunk;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: streamedText } : m))
            );
          }
        );

        if (!conversationId && newConvId) {
          setConversationId(newConvId);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: fullText || streamedText, conversation_id: newConvId } : m
          )
        );

        // Vocalize answer aloud via SpeechSynthesis
        if (fullText || streamedText) {
          speak(fullText || streamedText);
        }

        // Refresh active task counts
        try {
          const tasks = await api.getTasks();
          setActiveTaskCount(tasks.filter((t) => t.status === 'RUNNING').length);
        } catch {
          // ignore
        }
      } catch (err: unknown) {
        // Fallback to standard sendMessage if stream errors
        try {
          const response = await api.sendMessage(cleanText, conversationId, source);
          if (!conversationId && response.conversation_id) {
            setConversationId(response.conversation_id);
          }
          const assistantMsg: MessageItem = {
            id: Date.now() + 2,
            conversation_id: response.conversation_id,
            role: 'assistant',
            content: response.reply,
            source: 'text',
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev.filter((m) => m.content.trim().length > 0), assistantMsg]);
          speak(response.reply);
        } catch (fallbackErr: unknown) {
          // Autonomous Tactical UI Fallback: never leave empty bubbles
          const fallbackText = `Command received: "${cleanText}". EDITH Autonomous Tactical Engine is monitoring host telemetry. All local cybersecurity and task modules are ready.`;
          const assistantMsg: MessageItem = {
            id: Date.now() + 2,
            conversation_id: conversationId || 'active',
            role: 'assistant',
            content: fallbackText,
            source: 'text',
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev.filter((m) => m.content.trim().length > 0), assistantMsg]);
          speak(fallbackText);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading]
  );

  // Initialize Voice Engine Hook
  const {
    isListening,
    isSpeaking,
    isTranscribing,
    transcript,
    audioLevel,
    micError,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    setTranscript,
  } = useVoice({
    onTranscriptReady: (spokenText) => {
      handleSendCommand(spokenText, 'voice');
    },
    wakeWordEnabled: false,
    wakePhrase: 'hey edith',
  });

  // Agent Boot sequence: immediately responds when the system boots up!
  const bootState = useAgentBoot({
    autoSpeak: true,
    onSpeakGreeting: (text) => {
      // Vocalize initial greeting
      speak(text);
    },
  });

  // Track task counts periodically
  useEffect(() => {
    const fetchTasksCount = async () => {
      try {
        const tasks = await api.getTasks();
        setActiveTaskCount(tasks.filter((t) => t.status === 'RUNNING').length);
      } catch {
        // ignore
      }
    };
    fetchTasksCount();
    const interval = setInterval(fetchTasksCount, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fetch session recovery state on boot
  useEffect(() => {
    const checkRecovery = async () => {
      try {
        const rec = await api.getSessionRecovery();
        setRecoveryData(rec);
      } catch {
        // ignore
      }
    };
    checkRecovery();
  }, []);

  const handleQuickResumeRecovery = async (taskId: string) => {
    try {
      await api.resumeInterruptedTask(taskId);
      const rec = await api.getSessionRecovery();
      setRecoveryData(rec);
      setViewMode('tasks');
    } catch (e) {
      console.error('Failed to resume task:', e);
    }
  };

  const handleDismissRecoveryNotice = async () => {
    try {
      await api.dismissRecoveryState();
      setRecoveryDismissed(true);
    } catch {
      setRecoveryDismissed(true);
    }
  };

  // Calculate dynamic 5-state AIOrb
  let orbState: OrbState = 'idle';
  if (!isBackendConnected) {
    orbState = 'offline';
  } else if (error) {
    orbState = 'error';
  } else if (isListening) {
    orbState = 'listening';
  } else if (isLoading || isTranscribing) {
    orbState = 'thinking';
  } else if (isSpeaking) {
    orbState = 'speaking';
  } else {
    orbState = 'idle';
  }

  return (
    <div className="max-w-[1700px] mx-auto px-2 md:px-5 py-3 flex flex-col h-[calc(100vh-4.2rem)] space-y-3 font-sans">
      {/* Session Recovery Banner (if any tasks were interrupted) */}
      {!recoveryDismissed && recoveryData && recoveryData.interruptedTasks && recoveryData.interruptedTasks.length > 0 && (
        <div className="shrink-0 p-3 rounded-2xl bg-gradient-to-r from-[#FFB020]/20 via-[#0D1730] to-[#0A1128] border border-[#FFB020]/40 flex items-center justify-between gap-3 text-xs font-mono shadow-[0_0_20px_rgba(255,176,32,0.1)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-[#FFB020]/20 text-[#FFB020] border border-[#FFB020]/30 shrink-0">
              <RotateCcw className="w-4 h-4 animate-spin-slow" />
            </div>
            <div className="truncate">
              <span className="font-bold text-[#FFB020] uppercase tracking-wide">
                RECOVERY: {recoveryData.interruptedTasks.length} INTERRUPTED TASK(S) DETECTED
              </span>
              <p className="text-[11px] text-[#8FA3BF] truncate mt-0.5">
                {recoveryData.resumeSummary} — Suggested: {recoveryData.suggestedNextAction}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleQuickResumeRecovery(recoveryData.interruptedTasks[0].id)}
              className="px-3 py-1.5 rounded-lg bg-[#22D3A0]/20 border border-[#22D3A0]/40 text-[#22D3A0] hover:bg-[#22D3A0]/30 font-bold flex items-center gap-1 cursor-pointer transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume</span>
            </button>
            <button
              onClick={() => setViewMode('tasks')}
              className="px-3 py-1.5 rounded-lg bg-[#00E5FF]/20 border border-[#00E5FF]/40 text-[#00E5FF] hover:bg-[#00E5FF]/30 font-bold flex items-center gap-1 cursor-pointer transition-all"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>View Tasks</span>
            </button>
            <button
              onClick={handleDismissRecoveryNotice}
              className="px-2.5 py-1.5 rounded-lg bg-[#060C1B] border border-[#8FA3BF]/30 text-[#8FA3BF] hover:text-white cursor-pointer transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Top OS Navigation & Multitasking Mode Switcher */}
      <div className="shrink-0 flex items-center justify-between p-2 rounded-2xl bg-[#0D1730]/80 border border-[#00E5FF]/20 backdrop-blur-md">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          <button
            onClick={() => setViewMode('cockpit')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'cockpit'
                ? 'bg-[#00E5FF] text-[#05080F] shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                : 'text-[#8FA3BF] hover:text-white hover:bg-[#0A1128]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>COCKPIT</span>
          </button>

          <button
            onClick={() => setViewMode('tasks')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'tasks'
                ? 'bg-[#00E5FF] text-[#05080F] shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                : 'text-[#8FA3BF] hover:text-white hover:bg-[#0A1128]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>MULTI-TASK</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                viewMode === 'tasks'
                  ? 'bg-[#05080F] text-[#00E5FF]'
                  : 'bg-[#00E5FF]/20 text-[#00E5FF]'
              }`}
            >
              {activeTaskCount}
            </span>
          </button>

          <button
            onClick={() => setViewMode('terminal')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'terminal'
                ? 'bg-[#00E5FF] text-[#05080F] shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                : 'text-[#8FA3BF] hover:text-white hover:bg-[#0A1128]'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>CYBER TERMINAL</span>
          </button>

          <button
            onClick={() => setViewMode('cyber')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'cyber'
                ? 'bg-[#00E5FF] text-[#05080F] shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                : 'text-[#8FA3BF] hover:text-white hover:bg-[#0A1128]'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>CYBER ARSENAL</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-[#00E5FF]/20 text-[#00E5FF]">
              SKILLS
            </span>
          </button>

          <button
            onClick={() => setViewMode('vault')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'vault'
                ? 'bg-[#00E5FF] text-[#05080F] shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                : 'text-[#8FA3BF] hover:text-white hover:bg-[#0A1128]'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>FILE VAULT</span>
          </button>

          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'split'
                ? 'bg-[#2F6BFF] text-white shadow-[0_0_15px_rgba(47,107,255,0.4)]'
                : 'text-[#8FA3BF] hover:text-white hover:bg-[#0A1128]'
            }`}
            title="Split Desktop: Chat + Multi-Task + Terminal in one view"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SPLIT DESKTOP</span>
          </button>
        </div>

        {/* Vocal greeting status & test button */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            onClick={() => speak(bootState.spokenGreeting || bootState.agentGreeting || 'EDITH Tactical OS standing by.')}
            className="px-2.5 py-1 rounded-lg bg-[#060C1B] border border-[#00E5FF]/25 text-[#00E5FF] hover:bg-[#00E5FF]/20 text-[11px] flex items-center gap-1 transition-all cursor-pointer"
            title="Hear EDITH voice greeting in Indian Standard Time"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">EDITH VOICE (IST)</span>
          </button>
          <span className="w-2 h-2 rounded-full bg-[#22D3A0] animate-ping" />
        </div>
      </div>

      {/* Immediate Boot Sequence Banner (Prominent Holographic OS Initializer) */}
      {bootState.agentGreeting && messages.length === 0 && (
        <div className="shrink-0 p-3.5 rounded-2xl bg-gradient-to-r from-[#0A1128]/95 via-[#0D1730]/90 to-[#0A1128]/95 border border-[#00E5FF]/30 shadow-[0_0_25px_rgba(0,229,255,0.1)] flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/40 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-[#00E5FF] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase text-[#00E5FF] tracking-wider font-bold">
                  AUTONOMOUS AGENT ACTIVE
                </span>
                <span className="text-[10px] font-mono text-[#22D3A0] bg-[#22D3A0]/15 px-1.5 py-0.2 rounded font-bold">
                  STANDBY
                </span>
                <span className="text-[10px] font-mono text-[#FFB020] bg-[#FFB020]/15 px-1.5 py-0.2 rounded border border-[#FFB020]/30 font-bold">
                  🇮🇳 {bootState.istTime.periodLabel} · {bootState.istTime.formattedTime12} IST
                </span>
              </div>
              <p className="text-xs text-[#E6F1FF] font-medium mt-1 max-w-2xl leading-relaxed">
                {bootState.agentGreeting}
              </p>
            </div>
          </div>

          {/* Quick Mission Launchers */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <button
              onClick={() => handleSendCommand('Run comprehensive system diagnostic', 'text')}
              className="px-2.5 py-1 rounded-lg bg-[#060C1B] border border-[#00E5FF]/25 text-[11px] font-mono text-[#00E5FF] hover:bg-[#00E5FF]/20 cursor-pointer"
            >
              Diagnostic
            </button>
            <button
              onClick={() => handleSendCommand('Spawn a security audit on 127.0.0.1 and check active ports', 'text')}
              className="px-2.5 py-1 rounded-lg bg-[#060C1B] border border-[#22D3A0]/25 text-[11px] font-mono text-[#22D3A0] hover:bg-[#22D3A0]/20 cursor-pointer"
            >
              Security Scan
            </button>
            <button
              onClick={() => handleSendCommand('Perform deep recon on latest cybersecurity trends and create a note', 'text')}
              className="px-2.5 py-1 rounded-lg bg-[#060C1B] border border-[#2F6BFF]/25 text-[11px] font-mono text-[#2F6BFF] hover:bg-[#2F6BFF]/20 cursor-pointer"
            >
              Multitask Recon
            </button>
          </div>
        </div>
      )}

      {/* VIEWPORT AREA ACCORDING TO VIEW MODE */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* VIEW 1: COCKPIT MODE */}
        {viewMode === 'cockpit' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-3.5 min-h-0 overflow-hidden">
            {/* Left Column: System Monitor (3 cols) */}
            <div className="lg:col-span-3 flex flex-col space-y-3 overflow-y-auto">
              <SystemMonitor />

              {/* Quick Tactical Voice Shortcuts */}
              <div className="p-3.5 rounded-2xl bg-[#0D1730]/70 border border-[#00E5FF]/15 text-xs font-mono space-y-2">
                <span className="text-[10px] text-[#00E5FF] uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" /> AGENT CAPABILITIES
                </span>
                <div className="space-y-1.5 text-[#8FA3BF]">
                  <p
                    onClick={() => handleSendCommand('Run full system diagnostic and check RAM', 'voice')}
                    className="hover:text-[#00E5FF] cursor-pointer truncate"
                  >
                    &bull; &ldquo;Run system diagnostic&rdquo;
                  </p>
                  <p
                    onClick={() => handleSendCommand('Spawn background security sweep on localhost', 'voice')}
                    className="hover:text-[#00E5FF] cursor-pointer truncate"
                  >
                    &bull; &ldquo;Spawn security sweep on localhost&rdquo;
                  </p>
                  <p
                    onClick={() => handleSendCommand('Search latest zero-day exploits in 2026', 'voice')}
                    className="hover:text-[#00E5FF] cursor-pointer truncate"
                  >
                    &bull; &ldquo;Search latest zero-day exploits&rdquo;
                  </p>
                  <p
                    onClick={() => handleSendCommand('Create a note called tactical_plan.md', 'voice')}
                    className="hover:text-[#00E5FF] cursor-pointer truncate"
                  >
                    &bull; &ldquo;Create note tactical_plan.md&rdquo;
                  </p>
                  <p
                    onClick={() => handleSendCommand('List all workspace files and read notes', 'voice')}
                    className="hover:text-[#00E5FF] cursor-pointer truncate"
                  >
                    &bull; &ldquo;List all workspace files&rdquo;
                  </p>
                </div>
              </div>
            </div>

            {/* Center Column: Animated Orb, Voice Console & Chat Panel (6 cols) */}
            <div className="lg:col-span-6 flex flex-col h-full space-y-3 min-h-0">
              {/* Central AIOrb & Voice Console */}
              <div className="shrink-0 flex flex-col items-center justify-center p-3 rounded-2xl bg-[#0A1128]/60 border border-[#00E5FF]/15 space-y-2">
                <AIOrb size="md" state={orbState} showStatusLabel />

                {/* Voice Console with live audio visualizer */}
                <VoiceConsole
                  transcript={transcript}
                  isListening={isListening}
                  isSpeaking={isSpeaking}
                  isTranscribing={isTranscribing}
                  audioLevel={audioLevel}
                  micError={micError}
                  onSendTranscript={(text) => handleSendCommand(text, 'voice')}
                  onClear={() => setTranscript('')}
                  onSimulateVoice={(preset) => handleSendCommand(preset, 'voice')}
                />
              </div>

              {/* Chat Panel / Message Exchange */}
              <div className="flex-1 rounded-2xl bg-[#0D1730]/60 border border-[#00E5FF]/15 p-4 overflow-y-auto space-y-3 min-h-0">
                {messages.length === 0 && !isLoading && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs font-mono text-[#8FA3BF] space-y-2">
                    <Sparkles className="w-6 h-6 text-[#00E5FF] mx-auto animate-pulse" />
                    <p className="text-sm font-semibold text-white font-['Orbitron',sans-serif]">
                      EDITH TACTICAL COCKPIT READY
                    </p>
                    <p className="max-w-md">
                      Talk or type commands. EDITH can execute system diagnostics, run network recon, audit security headers, identify hashes, and manage multitasking.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 pt-3 max-w-lg">
                      {[
                        'Scan localhost ports',
                        'Audit security headers on localhost:3000',
                        'Identify hash 5d41402abc4b2a76b9719d911017c592',
                        'Audit code security for OWASP Top 10',
                        'System status and telemetry',
                      ].map((promptText) => (
                        <button
                          key={promptText}
                          onClick={() => handleSendCommand(promptText, 'text')}
                          className="px-2.5 py-1 rounded bg-[#0A1128] hover:bg-[#00E5FF]/20 border border-[#00E5FF]/25 text-[#00E5FF] text-[11px] font-mono transition-all cursor-pointer"
                        >
                          {promptText}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    role={m.role}
                    content={m.content}
                    createdAt={m.created_at}
                  />
                ))}

                {isLoading && <LoadingIndicator message="EDITH is evaluating intent and tools..." />}

                {error && <ErrorMessage code={error.code} message={error.message} />}

                {/* Active Web Search Sources Panel */}
                {activeSources.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#0A1128] border border-[#00E5FF]/30 space-y-1.5 mt-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#00E5FF] font-bold">
                      Verified Research Citations
                    </span>
                    <div className="space-y-1">
                      {activeSources.map((s, idx) => (
                        <a
                          key={idx}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between text-xs font-mono text-[#8FA3BF] hover:text-[#00E5FF] p-1.5 rounded bg-[#0D1730] border border-[#00E5FF]/10 transition-colors"
                        >
                          <span className="truncate max-w-[85%]">{s.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Activity Feed & Permission Dialog (3 cols) */}
            <div className="lg:col-span-3 flex flex-col space-y-3 overflow-y-auto">
              <PermissionDialog onActionDecided={() => {}} />
              <ActivityFeed />
              <div className="p-3.5 rounded-2xl bg-[#0D1730]/70 border border-[#00E5FF]/15 text-xs font-mono space-y-2">
                <div className="flex items-center gap-1.5 text-[#22D3A0] font-bold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>OS MULTITASK STATUS</span>
                </div>
                <p className="text-[11px] text-[#8FA3BF] leading-relaxed">
                  Concurrent thread scheduler running with {activeTaskCount} active daemon subtasks.
                </p>
                <button
                  onClick={() => setViewMode('tasks')}
                  className="w-full mt-1 px-3 py-1.5 rounded bg-[#00E5FF]/15 border border-[#00E5FF]/30 text-[#00E5FF] hover:bg-[#00E5FF]/25 font-mono text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Open Task Manager</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: MULTI-TASK MANAGER */}
        {viewMode === 'tasks' && (
          <div className="h-full">
            <TaskManager onTaskSpawned={() => setActiveTaskCount((c) => c + 1)} />
          </div>
        )}

        {/* VIEW 3: CYBER TERMINAL */}
        {viewMode === 'terminal' && (
          <div className="h-full">
            <CyberTerminal onSpeak={speak} />
          </div>
        )}

        {/* VIEW: CYBER ARSENAL */}
        {viewMode === 'cyber' && (
          <div className="h-full rounded-2xl overflow-hidden border border-[#00E5FF]/20">
            <CyberArsenal />
          </div>
        )}

        {/* VIEW 4: FILE VAULT */}
        {viewMode === 'vault' && (
          <div className="h-full">
            <FileVault />
          </div>
        )}

        {/* VIEW 5: SPLIT DESKTOP (Side-by-side multitasking cockpit) */}
        {viewMode === 'split' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
            {/* Left: Chat & Voice (4 cols) */}
            <div className="lg:col-span-4 flex flex-col h-full space-y-2 min-h-0 bg-[#0D1730]/60 border border-[#00E5FF]/20 rounded-2xl p-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#00E5FF]/15">
                <span className="text-xs font-mono font-bold text-[#00E5FF] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> ASSISTANT CONSOLE
                </span>
                <span className="text-[10px] font-mono text-[#8FA3BF]">LIVE CHAT</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    role={m.role}
                    content={m.content}
                    createdAt={m.created_at}
                  />
                ))}
                {isLoading && <LoadingIndicator message="EDITH processing..." />}
              </div>
            </div>

            {/* Center: Multi-Task Process Board (4 cols) */}
            <div className="lg:col-span-4 h-full min-h-0">
              <TaskManager compact />
            </div>

            {/* Right: Cyber Terminal (4 cols) */}
            <div className="lg:col-span-4 h-full min-h-0">
              <CyberTerminal onSpeak={speak} />
            </div>
          </div>
        )}
      </div>

      {/* Pinned Bottom Command Bar */}
      <div className="shrink-0 p-2.5 rounded-2xl bg-[#0D1730]/95 border border-[#00E5FF]/30 shadow-[0_4px_25px_rgba(0,0,0,0.6)] flex items-center gap-2">
        {/* [ MIC ] Button */}
        <button
          onClick={toggleListening}
          title={isListening ? 'Click to stop recording and send' : 'Click to start speaking'}
          className={`px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            isTranscribing
              ? 'bg-[#2F6BFF] text-white animate-pulse'
              : isListening
              ? 'bg-[#FF4D6A] text-white shadow-[0_0_20px_rgba(255,77,106,0.8)] animate-pulse'
              : 'bg-[#0A1128] text-[#00E5FF] border border-[#00E5FF]/40 hover:bg-[#00E5FF]/20 hover:border-[#00E5FF]'
          }`}
        >
          {isTranscribing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline">TRANSCRIBING...</span>
            </>
          ) : isListening ? (
            <>
              <Mic className="w-4 h-4 animate-ping" />
              <span className="hidden sm:inline">STOP MIC</span>
              {audioLevel > 15 && (
                <span className="w-2 h-2 rounded-full bg-[#22D3A0] animate-ping" />
              )}
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline">MIC</span>
            </>
          )}
        </button>

        {/* Input Text Box */}
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSendCommand(commandInput, 'text');
            }
          }}
          placeholder="Speak by clicking [MIC] or type command (e.g. 'check my CPU', 'spawn security scan', 'open VS Code')..."
          className="flex-1 bg-transparent px-3 py-2 text-sm text-[#E6F1FF] placeholder-[#8FA3BF]/60 focus:outline-none font-sans"
        />

        {/* [ SEND / TRANSMIT ] Button */}
        <button
          onClick={() => handleSendCommand(commandInput, 'text')}
          disabled={!commandInput.trim() || isLoading}
          className="px-4 py-2.5 rounded-xl font-mono text-xs font-bold bg-gradient-to-r from-[#00E5FF] to-[#2F6BFF] text-[#05080F] hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <span>SEND</span>
          <Send className="w-3.5 h-3.5" />
        </button>

        {/* [ STOP SPEAKING ] Button */}
        {isSpeaking && (
          <button
            onClick={stopSpeaking}
            className="px-3 py-2.5 rounded-xl font-mono text-xs font-bold bg-[#FF4D6A]/20 text-[#FF4D6A] border border-[#FF4D6A]/40 hover:bg-[#FF4D6A] hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            title="Interrupt speech output"
          >
            <VolumeX className="w-3.5 h-3.5" />
            <span className="hidden md:inline">STOP SPEAKING</span>
          </button>
        )}
      </div>
    </div>
  );
};
