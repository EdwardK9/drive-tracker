import React, { useState, useRef } from 'react';
import { X, Server, Copy, Check, Download, Upload, GitBranch, Database, ShieldCheck, Terminal } from 'lucide-react';
import { importBackup } from '../api';

interface PortainerGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackupRestored: () => void;
}

const DOCKER_COMPOSE_YML = `version: '3.8'

services:
  drive-tracker:
    image: edwardk9/drive-tracker:latest # Or build: . if building from git repository
    container_name: drive-tracker
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATA_DIR=/app/data
      - UPLOADS_DIR=/app/uploads
    volumes:
      # Persistent SQLite database storage
      - drive_tracker_data:/app/data
      # Persistent receipt & document storage
      - drive_tracker_uploads:/app/uploads
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/api/stats || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  drive_tracker_data:
    name: drive_tracker_data
  drive_tracker_uploads:
    name: drive_tracker_uploads
`;

export const PortainerGuideModal: React.FC<PortainerGuideModalProps> = ({
  isOpen,
  onClose,
  onBackupRestored
}) => {
  const [copied, setCopied] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCopyCompose = () => {
    navigator.clipboard.writeText(DOCKER_COMPOSE_YML);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadBackup = () => {
    window.location.href = '/api/export';
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoring(true);
    setRestoreStatus(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await importBackup(json);
      setRestoreStatus(res.message || 'Backup restored successfully!');
      onBackupRestored();
    } catch (err: any) {
      setRestoreStatus('Error restoring backup: ' + err.message);
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl my-6 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-sky-950 border border-sky-800 text-sky-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Portainer & Docker Deployment</h2>
              <p className="text-xs text-slate-400">
                Container configuration, persistent volumes, CI/CD Webhooks & Database Backups
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
          {/* Section 1: Backup & Restore */}
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Database className="w-4 h-4" />
                <span>Database Backup & Restore</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">SQLite JSON Dump</span>
            </div>
            <p className="text-xs text-slate-300 mb-3">
              Export your entire drive inventory, historical CrystalDiskInfo logs, and document records into a single portable backup file.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleDownloadBackup}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export Full Backup (.json)</span>
              </button>

              <label className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-sky-400" />
                <span>{restoring ? 'Restoring...' : 'Restore from Backup'}</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleImportFile}
                  disabled={restoring}
                  className="hidden"
                />
              </label>
            </div>

            {restoreStatus && (
              <div className="mt-3 p-2.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-400">
                {restoreStatus}
              </div>
            )}
          </div>

          {/* Section 2: Docker Compose Configuration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Terminal className="w-4 h-4 text-sky-400" />
                <span>docker-compose.yml</span>
              </h3>
              <button
                onClick={handleCopyCompose}
                className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300 font-medium transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Compose YAML!' : 'Copy Compose YAML'}</span>
              </button>
            </div>

            <pre className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-sky-200 overflow-x-auto leading-relaxed">
              {DOCKER_COMPOSE_YML}
            </pre>
          </div>

          {/* Section 3: Portainer Stack Setup Instructions */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <GitBranch className="w-4 h-4 text-emerald-400" />
              <span>Step-by-Step Portainer Stack Deployment</span>
            </h3>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
                <strong className="text-white block mb-1">Method A: Portainer Web Editor (Instant)</strong>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>In Portainer, click on <strong>Stacks</strong> &rarr; <strong>+ Add stack</strong>.</li>
                  <li>Name the stack <code className="text-sky-400 font-mono">drive-tracker</code>.</li>
                  <li>Paste the <code className="text-sky-400 font-mono">docker-compose.yml</code> configuration above into the Web editor.</li>
                  <li>Click <strong>Deploy the stack</strong>. The app will be available on port 3000!</li>
                </ol>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
                <strong className="text-white block mb-1">Method B: Git Repository & Automatic Webhook (CI/CD)</strong>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>Push this repository to GitHub (<code className="text-sky-400 font-mono">EdwardK9/drive-tracker</code>).</li>
                  <li>In Portainer, navigate to <strong>Stacks &rarr; Add stack</strong>.</li>
                  <li>Choose the <strong>Repository</strong> build method.</li>
                  <li>Enter your Repository URL and branch (<code className="text-sky-400 font-mono">main</code>).</li>
                  <li>Enable <strong>Automatic updates</strong> and copy the generated <strong>Webhook URL</strong>.</li>
                  <li>In your GitHub repo, go to <strong>Settings &rarr; Webhooks &rarr; Add webhook</strong>, paste the Portainer URL and set content type to <code className="text-sky-400 font-mono">application/json</code>.</li>
                  <li>Every git push to <code className="text-sky-400 font-mono">main</code> will automatically rebuild and redeploy the container in Portainer!</li>
                </ol>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
                <strong className="text-white block mb-1">Persistent Volumes Breakdown</strong>
                <ul className="list-disc list-inside space-y-1 text-slate-400 font-mono text-[11px]">
                  <li><span className="text-sky-400">/app/data</span>: Stores the SQLite database (<code className="text-slate-300">drives.db</code>) with WAL journal mode. Survives container restarts and upgrades.</li>
                  <li><span className="text-sky-400">/app/uploads</span>: Stores all digital PDF invoices and photo receipt uploads.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
