import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Campaign } from '../types/index.ts';
import { parseSyllabusContent, exportSyllabusToPdf } from '../utils/pdf.ts';
import { 
  BookOpen, 
  Download, 
  Copy, 
  Check, 
  Edit3, 
  X, 
  Sparkles, 
  Share2,
  FileText,
  Target,
  Clock
} from 'lucide-react';

interface SyllabusModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  isAdmin?: boolean;
  onEditSyllabus?: () => void;
}

export const SyllabusModal: React.FC<SyllabusModalProps> = ({
  isOpen,
  onClose,
  campaign,
  isAdmin,
  onEditSyllabus
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const syllabusText = campaign.description || campaign.syllabus || '';
  const parsedItems = parseSyllabusContent(syllabusText);

  const handleCopy = () => {
    if (!syllabusText) return;
    navigator.clipboard.writeText(`Syllabus for ${campaign.name}\n\n${syllabusText}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPdf = () => {
    exportSyllabusToPdf(campaign);
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/80 dark:bg-black/90 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="relative w-full max-w-2xl h-[88vh] max-h-[850px] bg-zinc-950 border border-white/10 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] text-zinc-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Pinned Header */}
        <div className="relative z-10 shrink-0 p-5 sm:p-6 border-b border-white/10 flex items-start justify-between gap-4 bg-zinc-950/95 backdrop-blur">
          <div className="flex items-start space-x-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-xs">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {campaign.category || 'Curriculum'}
                </span>
                {campaign.adminName && (
                  <span className="text-[11px] text-zinc-400 truncate">
                    by <strong className="text-zinc-200">{campaign.adminName}</strong>
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mt-1 truncate">
                {campaign.name} Syllabus
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pinned Subheader / Action Bar */}
        <div className="relative z-10 shrink-0 px-5 sm:px-6 py-3 border-b border-white/5 flex flex-wrap items-center justify-between gap-2.5 bg-zinc-900/50 backdrop-blur">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              disabled={!syllabusText}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 hover:text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 border border-white/10 active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>
          </div>

          {isAdmin && onEditSyllabus && (
            <button
              type="button"
              onClick={() => { onClose(); onEditSyllabus(); }}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border border-white/10"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Syllabus</span>
            </button>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div className="relative z-10 flex-1 overflow-y-auto p-5 sm:p-6 space-y-3 custom-scrollbar">
          {parsedItems.length === 0 ? (
            <div className="p-12 rounded-2xl bg-white/[0.03] border border-dashed border-white/15 text-center space-y-2.5 my-auto">
              <BookOpen className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-sm font-bold text-zinc-200">No Syllabus Added Yet</p>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                {isAdmin 
                  ? 'Add a syllabus outline in Cohort Settings so members can see the curriculum and download the PDF.' 
                  : 'The cohort admin has not published a syllabus for this study group yet.'}
              </p>
            </div>
          ) : (
            parsedItems.map((item, idx) => {
              if (item.type === 'numbered') {
                return (
                  <div 
                    key={idx} 
                    className="p-4 rounded-2xl bg-white/[0.05] border border-white/10 flex items-start gap-3.5 hover:border-emerald-500/40 transition shadow-xs mt-2"
                  >
                    <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-mono font-black text-xs flex items-center justify-center shrink-0 border border-emerald-500/30">
                      {item.number || idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-white leading-snug">
                        {item.title}
                      </h4>
                      {item.body && (
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                          {item.body}
                        </p>
                      )}
                    </div>
                  </div>
                );
              } else if (item.type === 'bullet') {
                return (
                  <div 
                    key={idx} 
                    className="px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2.5 hover:bg-white/[0.05] transition ml-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-xs text-zinc-300 font-medium">
                      {item.title}
                    </span>
                  </div>
                );
              } else if (item.type === 'header') {
                return (
                  <div key={idx} className="pt-3 pb-1 border-b border-white/10">
                    <h3 className="font-extrabold text-sm text-emerald-400 tracking-wide uppercase">
                      {item.title}
                    </h3>
                  </div>
                );
              }

              // Check if item looks like a problem / topic (e.g. "Fizz Buzz (LC 412)")
              const isProblemItem = /\(LC\s*\d+\)|\(LeetCode\s*\d+\)/i.test(item.title);

              return (
                <div 
                  key={idx} 
                  className={`px-3.5 py-2 rounded-xl transition flex items-center justify-between gap-2 ml-3 ${
                    isProblemItem 
                      ? 'bg-white/[0.03] border border-white/5 hover:border-emerald-500/20' 
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-1 h-1 rounded-full bg-zinc-500 shrink-0" />
                    <span className="text-xs text-zinc-300 font-normal leading-relaxed truncate">
                      {item.title}
                    </span>
                  </div>
                  {isProblemItem && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold shrink-0">
                      Problem
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pinned Footer */}
        <div className="relative z-10 shrink-0 px-5 sm:px-6 py-4 border-t border-white/10 flex items-center justify-between bg-zinc-950/95 backdrop-blur text-xs text-zinc-400">
          <span className="flex items-center gap-1.5 text-[11px]">
            <FileText className="w-3.5 h-3.5 text-zinc-500" />
            <span>Official StudySync Cohort Curriculum</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};