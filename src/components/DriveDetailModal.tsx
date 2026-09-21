import React, { useState, useEffect, useRef } from 'react';
import {
  X, HardDrive, Calendar, Shield, DollarSign, FileText, Upload,
  Clock, Thermometer, Trash2, Edit2, AlertTriangle, CheckCircle2,
  ExternalLink, ChevronDown, ChevronUp, Activity, Plus, RefreshCw, Check, TrendingUp, Printer
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, AreaChart, Area
} from 'recharts';
import { Drive, DriveDetail, CrystalDiskLog, DriveReceipt, RuntimeWearInfo } from '../types';
import { fetchDriveDetail, deleteDrive, uploadReceipt, deleteReceipt, deleteCrystalDiskLog } from '../api';
import { QuickSetDomModal } from './QuickSetDomModal';

interface DriveDetailModalProps {
  driveId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (drive: Drive) => void;
  onDriveDeleted: (id: string) => void;
  onOpenQuickLog: (drive: Drive) => void;
  onViewReceipt: (receipt: DriveReceipt) => void;
  onPrintLabel?: (drive: Drive) => void;
}

export const DriveDetailModal: React.FC<DriveDetailModalProps> = ({
  driveId,
  isOpen,
  onClose,
  onEdit,
  onDriveDeleted,
  onOpenQuickLog,
  onViewReceipt,
  onPrintLabel
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'logs' | 'receipts'>('overview');
  const [detail, setDetail] = useState<DriveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copiedSerial, setCopiedSerial] = useState(false);
  const [isQuickDomOpen, setIsQuickDomOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    if (!driveId) return;
    setLoading(true);
    try {
      const data = await fetchDriveDetail(driveId);
      setDetail(data);
    } catch (err) {
      console.error('Failed to load drive detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && driveId) {
      loadData();
      setActiveTab('overview');
      setShowDeleteConfirm(false);
    }
  }, [isOpen, driveId]);

  if (!isOpen || !driveId) return null;

  const handleCopySerial = () => {
    if (detail?.serial_number) {
      navigator.clipboard.writeText(detail.serial_number);
      setCopiedSerial(true);
      setTimeout(() => setCopiedSerial(false), 2000);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !detail) return;

    setUploading(true);
    try {
      await uploadReceipt(detail.id, selectedFile, uploadLabel || selectedFile.name);
      setSelectedFile(null);
      setUploadLabel('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadData();
    } catch (err) {
      alert('Failed to upload file: ' + err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteReceipt(receiptId);
      await loadData();
    } catch (err) {
      alert('Failed to delete document: ' + err);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Are you sure you want to delete this SMART log entry?')) return;
    try {
      await deleteCrystalDiskLog(logId);
      await loadData();
    } catch (err) {
      alert('Failed to delete log: ' + err);
    }
  };

  const handleDeleteDrive = async () => {
    if (!detail) return;
    try {
      await deleteDrive(detail.id);
      onDriveDeleted(detail.id);
      onClose();
    } catch (err) {
      alert('Failed to delete drive: ' + err);
    }
  };

  // Prepare chart data for history trends (sorted chronologically)
  const chartData = detail?.logs
    ? [...detail.logs]
        .sort((a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime())
        .map((l) => ({
          date: l.log_date,
          temperature: l.temperature_c,
          poh: l.power_on_hours,
          reads: l.host_reads_gb ? +(l.host_reads_gb / 1024).toFixed(1) : null,
          writes: l.host_writes_gb ? +(l.host_writes_gb / 1024).toFixed(1) : null
        }))
    : [];

  const latestLog = detail?.logs && detail.logs.length > 0 ? detail.logs[0] : null;
  const currentPoh = latestLog?.power_on_hours ?? detail?.initial_power_on_hours ?? 0;
  const currentPoc = latestLog?.power_on_count ?? detail?.initial_power_on_count ?? 0;
  const initialPoh = detail?.initial_power_on_hours || 0;
  const initialPoc = detail?.initial_power_on_count || 0;
  const hoursWear = currentPoh > initialPoh ? currentPoh - initialPoh : 0;

  const capDisplay = detail
    ? detail.capacity_gb >= 1000
      ? `${(detail.capacity_gb / 1000).toFixed(detail.capacity_gb % 1000 === 0 ? 0 : 1)} TB`
      : `${detail.capacity_gb} GB`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl my-6 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/95 sticky top-0 z-20">
          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 text-sm font-bold tracking-wider rounded-lg bg-sky-950 text-sky-400 border border-sky-800 font-mono shadow-sm">
              {detail?.custom_id || 'DRV'}
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white truncate max-w-md">
                  {detail?.model || 'Loading drive...'}
                </h2>
                <span className="text-sm font-bold text-sky-400 font-mono">
                  {capDisplay}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                <span>S/N: {detail?.serial_number}</span>
                <button
                  onClick={handleCopySerial}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                  title="Copy serial number"
                >
                  {copiedSerial ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <CopyIcon />}
                </button>
                <span>•</span>
                <span>{detail?.form_factor}</span>
                <span>•</span>
                <span>{detail?.interface}</span>
                {detail?.manufacture_date && (
                  <>
                    <span>•</span>
                    <span className="text-amber-400 font-medium">DOM: {detail.manufacture_date}</span>
                    {detail.age_info && (
                      <span className="text-slate-300">({detail.age_info.formattedAge})</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick top actions */}
          <div className="flex items-center space-x-2">
            {detail && onPrintLabel && (
              <button
                id="btn-print-from-detail"
                onClick={() => onPrintLabel(detail)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm transition-colors"
                title="Print Caddy / Bay Label"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Print Label</span>
              </button>
            )}

            {detail && (
              <button
                onClick={() => onOpenQuickLog(detail)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add SMART Log</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-6 border-b border-slate-800 bg-slate-900/60 text-xs font-medium space-x-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 border-b-2 font-semibold transition-colors flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Overview & Specs</span>
          </button>

          <button
            onClick={() => setActiveTab('trends')}
            className={`px-4 py-3 border-b-2 font-semibold transition-colors flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'trends'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Health Trends & Graphs</span>
            {chartData.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono text-slate-400">
                {chartData.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-3 border-b-2 font-semibold transition-colors flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'logs'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>SMART Logs History</span>
            {detail?.logs && detail.logs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono text-slate-400">
                {detail.logs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('receipts')}
            className={`px-4 py-3 border-b-2 font-semibold transition-colors flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'receipts'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Receipts & Documents</span>
            {detail?.receipts && detail.receipts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/80 text-[10px] font-mono">
                {detail.receipts.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
              <span>Loading drive details...</span>
            </div>
          ) : detail ? (
            <>
              {/* TAB 1: OVERVIEW & SPECS */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Latest Telemetry snapshot */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">
                        Health Status
                      </span>
                      <div className="flex items-center space-x-1.5 mt-1">
                        {latestLog?.health_status === 'Caution' ? (
                          <span className="text-amber-400 font-bold text-base flex items-center space-x-1">
                            <AlertTriangle className="w-4 h-4" />
                            <span>Caution</span>
                          </span>
                        ) : latestLog?.health_status === 'Bad' ? (
                          <span className="text-rose-400 font-bold text-base flex items-center space-x-1">
                            <AlertTriangle className="w-4 h-4" />
                            <span>Bad / Failing</span>
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold text-base flex items-center space-x-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Good {latestLog?.health_percentage ? `(${latestLog.health_percentage}%)` : ''}</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                        {latestLog ? `Reported: ${latestLog.log_date}` : 'No reports yet'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">
                        Temperature
                      </span>
                      <div className="text-base font-bold text-slate-200 mt-1 font-mono">
                        {latestLog?.temperature_c ? (
                          <span className={latestLog.temperature_c > 48 ? 'text-rose-400' : latestLog.temperature_c > 40 ? 'text-amber-400' : 'text-emerald-400'}>
                            {latestLog.temperature_c}°C <span className="text-xs text-slate-400 font-normal">({latestLog.temperature_f}°F)</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">
                        {latestLog?.temperature_c && latestLog.temperature_c <= 42 ? 'Normal thermal range' : 'Operating temp'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">
                        Total Power-On Hours
                      </span>
                      <div className="text-base font-bold text-white mt-1 font-mono">
                        {currentPoh.toLocaleString()} hrs
                      </div>
                      <span className="text-[11px] text-sky-400 font-mono mt-0.5 block">
                        +{hoursWear.toLocaleString()}h since initial snapshot
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">
                        Power Cycle Count
                      </span>
                      <div className="text-base font-bold text-white mt-1 font-mono">
                        {currentPoc} count
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                        Initial baseline: {initialPoc} count
                      </span>
                    </div>
                  </div>

                  {/* Section A: Active Mechanical Runtime & Bathtub Curve (Strictly Power-On Hours) */}
                  <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-4">
                    {(() => {
                      const runtimeWear: RuntimeWearInfo = detail.risk_assessment?.runtimeWear || {
                        poh: currentPoh,
                        equivalent247Years: +(currentPoh / 8760).toFixed(1),
                        phase: currentPoh < 2000 ? 'burn_in' : currentPoh <= 30000 ? 'prime' : currentPoh <= 43800 ? 'mature' : 'wear_out',
                        phaseLabel: currentPoh < 2000 ? 'Infant / Burn-in' : currentPoh <= 30000 ? 'Prime Operating' : currentPoh <= 43800 ? 'Mature Wear' : 'Wear-out Zone',
                        progressPercent: Math.min(100, Math.round((currentPoh / 43800) * 100)),
                        description: `Drive has logged ${currentPoh.toLocaleString()} power-on hours.`
                      };

                      return (
                        <>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center space-x-1.5">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                <span>Active Mechanical Runtime &amp; Bathtub Curve</span>
                              </h3>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Position on the empirical hardware reliability curve, measured strictly from verified SMART Power-On Hours (POH).
                              </p>
                            </div>

                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                                  runtimeWear.phase === 'wear_out'
                                    ? 'bg-rose-950/90 text-rose-300 border-rose-800'
                                    : runtimeWear.phase === 'mature'
                                    ? 'bg-amber-950/90 text-amber-300 border-amber-800'
                                    : runtimeWear.phase === 'burn_in'
                                    ? 'bg-sky-950/90 text-sky-300 border-sky-800'
                                    : 'bg-emerald-950/90 text-emerald-300 border-emerald-800'
                                }`}
                              >
                                {runtimeWear.phaseLabel.toUpperCase()} ({runtimeWear.phase === 'prime' ? 'OPTIMAL' : runtimeWear.phase === 'wear_out' ? 'HIGH WEAR' : 'EVALUATE'})
                              </span>
                            </div>
                          </div>

                          {/* 4-Stat Runtime Breakdown */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-700/60">
                              <span className="text-slate-500 block text-[10px] uppercase font-sans">Active Spindle Hours</span>
                              <span className="text-emerald-400 font-bold text-sm mt-0.5 block">
                                {currentPoh.toLocaleString()} hrs
                              </span>
                              <span className="text-[10px] text-slate-400 mt-0.5 block font-sans">
                                SMART power-on telemetry
                              </span>
                            </div>

                            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-700/60">
                              <span className="text-slate-500 block text-[10px] uppercase font-sans">Continuous 24/7 Equivalent</span>
                              <span className="text-white font-bold text-sm mt-0.5 block">
                                {runtimeWear.equivalent247Years} yrs
                              </span>
                              <span className="text-[10px] text-slate-400 mt-0.5 block font-sans">
                                Non-stop spinning equiv
                              </span>
                            </div>

                            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-700/60">
                              <span className="text-slate-500 block text-[10px] uppercase font-sans">Power Cycle Count</span>
                              <span className="text-sky-300 font-bold text-sm mt-0.5 block">
                                {currentPoc} count
                              </span>
                              <span className="text-[10px] text-slate-400 mt-0.5 block font-sans">
                                Start/stop mechanical events
                              </span>
                            </div>

                            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-700/60">
                              <span className="text-slate-500 block text-[10px] uppercase font-sans">Spindle Lifecycle Phase</span>
                              <span className="text-emerald-300 font-bold text-sm mt-0.5 block truncate" title={runtimeWear.phaseLabel}>
                                {runtimeWear.phaseLabel}
                              </span>
                              <span className="text-[10px] text-slate-400 mt-0.5 block font-sans">
                                {runtimeWear.phase === 'prime' ? 'Lowest AFR (~0.8-1.2%)' : runtimeWear.phase === 'burn_in' ? 'Early burn-in (~2-3%)' : runtimeWear.phase === 'mature' ? 'Mature wear (~1.5-2.5%)' : 'Accelerated AFR (>5%)'}
                              </span>
                            </div>
                          </div>

                          {/* Visual Bathtub Curve Track */}
                          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/70 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-300 font-semibold flex items-center space-x-1.5">
                                <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                                <span>Spindle Wear Progress Along Bathtub Baseline (5-Yr 24/7 = 43,800 POH)</span>
                              </span>
                              <span className="text-sky-400 font-mono text-[11px]">
                                {runtimeWear.progressPercent}% of 5-Yr Continuous Baseline
                              </span>
                            </div>

                            <div className="relative pt-2 pb-1">
                              {/* Track Zones */}
                              <div className="h-3.5 rounded-full overflow-hidden flex w-full bg-slate-950 border border-slate-800">
                                <div
                                  style={{ width: '10%' }}
                                  className="bg-sky-500/30 border-r border-slate-900"
                                  title="Infant / Burn-in (< 2,000 hrs / 0.2 yr)"
                                />
                                <div
                                  style={{ width: '60%' }}
                                  className="bg-emerald-500/30 border-r border-slate-900"
                                  title="Prime Operating Phase (Lowest Failure Rate: 2,000 - 30,000 hrs / 3.4 yrs)"
                                />
                                <div
                                  style={{ width: '18%' }}
                                  className="bg-amber-500/30 border-r border-slate-900"
                                  title="Mature Phase (Wear onset: 30,000 - 43,800 hrs / 5 yrs)"
                                />
                                <div
                                  style={{ width: '12%' }}
                                  className="bg-rose-500/30"
                                  title="Wear-out Zone (Elevated Failure Rate: > 43,800 hrs continuous)"
                                />
                              </div>

                              {/* Position Needle / Indicator */}
                              <div
                                className="absolute top-1 -translate-x-1/2 flex flex-col items-center transition-all pointer-events-none"
                                style={{ left: `${Math.max(2, Math.min(98, runtimeWear.progressPercent))}%` }}
                              >
                                <div className="w-3.5 h-3.5 rounded-full bg-sky-400 border-2 border-white shadow-md shadow-sky-500/50 animate-pulse" />
                                <div className="w-0.5 h-4 bg-sky-400/80" />
                              </div>
                            </div>

                            {/* Zone Labels */}
                            <div className="grid grid-cols-4 text-[10px] text-slate-400 font-mono text-center pt-1 border-t border-slate-800/80">
                              <div>
                                <span className="text-sky-300 font-semibold block">Infant / Burn-in</span>
                                <span className="text-slate-500">&lt; 2,000 POH</span>
                              </div>
                              <div>
                                <span className="text-emerald-300 font-semibold block">Prime Operating</span>
                                <span className="text-slate-500">2k – 30k POH</span>
                              </div>
                              <div>
                                <span className="text-amber-300 font-semibold block">Mature Wear</span>
                                <span className="text-slate-500">30k – 43.8k POH</span>
                              </div>
                              <div>
                                <span className="text-rose-300 font-semibold block">Wear-Out Zone</span>
                                <span className="text-slate-500">&gt; 43.8k POH</span>
                              </div>
                            </div>
                          </div>

                          {/* Runtime Wear Status Assessment */}
                          <div
                            className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start space-x-3 ${
                              runtimeWear.phase === 'wear_out'
                                ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                                : runtimeWear.phase === 'mature'
                                ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                                : runtimeWear.phase === 'burn_in'
                                ? 'bg-sky-950/40 border-sky-800/80 text-sky-200'
                                : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {runtimeWear.phase === 'wear_out' ? (
                                <AlertTriangle className="w-4 h-4 text-rose-400" />
                              ) : runtimeWear.phase === 'mature' ? (
                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              )}
                            </div>
                            <div>
                              <span className="font-bold block mb-0.5">
                                {runtimeWear.phase === 'prime'
                                  ? `Optimal Reliability: ${currentPoh.toLocaleString()} POH (~${runtimeWear.equivalent247Years} yr 24/7 equivalent)`
                                  : runtimeWear.phase === 'burn_in'
                                  ? `Infant Stage: ${currentPoh.toLocaleString()} POH`
                                  : runtimeWear.phase === 'mature'
                                  ? `Mature Operating Phase: ${currentPoh.toLocaleString()} POH`
                                  : `Spindle Wear-out Zone: ${currentPoh.toLocaleString()} POH`}
                              </span>
                              <span className="text-slate-300">
                                {runtimeWear.description}
                              </span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Section B: Calendar Shelf Age & Duty Cycle (Strictly Manufacture Date / DOM) */}
                  <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center space-x-1.5">
                          <Calendar className="w-4 h-4 text-amber-400" />
                          <span>Calendar Shelf Age &amp; Operational Duty Cycle</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Calculated from the Date of Manufacture (DOM) printed on the physical drive chassis label.
                        </p>
                      </div>

                      {detail.manufacture_date && (
                        <button
                          id="edit-dom-btn"
                          type="button"
                          onClick={() => setIsQuickDomOpen(true)}
                          className="px-2.5 py-1 text-xs rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors flex items-center space-x-1 self-start sm:self-auto"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit DOM</span>
                        </button>
                      )}
                    </div>

                    {detail.manufacture_date && detail.age_info ? (
                      <div className="space-y-4">
                        {/* 4-Stat breakdown */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-700/60">
                            <span className="text-slate-500 block text-[10px] uppercase font-sans">Manufacture Date (DOM)</span>
                            <span className="text-amber-400 font-bold text-sm mt-0.5 block">
                              {detail.manufacture_date}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5 block font-sans">
                              Physical chassis label
                            </span>
                          </div>

                          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-700/60">
                            <span className="text-slate-500 block text-[10px] uppercase font-sans">Physical Calendar Age</span>
                            <span className="text-white font-bold text-sm mt-0.5 block">
                              {detail.age_info.formattedAge}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5 block font-sans">
                              {detail.age_info.ageYears} calendar years
                            </span>
                          </div>

                          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-700/60">
                            <span className="text-slate-500 block text-[10px] uppercase font-sans">Active Duty Cycle</span>
                            <span className="text-sky-300 font-bold text-sm mt-0.5 block">
                              {detail.age_info.dutyCyclePercent}% Active
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5 block font-sans">
                              {currentPoh.toLocaleString()}h / {detail.age_info.totalCalendarHours.toLocaleString()}h cal life
                            </span>
                          </div>

                          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-700/60">
                            <span className="text-slate-500 block text-[10px] uppercase font-sans">Operational Profile</span>
                            <span className="text-emerald-300 font-bold text-sm mt-0.5 block truncate" title={detail.age_info.shelfProfile || 'Active'}>
                              {detail.age_info.shelfProfile || 'Standard Operation'}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5 block font-sans">
                              Duty cycle profile
                            </span>
                          </div>
                        </div>

                        {/* Shelf Advice Callout Banner */}
                        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs leading-relaxed flex items-start space-x-3">
                          <CheckCircle2 className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <span className="font-bold text-white block">
                              Storage &amp; Duty Cycle Insight:
                            </span>
                            <p className="text-slate-300">
                              {detail.age_info.shelfAdvice || 'Calendar age and power-on runtime are tracked independently.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-xs text-slate-300">
                          <p className="font-semibold text-white mb-0.5">Manufacture Date (DOM) Not Recorded</p>
                          <p className="text-slate-400">
                            Enter the Date of Manufacture printed on the drive's physical sticker (e.g. &ldquo;DOM: 21DEC2019&rdquo;) to calculate exact physical age and duty cycle without conflating calendar age with spindle hours.
                          </p>
                        </div>
                        <button
                          id="set-dom-btn"
                          type="button"
                          onClick={() => setIsQuickDomOpen(true)}
                          className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold text-xs transition-colors shrink-0 flex items-center space-x-1.5"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Set Manufacture Date</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Section: Purchase & Warranty Tracking */}
                  <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-4">
                    <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Shield className="w-4 h-4" />
                      <span>Purchase & Warranty Information</span>
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Vendor / Retailer</span>
                        <span className="text-white font-semibold text-sm mt-0.5 block">
                          {detail.vendor || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Purchase Date</span>
                        <span className="text-slate-200 text-sm mt-0.5 block">
                          {detail.purchase_date || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Order Number</span>
                        <span className="text-sky-300 font-semibold text-sm mt-0.5 block truncate" title={detail.order_number || ''}>
                          {detail.order_number || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Purchase Price</span>
                        <span className="text-slate-200 text-sm mt-0.5 block">
                          {detail.purchase_price ? `$${detail.purchase_price.toFixed(2)} ${detail.currency || 'USD'}` : '—'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-mono">Warranty Period</span>
                        <span className="text-white font-semibold mt-0.5 block">
                          {detail.warranty_months ? `${detail.warranty_months} months (${(detail.warranty_months / 12).toFixed(1)} yrs)` : 'None'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-mono">Warranty Expiration</span>
                        <span className="text-sky-400 font-bold mt-0.5 block font-mono">
                          {detail.warranty_expires || 'Not specified'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-mono">Coverage Status</span>
                        <div className="mt-1">
                          {detail.warranty_info?.status === 'active' ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-xs font-mono font-semibold">
                              {detail.warranty_info.label}
                            </span>
                          ) : detail.warranty_info?.status === 'expiring_soon' ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800 text-xs font-mono font-semibold">
                              {detail.warranty_info.label}
                            </span>
                          ) : detail.warranty_info?.status === 'expired' ? (
                            <span className="px-2.5 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800 text-xs font-mono font-semibold">
                              {detail.warranty_info.label}
                            </span>
                          ) : (
                            <span className="text-slate-500">No active warranty</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Initial State Snapshot vs Current Wear */}
                  <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-3">
                    <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Clock className="w-4 h-4" />
                      <span>Initial State Snapshot & Wear Progression</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Tracks initial condition logged when first delivered or shucked versus lifetime accumulated hours under your ownership.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                      <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-700/60 text-xs font-mono">
                        <span className="text-slate-500 block text-[10px] uppercase">Baseline at Delivery</span>
                        <div className="text-sm font-semibold text-slate-200 mt-1">
                          {initialPoh.toLocaleString()} hrs • {initialPoc} cycles
                        </div>
                        <span className="text-[11px] text-slate-500 mt-0.5 block">
                          {initialPoh === 0 ? 'Brand new retail drive' : 'Recertified / Shucked baseline'}
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-700/60 text-xs font-mono">
                        <span className="text-slate-500 block text-[10px] uppercase">Current Lifetime Wear</span>
                        <div className="text-sm font-semibold text-white mt-1">
                          {currentPoh.toLocaleString()} hrs • {currentPoc} cycles
                        </div>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          From latest CrystalDiskInfo report
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-sky-950/40 border border-sky-800/60 text-xs font-mono">
                        <span className="text-sky-400 block text-[10px] uppercase font-bold">Hours Added Under Ownership</span>
                        <div className="text-sm font-bold text-sky-300 mt-1">
                          +{hoursWear.toLocaleString()} hours
                        </div>
                        <span className="text-[11px] text-sky-400/80 mt-0.5 block">
                          {(hoursWear / 24).toFixed(0)} days running time
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section: Notes & Location */}
                  {(detail.notes || detail.location || detail.usable_capacity_gb !== undefined) && (
                    <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-3">
                      <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center space-x-1.5">
                        <HardDrive className="w-4 h-4 text-sky-400" />
                        <span>Inventory & Physical Specifications</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                        {detail.location && (
                          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-700/60">
                            <span className="text-slate-500 block text-[10px] uppercase font-sans">Physical Location</span>
                            <span className="text-white font-bold text-sm mt-0.5 block">
                              {detail.location}
                            </span>
                          </div>
                        )}
                        {detail.usable_capacity_gb && (
                          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-700/60">
                            <span className="text-slate-500 block text-[10px] uppercase font-sans">Usable Capacity</span>
                            <span className="text-sky-300 font-bold text-sm mt-0.5 block">
                              {detail.usable_capacity_gb >= 1000 
                                ? `${(detail.usable_capacity_gb / 1000).toFixed(detail.usable_capacity_gb % 1000 === 0 ? 0 : 1)} TB`
                                : `${detail.usable_capacity_gb} GB`}
                            </span>
                          </div>
                        )}
                        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-700/60">
                          <span className="text-slate-500 block text-[10px] uppercase font-sans">Status / Availability</span>
                          <span className={`font-bold text-sm mt-0.5 block ${detail.status === 'Replaced' ? 'text-purple-400' : 'text-emerald-400'}`}>
                            {detail.status || 'Active'}
                          </span>
                        </div>
                      </div>
                      {detail.notes && (
                        <div className="pt-2 border-t border-slate-700/60">
                          <span className="text-[10px] uppercase font-sans font-semibold text-slate-400 tracking-wider block mb-1">
                            Physical Notes & Info
                          </span>
                          <p className="text-xs text-slate-300 leading-relaxed font-mono">
                            {detail.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer Action Bar */}
                  <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      {showDeleteConfirm ? (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-rose-400 font-medium">Permanently delete drive & files?</span>
                          <button
                            onClick={handleDeleteDrive}
                            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                          >
                            Yes, Delete
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="flex items-center space-x-1 text-xs text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Drive</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center space-x-3">
                      {detail && onPrintLabel && (
                        <button
                          id="btn-print-from-detail-footer"
                          onClick={() => onPrintLabel(detail)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Print Label</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onEdit(detail);
                          onClose();
                        }}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Hardware Specs</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: HEALTH TRENDS & GRAPHS */}
              {activeTab === 'trends' && (
                <div className="space-y-6">
                  {chartData.length < 2 ? (
                    <div className="p-8 text-center rounded-xl bg-slate-800/50 border border-slate-700/60">
                      <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <h4 className="text-sm font-semibold text-slate-200">More Log Entries Needed for Graphs</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
                        You have {chartData.length} CrystalDiskInfo log. As you append monthly or quarterly reports, interactive temperature and Power-On Hours progression charts will appear here.
                      </p>
                      <button
                        onClick={() => onOpenQuickLog(detail)}
                        className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 inline-flex items-center space-x-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Paste Another CrystalDisk Report</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Temperature Trend Chart */}
                      <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                              <Thermometer className="w-4 h-4 text-emerald-400" />
                              <span>Operating Temperature History (°C)</span>
                            </h4>
                            <p className="text-xs text-slate-400">
                              Logged temperatures from CrystalDiskInfo scans over time
                            </p>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800 font-mono">
                            Safe threshold &lt;45°C
                          </span>
                        </div>

                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                              <YAxis stroke="#94a3b8" fontSize={11} domain={['dataMin - 5', 'dataMax + 5']} unit="°C" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#0f172a',
                                  borderColor: '#334155',
                                  borderRadius: '8px',
                                  fontSize: '12px'
                                }}
                              />
                              <ReferenceLine y={45} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Warning 45°C', fill: '#f59e0b', fontSize: 10 }} />
                              <Line
                                type="monotone"
                                dataKey="temperature"
                                stroke="#38bdf8"
                                strokeWidth={2.5}
                                dot={{ fill: '#38bdf8', r: 4 }}
                                activeDot={{ r: 6 }}
                                name="Temp (°C)"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Power-On Hours Progression */}
                      <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-sky-400" />
                              <span>Power-On Hours Progression</span>
                            </h4>
                            <p className="text-xs text-slate-400">
                              Cumulative operating hours logged across time
                            </p>
                          </div>
                        </div>

                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorPoh" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                              <YAxis stroke="#94a3b8" fontSize={11} unit="h" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#0f172a',
                                  borderColor: '#334155',
                                  borderRadius: '8px',
                                  fontSize: '12px'
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="poh"
                                stroke="#38bdf8"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorPoh)"
                                name="Power-On Hours"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: SMART LOGS HISTORY */}
              {activeTab === 'logs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Historical CrystalDiskInfo Logs ({detail.logs.length})
                    </span>
                    <button
                      onClick={() => onOpenQuickLog(detail)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Paste New Report</span>
                    </button>
                  </div>

                  {detail.logs.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800/40 rounded-xl border border-slate-700/50">
                      <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-300">No SMART logs recorded yet</p>
                      <p className="text-xs text-slate-500 mt-1 mb-4">Paste raw text from CrystalDiskInfo to start logging health.</p>
                      <button
                        onClick={() => onOpenQuickLog(detail)}
                        className="px-3.5 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold"
                      >
                        Paste CrystalDiskInfo
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {detail.logs.map((log) => {
                        const isExpanded = expandedLogId === log.id;
                        return (
                          <div
                            key={log.id}
                            className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                {/* Health status */}
                                {log.health_status === 'Caution' ? (
                                  <span className="p-2 rounded-lg bg-amber-950/80 border border-amber-800 text-amber-400">
                                    <AlertTriangle className="w-4 h-4" />
                                  </span>
                                ) : log.health_status === 'Bad' ? (
                                  <span className="p-2 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-400">
                                    <AlertTriangle className="w-4 h-4" />
                                  </span>
                                ) : (
                                  <span className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-400">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </span>
                                )}

                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-bold text-white font-mono">
                                      {log.log_date}
                                    </span>
                                    <span className="text-xs font-semibold text-emerald-400 font-mono">
                                      {log.health_status} {log.health_percentage ? `(${log.health_percentage}%)` : ''}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono mt-0.5">
                                    <span>Temp: {log.temperature_c ? `${log.temperature_c}°C (${log.temperature_f}°F)` : '—'}</span>
                                    <span>•</span>
                                    <span>POH: {log.power_on_hours?.toLocaleString()} hrs</span>
                                    <span>•</span>
                                    <span>Cycles: {log.power_on_count}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-700/70 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center space-x-1"
                                >
                                  <span>{isExpanded ? 'Hide Details' : 'View SMART Table'}</span>
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteLog(log.id)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                                  title="Delete log"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {log.log_notes && (
                              <p className="text-xs text-slate-400 bg-slate-900/60 p-2 rounded mt-2.5 border border-slate-700/40">
                                Note: {log.log_notes}
                              </p>
                            )}

                            {/* Expanded SMART attributes table & raw text */}
                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t border-slate-700 space-y-4">
                                {log.smart_attributes && log.smart_attributes.length > 0 ? (
                                  <div>
                                    <h5 className="text-xs font-semibold text-slate-300 mb-2">
                                      Parsed S.M.A.R.T. Attribute Table
                                    </h5>
                                    <div className="overflow-x-auto rounded-lg border border-slate-700">
                                      <table className="w-full text-left text-xs font-mono">
                                        <thead className="bg-slate-900 text-slate-400 border-b border-slate-700">
                                          <tr>
                                            <th className="py-2 px-3">ID</th>
                                            <th className="py-2 px-3">Attribute Name</th>
                                            <th className="py-2 px-3">Cur</th>
                                            <th className="py-2 px-3">Wor</th>
                                            <th className="py-2 px-3">Thr</th>
                                            <th className="py-2 px-3">Raw Value</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800 bg-slate-950/60">
                                          {log.smart_attributes.map((attr, idx) => (
                                            <tr
                                              key={idx}
                                              className={attr.isWarning ? 'bg-amber-950/40 text-amber-200' : 'text-slate-300'}
                                            >
                                              <td className="py-1.5 px-3 font-semibold">{attr.id}</td>
                                              <td className="py-1.5 px-3">{attr.name}</td>
                                              <td className="py-1.5 px-3">{attr.current}</td>
                                              <td className="py-1.5 px-3">{attr.worst}</td>
                                              <td className="py-1.5 px-3">{attr.threshold}</td>
                                              <td className="py-1.5 px-3">{attr.rawValue}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-500 italic">
                                    No granular SMART attribute table was pasted for this entry.
                                  </p>
                                )}

                                {log.raw_crystal_text && (
                                  <div>
                                    <h5 className="text-xs font-semibold text-slate-300 mb-1">
                                      Raw CrystalDiskInfo Text
                                    </h5>
                                    <pre className="p-3 bg-slate-950 rounded-lg text-[11px] font-mono text-slate-400 overflow-x-auto max-h-48 border border-slate-800">
                                      {log.raw_crystal_text}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: RECEIPTS & DOCUMENTS */}
              {activeTab === 'receipts' && (
                <div className="space-y-6">
                  {/* Upload Form */}
                  <form onSubmit={handleFileUpload} className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-3">
                    <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Upload className="w-4 h-4" />
                      <span>Upload Invoice or Receipt Document</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Upload PDF invoices or photos of physical receipts. Saved directly to server storage and linked to this drive.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Document Label (Optional)
                        </label>
                        <input
                          type="text"
                          value={uploadLabel}
                          onChange={(e) => setUploadLabel(e.target.value)}
                          placeholder="e.g. ServerPartDeals Order Invoice"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          File (PDF, PNG, JPG, WEBP)
                        </label>
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept=".pdf,image/*"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={!selectedFile || uploading}
                        className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-50"
                      >
                        {uploading ? 'Uploading...' : 'Save Document to Drive'}
                      </button>
                    </div>
                  </form>

                  {/* Attached Documents List */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 mb-3">
                      Attached Documents ({detail.receipts.length})
                    </h4>

                    {detail.receipts.length === 0 ? (
                      <div className="text-center py-12 bg-slate-800/40 rounded-xl border border-slate-700/50">
                        <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-300">No documents attached yet</p>
                        <p className="text-xs text-slate-500 mt-1">Upload your purchase receipts above for 1-click warranty claims.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {detail.receipts.map((rec) => (
                          <div
                            key={rec.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-slate-800/90 border border-slate-700/80 hover:border-slate-600 transition-colors"
                          >
                            <div className="flex items-center space-x-3 overflow-hidden">
                              <div className="p-2 rounded-lg bg-indigo-950 text-indigo-400 shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="truncate">
                                <h5 className="text-xs font-semibold text-white truncate" title={rec.label || rec.original_name}>
                                  {rec.label || rec.original_name}
                                </h5>
                                <span className="text-[11px] text-slate-400 font-mono block truncate">
                                  {(rec.file_size / 1024).toFixed(1)} KB • {new Date(rec.uploaded_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-1 ml-2 shrink-0">
                              <button
                                onClick={() => onViewReceipt(rec)}
                                className="px-2.5 py-1 rounded bg-sky-950 hover:bg-sky-900 text-sky-400 border border-sky-800/80 text-xs font-medium flex items-center space-x-1"
                              >
                                <span>Preview</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteReceipt(rec.id)}
                                className="p-1 rounded hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 transition-colors"
                                title="Delete document"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Quick Set Manufacture Date Modal (stacked in front at z-[80]) */}
      <QuickSetDomModal
        isOpen={isQuickDomOpen}
        onClose={() => setIsQuickDomOpen(false)}
        drive={detail}
        onSaved={(upd) => {
          setDetail((prev) => (prev ? { ...prev, ...upd } : null));
          loadData();
        }}
      />
    </div>
  );
};

function CopyIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}
