import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react-native';

type SlotStatus = 'available' | 'booked' | 'unavailable';
type Period = 'am' | 'pm';

interface CalendarSlot {
  date: string;
  time: Period;
  status: SlotStatus;
}

interface Selection {
  startDate: string;
  startPeriod: Period;
  endDate: string;
  endPeriod: Period;
}

interface AuditCalendarProps {
  slots?: CalendarSlot[];
  onSelectionChange?: (selection: Selection | null, numDays: number) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
// 5 columns (weekdays only) with padding
const CELL_WIDTH = Math.floor((SCREEN_WIDTH - 64) / 5);

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const HOLIDAYS_2026 = new Set([
  '2026-01-01', '2026-04-06', '2026-05-01', '2026-05-14',
  '2026-05-25', '2026-07-14', '2026-08-15', '2026-11-01',
  '2026-11-11', '2026-12-25',
]);

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isWeekend(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6;
}

function isHoliday(dateStr: string): boolean {
  return HOLIDAYS_2026.has(dateStr);
}

// Same-day bookings are rejected by the backend — treat today as non-bookable.
function isPast(d: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return day <= today;
}

function getWeekdaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    if (!isWeekend(date)) {
      days.push(new Date(date));
    }
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function getSlotStatus(dateStr: string, period: Period, slots?: CalendarSlot[]): SlotStatus {
  // Days/periods NOT explicitly returned by the backend are unavailable —
  // the auditor only marks the slots they want to expose as available.
  if (!slots) return 'unavailable';
  const found = slots.find((s) => s.date === dateStr && s.time === period);
  return found?.status || 'unavailable';
}

function isInRange(
  dateStr: string, period: Period,
  sel: { startDate: string; startPeriod: Period; endDate?: string; endPeriod?: Period },
): boolean {
  if (!sel.endDate) return false;
  const startVal = sel.startDate + (sel.startPeriod === 'am' ? '.0' : '.5');
  const endVal = sel.endDate + (sel.endPeriod === 'am' ? '.0' : '.5');
  const curVal = dateStr + (period === 'am' ? '.0' : '.5');
  return curVal >= startVal && curVal <= endVal;
}

function calculateDays(sel: Selection): number {
  const start = new Date(sel.startDate);
  const end = new Date(sel.endDate);
  let days = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dateStr = formatDate(cur);
    if (!isWeekend(cur) && !isHoliday(dateStr) && !isPast(cur)) {
      if (formatDate(cur) === sel.startDate && sel.startPeriod === 'pm') {
        days += 0.5;
      } else if (formatDate(cur) === sel.endDate && sel.endPeriod === 'am') {
        days += 0.5;
      } else {
        days += 1;
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// Group weekdays into weeks (Mon-Fri rows)
function groupIntoWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];

  for (const day of days) {
    const dayOfWeek = day.getDay(); // 1=Mon ... 5=Fri
    const weekdayIndex = dayOfWeek - 1; // 0=Mon ... 4=Fri

    if (currentWeek.length === 0 && weekdayIndex > 0) {
      // Pad beginning of first week
      for (let i = 0; i < weekdayIndex; i++) {
        currentWeek.push(null as any);
      }
    }

    currentWeek.push(day);

    if (weekdayIndex === 4) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    // Pad end of last week
    while (currentWeek.length < 5) {
      currentWeek.push(null as any);
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

export default function AuditCalendar({ slots, onSelectionChange }: AuditCalendarProps) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [startDate, setStartDate] = useState<string | null>(null);
  const [startPeriod, setStartPeriod] = useState<Period>('am');
  const [endDate, setEndDate] = useState<string | null>(null);
  const [endPeriod, setEndPeriod] = useState<Period>('pm');

  const weekdays = useMemo(() => getWeekdaysInMonth(viewYear, viewMonth), [viewYear, viewMonth]);
  const weeks = useMemo(() => groupIntoWeeks(weekdays), [weekdays]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const handleSlotPress = (dateStr: string, period: Period) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(dateStr);
      setStartPeriod(period);
      setEndDate(null);
      setEndPeriod('pm');
      onSelectionChange?.(null, 0);
    } else {
      const startVal = startDate + (startPeriod === 'am' ? '.0' : '.5');
      const curVal = dateStr + (period === 'am' ? '.0' : '.5');
      if (curVal < startVal) {
        setStartDate(dateStr);
        setStartPeriod(period);
        setEndDate(null);
        onSelectionChange?.(null, 0);
      } else {
        setEndDate(dateStr);
        setEndPeriod(period);
        const sel = { startDate, startPeriod, endDate: dateStr, endPeriod: period };
        onSelectionChange?.(sel, calculateDays(sel));
      }
    }
  };

  const handleReset = () => {
    setStartDate(null);
    setEndDate(null);
    onSelectionChange?.(null, 0);
  };

  const canGoPrev = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  const formatSelDate = (dateStr: string, period: Period) => {
    const d = new Date(dateStr);
    const dayName = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d.getDay()];
    return `${dayName} ${d.getDate()} ${MONTHS_FR[d.getMonth()].substring(0, 3)}`;
  };

  return (
    <View style={styles.container}>
      {/* Month navigation */}
      <View style={styles.monthNav}>
        <Pressable testID="calendar-prev-month" onPress={prevMonth} disabled={!canGoPrev} hitSlop={12} style={styles.monthNavBtn}>
          <ChevronLeft size={22} color={canGoPrev ? '#25408D' : '#D1D5DB'} />
        </Pressable>
        <Text style={styles.monthTitle}>{MONTHS_FR[viewMonth]} {viewYear}</Text>
        <Pressable testID="calendar-next-month" onPress={nextMonth} hitSlop={12} style={styles.monthNavBtn}>
          <ChevronRight size={22} color="#25408D" />
        </Pressable>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ECFDF5' }]} />
          <Text style={styles.legendText}>Disponible</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#25408D' }]} />
          <Text style={styles.legendText}>Sélectionné</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F3F4F6' }]} />
          <Text style={styles.legendText}>Indisponible</Text>
        </View>
      </View>

      <Text style={styles.weekdaysOnly}>Jours ouvrés uniquement (lun-ven)</Text>

      {/* Day headers */}
      <View style={styles.dayHeaders}>
        {DAYS_FR.map((d) => (
          <View key={d} style={styles.dayHeaderCell}>
            <Text style={styles.dayHeader}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar weeks */}
      {weeks.map((week, weekIdx) => (
        <View key={weekIdx} style={styles.weekRow}>
          {week.map((day, dayIdx) => {
            if (!day) {
              return <View key={`empty-${dayIdx}`} style={styles.dayCell} />;
            }

            const dateStr = formatDate(day);
            const disabled = isHoliday(dateStr) || isPast(day);
            const amStatus = getSlotStatus(dateStr, 'am', slots);
            const pmStatus = getSlotStatus(dateStr, 'pm', slots);
            // A slot is non-clickable when it's booked, unavailable (auditor didn't
            // mark it available), past, or a holiday.
            const amBlocked = amStatus !== 'available' || disabled;
            const pmBlocked = pmStatus !== 'available' || disabled;

            const isStart = startDate === dateStr;
            const isEnd = endDate === dateStr;
            const amSelected = (isStart && startPeriod === 'am') || (isEnd && endPeriod === 'am');
            const pmSelected = (isStart && startPeriod === 'pm') || (isEnd && endPeriod === 'pm');
            const amInRange = startDate && endDate ? isInRange(dateStr, 'am', { startDate, startPeriod, endDate, endPeriod }) : false;
            const pmInRange = startDate && endDate ? isInRange(dateStr, 'pm', { startDate, startPeriod, endDate, endPeriod }) : false;

            return (
              <View key={dateStr} style={[styles.dayCell, disabled && styles.dayCellDisabled]}>
                <Text style={[styles.dayNumber, disabled && styles.dayNumberDisabled]}>
                  {day.getDate()}
                </Text>
                <View style={styles.slotsColumn}>
                  <Pressable
                    testID={`slot-${amBlocked ? 'blocked' : 'available'}-${dateStr}-am`}
                    disabled={amBlocked}
                    onPress={() => handleSlotPress(dateStr, 'am')}
                    style={[
                      styles.slot,
                      amBlocked && styles.slotBooked,
                      !amBlocked && styles.slotAvailable,
                      amSelected && styles.slotSelected,
                      amInRange && !amSelected && styles.slotInRange,
                    ]}
                  >
                    <Text style={[
                      styles.slotText,
                      amBlocked && styles.slotTextBooked,
                      !amBlocked && styles.slotTextAvailable,
                      (amSelected || amInRange) && styles.slotTextSelected,
                    ]}>
                      AM
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`slot-${pmBlocked ? 'blocked' : 'available'}-${dateStr}-pm`}
                    disabled={pmBlocked}
                    onPress={() => handleSlotPress(dateStr, 'pm')}
                    style={[
                      styles.slot,
                      pmBlocked && styles.slotBooked,
                      !pmBlocked && styles.slotAvailable,
                      pmSelected && styles.slotSelected,
                      pmInRange && !pmSelected && styles.slotInRange,
                    ]}
                  >
                    <Text style={[
                      styles.slotText,
                      pmBlocked && styles.slotTextBooked,
                      !pmBlocked && styles.slotTextAvailable,
                      (pmSelected || pmInRange) && styles.slotTextSelected,
                    ]}>
                      PM
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ))}

      {/* Selection summary */}
      {startDate && (
        <View style={styles.selectionSummary}>
          <View style={styles.selectionRow}>
            <View style={styles.selectionBlock}>
              <Text style={styles.selectionLabel}>Début</Text>
              <Text style={styles.selectionDate}>{formatSelDate(startDate, startPeriod)}</Text>
              <Text style={styles.selectionPeriod}>{startPeriod === 'am' ? 'Matin' : 'Après-midi'}</Text>
            </View>
            {endDate && (
              <>
                <Text style={styles.selectionArrow}>→</Text>
                <View style={styles.selectionBlock}>
                  <Text style={styles.selectionLabel}>Fin</Text>
                  <Text style={styles.selectionDate}>{formatSelDate(endDate, endPeriod)}</Text>
                  <Text style={styles.selectionPeriod}>{endPeriod === 'am' ? 'Matin' : 'Après-midi'}</Text>
                </View>
              </>
            )}
          </View>
          <Pressable onPress={handleReset} hitSlop={12} style={styles.resetBtn}>
            <RotateCcw size={16} color="#25408D" />
            <Text style={styles.resetText}>Réinitialiser</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthNavBtn: { padding: 6 },
  monthTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#6B7280' },

  weekdaysOnly: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 12,
  },

  dayHeaders: { flexDirection: 'row', marginBottom: 6 },
  dayHeaderCell: { width: CELL_WIDTH, alignItems: 'center' },
  dayHeader: { fontSize: 12, fontWeight: '700', color: '#6B7280' },

  weekRow: { flexDirection: 'row', marginBottom: 6 },

  dayCell: {
    width: CELL_WIDTH,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayCellDisabled: { opacity: 0.3 },
  dayNumber: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 4 },
  dayNumberDisabled: { color: '#9CA3AF' },

  slotsColumn: { gap: 4 },
  slot: {
    width: CELL_WIDTH - 10,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotBooked: { backgroundColor: '#F3F4F6' },
  slotAvailable: { backgroundColor: '#ECFDF5' },
  slotSelected: { backgroundColor: '#25408D' },
  slotInRange: { backgroundColor: '#DBEAFE' },
  slotText: { fontSize: 12, fontWeight: '700' },
  slotTextBooked: { color: '#D1D5DB' },
  slotTextAvailable: { color: '#059669' },
  slotTextSelected: { color: '#FFFFFF' },

  selectionSummary: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  selectionBlock: { alignItems: 'center', gap: 2 },
  selectionLabel: { fontSize: 10, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase' },
  selectionDate: { fontSize: 14, fontWeight: '700', color: '#111827' },
  selectionPeriod: { fontSize: 11, color: '#6B7280' },
  selectionArrow: { fontSize: 18, color: '#25408D', fontWeight: '700' },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8,
  },
  resetText: { fontSize: 13, fontWeight: '600', color: '#25408D' },
});
