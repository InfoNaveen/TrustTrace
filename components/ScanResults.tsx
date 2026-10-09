'use client';

import { useState } from 'react';

interface Finding {
  type: string;
  severity: 'low' | 'medium' | 'high';
  file: string;
  line: number;
  snippet: string;
}

interface Patch {
  file: string;
  change: string;
}

interface ScanResultsProps {
  findings: Finding[];
  patches: Patch[];
  projectId: string | null;
}

export default function ScanResults({ findings, patches, projectId }: ScanResultsProps) {
  const [githubToken, setGithubToken] = useState('');
  const [branchName, setBranchName] = useState('devsentinel-fixes');
  const [commitMessage, setCommitMessage] = useState('Apply security fixes from DevSentinel AI');
  const [exportMethod, setExportMethod] = useState<'zip' | 'github'>('zip');

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const handleExport = async () => {
    if (exportMethod === 'zip') {
      // Export as ZIP
      const response = await fetch('/api/patch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId, export: true }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'patched-code.zip';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const error = await response.json();
        alert(`Export failed: ${error.error}`);
      }
    } else {
      // Commit to GitHub
      const response = await fetch('/api/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          projectId, 
          githubToken, 
          branchName, 
          commitMessage 
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully committed to GitHub! ${result.prUrl ? `PR created: ${result.prUrl}` : ''}`);
      } else {
        const error = await response.json();
        alert(`Commit failed: ${error.error}`);
      }
    }
  };

  return (
    <div className="bg-brand-surface rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Scan Results</h2>
      
      {findings.length > 0 ? (
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Security Issues Found ({findings.length})</h3>
          
          {/* Vulnerability Table */}
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full bg-brand-surface/60 rounded-lg overflow-hidden">
              <thead className="bg-brand-surface/80">
                <tr>
                  <th className="py-3 px-4 text-left">Severity</th>
                  <th className="py-3 px-4 text-left">File</th>
                  <th className="py-3 px-4 text-left">Line</th>
                  <th className="py-3 px-4 text-left">Issue</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((finding, index) => (
                  <tr key={index} className="border-b border-brand-primary/20 hover:bg-brand-surface/40">
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(finding.severity)} text-white`}>
                        {finding.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-sm">{finding.file}</td>
                    <td className="py-3 px-4">{finding.line}</td>
                    <td className="py-3 px-4">{finding.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Detailed Findings */}
          <div className="space-y-4">
            {findings.map((finding, index) => (
              <div key={index} className="bg-brand-surface/60 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`inline-block w-3 h-3 rounded-full mr-2 ${getSeverityColor(finding.severity)}`}></span>
                    <span className="font-medium">{finding.type}</span>
                    <span className="ml-2 text-xs bg-brand-primary/20 px-2 py-1 rounded">
                      {finding.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-gray-400 text-sm">
                    {finding.file}:{finding.line}
                  </div>
                </div>
                <div className="mt-2 text-gray-300 font-mono text-sm p-2 bg-brand-dark/50 rounded overflow-x-auto">
                  {finding.snippet}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-8 p-4 bg-green-900/30 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">No Security Issues Found</h3>
          <p className="text-gray-300">Your code passed all security checks!</p>
        </div>
      )}

      {patches.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Auto-Patched Issues ({patches.length})</h3>
          
          {/* Patch Feedback Table */}
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full bg-brand-surface/60 rounded-lg overflow-hidden">
              <thead className="bg-brand-surface/80">
                <tr>
                  <th className="py-3 px-4 text-left">Status</th>
                  <th className="py-3 px-4 text-left">File</th>
                  <th className="py-3 px-4 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {patches.map((patch, index) => (
                  <tr key={index} className="border-b border-brand-primary/20 hover:bg-brand-surface/40">
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500 text-white">
                        ✅ Patch Applied
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-sm">{patch.file}</td>
                    <td className="py-3 px-4">
                      {patch.change.includes('eval()') && 'eval() replaced with safe wrapper'}
                      {patch.change.includes('SQL') && 'SQL TODO Added'}
                      {patch.change.includes('secret') && 'Secret Redacted'}
                      {patch.change.includes('exec()') && 'exec() flagged for review'}
                      {!patch.change.includes('eval()') && !patch.change.includes('SQL') && !patch.change.includes('secret') && !patch.change.includes('exec()') && patch.change}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Detailed Patches */}
          <div className="space-y-4">
            {patches.map((patch, index) => (
              <div key={index} className="bg-brand-secondary/10 rounded-lg p-4">
                <div className="font-medium text-brand-secondary">{patch.file}</div>
                <div className="mt-2 text-gray-300 font-mono text-sm p-2 bg-brand-dark/50 rounded">
                  {patch.change}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-gray-700 pt-6">
        <h3 className="text-xl font-semibold mb-4">Export Options</h3>
        
        <div className="flex space-x-4 mb-6">
          <button
            className={`px-4 py-2 rounded-md ${exportMethod === 'zip' ? 'bg-blue-600' : 'bg-gray-700'}`}
            onClick={() => setExportMethod('zip')}
          >
            Download Patched ZIP
          </button>
          <button
            className={`px-4 py-2 rounded-md ${exportMethod === 'github' ? 'bg-blue-600' : 'bg-gray-700'}`}
            onClick={() => setExportMethod('github')}
          >
            Commit to GitHub
          </button>
        </div>

        {exportMethod === 'github' && (
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-gray-300 mb-2">GitHub Token</label>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_********"
                  className="w-full p-2 bg-gray-700 rounded-md border border-gray-600"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Branch Name</label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="devsentinel-fixes"
                  className="w-full p-2 bg-gray-700 rounded-md border border-gray-600"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Commit Message</label>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Apply security fixes from DevSentinel AI"
                className="w-full p-2 bg-gray-700 rounded-md border border-gray-600"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleExport}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-md transition duration-300"
        >
          {exportMethod === 'zip' ? 'Download Patched ZIP' : 'Commit to GitHub'}
        </button>
      </div>
    </div>
  );
}