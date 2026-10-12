import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Trash2, 
  Copy, 
  Plus, 
  Check, 
  X,
  Sparkles,
  Calendar
} from 'lucide-react';
import { 
  ScheduleCell, 
  ScheduleData, 
  ScheduleColor, 
  SaveStatusState 
} from '../types';
import { api } from '../services/api';
import { SaveStatus } from './SaveStatus';

const DAYS = [
  { key: 'mon', name: 'Monday', short: 'Mon' },
  { key: 'tue', name: 'Tuesday', short: 'Tue' },
  { key: 'wed', name: 'Wednesday', short: 'Wed' },
  { key: 'thu', name: 'Thursday', short: 'Thu' },
  { key: 'fri', name: 'Friday', short: 'Fri' },
  { key: 'sat', name: 'Saturday', short: 'Sat' },
  { key: 'sun', name: 'Sunday', short: 'Sun' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const COLOR_CONFIG: Record<
  ScheduleColor,
  { bg: string; border: string; leftBorder: string; text: string; dot: string; label: string }
> = {
  default: {
    bg: 'bg-[#222222]',
    border: 'border-[#383838]',
    leftBorder: 'border-l-neutral-400',
    text: 'text-[#EDEDED]',
    dot: 'bg-neutral-400',
    label: 'Default',
  },
  blue: {
    bg: 'bg-[#132238]',
    border: 'border-[#1e3a5f]',
    leftBorder: 'border-l-[#3b82f6]',
    text: 'text-[#93c5fd]',
    dot: 'bg-[#3b82f6]',
    label: 'Blue',
  },
  emerald: {
    bg: 'bg-[#0e291d]',
    border: 'border-[#14452f]',
    leftBorder: 'border-l-[#10b981]',
    text: 'text-[#86efac]',
    dot: 'bg-[#10b981]',
    label: 'Green',
  },
  amber: {
    bg: 'bg-[#2a1d08]',
    border: 'border-[#4d3209]',
    leftBorder: 'border-l-[#f59e0b]',
    text: 'text-[#fde047]',
    dot: 'bg-[#f59e0b]',
    label: 'Amber',
  },
  purple: {
    bg: 'bg-[#241538]',
    border: 'border-[#431e6b]',
    leftBorder: 'border-l-[#a855f7]',
    text: 'text-[#d8b4fe]',
    dot: 'bg-[#a855f7]',
    label: 'Purple',
  },
  rose: {
    bg: 'bg-[#2d121c]',
    border: 'border-[#52192b]',
    leftBorder: 'border-l-[#f43f5e]',
    text: 'text-[#fda4af]',
    dot: 'bg-[#f43f5e]',
    label: 'Rose',
  },
};

// Helper: Get Monday of the week containing the given date
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  // In JS: 0 = Sun, 1 = Mon ... 6 = Sat
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Helper: Format date as YYYY-MM-DD
function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Format hour window "17:00"
function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

interface EditingCellInfo {
  dayIndex: number;
  hour: number;
  dayName: string;
  dateStr?: string;
  existingCell?: ScheduleCell;
}

export const ScheduleView: React.FC = () => {
  // Mode: weekly recurring routine (default) vs specific week
  const [isRoutineMode, setIsRoutineMode] = useState<boolean>(true);
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const [scheduleData, setScheduleData] = useState<ScheduleData>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatusState>('saved');
  const [editingCell, setEditingCell] = useState<EditingCellInfo | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [editColor, setEditColor] = useState<ScheduleColor>('default');
  const [confirmClear, setConfirmClear] = useState<boolean>(false);
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date(currentMonday));

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentHourRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Active storage key
  const activeKey = useMemo(() => {
    return isRoutineMode ? 'routine' : `week_${formatDateKey(currentMonday)}`;
  }, [isRoutineMode, currentMonday]);

  // Compute dates for the 7 days of the viewed week
  const weekDates = useMemo(() => {
    return DAYS.map((_, index) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + index);
      return d;
    });
  }, [currentMonday]);

  // Date formatted range: e.g. "Oct 12 – Oct 18, 2026"
  const weekRangeLabel = useMemo(() => {
    if (isRoutineMode) return 'Weekly Routine (Master)';
    const start = weekDates[0];
    const end = weekDates[6];
    const startMonth = start.toLocaleDateString(undefined, { month: 'short' });
    const endMonth = end.toLocaleDateString(undefined, { month: 'short' });
    const startDay = start.getDate();
    const endDay = end.getDate();
    const year = end.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} – ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
  }, [isRoutineMode, weekDates]);

  // Today's day index (0 = Mon, ..., 6 = Sun) and current hour
  const now = new Date();
  const todayDay = now.getDay();
  const todayIndex = todayDay === 0 ? 6 : todayDay - 1;
  const currentHour = now.getHours();

  // Load schedule from DB whenever activeKey changes
  useEffect(() => {
    let cancelled = false;
    const loadSchedule = async () => {
      try {
        const raw = await api.getSchedule(activeKey);
        if (!cancelled) {
          const parsed: ScheduleData = raw ? JSON.parse(raw) : {};
          setScheduleData(parsed);
          setSaveStatus('saved');
        }
      } catch (err) {
        console.error('Failed to load schedule for key:', activeKey, err);
        if (!cancelled) {
          setScheduleData({});
        }
      }
    };
    loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [activeKey]);

  // Save changes with debounce
  const isInitialMount = useRef(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveToBackend = useCallback(async (data: ScheduleData, key: string) => {
    setSaveStatus('saving');
    try {
      await api.saveSchedule(key, JSON.stringify(data));
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save schedule:', err);
      setSaveStatus('error');
    }
  }, []);

  const updateScheduleData = useCallback((newData: ScheduleData) => {
    setScheduleData(newData);
    setSaveStatus('unsaved');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveToBackend(newData, activeKey);
    }, 400);
  }, [activeKey, saveToBackend]);

  // Auto-scroll to daytime or current hour on first mount
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const targetHour = currentHour >= 6 && currentHour <= 22 ? currentHour : 8;
      const rowHeight = 64; // Approx height per hour row
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = Math.max(0, targetHour * rowHeight - 60);
      }
      if (typeof window !== 'undefined' && window.location.hash.includes('open-17')) {
        setTimeout(() => {
          handleOpenEdit(0, 17);
        }, 200);
      }
    }
  }, [currentHour]);

  // Scroll to current hour button handler
  const handleJumpToNow = () => {
    if (scrollContainerRef.current) {
      const rowHeight = 64;
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, currentHour * rowHeight - 60),
        behavior: 'smooth',
      });
    }
  };

  // Week navigation
  const handlePrevWeek = () => {
    const prev = new Date(currentMonday);
    prev.setDate(currentMonday.getDate() - 7);
    setCurrentMonday(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentMonday);
    next.setDate(currentMonday.getDate() + 7);
    setCurrentMonday(next);
  };

  // Close calendar on outside click or Escape
  useEffect(() => {
    if (!showCalendar) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCalendar]);

  // Generate weeks for calendar picker month
  const calendarWeeks = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startMonday = getMonday(firstDayOfMonth);

    const lastDayOfMonth = new Date(year, month + 1, 0);
    const endMonday = getMonday(lastDayOfMonth);
    const endSunday = new Date(endMonday);
    endSunday.setDate(endSunday.getDate() + 6);

    const weeks: Array<{
      monday: Date;
      days: Date[];
      isSelected: boolean;
      isThisWeek: boolean;
    }> = [];

    const cursor = new Date(startMonday);
    const todayMondayKey = formatDateKey(getMonday(new Date()));
    const selectedMondayKey = formatDateKey(currentMonday);

    while (cursor <= endSunday) {
      const weekMonday = new Date(cursor);
      const days: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(cursor);
        d.setDate(cursor.getDate() + i);
        days.push(d);
      }

      const weekKey = formatDateKey(weekMonday);
      weeks.push({
        monday: weekMonday,
        days,
        isSelected: weekKey === selectedMondayKey,
        isThisWeek: weekKey === todayMondayKey,
      });

      cursor.setDate(cursor.getDate() + 7);
    }

    return weeks;
  }, [calendarMonth, currentMonday]);

  const handlePrevCalendarMonth = () => {
    const prev = new Date(calendarMonth);
    prev.setMonth(prev.getMonth() - 1);
    setCalendarMonth(prev);
  };

  const handleNextCalendarMonth = () => {
    const next = new Date(calendarMonth);
    next.setMonth(next.getMonth() + 1);
    setCalendarMonth(next);
  };

  const handleSelectWeek = (monday: Date) => {
    setCurrentMonday(monday);
    setShowCalendar(false);
  };

  // Open cell editing
  const handleOpenEdit = (dayIndex: number, hour: number) => {
    const slotKey = `${dayIndex}-${hour}`;
    const existing = scheduleData[slotKey];
    const day = DAYS[dayIndex];
    const dateStr = !isRoutineMode
      ? weekDates[dayIndex].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : undefined;

    setEditingCell({
      dayIndex,
      hour,
      dayName: day.name,
      dateStr,
      existingCell: existing,
    });
    setEditText(existing?.text || '');
    setEditColor(existing?.color || 'default');
  };

  useEffect(() => {
    if (editingCell && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select();
    }
  }, [editingCell]);

  const handleSaveCell = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingCell) return;

    const slotKey = `${editingCell.dayIndex}-${editingCell.hour}`;
    const trimmed = editText.trim();

    const next = { ...scheduleData };
    if (!trimmed) {
      delete next[slotKey];
    } else {
      next[slotKey] = {
        text: trimmed,
        color: editColor,
      };
    }

    updateScheduleData(next);
    setEditingCell(null);
  };

  const handleDeleteSlot = (slotKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = { ...scheduleData };
    delete next[slotKey];
    updateScheduleData(next);
    if (editingCell && `${editingCell.dayIndex}-${editingCell.hour}` === slotKey) {
      setEditingCell(null);
    }
  };

  // Copy routine into this week
  const handleCopyRoutine = async () => {
    try {
      const routineRaw = await api.getSchedule('routine');
      if (routineRaw) {
        const routineData: ScheduleData = JSON.parse(routineRaw);
        if (Object.keys(routineData).length > 0) {
          const merged = { ...scheduleData, ...routineData };
          updateScheduleData(merged);
        }
      }
    } catch (err) {
      console.error('Failed to copy routine:', err);
    }
  };

  // Save current week as master routine
  const handleSaveAsRoutine = async () => {
    try {
      await api.saveSchedule('routine', JSON.stringify(scheduleData));
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save as routine:', err);
    }
  };

  // Clear current schedule
  const handleClearWeek = () => {
    updateScheduleData({});
    setConfirmClear(false);
  };

  // Stats
  const totalSlots = Object.keys(scheduleData).length;

  return (
    <main className="flex-1 h-full flex flex-col bg-dark-base overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="px-8 pt-6 pb-4 border-b border-dark-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-text-primary" />
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              Schedule Mode
            </h1>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-[#1a1a1a] border border-dark-border rounded-md p-0.5 text-xs">
            <button
              onClick={() => setIsRoutineMode(true)}
              className={`px-3 py-1 rounded transition-colors ${
                isRoutineMode
                  ? 'bg-dark-active text-text-primary font-medium'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Weekly Routine
            </button>
            <button
              onClick={() => setIsRoutineMode(false)}
              className={`px-3 py-1 rounded transition-colors ${
                !isRoutineMode
                  ? 'bg-dark-active text-text-primary font-medium'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Weekly Schedule
            </button>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-3">
          {!isRoutineMode ? (
            <div className="flex items-center gap-1.5 bg-[#181818] border border-dark-border rounded-md px-2 py-1 text-xs">
              <button
                onClick={handlePrevWeek}
                title="Previous Week"
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-dark-hover transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="font-medium text-text-primary px-2 min-w-[170px] text-center">
                {weekRangeLabel}
              </span>

              <button
                onClick={handleNextWeek}
                title="Next Week"
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-dark-hover transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <div className="relative" ref={calendarRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCalendar((prev) => !prev);
                    setCalendarMonth(new Date(currentMonday));
                  }}
                  className={`ml-1 flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                    showCalendar
                      ? 'bg-dark-active text-text-primary ring-1 ring-neutral-500'
                      : 'bg-[#222222] hover:bg-[#2c2c2c] text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Calendar className="w-3 h-3 text-text-muted" />
                  <span>Change Week</span>
                </button>

                {/* Calendar Dropdown Popover */}
                {showCalendar && (
                  <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-[#181818] border border-dark-border rounded-lg shadow-2xl p-3 select-none">
                    {/* Calendar Month Header */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-dark-border/60">
                      <button
                        type="button"
                        onClick={handlePrevCalendarMonth}
                        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-dark-hover transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>

                      <span className="font-semibold text-text-primary text-xs">
                        {calendarMonth.toLocaleDateString(undefined, {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>

                      <button
                        type="button"
                        onClick={handleNextCalendarMonth}
                        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-dark-hover transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Day-of-week initials */}
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-text-muted mb-1">
                      <span>Mo</span>
                      <span>Tu</span>
                      <span>We</span>
                      <span>Th</span>
                      <span>Fr</span>
                      <span>Sa</span>
                      <span>Su</span>
                    </div>

                    {/* Weeks Rows */}
                    <div className="space-y-0.5">
                      {calendarWeeks.map((wk, wIdx) => {
                        return (
                          <div
                            key={wIdx}
                            onClick={() => handleSelectWeek(wk.monday)}
                            title={`Select week of ${wk.days[0].toLocaleDateString()}`}
                            className={`grid grid-cols-7 gap-1 p-1 rounded cursor-pointer transition-colors ${
                              wk.isSelected
                                ? 'bg-dark-active ring-1 ring-neutral-500'
                                : 'hover:bg-[#242424]'
                            }`}
                          >
                            {wk.days.map((d, dIdx) => {
                              const isCurMonth = d.getMonth() === calendarMonth.getMonth();
                              const isToday =
                                d.getDate() === now.getDate() &&
                                d.getMonth() === now.getMonth() &&
                                d.getFullYear() === now.getFullYear();

                              return (
                                <div
                                  key={dIdx}
                                  className={`text-center text-xs py-1 rounded ${
                                    !isCurMonth
                                      ? 'text-text-muted/40'
                                      : wk.isSelected
                                      ? 'text-text-primary font-medium'
                                      : 'text-text-secondary'
                                  } ${isToday ? 'font-bold text-emerald-400' : ''}`}
                                >
                                  {d.getDate()}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick This Week Jump in Calendar */}
                    <div className="pt-2 mt-2 border-t border-dark-border/60 flex items-center justify-between text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          const todayMon = getMonday(new Date());
                          handleSelectWeek(todayMon);
                        }}
                        className="text-text-muted hover:text-text-primary hover:underline"
                      >
                        Jump to Current Week
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCalendar(false)}
                        className="text-text-muted hover:text-text-primary"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <span className="text-xs font-medium text-text-secondary bg-[#181818] border border-dark-border rounded-md px-3 py-1.5">
              Master Recurring Timetable
            </span>
          )}

          {/* Quick Action: Jump to Now */}
          <button
            onClick={handleJumpToNow}
            title="Scroll to current time"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-[#181818] hover:bg-dark-hover border border-dark-border rounded-md transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Now</span>
          </button>

          {/* Routine actions */}
          {!isRoutineMode ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopyRoutine}
                title="Copy activities from Weekly Routine"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-dark-hover border border-dark-border rounded-md transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Apply Routine</span>
              </button>
              <button
                onClick={handleSaveAsRoutine}
                title="Save this week's timetable as Weekly Routine"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-dark-hover border border-dark-border rounded-md transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save as Routine</span>
              </button>
            </div>
          ) : null}

          {/* Clear Week */}
          {confirmClear ? (
            <div className="flex items-center gap-1 bg-red-950/40 border border-red-800/40 rounded-md px-2 py-1 text-xs">
              <span className="text-red-300">Clear all?</span>
              <button
                onClick={handleClearWeek}
                className="px-1.5 py-0.5 text-red-200 hover:underline font-medium"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-1.5 py-0.5 text-text-muted hover:text-text-primary"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              title="Clear all scheduled slots"
              className="p-1.5 text-text-muted hover:text-red-400 hover:bg-dark-hover border border-dark-border rounded-md transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Timetable Grid View */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-dark-base relative"
      >
        <div className="min-w-[920px] pb-12">
          {/* Sticky Header: Days of the Week (Monday to Sunday) */}
          <div className="sticky top-0 z-20 flex bg-[#161616] border-b border-dark-border shadow-sm">
            {/* Corner time header */}
            <div className="w-20 flex-shrink-0 px-3 py-3 border-r border-dark-border text-center text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              Time
            </div>

            {/* 7 Days Columns: Monday to Sunday */}
            {DAYS.map((day, idx) => {
              const isToday = !isRoutineMode && idx === todayIndex;
              const dateObj = weekDates[idx];
              const dateNum = dateObj ? dateObj.getDate() : '';
              const monthStr = dateObj ? dateObj.toLocaleDateString(undefined, { month: 'short' }) : '';

              return (
                <div
                  key={day.key}
                  className={`flex-1 min-w-[110px] px-2 py-2.5 text-center border-r border-dark-border last:border-r-0 ${
                    isToday ? 'bg-[#1e1e1e]/80' : ''
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      className={`text-xs font-semibold ${
                        isToday ? 'text-text-primary' : 'text-text-secondary'
                      }`}
                    >
                      {day.name}
                    </span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Today" />
                    )}
                  </div>

                  {!isRoutineMode && (
                    <div className="text-[11px] text-text-muted mt-0.5 font-normal">
                      {monthStr} {dateNum}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 24 Hour Rows (00:00 to 23:00) */}
          {HOURS.map((hour) => {
            const isThisHour = hour === currentHour;
            const hourLabel = formatHour(hour); // e.g. "17:00"

            return (
              <div
                key={hour}
                ref={isThisHour ? currentHourRef : undefined}
                className={`flex min-h-[64px] border-b border-dark-border/60 hover:bg-[#151515]/50 transition-colors ${
                  isThisHour ? 'bg-[#181818]/40' : ''
                }`}
              >
                {/* Left Time Column: 1 hour window label (e.g. 17:00) */}
                <div className="w-20 flex-shrink-0 px-2 border-r border-dark-border bg-[#141414] flex items-center justify-center text-center select-none">
                  <span className={`text-xs font-medium ${isThisHour ? 'text-emerald-400 font-semibold' : 'text-text-primary'}`}>
                    {hourLabel}
                  </span>
                </div>

                {/* 7 Day Cells: Monday to Sunday */}
                {DAYS.map((day, dayIdx) => {
                  const slotKey = `${dayIdx}-${hour}`;
                  const cell = scheduleData[slotKey];
                  const isTodayCell = !isRoutineMode && dayIdx === todayIndex;
                  const isCurrentNowCell = isTodayCell && isThisHour;
                  const colorStyle = cell?.color ? COLOR_CONFIG[cell.color] : COLOR_CONFIG.default;

                  return (
                    <div
                      key={day.key}
                      onClick={() => handleOpenEdit(dayIdx, hour)}
                      className={`flex-1 min-w-[110px] p-1.5 border-r border-dark-border/50 last:border-r-0 relative group cursor-pointer transition-colors ${
                        isTodayCell ? 'bg-[#1a1a1a]/30' : ''
                      } ${isCurrentNowCell ? 'ring-1 ring-inset ring-emerald-500/30' : ''}`}
                    >
                      {cell ? (
                        <div
                          className={`w-full h-full min-h-[48px] p-2 rounded-md border border-l-[3px] text-xs flex flex-col justify-between gap-1 transition-all ${colorStyle.bg} ${colorStyle.border} ${colorStyle.leftBorder} shadow-sm group-hover:brightness-125`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className={`font-semibold line-clamp-2 leading-snug break-words ${colorStyle.text}`}>
                              {cell.text}
                            </span>
                            <button
                              onClick={(e) => handleDeleteSlot(slotKey, e)}
                              title="Delete"
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/30 text-text-muted hover:text-red-300 transition-opacity flex-shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full rounded opacity-0 group-hover:opacity-100 flex items-center justify-center text-text-muted/50 hover:bg-[#1f1f1f]/60 transition-all">
                          <Plus className="w-3.5 h-3.5 stroke-[1.5]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Footer Status Bar */}
      <footer className="px-8 py-3 border-t border-dark-border/60 flex items-center justify-between text-xs text-text-muted select-none bg-dark-base">
        <div className="flex items-center gap-3">
          <span>{totalSlots} {totalSlots === 1 ? 'slot' : 'slots'} scheduled</span>
          <span>•</span>
          <span>
            {isRoutineMode ? 'Weekly Routine' : weekRangeLabel}
          </span>
          {confirmClear && (
            <span className="text-amber-400 font-medium animate-pulse">
              • Clear pending confirmation
            </span>
          )}
        </div>
        <SaveStatus status={saveStatus} />
      </footer>

      {/* Sleek Minimalist Edit Modal */}
      {editingCell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-fade-in"
          onClick={() => setEditingCell(null)}
        >
          <div
            className="w-full max-w-md bg-[#181818] border border-dark-border rounded-lg p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-dark-border/60 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  {editingCell.dayName}
                  {editingCell.dateStr && ` (${editingCell.dateStr})`}
                </h3>
                <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-text-muted" />
                  <span>
                    {formatHour(editingCell.hour)} (1-hour window)
                  </span>
                </p>
              </div>

              <button
                onClick={() => setEditingCell(null)}
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-dark-hover transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveCell} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Activity / Plan
                </label>
                <input
                  ref={textInputRef}
                  type="text"
                  placeholder="e.g. Deep Work, Gym, Team Meeting..."
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditingCell(null);
                  }}
                  className="w-full px-3 py-2 text-sm text-text-primary bg-[#202020] border border-dark-subtle rounded-md outline-none focus:border-neutral-500 placeholder:text-text-muted/50"
                />
              </div>

              {/* Color Tag Picker */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Category Tag
                </label>
                <div className="flex items-center gap-2">
                  {(Object.keys(COLOR_CONFIG) as ScheduleColor[]).map((cKey) => {
                    const c = COLOR_CONFIG[cKey];
                    const isSelected = editColor === cKey;
                    return (
                      <button
                        key={cKey}
                        type="button"
                        onClick={() => setEditColor(cKey)}
                        title={c.label}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          isSelected
                            ? 'ring-2 ring-offset-2 ring-offset-[#181818] ring-neutral-300 scale-110'
                            : 'hover:scale-105 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full ${c.dot}`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-dark-border/60">
                {editingCell.existingCell ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteSlot(`${editingCell.dayIndex}-${editingCell.hour}`)
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCell(null)}
                    className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-dark-hover rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#303030] hover:bg-[#3d3d3d] rounded-md transition-colors shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
