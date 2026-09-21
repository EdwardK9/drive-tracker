import React, { useState } from 'react';
import { HardDrive, Thermometer, Clock, ShieldCheck, AlertTriangle, XCircle, FileText, ExternalLink, Copy, Check, Plus, Tag, Calendar, Activity } from 'lucide-react';
import { Drive } from '../types';

interface DriveCardProps {
  drive: Drive;
  onSelect: (drive: Drive) => void;
  onQuickLog: (drive: Drive) => void;
  onEdit: (drive: Drive) => void;
}

export const DriveCard: React.FC<DriveCardProps> = ({
  drive,
  onSelect,
  onQuickLog,
  onEdit
}) => {
  const [copied, setCopied] = useState(false);

  const copySerial = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(drive.serial_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const latestLog = drive.latest_log;
  const health = latestLog ? latestLog.health_status : 'Good';
  const healthPct = latestLog?.health_percentage;
  const tempC = latestLog?.temperature_c;
  const tempF = latestLog?.temperature_f || (tempC ? Math.round((tempC * 9) / 5 + 32) : null);
  const currentPoh = latestLog?.power_on_hours ?? drive.initial_power_on_hours ?? 0;
  const currentPoc = latestLog?.power_on_count ?? drive.initial_power_on_count ?? 0;

  // Calculate delta wear since initial snapshot
  const initialPoh = drive.initial_power_on_hours || 0;
  const pohGained = currentPoh > initialPoh ? currentPoh - initialPoh : 0;

  // Capacity display
  const capDisplay = drive.capacity_gb >= 1000 
    ? `${(drive.capacity_gb / 1000).toFixed(drive.capacity_gb % 1000 === 0 ? 0 : 1)} TB`
    : `${drive.capacity_gb} GB`;

  // Warranty info
  const warranty = drive.warranty_info;
  let warrantyBadge = null;
  if (warranty && warranty.status !== 'none') {
    if (warranty.status === 'active') {
      warrantyBadge = (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 font-mono">
          {warranty.label}
        </span>
      );
    } else if (warranty.status === 'expiring_soon') {
      warrantyBadge = (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/80 font-mono animate-pulse">
          {warranty.label}
        </span>
      );
    } else if (warranty.status === 'expired') {
      warrantyBadge = (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-rose-950/70 text-rose-300 border border-rose-800/60 font-mono">
          Expired
        </span>
      );
    }
  }

  // Health badge
  const healthBadge = () => {
    if (health === 'Caution') {
      return (
        <span className="flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-950/80 text-amber-300 border border-amber-800/70">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>Caution {healthPct ? `(${healthPct}%)` : ''}</span>
        </span>
      );
    }
    if (health === 'Bad') {
      return (
        <span className="flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-950/80 text-rose-300 border border-rose-800/70">
          <XCircle className="w-3.5 h-3.5 text-rose-400" />
          <span>Bad / Critical</span>
        </span>
      );
    }
    return (
      <span className="flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>Good {healthPct ? `(${healthPct}%)` : ''}</span>
      </span>
    );
  };

  return (
    <div
      id={`drive-card-${drive.id}`}
      onClick={() => onSelect(drive)}
      className="group bg-slate-800/90 border border-slate-700/80 hover:border-sky-500/70 rounded-xl p-5 shadow-sm hover:shadow-xl hover:shadow-sky-950/30 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
    >
      {/* Top row: Custom ID, Form factor & Health badge */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 text-xs font-bold tracking-wider rounded-md bg-sky-950 text-sky-400 border border-sky-800/80 font-mono shadow-sm">
              {drive.custom_id || 'DRV'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 font-mono border border-slate-600/50">
              {drive.form_factor || '3.5" HDD'}
            </span>
            {drive.status !== 'Active' && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-purple-950/60 text-purple-300 font-medium border border-purple-800/60">
                {drive.status}
              </span>
            )}
          </div>
          {healthBadge()}
        </div>

        {/* Model & Capacity Title */}
        <div className="mb-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-semibold text-white group-hover:text-sky-300 transition-colors truncate" title={drive.model}>
              {drive.model}
            </h3>
            <span className="text-lg font-bold text-sky-400 font-mono ml-2 shrink-0">
              {capDisplay}
            </span>
          </div>

          {/* Serial Number with quick copy */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-1 font-mono">
            <span>S/N:</span>
            <button
              onClick={copySerial}
              className="px-1.5 py-0.5 rounded bg-slate-900/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center space-x-1 border border-slate-700"
              title="Copy serial number"
            >
              <span>{drive.serial_number}</span>
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
            </button>
          </div>
        </div>

        {/* Notes preview if present */}
        {drive.notes && (
          <p className="text-xs text-slate-400 bg-slate-900/50 rounded-lg p-2 border border-slate-700/40 line-clamp-1 mb-3">
            {drive.notes}
          </p>
        )}

        {/* Telemetry & SMART metrics block */}
        <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-lg bg-slate-900/70 border border-slate-700/50 mb-3 text-center">
          {/* Temperature */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium flex items-center justify-center space-x-1">
              <Thermometer className="w-3 h-3 text-slate-400" />
              <span>Temp</span>
            </div>
            <div className="text-sm font-bold mt-0.5 font-mono text-slate-200">
              {tempC ? (
                <span className={tempC > 48 ? 'text-rose-400' : tempC > 40 ? 'text-amber-400' : 'text-emerald-400'}>
                  {tempC}°C <span className="text-[11px] text-slate-400 font-normal">({tempF}°F)</span>
                </span>
              ) : (
                <span className="text-slate-500">—</span>
              )}
            </div>
          </div>

          {/* Power-On Hours */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium flex items-center justify-center space-x-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>POH</span>
            </div>
            <div className="text-sm font-bold mt-0.5 font-mono text-slate-200">
              {currentPoh.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">hrs</span>
            </div>
            {pohGained > 0 && (
              <div className="text-[10px] text-sky-400 font-mono">
                +{pohGained.toLocaleString()}h
              </div>
            )}
          </div>

          {/* Power Cycles */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              Cycles
            </div>
            <div className="text-sm font-bold mt-0.5 font-mono text-slate-200">
              {currentPoc} <span className="text-[10px] text-slate-400 font-normal">cnt</span>
            </div>
          </div>
        </div>

        {/* Age & Failure Risk Banner */}
        {drive.age_info && (
          <div className="mb-3 p-2 rounded-lg bg-slate-900/60 border border-slate-700/40 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-amber-400/90 shrink-0" />
              <span className="font-medium">{drive.age_info.formattedAge}</span>
              <span className="text-[10px] text-slate-400 font-mono">({drive.age_info.dutyCyclePercent}% duty)</span>
            </div>

            {drive.risk_assessment && (
              <span
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                  drive.risk_assessment.riskLevel === 'critical'
                    ? 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                    : drive.risk_assessment.riskLevel === 'elevated'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                    : drive.risk_assessment.riskLevel === 'moderate'
                    ? 'bg-sky-950/80 text-sky-300 border-sky-800/70'
                    : 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                }`}
                title={drive.risk_assessment.riskDescription}
              >
                {drive.risk_assessment.phaseLabel}
              </span>
            )}
          </div>
        )}

        {/* Purchase & Warranty summary */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs">
          {drive.vendor && (
            <span className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 font-medium">
              {drive.vendor}
            </span>
          )}
          {warrantyBadge}
          {drive.receipt_count && drive.receipt_count > 0 ? (
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 font-mono">
              <FileText className="w-3 h-3 text-indigo-400" />
              <span>{drive.receipt_count} {drive.receipt_count === 1 ? 'doc' : 'docs'}</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
        <span className="font-mono text-[11px]">
          {latestLog ? `Updated: ${latestLog.log_date}` : 'No logs yet'}
        </span>

        <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
          <button
            id={`btn-quicklog-${drive.id}`}
            onClick={() => onQuickLog(drive)}
            title="Log CrystalDiskInfo report"
            className="px-2 py-1 rounded bg-slate-700/70 hover:bg-sky-600 hover:text-white text-slate-200 transition-colors flex items-center space-x-1 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Log</span>
          </button>

          <button
            id={`btn-details-${drive.id}`}
            onClick={() => onSelect(drive)}
            className="px-2.5 py-1 rounded bg-sky-950 text-sky-400 hover:bg-sky-900 border border-sky-800/60 transition-colors flex items-center space-x-1 font-medium"
          >
            <span>Details</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
