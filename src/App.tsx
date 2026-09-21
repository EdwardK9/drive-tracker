import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, ArrowUpDown, HardDrive, Plus, FileText, Server, AlertCircle } from 'lucide-react';
import { Drive, OverviewStats, DriveReceipt, ParsedCrystalDiskInfo } from './types';
import { fetchDrives, fetchStats } from './api';
import { Navbar } from './components/Navbar';
import { StatsOverview } from './components/StatsOverview';
import { DriveCard } from './components/DriveCard';
import { AddDriveModal } from './components/AddDriveModal';
import { CrystalDiskParserModal } from './components/CrystalDiskParserModal';
import { BulkImportModal } from './components/BulkImportModal';
import { DriveDetailModal } from './components/DriveDetailModal';
import { PortainerGuideModal } from './components/PortainerGuideModal';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import { PrintLabelsModal } from './components/PrintLabelsModal';
import { APP_VERSION, APP_BUILD_DATE } from './version';

export function App() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFormFactor, setFilterFormFactor] = useState('All');
  const [filterHealth, setFilterHealth] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState<'id' | 'capacity_desc' | 'poh_desc' | 'temp_desc' | 'purchase_date' | 'warranty'>('id');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isParserModalOpen, setIsParserModalOpen] = useState(false);
  const [isPortainerModalOpen, setIsPortainerModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [printPreselectedDriveId, setPrintPreselectedDriveId] = useState<string | null>(null);
  const [selectedDriveForDetail, setSelectedDriveForDetail] = useState<string | null>(null);
  const [selectedDriveForQuickLog, setSelectedDriveForQuickLog] = useState<Drive | null>(null);
  const [driveToEdit, setDriveToEdit] = useState<Drive | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<DriveReceipt | null>(null);
  const [createFromReportData, setCreateFromReportData] = useState<Partial<Drive> | undefined>(undefined);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [drivesData, statsData] = await Promise.all([
        fetchDrives(),
        fetchStats()
      ]);
      setDrives(drivesData);
      setStats(statsData);
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError(err.message || 'Failed to load drive inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Filtered & Sorted Drives
  const filteredDrives = useMemo(() => {
    return drives
      .filter((drive) => {
        // Search query match: custom_id, serial_number, model, vendor, notes
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          drive.custom_id.toLowerCase().includes(q) ||
          drive.serial_number.toLowerCase().includes(q) ||
          drive.model.toLowerCase().includes(q) ||
          (drive.vendor && drive.vendor.toLowerCase().includes(q)) ||
          (drive.notes && drive.notes.toLowerCase().includes(q));

        // Form Factor filter
        const matchesFormFactor =
          filterFormFactor === 'All' || drive.form_factor === filterFormFactor;

        // Health filter
        const currentHealth = drive.latest_log?.health_status || 'Good';
        const matchesHealth =
          filterHealth === 'All' || currentHealth === filterHealth;

        // Status filter
        const matchesStatus =
          filterStatus === 'All' || drive.status === filterStatus;

        return matchesQuery && matchesFormFactor && matchesHealth && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'capacity_desc') {
          return b.capacity_gb - a.capacity_gb;
        }
        if (sortBy === 'poh_desc') {
          const aPoh = a.latest_log?.power_on_hours ?? a.initial_power_on_hours ?? 0;
          const bPoh = b.latest_log?.power_on_hours ?? b.initial_power_on_hours ?? 0;
          return bPoh - aPoh;
        }
        if (sortBy === 'temp_desc') {
          const aTemp = a.latest_log?.temperature_c ?? 0;
          const bTemp = b.latest_log?.temperature_c ?? 0;
          return bTemp - aTemp;
        }
        if (sortBy === 'purchase_date') {
          return (b.purchase_date || '').localeCompare(a.purchase_date || '');
        }
        if (sortBy === 'warranty') {
          return (a.warranty_expires || '9999').localeCompare(b.warranty_expires || '9999');
        }
        // Default: sort by custom_id
        return (a.custom_id || a.id).localeCompare(b.custom_id || b.id, undefined, { numeric: true });
      });
  }, [drives, searchQuery, filterFormFactor, filterHealth, filterStatus, sortBy]);

  const handleOpenAddWithReport = (parsed: ParsedCrystalDiskInfo) => {
    let formFactor = '3.5" HDD';
    let iface = 'SATA III';
    if (parsed.interface?.includes('NVM') || parsed.transferMode?.includes('PCIe')) {
      formFactor = 'M.2 NVMe';
      iface = 'PCIe 4.0 x4';
    } else if (parsed.model?.toLowerCase().includes('ssd')) {
      formFactor = '2.5" SSD';
    }

    setCreateFromReportData({
      model: parsed.model || '',
      serial_number: parsed.serialNumber || '',
      capacity_gb: parsed.capacityGB || 1000,
      form_factor: formFactor,
      interface: iface,
      initial_power_on_hours: parsed.powerOnHours || 0,
      initial_power_on_count: parsed.powerOnCount || 0
    });
    setDriveToEdit(null);
    setIsAddModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col antialiased">
      {/* Navbar */}
      <Navbar
        stats={stats}
        onOpenAddModal={() => {
          setDriveToEdit(null);
          setCreateFromReportData(undefined);
          setIsAddModalOpen(true);
        }}
        onOpenParserModal={() => {
          setSelectedDriveForQuickLog(null);
          setIsParserModalOpen(true);
        }}
        onOpenPortainerModal={() => setIsPortainerModalOpen(true)}
        onOpenPrintModal={() => {
          setPrintPreselectedDriveId(null);
          setIsPrintModalOpen(true);
        }}
        onOpenBulkImportModal={() => setIsBulkImportOpen(true)}
        onRefresh={loadAll}
        isLoading={loading}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadAll}
              className="px-2.5 py-1 rounded bg-rose-800 hover:bg-rose-700 text-white font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Dashboard Statistics Overview */}
        <StatsOverview stats={stats} />

        {/* Search, Filter & Sort Controls */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 mb-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search input */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID (#DRV-01), Serial Number, Model, or Vendor..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-sky-500 placeholder:text-slate-500 font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-500 hover:text-slate-300"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Form Factor Filter */}
              <div className="flex items-center space-x-1.5 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-700">
                <span className="text-slate-400">Type:</span>
                <select
                  value={filterFormFactor}
                  onChange={(e) => setFilterFormFactor(e.target.value)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="All">All Form Factors</option>
                  <option value='3.5" HDD'>3.5" HDD</option>
                  <option value='2.5" SSD'>2.5" SSD</option>
                  <option value="M.2 NVMe">M.2 NVMe</option>
                  <option value="SAS HDD">SAS HDD</option>
                </select>
              </div>

              {/* Health Filter */}
              <div className="flex items-center space-x-1.5 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-700">
                <span className="text-slate-400">Health:</span>
                <select
                  value={filterHealth}
                  onChange={(e) => setFilterHealth(e.target.value)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="All">All Health States</option>
                  <option value="Good">Good</option>
                  <option value="Caution">Caution / Warning</option>
                  <option value="Bad">Bad / Critical</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-1.5 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-700">
                <span className="text-slate-400">Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active (In Pool)</option>
                  <option value="Spare">Spare</option>
                  <option value="Cold Storage">Cold Storage</option>
                  <option value="RMA">RMA</option>
                </select>
              </div>

              {/* Sort Order */}
              <div className="flex items-center space-x-1.5 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-700">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="id">Sort by Drive ID</option>
                  <option value="capacity_desc">Highest Capacity (TB)</option>
                  <option value="poh_desc">Most Power-On Hours</option>
                  <option value="temp_desc">Highest Temperature</option>
                  <option value="purchase_date">Newest Purchase</option>
                  <option value="warranty">Warranty Expiration</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Drives Grid */}
        {filteredDrives.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl bg-slate-800/40 border border-slate-700/60">
            <HardDrive className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No drives found</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4 max-w-sm mx-auto">
              {searchQuery || filterFormFactor !== 'All' || filterHealth !== 'All'
                ? 'Try adjusting your search query or clear your active filters.'
                : 'Your drive inventory is empty. Add your first hard drive or SSD!'}
            </p>
            <div className="flex items-center justify-center space-x-3">
              {searchQuery || filterFormFactor !== 'All' || filterHealth !== 'All' ? (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterFormFactor('All');
                    setFilterHealth('All');
                    setFilterStatus('All');
                  }}
                  className="px-3.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold"
                >
                  Reset All Filters
                </button>
              ) : (
                <button
                  onClick={() => {
                    setDriveToEdit(null);
                    setCreateFromReportData(undefined);
                    setIsAddModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20"
                >
                  Add Your First Drive
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDrives.map((drive) => (
              <DriveCard
                key={drive.id}
                drive={drive}
                onSelect={(d) => setSelectedDriveForDetail(d.id)}
                onQuickLog={(d) => {
                  setSelectedDriveForQuickLog(d);
                  setIsParserModalOpen(true);
                }}
                onEdit={(d) => {
                  setDriveToEdit(d);
                  setCreateFromReportData(undefined);
                  setIsAddModalOpen(true);
                }}
                onPrint={(d) => {
                  setPrintPreselectedDriveId(d.id);
                  setIsPrintModalOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Application Footer with Version Tracker */}
      <footer className="mt-12 border-t border-slate-800/80 bg-slate-950/40 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-400">Drive Tracker</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-sky-400 font-bold">
              v{APP_VERSION}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 font-mono">Updated {APP_BUILD_DATE}</span>
          </div>

          <div className="flex items-center space-x-4 text-[11px] text-slate-400">
            <span>CrystalDiskInfo SMART &amp; Warranty Inventory</span>
            <span className="text-slate-700 hidden sm:inline">•</span>
            <button
              onClick={() => setIsPortainerModalOpen(true)}
              className="text-sky-400 hover:text-sky-300 hover:underline transition-colors"
            >
              Docker &amp; Portainer Guide
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {/* Base Drive Detail Modal (z-50) */}
      <DriveDetailModal
        driveId={selectedDriveForDetail}
        isOpen={!!selectedDriveForDetail}
        onClose={() => setSelectedDriveForDetail(null)}
        onEdit={(d) => {
          setDriveToEdit(d);
          setIsAddModalOpen(true);
        }}
        onDriveDeleted={() => {
          setSelectedDriveForDetail(null);
          loadAll();
        }}
        onOpenQuickLog={(d) => {
          setSelectedDriveForQuickLog(d);
          setIsParserModalOpen(true);
        }}
        onViewReceipt={(r) => setViewingReceipt(r)}
        onPrintLabel={(d) => {
          setPrintPreselectedDriveId(d.id);
          setIsPrintModalOpen(true);
        }}
      />

      {/* Print Labels Modal (z-[70]) */}
      <PrintLabelsModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setPrintPreselectedDriveId(null);
        }}
        drives={drives}
        preselectedDriveId={printPreselectedDriveId}
      />

      {/* CrystalDiskInfo Parser / Screenshot OCR Modal (z-[70]) */}
      <CrystalDiskParserModal
        isOpen={isParserModalOpen}
        onClose={() => setIsParserModalOpen(false)}
        drives={drives}
        preselectedDrive={selectedDriveForQuickLog}
        onSuccess={() => {
          loadAll();
        }}
        onCreateDriveFromReport={handleOpenAddWithReport}
      />

      {/* Add / Edit Drive Modal (z-[70]) */}
      <AddDriveModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setDriveToEdit(null);
          setCreateFromReportData(undefined);
        }}
        editDrive={driveToEdit}
        existingCount={drives.length}
        initialValues={createFromReportData}
        onSuccess={() => {
          loadAll();
        }}
      />

      {/* Bulk spreadsheet copy paste import modal */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onSuccess={() => {
          loadAll();
        }}
      />

      {/* Portainer & Docker Compose Setup Guide (z-[70]) */}
      <PortainerGuideModal
        isOpen={isPortainerModalOpen}
        onClose={() => setIsPortainerModalOpen(false)}
        onBackupRestored={() => {
          loadAll();
        }}
      />

      {/* Document Viewer Modal (z-[80]) */}
      <DocumentViewerModal
        receipt={viewingReceipt}
        onClose={() => setViewingReceipt(null)}
      />
    </div>
  );
}

export default App;
