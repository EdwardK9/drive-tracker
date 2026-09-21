import React, { useState, useEffect } from 'react';
import { X, FileText, CheckCircle2, AlertTriangle, XCircle, Thermometer, Clock, RefreshCw, Plus, Sparkles, ArrowRight } from 'lucide-react';
import { Drive, ParsedCrystalDiskInfo } from '../types';
import { parseCrystalDiskInfoText, addCrystalDiskLog } from '../api';

interface CrystalDiskParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  drives: Drive[];
  preselectedDrive?: Drive | null;
  onSuccess: (updatedDriveId: string) => void;
  onCreateDriveFromReport: (parsed: ParsedCrystalDiskInfo) => void;
}

const SAMPLE_HDD_REPORT = `----------------------------------------------------------------------------
CrystalDiskInfo 9.2.3 (C) 2008-2024 hiyohiyo
----------------------------------------------------------------------------
           Model : ST18000NM000J-2TV103
        Firmware : SN02
   Serial Number : ZR50ABCD
       Interface : Serial ATA
   Transfer Mode : SATA/600 | SATA/600
Power On Hours : 15820 hours
Power On Count : 35 count
    Temperature : 36 C (96 F)
   Health Status : Good
-- S.M.A.R.T. --------------------------------------------------------------
ID Cur Wor Thr RawValues(6) Attribute Name
01  82  64  44 000008E125D8 Read Error Rate
05 100 100  10 000000000000 Reallocated Sectors Count
07  88  60  45 000024A105B8 Seek Error Rate
09  84  84 --- 000000003DCC Power-On Hours
0C 100 100 --- 000000000023 Power Cycle Count
C5 100 100 --- 000000000000 Current Pending Sector Count
C6 100 100 --- 000000000000 Offline Uncorrectable Sector Count
C7 200 200 --- 000000000000 UltraDMA CRC Error Count`;

const SAMPLE_NVME_REPORT = `----------------------------------------------------------------------------
           Model : Samsung SSD 990 PRO 2TB
        Firmware : 4B2QJXD7
   Serial Number : S73WNJ0W918230
       Interface : NVM Express
   Transfer Mode : PCIe 4.0 x4 | PCIe 4.0 x4
Power On Hours : 9120 hours
Power On Count : 58 count
Host Reads : 38900 GB
Host Writes : 32100 GB
   Temperature : 43 C (109 F)
   Health Status : Good (99 %)`;

const SAMPLE_CAUTION_REPORT = `----------------------------------------------------------------------------
           Model : WDC WD40EFRX-68N32N0
        Firmware : 82.00A82
   Serial Number : WD-WCC7K1293847
       Interface : Serial ATA
   Transfer Mode : SATA/600 | SATA/600
Power On Hours : 38410 hours
Power On Count : 92 count
    Temperature : 41 C (105 F)
   Health Status : Caution
-- S.M.A.R.T. --------------------------------------------------------------
ID Cur Wor Thr RawValues(6) Attribute Name
05 198 198  140 000000000008 Reallocated Sectors Count
C5 195 195  --- 000000000004 Current Pending Sector Count
C6 200 200  --- 000000000000 Offline Uncorrectable Sector Count`;

