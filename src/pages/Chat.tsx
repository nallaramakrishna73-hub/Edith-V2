import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, MessageSquare } from 'lucide-react';
import { ChatPanel } from '../components/ChatPanel.tsx';
import { api } from '../services/api.ts';

export const Chat: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [conversationTitle, setConversationTitle] = useState<string>('New Session');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // If initialPrompt was passed via state (e.g. from Dashboard Quick Actions)
  const initialPrompt = (location.state as { initialPrompt?: string })?.initialPrompt || '';

  useEffect(() => {
    if (id) {
      let isMounted = true;
      api.getConversation(id)
        .then((data) => {
          if (isMounted) {
            setConversationTitle(data.conversation.title || 'Conversation');
          }
        })
        .catch(() => {
          if (isMounted) {
            setConversationTitle('Saved Session');
          }
        });

      return () => {
        isMounted = false;
      };
    } else {
      setConversationTitle('New Session');
    }
  }, [id]);

  const handleConversationCreated = (newId: string) => {
    // Update route without reloading
    navigate(`/chat/${newId}`, { replace: true });
  };

  const handleNewChat = () => {
    navigate('/chat');
    setConversationTitle('New Session');
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await api.deleteConversation(id);
      setShowDeleteConfirm(false);
      navigate('/chat');
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#05080F]">
      {/* Tactical Sub-header */}
      <div className="h-12 px-4 md:px-6 bg-[#0A1128]/60 border-b border-[#00E5FF]/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {id && (
            <button
              onClick={() => navigate('/history')}
              aria-label="Back to history"
              className="p-1 rounded-lg text-[#8FA3BF] hover:text-[#00E5FF] hover:bg-[#0D1730] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="w-4 h-4 text-[#00E5FF] shrink-0" />
            <h2 className="text-xs md:text-sm font-semibold text-[#E6F1FF] truncate font-['Rajdhani',sans-serif] tracking-wide">
              {conversationTitle}
            </h2>
            {id && (
              <span className="hidden sm:inline-block text-[10px] font-mono text-[#8FA3BF]/60 truncate">
                · {id.slice(0, 8)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {id && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Delete conversation"
              className="p-1.5 rounded-lg text-[#8FA3BF] hover:text-[#FF4D6A] hover:bg-[#FF4D6A]/10 border border-transparent hover:border-[#FF4D6A]/30 transition-all cursor-pointer text-xs flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-mono">Delete</span>
            </button>
          )}

          <button
            onClick={handleNewChat}
            aria-label="Start new session"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-medium text-[#00E5FF] bg-[#0D1730] hover:bg-[#00E5FF]/10 border border-[#00E5FF]/30 hover:border-[#00E5FF] transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#0D1730] border border-[#FF4D6A]/40 p-5 shadow-2xl space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold font-['Orbitron',sans-serif] text-white">
                PURGE CONVERSATION?
              </h3>
              <p className="text-xs text-[#8FA3BF] leading-relaxed">
                This will permanently delete this conversation and all its
                messages from SQLite (<span className="font-mono text-[#FF4D6A]">edith.db</span>).
                This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg text-xs font-mono text-[#8FA3BF] hover:text-white bg-[#0A1128] border border-[#8FA3BF]/20 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-white bg-[#FF4D6A] hover:bg-[#FF4D6A]/80 border border-[#FF4D6A] transition-all cursor-pointer"
              >
                {isDeleting ? 'Purging...' : 'Confirm Purge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Panel */}
      <div className="flex-1 min-h-0">
        <ChatPanel
          conversationId={id || null}
          onConversationCreated={handleConversationCreated}
          initialPrompt={initialPrompt}
        />
      </div>
    </div>
  );
};
