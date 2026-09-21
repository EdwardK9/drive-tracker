import React, { useState, useEffect } from 'react';
import { Calendar, X, Check, Clock, AlertCircle } from 'lucide-react';
import { Drive } from '../types';
import { quickUpdateManufactureDate } from '../api';

interface QuickSetDomModalProps {
  isOpen: boolean;
  onClose: () => void;
  drive: Drive | null;
  onSaved: (updatedDrive: Drive) => void;
}

export const QuickSetDomModal: React.FC<QuickSetDomModalProps> = ({
  isOpen,
  onClose,
  drive,
  onSaved
}) => {
  const [dateValue, setDateValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (drive) {
      setDateValue(drive.manufacture_date || '');
      setError(null);
    }
  }, [drive, isOpen]);

  if (!isOpen || !drive) return null;

  // Real-time preview calculation
  let agePreview = '';
  let dutyCyclePreview = '';
  if (dateValue) {
    const mfg = new Date(dateValue);
    if (!isNaN(mfg.getTime())) {
      const diffMs = Date.now() - mfg.getTime();
      const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const ageMonths = Math.floor(diffDays / 30.4375);
      const years = Math.floor(ageMonths / 12);
      const months = ageMonths % 12;
      agePreview = years > 0 ? `${years} yr${years > 1 ? 's' : ''}${months > 0 ? `, ${months} mo${months > 1 ? 's' : ''}` : ''}` : `${months} mos`;

      const poh = drive.latest_log?.power_on_hours ?? drive.initial_power_on_hours ?? 0;
      const totalHours = diffDays * 24;
      if (totalHours > 0) {
        const dc = Math.min(100, Math.round((poh / totalHours) * 100));
        dutyCyclePreview = `${dc}% active duty cycle (${poh.toLocaleString()} hrs / ${totalHours.toLocaleString()} cal hrs)`;
      }
    }
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await quickUpdateManufactureDate(drive.id, dateValue ? dateValue.trim() : null);
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save manufacture date');
    } finally {
      setSaving(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const yearPresets = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4, currentYear - 5, currentYear - 6];

  return (
    <div
      id="quick-set-dom-modal-overlay"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="quick-set-dom-modal-card"
        className="relative w-full max-w-md bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-teal-950/80 border border-teal-800/80 text-teal-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Set Manufacture Date (DOM)</h3>
              <p className="text-xs text-slate-400 font-mono">
                {drive.custom_id} • {drive.model}
              </p>
            </div>
          </div>
          <button
            id="close-quick-dom-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            The <strong>Date of Manufacture (DOM)</strong> is printed on the physical disk label (e.g.{' '}
            <code className="text-sky-300 font-mono bg-slate-800/80 px-1 py-0.5 rounded">DOM: 21DEC2019</code> or{' '}
            <code className="text-sky-300 font-mono bg-slate-800/80 px-1 py-0.5 rounded">2019-12</code>).
            Setting this accurately calculates physical shelf age and operational duty cycle without conflating calendar age with spindle hours.
          </p>

          {error && (
            <div className="flex items-center space-x-2 p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Manufacture Date (YYYY-MM-DD)
            </label>
            <input
              id="manufacture-date-quick-input"
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Quick Year Presets */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
              Quick Year Select:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {yearPresets.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setDateValue(`${yr}-01-01`)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
                >
                  {yr}
                </button>
              ))}
              {dateValue && (
                <button
                  type="button"
                  onClick={() => setDateValue('')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/60 transition-colors"
                >
                  Clear Date
                </button>
              )}
            </div>
          </div>

          {/* Real-time calculated preview */}
          {agePreview && (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-teal-900/50 space-y-1">
              <div className="flex items-center space-x-2 text-teal-400 text-xs font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>Calculated Physical Age: {agePreview}</span>
              </div>
              {dutyCyclePreview && (
                <p className="text-[11px] text-slate-400">
                  {dutyCyclePreview}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            id="save-quick-dom-modal-btn"
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white shadow-lg shadow-teal-950 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Manufacture Date'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
