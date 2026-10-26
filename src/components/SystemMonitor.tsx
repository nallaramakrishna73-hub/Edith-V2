import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Server, Activity, ArrowUpRight } from 'lucide-react';
import { api } from '../services/api.ts';
import { SystemStats } from '../types/api.ts';

export const SystemMonitor: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchTelemetry = async () => {
      try {
        const data = await api.getSystemStatus();
        if (isMounted) {
          setStats(data);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('System telemetry fetch fallback:', err);
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const cpu = stats?.cpu_percent ?? 28;
  const ram = stats?.ram_percent ?? 54;
  const disk = stats?.disk_percent ?? 42;
  const net = stats?.network_status ?? 'ONLINE (eth0)';

  return (
    <div className="w-full rounded-2xl bg-[#0D1730]/85 border border-[#00E5FF]/20 p-4 space-y-4 shadow-lg">
      <div className="flex items-center justify-between pb-2 border-b border-[#00E5FF]/10">
        <div className="flex items-center gap-2 text-[#00E5FF]">
          <Activity className="w-4 h-4 animate-pulse" />
          <h3 className="text-xs font-['Orbitron',sans-serif] font-bold tracking-wider text-white">
            SYSTEM MONITOR
          </h3>
        </div>
        <span className="text-[10px] font-mono text-[#22D3A0]">
          {isLoading ? 'SYNC...' : 'KALI LIVE'}
        </span>
      </div>

      {/* 4 Metric Badges matching Figure 5 */}
      <div className="space-y-3">
        {/* CPU */}
        <div>
          <div className="flex items-center justify-between text-xs font-mono mb-1">
            <span className="text-[#8FA3BF] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#00E5FF]" /> CPU
            </span>
            <span className="text-[#E6F1FF] font-bold font-mono">{cpu}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#060C1B] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00E5FF] to-[#2F6BFF] transition-all duration-500 rounded-full"
              style={{ width: `${cpu}%` }}
            />
          </div>
        </div>

        {/* RAM */}
        <div>
          <div className="flex items-center justify-between text-xs font-mono mb-1">
            <span className="text-[#8FA3BF] flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-[#2F6BFF]" /> RAM
            </span>
            <span className="text-[#E6F1FF] font-bold font-mono">{ram}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#060C1B] overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                ram > 80
                  ? 'bg-gradient-to-r from-[#FFB020] to-[#FF4D6A]'
                  : 'bg-gradient-to-r from-[#2F6BFF] to-[#00E5FF]'
              }`}
              style={{ width: `${ram}%` }}
            />
          </div>
        </div>

        {/* DISK */}
        <div>
          <div className="flex items-center justify-between text-xs font-mono mb-1">
            <span className="text-[#8FA3BF] flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-[#22D3A0]" /> DISK
            </span>
            <span className="text-[#E6F1FF] font-bold font-mono">{disk}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#060C1B] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#22D3A0] to-[#00E5FF] transition-all duration-500 rounded-full"
              style={{ width: `${disk}%` }}
            />
          </div>
        </div>

        {/* NET */}
        <div className="p-2.5 rounded-lg bg-[#0A1128] border border-[#00E5FF]/10 flex items-center justify-between text-xs font-mono">
          <span className="text-[#8FA3BF]">NET</span>
          <span className="text-[#22D3A0] font-semibold text-[11px] truncate max-w-[120px]">
            {net}
          </span>
        </div>
      </div>

      {/* Top Processes */}
      {stats?.top_processes && stats.top_processes.length > 0 && (
        <div className="pt-2 border-t border-[#00E5FF]/10 space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#8FA3BF]">
            Active Subprocesses
          </span>
          <div className="space-y-1">
            {stats.top_processes.slice(0, 3).map((p) => (
              <div
                key={p.pid}
                className="flex items-center justify-between text-[11px] font-mono text-[#8FA3BF]/90"
              >
                <span className="truncate max-w-[120px]">{p.name}</span>
                <span className="text-[#00E5FF]">{p.cpu_percent}% cpu</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
