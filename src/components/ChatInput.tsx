import React, { useRef, useEffect } from 'react';
import { Send, Square, CornerDownLeft, Mic, Loader2 } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  onToggleMic?: () => void;
  isListening?: boolean;
  isTranscribing?: boolean;
  isLoading: boolean;
  maxChars?: number;
  placeholder?: string;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onCancel,
  onToggleMic,
  isListening = false,
  isTranscribing = false,
  isLoading,
  maxChars = 4000,
  placeholder = 'Ask EDITH anything...',
  disabled = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim().length > 0 && !disabled) {
        onSend();
      }
    }
  };

  const isOverLimit = value.length > maxChars;
  const canSend = value.trim().length > 0 && !isLoading && !isOverLimit && !disabled;

  return (
    <div className="relative w-full rounded-2xl bg-[#0D1730]/95 border border-[#00E5FF]/25 shadow-[0_4px_25px_rgba(0,0,0,0.5)] focus-within:border-[#00E5FF] focus-within:shadow-[0_0_20px_rgba(0,229,255,0.2)] transition-all">
      <div className="flex flex-col p-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || (isLoading && !onCancel)}
          rows={1}
          aria-label="Chat message input"
          className="w-full resize-none bg-transparent text-sm text-[#E6F1FF] placeholder-[#8FA3BF]/60 focus:outline-none font-sans leading-relaxed max-h-48 overflow-y-auto px-1"
        />

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#00E5FF]/10 text-xs font-mono text-[#8FA3BF]">
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-mono ${
                isOverLimit ? 'text-[#FF4D6A] font-bold' : 'text-[#8FA3BF]/80'
              }`}
            >
              {value.length} / {maxChars}
            </span>
            <span className="hidden sm:inline-block text-[10px] text-[#8FA3BF]/60">
              · Enter to send, Shift+Enter for newline
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isLoading && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                aria-label="Stop generating response"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FF4D6A]/20 hover:bg-[#FF4D6A]/30 text-[#FF4D6A] border border-[#FF4D6A]/40 transition-all cursor-pointer text-xs font-mono font-medium"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Cancel</span>
              </button>
            )}

            {onToggleMic && (
              <button
                type="button"
                onClick={onToggleMic}
                aria-label={isListening ? 'Stop recording' : 'Start voice input'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  isTranscribing
                    ? 'bg-[#2F6BFF] text-white animate-pulse'
                    : isListening
                    ? 'bg-[#FF4D6A] text-white shadow-[0_0_12px_rgba(255,77,106,0.6)] animate-pulse'
                    : 'bg-[#0A1128] text-[#00E5FF] border border-[#00E5FF]/30 hover:bg-[#00E5FF]/20'
                }`}
              >
                {isTranscribing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mic className={`w-3.5 h-3.5 ${isListening ? 'animate-bounce' : ''}`} />
                )}
                <span className="hidden sm:inline">
                  {isTranscribing ? 'Processing...' : isListening ? 'Stop' : 'Voice'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              aria-label="Send message"
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium font-mono transition-all cursor-pointer ${
                canSend
                  ? 'bg-gradient-to-r from-[#00E5FF] to-[#2F6BFF] text-[#05080F] font-bold hover:shadow-[0_0_15px_rgba(0,229,255,0.4)] hover:brightness-110 active:scale-95'
                  : 'bg-[#0A1128] text-[#8FA3BF]/40 border border-[#8FA3BF]/20 cursor-not-allowed'
              }`}
            >
              <span>Transmit</span>
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
