import React from 'react';
import { X, Download, FileText, ExternalLink } from 'lucide-react';
import { DriveReceipt } from '../types';

interface DocumentViewerModalProps {
  receipt: DriveReceipt | null;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  receipt,
  onClose
}) => {
  if (!receipt) return null;

  const fileUrl = `/uploads/${receipt.filename}`;
  const isPdf = receipt.file_type.includes('pdf') || receipt.filename.endsWith('.pdf');
  const isImage = receipt.file_type.startsWith('image/');

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-800 text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white truncate max-w-md">
                {receipt.label || receipt.original_name}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {receipt.original_name} • {(receipt.file_size / 1024).toFixed(1)} KB • {new Date(receipt.uploaded_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={fileUrl}
              download={receipt.original_name}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </a>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Open in new window"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="flex-1 bg-slate-950 p-4 overflow-auto flex items-center justify-center">
          {isPdf ? (
            <iframe
              src={fileUrl}
              title={receipt.original_name}
              className="w-full h-full rounded-lg border border-slate-800 bg-white"
            />
          ) : isImage ? (
            <img
              src={fileUrl}
              alt={receipt.label || receipt.original_name}
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            />
          ) : (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-medium">Binary document</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">Preview not available in browser</p>
              <a
                href={fileUrl}
                download={receipt.original_name}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
              >
                Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
