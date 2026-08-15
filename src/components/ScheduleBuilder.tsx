import React, { useState } from 'react';
import { DaySchedule, DayKey, TimeSlot } from '../types/index.ts';
import { 
  calculateSlotHours, 
  calculateDayHours, 
  calculateWeeklyHours, 
  calculateAverageDailyHours,
  DAYS_OF_WEEK,
  BLANK_WEEKLY_SCHEDULE,
  sortSlotsChronologically
} from '../utils/schedule.ts';
import { Plus, Trash2, Clock, Calendar, Check, ArrowRight } from 'lucide-react';
import { TimePicker } from './ui/TimePicker.tsx';

interface ScheduleBuilderProps {
  schedule: DaySchedule[];
  onChange: (updatedSchedule: DaySchedule[]) => void;
}

export const ScheduleBuilder: React.FC<ScheduleBuilderProps> = ({ schedule, onChange }) => {
  // Safe fallback if schedule is empty
  const currentSchedule = (schedule && schedule.length > 0) ? schedule : BLANK_WEEKLY_SCHEDULE;

  const [selectedDayKey, setSelectedDayKey] = useState<DayKey>('mon');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const selectedDay = currentSchedule.find(d => d.day === selectedDayKey) || currentSchedule[0];
  const weeklyHours = calculateWeeklyHours(currentSchedule);
  const averageDailyHours = calculateAverageDailyHours(currentSchedule);
  const activeDaysCount = currentSchedule.filter(d => d.enabled && d.slots && d.slots.length > 0).length;

  const handleToggleCurrentDay = () => {
    const isCurrentlyEnabled = selectedDay.enabled && selectedDay.slots.length > 0;
    const updated = currentSchedule.map(d => {
      if (d.day === selectedDayKey) {
        if (isCurrentlyEnabled) {
          return { ...d, enabled: false };
        } else {
          // If enabling and no slots exist, add a starter slot 07:00 - 10:00
          const slots = d.slots.length > 0 ? d.slots : [{ startTime: '07:00', endTime: '10:00' }];
          return { ...d, enabled: true, slots };
        }
      }
      return d;
    });
    onChange(updated);
  };

  const handleAddSlot = (dayKey: DayKey) => {
    const updated = currentSchedule.map(d => {
      if (d.day === dayKey) {
        let newSlot: TimeSlot;
        if (d.slots.length === 0) {
          newSlot = { startTime: '07:00', endTime: '10:00' };
        } else if (d.slots.length === 1) {
          newSlot = { startTime: '18:00', endTime: '22:00' };
        } else {
          newSlot = { startTime: '14:00', endTime: '17:00' };
        }
        const sorted = sortSlotsChronologically([...d.slots, newSlot]);
        return { ...d, enabled: true, slots: sorted };
      }
      return d;
    });
    onChange(updated);
  };

  const handleSlotChange = (dayKey: DayKey, slotIndex: number, field: 'startTime' | 'endTime', value: string) => {
    const updated = currentSchedule.map(d => {
      if (d.day === dayKey) {
        const newSlots = [...d.slots];
        newSlots[slotIndex] = {
          ...newSlots[slotIndex],
          [field]: value
        };
        const sorted = sortSlotsChronologically(newSlots);
        return { ...d, slots: sorted, enabled: true };
      }
      return d;
    });
    onChange(updated);
  };

  const handleRemoveSlot = (dayKey: DayKey, slotIndex: number) => {
    const updated = currentSchedule.map(d => {
      if (d.day === dayKey) {
        const newSlots = d.slots.filter((_, idx) => idx !== slotIndex);
        return {
          ...d,
          slots: newSlots,
          enabled: newSlots.length > 0
        };
      }
      return d;
    });
    onChange(updated);
  };

  const copyDaySlotsTo = (sourceDayKey: DayKey, targetDayKeys: DayKey[], label: string) => {
    const source = currentSchedule.find(d => d.day === sourceDayKey);
    if (!source || source.slots.length === 0) return;

    const updated = currentSchedule.map(d => {
      if (targetDayKeys.includes(d.day)) {
        return {
          ...d,
          enabled: true,
          slots: source.slots.map(s => ({ ...s }))
        };
      }
      return d;
    });
    onChange(updated);
    setCopyFeedback(`Copied to ${label}`);
    setTimeout(() => setCopyFeedback(null), 1500);
  };

  const selectedDayHours = calculateDayHours(selectedDay);

  return (
    <div className="space-y-4">
      
      {/* Schedule Header & Auto-computed metrics */}
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-zinc-900 dark:text-white" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-950 dark:text-white">
              Preferred Study Windows & Daily Target
            </h3>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Members can study at any time to hit their daily hours. Configure preferred group focus windows below.
          </p>
        </div>

        {/* Auto Target Hours Stat Pill */}
        <div className="flex items-center space-x-2 shrink-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3.5 py-1.5 rounded-xl shadow-sm">
          <div className="text-right">
            <p className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase font-bold">Auto Target</p>
            <p className="text-xs font-black text-zinc-950 dark:text-white">
              {averageDailyHours}h / day
            </p>
          </div>
          <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5"></div>
          <div className="text-left">
            <p className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase font-bold">Weekly</p>
            <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
              {weeklyHours}h ({activeDaysCount}d)
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal Day Selector Bar: M  T  W  TH  F  SA  S */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 bg-zinc-100 dark:bg-zinc-950 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        {DAYS_OF_WEEK.map((item) => {
          const dayData = currentSchedule.find(d => d.day === item.key);
          const isSelected = selectedDayKey === item.key;
          const hasSlots = Boolean(dayData?.enabled && dayData?.slots && dayData.slots.length > 0);
          const dayHours = dayData ? calculateDayHours(dayData) : 0;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedDayKey(item.key)}
              className={`relative flex flex-col items-center justify-center py-2.5 px-1 rounded-xl transition cursor-pointer select-none ${
                isSelected
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-md scale-[1.02] z-10'
                  : hasSlots
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-900'
              }`}
            >
              <span className="text-xs sm:text-sm font-extrabold tracking-tight">
                {item.shortLabel}
              </span>

              {/* Status indicator below day letter */}
              <span className="mt-1 text-[9px] font-bold leading-none">
                {hasSlots ? (
                  <span className={isSelected ? 'text-zinc-200 dark:text-zinc-800' : 'text-zinc-600 dark:text-zinc-400'}>
                    {dayHours}h
                  </span>
                ) : (
                  <span className="text-zinc-300 dark:text-zinc-700">·</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Day Content Card */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        
        {/* Header of selected day */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <span className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-xs text-zinc-950 dark:text-white">
              {DAYS_OF_WEEK.find(d => d.key === selectedDayKey)?.shortLabel}
            </span>
            <div>
              <h4 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                {selectedDay.label}
                {selectedDay.enabled && selectedDay.slots.length > 0 ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold border border-zinc-200 dark:border-zinc-700">
                    {selectedDayHours} hrs scheduled
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                    Rest / Off Day
                  </span>
                )}
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {selectedDay.slots.length > 0
                  ? `${selectedDay.slots.length} focus window${selectedDay.slots.length > 1 ? 's' : ''} configured`
                  : 'No focus slots active for this day'}
              </p>
            </div>
          </div>

          {/* Day Status Toggle */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleToggleCurrentDay}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                selectedDay.enabled && selectedDay.slots.length > 0
                  ? 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                  : 'bg-black text-white dark:bg-white dark:text-black font-bold'
              }`}
            >
              {selectedDay.enabled && selectedDay.slots.length > 0 ? 'Set as Off Day' : '+ Enable Day'}
            </button>
          </div>
        </div>

        {/* Selected Day Slots List */}
        {selectedDay.enabled && selectedDay.slots.length > 0 ? (
          <div className="space-y-2.5">
            {selectedDay.slots.map((slot, sIdx) => {
              const slotHours = calculateSlotHours(slot);

              return (
                <div 
                  key={sIdx}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                >
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 w-14 shrink-0">
                    Slot {sIdx + 1}:
                  </span>

                  <div className="flex items-center space-x-2">
                    <TimePicker
                      value={slot.startTime}
                      onChange={(newTime) => handleSlotChange(selectedDayKey, sIdx, 'startTime', newTime)}
                      size="sm"
                    />
                    <span className="text-xs font-semibold text-zinc-400">to</span>
                    <TimePicker
                      value={slot.endTime}
                      onChange={(newTime) => handleSlotChange(selectedDayKey, sIdx, 'endTime', newTime)}
                      size="sm"
                    />
                  </div>

                  <span className="text-xs font-mono font-black text-zinc-900 dark:text-white bg-zinc-200 dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700">
                    {slotHours}h
                  </span>

                  {/* Remove Slot */}
                  <button
                    type="button"
                    onClick={() => handleRemoveSlot(selectedDayKey, sIdx)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition ml-auto cursor-pointer"
                    title="Remove slot"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}

            {/* Add Slot Button & Quick Copy Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleAddSlot(selectedDayKey)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-bold transition cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Slot</span>
              </button>

              {/* Direct Day Selector for Copying: M, T, W, TH, F, SA, S */}
              <div className="flex items-center flex-wrap gap-1 text-xs">
                <span className="text-zinc-400 text-[11px] font-medium mr-1">Copy to:</span>
                {DAYS_OF_WEEK.map((d) => {
                  if (d.key === selectedDayKey) return null; // Skip currently active day
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => copyDaySlotsTo(selectedDayKey, [d.key], d.label)}
                      className="px-2 h-7 min-w-[28px] rounded-lg bg-zinc-100 hover:bg-black hover:text-white dark:bg-zinc-800 dark:hover:bg-white dark:hover:text-black text-zinc-700 dark:text-zinc-300 font-extrabold text-xs transition cursor-pointer flex items-center justify-center border border-zinc-200 dark:border-zinc-700"
                      title={`Copy ${selectedDay.label} schedule to ${d.label}`}
                    >
                      {d.shortLabel}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => copyDaySlotsTo(selectedDayKey, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], 'All 7 Days')}
                  className="px-2.5 h-7 rounded-lg bg-zinc-100 hover:bg-black hover:text-white dark:bg-zinc-800 dark:hover:bg-white dark:hover:text-black text-zinc-700 dark:text-zinc-300 font-extrabold text-[11px] transition cursor-pointer flex items-center justify-center border border-zinc-200 dark:border-zinc-700 ml-0.5"
                  title="Copy to all 7 days"
                >
                  All
                </button>
              </div>
            </div>

            {copyFeedback && (
              <p className="text-[11px] text-zinc-900 dark:text-white font-bold flex items-center gap-1 pt-1">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                {copyFeedback}
              </p>
            )}

          </div>
        ) : (
          /* Blank / Empty Day State */
          <div className="text-center py-6 px-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 space-y-2">
            <Calendar className="w-6 h-6 text-zinc-400 mx-auto" />
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              No study windows on {selectedDay.label}
            </p>
            <p className="text-[11px] text-zinc-500">
              Click below to add your first study time slot (e.g. 7:00 AM – 10:00 AM).
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleAddSlot(selectedDayKey)}
                className="px-4 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black font-bold text-xs shadow-sm inline-flex items-center space-x-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Study Slot</span>
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
