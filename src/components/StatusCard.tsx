import React from 'react';
import { LucideIcon } from 'lucide-react';

export type StatusVariant = 'success' | 'warning' | 'error' | 'neutral';

interface StatusCardProps {
  title: string;
  value: string;
  subtitle?: string;
  variant?: StatusVariant;
  icon?: LucideIcon;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  title,
  value,
  subtitle,
  variant = 'neutral',
  icon: Icon,
}) => {
  const variantStyles = {
    success: {
      dot: 'bg-[#22D3A0] shadow-[0_0_8px_#22D3A0]',
      badge: 'text-[#22D3A0] border-[#22D3A0]/30 bg-[#22D3A0]/10',
      border: 'hover:border-[#22D3A0]/40',
    },
    warning: {
      dot: 'bg-[#FFB020] shadow-[0_0_8px_#FFB020]',
      badge: 'text-[#FFB020] border-[#FFB020]/30 bg-[#FFB020]/10',
      border: 'hover:border-[#FFB020]/40',
    },
    error: {
      dot: 'bg-[#FF4D6A] shadow-[0_0_8px_#FF4D6A]',
      badge: 'text-[#FF4D6A] border-[#FF4D6A]/30 bg-[#FF4D6A]/10',
      border: 'hover:border-[#FF4D6A]/40',
    },
    neutral: {
      dot: 'bg-[#8FA3BF]',
      badge: 'text-[#8FA3BF] border-[#8FA3BF]/30 bg-[#8FA3BF]/10',
      border: 'hover:border-[#00E5FF]/40',
    },
  }[variant];

  return (
    <div
      className={`relative p-4 rounded-xl bg-[#0D1730]/90 border border-[#00E5FF]/15 transition-all duration-300 group overflow-hidden ${variantStyles.border}`}
    >
      {/* Corner HUD accent */}
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#00E5FF]/40 group-hover:border-[#00E5FF] transition-colors" />

      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[11px] font-mono tracking-wider uppercase text-[#8FA3BF] font-medium">
          {title}
        </span>
        {Icon && (
          <Icon className="w-4 h-4 text-[#8FA3BF] group-hover:text-[#00E5FF] transition-colors" />
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${variantStyles.dot}`} />
        <span className="text-base font-semibold tracking-wide text-[#E6F1FF] font-['Orbitron',sans-serif] truncate">
          {value}
        </span>
      </div>

      {subtitle && (
        <div className="mt-1 text-[11px] font-mono text-[#8FA3BF]/80 truncate">
          {subtitle}
        </div>
      )}
    </div>
  );
};
