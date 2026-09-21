import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Plus,
  Sparkles,
  ArrowRight,
  Image as ImageIcon,
  Upload,
  Clipboard,
  Check
} from 'lucide-react';
import { Drive, ParsedCrystalDiskInfo } from '../types';
import { parseCrystalDiskInfoText, parseCrystalDiskScreenshotApi, addCrystalDiskLog } from '../api';

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
  const [activeTab, setActiveTab] = useState<'screenshot' | 'text'>('screenshot');
  const [rawText, setRawText] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isScanningImage, setIsScanningImage] = useState(false);
  const [parsed, setParsed] = useState<ParsedCrystalDiskInfo | null>(null);
  const [matchedDrive, setMatchedDrive] = useState<Drive | null>(null);
  const [selectedDriveId, setSelectedDriveId] = useState<string>('');
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [logNotes, setLogNotes] = useState('');
  const [isParsingText, setIsParsingText] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (preselectedDrive) {
      setSelectedDriveId(preselectedDrive.id);
    } else if (drives.length > 0 && !selectedDriveId) {
      setSelectedDriveId(drives[0].id);
    }
  }, [preselectedDrive, drives]);

  // Global paste handler to intercept screenshots anywhere in the modal
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            setActiveTab('screenshot');
            handleProcessImageFile(file);
          }
          return;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, drives]);

  // Debounced live parse for text mode
  useEffect(() => {
    if (activeTab !== 'text' || !rawText.trim()) {
      if (activeTab === 'text') {
        setParsed(null);
        setMatchedDrive(null);
      }
      return;
    }

    const timer = setTimeout(async () => {
      setIsParsingText(true);
      setError(null);
      try {
        const res = await parseCrystalDiskInfoText(rawText);
        setParsed(res.parsed);
        if (res.matchedDrive) {
          setMatchedDrive(res.matchedDrive);
          setSelectedDriveId(res.matchedDrive.id);
        }
      } catch (err: any) {
        console.error('Parse error:', err);
      } finally {
        setIsParsingText(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [rawText, activeTab]);

  const handleProcessImageFile = async (file: File) => {
    setError(null);
    setIsScanningImage(true);

    // Create local object URL for preview
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;
      setScreenshotPreview(base64Data);

      try {
        const res = await parseCrystalDiskScreenshotApi(base64Data, file.type || 'image/png');
        setParsed(res.parsed);
        setRawText(res.rawText);

        if (res.matchedDrive) {
          setMatchedDrive(res.matchedDrive);
          setSelectedDriveId(res.matchedDrive.id);
        } else if (res.parsed.serialNumber) {
          // Check local drives by serial number
          const match = drives.find(
            (d) => d.serial_number.toLowerCase() === res.parsed.serialNumber?.toLowerCase()
          );
          if (match) {
            setMatchedDrive(match);
            setSelectedDriveId(match.id);
          }
        }
      } catch (err: any) {
        console.error('OCR Error:', err);
        setError(err.message || 'Failed to read CrystalDiskInfo screenshot');
      } finally {
        setIsScanningImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setActiveTab('screenshot');
        handleProcessImageFile(file);
      } else {
        setError('Please drop an image file (PNG, JPG, WebP).');
      }
    }
  };

  if (!isOpen) return null;

  const handleSaveLog = async () => {
    if (!selectedDriveId) {
      setError('Please select a target drive to append this log to.');
      return;
    }
    if (!parsed) {
      setError('No parsed metrics found. Please upload a screenshot or paste text.');
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
    <div
      id="crystaldisk-parser-modal-overlay"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="crystaldisk-parser-modal-card"
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl my-6 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/95 sticky top-0 z-10 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-sky-950/90 border border-sky-800 text-sky-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">CrystalDiskInfo SMART Import</h2>
              <p className="text-xs text-slate-400">
                Import SMART health logs via screenshot OCR or raw text parser
              </p>
            </div>
          </div>
          <button
            id="close-crystaldisk-parser-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">{error}</span>
                {error.includes('GEMINI_API_KEY') && (
                  <span className="text-rose-300/80 block text-[11px]">
                    Tip: If running self-hosted, pass <code>GEMINI_API_KEY=your_key</code> in your <code>docker-compose.yml</code>. You can also switch to the <strong>Paste Raw Text</strong> tab to import without an API key!
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Mode Tabs */}
          <div className="flex border-b border-slate-800">
            <button
              id="tab-crystaldisk-screenshot"
              type="button"
              onClick={() => setActiveTab('screenshot')}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                activeTab === 'screenshot'
                  ? 'border-sky-500 text-sky-400 bg-sky-950/30'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Import via Screenshot (Recommended)</span>
              <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[10px] font-mono uppercase">
                AI Vision
              </span>
            </button>
            <button
              id="tab-crystaldisk-text"
              type="button"
              onClick={() => setActiveTab('text')}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                activeTab === 'text'
                  ? 'border-sky-500 text-sky-400 bg-sky-950/30'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Clipboard className="w-4 h-4" />
              <span>Paste Raw Text</span>
            </button>
          </div>

          {/* TAB 1: Screenshot Dropzone & Paste Area */}
          {activeTab === 'screenshot' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleProcessImageFile(e.target.files[0]);
                  }
                }}
              />

              {!screenshotPreview ? (
                <div
                  id="screenshot-dropzone"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(true);
                  }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDraggingOver
                      ? 'border-sky-400 bg-sky-950/40 scale-[1.01]'
                      : 'border-slate-700 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-950/90'
                  }`}
                >
                  <div className="p-3.5 rounded-2xl bg-sky-950/80 border border-sky-800/80 text-sky-400 mb-3 shadow-inner">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    Paste CrystalDiskInfo Screenshot or Drag & Drop Here
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mb-3 leading-relaxed">
                    Take a screenshot of CrystalDiskInfo (<kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">Win+Shift+S</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">PrintScreen</kbd>) and simply press <strong className="text-sky-300">Ctrl+V / ⌘+V</strong> anywhere in this window.
                  </p>
                  <button
                    type="button"
                    className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
                  >
                    Browse Image File...
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
                      <ImageIcon className="w-4 h-4 text-sky-400" />
                      <span>Loaded CrystalDiskInfo Screenshot</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setScreenshotPreview(null);
                        setParsed(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      Remove & Choose Another
                    </button>
                  </div>

                  <div className="relative rounded-lg overflow-hidden border border-slate-800 max-h-52 flex items-center justify-center bg-black/50">
                    <img
                      src={screenshotPreview}
                      alt="CrystalDisk Screenshot Preview"
                      className="max-h-52 w-auto object-contain"
                    />
                    {isScanningImage && (
                      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center space-y-2.5">
                        <RefreshCw className="w-7 h-7 text-sky-400 animate-spin" />
                        <div className="text-center">
                          <p className="text-xs font-bold text-white">
                            Extracting Telemetry with Gemini Vision...
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Reading model, serial, POH, temperature, and SMART attributes
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Textarea for raw text */}
          {activeTab === 'text' && (
            <div className="space-y-3">
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
                    onClick={() => setRawText(SAMPLE_CAUTION_REPORT)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-amber-900/50 text-amber-300 border border-amber-800/60 transition-colors"
                  >
                    Caution Drive
                  </button>
                </div>
              </div>

              <div className="relative">
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste raw text directly from CrystalDiskInfo (Ctrl+V or Edit -> Copy)..."
                  className="w-full px-3.5 py-3 bg-slate-950/90 border border-slate-700 rounded-xl text-slate-200 text-xs font-mono focus:outline-none focus:border-sky-500 leading-relaxed resize-y"
                />
                {isParsingText && (
                  <div className="absolute top-3 right-3 flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-800/90 text-sky-400 text-xs border border-slate-700">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Parsing...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Extracted Metrics Preview */}
          {parsed && (
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Extracted Hardware & SMART Metrics
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
                    {parsed.temperatureC !== undefined ? `${parsed.temperatureC}°C (${parsed.temperatureF || Math.round((parsed.temperatureC * 9) / 5 + 32)}°F)` : '—'}
                  </span>
                </div>

                <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-700/40">
                  <span className="text-slate-400 block text-[10px] uppercase">Power-On Hours</span>
                  <span className="text-emerald-400 font-bold block mt-0.5">
                    {parsed.powerOnHours !== undefined ? `${parsed.powerOnHours.toLocaleString()} hrs` : '—'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-700/40">
                  <span className="text-slate-400 block text-[10px] uppercase">Power-On Count</span>
                  <span className="text-slate-200 font-medium block mt-0.5">
                    {parsed.powerOnCount !== undefined ? `${parsed.powerOnCount.toLocaleString()} cycles` : '—'}
                  </span>
                </div>

                <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-700/40">
                  <span className="text-slate-400 block text-[10px] uppercase">Interface</span>
                  <span className="text-slate-200 font-medium block mt-0.5 truncate">
                    {parsed.transferMode || parsed.interface || '—'}
                  </span>
                </div>

                <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-700/40">
                  <span className="text-slate-400 block text-[10px] uppercase">Capacity</span>
                  <span className="text-slate-200 font-medium block mt-0.5">
                    {parsed.capacityGB ? `${parsed.capacityGB >= 1000 ? `${(parsed.capacityGB / 1000).toFixed(0)} TB` : `${parsed.capacityGB} GB`}` : '—'}
                  </span>
                </div>

                <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-700/40">
                  <span className="text-slate-400 block text-[10px] uppercase">SMART Attributes</span>
                  <span className="text-slate-200 font-medium block mt-0.5">
                    {parsed.smartAttributes ? `${parsed.smartAttributes.length} rows parsed` : 'None'}
                  </span>
                </div>
              </div>

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
                    <span>Drive not found in existing inventory.</span>
                    <button
                      type="button"
                      onClick={() => {
                        onCreateDriveFromReport(parsed);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800/80 font-medium flex items-center space-x-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create New Drive from Screenshot</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Target Drive & Log Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Target Drive <span className="text-rose-400">*</span>
              </label>
              <select
                id="select-target-drive"
                value={selectedDriveId}
                onChange={(e) => setSelectedDriveId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-sky-500 font-mono"
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Log Date
              </label>
              <input
                id="crystaldisk-log-date-input"
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Log Notes (Optional)
              </label>
              <input
                id="crystaldisk-log-notes-input"
                type="text"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                placeholder="e.g. Screenshot imported from CrystalDiskInfo"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end space-x-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            id="append-crystaldisk-log-btn"
            type="button"
            disabled={!parsed || !selectedDriveId || isSaving}
            onClick={handleSaveLog}
            className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-950 transition-all disabled:opacity-50 flex items-center space-x-1.5"
          >
            <span>{isSaving ? 'Appending...' : 'Append to Drive History'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
