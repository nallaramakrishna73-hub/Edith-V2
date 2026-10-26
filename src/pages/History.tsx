import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MessageSquare,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useConversations } from '../hooks/useConversations.ts';
import { ConversationSummary } from '../types/api.ts';

export const History: React.FC = () => {
  const navigate = useNavigate();
  const { conversations, isLoading, error, deleteConversation, refreshConversations } =
    useConversations();

  const [searchQuery, setSearchQuery] = useState('');
  const [convToDelete, setConvToDelete] = useState<ConversationSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteConfirm = async () => {
    if (!convToDelete) return;
    setIsDeleting(true);
    try {
      await deleteConversation(convToDelete.id);
      setConvToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Page Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#00E5FF]/15">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-['Orbitron',sans-serif] text-white tracking-wide">
            CONVERSATION ARCHIVE
          </h2>
          <p className="text-xs text-[#8FA3BF] font-mono mt-1">
            PERSISTENT SQLITE DATABASE · EDITH.DB
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-[#0D1730] border border-[#00E5FF]/20 text-xs font-mono text-[#00E5FF] flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" />
            <span>{conversations.length} Sessions Logged</span>
          </div>

          <button
            onClick={() => navigate('/chat')}
            className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium text-[#05080F] bg-gradient-to-r from-[#00E5FF] to-[#2F6BFF] hover:brightness-110 transition-all cursor-pointer font-bold flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[#8FA3BF] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter archived sessions by title..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0D1730] border border-[#00E5FF]/20 text-xs text-[#E6F1FF] placeholder-[#8FA3BF]/60 focus:outline-none focus:border-[#00E5FF] focus:shadow-[0_0_12px_rgba(0,229,255,0.2)] font-mono transition-all"
        />
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 rounded-lg bg-[#FF4D6A]/10 border border-[#FF4D6A]/30 text-xs text-[#FF4D6A] font-mono">
          {error}
        </div>
      )}

      {/* Conversations List */}
      {isLoading ? (
        <div className="py-16 text-center text-xs font-mono text-[#8FA3BF] space-y-2">
          <Clock className="w-6 h-6 mx-auto text-[#00E5FF] animate-spin" />
          <p>Querying SQLite archives...</p>
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-[#0D1730]/40 border border-[#00E5FF]/10 space-y-3">
          <MessageSquare className="w-8 h-8 mx-auto text-[#8FA3BF]/40" />
          <h3 className="text-sm font-semibold font-['Orbitron',sans-serif] text-white">
            {searchQuery ? 'No matching sessions found' : 'Archive is empty'}
          </h3>
          <p className="text-xs text-[#8FA3BF] max-w-sm mx-auto">
            {searchQuery
              ? 'Try modifying your search term or view all archived logs.'
              : 'Start a new chat to automatically store persistent records in SQLite.'}
          </p>
          <button
            onClick={() => navigate('/chat')}
            className="mt-2 px-4 py-2 rounded-lg text-xs font-mono font-medium text-[#00E5FF] bg-[#0A1128] border border-[#00E5FF]/30 hover:border-[#00E5FF] transition-all cursor-pointer"
          >
            Open Neural Chat
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              className="relative rounded-xl bg-[#0D1730]/80 border border-[#00E5FF]/15 hover:border-[#00E5FF]/40 p-4 transition-all duration-200 group flex flex-col justify-between"
            >
              {/* Corner HUD tick */}
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#00E5FF]/20 group-hover:border-[#00E5FF] transition-colors" />

              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3
                    onClick={() => navigate(`/chat/${conv.id}`)}
                    className="text-sm font-medium text-[#E6F1FF] group-hover:text-[#00E5FF] transition-colors line-clamp-2 cursor-pointer font-sans"
                  >
                    {conv.title || 'Untitled Session'}
                  </h3>

                  <button
                    onClick={() => setConvToDelete(conv)}
                    aria-label="Delete this session"
                    className="p-1.5 rounded-lg text-[#8FA3BF] hover:text-[#FF4D6A] hover:bg-[#FF4D6A]/10 transition-colors shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono text-[#8FA3BF]/80 my-3">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-[#00E5FF]" />
                    {conv.message_count} messages
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(conv.updated_at).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#00E5FF]/10 flex items-center justify-between">
                <span className="text-[10px] font-mono text-[#8FA3BF]/60 truncate">
                  ID: {conv.id.slice(0, 8)}...
                </span>

                <button
                  onClick={() => navigate(`/chat/${conv.id}`)}
                  className="flex items-center gap-1 text-xs font-mono text-[#00E5FF] hover:underline cursor-pointer group-hover:translate-x-0.5 transition-transform"
                >
                  <span>Reopen</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {convToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#0D1730] border border-[#FF4D6A]/40 p-5 shadow-2xl space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold font-['Orbitron',sans-serif] text-white">
                CONFIRM ARCHIVE PURGE
              </h3>
              <p className="text-xs text-[#8FA3BF] leading-relaxed">
                Are you sure you want to delete session &quot;{convToDelete.title}&quot;?
                All associated messages will be permanently dropped from SQLite
                via cascade delete.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConvToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg text-xs font-mono text-[#8FA3BF] hover:text-white bg-[#0A1128] border border-[#8FA3BF]/20 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-white bg-[#FF4D6A] hover:bg-[#FF4D6A]/80 border border-[#FF4D6A] transition-all cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
