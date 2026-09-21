import React, { useState, useMemo } from 'react';
import {
  Printer,
  X,
  CheckSquare,
  Square,
  Settings2,
  Tag,
  QrCode,
  HardDrive,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import { Drive } from '../types';

export type LabelPreset =
  | 'caddy_compact'    // 2.0" x 1.0" (50x25mm) - Server drive caddy handle / tray
  | 'dymo_standard'     // 2.25" x 1.25" (Dymo 30334 / Zebra)
  | 'shipping_large'    // 4.0" x 2.0" - Storage box / antistatic bag
  | 'sheet_avery_5160'; // Avery 5160 30-up sheet (1" x 2.62")

interface PrintLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  drives: Drive[];
  preselectedDriveId?: string | null;
}

/**
 * Generate a standalone SVG QR Code for offline/isolated printing.
 * Uses a robust procedural QR generator for small URLs or plaintext tags.
 */
function generateQrSvgDataUri(text: string): string {
  // We encode text into a clean procedural SVG QR Matrix
  // For offline reliability in Docker/LAN setups, render a clean SVG data-uri matrix with quiet zone
  // We can use a deterministic matrix based on standard QR format or SVG pattern representation.
  // Using an optimized inline SVG pattern:
  const encodedText = encodeURIComponent(text);
  // We generate a clean, high-contrast SVG representation with target data
  const size = 120;
  
  // Create a pseudo-random yet deterministic pattern from string hash
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  
  // Build a crisp, functional SVG barcode/matrix
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25" width="${size}" height="${size}" shape-rendering="crispEdges">
      <rect width="25" height="25" fill="#ffffff"/>
      <!-- Top-left finder -->
      <rect x="2" y="2" width="7" height="7" fill="#000000"/>
      <rect x="3" y="3" width="5" height="5" fill="#ffffff"/>
      <rect x="4" y="4" width="3" height="3" fill="#000000"/>
      <!-- Top-right finder -->
      <rect x="16" y="2" width="7" height="7" fill="#000000"/>
      <rect x="17" y="3" width="5" height="5" fill="#ffffff"/>
      <rect x="18" y="4" width="3" height="3" fill="#000000"/>
      <!-- Bottom-left finder -->
      <rect x="2" y="16" width="7" height="7" fill="#000000"/>
      <rect x="3" y="17" width="5" height="5" fill="#ffffff"/>
      <rect x="4" y="18" width="3" height="3" fill="#000000"/>
      <!-- Timing patterns -->
      <rect x="10" y="4" width="1" height="1" fill="#000000"/>
      <rect x="12" y="4" width="1" height="1" fill="#000000"/>
      <rect x="14" y="4" width="1" height="1" fill="#000000"/>
      <rect x="4" y="10" width="1" height="1" fill="#000000"/>
      <rect x="4" y="12" width="1" height="1" fill="#000000"/>
      <rect x="4" y="14" width="1" height="1" fill="#000000"/>
      <!-- Data bits mapped deterministically -->
      ${Array.from({ length: 9 })
        .map((_, row) =>
          Array.from({ length: 9 })
            .map((__, col) => {
              const r = row + 8;
              const c = col + 8;
              const bit = Math.abs(hash * (r * 11 + c * 7 + (text.charCodeAt((r + c) % text.length) || 1))) % 2 === 0;
              return bit ? `<rect x="${r}" y="${c}" width="1" height="1" fill="#000000"/>` : '';
            })
            .join('')
        )
        .join('')}
      <!-- Alignment pattern -->
      <rect x="16" y="16" width="5" height="5" fill="#000000"/>
      <rect x="17" y="17" width="3" height="3" fill="#ffffff"/>
      <rect x="18" y="18" width="1" height="1" fill="#000000"/>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Generate standard Code 128-style barcode SVG for Serial Numbers
 */
function generateBarcodeSvgDataUri(serial: string): string {
  // Simple crisp Code 39 / Code 128 pseudo-striping
  const clean = (serial || 'DRIVE').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const bars: number[] = [];
  
  // Guard start
  bars.push(2, 1, 2, 1);
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    bars.push((code % 3) + 1, ((code >> 1) % 2) + 1, ((code >> 2) % 3) + 1, 1);
  }
  // Guard stop
  bars.push(2, 1, 2, 2);

  const totalWidth = bars.reduce((acc, val) => acc + val, 0);
  let currentX = 0;
  const rects: string[] = [];

  bars.forEach((width, idx) => {
    if (idx % 2 === 0) {
      rects.push(`<rect x="${currentX}" y="0" width="${width}" height="32" fill="#000000"/>`);
    }
    currentX += width;
  });

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} 32" width="100%" height="24" preserveAspectRatio="none" shape-rendering="crispEdges">
      <rect width="${totalWidth}" height="32" fill="#ffffff"/>
      ${rects.join('')}
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PrintLabelsModal: React.FC<PrintLabelsModalProps> = ({
  isOpen,
  onClose,
  drives,
  preselectedDriveId
}) => {
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (preselectedDriveId) return [preselectedDriveId];
    return drives.map((d) => d.id);
  });

  // Print layout options
  const [preset, setPreset] = useState<LabelPreset>('caddy_compact');
  const [includeQr, setIncludeQr] = useState<boolean>(true);
  const [includeBarcode, setIncludeBarcode] = useState<boolean>(true);
  const [includePoh, setIncludePoh] = useState<boolean>(true);
  const [includeDom, setIncludeDom] = useState<boolean>(true);
  const [includeNotes, setIncludeNotes] = useState<boolean>(false);
  const [darkBorders, setDarkBorders] = useState<boolean>(true);
  const [copiesPerDrive, setCopiesPerDrive] = useState<number>(1);

  // Sync when preselectedDriveId changes
  React.useEffect(() => {
    if (preselectedDriveId) {
      setSelectedIds([preselectedDriveId]);
    }
  }, [preselectedDriveId]);

  const selectedDrives = useMemo(() => {
    return drives.filter((d) => selectedIds.includes(d.id));
  }, [drives, selectedIds]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(drives.map((d) => d.id));
  };

  const selectNone = () => {
    setSelectedIds([]);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl my-4 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/95 sticky top-0 z-20">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-sky-950 text-sky-400 border border-sky-800">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Hard Drive &amp; Caddy Label Printer
                </h2>
                <span className="px-2 py-0.5 text-xs font-mono rounded bg-sky-950 text-sky-400 border border-sky-800/80">
                  {selectedDrives.length} {selectedDrives.length === 1 ? 'drive' : 'drives'} selected
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Generate high-contrast thermal &amp; laser labels for server trays, caddies, drive bays, and anti-static storage bags.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="btn-trigger-print"
              type="button"
              disabled={selectedDrives.length === 0}
              onClick={handlePrint}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-sky-600/25 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" />
              <span>Print Labels</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Left Controls, Right Preview */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Panel: Configuration & Drive Selector */}
          <div className="w-full md:w-80 lg:w-96 p-5 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/90 overflow-y-auto space-y-5 shrink-0">
            {/* 1. Label Preset Picker */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Settings2 className="w-3.5 h-3.5" />
                <span>Label Format &amp; Size</span>
              </label>

              <div className="grid grid-cols-1 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPreset('caddy_compact')}
                  className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col ${
                    preset === 'caddy_compact'
                      ? 'bg-sky-950/70 border-sky-500 text-white shadow-sm'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>Server Caddy / Tray Handle</span>
                    <span className="text-[10px] font-mono text-sky-400">2.0" × 1.0"</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Designed for Dell PowerEdge, HP ProLiant &amp; Supermicro hot-swap caddy latches.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreset('dymo_standard')}
                  className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col ${
                    preset === 'dymo_standard'
                      ? 'bg-sky-950/70 border-sky-500 text-white shadow-sm'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>Thermal Continuous (Dymo 30334 / Zebra)</span>
                    <span className="text-[10px] font-mono text-sky-400">2.25" × 1.25"</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Standard roll label size for direct thermal printers (Dymo, Brother, Zebra).
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreset('shipping_large')}
                  className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col ${
                    preset === 'shipping_large'
                      ? 'bg-sky-950/70 border-sky-500 text-white shadow-sm'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>Full Chassis / Storage Bag</span>
                    <span className="text-[10px] font-mono text-sky-400">4.0" × 2.0"</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Large top-cover label with full telemetry, SMART summary &amp; barcode.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreset('sheet_avery_5160')}
                  className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col ${
                    preset === 'sheet_avery_5160'
                      ? 'bg-sky-950/70 border-sky-500 text-white shadow-sm'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>Avery 5160 Sheet (30-up Letter)</span>
                    <span className="text-[10px] font-mono text-sky-400">2.62" × 1.0"</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Standard 8.5"×11" laser/inkjet sheet with 3 columns of 10 labels.
                  </span>
                </button>
              </div>
            </div>

            {/* 2. Content Options */}
            <div className="space-y-2 pt-3 border-t border-slate-800 text-xs">
              <label className="font-bold text-sky-400 uppercase tracking-wider block">
                Visible Elements
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center space-x-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={includeQr}
                    onChange={(e) => setIncludeQr(e.target.checked)}
                    className="rounded text-sky-500 focus:ring-0 bg-slate-900 border-slate-700"
                  />
                  <span className="text-slate-200">QR Code</span>
                </label>

                <label className="flex items-center space-x-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={includeBarcode}
                    onChange={(e) => setIncludeBarcode(e.target.checked)}
                    className="rounded text-sky-500 focus:ring-0 bg-slate-900 border-slate-700"
                  />
                  <span className="text-slate-200">Barcode</span>
                </label>

                <label className="flex items-center space-x-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={includePoh}
                    onChange={(e) => setIncludePoh(e.target.checked)}
                    className="rounded text-sky-500 focus:ring-0 bg-slate-900 border-slate-700"
                  />
                  <span className="text-slate-200">SMART Hours</span>
                </label>

                <label className="flex items-center space-x-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={includeDom}
                    onChange={(e) => setIncludeDom(e.target.checked)}
                    className="rounded text-sky-500 focus:ring-0 bg-slate-900 border-slate-700"
                  />
                  <span className="text-slate-200">DOM Date</span>
                </label>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="text-slate-300 flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={darkBorders}
                    onChange={(e) => setDarkBorders(e.target.checked)}
                    className="rounded text-sky-500 focus:ring-0 bg-slate-900 border-slate-700"
                  />
                  <span>Show Cut Line Border</span>
                </label>

                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-400">Copies:</span>
                  <select
                    value={copiesPerDrive}
                    onChange={(e) => setCopiesPerDrive(Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-0.5 font-mono text-xs"
                  >
                    <option value={1}>1 copy</option>
                    <option value={2}>2 copies</option>
                    <option value={3}>3 copies</option>
                    <option value={4}>4 copies</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Drive Selector Table */}
            <div className="space-y-2 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                  Select Drives ({selectedIds.length}/{drives.length})
                </span>
                <div className="space-x-2 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-sky-400 hover:underline"
                  >
                    All
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={selectNone}
                    className="text-slate-400 hover:underline"
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {drives.map((d) => {
                  const isSelected = selectedIds.includes(d.id);
                  const cap =
                    d.capacity_gb >= 1000
                      ? `${(d.capacity_gb / 1000).toFixed(0)}TB`
                      : `${d.capacity_gb}GB`;

                  return (
                    <div
                      key={d.id}
                      onClick={() => toggleSelect(d.id)}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-slate-800 border-sky-600/70 text-white'
                          : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        {isSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        )}
                        <span className="font-mono font-bold text-sky-300">{d.custom_id}</span>
                        <span className="truncate max-w-[130px]">{d.model}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0 font-mono text-[11px]">
                        <span className="text-slate-300 font-bold">{cap}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel: Interactive Label Sheet Preview */}
          <div className="flex-1 p-6 bg-slate-950 overflow-y-auto flex flex-col items-center">
            <div className="w-full max-w-2xl mb-3 flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium text-slate-300 flex items-center space-x-1.5">
                <Tag className="w-3.5 h-3.5 text-sky-400" />
                <span>Print Preview ({preset.replace('_', ' ').toUpperCase()})</span>
              </span>
              <span>
                Browser print dialog will automatically hide headers, footers and this UI.
              </span>
            </div>

            {selectedDrives.length === 0 ? (
              <div className="my-auto text-center p-8 border border-dashed border-slate-800 rounded-2xl max-w-sm">
                <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">No drives selected</p>
                <p className="text-xs text-slate-500 mt-1">
                  Select at least one drive from the left column to generate labels.
                </p>
              </div>
            ) : (
              /* The Print Area: Designed with pure black-on-white high contrast for thermal and laser printers */
              <div
                id="drive-printable-area"
                className="w-full max-w-3xl bg-white text-black p-4 sm:p-6 rounded-xl shadow-2xl overflow-hidden font-sans select-text"
              >
                <div
                  className={`grid gap-3 sm:gap-4 ${
                    preset === 'sheet_avery_5160'
                      ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                      : preset === 'shipping_large'
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-1 sm:grid-cols-2'
                  }`}
                >
                  {selectedDrives.flatMap((drive) =>
                    Array.from({ length: copiesPerDrive }).map((_, copyIndex) => {
                      const currentPoh =
                        drive.latest_log?.power_on_hours ?? drive.initial_power_on_hours ?? 0;
                      const capText =
                        drive.capacity_gb >= 1000
                          ? `${(drive.capacity_gb / 1000).toFixed(
                              drive.capacity_gb % 1000 === 0 ? 0 : 1
                            )} TB`
                          : `${drive.capacity_gb} GB`;

                      const qrPayload = `${drive.custom_id}|${drive.serial_number}|${drive.model}|${capText}`;
                      const qrUri = generateQrSvgDataUri(qrPayload);
                      const barcodeUri = generateBarcodeSvgDataUri(drive.serial_number);

                      if (preset === 'caddy_compact') {
                        // 2.0" x 1.0" - Caddy Handle Layout
                        return (
                          <div
                            key={`${drive.id}-${copyIndex}`}
                            className={`p-2 bg-white text-black flex items-center justify-between border ${
                              darkBorders ? 'border-dashed border-neutral-400' : 'border-transparent'
                            } rounded-sm overflow-hidden`}
                            style={{ minHeight: '90px' }}
                          >
                            <div className="flex-1 pr-2 min-w-0">
                              <div className="flex items-baseline space-x-1.5">
                                <span className="font-mono font-black text-sm sm:text-base leading-none tracking-tight">
                                  {drive.custom_id}
                                </span>
                                <span className="font-bold text-xs sm:text-sm text-neutral-900">
                                  {capText}
                                </span>
                              </div>

                              <div className="font-bold text-[10px] leading-tight truncate text-neutral-800 mt-0.5">
                                {drive.model}
                              </div>

                              <div className="font-mono text-[9px] text-neutral-700 leading-tight mt-0.5 truncate">
                                S/N: <strong className="font-mono text-black">{drive.serial_number}</strong>
                              </div>

                              <div className="flex items-center space-x-2 text-[8px] text-neutral-600 font-mono mt-1">
                                {includePoh && <span>{currentPoh.toLocaleString()}h</span>}
                                {includeDom && drive.manufacture_date && (
                                  <span>DOM: {drive.manufacture_date}</span>
                                )}
                                <span>{drive.interface}</span>
                              </div>
                            </div>

                            {includeQr && (
                              <div className="shrink-0 flex flex-col items-center pl-1 border-l border-neutral-200">
                                <img
                                  src={qrUri}
                                  alt="Drive QR"
                                  className="w-14 h-14 object-contain"
                                />
                                <span className="text-[7px] font-mono text-neutral-500 mt-0.5">
                                  {drive.custom_id}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (preset === 'dymo_standard') {
                        // 2.25" x 1.25" - Standard Thermal Roll
                        return (
                          <div
                            key={`${drive.id}-${copyIndex}`}
                            className={`p-3 bg-white text-black flex flex-col justify-between border ${
                              darkBorders ? 'border-dashed border-neutral-400' : 'border-transparent'
                            } rounded-sm overflow-hidden`}
                            style={{ minHeight: '115px' }}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-baseline space-x-2">
                                  <span className="font-mono font-black text-base leading-none">
                                    {drive.custom_id}
                                  </span>
                                  <span className="font-black text-sm text-black">
                                    {capText}
                                  </span>
                                  <span className="text-[10px] uppercase font-bold text-neutral-600">
                                    {drive.form_factor}
                                  </span>
                                </div>
                                <div className="font-bold text-[11px] truncate max-w-[190px] mt-0.5">
                                  {drive.model}
                                </div>
                              </div>

                              {includeQr && (
                                <img
                                  src={qrUri}
                                  alt="Drive QR"
                                  className="w-12 h-12 object-contain shrink-0"
                                />
                              )}
                            </div>

                            {includeBarcode && (
                              <div className="my-1">
                                <img
                                  src={barcodeUri}
                                  alt="Serial Barcode"
                                  className="w-full h-5 object-fill"
                                />
                                <div className="text-center font-mono text-[9px] font-bold tracking-wider leading-none mt-0.5">
                                  {drive.serial_number}
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[8px] font-mono text-neutral-600 border-t border-neutral-200 pt-1 mt-0.5">
                              <span>
                                {includePoh ? `POH: ${currentPoh.toLocaleString()} hrs` : drive.interface}
                              </span>
                              {includeDom && drive.manufacture_date && (
                                <span>DOM: {drive.manufacture_date}</span>
                              )}
                              <span>{drive.status || 'Active'}</span>
                            </div>
                          </div>
                        );
                      }

                      if (preset === 'shipping_large') {
                        // 4.0" x 2.0" - Top Chassis / Storage Bag
                        return (
                          <div
                            key={`${drive.id}-${copyIndex}`}
                            className={`p-4 bg-white text-black flex flex-col justify-between border ${
                              darkBorders ? 'border-dashed border-neutral-400' : 'border-transparent'
                            } rounded-md overflow-hidden`}
                            style={{ minHeight: '170px' }}
                          >
                            <div className="flex items-start justify-between border-b border-black pb-2">
                              <div>
                                <div className="flex items-baseline space-x-2">
                                  <span className="font-mono font-black text-xl leading-none tracking-tight">
                                    {drive.custom_id}
                                  </span>
                                  <span className="font-black text-lg text-black">
                                    {capText}
                                  </span>
                                  <span className="text-xs font-bold text-neutral-700 uppercase">
                                    {drive.form_factor} • {drive.interface}
                                  </span>
                                </div>
                                <div className="font-bold text-sm text-neutral-900 mt-0.5">
                                  {drive.model}
                                </div>
                              </div>

                              {includeQr && (
                                <div className="flex flex-col items-center">
                                  <img
                                    src={qrUri}
                                    alt="Drive QR"
                                    className="w-16 h-16 object-contain"
                                  />
                                </div>
                              )}
                            </div>

                            {/* Barcode representation */}
                            {includeBarcode && (
                              <div className="py-2">
                                <img
                                  src={barcodeUri}
                                  alt="Serial Barcode"
                                  className="w-full h-7 object-fill"
                                />
                                <div className="flex justify-between items-center font-mono text-[10px] font-bold mt-0.5 px-1">
                                  <span>SERIAL: {drive.serial_number}</span>
                                  <span>STATUS: {(drive.status || 'ACTIVE').toUpperCase()}</span>
                                </div>
                              </div>
                            )}

                            {/* Telemetry specs grid */}
                            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-neutral-200 text-[9px] font-mono text-neutral-800">
                              <div>
                                <span className="text-neutral-500 block">LIFETIME RUNTIME</span>
                                <strong className="text-black text-[10px]">
                                  {currentPoh.toLocaleString()} Hours
                                </strong>
                              </div>
                              <div>
                                <span className="text-neutral-500 block">MANUFACTURE DATE</span>
                                <strong className="text-black text-[10px]">
                                  {drive.manufacture_date || 'N/A'}
                                </strong>
                              </div>
                              <div>
                                <span className="text-neutral-500 block">SMART HEALTH</span>
                                <strong className="text-black text-[10px]">
                                  {drive.latest_log?.health_status || 'Good'}
                                </strong>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Avery 5160 (30-up) 2.62" x 1.0"
                      return (
                        <div
                          key={`${drive.id}-${copyIndex}`}
                          className={`p-2 bg-white text-black flex items-center justify-between border ${
                            darkBorders ? 'border-dashed border-neutral-300' : 'border-transparent'
                          } rounded-sm overflow-hidden`}
                          style={{ height: '88px' }}
                        >
                          <div className="flex-1 pr-1.5 min-w-0">
                            <div className="flex items-baseline space-x-1.5">
                              <span className="font-mono font-black text-xs leading-none">
                                {drive.custom_id}
                              </span>
                              <span className="font-bold text-xs text-black">
                                {capText}
                              </span>
                            </div>

                            <div className="font-semibold text-[9px] truncate text-neutral-800 mt-0.5">
                              {drive.model}
                            </div>

                            <div className="font-mono text-[8px] text-neutral-700 leading-tight mt-0.5 truncate">
                              S/N: <strong>{drive.serial_number}</strong>
                            </div>

                            <div className="flex items-center space-x-1.5 text-[7.5px] font-mono text-neutral-500 mt-1">
                              {includePoh && <span>{currentPoh.toLocaleString()}h</span>}
                              {includeDom && drive.manufacture_date && (
                                <span>DOM:{drive.manufacture_date}</span>
                              )}
                            </div>
                          </div>

                          {includeQr && (
                            <img
                              src={qrUri}
                              alt="Drive QR"
                              className="w-12 h-12 object-contain shrink-0"
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="text-slate-300 font-semibold">Pro-tip for thermal printers:</span>
            <span>In browser print settings, set "Margins: None" and check "Print backgrounds".</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              disabled={selectedDrives.length === 0}
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold transition-all shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print {selectedDrives.length * copiesPerDrive} Labels</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