export const CrystalDiskParserModal: React.FC<CrystalDiskParserModalProps> = ({
  isOpen,
  onClose,
  drives,
  preselectedDrive,
  onSuccess,
  onCreateDriveFromReport
}) => {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedCrystalDiskInfo | null>(null);
  const [matchedDrive, setMatchedDrive] = useState<Drive | null>(null);
  const [selectedDriveId, setSelectedDriveId] = useState<string>('');
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [logNotes, setLogNotes] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedDrive) {
      setSelectedDriveId(preselectedDrive.id);
    } else if (drives.length > 0 && !selectedDriveId) {
      setSelectedDriveId(drives[0].id);
    }
  }, [preselectedDrive, drives]);

  // Debounced live parse
  useEffect(() => {
    if (!rawText.trim()) {
      setParsed(null);
      setMatchedDrive(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsParsing(true);
      try {
        const res = await parseCrystalDiskInfoText(rawText);
        setParsed(res.parsed);
        if (res.matchedDrive) {
          setMatchedDrive(res.matchedDrive);
          setSelectedDriveId(res.matchedDrive.id);
        }
      } catch (err) {
        console.error('Parse error:', err);
      } finally {
        setIsParsing(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [rawText]);

  if (!isOpen) return null;

  const handleSaveLog = async () => {
    if (!selectedDriveId) {
      setError('Please select a target drive to append this log to.');
      return;
    }
    if (!parsed) {
      setError('No parsed metrics found. Please paste CrystalDiskInfo output.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await addCrystalDiskLog(selectedDriveId, {
        log_date: logDate,
        health_status: parsed.healthStatus || 'Good',
        health_percentage: parsed.healthPercentage ?? null,
        temperature_c: parsed.temperatureC ?? null,
        temperature_f: parsed.temperatureF ?? null,
        power_on_hours: parsed.powerOnHours ?? null,
        power_on_count: parsed.powerOnCount ?? null,
        host_reads_gb: parsed.hostReadsGB ?? null,
        host_writes_gb: parsed.hostWritesGB ?? null,
        transfer_mode: parsed.transferMode ?? null,
        raw_crystal_text: rawText,
        smart_attributes: parsed.smartAttributes,
        log_notes: logNotes.trim() || null
      });

      onSuccess(selectedDriveId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save log entry');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl my-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-sky-950 border border-sky-800 text-sky-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">CrystalDiskInfo SMART Parser</h2>
              <p className="text-xs text-slate-400">
                Paste raw text from CrystalDiskInfo to automatically extract SMART metrics and history
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

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="flex items-center space-x-2 p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick sample chips */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">
              Raw CrystalDiskInfo Output
            </label>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-500">Try sample:</span>
              <button
                type="button"
                onClick={() => setRawText(SAMPLE_HDD_REPORT)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                18TB HDD
              </button>
              <button
                type="button"
                onClick={() => setRawText(SAMPLE_NVME_REPORT)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                NVMe SSD
              </button>
              <button
                type="button"
                onClick={() => setRawText(SAMPLE_CAUTION_REPORT)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-amber-900/50 text-amber-300 border border-amber-800/60 transition-colors"
              >
                Caution / Warning
              </button>
            </div>
          </div>

          {/* Textarea */}
          <div className="relative">
            <textarea
              rows={7}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw text directly from CrystalDiskInfo (Ctrl+V or Edit -> Copy)..."
              className="w-full px-3.5 py-3 bg-slate-950/90 border border-slate-700 rounded-xl text-slate-200 text-xs font-mono focus:outline-none focus:border-sky-500 leading-relaxed resize-y"
            />
            {isParsing && (
              <div className="absolute top-3 right-3 flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-800/90 text-sky-400 text-xs border border-slate-700">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Parsing...</span>
              </div>
            )}
          </div>

          {/* Real-time regex extraction preview */}
          {parsed && (
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Extracted SMART Metrics
                  </span>
                </div>

                {/* Health Badge */}
                <div>
                  {parsed.healthStatus === 'Caution' ? (
                    <span className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-amber-950 text-amber-300 border border-amber-800 text-xs font-bold font-mono">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Caution {parsed.healthPercentage ? `(${parsed.healthPercentage}%)` : ''}</span>
                    </span>
                  ) : parsed.healthStatus === 'Bad' ? (
                    <span className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold font-mono">
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Bad / Critical</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Good {parsed.healthPercentage ? `(${parsed.healthPercentage}%)` : ''}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Hardware & Identity details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-700/40">
                  <span className="text-slate-400 block text-[10px] uppercase">Model</span>
                  <span className="text-white font-semibold truncate block mt-0.5" title={parsed.model}>
                    {parsed.model || 'Unknown'}
                  </span>
                </div>

                <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-700/40">
                  <span className="text-slate-400 block text-[10px] uppercase">Serial Number</span>
                  <span className="text-sky-400 font-semibold truncate block mt-0.5">
                    {parsed.serialNumber || 'Not detected'}
                  </span>
                </div>

                <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-700/40">
                  <span className="text-slate-400 block text-[10px] uppercase">Temperature</span>
                  <span className="text-white font-semibold block mt-0.5">
                    {parsed.temperatureC ? `${parsed.temperatureC}°C (${parsed.temperatureF}°F)` : '—'}
                  </span>
                </div>

                <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-700/40">
                  <span className="text-slate-400 block text-[10px] uppercase">Power-On Hours</span>
                  <span className="text-white font-semibold block mt-0.5">
                    {parsed.powerOnHours ? `${parsed.powerOnHours.toLocaleString()} hrs` : '—'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-700/40">
                  <span className="text-slate-400 block text-[10px] uppercase">Power-On Count</span>
                  <span className="text-slate-200 font-medium block mt-0.5">
                    {parsed.powerOnCount ? `${parsed.powerOnCount.toLocaleString()} cycles` : '—'}
                  </span>
                </div>

                <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-700/40">
                  <span className="text-slate-400 block text-[10px] uppercase">Interface</span>
                  <span className="text-slate-200 font-medium block mt-0.5 truncate">
                    {parsed.transferMode || parsed.interface || '—'}
                  </span>
                </div>

                {parsed.hostReadsGB && (
                  <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-700/40">
                    <span className="text-slate-400 block text-[10px] uppercase">Host Reads</span>
                    <span className="text-slate-200 font-medium block mt-0.5">
                      {(parsed.hostReadsGB / 1024).toFixed(1)} TB
                    </span>
                  </div>
                )}

                {parsed.hostWritesGB && (
                  <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-700/40">
                    <span className="text-slate-400 block text-[10px] uppercase">Host Writes</span>
                    <span className="text-slate-200 font-medium block mt-0.5">
                      {(parsed.hostWritesGB / 1024).toFixed(1)} TB
                    </span>
                  </div>
                )}
              </div>

              {/* Critical warnings */}
              {parsed.criticalWarnings && parsed.criticalWarnings.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-800/80 text-amber-300 text-xs space-y-1">
                  <div className="font-bold flex items-center space-x-1">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Potential Drive Degradation Detected:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 font-mono text-[11px] text-amber-200/90 pl-1">
                    {parsed.criticalWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Matched Drive or Create New Drive helper */}
              <div className="pt-2 border-t border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {matchedDrive ? (
                  <div className="flex items-center space-x-2 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-300">
                      Matched to inventory: <strong className="text-white font-mono">{matchedDrive.custom_id}</strong> ({matchedDrive.serial_number})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <span>No serial match in inventory.</span>
                    <button
                      type="button"
                      onClick={() => {
                        onCreateDriveFromReport(parsed);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800/80 font-medium flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create New Drive from this</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Target Drive & Log Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Target Drive <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedDriveId}
                onChange={(e) => setSelectedDriveId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500 font-mono"
              >
                <option value="">-- Select Drive --</option>
                {drives.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.custom_id} — {d.model} ({d.serial_number})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Log Date
              </label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Log Notes (Optional)
              </label>
              <input
                type="text"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                placeholder="e.g. Monthly checkup, scrub clean"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!parsed || !selectedDriveId || isSaving}
              onClick={handleSaveLog}
              className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold shadow-md shadow-sky-600/20 transition-all disabled:opacity-50 flex items-center space-x-1.5"
            >
              <span>{isSaving ? 'Appending...' : 'Append to Drive History'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
