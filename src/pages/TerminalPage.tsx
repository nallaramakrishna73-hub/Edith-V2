import React from 'react';
import { CyberTerminal } from '../components/CyberTerminal.tsx';
import { useVoice } from '../hooks/useVoice.ts';

export const TerminalPage: React.FC = () => {
  const { speak } = useVoice({ onTranscriptReady: () => {} });

  return (
    <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-4 h-[calc(100vh-4.2rem)]">
      <CyberTerminal onSpeak={speak} />
    </div>
  );
};
