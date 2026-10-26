import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  Terminal,
  FolderOpen,
  MessageSquare,
  History,
  Settings,
  Info,
  X,
  ShieldCheck,
} from 'lucide-react';
import { AIOrb } from './AIOrb.tsx';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navItems = [
    { to: '/', label: 'Command Cockpit', icon: LayoutDashboard },
    { to: '/kali', label: 'Kali Linux Bridge', icon: ShieldCheck },
    { to: '/tasks', label: 'Multi-Task Manager', icon: Layers },
    { to: '/terminal', label: 'Cyber Terminal', icon: Terminal },
    { to: '/vault', label: 'Workspace Vault', icon: FolderOpen },
    { to: '/chat', label: 'Tactical AI Chat', icon: MessageSquare },
    { to: '/history', label: 'Memory Logs', icon: History },
    { to: '/settings', label: 'System Settings', icon: Settings },
    { to: '/about', label: 'About EDITH', icon: Info },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Aside */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-64 bg-[#0A1128] border-r border-[#00E5FF]/15 flex flex-col transition-transform duration-300 ease-in-out shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Lockup Header */}
        <div className="p-5 border-b border-[#00E5FF]/15 flex items-center justify-between">
          <NavLink
            to="/"
            onClick={onClose}
            className="flex items-center gap-3 group select-none"
          >
            {/* Miniature AI Orb */}
            <AIOrb size="sm" state="idle" />

            <div className="flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <span className="font-['Orbitron',sans-serif] font-black text-xl tracking-wider text-white group-hover:text-[#00E5FF] transition-colors">
                  EDITH
                </span>
                <span className="font-mono text-[10px] font-bold text-[#00E5FF] tracking-widest uppercase">
                  AI OS
                </span>
              </div>
              <span className="text-[9px] font-mono text-[#8FA3BF] tracking-tight">
                TACTICAL HELPER v1.0
              </span>
            </div>
          </NavLink>

          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="p-1.5 rounded-lg text-[#8FA3BF] hover:text-[#00E5FF] hover:bg-[#0D1730] md:hidden cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-mono text-xs font-medium tracking-wide transition-all group ${
                    isActive
                      ? 'bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/40 shadow-[0_0_15px_rgba(0,229,255,0.15)] font-semibold'
                      : 'text-[#8FA3BF] hover:text-[#E6F1FF] hover:bg-[#0D1730] border border-transparent'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive
                          ? 'text-[#00E5FF]'
                          : 'text-[#8FA3BF] group-hover:text-[#00E5FF]'
                      }`}
                    />
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00E5FF] shadow-[0_0_6px_#00E5FF]" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Tactical Footer */}
        <div className="p-4 border-t border-[#00E5FF]/15 bg-[#060C1B]/60 text-[10px] font-mono text-[#8FA3BF] flex flex-col gap-1">
          <div className="flex items-center justify-between text-[#E6F1FF]">
            <span>FOUNDATION MVP</span>
            <span className="text-[#00E5FF]">READY</span>
          </div>
          <div className="text-[#8FA3BF]/70 text-[9px]">
            Stateless API · SQLite edith.db
          </div>
        </div>
      </aside>
    </>
  );
};
