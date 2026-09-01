import React from 'react';

interface SyllabusBuilderProps {
  value: string;
  onChange: (value: string) => void;
}

export const SyllabusBuilder: React.FC<SyllabusBuilderProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
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
