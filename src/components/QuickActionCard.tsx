import React from 'react';
import { LucideIcon, ArrowUpRight } from 'lucide-react';

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  description,
  icon: Icon,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-start p-4 text-left rounded-xl bg-[#0D1730]/70 border border-[#00E5FF]/15 hover:border-[#00E5FF]/60 hover:bg-[#0D1730] transition-all duration-300 group cursor-pointer w-full overflow-hidden"
    >
      {/* Corner notch */}
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#00E5FF]/20 group-hover:border-[#00E5FF] transition-colors" />

      <div className="flex items-center justify-between w-full mb-2">
        <div className="p-2 rounded-lg bg-[#0A1128] border border-[#00E5FF]/20 text-[#00E5FF] group-hover:scale-105 group-hover:shadow-[0_0_12px_rgba(0,229,255,0.3)] transition-all">
          <Icon className="w-4 h-4" />
        </div>
        <ArrowUpRight className="w-4 h-4 text-[#8FA3BF] group-hover:text-[#00E5FF] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>

      <h3 className="text-sm font-semibold tracking-wide text-[#E6F1FF] group-hover:text-[#00E5FF] font-['Rajdhani',sans-serif] text-base transition-colors">
        {title}
      </h3>
      <p className="text-xs text-[#8FA3BF] mt-1 line-clamp-2 leading-relaxed">
        {description}
      </p>
    </button>
  );
};
