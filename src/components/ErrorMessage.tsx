import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorMessageProps {
  code?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  code,
  message,
  onRetry,
}) => {
  return (
    <div
      role="alert"
      className="p-4 rounded-xl bg-[#0D1730]/90 border border-[#FF4D6A]/40 text-[#E6F1FF] shadow-[0_0_20px_rgba(255,77,106,0.15)] my-3 max-w-xl"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-[#FF4D6A]/10 text-[#FF4D6A] border border-[#FF4D6A]/30 shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono font-bold tracking-wider text-[#FF4D6A] uppercase">
              {code || 'EXECUTION_ERROR'}
            </span>
          </div>

          <p className="text-xs text-[#E6F1FF] leading-relaxed break-words font-sans">
            {message}
          </p>

          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-[#00E5FF] bg-[#0A1128] hover:bg-[#00E5FF]/10 border border-[#00E5FF]/30 hover:border-[#00E5FF] transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry request</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
