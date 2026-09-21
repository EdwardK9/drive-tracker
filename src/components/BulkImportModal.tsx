import React, { useState, useEffect } from 'react';
import { X, Clipboard, Table, CheckCircle, AlertCircle, HelpCircle, Loader2 } from 'lucide-react';
import { importBulkDrives } from '../api';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [importType, setImportType] = useState<'drives' | 'poh'>('drives');
  const [pasteText, setPasteText] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statsResult, setStatsResult] = useState<{
    inserted: number;
    updated: number;
    logsInserted: number;
    failuresCount: number;
    failures: any[];
  } | null>(null);

  // Reset states on toggle/open
  useEffect(() => {
    if (isOpen) {
      setPasteText('');
      setParsedData([]);
      setHeaders([]);
      setMapping({});
      setError(null);
      setStatsResult(null);
    }
  }, [isOpen, importType]);

  if (!isOpen) return null;

  // Clean raw text and parse date nicely
  const parseCustomDate = (dateStr: string): string | null => {
    if (!dateStr) return null;
    let clean = dateStr.trim();
    if (!clean) return null;

    // Handle DD.MM.YYYY or D.M.YYYY (e.g. 1.10.2025)
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(clean)) {
      const parts = clean.split('.');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }

    // Handle DD/MM/YYYY or MM/DD/YYYY
    // We can try standard Date parsing first. If it yields invalid, try split.
    try {
      const parts = clean.split('/');
      if (parts.length === 3) {
        // Excel standard usually formats dates. Let's do YYYY-MM-DD
        let p0 = parseInt(parts[0], 10);
        let p1 = parseInt(parts[1], 10);
        let p2 = parseInt(parts[2], 10);
        // If year is 2 digits, convert to 4 digits
        if (p2 < 100) p2 += 2000;

        // If p0 > 12, it is definitely Day (DD/MM/YYYY)
        if (p0 > 12) {
          return `${p2}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
        }
        // Otherwise, assume standard MM/DD/YYYY or check order. Default to US style MM/DD/YYYY, but if UK fallback:
        return `${p2}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      }

      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {
      // Ignore
    }
    return clean;
  };

  // Real-time clipboard TSV parser
  const handlePasteChange = (text: string) => {
    setPasteText(text);
    setError(null);
    setStatsResult(null);

    if (!text.trim()) {
      setParsedData([]);
      setHeaders([]);
      return;
    }

    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) {
      setError('Please paste a table containing at least a header row and one data row.');
      setParsedData([]);
      setHeaders([]);
      return;
    }

    // Detect tab or comma
    const rawHeaders = lines[0].split('\t');
    const isTabSeparated = rawHeaders.length > 1;
    const splitChar = isTabSeparated ? '\t' : ',';

    const cleanHeaders = lines[0].split(splitChar).map(h => h.trim().replace(/^["']|["']$/g, ''));
    setHeaders(cleanHeaders);

    // Initial Auto-Mapping detection
    const initialMap: Record<string, string> = {};
    cleanHeaders.forEach((h, index) => {
      const hl = h.toLowerCase();
      if (importType === 'drives') {
        if (hl.includes('serial number') || hl.includes('serial_number') || (hl.includes('serial') && hl.includes('number'))) {
          initialMap['serial_number'] = h;
        } else if (hl.includes('serial name') || hl.includes('serial_name') || hl.includes('name') || hl.includes('model') || hl.includes('drive name')) {
          initialMap['model'] = h;
        } else if (hl.includes('location') || hl.includes('device') || hl.includes('where')) {
          initialMap['location'] = h;
        } else if (hl.includes('raw capacity') || hl.includes('capacity') || hl.includes('raw_capacity') || hl.includes('size')) {
          initialMap['capacity_gb'] = h;
        } else if (hl.includes('usable capacity') || hl.includes('usable_capacity') || hl.includes('usable')) {
          initialMap['usable_capacity_gb'] = h;
        } else if (hl.includes('number') || hl.includes('windows name') || hl.includes('custom id') || hl.includes('custom_id')) {
          initialMap['custom_id'] = h;
        } else if (hl.includes('health') || hl.includes('condition')) {
          initialMap['health'] = h;
        } else if (hl.includes('purchase date') || hl.includes('purchased_at')) {
          initialMap['purchase_date'] = h;
        } else if (hl.includes('purchase place') || hl.includes('vendor') || hl.includes('shop') || hl.includes('store')) {
          initialMap['vendor'] = h;
        } else if (hl.includes('format') || hl.includes('inch') || hl.includes('form factor')) {
          initialMap['form_factor'] = h;
        } else if (hl.includes('server')) {
          initialMap['server_name'] = h;
        } else if (hl.includes('error')) {
          initialMap['error_amount'] = h;
        }
      } else {
        // POH logs mapping
        if (hl.includes('serial number') || hl.includes('serial_number') || (hl.includes('serial') && hl.includes('number'))) {
          initialMap['serial_number'] = h;
        } else if (hl.includes('number') || hl.includes('custom id') || hl.includes('windows name') || hl.includes('id')) {
          initialMap['custom_id'] = h;
        } else if (hl.includes('power on hours') || hl.includes('power_on_hours') || hl.includes('hours') || hl.includes('poh')) {
          initialMap['power_on_hours'] = h;
        } else if (hl.includes('power on count') || hl.includes('power_on_count') || hl.includes('count') || hl.includes('poc')) {
          initialMap['power_on_count'] = h;
        } else if (hl.includes('date') || hl.includes('log_date')) {
          initialMap['log_date'] = h;
        }
      }
    });

    setMapping(initialMap);

    // Parse up to 20 lines for high-performance preview
    const previewRows = lines.slice(1).map((line, rowIndex) => {
      const cells = line.split(splitChar).map(c => c.trim().replace(/^["']|["']$/g, ''));
      const rowObj: Record<string, string> = {};
      cleanHeaders.forEach((h, colIndex) => {
        rowObj[h] = cells[colIndex] || '';
      });
      return rowObj;
    });

    setParsedData(previewRows);
  };

  const getMappedValue = (row: any, key: string) => {
    const colName = mapping[key];
    return colName ? row[colName] : '';
  };

  // Convert raw preview objects into structured requests
  const processImportItems = () => {
    return parsedData.map(row => {
      if (importType === 'drives') {
        const serial_number = getMappedValue(row, 'serial_number');
        const model = getMappedValue(row, 'model');
        const custom_id = getMappedValue(row, 'custom_id');
        const locationVal = getMappedValue(row, 'location') || 'Storage';
        const rawCap = getMappedValue(row, 'capacity_gb');
        const usableCap = getMappedValue(row, 'usable_capacity_gb');
        const healthVal = getMappedValue(row, 'health') || 'Good';
        const purDate = getMappedValue(row, 'purchase_date');
        const vendorVal = getMappedValue(row, 'vendor');
        const formatVal = getMappedValue(row, 'form_factor');
        const serverName = getMappedValue(row, 'server_name');
        const errorAmount = getMappedValue(row, 'error_amount');

        // Parse capacities cleanly (handles unit strings and "80/60" type capacity blocks)
        let rawNum = parseInt(rawCap.replace(/[^\d.]/g, ''), 10) || 0;
        let usableNum = parseInt(usableCap.replace(/[^\d.]/g, ''), 10) || null;
        if (rawCap.includes('/')) {
          const slashParts = rawCap.split('/');
          rawNum = parseInt(slashParts[0].replace(/[^\d.]/g, ''), 10) || 0;
          usableNum = parseInt(slashParts[1].replace(/[^\d.]/g, ''), 10) || null;
        }

        // Map format
        let form_factor = '3.5" HDD';
        if (formatVal.toLowerCase().includes('2.5') || model.toLowerCase().includes('ssd')) {
          form_factor = '2.5" SSD';
        } else if (formatVal.toLowerCase().includes('m.2') || formatVal.toLowerCase().includes('nvme')) {
          form_factor = 'M.2 NVMe';
        }

        // Map status & location
        let location = 'Storage';
        let status = 'Active';

        const locLower = locationVal.toLowerCase();
        if (locLower.includes('replace') || locLower.includes('dead')) {
          location = 'Replaced';
          status = 'Replaced';
        } else if (locLower.includes('house')) {
          location = 'House';
          status = 'Active';
        } else if (locLower.includes('server')) {
          location = 'Server';
          status = 'Active';
        } else if (locLower.includes('storage')) {
          location = 'Storage';
          status = 'Active';
        } else if (locationVal) {
          location = locationVal;
          status = 'Active';
        }

        // If health explicitly contains DEAD
        if (healthVal.toLowerCase().includes('dead') || healthVal.toLowerCase().includes('fail')) {
          status = 'Failed';
        }

        // Purchase date processing
        const purchase_date = parseCustomDate(purDate);

        // Prepend server name and errors to notes for complete context preservations
        const notesParts = [];
        if (serverName) notesParts.push(`Server Name: ${serverName}`);
        if (errorAmount) notesParts.push(`Errors/Issues: ${errorAmount}`);
        if (healthVal.toLowerCase().includes('dead')) notesParts.push('Status logged as DEAD/Failed.');
        const notes = notesParts.length > 0 ? notesParts.join(' | ') : null;

        return {
          serial_number,
          model: model || 'Unknown Model',
          custom_id,
          capacity_gb: rawNum,
          usable_capacity_gb: usableNum,
          form_factor,
          interface: form_factor.includes('SSD') ? 'SATA SSD' : form_factor.includes('NVMe') ? 'PCIe NVMe' : 'SATA III',
          status,
          location,
          vendor: vendorVal || null,
          purchase_date,
          warranty_months: 36,
          notes
        };
      } else {
        // Power-On Hours
        const serial_number = getMappedValue(row, 'serial_number');
        const custom_id = getMappedValue(row, 'custom_id');
        const pohStr = getMappedValue(row, 'power_on_hours');
        const pocStr = getMappedValue(row, 'power_on_count');
        const logDateStr = getMappedValue(row, 'log_date');

        return {
          serial_number,
          custom_id,
          power_on_hours: parseInt(pohStr.replace(/[^\d.]/g, ''), 10) || 0,
          power_on_count: pocStr ? parseInt(pocStr.replace(/[^\d.]/g, ''), 10) : null,
          log_date: parseCustomDate(logDateStr) || new Date().toISOString().split('T')[0],
          notes: 'Bulk imported Power-On Hours log.'
        };
      }
    });
  };

  const handleImport = async () => {
    try {
      setLoading(true);
      setError(null);
      setStatsResult(null);

      const itemsToImport = processImportItems();
      const validItems = itemsToImport.filter(item => {
        if (importType === 'drives') {
          return item.serial_number && item.serial_number.trim() !== '';
        } else {
          return (item.serial_number || item.custom_id) && typeof item.power_on_hours === 'number' && !isNaN(item.power_on_hours);
        }
      });

      if (validItems.length === 0) {
        setError('No valid rows with serial numbers/IDs and numeric values were detected.');
        setLoading(false);
        return;
      }

      const result = await importBulkDrives(importType, validItems);
      setStatsResult(result.stats);
      setPasteText('');
      setParsedData([]);
      setHeaders([]);
      onSuccess();
    } catch (err: any) {
      console.error('Import failed:', err);
      setError(err.message || 'Bulk import failed. Please verify column selections.');
    } finally {
      setLoading(false);
    }
  };

  const itemsToImport = processImportItems();
  const validCount = itemsToImport.filter(item => {
    if (importType === 'drives') {
      return item.serial_number && item.serial_number.trim() !== '';
    } else {
      return (item.serial_number || item.custom_id) && typeof item.power_on_hours === 'number' && !isNaN(item.power_on_hours);
    }
  }).length;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col my-8 max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-sky-950 text-sky-400 rounded-lg">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-md sm:text-lg font-bold text-white">Excel/Spreadsheet Bulk Import</h2>
              <p className="text-xs text-slate-400">Copy table rows directly from Excel or Sheets and paste them below</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inner layout split */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Toggle Type */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 self-start inline-flex">
            <button
              onClick={() => setImportType('drives')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                importType === 'drives'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Drives Inventory Table (HDD & SSD)
            </button>
            <button
              onClick={() => setImportType('poh')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                importType === 'poh'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Power-On Hours logs
            </button>
          </div>

          {/* Quick Help Guide */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 text-xs text-slate-300">
            <h4 className="font-bold text-white mb-2 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-sky-400" /> 
              How to copy & paste your spreadsheet:
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
              {importType === 'drives' ? (
                <>
                  <li>Open your Excel / Google Sheets document containing your drives inventory.</li>
                  <li>Highlight your columns (ensure headers like <strong className="text-white">HDD Serial Number, HDD Serial Name, Location, Raw Capacity, Health, Purchase Place</strong> are in the selection).</li>
                  <li>Copy them (<kbd className="px-1.5 py-0.5 bg-slate-900 rounded font-mono text-[10px]">Ctrl+C</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-900 rounded font-mono text-[10px]">Cmd+C</kbd>).</li>
                  <li>Paste directly in the box below (<kbd className="px-1.5 py-0.5 bg-slate-900 rounded font-mono text-[10px]">Ctrl+V</kbd>). Our system auto-detects column names instantly!</li>
                </>
              ) : (
                <>
                  <li>Open your Excel / Google Sheets document containing Power-On Hours records.</li>
                  <li>Ensure columns like <strong className="text-white">HDD Serial Number</strong> or <strong className="text-white">HDD Number / windows name</strong>, and <strong className="text-white">Power On Hours</strong> are highlighted and copied.</li>
                  <li>Paste below. The app will search for matching drives in your inventory and insert new timestamped logs automatically!</li>
                </>
              )}
            </ol>
          </div>

          {/* Text Area Input */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Paste Spreadsheet Table Data Here:</label>
            <textarea
              value={pasteText}
              onChange={(e) => handlePasteChange(e.target.value)}
              placeholder="Paste table cells directly from your Excel sheet..."
              className="w-full h-44 p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 font-mono focus:outline-none focus:border-sky-500 placeholder:text-slate-600 focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Result Alert */}
          {statsResult && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 space-y-2">
              <h4 className="font-bold text-white flex items-center gap-2 text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Import Executed Successfully!
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
                <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                  <span className="block text-slate-400">New Drives Created</span>
                  <span className="text-lg font-bold text-white font-mono">{statsResult.inserted}</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                  <span className="block text-slate-400">Existing Drives Updated</span>
                  <span className="text-lg font-bold text-white font-mono">{statsResult.updated}</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                  <span className="block text-slate-400">Power-On Hours Logs Added</span>
                  <span className="text-lg font-bold text-white font-mono">{statsResult.logsInserted}</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                  <span className="block text-slate-400">Row Failures</span>
                  <span className={`text-lg font-bold font-mono ${statsResult.failuresCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {statsResult.failuresCount}
                  </span>
                </div>
              </div>

              {statsResult.failures.length > 0 && (
                <div className="mt-3 text-xs border-t border-slate-800/80 pt-3 text-rose-300">
                  <p className="font-semibold mb-1">Import Errors Snapshot:</p>
                  <ul className="list-disc list-inside space-y-1 font-mono text-[10px] text-rose-400 bg-slate-950/50 p-2 rounded border border-slate-800/40">
                    {statsResult.failures.map((f, i) => (
                      <li key={i}>
                        Row {i + 1}: {f.reason} (Serial: {f.item?.serial_number || f.item?.custom_id || 'Unknown'})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Interactive Column Mapping Preview */}
          {headers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <span>Column Field Mapping Detection</span>
                <span className="normal-case font-normal text-slate-500">(Adjust if columns are misaligned)</span>
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                {importType === 'drives' ? (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Serial Number *</label>
                      <select
                        value={mapping['serial_number'] || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, serial_number: e.target.value }))}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      >
                        <option value="">-- Ignore --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Model / Name</label>
                      <select
                        value={mapping['model'] || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, model: e.target.value }))}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      >
                        <option value="">-- Ignore --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">HDD/SSD Number</label>
                      <select
                        value={mapping['custom_id'] || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, custom_id: e.target.value }))}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      >
                        <option value="">-- Ignore --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Location</label>
                      <select
                        value={mapping['location'] || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, location: e.target.value }))}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      >
                        <option value="">-- Ignore --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Raw Capacity</label>
                      <select
                        value={mapping['capacity_gb'] || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, capacity_gb: e.target.value }))}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      >
                        <option value="">-- Ignore --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Usable Capacity</label>
                      <select
                        value={mapping['usable_capacity_gb'] || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, usable_capacity_gb: e.target.value }))}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      >
                        <option value="">-- Ignore --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Health Status</label>
                      <select
                        value={mapping['health'] || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, health: e.target.value }))}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      >
                        <option value="">-- Ignore --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Purchase Date</label>
                      <select
                        value={mapping['purchase_date'] || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, purchase_date: e.target.value }))}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      >
                        <option value="">-- Ignore --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Serial Number</label>
                      <select
                        value={mapping['serial_number'] || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, serial_number: e.target.value }))}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      >
                        <option value="">-- Ignore --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Custom ID / HDD Name</label>
                      <select
                        value={mapping['custom_id'] || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, custom_id: e.target.value }))}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      >
                        <option value="">-- Ignore --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Power On Hours *</label>
                      <select
                        value={mapping['power_on_hours'] || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, power_on_hours: e.target.value }))}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      >
                        <option value="">-- Ignore --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date</label>
                      <select
                        value={mapping['log_date'] || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, log_date: e.target.value }))}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      >
                        <option value="">-- Ignore --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* live preview of parsed rows */}
          {parsedData.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Live Data Preview ({itemsToImport.length} parsed, {validCount} valid to import)
              </h3>
              
              <div className="border border-slate-800 rounded-xl overflow-x-auto max-h-72">
                <table className="w-full border-collapse text-[11px] sm:text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 font-mono tracking-wide uppercase sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Status</th>
                      <th className="p-3">Matched Serial</th>
                      <th className="p-3">Custom ID</th>
                      <th className="p-3">{importType === 'drives' ? 'Model / Name' : 'POH Value'}</th>
                      <th className="p-3">{importType === 'drives' ? 'Capacities' : 'Log Date'}</th>
                      <th className="p-3">{importType === 'drives' ? 'Location' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {itemsToImport.map((item, index) => {
                      const isValid = importType === 'drives'
                        ? !!item.serial_number
                        : !!(item.serial_number || item.custom_id) && typeof item.power_on_hours === 'number' && !isNaN(item.power_on_hours);

                      return (
                        <tr key={index} className={isValid ? 'hover:bg-slate-800/30' : 'bg-rose-950/10 text-rose-300/80'}>
                          <td className="p-3 font-semibold">
                            {isValid ? (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/40">Valid</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-md bg-rose-950 text-rose-400 border border-rose-800/40">Skip (Missing SN)</span>
                            )}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-200">{item.serial_number || <span className="text-slate-600">None</span>}</td>
                          <td className="p-3 font-mono text-slate-300">{item.custom_id || <span className="text-slate-600">Auto</span>}</td>
                          <td className="p-3 truncate max-w-xs font-medium text-white">
                            {importType === 'drives' ? item.model : `${item.power_on_hours?.toLocaleString()} hours`}
                          </td>
                          <td className="p-3 font-mono">
                            {importType === 'drives' ? (
                              <span>{item.capacity_gb}GB {item.usable_capacity_gb ? `/ ${item.usable_capacity_gb}GB` : ''}</span>
                            ) : (
                              item.log_date
                            )}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                              {importType === 'drives' ? item.location : (item.power_on_count ? `${item.power_on_count} starts` : 'OK')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleImport}
            disabled={loading || validCount === 0}
            className="flex items-center space-x-2 px-5 py-2 text-xs font-semibold rounded-lg text-white bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-600/20 transition-all hover:shadow-sky-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Import {validCount} Entries</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
