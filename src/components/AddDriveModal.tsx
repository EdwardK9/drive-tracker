import React, { useState, useEffect } from 'react';
import { X, HardDrive, Calendar, DollarSign, Shield, Hash, Tag, FileText, AlertCircle, Upload, Check, Copy } from 'lucide-react';
import { Drive } from '../types';
import { createDrive, updateDrive, importBulkDrives } from '../api';

interface AddDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (drive: Drive) => void;
  editDrive?: Drive | null;
  existingCount?: number;
  initialValues?: Partial<Drive>;
}

export const AddDriveModal: React.FC<AddDriveModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editDrive,
  existingCount = 0,
  initialValues
}) => {
  const [customId, setCustomId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [model, setModel] = useState('');
  const [capacityVal, setCapacityVal] = useState<number | string>(18);
  const [capacityUnit, setCapacityUnit] = useState<'TB' | 'GB'>('TB');
  const [usableCapacityVal, setUsableCapacityVal] = useState<number | string>('');
  const [usableCapacityUnit, setUsableCapacityUnit] = useState<'TB' | 'GB'>('TB');
  const [formFactor, setFormFactor] = useState('3.5" HDD');
  const [interfaceType, setInterfaceType] = useState('SATA III');
  const [status, setStatus] = useState<string>('Active');
  const [location, setLocation] = useState('Storage');
  
  // Purchase & Warranty
  const [vendor, setVendor] = useState('');
  const [manufactureDate, setManufactureDate] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<string | number>('');
  const [currency, setCurrency] = useState('USD');
  const [warrantyMonths, setWarrantyMonths] = useState<number | string>(36);
  const [warrantyExpires, setWarrantyExpires] = useState('');
  
  // Initial wear snapshot
  const [initialPoh, setInitialPoh] = useState<number | string>(0);
  const [initialPoc, setInitialPoc] = useState<number | string>(0);
  const [notes, setNotes] = useState('');

  // Batch import states
  const [modalTab, setModalTab] = useState<'single' | 'batch'>('single');
  const [importType, setImportType] = useState<'drives' | 'poh'>('drives');
  const [pasteText, setPasteText] = useState('');
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [importResults, setImportResults] = useState<{ success: boolean; stats: any; errors: string[] } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editDrive) {
      setCustomId(editDrive.custom_id || '');
      setSerialNumber(editDrive.serial_number || '');
      setModel(editDrive.model || '');
      if (editDrive.capacity_gb >= 1000 && editDrive.capacity_gb % 1000 === 0) {
        setCapacityVal(editDrive.capacity_gb / 1000);
        setCapacityUnit('TB');
      } else {
        setCapacityVal(editDrive.capacity_gb);
        setCapacityUnit('GB');
      }

      if (editDrive.usable_capacity_gb) {
        if (editDrive.usable_capacity_gb >= 1000 && editDrive.usable_capacity_gb % 1000 === 0) {
          setUsableCapacityVal(editDrive.usable_capacity_gb / 1000);
          setUsableCapacityUnit('TB');
        } else {
          setUsableCapacityVal(editDrive.usable_capacity_gb);
          setUsableCapacityUnit('GB');
        }
      } else {
        setUsableCapacityVal('');
        setUsableCapacityUnit('TB');
      }

      setFormFactor(editDrive.form_factor || '3.5" HDD');
      setInterfaceType(editDrive.interface || 'SATA III');
      setStatus(editDrive.status || 'Active');
      setLocation(editDrive.location || 'Storage');
      setVendor(editDrive.vendor || '');
      setManufactureDate(editDrive.manufacture_date || '');
      setPurchaseDate(editDrive.purchase_date || '');
      setOrderNumber(editDrive.order_number || '');
      setPurchasePrice(editDrive.purchase_price ?? '');
      setCurrency(editDrive.currency || 'USD');
      setWarrantyMonths(editDrive.warranty_months ?? 36);
      setWarrantyExpires(editDrive.warranty_expires || '');
      setInitialPoh(editDrive.initial_power_on_hours ?? 0);
      setInitialPoc(editDrive.initial_power_on_count ?? 0);
      setNotes(editDrive.notes || '');
      setModalTab('single');
    } else if (initialValues) {
      setCustomId(initialValues.custom_id || `DRV-${String(existingCount + 1).padStart(2, '0')}`);
      setSerialNumber(initialValues.serial_number || '');
      setModel(initialValues.model || '');
      if (initialValues.capacity_gb) {
        if (initialValues.capacity_gb >= 1000) {
          setCapacityVal(initialValues.capacity_gb / 1000);
          setCapacityUnit('TB');
        } else {
          setCapacityVal(initialValues.capacity_gb);
          setCapacityUnit('GB');
        }
      }

      if (initialValues.usable_capacity_gb) {
        if (initialValues.usable_capacity_gb >= 1000) {
          setUsableCapacityVal(initialValues.usable_capacity_gb / 1000);
          setUsableCapacityUnit('TB');
        } else {
          setUsableCapacityVal(initialValues.usable_capacity_gb);
          setUsableCapacityUnit('GB');
        }
      } else {
        setUsableCapacityVal('');
        setUsableCapacityUnit('TB');
      }

      setFormFactor(initialValues.form_factor || '3.5" HDD');
      setInterfaceType(initialValues.interface || 'SATA III');
      setManufactureDate(initialValues.manufacture_date || '');
      setInitialPoh(initialValues.initial_power_on_hours ?? 0);
      setInitialPoc(initialValues.initial_power_on_count ?? 0);
      setNotes(initialValues.notes || '');
      setLocation(initialValues.location || 'Storage');
      setModalTab('single');
    } else {
      // Default new drive
      setCustomId(`DRV-${String(existingCount + 1).padStart(2, '0')}`);
      setSerialNumber('');
      setModel('');
      setCapacityVal(18);
      setCapacityUnit('TB');
      setUsableCapacityVal('');
      setUsableCapacityUnit('TB');
      setFormFactor('3.5" HDD');
      setInterfaceType('SATA III');
      setStatus('Active');
      setLocation('Storage');
      setVendor('');
      setManufactureDate('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setOrderNumber('');
      setPurchasePrice('');
      setCurrency('USD');
      setWarrantyMonths(36);
      setWarrantyExpires('');
      setInitialPoh(0);
      setInitialPoc(0);
      setNotes('');
      setModalTab('single');
      setPasteText('');
      setParsedItems([]);
      setImportResults(null);
    }
    setError(null);
  }, [editDrive, initialValues, existingCount, isOpen]);

  // Auto-calculate warranty expiration date when purchaseDate or warrantyMonths changes
  useEffect(() => {
    if (purchaseDate && warrantyMonths) {
      const months = parseInt(String(warrantyMonths), 10);
      if (!isNaN(months) && months > 0) {
        const d = new Date(purchaseDate);
        if (!isNaN(d.getTime())) {
          d.setMonth(d.getMonth() + months);
          setWarrantyExpires(d.toISOString().split('T')[0]);
        }
      }
    }
  }, [purchaseDate, warrantyMonths]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!serialNumber.trim()) {
      setError('Serial number is required.');
      return;
    }
    if (!model.trim()) {
      setError('Model name is required.');
      return;
    }

    const numCap = parseFloat(String(capacityVal));
    if (isNaN(numCap) || numCap <= 0) {
      setError('Please provide a valid capacity.');
      return;
    }

    const finalCapacityGb = capacityUnit === 'TB' ? Math.round(numCap * 1000) : Math.round(numCap);

    let usableCapacityGb: number | null = null;
    if (usableCapacityVal !== '') {
      const numUsable = parseFloat(String(usableCapacityVal));
      if (!isNaN(numUsable) && numUsable > 0) {
        usableCapacityGb = usableCapacityUnit === 'TB' ? Math.round(numUsable * 1000) : Math.round(numUsable);
      }
    }

    setLoading(true);
    try {
      const payload: Partial<Drive> = {
        custom_id: customId.trim() || `DRV-${String(existingCount + 1).padStart(2, '0')}`,
        serial_number: serialNumber.trim(),
        model: model.trim(),
        capacity_gb: finalCapacityGb,
        usable_capacity_gb: usableCapacityGb,
        form_factor: formFactor,
        interface: interfaceType,
        status: status as any,
        location,
        vendor: vendor.trim() || null,
        manufacture_date: manufactureDate || null,
        purchase_date: purchaseDate || null,
        order_number: orderNumber.trim() || null,
        purchase_price: purchasePrice !== '' ? parseFloat(String(purchasePrice)) : null,
        currency,
        warranty_months: warrantyMonths !== '' ? parseInt(String(warrantyMonths), 10) : 36,
        warranty_expires: warrantyExpires || null,
        initial_power_on_hours: initialPoh !== '' ? parseInt(String(initialPoh), 10) : 0,
        initial_power_on_count: initialPoc !== '' ? parseInt(String(initialPoc), 10) : 0,
        notes: notes.trim() || null
      };

      let result: Drive;
      if (editDrive) {
        result = await updateDrive(editDrive.id, payload);
      } else {
        result = await createDrive(payload);
      }

      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save drive.');
    } finally {
      setLoading(false);
    }
  };

  // TSV & CSV Excel pasted table parser
  const parsePastedTable = (rawText: string, type: 'drives' | 'poh') => {
    if (!rawText.trim()) return [];
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];

    let hasHeader = false;
    let firstLineCols = lines[0].split('\t');
    if (firstLineCols.length <= 1) {
      firstLineCols = lines[0].split(',');
    }

    const headerIndices: Record<string, number> = {};
    const matches = (col: string, keywords: string[]) => {
      const val = col.toLowerCase().trim();
      return keywords.some(keyword => val.includes(keyword));
    };

    firstLineCols.forEach((col, idx) => {
      const c = col.replace(/["']/g, '');
      if (matches(c, ['serial', 's/n', 'sn'])) {
        headerIndices['serial_number'] = idx;
        hasHeader = true;
      } else if (matches(c, ['drive name', 'hard drive name', 'model', 'name'])) {
        headerIndices['model'] = idx;
        hasHeader = true;
      } else if (matches(c, ['drive number', 'hard drive number', 'custom id', 'custom_id', 'id', 'number'])) {
        headerIndices['custom_id'] = idx;
        hasHeader = true;
      } else if (matches(c, ['raw capacity', 'raw', 'capacity_gb', 'capacity'])) {
        headerIndices['capacity'] = idx;
        hasHeader = true;
      } else if (matches(c, ['usable capacity', 'usable', 'usable_capacity_gb'])) {
        headerIndices['usable_capacity'] = idx;
        hasHeader = true;
      } else if (matches(c, ['health'])) {
        headerIndices['health'] = idx;
        hasHeader = true;
      } else if (matches(c, ['purchase date', 'purchased', 'date'])) {
        headerIndices['purchase_date'] = idx;
        hasHeader = true;
      } else if (matches(c, ['purchase place', 'vendor', 'place', 'store'])) {
        headerIndices['vendor'] = idx;
        hasHeader = true;
      } else if (matches(c, ['format', 'size', 'inch', 'form factor'])) {
        headerIndices['form_factor'] = idx;
        hasHeader = true;
      } else if (matches(c, ['location'])) {
        headerIndices['location'] = idx;
        hasHeader = true;
      } else if (matches(c, ['poh', 'power-on hours', 'power on hours', 'hours', 'poh_hours'])) {
        headerIndices['poh'] = idx;
        hasHeader = true;
      }
    });

    const startIndex = hasHeader ? 1 : 0;
    const items: any[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      let cols = lines[i].split('\t');
      if (cols.length <= 1) {
        cols = lines[i].split(',');
      }
      // Remove enclosing quotes if Excel added them
      cols = cols.map(c => c.replace(/^["']|["']$/g, '').trim());

      if (type === 'drives') {
        const serial_number = hasHeader && headerIndices['serial_number'] !== undefined ? cols[headerIndices['serial_number']] : cols[0];
        const modelName = hasHeader && headerIndices['model'] !== undefined ? cols[headerIndices['model']] : cols[1];
        const customIdVal = hasHeader && headerIndices['custom_id'] !== undefined ? cols[headerIndices['custom_id']] : cols[2];
        const capacityRaw = hasHeader && headerIndices['capacity'] !== undefined ? cols[headerIndices['capacity']] : cols[3];
        const usableRaw = hasHeader && headerIndices['usable_capacity'] !== undefined ? cols[headerIndices['usable_capacity']] : cols[4];
        const health = hasHeader && headerIndices['health'] !== undefined ? cols[headerIndices['health']] : cols[5];
        const purchaseDateVal = hasHeader && headerIndices['purchase_date'] !== undefined ? cols[headerIndices['purchase_date']] : cols[6];
        const vendorVal = hasHeader && headerIndices['vendor'] !== undefined ? cols[headerIndices['vendor']] : cols[7];
        const formatRaw = hasHeader && headerIndices['form_factor'] !== undefined ? cols[headerIndices['form_factor']] : cols[8];
        const locVal = hasHeader && headerIndices['location'] !== undefined ? cols[headerIndices['location']] : cols[9];
        const pohRaw = hasHeader && headerIndices['poh'] !== undefined ? cols[headerIndices['poh']] : cols[10];

        if (!serial_number) continue;

        const cleanSerial = serial_number.trim().toUpperCase();
        const cleanModel = modelName ? modelName.trim() : 'Unknown Model';

        let capacity_gb = 18000;
        if (capacityRaw) {
          const cleaned = capacityRaw.replace(/[^\d.]/g, '');
          const numVal = parseFloat(cleaned);
          if (!isNaN(numVal)) {
            capacity_gb = numVal <= 40 ? Math.round(numVal * 1000) : Math.round(numVal);
          }
        }

        let usable_capacity_gb: number | null = null;
        if (usableRaw) {
          const cleaned = usableRaw.replace(/[^\d.]/g, '');
          const numVal = parseFloat(cleaned);
          if (!isNaN(numVal)) {
            usable_capacity_gb = numVal <= 40 ? Math.round(numVal * 1000) : Math.round(numVal);
          }
        }

        let form_factor = '3.5" HDD';
        if (formatRaw) {
          const fl = formatRaw.toLowerCase();
          if (fl.includes('2.5') || fl.includes('ssd') || fl.includes('m.2')) {
            form_factor = '2.5" SSD';
          }
        }

        let cleanLocation = locVal ? locVal.trim() : 'Storage';
        let statusVal = 'Active';
        if (cleanLocation.toLowerCase() === 'replaced') {
          statusVal = 'Replaced';
        }

        let purchase_date = purchaseDateVal ? purchaseDateVal.trim() : null;
        if (purchase_date) {
          const parts = purchase_date.split(/[-/.]/);
          if (parts.length === 3) {
            let year = parts[0];
            let month = parts[1];
            let day = parts[2];
            if (year.length !== 4 && day.length === 4) {
              year = parts[2];
              day = parts[1];
              month = parts[0];
            }
            if (year.length === 4) {
              purchase_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
          }
        }

        let initial_power_on_hours = 0;
        if (pohRaw) {
          const cleaned = pohRaw.replace(/[^\d]/g, '');
          const numVal = parseInt(cleaned, 10);
          if (!isNaN(numVal)) initial_power_on_hours = numVal;
        }

        items.push({
          serial_number: cleanSerial,
          model: cleanModel,
          custom_id: customIdVal ? customIdVal.trim() : null,
          capacity_gb,
          usable_capacity_gb,
          form_factor,
          interface: 'SATA III',
          status: statusVal,
          location: cleanLocation,
          vendor: vendorVal ? vendorVal.trim() : null,
          purchase_date,
          initial_power_on_hours,
          health_status: health ? health.trim() : 'Good',
          notes: 'Imported from Excel table.'
        });
      } else {
        // POH logs import
        const serial_number = hasHeader && headerIndices['serial_number'] !== undefined ? cols[headerIndices['serial_number']] : cols[0];
        const customIdVal = hasHeader && headerIndices['custom_id'] !== undefined ? cols[headerIndices['custom_id']] : cols[1];
        const pohRaw = hasHeader && headerIndices['poh'] !== undefined ? cols[headerIndices['poh']] : cols[2];
        const purchaseDateVal = hasHeader && headerIndices['purchase_date'] !== undefined ? cols[headerIndices['purchase_date']] : cols[3];
        const health = hasHeader && headerIndices['health'] !== undefined ? cols[headerIndices['health']] : cols[4];

        if (!serial_number && !customIdVal) continue;

        let power_on_hours = 0;
        if (pohRaw) {
          const cleaned = pohRaw.replace(/[^\d]/g, '');
          const numVal = parseInt(cleaned, 10);
          if (!isNaN(numVal)) power_on_hours = numVal;
        }

        let log_date = purchaseDateVal ? purchaseDateVal.trim() : new Date().toISOString().split('T')[0];
        if (log_date) {
          const parts = log_date.split(/[-/.]/);
          if (parts.length === 3) {
            let year = parts[0];
            let month = parts[1];
            let day = parts[2];
            if (year.length !== 4 && day.length === 4) {
              year = parts[2];
              day = parts[1];
              month = parts[0];
            }
            if (year.length === 4) {
              log_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
          }
        }

        items.push({
          serial_number: serial_number ? serial_number.trim().toUpperCase() : null,
          custom_id: customIdVal ? customIdVal.trim() : null,
          power_on_hours,
          log_date,
          health_status: health ? health.trim() : 'Good'
        });
      }
    }

    return items;
  };

  const handleTextPaste = (text: string) => {
    setPasteText(text);
    try {
      const items = parsePastedTable(text, importType);
      setParsedItems(items);
    } catch (e) {
      setParsedItems([]);
    }
  };

  const handleBatchImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setImportResults(null);

    if (parsedItems.length === 0) {
      setError('No valid rows parsed. Make sure you pasted columns from Excel.');
      return;
    }

    setLoading(true);
    try {
      const res = await importBulkDrives(importType, parsedItems);
      setImportResults({
        success: res.success,
        stats: res.stats,
        errors: res.stats.failures.map((f: any) => `${f.item.serial_number || f.item.custom_id || 'Unknown Row'}: ${f.reason}`)
      });
      
      // If we imported drives successfully, let's trigger a light success refresh
      if (res.stats.inserted > 0 || res.stats.updated > 0 || res.stats.logsInserted > 0) {
        // Build a mock/partial drive result to refresh main screen
        const fakeDrive: any = { id: 'refresh' };
        setTimeout(() => {
          onSuccess(fakeDrive);
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to bulk import Excel data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="add-drive-modal-overlay"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="add-drive-modal-card"
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl my-8 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-sky-950/80 border border-sky-800/80 text-sky-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {editDrive ? 'Edit Drive Inventory' : 'Add Drives to Inventory'}
              </h2>
              <p className="text-xs text-slate-400">
                {editDrive ? 'Modify single drive configuration' : 'Add drives manually or paste an Excel table'}
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

        {/* Tab Selection (only visible when not editing) */}
        {!editDrive && (
          <div className="flex border-b border-slate-800 bg-slate-900 px-6">
            <button
              type="button"
              onClick={() => {
                setModalTab('single');
                setError(null);
              }}
              className={`py-3 px-4 text-xs uppercase tracking-wider font-bold border-b-2 transition-all ${
                modalTab === 'single'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Single Manual Entry
            </button>
            <button
              type="button"
              onClick={() => {
                setModalTab('batch');
                setError(null);
              }}
              className={`py-3 px-4 text-xs uppercase tracking-wider font-bold border-b-2 transition-all flex items-center space-x-2 ${
                modalTab === 'batch'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Excel Copy-Paste Table</span>
            </button>
          </div>
        )}

        {/* Modal Container */}
        <div className="max-h-[75vh] overflow-y-auto">
          {modalTab === 'single' ? (
            /* ================== MANUAL ENTRY FORM ================== */
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="flex items-center space-x-2 p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Section 1: Identification & Physical Tag */}
              <div>
                <h3 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>1. Drive Inventory & Identification</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Custom Assigned ID */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Custom Assigned ID <span className="text-slate-500">(label)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-mono text-xs">
                        #
                      </span>
                      <input
                        type="text"
                        required
                        value={customId}
                        onChange={(e) => setCustomId(e.target.value)}
                        placeholder="e.g. DRV-01, Bay-3"
                        className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Matches your drive caddies or bays.
                    </p>
                  </div>

                  {/* Serial Number */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Serial Number <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. ZR50ABCD, 9LGE24KX"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500 font-mono uppercase"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Indexed for CrystalDiskInfo matching.
                    </p>
                  </div>

                  {/* Manufacture Date (DOM) */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                      <span>Manufacture Date</span>
                      <span className="text-[10px] text-amber-400/90 font-mono">Age / Risk</span>
                    </label>
                    <input
                      type="date"
                      value={manufactureDate}
                      onChange={(e) => setManufactureDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Printed on drive label (DOM).
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 2: Hardware Specs */}
              <div className="pt-2 border-t border-slate-800">
                <h3 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>2. Hardware Specifications</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {/* Model */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Drive Model <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. ST18000NM000J, WDC WD140EFGX"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Capacity */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Raw Capacity <span className="text-rose-400">*</span>
                    </label>
                    <div className="flex">
                      <input
                        type="number"
                        step="any"
                        required
                        min="1"
                        value={capacityVal}
                        onChange={(e) => setCapacityVal(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-r-0 border-slate-700 rounded-l-lg text-white text-sm focus:outline-none focus:border-sky-500 font-mono"
                      />
                      <select
                        value={capacityUnit}
                        onChange={(e) => setCapacityUnit(e.target.value as 'TB' | 'GB')}
                        className="px-2 bg-slate-700 border border-slate-700 rounded-r-lg text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
                      >
                        <option value="TB">TB</option>
                        <option value="GB">GB</option>
                      </select>
                    </div>
                  </div>

                  {/* Usable Capacity */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                      <span>Usable Capacity</span>
                      <span className="text-[10px] text-slate-500">Optional</span>
                    </label>
                    <div className="flex">
                      <input
                        type="number"
                        step="any"
                        min="1"
                        value={usableCapacityVal}
                        onChange={(e) => setUsableCapacityVal(e.target.value)}
                        placeholder="e.g. 16.3"
                        className="w-full px-3 py-2 bg-slate-800 border border-r-0 border-slate-700 rounded-l-lg text-white text-sm focus:outline-none focus:border-sky-500 font-mono"
                      />
                      <select
                        value={usableCapacityUnit}
                        onChange={(e) => setUsableCapacityUnit(e.target.value as 'TB' | 'GB')}
                        className="px-2 bg-slate-700 border border-slate-700 rounded-r-lg text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
                      >
                        <option value="TB">TB</option>
                        <option value="GB">GB</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-3">
                  {/* Form Factor */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Form Factor
                    </label>
                    <select
                      value={formFactor}
                      onChange={(e) => setFormFactor(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    >
                      <option value='3.5" HDD'>3.5" HDD</option>
                      <option value='2.5" SSD'>2.5" SSD</option>
                      <option value="M.2 NVMe">M.2 NVMe</option>
                      <option value="SAS HDD">SAS HDD</option>
                      <option value="U.2 NVMe">U.2 NVMe</option>
                      <option value="External USB">External USB</option>
                    </select>
                  </div>

                  {/* Interface */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Interface
                    </label>
                    <select
                      value={interfaceType}
                      onChange={(e) => setInterfaceType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    >
                      <option value="SATA III">SATA III (6 Gbps)</option>
                      <option value="PCIe 4.0 x4">PCIe 4.0 x4</option>
                      <option value="PCIe 3.0 x4">PCIe 3.0 x4</option>
                      <option value="SAS 12Gbps">SAS 12 Gbps</option>
                      <option value="PCIe 5.0 x4">PCIe 5.0 x4</option>
                      <option value="USB 3.2">USB 3.2</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Drive Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    >
                      <option value="Active">Active (In Pool)</option>
                      <option value="Spare">Cold / Hot Spare</option>
                      <option value="Cold Storage">Cold Storage / Backup</option>
                      <option value="RMA">RMA in Progress</option>
                      <option value="Failed">Failed / Decommissioned</option>
                      <option value="Replaced">Replaced (Reference Only)</option>
                    </select>
                  </div>

                  {/* Physical Location */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Physical Location
                    </label>
                    <input
                      type="text"
                      list="location-options"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Storage, Server, House..."
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    />
                    <datalist id="location-options">
                      <option value="Storage" />
                      <option value="House" />
                      <option value="Server" />
                      <option value="Replaced" />
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Section 3: Purchase & Warranty Tracking */}
              <div className="pt-2 border-t border-slate-800">
                <h3 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>3. Purchase & Warranty Tracking</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Vendor */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Vendor / Store
                    </label>
                    <input
                      type="text"
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      placeholder="e.g. ServerPartDeals, Amazon"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Purchase Date */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Purchase Date
                    </label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Order Number */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Order Number
                    </label>
                    <input
                      type="text"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      placeholder="e.g. 112-892182-0192"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                  {/* Purchase Price */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Purchase Price ($)
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                        placeholder="199.99"
                        className="w-full pl-7 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Warranty Length (Months) */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Warranty Length (Months)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={warrantyMonths}
                      onChange={(e) => setWarrantyMonths(e.target.value)}
                      placeholder="36"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  {/* Expiration Date (Calculated) */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Warranty Expiration
                    </label>
                    <input
                      type="date"
                      value={warrantyExpires}
                      onChange={(e) => setWarrantyExpires(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500 font-mono text-sky-400 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Initial State Snapshot */}
              <div className="pt-2 border-t border-slate-800">
                <h3 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>4. Initial State Snapshot (At Delivery / Purchase)</span>
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  Record baseline hours on day 1 (vital for shucked or manufacturer recertified enterprise drives to verify seller wear claim).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Initial Power-On Hours (POH)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={initialPoh}
                      onChange={(e) => setInitialPoh(e.target.value)}
                      placeholder="0 (Brand new) or e.g. 8200 (Refurb)"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Initial Power-On Count (POC)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={initialPoc}
                      onChange={(e) => setInitialPoc(e.target.value)}
                      placeholder="0 (Brand new) or e.g. 24"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Custom Notes & Location */}
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Custom Notes & Enclosure Location
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. TrueNAS Alpha pool, Top Left Bay #2. Shucked from WD Elements enclosure, passes SMART long test."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Form Actions */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold shadow-md shadow-sky-600/20 transition-all disabled:opacity-50"
                >
                  {loading ? 'Saving...' : editDrive ? 'Update Drive' : 'Add to Inventory'}
                </button>
              </div>
            </form>
          ) : (
            /* ================== EXCEL COPY-PASTE BATCH IMPORT ================== */
            <div className="p-6 space-y-5">
              {importResults ? (
                /* SUCCESS / ERROR STATS PREVIEW */
                <div className="space-y-4">
                  <div className="flex items-center space-x-2.5 p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-emerald-300">
                    <div className="p-1.5 rounded-lg bg-emerald-900/60 border border-emerald-700">
                      <Check className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Excel Import Complete!</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Completed with {importResults.errors.length} failed rows out of {importResults.stats.inserted + importResults.stats.updated + importResults.stats.failures.length}.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                      <div className="text-2xl font-bold text-emerald-400 font-mono">{importResults.stats.inserted}</div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Drives Inserted</div>
                    </div>
                    <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                      <div className="text-2xl font-bold text-sky-400 font-mono">{importResults.stats.updated || importResults.stats.logsInserted || 0}</div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Logs Recorded</div>
                    </div>
                    <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                      <div className="text-2xl font-bold text-rose-400 font-mono">{importResults.stats.failures.length}</div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Skip / Failure</div>
                    </div>
                  </div>

                  {importResults.errors.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                      <div className="text-xs font-semibold text-rose-300 flex items-center space-x-1">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Skipped / Duplicate Serial Numbers:</span>
                      </div>
                      <div className="max-h-36 overflow-y-auto text-[11px] font-mono text-slate-400 space-y-1 divide-y divide-slate-800/40">
                        {importResults.errors.map((err, i) => (
                          <div key={i} className="pt-1 text-rose-400/90 leading-relaxed">
                            • {err}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setImportResults(null);
                        setPasteText('');
                        setParsedItems([]);
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Paste Another Table
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-sky-600/20 transition-all"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* EXCEL INPUT AND PARSED PREVIEW */
                <form onSubmit={handleBatchImportSubmit} className="space-y-4">
                  {error && (
                    <div className="flex items-center space-x-2 p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Select Import Mode */}
                  <div className="bg-slate-950/50 p-3.5 border border-slate-800 rounded-xl space-y-2">
                    <label className="block text-xs font-semibold text-sky-400 uppercase tracking-wider">
                      Step 1: Choose Import Target
                    </label>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setImportType('drives');
                          setPasteText('');
                          setParsedItems([]);
                        }}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          importType === 'drives'
                            ? 'bg-sky-950/30 border-sky-500/80 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center space-x-2">
                          <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                          <span>Main Drive Inventory</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Bulk import model, SN, capacities, locations & status.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setImportType('poh');
                          setPasteText('');
                          setParsedItems([]);
                        }}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          importType === 'poh'
                            ? 'bg-sky-950/30 border-sky-500/80 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center space-x-2">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>Historical Power-On Hours</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Log/append historic hours values over time for wear charts.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Paste Text Area */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-300">
                      <span>Step 2: Paste Excel Rows (includes headers)</span>
                      <span className="text-[10px] text-slate-500 font-normal">TSV or CSV format supported</span>
                    </div>

                    <textarea
                      rows={5}
                      value={pasteText}
                      onChange={(e) => handleTextPaste(e.target.value)}
                      placeholder={
                        importType === 'drives'
                          ? "Serial Number\tModel Name\tCustom ID\tRaw Capacity\tUsable Capacity\tHealth\tPurchase Date\tVendor\tFormat\tLocation\tPower-on Hours\nZR50ABCD\tST18000NM000J\tDRV-01\t18 TB\t16.3 TB\tGood\t2025-01-15\tAmazon\t3.5 inch\tServer\t240"
                          : "Serial Number\tCustom ID\tPower-On Hours\tLog Date\tHealth\nZR50ABCD\tDRV-01\t4820\t2025-03-20\tGood"
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Simply select multiple cells in your spreadsheet, press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">Ctrl+C</kbd>, click inside the box above, and press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">Ctrl+V</kbd>. Column headers are automatically detected.
                    </p>
                  </div>

                  {/* Parse Results Preview Grid */}
                  {parsedItems.length > 0 && (
                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                      <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-300">
                          Step 3: Parse Verification ({parsedItems.length} rows detected)
                        </span>
                        <span className="text-[10px] text-emerald-400 font-mono font-semibold flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                          <span>Ready for import</span>
                        </span>
                      </div>
                      <div className="max-h-48 overflow-y-auto text-xs">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 text-[10px] uppercase tracking-wider">
                              {importType === 'drives' ? (
                                <>
                                  <th className="px-3 py-2 text-left">Serial</th>
                                  <th className="px-3 py-2 text-left">Model Name</th>
                                  <th className="px-3 py-2 text-left">Assigned ID</th>
                                  <th className="px-3 py-2 text-left">Raw Cap</th>
                                  <th className="px-3 py-2 text-left">Usable</th>
                                  <th className="px-3 py-2 text-left">Location</th>
                                </>
                              ) : (
                                <>
                                  <th className="px-3 py-2 text-left">Serial / ID</th>
                                  <th className="px-3 py-2 text-left">Hours (POH)</th>
                                  <th className="px-3 py-2 text-left">Log Date</th>
                                  <th className="px-3 py-2 text-left">Health Status</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
                            {parsedItems.slice(0, 5).map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-800/30 text-slate-300">
                                {importType === 'drives' ? (
                                  <>
                                    <td className="px-3 py-1.5 text-sky-400 font-semibold">{item.serial_number}</td>
                                    <td className="px-3 py-1.5 truncate max-w-[120px]">{item.model}</td>
                                    <td className="px-3 py-1.5">{item.custom_id || '-'}</td>
                                    <td className="px-3 py-1.5">{(item.capacity_gb / 1000).toFixed(0)} TB</td>
                                    <td className="px-3 py-1.5">{item.usable_capacity_gb ? `${(item.usable_capacity_gb / 1000).toFixed(1)} TB` : '-'}</td>
                                    <td className="px-3 py-1.5">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                        item.status === 'Replaced' ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40' : 'bg-slate-800 text-slate-300'
                                      }`}>
                                        {item.location}
                                      </span>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-3 py-1.5 text-sky-400 font-semibold">{item.serial_number || item.custom_id}</td>
                                    <td className="px-3 py-1.5 text-slate-100">{item.power_on_hours.toLocaleString()} hrs</td>
                                    <td className="px-3 py-1.5 text-slate-400">{item.log_date}</td>
                                    <td className="px-3 py-1.5">{item.health_status}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                            {parsedItems.length > 5 && (
                              <tr className="bg-slate-900/20 text-slate-500 italic">
                                <td colSpan={importType === 'drives' ? 6 : 4} className="px-3 py-1.5 text-center text-xs">
                                  Showing top 5 rows. There are {parsedItems.length - 5} additional row(s) to be imported.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Batch Import Action Buttons */}
                  <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || parsedItems.length === 0}
                      className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold shadow-md shadow-sky-600/20 transition-all disabled:opacity-50 flex items-center space-x-2"
                    >
                      {loading ? (
                        <span>Importing...</span>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Finalize Bulk Import</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
