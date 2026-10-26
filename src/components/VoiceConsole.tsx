import React from 'react';
import { Mic, Volume2, Radio, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface VoiceConsoleProps {
  transcript: string;
  isListening: boolean;
  isSpeaking: boolean;
  isTranscribing?: boolean;
  audioLevel?: number; // 0 to 100
  micError?: string | null;
  onSendTranscript?: (text: string) => void;
  onClear?: () => void;
  onSimulateVoice?: (preset: string) => void;
}

export const VoiceConsole: React.FC<VoiceConsoleProps> = ({
  transcript,
  isListening,
  isSpeaking,
  isTranscribing = false,
  audioLevel = 0,
  micError,
  onSendTranscript,
  onClear,
  onSimulateVoice,
}) => {
  return (
    <div className="w-full max-w-xl mx-auto rounded-xl bg-[#0D1730]/90 border border-[#00E5FF]/30 p-3.5 shadow-[0_0_25px_rgba(0,229,255,0.15)] space-y-2.5">
      {/* Top Header & State Bar */}
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          {isTranscribing ? (
            <span className="flex items-center gap-1.5 text-[#60A5FA] font-semibold animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>TRANSCRIBING AUDIO VIA GEMINI STT ...</span>
            </span>
          ) : isListening ? (
            <span className="flex items-center gap-1.5 text-[#00E5FF] font-semibold">
              <Mic className="w-3.5 h-3.5 animate-bounce" />
              <span>RECORDING VOICE STREAM</span>
            </span>
          ) : isSpeaking ? (
            <span className="flex items-center gap-1.5 text-[#22D3A0] font-semibold">
              <Volume2 className="w-3.5 h-3.5 animate-bounce" />
              <span>VOCALIZING REPLY (BARGE-IN READY)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[#8FA3BF]">
              <Radio className="w-3.5 h-3.5 text-[#00E5FF]/60" />
              <span>VOICE CONSOLE</span>
              <span className="text-[10px] text-[#00E5FF] bg-[#00E5FF]/10 px-1.5 py-0.5 rounded border border-[#00E5FF]/20">
                VOICE ID: XZXyuzPdidXaSa10PmVA
              </span>
            </span>
          )}
        </div>

        {/* Live Audio Visualizer Waveform if Listening */}
        {isListening && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#060C1B] border border-[#00E5FF]/30">
            <span className="text-[10px] text-[#00E5FF] mr-1">MIC IN:</span>
            {Array.from({ length: 6 }).map((_, i) => {
              const barHeight = Math.max(3, Math.min(16, (audioLevel / 100) * 16 * (1 + (i % 3) * 0.3)));
              return (
                <div
                  key={i}
                  className="w-1 bg-[#00E5FF] rounded-full transition-all duration-75"
                  style={{
                    height: `${barHeight}px`,
                    opacity: audioLevel > 10 ? 1 : 0.4,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Mic Error Banner if permission denied */}
      {micError && (
        <div className="p-2.5 rounded-lg bg-[#FF4D6A]/10 border border-[#FF4D6A]/40 flex items-start gap-2 text-xs font-mono text-[#FF4D6A]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{micError}</p>
            <p className="text-[11px] text-[#8FA3BF] mt-1">
              Tip: Allow microphone in browser site settings or try quick command presets below.
            </p>
          </div>
        </div>
      )}

      {/* Transcript Box */}
      <div className="p-2.5 rounded-lg bg-[#060C1B] border border-[#00E5FF]/15 text-xs font-mono leading-relaxed break-words min-h-[42px] flex items-center justify-between gap-3">
        {transcript ? (
          <span className="text-[#E6F1FF] font-medium font-sans text-sm">&ldquo;{transcript}&rdquo;</span>
        ) : isListening ? (
          <span className="text-[#00E5FF] italic flex items-center gap-1.5 animate-pulse">
            <Mic className="w-3.5 h-3.5" />
            Speak now into your microphone... (click Stop [MIC] when finished)
          </span>
        ) : isTranscribing ? (
          <span className="text-[#60A5FA] italic">Processing audio waveforms...</span>
        ) : (
          <span className="text-[#8FA3BF]">Press [MIC] below, speak your command, and click [MIC] again to transmit.</span>
        )}

        {transcript && (
          <div className="flex items-center gap-2 shrink-0">
            {onClear && (
              <button
                onClick={onClear}
                className="text-[10px] text-[#8FA3BF] hover:text-white cursor-pointer px-1.5 py-0.5"
              >
                Clear
              </button>
            )}
            {onSendTranscript && (
              <button
                onClick={() => onSendTranscript(transcript)}
                className="px-2.5 py-1 rounded bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 hover:bg-[#00E5FF] hover:text-[#05080F] transition-all cursor-pointer text-xs font-bold flex items-center gap-1 shadow-sm"
              >
                <span>Transmit</span>
                <CheckCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Voice Simulation Buttons for testing & instant access */}
      {onSimulateVoice && (
        <div className="flex items-center gap-2 pt-1 overflow-x-auto text-[10px] font-mono text-[#8FA3BF]">
          <span className="shrink-0 text-[#00E5FF]">Quick Voice Sim:</span>
          <button
            onClick={() => onSimulateVoice('Check my CPU and RAM')}
            className="px-2 py-0.5 rounded bg-[#0A1128] hover:bg-[#00E5FF]/10 text-[#8FA3BF] hover:text-[#00E5FF] border border-[#00E5FF]/15 transition-colors shrink-0 cursor-pointer"
          >
            &ldquo;Check CPU &amp; RAM&rdquo;
          </button>
          <button
            onClick={() => onSimulateVoice('Search for latest AI cybersecurity news')}
            className="px-2 py-0.5 rounded bg-[#0A1128] hover:bg-[#00E5FF]/10 text-[#8FA3BF] hover:text-[#00E5FF] border border-[#00E5FF]/15 transition-colors shrink-0 cursor-pointer"
          >
            &ldquo;Search AI Security&rdquo;
          </button>
          <button
            onClick={() => onSimulateVoice('Open VS Code')}
            className="px-2 py-0.5 rounded bg-[#0A1128] hover:bg-[#00E5FF]/10 text-[#8FA3BF] hover:text-[#00E5FF] border border-[#00E5FF]/15 transition-colors shrink-0 cursor-pointer"
          >
            &ldquo;Open VS Code&rdquo;
          </button>
          <button
            onClick={() => onSimulateVoice('Delete test.txt from workspace')}
            className="px-2 py-0.5 rounded bg-[#0A1128] hover:bg-[#FF4D6A]/10 text-[#8FA3BF] hover:text-[#FF4D6A] border border-[#FF4D6A]/20 transition-colors shrink-0 cursor-pointer"
          >
            &ldquo;Delete file&rdquo;
          </button>
        </div>
      )}
    </div>
  );
};
