import React, { useState, useEffect } from 'react';
import { X, HardDrive, Calendar, DollarSign, Shield, Hash, Tag, FileText, AlertCircle } from 'lucide-react';
import { Drive } from '../types';
import { createDrive, updateDrive } from '../api';

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
  const [formFactor, setFormFactor] = useState('3.5" HDD');
  const [interfaceType, setInterfaceType] = useState('SATA III');
  const [status, setStatus] = useState<'Active' | 'Spare' | 'Cold Storage' | 'RMA' | 'Failed'>('Active');
  
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
      setFormFactor(editDrive.form_factor || '3.5" HDD');
      setInterfaceType(editDrive.interface || 'SATA III');
      setStatus(editDrive.status || 'Active');
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
      setFormFactor(initialValues.form_factor || '3.5" HDD');
      setInterfaceType(initialValues.interface || 'SATA III');
      setManufactureDate(initialValues.manufacture_date || '');
      setInitialPoh(initialValues.initial_power_on_hours ?? 0);
      setInitialPoc(initialValues.initial_power_on_count ?? 0);
      setNotes(initialValues.notes || '');
    } else {
      // Default new drive
      setCustomId(`DRV-${String(existingCount + 1).padStart(2, '0')}`);
      setSerialNumber('');
      setModel('');
      setCapacityVal(18);
      setCapacityUnit('TB');
      setFormFactor('3.5" HDD');
      setInterfaceType('SATA III');
      setStatus('Active');
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

    setLoading(true);
    try {
      const payload: Partial<Drive> = {
        custom_id: customId.trim() || `DRV-${String(existingCount + 1).padStart(2, '0')}`,
        serial_number: serialNumber.trim(),
        model: model.trim(),
        capacity_gb: finalCapacityGb,
        form_factor: formFactor,
        interface: interfaceType,
        status,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-sky-950/80 border border-sky-800/80 text-sky-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {editDrive ? 'Edit Drive Inventory' : 'Add Drive to Inventory'}
              </h2>
              <p className="text-xs text-slate-400">
                Configure physical label ID, serial number, hardware specs and warranty
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  placeholder="e.g. ST18000NM000J, WDC WD140EFGX, Samsung 990 PRO"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Capacity */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Capacity <span className="text-rose-400">*</span>
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
                    className="px-2.5 py-2 bg-slate-700 border border-slate-700 rounded-r-lg text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="TB">TB</option>
                    <option value="GB">GB</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
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
                </select>
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
      </div>
    </div>
  );
};
