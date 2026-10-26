import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Play,
  Pause,
  XCircle,
  Plus,
  RefreshCw,
  Terminal,
  Trash2,
  CheckCircle2,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RotateCcw,
  FolderOpen,
  FolderPlus,
  FileCheck,
  ArrowRight,
  ShieldAlert,
  Clock,
  Sparkles,
  Check,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { OSTask, Project, PersistentTask, SessionRecoveryData } from '../types/api.ts';

interface TaskManagerProps {
  onTaskSpawned?: (task: OSTask) => void;
  compact?: boolean;
}

export const TaskManager: React.FC<TaskManagerProps> = ({ onTaskSpawned, compact = false }) => {
  // Runtime Tasks
  const [tasks, setTasks] = useState<OSTask[]>([]);
  // Persistent DB Tasks
  const [persistentTasks, setPersistentTasks] = useState<PersistentTask[]>([]);
  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  // Session Recovery State
  const [recoveryState, setRecoveryState] = useState<SessionRecoveryData | null>(null);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'unfinished' | 'interrupted' | 'completed'>('all');

  // Spawn Modal
  const [showSpawnModal, setShowSpawnModal] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskCategory, setTaskCategory] = useState<OSTask['category']>('WORKFLOW');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskProjectId, setTaskProjectId] = useState<string>('');
  const [taskNextStep, setTaskNextStep] = useState('');
  const [quickType, setQuickType] = useState<'custom' | 'deep_recon' | 'security_audit' | 'code_analysis'>('custom');
  const [customParam, setCustomParam] = useState('');

  // Complete Task with Evidence Modal
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [evidenceArtifact, setEvidenceArtifact] = useState('');
  const [isSubmittingEvidence, setIsSubmittingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  // New Project Modal
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  // Fetch all tasks & persistent memory data
  const fetchData = async () => {
    try {
      const [runtimeTasks, pTasks, projList, recovery] = await Promise.all([
        api.getTasks().catch(() => []),
        api.getPersistentTasks(selectedProjectId === 'all' ? undefined : selectedProjectId).catch(() => []),
        api.getProjects().catch(() => []),
        api.getSessionRecovery().catch(() => null),
      ]);

      setTasks(runtimeTasks);
      setPersistentTasks(pTasks);
      setProjects(projList);
      if (recovery) {
        setRecoveryState(recovery);
      }
    } catch (e) {
      console.warn('Failed to fetch task manager data:', e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [selectedProjectId]);

  const handlePause = async (id: string) => {
    try {
      await api.pauseTask(id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResumeRuntime = async (id: string) => {
    try {
      await api.resumeTask(id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelRuntime = async (id: string) => {
    try {
      await api.cancelTask(id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearCompleted = async () => {
    try {
      await api.clearCompletedTasks();
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Phase 2: Resume Interrupted Task
  const handleResumeInterrupted = async (taskId: string) => {
    try {
      await api.resumeInterruptedTask(taskId);
      await fetchData();
    } catch (err) {
      console.error('Failed to resume interrupted task:', err);
    }
  };

  // Phase 2: Dismiss Interrupted Task
  const handleDismissInterrupted = async (taskId: string) => {
    try {
      await api.dismissInterruptedTask(taskId);
      await fetchData();
    } catch (err) {
      console.error('Failed to dismiss interrupted task:', err);
    }
  };

  // Phase 2: Dismiss Whole Recovery Banner
  const handleDismissRecovery = async () => {
    try {
      await api.dismissRecoveryState();
      setRecoveryDismissed(true);
      await fetchData();
    } catch (err) {
      console.error('Failed to dismiss recovery banner:', err);
      setRecoveryDismissed(true);
    }
  };

  // Phase 2: Complete with Evidence
  const submitTaskCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTaskId) return;
    if (!evidenceNote.trim() && !evidenceArtifact.trim()) {
      setEvidenceError('Verifiable evidence or artifact reference is required.');
      return;
    }

    setIsSubmittingEvidence(true);
    setEvidenceError(null);
    try {
      await api.completePersistentTask(completingTaskId, {
        summary: evidenceNote.trim() || 'Completed verified execution',
        artifact: evidenceArtifact.trim() || 'CLI log output',
        completed_by: 'user_action',
        timestamp: new Date().toISOString(),
      });
      setCompletingTaskId(null);
      setEvidenceNote('');
      setEvidenceArtifact('');
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to complete task';
      setEvidenceError(msg);
    } finally {
      setIsSubmittingEvidence(false);
    }
  };

  // Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const proj = await api.createProject({
        name: newProjectName.trim(),
        description: newProjectDesc.trim(),
      });
      setProjects((prev) => [proj, ...prev]);
      setSelectedProjectId(proj.id);
      setShowProjectModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
      await fetchData();
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  // Spawn Task
  const handleSpawn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;

    setIsLoading(true);
    try {
      // Create persistent DB task first
      const pTask = await api.createPersistentTask({
        title: taskName.trim(),
        category: taskCategory,
        description: taskDescription.trim(),
        project_id: taskProjectId || (selectedProjectId !== 'all' ? selectedProjectId : undefined),
        next_planned_step: taskNextStep.trim() || 'Initialize task execution pipeline',
      });

      // Spawn background worker process
      const payload: Parameters<typeof api.spawnTask>[0] = {
        name: taskName,
        category: taskCategory,
        description: taskDescription,
      };

      if (quickType === 'deep_recon') {
        payload.type = 'deep_recon';
        payload.query = customParam || taskName;
      } else if (quickType === 'security_audit') {
        payload.type = 'security_audit';
        payload.target = customParam || '127.0.0.1';
      } else if (quickType === 'code_analysis') {
        payload.type = 'code_analysis';
        payload.code = customParam || 'function main() { return true; }';
      }

      const newTask = await api.spawnTask(payload);
      setTasks((prev) => [newTask, ...prev]);
      setPersistentTasks((prev) => [pTask, ...prev]);
      if (onTaskSpawned) onTaskSpawned(newTask);

      setShowSpawnModal(false);
      setTaskName('');
      setTaskDescription('');
      setTaskNextStep('');
      setCustomParam('');
    } catch (err) {
      console.error('Spawn error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Counts
  const interruptedList = persistentTasks.filter((t) => t.status === 'interrupted');
  const unfinishedList = persistentTasks.filter((t) =>
    ['in_progress', 'pending', 'waiting_for_approval', 'interrupted'].includes(t.status)
  );
  const completedList = persistentTasks.filter((t) => t.status === 'completed');

  // Filtered persistent tasks
  const displayedPersistentTasks = persistentTasks.filter((t) => {
    if (activeTab === 'unfinished') {
      return ['in_progress', 'pending', 'waiting_for_approval', 'interrupted'].includes(t.status);
    }
    if (activeTab === 'interrupted') {
      return t.status === 'interrupted';
    }
    if (activeTab === 'completed') {
      return t.status === 'completed';
    }
    return true;
  });

  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  const hasInterruptedRecovery =
    !recoveryDismissed &&
    recoveryState &&
    (recoveryState.interruptedTasks.length > 0 ||
      recoveryState.previousSession?.exit_reason === 'crashed' ||
      recoveryState.previousSession?.exit_reason === 'interrupted');

  return (
    <div className="flex flex-col h-full bg-[#0A1128]/80 border border-[#00E5FF]/20 rounded-2xl overflow-hidden backdrop-blur-md">
      {/* Header Bar */}
      <div className="p-3.5 border-b border-[#00E5FF]/15 flex items-center justify-between bg-[#0D1730]/70 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#00E5FF]" />
          <div>
            <h2 className="text-xs font-mono font-bold tracking-wider text-white uppercase flex items-center gap-2">
              <span>PROJECT & TASK PERSISTENCE ENGINE</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#00E5FF]/20 text-[#00E5FF] font-mono">
                {tasks.filter((t) => t.status === 'RUNNING').length} RUNNING
              </span>
              {interruptedList.length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#FFB020]/20 text-[#FFB020] border border-[#FFB020]/30 font-mono flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {interruptedList.length} RECOVERABLE
                </span>
              )}
            </h2>
            {!compact && (
              <p className="text-[10px] font-mono text-[#8FA3BF] flex items-center gap-2 mt-0.5">
                <span>Active Project:</span>
                <span className="text-[#00E5FF] font-bold">
                  {selectedProjectId === 'all' ? 'All Workspaces' : activeProject?.name || 'Default Workspace'}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Project Selector */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-[#060C1B] border border-[#00E5FF]/20 text-[#00E5FF] text-xs font-mono rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#00E5FF] cursor-pointer"
          >
            <option value="all">📁 All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                📁 {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowProjectModal(true)}
            className="p-1.5 rounded-lg bg-[#060C1B] border border-[#00E5FF]/20 text-[#8FA3BF] hover:text-[#00E5FF] text-xs font-mono transition-colors cursor-pointer"
            title="Create New Project Workspace"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowSpawnModal(true)}
            className="px-2.5 py-1.5 rounded-lg bg-[#00E5FF]/20 border border-[#00E5FF]/40 text-[#00E5FF] hover:bg-[#00E5FF]/30 text-xs font-mono font-semibold flex items-center gap-1 transition-all cursor-pointer"
            title="Spawn new task"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">NEW TASK</span>
          </button>

          <button
            onClick={handleClearCompleted}
            className="p-1.5 rounded-lg bg-[#060C1B] border border-[#00E5FF]/15 text-[#8FA3BF] hover:text-[#FF4D6A] text-xs font-mono transition-colors cursor-pointer"
            title="Clear completed runtime workers"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg bg-[#060C1B] border border-[#00E5FF]/15 text-[#8FA3BF] hover:text-[#00E5FF] text-xs font-mono transition-colors cursor-pointer"
            title="Refresh state"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SESSION RECOVERY CARD */}
      {hasInterruptedRecovery && recoveryState && (
        <div className="m-3 p-3.5 rounded-xl bg-gradient-to-r from-[#FFB020]/15 via-[#0D1730]/90 to-[#0A1128] border border-[#FFB020]/40 shadow-[0_0_20px_rgba(255,176,32,0.15)] font-mono text-xs animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-[#FFB020]/20 text-[#FFB020] border border-[#FFB020]/30 shrink-0 mt-0.5">
                <RotateCcw className="w-4 h-4 animate-spin-slow" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#FFB020] tracking-wider uppercase">
                    SESSION RECOVERY DETECTED
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-[#FFB020]/20 text-[#FFB020] text-[10px]">
                    {recoveryState.interruptedTasks.length} Interrupted
                  </span>
                </div>
                <p className="text-[#8FA3BF] text-[11px] leading-relaxed">
                  {recoveryState.resumeSummary}
                </p>
                {recoveryState.suggestedNextAction && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#00E5FF] pt-0.5">
                    <Sparkles className="w-3 h-3 text-[#00E5FF] shrink-0" />
                    <span>
                      <strong>Suggested Action:</strong> {recoveryState.suggestedNextAction}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {recoveryState.interruptedTasks.length > 0 && (
                <button
                  onClick={() => handleResumeInterrupted(recoveryState.interruptedTasks[0].id)}
                  className="px-2.5 py-1 rounded bg-[#22D3A0]/20 border border-[#22D3A0]/40 text-[#22D3A0] hover:bg-[#22D3A0]/30 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  <span>Resume Task</span>
                </button>
              )}
              <button
                onClick={handleDismissRecovery}
                className="px-2 py-1 rounded bg-[#060C1B] border border-[#8FA3BF]/30 text-[#8FA3BF] hover:text-white text-[11px] transition-all cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Filter Bar */}
      <div className="px-3 pt-2 pb-1 border-b border-[#00E5FF]/10 flex items-center gap-1 text-[11px] font-mono">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-[#00E5FF]/20 text-[#00E5FF] font-bold border border-[#00E5FF]/30'
              : 'text-[#8FA3BF] hover:text-white'
          }`}
        >
          All ({persistentTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('unfinished')}
          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
            activeTab === 'unfinished'
              ? 'bg-[#00E5FF]/20 text-[#00E5FF] font-bold border border-[#00E5FF]/30'
              : 'text-[#8FA3BF] hover:text-white'
          }`}
        >
          Unfinished ({unfinishedList.length})
        </button>
        <button
          onClick={() => setActiveTab('interrupted')}
          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
            activeTab === 'interrupted'
              ? 'bg-[#FFB020]/20 text-[#FFB020] font-bold border border-[#FFB020]/30'
              : 'text-[#8FA3BF] hover:text-white'
          }`}
        >
          Interrupted ({interruptedList.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
            activeTab === 'completed'
              ? 'bg-[#22D3A0]/20 text-[#22D3A0] font-bold border border-[#22D3A0]/30'
              : 'text-[#8FA3BF] hover:text-white'
          }`}
        >
          Completed ({completedList.length})
        </button>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
        {displayedPersistentTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs font-mono text-[#8FA3BF] space-y-2">
            <Activity className="w-6 h-6 text-[#00E5FF]/40 animate-pulse" />
            <p>NO TASKS FOUND FOR THIS FILTER</p>
            <button
              onClick={() => setShowSpawnModal(true)}
              className="mt-2 px-3 py-1.5 rounded bg-[#00E5FF]/15 border border-[#00E5FF]/30 text-[#00E5FF] hover:bg-[#00E5FF]/25 cursor-pointer"
            >
              Spawn First Persistent Task
            </button>
          </div>
        ) : (
          displayedPersistentTasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;
            const isRunning = task.status === 'in_progress';
            const isInterrupted = task.status === 'interrupted';
            const isCompleted = task.status === 'completed';
            const isFailed = task.status === 'failed';
            const isPending = task.status === 'pending' || task.status === 'waiting_for_approval';

            // Find matching runtime task if any
            const runtimeWorker = tasks.find((rt) => rt.name === task.title || rt.id === task.id);

            return (
              <div
                key={task.id}
                className={`p-3 rounded-xl border transition-all ${
                  isInterrupted
                    ? 'bg-gradient-to-r from-[#FFB020]/10 to-[#0A1128]/80 border-[#FFB020]/30'
                    : isRunning
                    ? 'bg-[#0D1730]/90 border-[#00E5FF]/30 shadow-[0_0_15px_rgba(0,229,255,0.06)]'
                    : isCompleted
                    ? 'bg-[#0A1128]/60 border-[#22D3A0]/20'
                    : isFailed
                    ? 'bg-[#0A1128]/50 border-[#FF4D6A]/20 opacity-80'
                    : 'bg-[#0A1128]/70 border-[#00E5FF]/15'
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.pid && (
                        <span className="text-[10px] font-mono text-[#00E5FF] bg-[#00E5FF]/10 px-1.5 py-0.5 rounded border border-[#00E5FF]/20">
                          PID {task.pid}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                          task.category === 'RECON'
                            ? 'bg-[#00E5FF]/15 text-[#00E5FF]'
                            : task.category === 'SYSTEM'
                            ? 'bg-[#22D3A0]/15 text-[#22D3A0]'
                            : task.category === 'CODE'
                            ? 'bg-[#2F6BFF]/15 text-[#2F6BFF]'
                            : 'bg-[#FFB020]/15 text-[#FFB020]'
                        }`}
                      >
                        {task.category}
                      </span>
                      <h3 className="text-xs font-semibold text-white truncate max-w-[220px] sm:max-w-[340px]">
                        {task.title}
                      </h3>
                    </div>

                    <p className="text-[11px] text-[#8FA3BF] truncate mt-1">
                      {task.description || 'No description recorded'}
                    </p>

                    {/* Step details */}
                    <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-[#8FA3BF] flex-wrap">
                      {task.last_completed_step && (
                        <span className="flex items-center gap-1 text-[#22D3A0]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Last: {task.last_completed_step}</span>
                        </span>
                      )}
                      {task.next_planned_step && !isCompleted && (
                        <span className="flex items-center gap-1 text-[#00E5FF]">
                          <ArrowRight className="w-3 h-3" />
                          <span>Next: {task.next_planned_step}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Status Pill */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 ${
                        isInterrupted
                          ? 'bg-[#FFB020]/20 text-[#FFB020] border border-[#FFB020]/30'
                          : isRunning
                          ? 'bg-[#00E5FF]/20 text-[#00E5FF] animate-pulse border border-[#00E5FF]/30'
                          : isCompleted
                          ? 'bg-[#22D3A0]/20 text-[#22D3A0] border border-[#22D3A0]/30'
                          : isPending
                          ? 'bg-[#8FA3BF]/20 text-[#8FA3BF] border border-[#8FA3BF]/30'
                          : 'bg-[#FF4D6A]/20 text-[#FF4D6A] border border-[#FF4D6A]/30'
                      }`}
                    >
                      {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-ping" />}
                      {task.status}
                    </span>

                    {/* Recovery Action Buttons */}
                    {isInterrupted && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleResumeInterrupted(task.id)}
                          className="px-2 py-1 rounded bg-[#22D3A0]/20 border border-[#22D3A0]/40 text-[#22D3A0] hover:bg-[#22D3A0]/30 text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Resume this interrupted task"
                        >
                          <Play className="w-3 h-3" /> Resume
                        </button>
                        <button
                          onClick={() => handleDismissInterrupted(task.id)}
                          className="p-1 rounded bg-[#060C1B] text-[#8FA3BF] hover:text-[#FF4D6A] transition-colors cursor-pointer"
                          title="Dismiss task state"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Complete with Evidence button for active tasks */}
                    {(isRunning || isPending) && (
                      <button
                        onClick={() => {
                          setCompletingTaskId(task.id);
                          setEvidenceNote('');
                          setEvidenceArtifact('');
                          setEvidenceError(null);
                        }}
                        className="px-2 py-1 rounded bg-[#22D3A0]/15 border border-[#22D3A0]/30 text-[#22D3A0] hover:bg-[#22D3A0]/25 text-[10px] font-mono font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Mark Complete with verifiable evidence"
                      >
                        <FileCheck className="w-3 h-3" /> Complete
                      </button>
                    )}

                    {/* Runtime worker controls */}
                    {runtimeWorker && runtimeWorker.status === 'RUNNING' && (
                      <button
                        onClick={() => handlePause(runtimeWorker.id)}
                        className="p-1 rounded bg-[#060C1B] text-[#FFB020] hover:bg-[#FFB020]/20 transition-colors cursor-pointer"
                        title="Pause Worker"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {runtimeWorker && runtimeWorker.status === 'PAUSED' && (
                      <button
                        onClick={() => handleResumeRuntime(runtimeWorker.id)}
                        className="p-1 rounded bg-[#060C1B] text-[#22D3A0] hover:bg-[#22D3A0]/20 transition-colors cursor-pointer"
                        title="Resume Worker"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      className="p-1 rounded bg-[#060C1B] text-[#8FA3BF] hover:text-[#00E5FF] transition-colors cursor-pointer"
                      title="View Details"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-2.5 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#8FA3BF]">
                    <span className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-[#00E5FF]" />
                      <span>Updated: {new Date(task.updated_at).toLocaleTimeString()}</span>
                    </span>
                    <span className="text-[#00E5FF] font-bold">{task.progress}%</span>
                  </div>
                  <div className="w-full bg-[#060C1B] h-1.5 rounded-full overflow-hidden border border-[#00E5FF]/10">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isCompleted
                          ? 'bg-[#22D3A0]'
                          : isInterrupted
                          ? 'bg-[#FFB020]'
                          : isFailed
                          ? 'bg-[#FF4D6A]'
                          : 'bg-gradient-to-r from-[#00E5FF] to-[#2F6BFF]'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>

                {/* Expanded Details: Checkpoints, Evidence, Logs */}
                {isExpanded && (
                  <div className="mt-3 p-2.5 rounded-lg bg-[#05080F] border border-[#00E5FF]/20 font-mono text-[11px] space-y-2">
                    {/* Completion Evidence section */}
                    {task.completion_evidence && (
                      <div className="p-2 rounded bg-[#0A1128] border border-[#22D3A0]/30 text-[#22D3A0] space-y-1">
                        <div className="flex items-center gap-1 font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> VERIFIED COMPLETION EVIDENCE
                        </div>
                        <pre className="text-[10px] text-[#8FA3BF] whitespace-pre-wrap">
                          {JSON.stringify(task.completion_evidence, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Checkpoint data */}
                    {task.checkpoint_data && (
                      <div className="p-2 rounded bg-[#0A1128] border border-[#00E5FF]/20 text-[#00E5FF] space-y-1">
                        <div className="flex items-center gap-1 font-bold text-[10px]">
                          <Activity className="w-3 h-3" /> TASK CHECKPOINT STATE
                        </div>
                        <pre className="text-[10px] text-[#8FA3BF] whitespace-pre-wrap">
                          {JSON.stringify(task.checkpoint_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Error information if any */}
                    {task.error_info && (
                      <div className="p-2 rounded bg-[#0A1128] border border-[#FF4D6A]/30 text-[#FF4D6A] text-[10px]">
                        <strong>Error Log:</strong> {task.error_info}
                      </div>
                    )}

                    {/* Relevant files */}
                    {task.relevant_files && task.relevant_files.length > 0 && (
                      <div className="text-[10px] text-[#8FA3BF] flex items-center gap-1.5 flex-wrap">
                        <span className="text-[#00E5FF]">Relevant Files:</span>
                        {task.relevant_files.map((rf, rfi) => (
                          <span key={rfi} className="px-1.5 py-0.5 rounded bg-[#060C1B] border border-[#00E5FF]/10 text-white">
                            {rf}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Runtime worker logs if available */}
                    {runtimeWorker && runtimeWorker.logs && runtimeWorker.logs.length > 0 && (
                      <div className="pt-2 border-t border-[#00E5FF]/10 space-y-1">
                        <div className="text-[10px] text-[#00E5FF] font-bold">Process Terminal Logs</div>
                        <div className="max-h-28 overflow-y-auto space-y-0.5">
                          {runtimeWorker.logs.map((log, lidx) => (
                            <div key={lidx} className="text-[#8FA3BF] text-[10px]">
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Complete Task Evidence Modal */}
      {completingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0D1730] border border-[#22D3A0]/40 rounded-2xl p-5 shadow-[0_0_40px_rgba(34,211,160,0.2)] font-mono space-y-4">
            <div className="flex items-center justify-between border-b border-[#22D3A0]/20 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[#22D3A0]" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  RECORD COMPLETION EVIDENCE
                </h3>
              </div>
              <button
                onClick={() => setCompletingTaskId(null)}
                className="text-[#8FA3BF] hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-[#8FA3BF] leading-relaxed">
              In accordance with EDITH OS Phase 2 safety invariants, no task can be claimed complete without recorded verifiable evidence.
            </p>

            {evidenceError && (
              <div className="p-2 rounded bg-[#FF4D6A]/20 border border-[#FF4D6A]/40 text-[#FF4D6A] text-xs">
                {evidenceError}
              </div>
            )}

            <form onSubmit={submitTaskCompletion} className="space-y-3">
              <div>
                <label className="text-[10px] text-[#8FA3BF] uppercase block mb-1">
                  Evidence Summary / Result Note *
                </label>
                <textarea
                  rows={2}
                  value={evidenceNote}
                  onChange={(e) => setEvidenceNote(e.target.value)}
                  placeholder="e.g. Completed vulnerability audit, 0 high vulnerabilities found"
                  className="w-full bg-[#060C1B] border border-[#00E5FF]/20 rounded-lg p-2 text-xs text-white placeholder-[#8FA3BF]/40 focus:outline-none focus:border-[#22D3A0]"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-[#8FA3BF] uppercase block mb-1">
                  Artifact Reference / File Output (Optional)
                </label>
                <input
                  type="text"
                  value={evidenceArtifact}
                  onChange={(e) => setEvidenceArtifact(e.target.value)}
                  placeholder="e.g. /workspace/audit-report.json"
                  className="w-full bg-[#060C1B] border border-[#00E5FF]/20 rounded-lg p-2 text-xs text-white placeholder-[#8FA3BF]/40 focus:outline-none focus:border-[#22D3A0]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompletingTaskId(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#060C1B] border border-[#8FA3BF]/30 text-[#8FA3BF] hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEvidence}
                  className="px-4 py-1.5 rounded-lg bg-[#22D3A0]/20 border border-[#22D3A0]/50 text-[#22D3A0] hover:bg-[#22D3A0]/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Verify & Mark Completed</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0D1730] border border-[#00E5FF]/40 rounded-2xl p-5 shadow-[0_0_40px_rgba(0,229,255,0.2)] font-mono space-y-4">
            <div className="flex items-center justify-between border-b border-[#00E5FF]/20 pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-[#00E5FF]" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  CREATE PROJECT WORKSPACE
                </h3>
              </div>
              <button
                onClick={() => setShowProjectModal(false)}
                className="text-[#8FA3BF] hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="text-[10px] text-[#8FA3BF] uppercase block mb-1">Project Name *</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Infrastructure Hardening Q4"
                  className="w-full bg-[#060C1B] border border-[#00E5FF]/20 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-[#8FA3BF] uppercase block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Goals and scope for this project workspace"
                  className="w-full bg-[#060C1B] border border-[#00E5FF]/20 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#060C1B] border border-[#8FA3BF]/30 text-[#8FA3BF] hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#00E5FF]/20 border border-[#00E5FF]/50 text-[#00E5FF] hover:bg-[#00E5FF]/30 text-xs font-bold transition-all cursor-pointer"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Spawn Task Modal Dialog */}
      {showSpawnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0D1730] border border-[#00E5FF]/40 rounded-2xl p-5 shadow-[0_0_40px_rgba(0,229,255,0.2)] font-mono space-y-4">
            <div className="flex items-center justify-between border-b border-[#00E5FF]/20 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#00E5FF]" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  SPAWN PERSISTENT OS SUBPROCESS
                </h3>
              </div>
              <button
                onClick={() => setShowSpawnModal(false)}
                className="text-[#8FA3BF] hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSpawn} className="space-y-3 text-xs">
              {/* Preset quick templates */}
              <div className="space-y-1">
                <label className="text-[10px] text-[#8FA3BF] uppercase">Task Blueprint Template</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(['custom', 'deep_recon', 'security_audit', 'code_analysis'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setQuickType(t);
                        if (t === 'deep_recon') {
                          setTaskName('Deep Recon & Threat Intel');
                          setTaskCategory('RECON');
                          setTaskDescription('Search online threat feeds and correlate indicators');
                          setTaskNextStep('Aggregate OSINT feeds and generate vulnerability matrix');
                          setCustomParam('Kali Linux kernel zero-day mitigation');
                        } else if (t === 'security_audit') {
                          setTaskName('Localhost Port & Service Audit');
                          setTaskCategory('SYSTEM');
                          setTaskDescription('Enumerate listening sockets and vulnerable privileges');
                          setTaskNextStep('Run nmap / ss probe on local loopback');
                          setCustomParam('127.0.0.1');
                        } else if (t === 'code_analysis') {
                          setTaskName('Static Code AST Analysis');
                          setTaskCategory('CODE');
                          setTaskDescription('Scan source files for insecure functions & hardcoded secrets');
                          setTaskNextStep('AST traversal for secrets & unescaped commands');
                          setCustomParam('server.ts');
                        } else {
                          setTaskName('');
                          setTaskCategory('WORKFLOW');
                          setTaskDescription('');
                          setTaskNextStep('');
                          setCustomParam('');
                        }
                      }}
                      className={`p-1.5 rounded-lg border text-center transition-all capitalize cursor-pointer text-[10px] ${
                        quickType === t
                          ? 'bg-[#00E5FF]/20 border-[#00E5FF] text-[#00E5FF] font-bold'
                          : 'bg-[#060C1B] border-[#00E5FF]/20 text-[#8FA3BF] hover:text-white'
                      }`}
                    >
                      {t.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Project association */}
              <div>
                <label className="text-[10px] text-[#8FA3BF] uppercase block mb-1">Target Project</label>
                <select
                  value={taskProjectId}
                  onChange={(e) => setTaskProjectId(e.target.value)}
                  className="w-full bg-[#060C1B] border border-[#00E5FF]/20 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                >
                  <option value="">(Default Active Workspace)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Task Name */}
              <div>
                <label className="text-[10px] text-[#8FA3BF] uppercase block mb-1">Task Title *</label>
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="e.g. WiFi deauth perimeter scan"
                  className="w-full bg-[#060C1B] border border-[#00E5FF]/20 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-[10px] text-[#8FA3BF] uppercase block mb-1">Category</label>
                <select
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value as OSTask['category'])}
                  className="w-full bg-[#060C1B] border border-[#00E5FF]/20 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                >
                  <option value="RECON">RECON (Intelligence & Probing)</option>
                  <option value="SYSTEM">SYSTEM (Kernel & Subsystems)</option>
                  <option value="CODE">CODE (AST, Scripts, Build)</option>
                  <option value="ANALYSIS">ANALYSIS (Telemetry & Logs)</option>
                  <option value="WORKFLOW">WORKFLOW (Batch Pipeline)</option>
                  <option value="AUTOMATION">AUTOMATION (Autonomous agent)</option>
                </select>
              </div>

              {/* Next Planned Step */}
              <div>
                <label className="text-[10px] text-[#8FA3BF] uppercase block mb-1">
                  Initial Step / Next Planned Step
                </label>
                <input
                  type="text"
                  value={taskNextStep}
                  onChange={(e) => setTaskNextStep(e.target.value)}
                  placeholder="e.g. Launch packet capture on wlan0mon"
                  className="w-full bg-[#060C1B] border border-[#00E5FF]/20 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] text-[#8FA3BF] uppercase block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Brief details regarding task objectives"
                  className="w-full bg-[#060C1B] border border-[#00E5FF]/20 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                />
              </div>

              {/* Dynamic param for templates */}
              {quickType !== 'custom' && (
                <div>
                  <label className="text-[10px] text-[#00E5FF] uppercase block mb-1">
                    {quickType === 'deep_recon'
                      ? 'Target Query / Subject'
                      : quickType === 'security_audit'
                      ? 'Target Host / IP'
                      : 'File / Code snippet to analyze'}
                  </label>
                  <input
                    type="text"
                    value={customParam}
                    onChange={(e) => setCustomParam(e.target.value)}
                    className="w-full bg-[#060C1B] border border-[#00E5FF]/40 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#00E5FF]/15">
                <button
                  type="button"
                  onClick={() => setShowSpawnModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#060C1B] border border-[#8FA3BF]/30 text-[#8FA3BF] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-1.5 rounded-lg bg-[#00E5FF]/20 border border-[#00E5FF]/50 text-[#00E5FF] hover:bg-[#00E5FF]/30 font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isLoading ? (
                    <span>Registering...</span>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Spawn Task</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
