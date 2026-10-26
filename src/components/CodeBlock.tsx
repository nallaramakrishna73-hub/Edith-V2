import React, { useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';

interface CodeBlockProps {
  language?: string;
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language = 'code', code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="relative my-4 rounded-lg overflow-hidden border border-[#00E5FF]/20 bg-[#060C1B] font-mono text-xs shadow-lg">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0A1128] border-b border-[#00E5FF]/15 text-[#8FA3BF]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#00E5FF]" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#00E5FF]/90 font-medium">
            {language}
          </span>
        </div>

        <button
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-[#8FA3BF] hover:text-[#00E5FF] hover:bg-[#0D1730] border border-transparent hover:border-[#00E5FF]/20 transition-all cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#22D3A0]" />
              <span className="text-[#22D3A0]">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content - Pure text display, NEVER executed */}
      <div className="p-3.5 overflow-x-auto text-[#E6F1FF] font-mono text-xs leading-relaxed selection:bg-[#00E5FF]/30">
        <pre className="m-0 font-['JetBrains_Mono',monospace]">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};
