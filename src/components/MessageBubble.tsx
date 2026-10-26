import React from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Cpu } from 'lucide-react';
import { CodeBlock } from './CodeBlock.tsx';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  role,
  content,
  createdAt,
}) => {
  const isUser = role === 'user';

  const timeString = createdAt
    ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      className={`flex items-start gap-3 my-4 max-w-4xl ${
        isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
      }`}
    >
      {/* Avatar Icon */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
          isUser
            ? 'bg-[#2F6BFF]/20 border-[#2F6BFF]/50 text-[#60A5FA]'
            : 'bg-[#00E5FF]/10 border-[#00E5FF]/40 text-[#00E5FF] shadow-[0_0_10px_rgba(0,229,255,0.2)]'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
      </div>

      {/* Bubble Container */}
      <div
        className={`relative flex flex-col p-4 rounded-2xl max-w-[85%] md:max-w-[78%] leading-relaxed ${
          isUser
            ? 'bg-[#0A1128] border border-[#2F6BFF]/40 text-[#E6F1FF] rounded-tr-sm'
            : 'bg-[#0D1730]/90 border border-[#00E5FF]/20 text-[#E6F1FF] rounded-tl-sm shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
        }`}
      >
        {/* Header line inside bubble */}
        <div className="flex items-center justify-between gap-4 mb-1.5 pb-1 border-b border-[#00E5FF]/10">
          <span className="text-[11px] font-mono tracking-wider font-semibold uppercase text-[#8FA3BF]">
            {isUser ? 'OPERATOR' : 'EDITH AI'}
          </span>
          {timeString && (
            <span className="text-[10px] font-mono text-[#8FA3BF]/70">
              {timeString}
            </span>
          )}
        </div>

        {/* Bubble Content */}
        {isUser ? (
          <p className="whitespace-pre-wrap break-words text-sm text-[#E6F1FF] font-sans">
            {content}
          </p>
        ) : (
          <div className="text-sm font-sans space-y-2 text-[#E6F1FF] break-words prose prose-invert prose-p:leading-relaxed max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-sm text-[#E6F1FF]">{children}</li>,
                h1: ({ children }) => <h1 className="text-lg font-bold text-[#00E5FF] font-['Rajdhani',sans-serif] mt-3 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold text-[#00E5FF] font-['Rajdhani',sans-serif] mt-3 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold text-[#A5F3FC] font-['Rajdhani',sans-serif] mt-2 mb-1">{children}</h3>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-[#00E5FF]/50 pl-3 italic text-[#8FA3BF] my-2 bg-[#0A1128]/50 py-1 rounded-r">
                    {children}
                  </blockquote>
                ),
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');

                  // If multiline or language specified, render as full CodeBlock
                  if (match || codeString.includes('\n')) {
                    return (
                      <CodeBlock
                        language={match ? match[1] : 'code'}
                        code={codeString}
                      />
                    );
                  }

                  // Inline code
                  return (
                    <code
                      className="px-1.5 py-0.5 rounded bg-[#060C1B] text-[#00E5FF] font-mono text-xs border border-[#00E5FF]/20"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};
