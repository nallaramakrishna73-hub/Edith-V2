import React, { useState, useEffect } from 'react';
import { ShieldAlert, Check, X, Clock } from 'lucide-react';
import { api } from '../services/api.ts';
import { PendingAction } from '../types/api.ts';

interface PermissionDialogProps {
  onActionDecided?: () => void;
}

export const PermissionDialog: React.FC<PermissionDialogProps> = ({ onActionDecided }) => {
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPending = async () => {
      try {
        const list = await api.getPendingActions();
        if (isMounted) {
          setPending(list);
        }
      } catch (err) {
        console.warn('Pending actions fetch:', err);
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleApprove = async (id: string) => {
    setLoadingActionId(id);
    try {
      await api.approveAction(id);
      setPending((prev) => prev.filter((p) => p.id !== id));
      onActionDecided?.();
    } catch (err) {
      console.error('Approve error:', err);
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleReject = async (id: string) => {
    setLoadingActionId(id);
    try {
      await api.rejectAction(id);
      setPending((prev) => prev.filter((p) => p.id !== id));
      onActionDecided?.();
    } catch (err) {
      console.error('Reject error:', err);
    } finally {
      setLoadingActionId(null);
    }
  };

  if (pending.length === 0) return null;

  return (
    <div className="w-full space-y-3">
      {pending.map((action) => (
        <div
          key={action.id}
          className="rounded-2xl bg-[#0D1730] border-2 border-[#FFB020] p-4 shadow-[0_0_25px_rgba(255,176,32,0.25)] space-y-3"
        >
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-[#FFB020] font-bold">
              <ShieldAlert className="w-4 h-4 animate-bounce" />
              <span>PERMISSION REQUIRED</span>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-[#8FA3BF]">
              <Clock className="w-3 h-3 text-[#FFB020]" />
              <span>60s timeout</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#060C1B] border border-[#FFB020]/30 space-y-1">
            <p className="text-xs font-mono text-[#00E5FF] font-semibold">
              TOOL: {action.tool}
            </p>
            <p className="text-xs text-[#E6F1FF] leading-relaxed font-sans">
              {action.impact_text}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => handleReject(action.id)}
              disabled={loadingActionId === action.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-[#FF4D6A] bg-[#FF4D6A]/10 border border-[#FF4D6A]/40 hover:bg-[#FF4D6A] hover:text-white transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>

            <button
              onClick={() => handleApprove(action.id)}
              disabled={loadingActionId === action.id}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-mono font-bold text-[#05080F] bg-[#22D3A0] hover:brightness-110 shadow-[0_0_12px_rgba(34,211,160,0.4)] transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
