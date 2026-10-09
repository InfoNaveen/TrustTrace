'use client';

import { useState } from 'react';

interface UploadFormProps {
  onUploadStart: () => void;
  onUploadComplete: (projectId: string) => void;
  onScanComplete: (findings: any[], patches: any[]) => void;
  onError: (error: string) => void;
}

export default function UploadForm({ onUploadStart, onUploadComplete, onScanComplete, onError }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'zip' | 'github'>('zip');
  const [githubToken, setGithubToken] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onUploadStart();

    try {
      if (uploadMethod === 'zip' && file) {
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok || !uploadData.success) throw new Error(uploadData.error || 'Upload failed');

        onUploadComplete(uploadData.projectId);

        // Trigger scan
        const scanResponse = await fetch('/api/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ projectId: uploadData.projectId }),
        });

        const scanData = await scanResponse.json();
        if (!scanResponse.ok || !scanData.success) throw new Error(scanData.error || 'Scan failed');

        onScanComplete(scanData.findings, scanData.patches);
      } else if (uploadMethod === 'github' && repoUrl) {
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ repoUrl, githubToken }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Repository clone failed');

        onUploadComplete(data.projectId);

        // Trigger scan
        const scanResponse = await fetch('/api/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ projectId: data.projectId }),
        });

        const scanData = await scanResponse.json();
        if (!scanResponse.ok || !scanData.success) throw new Error(scanData.error || 'Scan failed');

        onScanComplete(scanData.findings, scanData.patches);
      }
    } catch (error) {
      console.error('Upload error:', error);
      onError((error as Error).message);
    }
  };

  return (
    <div className="bg-brand-surface rounded-lg p-6 mb-8">
      <h2 className="text-2xl font-bold mb-6">Upload Code for Scanning</h2>
      
      <div className="flex space-x-4 mb-6">
        <button
          className={`px-4 py-2 rounded-md ${uploadMethod === 'zip' ? 'bg-brand-secondary' : 'bg-brand-surface/60'}`}
          onClick={() => setUploadMethod('zip')}
        >
          Upload ZIP File
        </button>
        <button
          className={`px-4 py-2 rounded-md ${uploadMethod === 'github' ? 'bg-brand-secondary' : 'bg-brand-surface/60'}`}
          onClick={() => setUploadMethod('github')}
        >
          GitHub Repository
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {uploadMethod === 'zip' ? (
          <div className="mb-4">
            <label className="block text-gray-300 mb-2">Select ZIP File</label>
            <input
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="w-full p-2 bg-brand-surface/60 rounded-md border border-brand-primary/20"
              required
            />
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">GitHub Repository URL</label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
                className="w-full p-2 bg-brand-surface/60 rounded-md border border-brand-primary/20"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">GitHub Token (optional)</label>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_********"
                className="w-full p-2 bg-brand-surface/60 rounded-md border border-brand-primary/20"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          className="w-full bg-brand-secondary hover:bg-brand-secondary/80 text-white font-bold py-3 px-4 rounded-md transition duration-300"
        >
          Upload and Scan
        </button>
      </form>
    </div>
  );
}