import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Cpu,
  Database,
  Lock,
  Server,
  Sliders,
  Mic,
  Radio,
  FolderCode,
  ShieldAlert,
  Volume2,
} from 'lucide-react';
import { useStatus } from '../hooks/useStatus.ts';
import { api } from '../services/api.ts';

export const Settings: React.FC = () => {
  const { status, isBackendConnected } = useStatus();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then((res) => setSettings(res)).catch(() => {});
  }, []);

  const handleUpdate = async (key: string, value: unknown) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    try {
      await api.updateSettings({ [key]: value });
      setSaveMessage(`Updated ${key}`);
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      console.error('Failed to update setting:', err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#00E5FF]/15 flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-['Orbitron',sans-serif] text-white tracking-wide">
            SYSTEM PARAMETERS &amp; VOICE CONFIG
          </h2>
          <p className="text-xs text-[#8FA3BF] font-mono mt-1">
            KALI LINUX TARGET · PERMISSION POLICY · HARDENED DEFENSE
          </p>
        </div>
        {saveMessage && (
          <span className="text-xs font-mono text-[#22D3A0] bg-[#22D3A0]/10 px-3 py-1 rounded-full border border-[#22D3A0]/30 animate-pulse">
            {saveMessage}
          </span>
        )}
      </div>

      {/* Security Advisory Callout */}
      <div className="p-4 rounded-xl bg-[#0D1730] border border-[#00E5FF]/30 flex items-start gap-3 shadow-[0_0_20px_rgba(0,229,255,0.08)]">
        <div className="p-2 rounded-lg bg-[#00E5FF]/10 text-[#00E5FF] shrink-0 mt-0.5">
          <Lock className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-mono font-bold text-[#00E5FF] tracking-wider uppercase">
            CENTRAL PERMISSION ENGINE ACTIVE
          </h4>
          <p className="text-xs text-[#8FA3BF] leading-relaxed">
            The AI model cannot execute raw bash or terminal commands directly. Every action passes through the
            allowlisted Tool Registry and Permission Engine. Sensitive actions require explicit confirmation.
          </p>
        </div>
      </div>

      {/* Voice & Assistant Settings */}
      <div className="p-5 rounded-xl bg-[#0D1730]/80 border border-[#00E5FF]/20 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-[#00E5FF]">
            <Mic className="w-4 h-4" />
            <h3 className="text-sm font-bold font-['Orbitron',sans-serif] text-white">
              TACTICAL VOICE ENGINE · VOICE ID: XZXyuzPdidXaSa10PmVA
            </h3>
          </div>
          <button
            onClick={() => {
              if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(
                  'EDITH Tactical voice ID XZXyuzPdidXaSa10PmVA online. Operating system neural link initialized for Indian Standard Time operations.'
                );
                u.rate = 1.08;
                u.pitch = 1.05;
                window.speechSynthesis.speak(u);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30 text-xs font-mono font-bold transition-all cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            TEST VOICE
          </button>
        </div>

        {/* Voice Persona Banner */}
        <div className="p-3 rounded-lg bg-[#060C1B] border border-[#00E5FF]/30 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-ping" />
            <span className="text-[#8FA3BF]">Assigned Voice ID:</span>
            <code className="text-[#00E5FF] font-bold bg-[#0D1730] px-2 py-0.5 rounded border border-[#00E5FF]/20">
              XZXyuzPdidXaSa10PmVA
            </code>
          </div>
          <span className="text-[#22D3A0] text-[11px] font-semibold">
            STATUS: ACTIVE &amp; CALIBRATED (1.08x / 1.05 pitch)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          <div className="p-3 rounded-lg bg-[#060C1B] border border-[#00E5FF]/10 flex items-center justify-between">
            <div>
              <span className="text-[#E6F1FF] font-semibold block">Auto Boot Vocal Greeting</span>
              <span className="text-[#8FA3BF] text-[11px]">Responds immediately when OS starts</span>
            </div>
            <button
              onClick={() => handleUpdate('auto_greet_enabled', settings.auto_greet_enabled === false ? true : false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                settings.auto_greet_enabled !== false
                  ? 'bg-[#00E5FF] text-[#05080F]'
                  : 'bg-[#0A1128] text-[#8FA3BF] border border-[#8FA3BF]/30'
              }`}
            >
              {settings.auto_greet_enabled !== false ? 'ACTIVE' : 'OFF'}
            </button>
          </div>

          <div className="p-3 rounded-lg bg-[#060C1B] border border-[#00E5FF]/10 flex items-center justify-between">
            <div>
              <span className="text-[#E6F1FF] font-semibold block">Speech Synthesis (TTS)</span>
              <span className="text-[#8FA3BF] text-[11px]">Vocalizes concise summaries</span>
            </div>
            <button
              onClick={() => handleUpdate('voice_enabled', settings.voice_enabled === false ? true : false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                settings.voice_enabled !== false
                  ? 'bg-[#00E5FF] text-[#05080F]'
                  : 'bg-[#0A1128] text-[#8FA3BF] border border-[#8FA3BF]/30'
              }`}
            >
              {settings.voice_enabled !== false ? 'ACTIVE' : 'MUTED'}
            </button>
          </div>

          <div className="p-3 rounded-lg bg-[#060C1B] border border-[#00E5FF]/10 flex items-center justify-between">
            <div>
              <span className="text-[#E6F1FF] font-semibold block">Firebase Firestore Cloud Sync</span>
              <span className="text-[#8FA3BF] text-[11px]">gen-lang-client-0072622131 · asia-southeast1</span>
            </div>
            <span className="px-3 py-1 rounded bg-[#22D3A0]/20 text-[#22D3A0] font-bold text-xs border border-[#22D3A0]/30">
              CONNECTED
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#060C1B] border border-[#00E5FF]/10 flex items-center justify-between">
            <div>
              <span className="text-[#E6F1FF] font-semibold block">Low-Latency SSE Streaming</span>
              <span className="text-[#8FA3BF] text-[11px]">Instantaneous token delivery (&lt;500ms)</span>
            </div>
            <span className="px-3 py-1 rounded bg-[#00E5FF]/20 text-[#00E5FF] font-bold text-xs border border-[#00E5FF]/30">
              ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Grid of System Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Core Architecture */}
        <div className="p-5 rounded-xl bg-[#0D1730]/80 border border-[#00E5FF]/15 space-y-4">
          <div className="flex items-center gap-2.5 text-[#00E5FF]">
            <Server className="w-4 h-4" />
            <h3 className="text-sm font-bold font-['Orbitron',sans-serif] text-white">
              CORE SYSTEM
            </h3>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#00E5FF]/10">
              <span className="text-[#8FA3BF]">Target Environment</span>
              <span className="text-[#00E5FF] font-semibold">Kali Linux / Desktop</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#00E5FF]/10">
              <span className="text-[#8FA3BF]">Tool Execution Engine</span>
              <span className="text-[#22D3A0]">Strict Pydantic / Typed Validation</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#00E5FF]/10">
              <span className="text-[#8FA3BF]">Database File</span>
              <span className="text-[#E6F1FF]">edith.db (SQLite 3)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#8FA3BF]">Audit Logs</span>
              <span className="text-[#22D3A0]">Enabled · audit_log table</span>
            </div>
          </div>
        </div>

        {/* Allowed Applications & Scope */}
        <div className="p-5 rounded-xl bg-[#0D1730]/80 border border-[#00E5FF]/15 space-y-4">
          <div className="flex items-center gap-2.5 text-[#00E5FF]">
            <ShieldAlert className="w-4 h-4" />
            <h3 className="text-sm font-bold font-['Orbitron',sans-serif] text-white">
              DEFENSIVE SCOPE &amp; APPS
            </h3>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="py-1.5 border-b border-[#00E5FF]/10">
              <span className="text-[#8FA3BF] block mb-1">Approved Applications</span>
              <span className="text-[#E6F1FF] text-[11px]">
                firefox, code, terminal, thunar, wireshark, burpsuite, nmap
              </span>
            </div>
            <div className="py-1.5 border-b border-[#00E5FF]/10">
              <span className="text-[#8FA3BF] block mb-1">Authorized Scan Targets</span>
              <span className="text-[#22D3A0] text-[11px]">
                127.0.0.1, localhost, 192.168.1.0/24 (Strict scope check)
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#8FA3BF]">Workspace Directory</span>
              <span className="text-[#00E5FF]">~/workspace</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
