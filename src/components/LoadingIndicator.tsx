import React from 'react';

interface LoadingIndicatorProps {
  message?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = 'EDITH is synthesizing tactical intelligence...',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0D1730]/80 border border-[#00E5FF]/30 w-fit max-w-md shadow-[0_0_15px_rgba(0,229,255,0.1)]"
    >
      {/* 3 pulsing cyan synaptic nodes */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-bounce [animation-delay:-0.3s] shadow-[0_0_6px_#00E5FF]" />
        <span className="w-2 h-2 rounded-full bg-[#2F6BFF] animate-bounce [animation-delay:-0.15s] shadow-[0_0_6px_#2F6BFF]" />
        <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-bounce shadow-[0_0_6px_#00E5FF]" />
      </div>

      <div className="flex flex-col">
        <span className="text-xs font-mono text-[#00E5FF] tracking-wide">
          {message}
        </span>
        <span className="text-[10px] font-mono text-[#8FA3BF]">
          QUERY IN-FLIGHT · CONTEXT BOUNDED
        </span>
      </div>
    </div>
  );
};
