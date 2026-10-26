import React, { useState, useEffect } from 'react';
import { Terminal, Shield, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { api } from '../services/api.ts';
import { AuditLogItem } from '../types/api.ts';

export const ActivityFeed: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchLogs = async () => {
      try {
        const data = await api.getAuditLogs(10);
        if (isMounted) {
          setLogs(data);
        }
      } catch (err) {
        console.warn('Audit logs fetch:', err);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="w-full rounded-2xl bg-[#0D1730]/85 border border-[#00E5FF]/20 p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between pb-2 border-b border-[#00E5FF]/10">
        <div className="flex items-center gap-2 text-[#00E5FF]">
          <Terminal className="w-4 h-4" />
          <h3 className="text-xs font-['Orbitron',sans-serif] font-bold tracking-wider text-white">
            ACTIVITY FEED
          </h3>
        </div>
        <span className="text-[10px] font-mono text-[#8FA3BF]">AUDIT LOG</span>
      </div>

      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
        {logs.length === 0 ? (
          <div className="py-4 text-center text-xs font-mono text-[#8FA3BF]/60">
            No tool operations recorded yet.
          </div>
        ) : (
          logs.map((log) => {
            const timeStr = new Date(log.ts).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            const isError = log.event.includes('ERROR') || log.event.includes('BLOCKED');

            return (
              <div
                key={log.id}
                className="flex items-start justify-between text-xs font-mono p-2 rounded-lg bg-[#0A1128]/70 border border-[#00E5FF]/10 gap-2"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isError ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-[#FF4D6A] shrink-0" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 text-[#22D3A0] shrink-0" />
                  )}
                  <span className="text-[#E6F1FF] truncate font-medium">
                    {log.event.replace('TOOL_', '').toLowerCase()}
                  </span>
                </div>
                <span className="text-[10px] text-[#8FA3BF]/70 shrink-0">{timeStr}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
