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
import { AnimatedBackground } from './AnimatedBackground.tsx';

interface MediaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaName?: string | null;
  senderName?: string | null;
  timestamp?: string | null;
}

function dataURItoBlob(dataURI: string): Blob {
  const parts = dataURI.split(',');
  const byteString = atob(parts[1]);
  const mimeString = parts[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
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
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoadFailed, setPdfLoadFailed] = useState<boolean>(false);

  const isPdf = Boolean(
    (mediaName && mediaName.toLowerCase().endsWith('.pdf')) ||
    (mediaUrl && (mediaUrl.toLowerCase().includes('.pdf') || mediaUrl.startsWith('data:application/pdf')))
  );

  // Convert Data URI to Blob URL for clean iframe PDF rendering
  useEffect(() => {
    setPdfLoadFailed(false);
    if (!isOpen || !mediaUrl || !isPdf) {
      setPdfBlobUrl(null);
      return;
    }

    let activeUrl: string | null = null;
    if (mediaUrl.startsWith('data:')) {
      try {
        const blob = dataURItoBlob(mediaUrl);
        activeUrl = window.URL.createObjectURL(blob);
        setPdfBlobUrl(activeUrl);
      } catch (e) {
        console.warn('Data URI to Blob conversion error:', e);
        setPdfBlobUrl(mediaUrl);
      }
    } else {
      setPdfBlobUrl(mediaUrl);
    }

    return () => {
      if (activeUrl) {
        window.URL.revokeObjectURL(activeUrl);
      }
    };
  }, [isOpen, mediaUrl, isPdf]);

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
      className="fixed inset-0 z-[100] flex flex-col justify-between bg-black/85 dark:bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300 select-none overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Seamless Ambient Mesh Refraction */}
      <AnimatedBackground />

      {/* ── Top Seamless Floating Glass Header ── */}
      <div className="w-full shrink-0 px-3 sm:px-6 pt-3 sm:pt-4 z-20 pointer-events-none">
        <div 
          className="pointer-events-auto max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-5 py-3 rounded-2xl bg-zinc-950/80 backdrop-blur-2xl shadow-[0_10px_35px_rgba(0,0,0,0.6)] text-white border-0"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center space-x-3 min-w-0 pr-4">
            <div className="w-9 h-9 rounded-xl bg-white/[0.08] flex items-center justify-center shrink-0 shadow-inner">
              {isPdf ? (
                <FileText className="w-4 h-4 text-amber-400" />
              ) : (
                <FileImage className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md tracking-tight">
                {displayName}
              </p>
              <p className="text-[11px] text-zinc-400 truncate">
                {isPdf ? 'PDF Document' : 'Image'} {senderName ? `· Shared by ${senderName}` : ''} {timestamp ? `· ${timestamp}` : ''}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2 shrink-0">
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
              onClick={() => window.open(pdfBlobUrl || mediaUrl, '_blank')}
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
      </div>

      {/* ── Main Media Display Area ── */}
      <div 
        className="flex-1 relative flex items-center justify-center overflow-hidden p-3 sm:p-6 z-10"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {isPdf ? (
          /* PDF In-App Seamless Container */
          <div className="w-full h-full max-w-5xl max-h-[82vh] sm:max-h-[85vh] flex flex-col rounded-3xl overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.9)] bg-zinc-950/70 backdrop-blur-2xl relative p-1.5 sm:p-2 border-0 transition-all">
            {pdfLoadFailed ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-3 bg-zinc-950/80 backdrop-blur-xl text-white rounded-2xl">
                <FileText className="w-12 h-12 text-amber-400" />
                <p className="text-sm font-bold">{displayName}</p>
                <p className="text-xs text-zinc-400 max-w-md">
                  This document could not be previewed inline. You can download the file or open it directly in a new tab.
                </p>
                <button
                  onClick={handleDownload}
                  className="mt-2 px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition cursor-pointer shadow-md"
                >
                  Download Document
                </button>
              </div>
            ) : (
              <iframe
                src={pdfBlobUrl ? `${pdfBlobUrl}#toolbar=1` : `${mediaUrl}#toolbar=1`}
                title={displayName}
                className="w-full h-full border-0 rounded-2xl bg-zinc-900 shadow-inner"
                onError={() => setPdfLoadFailed(true)}
              />
            )}
          </div>
        ) : (
          /* Image Zoomable Viewer with Seamless Elevation */
          <div 
            className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-200 ease-out p-2"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`
            }}
          >
            <img
              src={mediaUrl}
              alt={displayName}
              className="max-h-[72vh] sm:max-h-[78vh] max-w-[92vw] sm:max-w-[85vw] object-contain rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] border-0 pointer-events-auto"
              onClick={e => e.stopPropagation()}
              draggable={false}
            />
          </div>
        )}
      </div>

      {/* ── Bottom Floating Controls (Image only) ── */}
      {!isPdf && (
        <div className="w-full shrink-0 flex items-center justify-center pb-5 pt-2 z-20 pointer-events-none">
          <div className="pointer-events-auto flex items-center space-x-1.5 sm:space-x-2 px-4 py-2 rounded-2xl bg-zinc-950/80 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.7)] text-white border-0">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition disabled:opacity-30 cursor-pointer active:scale-95"
              title="Zoom out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleResetZoom}
              className="px-3 py-1 text-xs font-mono font-semibold rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer"
              title="Reset zoom (0)"
            >
              {Math.round(zoom * 100)}%
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 4}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition disabled:opacity-30 cursor-pointer active:scale-95"
              title="Zoom in (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-white/20 mx-1" />

            <button
              type="button"
              onClick={handleRotate}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition cursor-pointer active:scale-95"
              title="Rotate 90°"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition cursor-pointer active:scale-95"
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
