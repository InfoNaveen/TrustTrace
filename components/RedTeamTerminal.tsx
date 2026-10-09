'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Shield, AlertTriangle, CheckCircle, Play, RotateCcw } from 'lucide-react';

interface ExploitLog {
  id: string;
  timestamp: Date;
  type: string;
  target: string;
  payload: string;
  success: boolean;
  output: string;
  severity: 'low' | 'medium' | 'high';
}

interface RedTeamTerminalProps {
  projectPath?: string;
  onScanComplete?: (results: any) => void;
}

const RedTeamTerminal: React.FC<RedTeamTerminalProps> = ({ projectPath, onScanComplete }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [logs, setLogs] = useState<ExploitLog[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'results'>('logs');
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const runRedTeamScan = async () => {
    if (!projectPath) {
      console.error('Project path is required to run red team scan');
      return;
    }

    setIsScanning(true);
    setLogs([]);

    try {
      // Simulate red team scan process
      const response = await fetch('/api/red-team-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectPath }),
      });

      if (!response.ok) {
        throw new Error(`Red team scan failed: ${response.statusText}`);
      }

      const results = await response.json();
      
      // Process the results and add to logs
      const newLogs: ExploitLog[] = results.exploits.map((exploit: any) => ({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date(),
        type: exploit.exploitType,
        target: exploit.target,
        payload: exploit.payload,
        success: exploit.success,
        output: exploit.output,
        severity: exploit.severity
      }));

      setLogs(newLogs);
      
      if (onScanComplete) {
        onScanComplete(results);
      }
    } catch (error) {
      console.error('Error running red team scan:', error);
      
      // Add error log
      setLogs([{
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date(),
        type: 'Error',
        target: 'System',
        payload: 'N/A',
        success: false,
        output: `Red team scan failed: ${(error as Error).message}`,
        severity: 'high'
      }]);
    } finally {
      setIsScanning(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  const getSeverityIcon = (success: boolean, severity: string) => {
    if (!success) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    
    switch (severity) {
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'medium':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'low':
        return <AlertTriangle className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="bg-brand-surface rounded-lg shadow-lg border border-brand-primary/20 overflow-hidden">
      <div className="bg-brand-surface/80 px-4 py-3 border-b border-brand-primary/20 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Terminal className="w-5 h-5 text-brand-secondary" />
          <h3 className="font-medium text-white">Red-Team Terminal</h3>
          <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full">
            OFFENSIVE MODE
          </span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={runRedTeamScan}
            disabled={isScanning}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            <Play className="w-3 h-3 mr-1" />
            {isScanning ? 'Scanning...' : 'Run Scan'}
          </button>
          <button
            onClick={clearLogs}
            className="inline-flex items-center px-3 py-1.5 border border-brand-primary/20 text-xs font-medium rounded text-gray-300 bg-brand-surface/50 hover:bg-brand-surface focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Clear
          </button>
        </div>
      </div>

      <div className="flex border-b border-brand-primary/20">
        <button
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            activeTab === 'logs'
              ? 'border-b-2 border-brand-secondary text-brand-secondary'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('logs')}
        >
          Attack Logs
        </button>
        <button
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            activeTab === 'results'
              ? 'border-b-2 border-brand-secondary text-brand-secondary'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('results')}
        >
          Security Report
        </button>
      </div>

      <div className="h-80 overflow-auto" ref={terminalRef}>
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <Shield className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Red-Team Validation</h4>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Run a dynamic exploit validation to test your code against real-world attack vectors.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This security-first approach validates that vulnerabilities are not just detected, but truly patched and non-exploitable.
            </p>
          </div>
        ) : (
          <div className="p-4 font-mono text-sm">
            {logs.map((log) => (
              <div 
                key={log.id} 
                className={`mb-3 p-3 rounded border ${
                  log.success 
                    ? 'bg-red-900/20 border-red-500/30' 
                    : 'bg-green-900/20 border-green-500/30'
                }`}
              >
                <div className="flex items-start">
                  <div className="mr-2 mt-0.5">
                    {getSeverityIcon(log.success, log.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`font-medium ${getSeverityColor(log.severity)}`}>
                          {log.type}
                        </span>
                        {log.success ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                            EXPLOIT SUCCESSFUL
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/40 text-green-300">
                            BLOCKED
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      <div className="font-medium">Target: {log.target}</div>
                      <div>Payload: {log.payload}</div>
                      <div className="mt-1 text-sm text-gray-200 font-mono bg-brand-dark/50 p-2 rounded">
                        {log.output}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isScanning && (
        <div className="px-4 py-3 bg-blue-900/20 border-t border-brand-primary/20 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
          <span className="text-sm text-blue-300">
            Running dynamic exploit validation against your code...
          </span>
        </div>
      )}
    </div>
  );
};

export default RedTeamTerminal;