import React, { useState, useRef, useEffect } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday, 
  parseISO, 
  addDays, 
  isValid 
} from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (dateStr: string) => void;
  minDate?: string;
  className?: string;
  placeholder?: string;
  size?: 'sm' | 'md';
}

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  minDate,
  className = '',
  placeholder = 'Select date',
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current date
  const parsedDate = value && isValid(parseISO(value)) ? parseISO(value) : new Date();
  const [currentMonth, setCurrentMonth] = useState<Date>(parsedDate);

  useEffect(() => {
    if (value && isValid(parseISO(value))) {
      setCurrentMonth(parseISO(value));
    }
  }, [value]);

  // Click outside listener
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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const handleSelectDate = (day: Date) => {
    const formatted = format(day, 'yyyy-MM-dd');
    onChange(formatted);
    setIsOpen(false);
  };

  const handlePreset = (offsetDays: number) => {
    const target = addDays(new Date(), offsetDays);
    const formatted = format(target, 'yyyy-MM-dd');
    onChange(formatted);
    setCurrentMonth(target);
    setIsOpen(false);
  };

  const displayString = value && isValid(parseISO(value)) 
    ? format(parseISO(value), 'd MMM yyyy') 
    : placeholder;

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between space-x-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 rounded-xl transition cursor-pointer text-zinc-950 dark:text-white shadow-sm ${
          size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs'
        } ${isOpen ? 'ring-2 ring-black dark:ring-white border-transparent' : ''}`}
      >
        <div className="flex items-center space-x-2 truncate">
          <CalendarIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="font-semibold truncate">{displayString}</span>
        </div>
      </button>

      {/* Popover Calendar Modal */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-zinc-900 dark:text-zinc-100">
          
          {/* Calendar Header with Prev/Next Month */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-bold text-zinc-950 dark:text-white">
              {format(currentMonth, 'MMMM yyyy')}
            </span>

            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Names Row */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAY_NAMES.map((name) => (
              <span key={name} className="text-[10px] font-bold text-zinc-400 uppercase py-1">
                {name}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((day) => {
              const isSelected = value && isValid(parseISO(value)) && isSameDay(day, parseISO(value));
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelectDate(day)}
                  className={`h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition cursor-pointer relative ${
                    isSelected
                      ? 'bg-black text-white dark:bg-white dark:text-black font-extrabold shadow-sm'
                      : isTodayDate
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold border border-zinc-300 dark:border-zinc-700'
                      : isCurrentMonth
                      ? 'text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      : 'text-zinc-400 dark:text-zinc-600 opacity-40 hover:opacity-100'
                  }`}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Quick Preset Buttons */}
          <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => handlePreset(0)}
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePreset(14)}
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
            >
              +2 Weeks
            </button>
            <button
              type="button"
              onClick={() => handlePreset(30)}
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
            >
              +1 Month
            </button>
            <button
              type="button"
              onClick={() => handlePreset(90)}
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
            >
              +3 Months
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
