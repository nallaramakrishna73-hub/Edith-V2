import React from 'react';
import {
  ShieldAlert,
  Compass,
  CheckCircle2,
  Lock,
  Radio,
  Sparkles,
  GitBranch,
} from 'lucide-react';
import { AIOrb } from '../components/AIOrb.tsx';

export const About: React.FC = () => {
  const principles = [
    {
      title: 'Tools, Not Terminals',
      description:
        'The AI may only request registered tools with validated arguments. It never receives raw shell access.',
    },
    {
      title: 'Full Transparency',
      description:
        'Always show the heard text, the intended action, and the real execution result for every command.',
    },
    {
      title: 'Permission by Design',
      description:
        'Sensitive actions (file deletion, network scans) require explicit user confirmation through PendingAction cards.',
    },
    {
      title: 'Local First & Privacy by Default',
      description:
        'Microphone is off until explicitly enabled; no raw audio is retained; transcripts and audit logs remain strictly on your machine.',
    },
    {
      title: 'Defensive Scope Restriction',
      description:
        'Security testing features are strictly confined to authorized systems declared in settings.',
    },
    {
      title: 'Accessible & Responsive',
      description:
        'Full keyboard navigation, WCAG AA high-contrast styling, prefers-reduced-motion support, and adaptive multi-screen layouts.',
    },
  ];

  const roadmapPhases = [
    { phase: '1-3', name: 'Foundation MVP', status: 'Delivered', detail: 'Architecture, Cinematic HUD Dashboard, Real AI Brain, Contextual Chat, SQLite' },
    { phase: '4', name: 'Voice I/O Engine', status: 'Delivered', detail: 'Microphone speech recognition, real-time transcript console, and TTS audio synthesis with barge-in' },
    { phase: '5', name: 'Wake Word & Push-to-Talk', status: 'Delivered', detail: '"Hey EDITH" wake phrase activation, push-to-talk, one-click mute controls' },
    { phase: '6', name: 'Tool Registry & Permission Engine', status: 'Delivered', detail: 'Application launcher (Firefox, VS Code), workspace file tools, system monitor, and pending action dialogs' },
    { phase: '7', name: 'Web Research Engine', status: 'Delivered', detail: 'Live search grounding, source links, citations, and search result cache' },
    { phase: '8-10', name: 'System Telemetry & Defensive Security', status: 'Delivered', detail: 'CPU/RAM/Disk metrics, top processes, and scope-restricted defensive scans' },
    { phase: '11-15', name: 'Multi-device, Packaging & Zero-Trust', status: 'Planned', detail: 'Hardened zero-trust tokens and native Kali Linux packaging' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-8">
      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row items-center gap-6 p-6 md:p-8 rounded-2xl bg-[#0D1730]/80 border border-[#00E5FF]/20 shadow-xl">
        <AIOrb size="md" state="idle" />

        <div className="space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A1128] border border-[#00E5FF]/30 text-xs font-mono text-[#00E5FF]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>VOICE-CONTROLLED UPGRADE ACTIVE</span>
          </div>

          <h2 className="text-2xl md:text-3xl font-black font-['Orbitron',sans-serif] text-white tracking-wider">
            EDITH AI OS
          </h2>
          <p className="text-sm font-['Rajdhani',sans-serif] text-[#00E5FF] text-lg font-semibold tracking-wide">
            Enhanced Digital Intelligence &amp; Tactical Helper
          </p>
          <p className="text-xs text-[#8FA3BF] max-w-xl leading-relaxed">
            A voice-controlled personal assistant and operating environment running on Kali Linux.
            Engineered with a central Permission Engine, live system monitoring, web research with citations, and allowlisted desktop tool execution.
          </p>
        </div>
      </div>

      {/* Security Engine Constitution */}
      <section className="p-5 rounded-xl bg-[#0D1730] border border-[#22D3A0]/40 space-y-2">
        <div className="flex items-center gap-2 text-[#22D3A0]">
          <ShieldAlert className="w-4 h-4" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider">
            SECURITY &amp; PERMISSION CONSTITUTION
          </h3>
        </div>
        <p className="text-xs text-[#E6F1FF] leading-relaxed">
          EDITH operates under strict guardrails. The AI never gets a raw shell (`shell=True` is prohibited).
          Every request passes through the Tool Registry:
        </p>
        <div className="pt-2 text-xs font-mono text-[#8FA3BF] flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[#22D3A0]">✔ READ_ONLY: Auto-executed and logged</span>
          <span className="text-[#00E5FF]">✔ LOW_RISK: Allowlisted app launch and note creation</span>
          <span className="text-[#FFB020]">✔ REQUIRES_CONFIRMATION: 60s approval dialog for file deletions and scans</span>
          <span className="text-[#FF4D6A]">✖ BLOCKED_BY_DEFAULT: Arbitrary shell execution permanently blocked</span>
        </div>
      </section>

      {/* Architectural Principles */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#00E5FF]" />
          <h3 className="text-xs font-mono tracking-widest text-[#8FA3BF] uppercase font-bold">
            DESIGN PRINCIPLES
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {principles.map((principle) => (
            <div
              key={principle.title}
              className="p-4 rounded-xl bg-[#0D1730]/70 border border-[#00E5FF]/15 space-y-1.5"
            >
              <h4 className="text-sm font-bold font-['Rajdhani',sans-serif] text-[#00E5FF] tracking-wide">
                {principle.title}
              </h4>
              <p className="text-xs text-[#8FA3BF] leading-relaxed">
                {principle.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Roadmap Summary */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-[#00E5FF]" />
          <h3 className="text-xs font-mono tracking-widest text-[#8FA3BF] uppercase font-bold">
            PROGRESS &amp; ROADMAP
          </h3>
        </div>

        <div className="rounded-xl bg-[#0D1730]/70 border border-[#00E5FF]/15 divide-y divide-[#00E5FF]/10 overflow-hidden">
          {roadmapPhases.map((phase) => (
            <div
              key={phase.phase}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#00E5FF] font-semibold">
                    Phase {phase.phase}
                  </span>
                  <span className="text-xs font-bold text-[#E6F1FF] font-['Rajdhani',sans-serif] text-base">
                    {phase.name}
                  </span>
                </div>
                <p className="text-xs text-[#8FA3BF]">{phase.detail}</p>
              </div>

              <span
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium shrink-0 self-start sm:self-center ${
                  phase.status === 'Delivered'
                    ? 'bg-[#22D3A0]/20 text-[#22D3A0] border border-[#22D3A0]/40'
                    : 'bg-[#0A1128] text-[#8FA3BF] border border-[#8FA3BF]/20'
                }`}
              >
                {phase.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
