import React from 'react';
import { Database, ShieldCheck, Thermometer, CalendarClock, FileText, AlertTriangle } from 'lucide-react';
import { OverviewStats } from '../types';

interface StatsOverviewProps {
  stats: OverviewStats | null;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  if (!stats) return null;

  const hasIssues = stats.health.caution > 0 || stats.health.bad > 0;
  const tempColor =
    stats.averageTemperatureC === null
      ? 'text-slate-400'
      : stats.averageTemperatureC > 48
      ? 'text-rose-400'
      : stats.averageTemperatureC > 40
      ? 'text-amber-400'
      : 'text-emerald-400';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
      {/* 1. Total Storage & Drives */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-4 shadow-sm hover:border-slate-600 transition-colors">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span>Pool Capacity</span>
          <Database className="w-4 h-4 text-sky-400" />
        </div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-white tracking-tight">{stats.totalCapacityTB}</span>
          <span className="text-sm font-semibold text-slate-400">TB</span>
        </div>
        <div className="text-xs text-slate-400 mt-1 font-mono">
          {stats.totalDrives} {stats.totalDrives === 1 ? 'drive' : 'drives'} indexed
        </div>
      </div>

      {/* 2. Health Status */}
      <div className={`bg-slate-800/80 border ${hasIssues ? 'border-amber-700/60 bg-amber-950/20' : 'border-slate-700/70'} rounded-xl p-4 shadow-sm hover:border-slate-600 transition-colors`}>
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span>Health Status</span>
          {hasIssues ? (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          )}
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-emerald-400">{stats.health.good}</span>
          <span className="text-xs text-slate-400 font-mono">Good</span>
          {stats.health.caution > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold font-mono">
              {stats.health.caution} Warn
            </span>
          )}
          {stats.health.bad > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold font-mono">
              {stats.health.bad} Bad
            </span>
          )}
        </div>
        <div className="text-xs text-slate-400 mt-1 font-mono">
          {hasIssues ? 'SMART alerts detected' : 'All drives healthy'}
        </div>
      </div>

      {/* 3. Average Operating Temp */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-4 shadow-sm hover:border-slate-600 transition-colors">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span>Avg Temperature</span>
          <Thermometer className={`w-4 h-4 ${tempColor}`} />
        </div>
        <div className="flex items-baseline space-x-1.5">
          <span className={`text-2xl font-bold ${tempColor}`}>
            {stats.averageTemperatureC !== null ? `${stats.averageTemperatureC}°C` : '—'}
          </span>
          {stats.averageTemperatureC !== null && (
            <span className="text-xs text-slate-400 font-mono">
              ({Math.round((stats.averageTemperatureC * 9) / 5 + 32)}°F)
            </span>
          )}
        </div>
        <div className="text-xs text-slate-400 mt-1 font-mono">
          {stats.averageTemperatureC && stats.averageTemperatureC <= 42 ? 'Optimal thermal state' : 'Within normal range'}
        </div>
      </div>

      {/* 4. Warranty Status */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-4 shadow-sm hover:border-slate-600 transition-colors">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span>Warranties</span>
          <CalendarClock className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="flex items-baseline space-x-2">
          {stats.warranty.expiringSoon > 0 ? (
            <span className="text-2xl font-bold text-amber-400">{stats.warranty.expiringSoon}</span>
          ) : (
            <span className="text-2xl font-bold text-slate-200">0</span>
          )}
          <span className="text-xs text-slate-400">expiring soon</span>
        </div>
        <div className="text-xs text-slate-400 mt-1 font-mono">
          {stats.warranty.expired > 0 ? `${stats.warranty.expired} expired warranties` : 'Active coverage valid'}
        </div>
      </div>

      {/* 5. Document & SMART Logs */}
      <div className="col-span-2 sm:col-span-1 bg-slate-800/80 border border-slate-700/70 rounded-xl p-4 shadow-sm hover:border-slate-600 transition-colors">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span>SMART & Receipts</span>
          <FileText className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-sky-400">{stats.totalLogs}</span>
          <span className="text-xs text-slate-400 font-mono">logs</span>
          <span className="text-slate-500">•</span>
          <span className="text-base font-semibold text-slate-300">{stats.totalReceipts}</span>
          <span className="text-xs text-slate-400 font-mono">docs</span>
        </div>
        <div className="text-xs text-slate-400 mt-1 font-mono">
          Persistent SQLite storage
        </div>
      </div>
    </div>
  );
};
