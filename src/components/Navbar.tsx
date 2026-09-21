import React from 'react';
import { HardDrive, Plus, FileText, Server, RefreshCw } from 'lucide-react';
import { OverviewStats } from '../types';
import { APP_VERSION, APP_RELEASE_TITLE } from '../version';

interface NavbarProps {
  stats: OverviewStats | null;
  onOpenAddModal: () => void;
  onOpenParserModal: () => void;
  onOpenPortainerModal: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  stats,
  onOpenAddModal,
  onOpenParserModal,
  onOpenPortainerModal,
  onRefresh,
  isLoading
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 ring-1 ring-white/20">
            <HardDrive className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-white tracking-tight">Drive Tracker</h1>
              <span
                className="px-2 py-0.5 text-xs font-medium rounded-md bg-sky-950 text-sky-400 border border-sky-800/60 font-mono cursor-help"
                title={`Drive Tracker ${APP_RELEASE_TITLE}`}
              >
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Inventory, CrystalDiskInfo SMART logs & warranty tracking
            </p>
          </div>
        </div>

        {/* Quick status summary */}
        {stats && (
          <div className="hidden lg:flex items-center space-x-4 text-xs font-mono">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{stats.totalDrives} Drives</span>
              <span className="text-slate-500">•</span>
              <span className="text-sky-400 font-semibold">{stats.totalCapacityTB} TB</span>
            </div>

            {stats.health.caution + stats.health.bad > 0 && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-800/70 text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>{stats.health.caution + stats.health.bad} Warning/Caution</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            id="btn-refresh"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh inventory"
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          <button
            id="btn-portainer-guide"
            onClick={onOpenPortainerModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors shadow-sm"
          >
            <Server className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">Portainer & Backup</span>
            <span className="sm:hidden">Docker</span>
          </button>

          <button
            id="btn-paste-crystaldisk"
            onClick={onOpenParserModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-sky-300 bg-sky-950/70 hover:bg-sky-900/80 border border-sky-700/60 transition-colors shadow-sm"
          >
            <FileText className="w-4 h-4 text-sky-400" />
            <span>Paste CrystalDisk</span>
          </button>

          <button
            id="btn-add-drive"
            onClick={onOpenAddModal}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-600/20 transition-all hover:shadow-sky-600/30 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Drive</span>
          </button>
        </div>
      </div>
    </header>
  );
};
