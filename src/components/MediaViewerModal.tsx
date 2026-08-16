import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ExternalLink, 
  FileImage,
  FileText
} from 'lucide-react';

interface MediaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaName?: string | null;
  senderName?: string | null;
  timestamp?: string | null;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  isOpen,
  onClose,
  mediaUrl,
  mediaName,
  senderName,
  timestamp
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const isPdf = Boolean(
    (mediaName && mediaName.toLowerCase().endsWith('.pdf')) ||
    (mediaUrl && (mediaUrl.toLowerCase().includes('.pdf') || mediaUrl.startsWith('data:application/pdf')))
  );

  // Reset zoom & rotation when media changes or opens
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
    }
  }, [isOpen, mediaUrl]);

  // Keyboard shortcut listener (Escape to close, +/- to zoom, 0 to reset)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      onClose();
    } else if (!isPdf) {
      if (e.key === '+' || e.key === '=') {
        setZoom(prev => Math.min(prev + 0.25, 4));
      } else if (e.key === '-') {
        setZoom(prev => Math.max(prev - 0.25, 0.5));
      } else if (e.key === '0') {
        setZoom(1);
        setRotation(0);
      }
    }
  }, [isOpen, onClose, isPdf]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen || !mediaUrl) return null;

  const displayName = mediaName || mediaUrl.split('/').pop() || (isPdf ? 'Document.pdf' : 'Image');

  // Robust download logic for both Data URIs and HTTP URLs
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      if (mediaUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = mediaUrl;
        link.download = displayName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const response = await fetch(mediaUrl);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = displayName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }
    } catch (e) {
      console.warn('Direct blob download failed, falling back to anchor trigger:', e);
      const link = document.createElement('a');
      link.href = mediaUrl;
      link.download = displayName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const modalContent = (
    <div 
      className="fixed inset-0 z-[100] flex flex-col justify-between bg-black/90 dark:bg-black/95 backdrop-blur-2xl animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* ── Top Header Bar ── */}
      <div 
        className="w-full shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 bg-black/40 border-b border-white/[0.08] backdrop-blur-md z-20 text-white"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center space-x-3 min-w-0 pr-4">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            {isPdf ? (
              <FileText className="w-4 h-4 text-orange-400" />
            ) : (
              <FileImage className="w-4 h-4 text-zinc-300" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
              {displayName}
            </p>
            <p className="text-[11px] text-zinc-400 truncate">
              {isPdf ? 'PDF Document' : 'Image'} {senderName ? `· Shared by ${senderName}` : ''} {timestamp ? `· ${timestamp}` : ''}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 font-bold text-xs shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
            title="Download file"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{isDownloading ? 'Downloading...' : 'Download'}</span>
          </button>

          {/* Open original in new tab */}
          <button
            type="button"
            onClick={() => window.open(mediaUrl, '_blank')}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white transition cursor-pointer active:scale-95"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white transition cursor-pointer active:scale-95"
            title="Close viewer (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Main Media Display Area ── */}
      <div 
        className="flex-1 relative flex items-center justify-center overflow-hidden p-2 sm:p-6"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {isPdf ? (
          /* PDF In-App Viewer */
          <div className="w-full h-full max-w-5xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/[0.12] bg-[#1e1e24]">
            <iframe
              src={`${mediaUrl}#toolbar=1`}
              title={displayName}
              className="w-full h-full border-0 rounded-2xl bg-zinc-900"
            />
          </div>
        ) : (
          /* Image Zoomable Viewer */
          <div 
            className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-200 ease-out"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`
            }}
          >
            <img
              src={mediaUrl}
              alt={displayName}
              className="max-h-[75vh] sm:max-h-[80vh] max-w-[92vw] sm:max-w-[85vw] object-contain rounded-2xl shadow-2xl border border-white/[0.08] pointer-events-auto"
              onClick={e => e.stopPropagation()}
              draggable={false}
            />
          </div>
        )}
      </div>

      {/* ── Bottom Floating Controls (Image only) ── */}
      {!isPdf && (
        <div className="w-full shrink-0 flex items-center justify-center pb-5 pt-2 z-20 pointer-events-none">
          <div className="pointer-events-auto flex items-center space-x-1 sm:space-x-2 px-4 py-2 rounded-2xl bg-zinc-900/90 border border-white/[0.1] backdrop-blur-xl shadow-2xl text-white">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="p-2 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white transition disabled:opacity-30 cursor-pointer active:scale-95"
              title="Zoom out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleResetZoom}
              className="px-2.5 py-1 text-xs font-mono font-semibold rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer"
              title="Reset zoom (0)"
            >
              {Math.round(zoom * 100)}%
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 4}
              className="p-2 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white transition disabled:opacity-30 cursor-pointer active:scale-95"
              title="Zoom in (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-white/20 mx-1" />

            <button
              type="button"
              onClick={handleRotate}
              className="p-2 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer active:scale-95"
              title="Rotate 90°"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer active:scale-95"
              title="Download image"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
