'use client';

import { useState } from 'react';
import type { RunStatus, Evaluation, AgentMode } from '@/lib/trusttrace/models';
import { OverviewPanel } from '@/components/trusttrace/OverviewPanel';
import { RunConfigForm } from '@/components/trusttrace/RunConfigForm';
import { RunWorkspace } from '@/components/trusttrace/RunWorkspace';
import { ResultsPanel } from '@/components/trusttrace/ResultsPanel';
import { ReportView } from '@/components/trusttrace/ReportView';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveTab = 'overview' | 'run' | 'workspace' | 'results' | 'report';

export interface RecentRunEntry {
  run_id: string;
  scenario_id: string;
  agent_mode: AgentMode;
  protection_enabled: boolean;
  status: RunStatus;
  evaluation: Evaluation | null;
  created_at: string;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TrustTracePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [currentRunCompleted, setCurrentRunCompleted] = useState<boolean>(false);
  const [completedRuns, setCompletedRuns] = useState<RecentRunEntry[]>([]);

  function handleRunCreated(runId: string) {
    setCurrentRunId(runId);
    setCurrentRunCompleted(false);
    setActiveTab('workspace');
  }

  function handleRunCompleted(run: RecentRunEntry) {
    setCompletedRuns((prev) => [run, ...prev]);
    setCurrentRunCompleted(run.status === 'completed');
  }

  // Tab definitions with disabled logic
  const tabs: Array<{ id: ActiveTab; label: string; disabled: boolean }> = [
    { id: 'overview', label: 'Overview', disabled: false },
    { id: 'run', label: 'Run', disabled: false },
    { id: 'workspace', label: 'Workspace', disabled: currentRunId === null },
    { id: 'results', label: 'Results', disabled: false },
    {
      id: 'report',
      label: 'Report',
      disabled: currentRunId === null || !currentRunCompleted,
    },
  ];

  function selectTab(id: ActiveTab) {
    const tab = tabs.find((t) => t.id === id);
    if (tab && !tab.disabled) {
      setActiveTab(id);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 py-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
          DevSentinel TrustTrace
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Observe the attempt. Enforce the boundary. Prove the outcome.
        </p>
      </div>

      {/* Tab bar */}
      <nav
        className="flex space-x-1 border-b border-gray-700/50 mb-6"
        role="tablist"
        aria-label="TrustTrace navigation"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            disabled={tab.disabled}
            onClick={() => selectTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-cyan-400 text-white'
                : tab.disabled
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab panels */}
      {activeTab === 'overview' && (
        <OverviewPanel
          onStartRun={() => setActiveTab('run')}
          recentRuns={completedRuns}
        />
      )}

      {activeTab === 'run' && (
        <RunConfigForm onRunCreated={handleRunCreated} />
      )}

      {activeTab === 'workspace' && (
        currentRunId ? (
          <RunWorkspace
            key={currentRunId}
            runId={currentRunId}
            onReset={() => {
              setCurrentRunId(null);
              setCurrentRunCompleted(false);
              setActiveTab('run');
            }}
            onCompleted={handleRunCompleted}
          />
        ) : (
          <div className="text-gray-500 p-6">
            No active run. Go to the Run tab to start one.
          </div>
        )
      )}

      {activeTab === 'results' && (
        <ResultsPanel runs={completedRuns} />
      )}

      {activeTab === 'report' && (
        currentRunId ? (
          <ReportView runId={currentRunId} />
        ) : (
          <div className="text-gray-500 p-6">No run selected.</div>
        )
      )}
    </div>
  );
}
