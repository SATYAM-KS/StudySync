import { DayKey, DaySchedule, TimeSlot } from '../types/index.ts';

export const DAYS_OF_WEEK: { key: DayKey; label: string; shortLabel: string }[] = [
  { key: 'mon', label: 'Monday', shortLabel: 'M' },
  { key: 'tue', label: 'Tuesday', shortLabel: 'T' },
  { key: 'wed', label: 'Wednesday', shortLabel: 'W' },
  { key: 'thu', label: 'Thursday', shortLabel: 'TH' },
  { key: 'fri', label: 'Friday', shortLabel: 'F' },
  { key: 'sat', label: 'Saturday', shortLabel: 'SA' },
  { key: 'sun', label: 'Sunday', shortLabel: 'S' }
];

export const BLANK_WEEKLY_SCHEDULE: DaySchedule[] = [
  { day: 'mon', label: 'Monday', shortLabel: 'M', enabled: false, slots: [] },
  { day: 'tue', label: 'Tuesday', shortLabel: 'T', enabled: false, slots: [] },
  { day: 'wed', label: 'Wednesday', shortLabel: 'W', enabled: false, slots: [] },
  { day: 'thu', label: 'Thursday', shortLabel: 'TH', enabled: false, slots: [] },
  { day: 'fri', label: 'Friday', shortLabel: 'F', enabled: false, slots: [] },
  { day: 'sat', label: 'Saturday', shortLabel: 'SA', enabled: false, slots: [] },
  { day: 'sun', label: 'Sunday', shortLabel: 'S', enabled: false, slots: [] }
];

export const DEFAULT_WEEKLY_SCHEDULE = BLANK_WEEKLY_SCHEDULE;


// Helper to convert "HH:MM" to minutes from 00:00
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Calculate hours for a single slot (e.g. 07:00 to 10:00 -> 3.0h)
export function calculateSlotHours(slot: TimeSlot): number {
  const start = parseTimeToMinutes(slot.startTime);
  let end = parseTimeToMinutes(slot.endTime);
  if (end <= start) {
    end += 24 * 60; // Crosses midnight
  }
  const diffMins = Math.max(0, end - start);
  return Math.round((diffMins / 60) * 10) / 10;
}

// Calculate total hours for a day
export function calculateDayHours(daySchedule: DaySchedule): number {
  if (!daySchedule.enabled || !daySchedule.slots || daySchedule.slots.length === 0) {
    return 0;
  }
  const total = daySchedule.slots.reduce((sum, slot) => sum + calculateSlotHours(slot), 0);
  return Math.round(total * 10) / 10;
}

// Calculate total weekly hours across all enabled days
export function calculateWeeklyHours(schedule: DaySchedule[]): number {
  if (!Array.isArray(schedule)) return 0;
  const total = schedule.reduce((sum, d) => sum + calculateDayHours(d), 0);
  return Math.round(total * 10) / 10;
}

// Calculate average daily target hours
export function calculateAverageDailyHours(schedule: DaySchedule[]): number {
  if (!Array.isArray(schedule) || schedule.length === 0) return 4;
  const enabledDays = schedule.filter(d => d.enabled);
  if (enabledDays.length === 0) return 0;
  const weekly = calculateWeeklyHours(schedule);
  const avg = weekly / enabledDays.length;
  return Math.round(avg * 10) / 10;
}

// Get current day key (0 = sun, 1 = mon, etc.)
export function getTodayKey(): DayKey {
  const dayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday, ...
  const map: Record<number, DayKey> = {
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat'
  };
  return map[dayIndex] || 'mon';
}

// Helper to convert "HH:MM" (24h) to 12h formatted time string (e.g. "7:00 PM")
export function formatTimeTo12h(timeStr: string): string {
  if (!timeStr) return '';
  if (timeStr.toUpperCase().includes('AM') || timeStr.toUpperCase().includes('PM')) {
    return timeStr;
  }
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].slice(0, 2);
  if (isNaN(hours)) return timeStr;
  const period = hours >= 12 ? 'PM' : 'AM';
  let hours12 = hours % 12;
  if (hours12 === 0) hours12 = 12;
  return `${hours12}:${minutes} ${period}`;
}

// Helper to sort time slots in ascending / chronological order (e.g. morning AM first, then PM)
export function sortSlotsChronologically(slots: TimeSlot[]): TimeSlot[] {
  if (!Array.isArray(slots)) return [];
  return [...slots].sort((a, b) => {
    const aMins = parseTimeToMinutes(a.startTime);
    const bMins = parseTimeToMinutes(b.startTime);
    return aMins - bMins;
  });
}

// Check if current time is inside scheduled study windows
export function checkScheduleStatus(
  schedule?: DaySchedule[],
  fallbackStart = '06:00',
  fallbackEnd = '22:00'
): {
  isInside: boolean;
  activeSlot?: TimeSlot;
  todaySchedule?: DaySchedule;
  todayHours: number;
  todaySlotsText: string;
} {
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const currentHHMM = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const todayKey = getTodayKey();

  if (!schedule || schedule.length === 0) {
    const isInside = currentHHMM >= fallbackStart && currentHHMM <= fallbackEnd;
    return {
      isInside,
      todayHours: 4,
      todaySlotsText: `${formatTimeTo12h(fallbackStart)} - ${formatTimeTo12h(fallbackEnd)}`
    };
  }

  const today = schedule.find(d => d.day === todayKey);

  if (!today || !today.enabled || !today.slots || today.slots.length === 0) {
    return {
      isInside: false,
      todaySchedule: today,
      todayHours: 0,
      todaySlotsText: 'Rest Day (No scheduled windows)'
    };
  }

  const sortedSlots = sortSlotsChronologically(today.slots);
  const todayHours = calculateDayHours(today);
  const slotsText = sortedSlots.map(s => `${formatTimeTo12h(s.startTime)} - ${formatTimeTo12h(s.endTime)}`).join(', ');

  let activeSlot: TimeSlot | undefined;
  for (const slot of sortedSlots) {
    const start = parseTimeToMinutes(slot.startTime);
    let end = parseTimeToMinutes(slot.endTime);
    if (end <= start) {
      // Past midnight
      if (currentMins >= start || currentMins <= end) {
        activeSlot = slot;
        break;
      }
    } else {
      if (currentMins >= start && currentMins <= end) {
        activeSlot = slot;
        break;
      }
    }
  }

  return {
    isInside: Boolean(activeSlot),
    activeSlot,
    todaySchedule: today,
    todayHours,
    todaySlotsText: slotsText
  };
}

