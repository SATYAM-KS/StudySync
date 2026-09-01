import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown, Check } from 'lucide-react';

interface TimePickerProps {
  value: string; // "HH:MM" in 24h format (e.g., "07:00", "18:30")
  onChange: (time24h: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

const PRESETS = [
  { label: '7:00 AM', value: '07:00' },
  { label: '8:00 AM', value: '08:00' },
  { label: '9:00 AM', value: '09:00' },
  { label: '10:00 AM', value: '10:00' },
  { label: '1:00 PM', value: '13:00' },
  { label: '2:00 PM', value: '14:00' },
  { label: '6:00 PM', value: '18:00' },
  { label: '7:00 PM', value: '19:00' },
  { label: '10:00 PM', value: '22:00' }
];

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = ['00', '15', '30', '45'];

export const TimePicker: React.FC<TimePickerProps> = ({
  value = '07:00',
  onChange,
  className = '',
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse 24h format to 12h representation
  const parse24h = (timeStr: string) => {
    if (!timeStr) return { hour: 7, minute: '00', period: 'AM' as const };
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    if (isNaN(h)) h = 7;
    const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    let hour12 = h % 12;
    if (hour12 === 0) hour12 = 12;
    const minute = mStr || '00';
    return { hour: hour12, minute, period };
  };

  const { hour, minute, period } = parse24h(value);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const updateTime = (newHour: number, newMin: string, newPeriod: 'AM' | 'PM') => {
    let h24 = newHour;
    if (newPeriod === 'PM' && newHour < 12) h24 = newHour + 12;
    if (newPeriod === 'AM' && newHour === 12) h24 = 0;
    const val24 = `${h24.toString().padStart(2, '0')}:${newMin}`;
    onChange(val24);
  };

  const handlePresetSelect = (presetVal: string) => {
    onChange(presetVal);
    setIsOpen(false);
  };

  // Format for display button
  const displayString = `${hour.toString().padStart(2, '0')}:${minute} ${period}`;

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 rounded-xl transition cursor-pointer text-zinc-950 dark:text-white shadow-sm font-mono ${
          size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs'
        } ${isOpen ? 'ring-2 ring-black dark:ring-white border-transparent' : ''}`}
      >
        <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <span className="font-bold tracking-tight">{displayString}</span>
        <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 text-zinc-900 dark:text-zinc-100">
          
          {/* Header & AM/PM Toggle */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Select Time
            </span>
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => updateTime(hour, minute, 'AM')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  period === 'AM'
                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => updateTime(hour, minute, 'PM')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  period === 'PM'
                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                PM
              </button>
            </div>
          </div>

          {/* Hours Grid */}
          <div className="mb-3">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold mb-1.5">Hours</div>
            <div className="grid grid-cols-6 gap-1">
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => updateTime(h, minute, period)}
                  className={`py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    hour === h
                      ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                      : 'bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-800/60'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Minutes Row */}
          <div className="mb-3">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold mb-1.5">Minutes</div>
            <div className="grid grid-cols-4 gap-1">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => updateTime(hour, m, period)}
                  className={`py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                    minute === m
                      ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                      : 'bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-800/60'
                  }`}
                >
                  :{m}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Presets */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold mb-1.5">Quick Presets</div>
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handlePresetSelect(p.value)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition cursor-pointer ${
                    value === p.value
                      ? 'bg-black text-white dark:bg-white dark:text-black font-bold'
                      : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Close button */}
          <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs cursor-pointer shadow-sm"
            >
              Done
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
