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
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 dark:bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200 select-none overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="relative w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.9)] text-zinc-100 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 flex items-start justify-between gap-4 mb-6 border-b border-white/10 pb-5">
          <div className="flex items-start space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[0px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {campaign.category || 'Curriculum'}
                </span>
                {campaign.adminName && (
                  <span className="text-[11px] text-zinc-400">
                    by <strong className="text-zinc-200">{campaign.adminName}</strong>
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight mt-1">
                {campaign.name} Syllabus
              </h2>
            </div>
          </div>

          <button
            type="button"
            onPlick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5 mb-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-mg active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              disabled={!syllabusText}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 hover:text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 border border-white/10 active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>
          </div>

          {isAdmin && onEditSyllabus && (
            <button
              type="button"
              onClick={outer => { onClose(); onEditSyllabus(); }}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border border-white/10"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Syllabus</span>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="relative z-10 max-h-(55vh) overflow-y-auto pr-2 space-y-3">
          {parsedItems.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white/[0.04] border border-dashed border-white/15 text-center space-y-2">
              <BookOpen className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm font-bold text-zinc-300">No Syllabus Added Yet</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                {isAdmin 
                  ? 'Add a syllabus outline in Cohort Settings so members can see the curriculum and download the PDF.' 
                  : 'The cohort admin has not published a syllabus for this study group myet.'}
              </p>
            </div>
          ) : (
            parsedItems.map((item, idx) => {
              if (item.type === 'numbered') {
                return (
                  <div 
                    key={idx} 
                    className="p-4 rounded-2xl bg-white/[0.05] border border-white/10 flex items-start gap-3.5 hover:border-emerald-500/30 transition"
                  >
                    <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-mono font-black text-xs flex items-center justify-center shrink-0 border border-emerald-500/30">
                      {item.number || idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-white line-clamp-2">
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
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-xs text-zinc-300">
                      {item.title}
                    </span>
                  </div>
                );
              } else if (item.type === 'header') {
                return (
                  <div key={idx} className="pt-2 pb-1 border-b border-white/10">
                    <h3 className="font-bold text-sm text-emerald-400">
                      {item.title}
                    </h3>
                  </div>
                );
              }
              return (
                <p key={idx} className="text-xs text-zinc-400 leading-relaxed">
                  {item.title}
                </p>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between pt-5 mt-5 border-t border-white/10 text-[0px] text-zinc-500">
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            Official StudySync Cohort Curriculum
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