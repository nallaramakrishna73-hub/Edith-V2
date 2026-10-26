import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  FolderOpen,
  FileCode,
  Check,
  Download,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { WorkspaceFile } from '../types/api.ts';

export const FileVault: React.FC = () => {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);

  const fetchFiles = async () => {
    try {
      const data = await api.getWorkspaceFiles();
      setFiles(data);
      if (data.length > 0 && !activeFile) {
        loadFile(data[0].name);
      }
    } catch (e) {
      console.warn('Failed to fetch files:', e);
    }
  };

  const loadFile = async (name: string) => {
    try {
      const fileData = await api.getWorkspaceFile(name);
      setActiveFile(fileData.filename);
      setFileContent(fileData.content);
    } catch (e) {
      console.error('Error loading file:', e);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleSave = async () => {
    if (!activeFile) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.saveWorkspaceFile(activeFile, fileContent);
      setSaveSuccess(true);
      fetchFiles();
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete ${name} from workspace?`)) return;
    try {
      await api.deleteWorkspaceFile(name);
      if (activeFile === name) {
        setActiveFile(null);
        setFileContent('');
      }
      fetchFiles();
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const name = newFileName.trim().endsWith('.md') || newFileName.trim().endsWith('.txt') || newFileName.trim().endsWith('.js')
      ? newFileName.trim()
      : `${newFileName.trim()}.md`;

    try {
      await api.saveWorkspaceFile(name, `# ${name}\n\nInitialized by EDITH OS File Vault.\n`);
      setShowNewModal(false);
      setNewFileName('');
      await fetchFiles();
      loadFile(name);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0A1128]/80 border border-[#00E5FF]/20 rounded-2xl overflow-hidden backdrop-blur-md">
      {/* Header */}
      <div className="p-3.5 border-b border-[#00E5FF]/15 flex items-center justify-between bg-[#0D1730]/60">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-[#00E5FF]" />
          <div>
            <h2 className="text-xs font-mono font-bold tracking-wider text-white uppercase">
              WORKSPACE FILE VAULT
            </h2>
            <p className="text-[10px] font-mono text-[#8FA3BF]">
              Tactical Notes, Documents & Code Artifacts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowNewModal(true)}
            className="px-2.5 py-1.5 rounded-lg bg-[#00E5FF]/20 border border-[#00E5FF]/40 text-[#00E5FF] hover:bg-[#00E5FF]/30 text-xs font-mono font-semibold flex items-center gap-1 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">NEW FILE</span>
          </button>
          <button
            onClick={fetchFiles}
            className="p-1.5 rounded-lg bg-[#060C1B] border border-[#00E5FF]/15 text-[#8FA3BF] hover:text-[#00E5FF] text-xs font-mono transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Grid: Sidebar + Editor */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
        {/* Left: File Tree */}
        <div className="md:col-span-4 border-r border-[#00E5FF]/15 p-2 overflow-y-auto space-y-1 bg-[#05080F]/40">
          {files.length === 0 ? (
            <div className="p-4 text-center text-xs font-mono text-[#8FA3BF]">
              No files in workspace. Click "+ NEW FILE" or tell EDITH to create one.
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.name}
                onClick={() => loadFile(file.name)}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs font-mono ${
                  activeFile === file.name
                    ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30'
                    : 'text-[#8FA3BF] hover:bg-[#0D1730] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {file.name.endsWith('.js') || file.name.endsWith('.ts') ? (
                    <FileCode className="w-3.5 h-3.5 text-[#2F6BFF] shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                  )}
                  <span className="truncate">{file.name}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-[#8FA3BF]/60">
                    {Math.round(file.size_bytes / 1024 * 10) / 10}kb
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(file.name);
                    }}
                    className="p-1 text-[#8FA3BF] hover:text-[#FF4D6A] cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: File Editor */}
        <div className="md:col-span-8 flex flex-col h-full bg-[#05080F]/20">
          {activeFile ? (
            <>
              {/* File action toolbar */}
              <div className="p-2 px-3 border-b border-[#00E5FF]/15 flex items-center justify-between bg-[#0D1730]/40 text-xs font-mono">
                <span className="text-[#00E5FF] font-bold truncate">
                  {activeFile}
                </span>

                <div className="flex items-center gap-2">
                  {saveSuccess && (
                    <span className="text-[10px] text-[#22D3A0] flex items-center gap-1 font-bold">
                      <Check className="w-3 h-3" /> SAVED
                    </span>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-3 py-1 rounded bg-[#00E5FF]/20 border border-[#00E5FF]/40 text-[#00E5FF] hover:bg-[#00E5FF]/30 flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3 h-3" />
                    <span>{isSaving ? 'SAVING...' : 'SAVE'}</span>
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                placeholder="File contents..."
                className="flex-1 w-full p-4 bg-transparent text-white font-mono text-xs focus:outline-none resize-none leading-relaxed"
              />
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs font-mono text-[#8FA3BF]">
              <FileText className="w-8 h-8 text-[#00E5FF]/40 mb-2" />
              <p>Select a file to inspect and edit, or ask EDITH to create a note.</p>
            </div>
          )}
        </div>
      </div>

      {/* New File Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleCreateNew}
            className="w-full max-w-sm bg-[#0D1730] border border-[#00E5FF]/40 rounded-2xl p-5 font-mono space-y-4"
          >
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              CREATE WORKSPACE ARTIFACT
            </h3>
            <input
              type="text"
              required
              autoFocus
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="e.g. mission_plan.md or script.js"
              className="w-full px-3 py-2 rounded-lg bg-[#060C1B] border border-[#00E5FF]/20 text-white text-xs focus:outline-none focus:border-[#00E5FF]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-3 py-1.5 rounded-lg bg-[#060C1B] text-[#8FA3BF] text-xs hover:text-white cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#00E5FF] text-[#05080F] font-bold text-xs hover:brightness-110 cursor-pointer"
              >
                CREATE
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
