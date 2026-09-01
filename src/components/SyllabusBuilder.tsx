import React from 'react';
import { 
  serializeSyllabus, 
  CSE_TEMPLATES 
} from '../utils/syllabus.ts';
import { 
  Plus
} from 'lucide-react';

interface SyllabusBuilderProps {
  value: string;
  onChange: (value: string) => void;
}

export const SyllabusBuilder: React.FC<SyllabusBuilderProps> = ({ value, onChange }) => {
  // Append or insert a preset template cleanly
  const handleInsertPreset = (key: keyof typeof CSE_TEMPLATES) => {
    const template = CSE_TEMPLATES[key];
    if (!template) return;
    const templateMarkdown = serializeSyllabus([template.track]);

    if (!value.trim()) {
      onChange(templateMarkdown);
    } else {
      onChange(`${value.trim()}\n\n${templateMarkdown}`);
    }
  };

  return (
    <div className="space-y-2">
      {/* Minimal Preset Quick-Add Chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mr-1">
          CSE Presets:
        </span>
        <button
          type="button"
          onClick={() => handleInsertPreset('dsa')}
          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer flex items-center gap-1 active:scale-95"
        >
          <Plus className="w-3 h-3" /> DSA
        </button>
        <button
          type="button"
          onClick={() => handleInsertPreset('dev')}
          className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition cursor-pointer flex items-center gap-1 active:scale-95"
        >
          <Plus className="w-3 h-3" /> Development
        </button>
        <button
          type="button"
          onClick={() => handleInsertPreset('core')}
          className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold transition cursor-pointer flex items-center gap-1 active:scale-95"
        >
          <Plus className="w-3 h-3" /> Core CS
        </button>
        <button
          type="button"
          onClick={() => handleInsertPreset('comm')}
          className="px-2.5 py-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30 text-xs font-semibold transition cursor-pointer flex items-center gap-1 active:scale-95"
        >
          <Plus className="w-3 h-3" /> Communication
        </button>
      </div>

      {/* Clean Monospace Textarea */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        placeholder={`# DSA\n## 1. Arrays & Hashing\n- Two Sum (LC 1) [https://leetcode.com/problems/two-sum/]\n- Contains Duplicate (LC 217)\n\n# Development\n## 1. Frontend Architecture\n- State Management & Custom Hooks\n- Server Components`}
        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 text-xs font-mono text-zinc-950 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-300 leading-relaxed resize-y"
      />

      {/* Minimal Syntax Legend */}
      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
        <span>Format: <code># Track</code> · <code>## Heading</code> · <code>- Problem [link]</code></span>
      </div>
    </div>
  );
};
