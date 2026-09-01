import React, { useState, useEffect } from 'react';
import { 
  SyllabusTrack, 
  SyllabusModule, 
  SyllabusItem, 
  generateId, 
  serializeSyllabus, 
  deserializeSyllabus, 
  CSE_TEMPLATES 
} from '../utils/syllabus.ts';
import { 
  Plus, 
  Trash2, 
  Link as LinkIcon, 
  BookOpen, 
  Code2, 
  Cpu, 
  MessageSquare, 
  Sparkles, 
  Edit3, 
  Layers, 
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface SyllabusBuilderProps {
  value: string;
  onChange: (value: string) => void;
}

export const SyllabusBuilder: React.FC<SyllabusBuilderProps> = ({ value, onChange }) => {
  const [mode, setMode] = useState<'visual' | 'raw'>('visual');
  const [tracks, setTracks] = useState<SyllabusTrack[]>(() => {
    const parsed = deserializeSyllabus(value);
    return parsed.length > 0 ? parsed : [
      {
        id: generateId(),
        title: 'Data Structures & Algorithms',
        modules: [
          {
            id: generateId(),
            title: '1. Arrays & Two Pointers',
            items: [
              { id: generateId(), title: 'Two Sum (LC 1)', link: 'https://leetcode.com/problems/two-sum/' },
              { id: generateId(), title: 'Best Time to Buy and Sell Stock (LC 121)', link: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/' }
            ]
          }
        ]
      }
    ];
  });

  // Keep tracks in sync when raw text prop changes externally
  useEffect(() => {
    if (mode === 'raw') return;
    const parsed = deserializeSyllabus(value);
    if (parsed.length > 0) {
      setTracks(parsed);
    }
  }, [value, mode]);

  const updateTracksAndEmit = (newTracks: SyllabusTrack[]) => {
    setTracks(newTracks);
    const serialized = serializeSyllabus(newTracks);
    onChange(serialized);
  };

  // Add a preset template track
  const handleAddPreset = (key: keyof typeof CSE_TEMPLATES) => {
    const template = CSE_TEMPLATES[key];
    if (!template) return;

    // Clone template with new unique IDs
    const clonedTrack: SyllabusTrack = {
      id: generateId(),
      title: template.track.title,
      modules: template.track.modules.map(m => ({
        id: generateId(),
        title: m.title,
        items: m.items.map(i => ({
          id: generateId(),
          title: i.title,
          link: i.link
        }))
      }))
    };

    const newTracks = [...tracks, clonedTrack];
    updateTracksAndEmit(newTracks);
  };

  // Add custom blank track
  const handleAddCustomTrack = () => {
    const newTrack: SyllabusTrack = {
      id: generateId(),
      title: 'New Study Domain',
      modules: [
        {
          id: generateId(),
          title: '1. Fundamentals',
          items: [{ id: generateId(), title: 'Introduction & Key Concepts', link: '' }]
        }
      ]
    };
    updateTracksAndEmit([...tracks, newTrack]);
  };

  // Remove a track
  const handleRemoveTrack = (trackId: string) => {
    const filtered = tracks.filter(t => t.id !== trackId);
    updateTracksAndEmit(filtered);
  };

  // Update track title
  const handleUpdateTrackTitle = (trackId: string, title: string) => {
    const updated = tracks.map(t => t.id === trackId ? { ...t, title } : t);
    updateTracksAndEmit(updated);
  };

  // Add module to a track
  const handleAddModule = (trackId: string) => {
    const updated = tracks.map(t => {
      if (t.id === trackId) {
        const nextNum = t.modules.length + 1;
        return {
          ...t,
          modules: [
            ...t.modules,
            {
              id: generateId(),
              title: `${nextNum}. New Module Heading`,
              items: [{ id: generateId(), title: 'Topic or Practice Problem', link: '' }]
            }
          ]
        };
      }
      return t;
    });
    updateTracksAndEmit(updated);
  };

  // Remove module
  const handleRemoveModule = (trackId: string, moduleId: string) => {
    const updated = tracks.map(t => {
      if (t.id === trackId) {
        return {
          ...t,
          modules: t.modules.filter(m => m.id !== moduleId)
        };
      }
      return t;
    });
    updateTracksAndEmit(updated);
  };

  // Update module title
  const handleUpdateModuleTitle = (trackId: string, moduleId: string, title: string) => {
    const updated = tracks.map(t => {
      if (t.id === trackId) {
        return {
          ...t,
          modules: t.modules.map(m => m.id === moduleId ? { ...m, title } : m)
        };
      }
      return t;
    });
    updateTracksAndEmit(updated);
  };

  // Add item / problem to a module
  const handleAddItem = (trackId: string, moduleId: string) => {
    const updated = tracks.map(t => {
      if (t.id === trackId) {
        return {
          ...t,
          modules: t.modules.map(m => {
            if (m.id === moduleId) {
              return {
                ...m,
                items: [
                  ...m.items,
                  { id: generateId(), title: '', link: '' }
                ]
              };
            }
            return m;
          })
        };
      }
      return t;
    });
    updateTracksAndEmit(updated);
  };

  // Update an item's title or link
  const handleUpdateItem = (trackId: string, moduleId: string, itemId: string, field: 'title' | 'link', val: string) => {
    const updated = tracks.map(t => {
      if (t.id === trackId) {
        return {
          ...t,
          modules: t.modules.map(m => {
            if (m.id === moduleId) {
              return {
                ...m,
                items: m.items.map(i => i.id === itemId ? { ...i, [field]: val } : i)
              };
            }
            return m;
          })
        };
      }
      return t;
    });
    updateTracksAndEmit(updated);
  };

  // Remove an item
  const handleRemoveItem = (trackId: string, moduleId: string, itemId: string) => {
    const updated = tracks.map(t => {
      if (t.id === trackId) {
        return {
          ...t,
          modules: t.modules.map(m => {
            if (m.id === moduleId) {
              return {
                ...m,
                items: m.items.filter(i => i.id !== itemId)
              };
            }
            return m;
          })
        };
      }
      return t;
    });
    updateTracksAndEmit(updated);
  };

  return (
    <div className="space-y-3">
      {/* Top Header Controls & CSE Quick Presets */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-1">
        
        {/* Presets Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mr-1">
            CSE Tracks:
          </span>
          <button
            type="button"
            onClick={() => handleAddPreset('dsa')}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
          >
            <Plus className="w-3 h-3" /> DSA
          </button>
          <button
            type="button"
            onClick={() => handleAddPreset('dev')}
            className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
          >
            <Plus className="w-3 h-3" /> Development
          </button>
          <button
            type="button"
            onClick={() => handleAddPreset('core')}
            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
          >
            <Plus className="w-3 h-3" /> Core CS
          </button>
          <button
            type="button"
            onClick={() => handleAddPreset('comm')}
            className="px-2.5 py-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
          >
            <Plus className="w-3 h-3" /> Communication
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-900 p-1 border border-zinc-200 dark:border-zinc-800 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setMode('visual')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              mode === 'visual'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3" /> Structured
          </button>
          <button
            type="button"
            onClick={() => setMode('raw')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              mode === 'raw'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Edit3 className="w-3 h-3" /> Markdown
          </button>
        </div>

      </div>

      {/* Visual Structured Builder Mode */}
      {mode === 'visual' ? (
        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1.5 custom-scrollbar">
          {tracks.map((track) => (
            <div 
              key={track.id} 
              className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800/80 space-y-3 shadow-xs"
            >
              {/* Track Main Heading Header */}
              <div className="flex items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800/60 pb-2.5">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[10px] font-mono uppercase font-black px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                    Main Track
                  </span>
                  <input
                    type="text"
                    value={track.title}
                    onChange={(e) => handleUpdateTrackTitle(track.id, e.target.value)}
                    placeholder="e.g. Data Structures & Algorithms, Development, Core CS"
                    className="w-full bg-transparent font-extrabold text-sm text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAddModule(track.id)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Heading
                  </button>
                  {tracks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTrack(track.id)}
                      title="Delete Track"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Modules List inside Track */}
              <div className="space-y-3 pl-1 sm:pl-2">
                {track.modules.map((mod) => (
                  <div 
                    key={mod.id} 
                    className="p-3.5 rounded-xl bg-white dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5"
                  >
                    {/* Module Heading */}
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={mod.title}
                        onChange={(e) => handleUpdateModuleTitle(track.id, mod.id, e.target.value)}
                        placeholder="e.g. 1. Arrays & Hashing, 2. Dynamic Programming"
                        className="flex-1 bg-transparent font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
                      />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAddItem(track.id, mod.id)}
                          className="px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold transition cursor-pointer flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" /> Sub-topic
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveModule(track.id, mod.id)}
                          className="p-1 text-zinc-400 hover:text-red-500 transition cursor-pointer"
                          title="Delete Heading"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Sub-topics / Problems List */}
                    <div className="space-y-1.5 pt-1">
                      {mod.items.map((item) => (
                        <div 
                          key={item.id} 
                          className="flex items-center gap-2 p-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 group"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 ml-1" />
                          
                          {/* Topic / Problem Title */}
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleUpdateItem(track.id, mod.id, item.id, 'title', e.target.value)}
                            placeholder="Topic or Problem (e.g. Two Sum (LC 1))"
                            className="flex-1 min-w-[120px] bg-transparent text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none"
                          />

                          {/* Optional Resource Link */}
                          <div className="flex items-center gap-1 w-32 sm:w-48 px-2 py-1 rounded-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shrink-0">
                            <LinkIcon className="w-3 h-3 text-zinc-400 shrink-0" />
                            <input
                              type="text"
                              value={item.link || ''}
                              onChange={(e) => handleUpdateItem(track.id, mod.id, item.id, 'link', e.target.value)}
                              placeholder="Study link (optional)"
                              className="w-full bg-transparent text-[11px] text-zinc-600 dark:text-zinc-400 placeholder-zinc-500 focus:outline-none truncate font-mono"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(track.id, mod.id, item.id)}
                            className="p-1 text-zinc-400 hover:text-red-500 transition cursor-pointer opacity-80 hover:opacity-100"
                            title="Remove Topic"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Add Track Button */}
          <button
            type="button"
            onClick={handleAddCustomTrack}
            className="w-full py-2.5 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-500 text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Another Domain / Main Track
          </button>
        </div>
      ) : (
        /* Raw Markdown / Text Mode */
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={8}
            placeholder="# DSA
## 1. Arrays & Hashing
- Two Sum (LC 1) [https://leetcode.com/problems/two-sum/]
- Contains Duplicate (LC 217)

# Development
## 1. Frontend
- State Management & Hooks"
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white leading-relaxed resize-y"
          />
          <p className="text-[11px] text-zinc-400">
            Hierarchy format: <code># Main Track</code>, <code>## Heading/Module</code>, <code>- Sub-topic / Problem [https://link]</code>.
          </p>
        </div>
      )}
    </div>
  );
};
