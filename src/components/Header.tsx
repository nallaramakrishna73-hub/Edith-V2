import React, { useState, useEffect } from 'react';
import { Menu, Mic, MicOff, Sparkles, Globe, Radio, Clock } from 'lucide-react';
import { StatusResponse } from '../types/api.ts';
import { getIndianTimeDetails, IndianTimeDetails } from '../utils/time.ts';

interface HeaderProps {
  title: string;
  subtitle?: string;
  status: StatusResponse | null;
  isBackendConnected: boolean;
  onToggleSidebar: () => void;
  isMicActive?: boolean;
  onToggleMic?: () => void;
  isWakeWordActive?: boolean;
  onToggleWakeWord?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  status,
  isBackendConnected,
  onToggleSidebar,
  isMicActive = false,
  onToggleMic,
  isWakeWordActive = false,
  onToggleWakeWord,
}) => {
  const aiStatus = status?.ai?.status || 'not_configured';

  // Live IST Clock updated every second
  const [istTime, setIstTime] = useState<IndianTimeDetails>(getIndianTimeDetails());

  useEffect(() => {
    const timer = setInterval(() => {
      setIstTime(getIndianTimeDetails());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 px-4 md:px-6 bg-[#0A1128]/85 backdrop-blur-md border-b border-[#00E5FF]/15 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle navigation drawer"
          className="p-2 rounded-lg text-[#8FA3BF] hover:text-[#00E5FF] hover:bg-[#0D1730] border border-transparent hover:border-[#00E5FF]/20 md:hidden transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base md:text-lg font-bold font-['Orbitron',sans-serif] tracking-wider text-[#E6F1FF] flex items-center gap-2">
            <span>{title}</span>
            <span className="hidden md:inline-block text-[#00E5FF]/40 text-xs">/</span>
            {subtitle && (
              <span className="hidden md:inline-block text-xs font-mono font-normal text-[#8FA3BF]">
                {subtitle}
              </span>
            )}
          </h1>
        </div>
      </div>

      {/* Tactical Status Pills & Live IST Clock */}
      <div className="flex items-center gap-2">
        {/* Live Indian Standard Time Clock */}
        <div
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-mono bg-[#0D1730] border border-[#00E5FF]/30 text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.15)]"
          title={`Indian Standard Time: ${istTime.formattedDate}`}
        >
          <Clock className="w-3.5 h-3.5 text-[#00E5FF] animate-pulse" />
          <span className="font-bold tracking-wider">{istTime.formattedTimeWithSeconds}</span>
          <span className="text-[10px] px-1 py-0.2 rounded bg-[#00E5FF]/20 text-[#00E5FF] font-bold">
            IST
          </span>
        </div>

        {/* MIC: ON / OFF toggle */}
        <button
          onClick={onToggleMic}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border transition-all cursor-pointer ${
            isMicActive
              ? 'bg-[#00E5FF]/15 border-[#00E5FF] text-[#00E5FF] shadow-[0_0_10px_rgba(0,229,255,0.3)] animate-pulse'
              : 'bg-[#0D1730] border-[#00E5FF]/20 text-[#8FA3BF] hover:border-[#00E5FF]/40'
          }`}
          title="Click to toggle microphone"
        >
          {isMicActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          <span className="font-bold">{isMicActive ? 'MIC: ON' : 'MIC: OFF'}</span>
        </button>

        {/* AI: ONLINE */}
        <div
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
            aiStatus === 'ready'
              ? 'bg-[#22D3A0]/10 border-[#22D3A0]/30 text-[#22D3A0]'
              : 'bg-[#FF4D6A]/10 border-[#FF4D6A]/30 text-[#FF4D6A]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="font-bold">
            {aiStatus === 'ready' ? 'AI: ONLINE' : 'AI: OFFLINE'}
          </span>
        </div>

        {/* SEARCH: READY */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-[#0D1730] border border-[#00E5FF]/20 text-[#00E5FF]">
          <Globe className="w-3.5 h-3.5" />
          <span className="font-bold">SEARCH: READY</span>
        </div>

        {/* WAKE: ON / OFF */}
        <button
          onClick={onToggleWakeWord}
          className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border transition-all cursor-pointer ${
            isWakeWordActive
              ? 'bg-[#22D3A0]/15 border-[#22D3A0] text-[#22D3A0]'
              : 'bg-[#0D1730] border-[#8FA3BF]/20 text-[#8FA3BF] hover:text-[#E6F1FF]'
          }`}
          title="Click to toggle Hey EDITH wake phrase detection"
        >
          <Radio className="w-3.5 h-3.5" />
          <span className="font-bold">{isWakeWordActive ? 'WAKE: ON' : 'WAKE: OFF'}</span>
        </button>
      </div>
    </header>
  );
};
