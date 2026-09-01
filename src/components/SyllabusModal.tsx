import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Campaign } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
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
  Clock,
  CheckCircle2,
  Circle,
  RotateCcw,
  ExternalLink
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
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  // Storage key for user syllabus completion tracking
  const storageKey = `study_syllabus_progress_${user?.id || 'guest'}_${campaign.id}`;
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  if (!isOpen) return null;

  const syllabusText = campaign.description || campaign.syllabus || '';
  const parsedItems = parseSyllabusContent(syllabusText);

  // Trackable items (all items except pure headers)
  const trackableItems = parsedItems.filter(it => it.type !== 'header');
  const completedCount = parsedItems.filter((item, idx) => item.type !== 'header' && completedMap[`item_${idx}`]).length;
  const totalTrackable = trackableItems.length;
  const progressPercentage = totalTrackable > 0 ? Math.round((completedCount / totalTrackable) * 100) : 0;

  // Build parent-child relationships for hierarchical ticking
  const moduleChildrenMap: Record<number, number[]> = {};
  const itemParentMap: Record<number, number> = {};
  const headerChildrenMap: Record<number, number[]> = {};

  let currentHeaderIdx: number | null = null;
  let currentModuleIdx: number | null = null;

  parsedItems.forEach((item, idx) => {
    if (item.type === 'header') {
      currentHeaderIdx = idx;
      currentModuleIdx = null;
      headerChildrenMap[idx] = [];
    } else if (item.type === 'numbered') {
      currentModuleIdx = idx;
      moduleChildrenMap[idx] = [];
      if (currentHeaderIdx !== null) {
        headerChildrenMap[currentHeaderIdx].push(idx);
      }
    } else {
      if (currentModuleIdx !== null) {
        moduleChildrenMap[currentModuleIdx].push(idx);
        itemParentMap[idx] = currentModuleIdx;
      }
      if (currentHeaderIdx !== null) {
        headerChildrenMap[currentHeaderIdx].push(idx);
      }
    }
  });

  // Toggles an individual sub-item and updates parent module state
  const toggleIndividualItem = (itemIdx: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCompletedMap(prev => {
      const next = { ...prev, [`item_${itemIdx}`]: !prev[`item_${itemIdx}`] };
      const parentIdx = itemParentMap[itemIdx];
      if (parentIdx !== undefined) {
        const siblings = moduleChildrenMap[parentIdx] || [];
        const allSiblingsChecked = siblings.length > 0 && siblings.every(i => 
          i === itemIdx ? next[`item_${i}`] : Boolean(next[`item_${i}`])
        );
        next[`item_${parentIdx}`] = allSiblingsChecked;
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save progress', err);
      }
      return next;
    });
  };

  // Toggles a numbered module heading and automatically ticks/unticks all its sub-topics
  const toggleModuleGroup = (moduleIdx: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const subIndices = moduleChildrenMap[moduleIdx] || [];
    const targetIndices = [moduleIdx, ...subIndices];

    setCompletedMap(prev => {
      const allChecked = targetIndices.every(idx => Boolean(prev[`item_${idx}`]));
      const shouldCheck = !allChecked;
      const next = { ...prev };
      targetIndices.forEach(idx => {
        next[`item_${idx}`] = shouldCheck;
      });
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save progress', err);
      }
      return next;
    });
  };

  // Toggles all items under a section header
  const toggleHeaderGroup = (headerIdx: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const children = headerChildrenMap[headerIdx] || [];
    if (children.length === 0) return;

    setCompletedMap(prev => {
      const allChecked = children.every(idx => Boolean(prev[`item_${idx}`]));
      const shouldCheck = !allChecked;
      const next = { ...prev };
      children.forEach(idx => {
        next[`item_${idx}`] = shouldCheck;
      });
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (err) {}
      return next;
    });
  };

  const handleResetProgress = () => {
    if (window.confirm('Reset all checked items for this cohort?')) {
      setCompletedMap({});
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    }
  };

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
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/80 dark:bg-black/90 backdrop-blur-xl animate-in fade-in duration-200 select-none"
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

        {/* Pinned Subheader with Solved Progress & Action Buttons */}
        <div className="relative z-10 shrink-0 px-5 sm:px-6 py-3.5 border-b border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/50 backdrop-blur">
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
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

          {/* Solved Progress Bar */}
          {totalTrackable > 0 && (
            <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 px-3 py-1.5 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                <span className="text-zinc-400">Solved:</span>
                <span className="font-mono font-black text-emerald-400">{completedCount}/{totalTrackable}</span>
                <span className="text-zinc-500 font-mono text-[11px]">({progressPercentage}%)</span>
              </div>
              <div className="w-20 sm:w-28 h-2 rounded-full bg-white/10 overflow-hidden shrink-0">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetProgress}
                  title="Reset your tracked progress"
                  className="text-zinc-500 hover:text-zinc-300 p-0.5 transition cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

        </div>

        {/* Scrollable Content Body with Interactive Hierarchical Ticks */}
        <div className="relative z-10 flex-1 overflow-y-auto p-5 sm:p-6 space-y-2.5 custom-scrollbar">
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
              const itemKey = `item_${idx}`;
              const isChecked = Boolean(completedMap[itemKey]);

              if (item.type === 'numbered') {
                const subIndices = moduleChildrenMap[idx] || [];
                const solvedSubCount = subIndices.filter(i => Boolean(completedMap[`item_${i}`])).length;
                const isModuleFullyDone = isChecked || (subIndices.length > 0 && solvedSubCount === subIndices.length);

                return (
                  <div 
                    key={idx} 
                    onClick={() => toggleModuleGroup(idx)}
                    className={`p-4 rounded-2xl border transition shadow-xs mt-3.5 flex items-start gap-3.5 cursor-pointer select-none group ${
                      isModuleFullyDone
                        ? 'bg-emerald-950/25 border-emerald-500/40'
                        : solvedSubCount > 0
                          ? 'bg-white/[0.06] border-emerald-500/20'
                          : 'bg-white/[0.05] border-white/10 hover:border-emerald-500/30'
                    }`}
                  >
                    {/* Tick Checkbox for Heading */}
                    <button
                      type="button"
                      onClick={(e) => toggleModuleGroup(idx, e)}
                      title={isModuleFullyDone ? "Untick module & sub-topics" : "Tick all sub-topics"}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition shrink-0 mt-0.5 cursor-pointer ${
                        isModuleFullyDone 
                          ? 'bg-emerald-500 text-black shadow-xs font-bold' 
                          : 'border border-white/20 group-hover:border-emerald-400 bg-white/5 text-transparent'
                      }`}
                      aria-label="Toggle module and all sub-topics"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          {item.number || idx + 1}.
                        </span>
                        <h4 className={`font-bold text-sm leading-snug transition ${
                          isModuleFullyDone ? 'text-zinc-300 line-through decoration-emerald-500/60' : 'text-white'
                        }`}>
                          {item.title}
                        </h4>
                        
                        {subIndices.length > 0 ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider ${
                            isModuleFullyDone 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : solvedSubCount > 0
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                : 'bg-white/5 text-zinc-400 border border-white/10'
                          }`}>
                            {isModuleFullyDone ? 'ALL SOLVED ✓' : `${solvedSubCount}/${subIndices.length} SOLVED`}
                          </span>
                        ) : isModuleFullyDone && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider">
                            DONE
                          </span>
                        )}
                      </div>
                      {item.body && (
                        <p className={`text-xs mt-1 leading-relaxed ${
                          isModuleFullyDone ? 'text-zinc-500' : 'text-zinc-400'
                        }`}>
                          {item.body}
                        </p>
                      )}
                    </div>
                  </div>
                );
              } else if (item.type === 'header') {
                const headerChildren = headerChildrenMap[idx] || [];
                const headerSolvedCount = headerChildren.filter(i => Boolean(completedMap[`item_${i}`])).length;
                const isHeaderAllSolved = headerChildren.length > 0 && headerSolvedCount === headerChildren.length;

                return (
                  <div 
                    key={idx} 
                    onClick={() => toggleHeaderGroup(idx)}
                    className="pt-5 pb-1.5 border-b border-white/10 flex items-center justify-between cursor-pointer select-none group"
                    title="Click header to toggle all topics in this section"
                  >
                    <h3 className="font-extrabold text-sm text-emerald-400 tracking-wide uppercase group-hover:text-emerald-300 transition flex items-center gap-2">
                      <span>{item.title}</span>
                    </h3>
                    {headerChildren.length > 0 && (
                      <span className={`text-[10px] font-mono transition px-2 py-0.5 rounded-md ${
                        isHeaderAllSolved 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold' 
                          : 'text-zinc-400 group-hover:text-zinc-200'
                      }`}>
                        {headerSolvedCount}/{headerChildren.length} solved · Toggle section
                      </span>
                    )}
                  </div>
                );
              }

              // Problem / Topic Item (both bullet & text)
              const isProblemItem = /\(LC\s*\d+\)|\(LeetCode\s*\d+\)/i.test(item.title);

              return (
                <div 
                  key={idx} 
                  onClick={() => toggleIndividualItem(idx)}
                  className={`px-3.5 py-2.5 rounded-xl border transition flex items-center justify-between gap-2.5 ml-2 cursor-pointer select-none ${
                    isChecked 
                      ? 'bg-emerald-950/20 border-emerald-500/30 shadow-xs' 
                      : isProblemItem 
                        ? 'bg-white/[0.03] border-white/10 hover:border-emerald-500/30' 
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => toggleIndividualItem(idx, e)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition shrink-0 cursor-pointer ${
                        isChecked 
                          ? 'bg-emerald-500 text-black font-bold' 
                          : 'border border-white/20 hover:border-emerald-400 bg-white/5 text-transparent'
                      }`}
                      aria-label="Toggle completed"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </button>

                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`text-xs transition truncate hover:underline hover:text-emerald-400 font-medium flex items-center gap-1.5 cursor-pointer ${
                          isChecked 
                            ? 'text-zinc-400 line-through decoration-emerald-500/60' 
                            : 'text-zinc-100 hover:text-emerald-300'
                        }`}
                        title={`Directly open link: ${item.link}`}
                      >
                        <span className="truncate">{item.title}</span>
                        <ExternalLink className="w-3 h-3 text-emerald-400 shrink-0 opacity-80" />
                      </a>
                    ) : (
                      <span className={`text-xs transition truncate ${
                        isChecked 
                          ? 'text-zinc-400 line-through decoration-emerald-500/60' 
                          : 'text-zinc-200'
                      }`}>
                        {item.title}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer"
                        title="Directly open study link in new tab"
                      >
                        <span>Open Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {isChecked ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                        Solved ✓
                      </span>
                    ) : isProblemItem ? (
                      <span className="px-2 py-0.5 rounded-md bg-white/5 text-zinc-400 border border-white/10 text-[10px] font-mono">
                        Problem
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pinned Footer */}
        <div className="relative z-10 shrink-0 px-5 sm:px-6 py-4 border-t border-white/10 flex items-center justify-between bg-zinc-950/95 backdrop-blur text-xs text-zinc-400">
          <span className="flex items-center gap-1.5 text-[11px]">
            <FileText className="w-3.5 h-3.5 text-zinc-500" />
            <span>Official StudySync Cohort Curriculum · Progress Auto-saved</span>
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