import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Calendar, 
  ClipboardCheck, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Clock, 
  MapPin, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  ArrowUpRight,
  Bookmark,
  UserCheck,
  Plus,
  Cloud,
  CalendarDays,
  CalendarX,
  Filter,
  Layers,
  Info
} from 'lucide-react';
import { AppDataState, NavigationTab, UserRole, WeekDay } from '../types';
import { 
  toISODateString, 
  toDayMonthString, 
  getChineseWeekDay, 
  toChineseFullDateString 
} from '../utils/dateUtils';

interface DashboardProps {
  data: AppDataState;
  role: UserRole;
  onNavigateTab: (tab: NavigationTab) => void;
  onStartRollCall: (groupId: string) => void;
  onViewPendingSupport?: () => void;
  onAddActivity?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  role,
  onNavigateTab,
  onStartRollCall,
  onViewPendingSupport,
  onAddActivity,
}) => {
  const { students, activityGroups, enrollments, attendanceRecords } = data;

  // Selected date for "按日期今天活動安排" (defaults to today)
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  // Mode: 'date' (按日期比對) or 'term1-all' (全校活動總覽)
  const [scheduleViewMode, setScheduleViewMode] = useState<'date' | 'term1-all'>('date');
  // Weekday filter for full roster
  const [term1DayFilter, setTerm1DayFilter] = useState<string>('全部');

  // Formatted date values
  const selectedDateISO = useMemo(() => toISODateString(selectedDate), [selectedDate]);
  const selectedWeekDay = useMemo(() => getChineseWeekDay(selectedDate), [selectedDate]);
  const selectedDayMonth = useMemo(() => toDayMonthString(selectedDate), [selectedDate]);
  const selectedFullDateStr = useMemo(() => toChineseFullDateString(selectedDate), [selectedDate]);
  
  const isToday = useMemo(() => {
    return toISODateString(selectedDate) === toISODateString(new Date());
  }, [selectedDate]);

  // Collect all unique session dates for Term 1 across all activity groups
  const allTerm1SessionDates = useMemo(() => {
    const datesSet = new Set<string>();
    activityGroups.forEach(g => {
      if (Array.isArray(g.sessionDates)) {
        g.sessionDates.forEach(d => {
          if (d && d.includes('/')) datesSet.add(d.trim());
        });
      }
    });
    return Array.from(datesSet).sort((a, b) => {
      const [da, ma] = a.split('/').map(Number);
      const [db, mb] = b.split('/').map(Number);
      const orderMonth = (m: number) => (m >= 8 ? m : m + 12);
      if (orderMonth(ma) !== orderMonth(mb)) return orderMonth(ma) - orderMonth(mb);
      return da - db;
    });
  }, [activityGroups]);

  // Activities for selectedDate (matched by sessionDates or weekday if daily/after-school care)
  const activitiesForSelectedDate = useMemo(() => {
    if (selectedWeekDay === '星期日') return [];
    const dm = selectedDayMonth;
    const dmParts = dm.split('/');
    const dmAlt = dmParts.length === 2 ? `${parseInt(dmParts[0], 10)}/${parseInt(dmParts[1], 10)}` : dm;

    return activityGroups.filter(g => {
      // 1. Session date explicitly matches
      if (Array.isArray(g.sessionDates) && g.sessionDates.length > 0) {
        const matchesDate = g.sessionDates.some(sd => {
          if (!sd) return false;
          const cleaned = sd.trim();
          if (cleaned === dm || cleaned === dmAlt) return true;
          const parts = cleaned.split('/');
          if (parts.length === 2) {
            return `${parseInt(parts[0], 10)}/${parseInt(parts[1], 10)}` === dmAlt;
          }
          return false;
        });
        if (matchesDate) return true;
      }

      // 2. Daily after-school care or full term weekday groups
      const isDailyCare = g.category === '託管班' || (g.datesText && (g.datesText.includes('全學年') || g.datesText.includes('逢星期')));
      if (isDailyCare && g.days.includes(selectedWeekDay as WeekDay)) {
        return true;
      }

      // 3. Fallback: if sessionDates empty, check if group runs on this weekday
      if ((!g.sessionDates || g.sessionDates.length === 0) && g.days.includes(selectedWeekDay as WeekDay)) {
        return true;
      }

      return false;
    });
  }, [activityGroups, selectedWeekDay, selectedDayMonth]);

  // Full Term 1 groups filtered by day tab
  const filteredTerm1Groups = useMemo(() => {
    if (term1DayFilter === '全部') return activityGroups;
    return activityGroups.filter(g => g.days.includes(term1DayFilter as WeekDay));
  }, [activityGroups, term1DayFilter]);

  // Quick date jump helpers
  const handleJumpToToday = () => {
    setSelectedDate(new Date());
    setScheduleViewMode('date');
  };

  const handleJumpToTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
    setScheduleViewMode('date');
  };

  const handleShiftDay = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
    setScheduleViewMode('date');
  };

  const handleSelectSessionDate = (sessionDateStr: string) => {
    const parts = sessionDateStr.split('/');
    if (parts.length === 2) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const currentYear = new Date().getFullYear();
      // If month is Sep-Dec, year is 2026; if Jan-Jul, year might be next year 2027
      const year = month >= 8 ? currentYear : currentYear + 1;
      const target = new Date(year, month - 1, day);
      setSelectedDate(target);
      setScheduleViewMode('date');
    }
  };

  // Jump to next date that has activities
  const handleJumpToNextActiveDate = () => {
    // Look ahead up to 14 days
    for (let i = 1; i <= 14; i++) {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + i);
      const wDay = getChineseWeekDay(d);
      if (wDay === '星期日') continue;
      const dm = toDayMonthString(d);
      const hasAct = activityGroups.some(g => {
        if (Array.isArray(g.sessionDates) && g.sessionDates.some(sd => sd.trim() === dm)) return true;
        const isDaily = g.category === '託管班' || (g.datesText && g.datesText.includes('全學年'));
        return isDaily && g.days.includes(wDay as WeekDay);
      });
      if (hasAct) {
        setSelectedDate(d);
        setScheduleViewMode('date');
        return;
      }
    }
    // Fallback: jump to next Monday
    const d = new Date(selectedDate);
    const day = d.getDay();
    const daysUntilMon = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + daysUntilMon);
    setSelectedDate(d);
    setScheduleViewMode('date');
  };

  // S-Support Statistics and Follow-up checks
  const sSupportStats = useMemo(() => {
    const sStudents = students.filter(s => s.isSSupport);
    const sGroupIds = new Set(activityGroups.filter(g => g.isSSupportGroup).map(g => g.id));
    
    // Students needing S-Support but haven't been assigned to any S-Support group yet
    const pendingStudents = sStudents.filter(s => {
      const studentEnrolls = enrollments.filter(e => e.studentId === s.id);
      const hasSSupportGroup = studentEnrolls.some(e => sGroupIds.has(e.groupId));
      return !hasSSupportGroup;
    });

    return {
      totalSSupportStudents: sStudents.length,
      pendingCount: pendingStudents.length,
      pendingStudents,
      assignedCount: sStudents.length - pendingStudents.length,
    };
  }, [students, activityGroups, enrollments]);

  // Overall attendance calculation
  const attendanceStats = useMemo(() => {
    const pCount = attendanceRecords.filter(r => r.status === 'P').length;
    const aCount = attendanceRecords.filter(r => r.status === 'A').length;
    const lCount = attendanceRecords.filter(r => r.status === 'L').length;
    const totalValid = pCount + aCount + lCount;
    const rate = totalValid > 0 ? ((pCount / totalValid) * 100).toFixed(1) : '100.0';

    return {
      pCount,
      aCount,
      lCount,
      totalValid,
      rate,
    };
  }, [attendanceRecords]);

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner with Natural Olive and Warm Linen Highlights */}
      <div className="bg-[#3B4A3D] rounded-2xl p-6 sm:p-8 text-[#FAF9F5] shadow-sm relative overflow-hidden border border-[#2E3B30]">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-5 pointer-events-none flex items-center justify-center">
          <Calendar className="w-96 h-96 -mr-20 -mt-20 text-white" />
        </div>
        
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-[#FAF9F5] text-xs font-semibold backdrop-blur mb-3 border border-white/15">
            <Sparkles className="w-3.5 h-3.5 text-[#E6C687]" />
            <span>當前權限：{role === 'admin' ? '管理員 (全權編輯與資料管理)' : role === 'head-teacher' ? '科主任 (建立小組、管理與點名)' : role === 'teacher' ? '教師 (點名記錄與學生查閱)' : '訪客 (唯讀查閱)'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#FAF9F5] mb-2">
            課外活動小組支援與出席統計工作台
          </h1>
          <p className="text-[#D3DED1] text-sm leading-relaxed mb-5">
            全面管理學校興趣班、校隊訓練、課後託管班及學生支援小組。即時掌握場地動態、點名出席率及特教跟進狀況。
          </p>

          <div className="flex flex-wrap gap-2.5">
            <button
              id="dash-quick-rollcall-btn"
              onClick={() => onNavigateTab('roll-call')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#5A7356] hover:bg-[#4E644A] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>進行小組點名</span>
            </button>
            <button
              id="dash-schedule-btn"
              onClick={() => onNavigateTab('schedule')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 text-[#FAF9F5] rounded-xl text-xs sm:text-sm font-semibold backdrop-blur transition-all border border-white/15"
            >
              <MapPin className="w-4 h-4" />
              <span>查看場地及時程表</span>
            </button>
            <button
              id="dash-students-btn"
              onClick={() => onNavigateTab('students')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 text-[#FAF9F5] rounded-xl text-xs sm:text-sm font-semibold backdrop-blur transition-all border border-white/15"
            >
              <Users className="w-4 h-4" />
              <span>學生總表與S支援</span>
            </button>
            {(role === 'admin' || role === 'head-teacher') && onAddActivity && (
              <button
                id="dash-add-activity-btn"
                onClick={onAddActivity}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#8C521E] hover:bg-[#784417] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>新增活動小組</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* S-Support Alert Banner */}
      {sSupportStats.pendingCount > 0 && (
        <div className="bg-[#FDF6ED] border border-[#EED7B8] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#FAEEDB] text-[#8C521E] mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#64340E] flex items-center gap-2">
                <span>S支援跟進提示：發現 {sSupportStats.pendingCount} 位學生尚未編排S支援活動小組</span>
              </h3>
              <p className="text-xs text-[#8C521E] mt-0.5">
                學生名單中已標示「S支援 (✓)」，但尚未加入任何標記為「S支援小組」的課外小組（例如光輝樂隊、中文讀寫樂小組）。
              </p>
            </div>
          </div>
          <button
            id="dash-fix-ssupport-btn"
            onClick={() => {
              if (onViewPendingSupport) onViewPendingSupport();
              else onNavigateTab('students');
            }}
            className="px-3.5 py-1.5 rounded-lg bg-[#8C521E] hover:bg-[#743C12] text-white text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <span>立即檢視待跟進名單</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Groups */}
        <div 
          onClick={() => onNavigateTab('activity-groups')}
          className="bg-white rounded-xl border border-[#E5E2DA] p-5 shadow-xs hover:border-[#485945] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#78786E]">活動小組總數</span>
            <div className="w-9 h-9 rounded-lg bg-[#ECEFE9] text-[#364733] flex items-center justify-center group-hover:bg-[#485945] group-hover:text-white transition-colors">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#2C2C2A]">{activityGroups.length}</span>
            <span className="text-xs text-[#78786E]">個小組</span>
          </div>
          <div className="mt-2 text-xs text-[#78786E] flex items-center gap-1">
            <span>支援小組：{activityGroups.filter(g => g.isSSupportGroup).length} 組</span>
            <span>‧</span>
            <span>託管班：{activityGroups.filter(g => g.category === '託管班').length} 組</span>
          </div>
        </div>

        {/* Active Students & Enrollments */}
        <div 
          onClick={() => onNavigateTab('students')}
          className="bg-white rounded-xl border border-[#E5E2DA] p-5 shadow-xs hover:border-[#485945] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#78786E]">在讀學生總數</span>
            <div className="w-9 h-9 rounded-lg bg-[#ECEFE9] text-[#364733] flex items-center justify-center group-hover:bg-[#485945] group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#2C2C2A]">{students.filter(s => s.status === '在讀').length}</span>
            <span className="text-xs text-[#78786E]">名學生</span>
          </div>
          <div className="mt-2 text-xs text-[#78786E] flex items-center gap-1">
            <span>累計選課登記：{enrollments.length} 人次</span>
          </div>
        </div>

        {/* S-Support Students */}
        <div 
          onClick={() => onNavigateTab('students')}
          className="bg-white rounded-xl border border-[#E5E2DA] p-5 shadow-xs hover:border-[#8C521E] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#78786E]">S支援需求學生</span>
            <div className="w-9 h-9 rounded-lg bg-[#FDF6ED] text-[#8C521E] flex items-center justify-center group-hover:bg-[#8C521E] group-hover:text-white transition-colors">
              <Bookmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#2C2C2A]">{sSupportStats.totalSSupportStudents}</span>
            <span className="text-xs text-[#78786E]">人</span>
          </div>
          <div className="mt-2 text-xs flex items-center gap-1.5">
            <span className="text-[#2C5E32] font-medium">已安排：{sSupportStats.assignedCount}</span>
            <span>‧</span>
            <span className={sSupportStats.pendingCount > 0 ? 'text-[#8C521E] font-bold' : 'text-[#78786E]'}>
              待跟進：{sSupportStats.pendingCount}
            </span>
          </div>
        </div>

        {/* Attendance Rate */}
        <div 
          onClick={() => onNavigateTab('statistics')}
          className="bg-white rounded-xl border border-[#E5E2DA] p-5 shadow-xs hover:border-[#2C5E32] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#78786E]">全校平均出席率</span>
            <div className="w-9 h-9 rounded-lg bg-[#EEF5EF] text-[#2C5E32] flex items-center justify-center group-hover:bg-[#2C5E32] group-hover:text-white transition-colors">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#2C5E32]">{attendanceStats.rate}%</span>
            <span className="text-xs text-[#78786E]">({attendanceStats.pCount} / {attendanceStats.totalValid} 人次)</span>
          </div>
          <div className="mt-2 text-xs text-[#78786E] flex items-center gap-1">
            <span>缺席：{attendanceStats.aCount}</span>
            <span>‧</span>
            <span>請假：{attendanceStats.lCount}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Schedule & Quick Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: By-Date & Today's Activity Groups */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E2DA] p-5 shadow-xs space-y-4">
          
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EAE7DE]">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CalendarDays className="w-5 h-5 text-[#485945]" />
                <h2 className="text-base font-bold text-[#2C2C2A]">按日期今天活動安排</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FAF9F5] text-[#2C2C2A] border border-[#DDDCD4]">
                  {selectedFullDateStr} · {selectedWeekDay}
                </span>
                {isToday && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#485945] text-white shadow-2xs">
                    今天
                  </span>
                )}
              </div>
              <p className="text-xs text-[#78786E] mt-1">
                {scheduleViewMode === 'date' ? (
                  activitiesForSelectedDate.length > 0 
                    ? `按日期查詢：此日共有 ${activitiesForSelectedDate.length} 個活動小組開展` 
                    : '按日期查詢：是日沒有活動，已自動為您展示活動安排總覽'
                ) : (
                  `所有活動小組名冊與堂數安排 (共 ${activityGroups.length} 組)`
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                id="dash-view-full-schedule"
                onClick={() => onNavigateTab('schedule')}
                className="text-xs font-semibold text-[#485945] hover:text-[#2C382A] flex items-center gap-1"
              >
                <span>場地與時程總表</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Date Selector Toolbar */}
          <div className="bg-[#FAF9F5] p-3 rounded-xl border border-[#E5E2DA] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              
              {/* Left: Quick Date Buttons & Date Input */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  id="btn-date-today"
                  onClick={handleJumpToToday}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isToday
                      ? 'bg-[#485945] text-white shadow-xs'
                      : 'bg-white border border-[#DDDCD4] text-[#4A4A42] hover:bg-[#EFEFEA]'
                  }`}
                >
                  今天
                </button>
                <button
                  id="btn-date-tomorrow"
                  onClick={handleJumpToTomorrow}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-[#DDDCD4] text-[#4A4A42] hover:bg-[#EFEFEA] transition-colors"
                >
                  明天
                </button>

                <div className="inline-flex items-center rounded-lg border border-[#DDDCD4] bg-white overflow-hidden shadow-2xs">
                  <button
                    onClick={() => handleShiftDay(-1)}
                    className="p-1.5 text-[#78786E] hover:bg-[#EFEFEA] transition-colors"
                    title="前一日"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="date"
                    id="dash-calendar-picker"
                    value={selectedDateISO}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [y, m, d] = e.target.value.split('-').map(Number);
                        setSelectedDate(new Date(y, m - 1, d));
                        setScheduleViewMode('date');
                      }
                    }}
                    className="text-xs font-mono font-bold text-[#2C2C2A] bg-transparent px-1.5 py-1 border-x border-[#DDDCD4] focus:outline-none focus:bg-[#FAF9F5] cursor-pointer"
                  />
                  <button
                    onClick={() => handleShiftDay(1)}
                    className="p-1.5 text-[#78786E] hover:bg-[#EFEFEA] transition-colors"
                    title="下一日"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Right: View Mode Toggle */}
              <div className="flex items-center bg-[#EFEFEA] p-0.5 rounded-lg border border-[#DDDCD4]">
                <button
                  id="mode-date-view-btn"
                  onClick={() => setScheduleViewMode('date')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    scheduleViewMode === 'date'
                      ? 'bg-white text-[#485945] shadow-xs'
                      : 'text-[#78786E] hover:text-[#2C2C2A]'
                  }`}
                >
                  按日期活動 ({activitiesForSelectedDate.length})
                </button>
                <button
                  id="mode-term1-view-btn"
                  onClick={() => setScheduleViewMode('term1-all')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                    scheduleViewMode === 'term1-all'
                      ? 'bg-white text-[#485945] shadow-xs'
                      : 'text-[#78786E] hover:text-[#2C2C2A]'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>全校活動總覽 ({activityGroups.length})</span>
                </button>
              </div>
            </div>

            {/* Quick Session Dates Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1 border-t border-[#EAE7DE] scrollbar-none">
              <span className="text-[11px] font-bold text-[#78786E] shrink-0 flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#99998E]" /> 快捷跳至活動日：
              </span>
              {allTerm1SessionDates.slice(0, 14).map((sDate) => {
                const isSelected = selectedDayMonth === sDate;
                return (
                  <button
                    key={sDate}
                    onClick={() => handleSelectSessionDate(sDate)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono whitespace-nowrap transition-colors border ${
                      isSelected
                        ? 'bg-[#485945] text-white border-[#485945] font-bold shadow-2xs'
                        : 'bg-white text-[#4A4A42] border-[#DDDCD4] hover:bg-[#EAE8DE]'
                    }`}
                  >
                    {sDate}
                  </button>
                );
              })}
              {allTerm1SessionDates.length > 14 && (
                <span className="text-[10px] text-[#99998E] shrink-0">...共 {allTerm1SessionDates.length} 個堂數日</span>
              )}
            </div>
          </div>

          {/* Schedule View Mode: 1. By Date (or fallback when empty) */}
          {scheduleViewMode === 'date' && (
            <div>
              {activitiesForSelectedDate.length === 0 ? (
                /* Empty state when NO activities on selected date: Displays 是日沒有活動 */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#EFEFEA] text-[#78786E] flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                        <CalendarX className="w-5 h-5 text-[#88887E]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#2C2C2A]">是日沒有活動</span>
                        </div>
                        <p className="text-xs text-[#78786E] mt-0.5 leading-relaxed">
                          {selectedFullDateStr}（{selectedWeekDay}）未有排定活動。下方已為您自動展開<strong>「活動安排總覽」</strong>，方便隨時查閱各組上課時間、地點與負責老師。
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        onClick={handleJumpToNextActiveDate}
                        className="px-3 py-1.5 rounded-lg bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>跳至下一個活動日</span>
                      </button>
                    </div>
                  </div>

                  {/* Activity Groups Overview List */}
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-[#EAE7DE]">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#485945]" />
                        <h3 className="text-sm font-bold text-[#2C2C2A]">
                          活動安排總覽 (共 {filteredTerm1Groups.length} 組)
                        </h3>
                      </div>

                      {/* Day filter pills */}
                      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                        {['全部', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'].map(d => {
                          const isSel = term1DayFilter === d;
                          return (
                            <button
                              key={d}
                              onClick={() => setTerm1DayFilter(d)}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                                isSel
                                  ? 'bg-[#485945] text-white font-bold'
                                  : 'bg-[#EFEFEA] text-[#606056] hover:bg-[#E5E2DA]'
                              }`}
                            >
                              {d === '全部' ? '全部' : d.replace('星期', '周')}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
                      {filteredTerm1Groups.map((group) => {
                        const groupEnrolls = enrollments.filter(e => e.groupId === group.id);
                        return (
                          <div
                            key={group.id}
                            className="p-3.5 rounded-xl border border-[#EAE7DE] bg-[#FAF9F5] hover:bg-white hover:border-[#CCD8C7] hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[#EAE8DE] text-[#2C2C2A] rounded-md">
                                  {group.id}
                                </span>
                                <h4 className="text-sm font-bold text-[#2C2C2A]">{group.name}</h4>
                                {group.isSSupportGroup && (
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]">
                                    S支援
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EFEFEA] text-[#606056]">
                                  {group.category}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#ECEFE9] text-[#364733] border border-[#CCD8C7]">
                                  {group.days.join('、')}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#78786E]">
                                <span className="flex items-center gap-1 font-mono">
                                  <Clock className="w-3.5 h-3.5 text-[#99998E]" />
                                  {group.startTime} - {group.endTime}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-[#99998E]" />
                                  {group.venue}
                                </span>
                                <span className="flex items-center gap-1">
                                  <UserCheck className="w-3.5 h-3.5 text-[#99998E]" />
                                  {group.teacher}
                                </span>
                                <span>
                                  學生：<strong className="text-[#2C2C2A]">{groupEnrolls.length}</strong> / {group.maxCapacity || 35} 人
                                </span>
                              </div>

                              {group.datesText && (
                                <div className="text-[11px] text-[#88887E] pt-0.5">
                                  <span className="font-semibold text-[#66665E]">堂數日程：</span>
                                  <span>{group.datesText}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => onStartRollCall(group.id)}
                                className="px-3 py-1.5 rounded-lg bg-[#485945] hover:bg-[#3B4A3D] text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                              >
                                <ClipboardCheck className="w-3.5 h-3.5" />
                                <span>點名</span>
                              </button>
                              <button
                                onClick={() => onNavigateTab('share')}
                                className="px-2.5 py-1.5 rounded-lg bg-[#EFEFEA] border border-[#DDDCD4] hover:bg-[#E5E5DD] text-[#333330] text-xs font-medium transition-colors"
                              >
                                分享版
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* List of activities active on selectedDate */
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#78786E] px-1">
                    <span>
                      {selectedFullDateStr}（{selectedWeekDay}）共安排 <strong>{activitiesForSelectedDate.length}</strong> 個小組活動
                    </span>
                    <button
                      onClick={() => setScheduleViewMode('term1-all')}
                      className="text-[#485945] hover:underline font-semibold flex items-center gap-1"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>查看全校活動總覽</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {activitiesForSelectedDate.map((group) => {
                      const groupEnrolls = enrollments.filter(e => e.groupId === group.id);
                      // Check which session number this is if sessionDates available
                      const sessionIdx = Array.isArray(group.sessionDates)
                        ? group.sessionDates.findIndex(d => d.trim() === selectedDayMonth)
                        : -1;

                      return (
                        <div
                          key={group.id}
                          className="p-4 rounded-xl border border-[#CCD8C7] bg-[#FAF9F5] hover:bg-white hover:border-[#485945] hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[#EAE8DE] text-[#2C2C2A] rounded-md">
                                {group.id}
                              </span>
                              <h4 className="text-sm font-bold text-[#2C2C2A]">{group.name}</h4>
                              {sessionIdx >= 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EEF5EF] text-[#2C5E32] border border-[#D0E4D3]">
                                  第 {sessionIdx + 1} 堂 ({selectedDayMonth})
                                </span>
                              )}
                              {group.isSSupportGroup && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]">
                                  S支援
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EFEFEA] text-[#606056]">
                                {group.category}
                              </span>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#78786E]">
                              <span className="flex items-center gap-1 font-mono">
                                <Clock className="w-3.5 h-3.5 text-[#99998E]" />
                                {group.startTime} - {group.endTime}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-[#99998E]" />
                                {group.venue}
                              </span>
                              <span className="flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-[#99998E]" />
                                {group.teacher}
                              </span>
                              <span>
                                學生數：<strong className="text-[#2C2C2A]">{groupEnrolls.length}</strong> 人
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => onStartRollCall(group.id)}
                              className="px-3.5 py-1.5 rounded-lg bg-[#485945] hover:bg-[#3B4A3D] text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                            >
                              <ClipboardCheck className="w-4 h-4" />
                              <span>點名</span>
                            </button>
                            <button
                              onClick={() => onNavigateTab('share')}
                              className="px-2.5 py-1.5 rounded-lg bg-[#EFEFEA] border border-[#DDDCD4] hover:bg-[#E5E5DD] text-[#333330] text-xs font-medium transition-colors"
                              title="列印 / 分享小組名單"
                            >
                              分享版
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Schedule View Mode: 2. Full Roster View */}
          {scheduleViewMode === 'term1-all' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#EAE7DE]">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#485945]" />
                  <h3 className="text-sm font-bold text-[#2C2C2A]">
                    活動安排總覽 (共 {filteredTerm1Groups.length} 組)
                  </h3>
                </div>

                {/* Day filter pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                  {['全部', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'].map(d => {
                    const isSel = term1DayFilter === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setTerm1DayFilter(d)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          isSel
                            ? 'bg-[#485945] text-white font-bold'
                            : 'bg-[#EFEFEA] text-[#606056] hover:bg-[#E5E2DA]'
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
                {filteredTerm1Groups.map((group) => {
                  const groupEnrolls = enrollments.filter(e => e.groupId === group.id);
                  return (
                    <div
                      key={group.id}
                      className="p-3.5 rounded-xl border border-[#EAE7DE] bg-[#FAF9F5] hover:bg-white hover:border-[#CCD8C7] hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[#EAE8DE] text-[#2C2C2A] rounded-md">
                            {group.id}
                          </span>
                          <h4 className="text-sm font-bold text-[#2C2C2A]">{group.name}</h4>
                          {group.isSSupportGroup && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]">
                              S支援
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EFEFEA] text-[#606056]">
                            {group.category}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#ECEFE9] text-[#364733] border border-[#CCD8C7]">
                            {group.days.join('、')}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#78786E]">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3.5 h-3.5 text-[#99998E]" />
                            {group.startTime} - {group.endTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#99998E]" />
                            {group.venue}
                          </span>
                          <span className="flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-[#99998E]" />
                            {group.teacher}
                          </span>
                          <span>
                            學生：<strong className="text-[#2C2C2A]">{groupEnrolls.length}</strong> / {group.maxCapacity || 35} 人
                          </span>
                        </div>

                        {group.datesText && (
                          <div className="text-[11px] text-[#88887E] pt-0.5">
                            <span className="font-semibold text-[#66665E]">堂數日程：</span>
                            <span>{group.datesText}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onStartRollCall(group.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#485945] hover:bg-[#3D4A3D] text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          <span>點名</span>
                        </button>
                        <button
                          onClick={() => onNavigateTab('share')}
                          className="px-2.5 py-1.5 rounded-lg bg-[#EFEFEA] border border-[#DDDCD4] hover:bg-[#E5E5DD] text-[#333330] text-xs font-medium transition-colors"
                        >
                          分享版
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Key Rules & Quick Guide */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#E5E2DA] p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#2C2C2A] flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-[#485945]" />
              <span>點名代碼與出席率計算</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#EEF5EF] text-[#2C5E32] border border-[#D0E4D3]">
                <span className="font-bold">P = 出席 (Present)</span>
                <span>計入出席與分母</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FDF0F0] text-[#9A2D2D] border border-[#F2D1D1]">
                <span className="font-bold">A = 缺席 (Absent)</span>
                <span>計入分母</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]">
                <span className="font-bold">L = 請假 (Leave)</span>
                <span>計入分母</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#EFEFEA] text-[#606056] border border-[#DDDCD4]">
                <span className="font-bold">NA = 不適用 / 未記錄</span>
                <span>不計入出席率分母</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#ECEFE9] border border-[#CCD8C7] text-[#364733] text-[11px] mt-2">
                <strong>公式：</strong> 出席率 = P / (P + A + L) × 100%
              </div>
            </div>
          </div>

          <div className="bg-[#2C2C2A] text-[#FAF9F5] rounded-xl p-5 shadow-xs border border-[#3D3D38]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#A8A89E] mb-2">快速操作指引</h4>
            <ul className="text-xs space-y-2 text-[#D3D3CB]">
              <li className="flex items-start gap-1.5">
                <span className="text-[#A3B89E] font-bold">1.</span>
                <span>於<strong>「活動小組設定」</strong>建立各活動班、上課時間及場地。</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#A3B89E] font-bold">2.</span>
                <span>於<strong>「學生總表與名單」</strong>確認學生編別及S支援標示。</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#A3B89E] font-bold">3.</span>
                <span>於<strong>「活動點名」</strong>每堂一鍵「全體出席」或個別登記請假。</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#A3B89E] font-bold">4.</span>
                <span>可隨時透過<strong>「導入/導出」</strong>下載完整 Excel 檔案。</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#A3B89E] font-bold">5.</span>
                <span>使用<strong>「Google 雲端備份」</strong>直接備份、還原及同步至學校 Google Drive。</span>
              </li>
            </ul>
            <div className="mt-4 pt-3 border-t border-[#3D3D38]">
              <button
                onClick={() => onNavigateTab('google-drive')}
                className="w-full py-2 px-3 rounded-lg bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <Cloud className="w-3.5 h-3.5 text-[#A3B89E]" />
                <span>前往 Google 雲端管理中心</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

