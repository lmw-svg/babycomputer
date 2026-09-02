import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Download, 
  Calendar, 
  Search, 
  CheckCircle2,
  Filter,
  Users
} from 'lucide-react';
import { ActivityGroup, Student, Enrollment, AttendanceRecord, WeekDay } from '../types';
import * as XLSX from 'xlsx';

interface AttendanceStatsViewProps {
  activityGroups: ActivityGroup[];
  students: Student[];
  enrollments: Enrollment[];
  attendanceRecords: AttendanceRecord[];
}

const WEEKDAYS: WeekDay[] = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export const AttendanceStatsView: React.FC<AttendanceStatsViewProps> = ({
  activityGroups,
  students,
  enrollments,
  attendanceRecords,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('全部');
  const [weekdayFilter, setWeekdayFilter] = useState<string>('全部');

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
  const groupMap = useMemo(() => new Map(activityGroups.map(g => [g.id, g])), [activityGroups]);

  // Overall attendance statistics
  const overallStats = useMemo(() => {
    const p = attendanceRecords.filter(r => r.status === 'P').length;
    const a = attendanceRecords.filter(r => r.status === 'A').length;
    const l = attendanceRecords.filter(r => r.status === 'L').length;
    const totalValid = p + a + l;
    const rate = totalValid > 0 ? ((p / totalValid) * 100).toFixed(1) : '100.0';

    return { p, a, l, totalValid, rate };
  }, [attendanceRecords]);

  // Monday to Saturday Daily Attendance Statistics
  const weekdayStats = useMemo(() => {
    return WEEKDAYS.map(day => {
      const groupsOnDay = activityGroups.filter(g => g.days.includes(day));
      const groupIdsOnDay = new Set(groupsOnDay.map(g => g.id));
      
      const recordsOnDay = attendanceRecords.filter(r => groupIdsOnDay.has(r.groupId));
      const p = recordsOnDay.filter(r => r.status === 'P').length;
      const a = recordsOnDay.filter(r => r.status === 'A').length;
      const l = recordsOnDay.filter(r => r.status === 'L').length;
      const totalValid = p + a + l;
      const rateNum = totalValid > 0 ? (p / totalValid) * 100 : 100;
      const rate = rateNum.toFixed(1);

      // Unique students enrolled on this day
      const enrollmentsOnDay = enrollments.filter(e => groupIdsOnDay.has(e.groupId));
      const uniqueStudents = new Set(enrollmentsOnDay.map(e => e.studentId)).size;

      return {
        day,
        groupCount: groupsOnDay.length,
        enrollmentCount: enrollmentsOnDay.length,
        uniqueStudents,
        p,
        a,
        l,
        totalValid,
        rateNum,
        rate,
      };
    });
  }, [activityGroups, attendanceRecords, enrollments]);

  // Group by group attendance stats
  const groupStats = useMemo(() => {
    return activityGroups.map(g => {
      const records = attendanceRecords.filter(r => r.groupId === g.id);
      const p = records.filter(r => r.status === 'P').length;
      const a = records.filter(r => r.status === 'A').length;
      const l = records.filter(r => r.status === 'L').length;
      const totalValid = p + a + l;
      const rateNum = totalValid > 0 ? (p / totalValid) * 100 : 100;
      const rate = rateNum.toFixed(1);

      const enrolledCount = enrollments.filter(e => e.groupId === g.id).length;

      return {
        group: g,
        enrolledCount,
        p,
        a,
        l,
        totalValid,
        rateNum,
        rate,
        sessionsRecorded: new Set(records.map(r => r.date)).size,
      };
    });
  }, [activityGroups, attendanceRecords, enrollments]);

  // Filtered group stats
  const filteredGroupStats = useMemo(() => {
    return groupStats.filter(item => {
      const matchesSearch = 
        !search ||
        item.group.id.toLowerCase().includes(search.toLowerCase()) ||
        item.group.name.toLowerCase().includes(search.toLowerCase()) ||
        item.group.teacher.toLowerCase().includes(search.toLowerCase());

      const matchesCat = categoryFilter === '全部' || item.group.category === categoryFilter;
      const matchesWeekday = weekdayFilter === '全部' || item.group.days.includes(weekdayFilter as WeekDay);

      return matchesSearch && matchesCat && matchesWeekday;
    }).sort((a, b) => b.rateNum - a.rateNum);
  }, [groupStats, search, categoryFilter, weekdayFilter]);

  // Class/Grade Attendance Distribution
  const classStats = useMemo(() => {
    const classMap = new Map<string, { p: number; a: number; l: number; count: number }>();
    
    attendanceRecords.forEach(r => {
      const s = studentMap.get(r.studentId);
      if (!s || !s.class) return;
      const cls = s.class;
      const curr = classMap.get(cls) || { p: 0, a: 0, l: 0, count: 0 };
      if (r.status === 'P') curr.p++;
      else if (r.status === 'A') curr.a++;
      else if (r.status === 'L') curr.l++;
      curr.count++;
      classMap.set(cls, curr);
    });

    const list: Array<{ className: string; p: number; a: number; l: number; rate: string; totalValid: number }> = [];
    classMap.forEach((val, cls) => {
      const totalValid = val.p + val.a + val.l;
      const rate = totalValid > 0 ? ((val.p / totalValid) * 100).toFixed(1) : '100.0';
      list.push({ className: cls, ...val, rate, totalValid });
    });

    return list.sort((a, b) => a.className.localeCompare(b.className));
  }, [attendanceRecords, studentMap]);

  // Students with frequent absences
  const frequentAbsentees = useMemo(() => {
    const studentAbsenceMap = new Map<string, { absentCount: number; leaveCount: number; groups: Set<string> }>();
    
    attendanceRecords.forEach(r => {
      if (r.status === 'A' || r.status === 'L') {
        const curr = studentAbsenceMap.get(r.studentId) || { absentCount: 0, leaveCount: 0, groups: new Set<string>() };
        if (r.status === 'A') curr.absentCount++;
        if (r.status === 'L') curr.leaveCount++;
        const g = groupMap.get(r.groupId);
        if (g) curr.groups.add(g.name);
        studentAbsenceMap.set(r.studentId, curr);
      }
    });

    const list: Array<{ student: Student; absentCount: number; leaveCount: number; groupNames: string }> = [];
    studentAbsenceMap.forEach((val, sId) => {
      const s = studentMap.get(sId);
      if (s && val.absentCount > 0) {
        list.push({ student: s, absentCount: val.absentCount, leaveCount: val.leaveCount, groupNames: Array.from(val.groups).join('、') });
      }
    });

    return list.sort((a, b) => b.absentCount - a.absentCount);
  }, [attendanceRecords, studentMap, groupMap]);

  const handleExportStatsExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Mon to Sat Daily Summary Sheet
    const dailyRows = weekdayStats.map(w => ({
      '星期': w.day,
      '活動小組數': w.groupCount,
      '報讀總人次': w.enrollmentCount,
      '參與學生數': w.uniqueStudents,
      '出席人次 (P)': w.p,
      '缺席人次 (A)': w.a,
      '請假人次 (L)': w.l,
      '有效點名人次': w.totalValid,
      '出席率': w.rate + '%',
    }));
    const wsDaily = XLSX.utils.json_to_sheet(dailyRows);
    XLSX.utils.book_append_sheet(wb, wsDaily, '星期一至六出席統計');

    // 2. Group by Group Stats Sheet
    const groupRows = groupStats.map(item => ({
      'Group ID': item.group.id,
      '活動小組名稱': item.group.name,
      '上課星期': item.group.days.join('、'),
      '上課時間': `${item.group.startTime}-${item.group.endTime}`,
      '上課地點': item.group.venue,
      '類別': item.group.category,
      '負責職員': item.group.teacher,
      'S支援小組': item.group.isSSupportGroup ? '✓' : '',
      '報讀人數': item.enrolledCount,
      '已點名堂數': item.sessionsRecorded,
      '出席人次 (P)': item.p,
      '缺席人次 (A)': item.a,
      '請假人次 (L)': item.l,
      '出席率': item.rate + '%',
    }));
    const wsGroup = XLSX.utils.json_to_sheet(groupRows);
    XLSX.utils.book_append_sheet(wb, wsGroup, '各活動小組出席率');

    // 3. Frequent Absentees Sheet
    const absRows = frequentAbsentees.map(a => ({
      '學生編號': a.student.id,
      '班別': a.student.class,
      '學號': a.student.classNo,
      '學生姓名': a.student.name,
      '缺席次數 (A)': a.absentCount,
      '請假次數 (L)': a.leaveCount,
      '涉及活動': a.groupNames,
      '緊急聯絡電話': a.student.phone || '',
    }));
    const wsAbs = XLSX.utils.json_to_sheet(absRows);
    XLSX.utils.book_append_sheet(wb, wsAbs, '缺席關顧名單');

    XLSX.writeFile(wb, `全校課外活動星期一至六出席統計總表_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#2C2C2A]">課外活動學生出席統計與全週分析</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EEF5EF] text-[#2C5E32] border border-[#D0E4D3]">
              支援星期一至六實時統計
            </span>
          </div>
          <p className="text-xs text-[#78786E] mt-1">
            全面分析全校活動出勤率、星期一至星期六各日分佈、班別出勤及缺席預警
          </p>
        </div>

        <button
          id="export-stats-btn"
          onClick={handleExportStatsExcel}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-bold transition-colors shadow-xs"
        >
          <Download className="w-4 h-4" />
          <span>導出全週出席統計分析報表 (Excel)</span>
        </button>
      </div>

      {/* Top 4 Overall Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-[#E5E2DA] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-[#78786E] mb-2">
            <span>全校平均出席率</span>
            <TrendingUp className="w-4 h-4 text-[#485945]" />
          </div>
          <div className="text-2xl font-bold text-[#2C5E32]">{overallStats.rate}%</div>
          <div className="mt-2 text-xs text-[#78786E]">
            有效點名人次：{overallStats.totalValid} 人次
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E5E2DA] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-[#78786E] mb-2">
            <span>實到出席 (P)</span>
            <CheckCircle2 className="w-4 h-4 text-[#2C5E32]" />
          </div>
          <div className="text-2xl font-bold text-[#2C2C2A]">{overallStats.p}</div>
          <div className="mt-2 text-xs text-[#78786E]">
            佔有效記錄之 {overallStats.rate}%
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E5E2DA] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-[#78786E] mb-2">
            <span>累計缺席 (A)</span>
            <AlertTriangle className="w-4 h-4 text-[#8C3A3A]" />
          </div>
          <div className="text-2xl font-bold text-[#8C3A3A]">{overallStats.a}</div>
          <div className="mt-2 text-xs text-[#78786E]">
            無故缺席需教師關顧
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E5E2DA] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-[#78786E] mb-2">
            <span>累計請假 (L)</span>
            <Calendar className="w-4 h-4 text-[#8C521E]" />
          </div>
          <div className="text-2xl font-bold text-[#8C521E]">{overallStats.l}</div>
          <div className="mt-2 text-xs text-[#78786E]">
            已遞交家長信或公假
          </div>
        </div>
      </div>

      {/* --- Monday to Saturday Daily Attendance Breakdown --- */}
      <div className="bg-white rounded-xl border border-[#E5E2DA] p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#485945]" />
            <h3 className="text-sm font-bold text-[#2C2C2A]">星期一至星期六 每日出席率分析看板</h3>
          </div>
          <span className="text-xs text-[#78786E]">
            依星期各日活動排程匯總之出席情況
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {weekdayStats.map((item) => (
            <div 
              key={item.day}
              className={`p-4 rounded-xl border transition-all ${
                item.totalValid > 0 ? 'bg-[#FAF9F5] border-[#E5E2DA] hover:border-[#485945]' : 'bg-[#FAF9F5]/50 border-[#EAE7DE] opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-[#2C2C2A]">{item.day}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EFEFEA] text-[#78786E] font-medium">
                  {item.groupCount} 組
                </span>
              </div>

              <div className="mt-2">
                <div className="text-lg font-bold text-[#2C5E32]">{item.rate}%</div>
                <div className="text-[11px] text-[#78786E] mt-0.5">
                  出席：<strong className="text-[#2C2C2A]">{item.p}</strong> / {item.totalValid} 人次
                </div>
              </div>

              <div className="w-full bg-[#EAE7DE] rounded-full h-1.5 mt-2 overflow-hidden">
                <div 
                  className="bg-[#485945] h-full rounded-full" 
                  style={{ width: `${Math.min(item.rateNum, 100)}%` }}
                />
              </div>

              <div className="mt-2.5 pt-2 border-t border-[#EAE7DE] flex items-center justify-between text-[10px] text-[#78786E]">
                <span>缺席: <strong className="text-[#8C3A3A]">{item.a}</strong></span>
                <span>請假: <strong className="text-[#8C521E]">{item.l}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Stats Table: Group Attendance Ranking */}
      <div className="bg-white rounded-xl border border-[#E5E2DA] overflow-hidden shadow-xs">
        <div className="p-4 bg-[#FAF9F5] border-b border-[#E5E2DA] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#485945]" />
            <h3 className="text-sm font-bold text-[#2C2C2A]">各活動小組出席率排行與出勤明細</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Weekday Filter */}
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#99998E]" />
              <select
                value={weekdayFilter}
                onChange={(e) => setWeekdayFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-[#DDDCD4] bg-white text-[#2C2C2A]"
              >
                <option value="全部">全部星期</option>
                {WEEKDAYS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-[#DDDCD4] bg-white text-[#2C2C2A]"
            >
              <option value="全部">全部類別</option>
              <option value="隊伍/校隊">隊伍/校隊</option>
              <option value="興趣小組">興趣小組</option>
              <option value="支援小組">支援小組</option>
              <option value="託管班">託管班</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#99998E]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋小組或老師..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#DDDCD4] bg-white text-[#2C2C2A] focus:ring-1 focus:ring-[#485945]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F5F0] border-b border-[#E5E2DA] text-[#606056] font-bold">
              <tr>
                <th className="px-4 py-3">Group ID</th>
                <th className="px-4 py-3">活動小組名稱</th>
                <th className="px-3 py-3">上課星期與時段</th>
                <th className="px-3 py-3">負責教師</th>
                <th className="px-3 py-3 text-center">報讀學生</th>
                <th className="px-3 py-3 text-center">出席 (P)</th>
                <th className="px-3 py-3 text-center">缺席 (A)</th>
                <th className="px-3 py-3 text-center">請假 (L)</th>
                <th className="px-4 py-3 min-w-44">出席率進度</th>
                <th className="px-4 py-3 text-right">出席率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE7DE] text-[#4A4A42]">
              {filteredGroupStats.map((item) => (
                <tr key={item.group.id} className="hover:bg-[#FAF9F5] transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-[#2C2C2A]">{item.group.id}</td>
                  <td className="px-4 py-3 font-semibold text-[#2C2C2A]">
                    <div className="flex items-center gap-1.5">
                      <span>{item.group.name}</span>
                      {item.group.isSSupportGroup && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]">
                          S支援
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[#78786E]">
                    <span>{item.group.days.join('、')} {item.group.startTime}-{item.group.endTime}</span>
                  </td>
                  <td className="px-3 py-3 text-[#78786E]">{item.group.teacher}</td>
                  <td className="px-3 py-3 text-center font-bold text-[#2C2C2A]">{item.enrolledCount} 人</td>
                  <td className="px-3 py-3 text-center font-semibold text-[#2C5E32]">{item.p}</td>
                  <td className="px-3 py-3 text-center font-semibold text-[#8C3A3A]">{item.a}</td>
                  <td className="px-3 py-3 text-center font-semibold text-[#8C521E]">{item.l}</td>
                  <td className="px-4 py-3">
                    <div className="w-full bg-[#EFEFEA] rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.rateNum >= 90
                            ? 'bg-[#485945]'
                            : item.rateNum >= 75
                            ? 'bg-[#667C63]'
                            : 'bg-[#8C3A3A]'
                        }`}
                        style={{ width: `${Math.min(item.rateNum, 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-sm">
                    <span className={
                      item.rateNum >= 90 
                        ? 'text-[#2C5E32]' 
                        : item.rateNum >= 75 
                        ? 'text-[#485945]' 
                        : 'text-[#8C3A3A]'
                    }>
                      {item.rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Class/Grade Distribution */}
      {classStats.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E2DA] p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-[#485945]" />
            <h3 className="text-sm font-bold text-[#2C2C2A]">各班別學生課外活動出席率分佈</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {classStats.map(cs => (
              <div key={cs.className} className="p-3 bg-[#FAF9F5] rounded-xl border border-[#E5E2DA]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-[#2C2C2A]">{cs.className} 班</span>
                  <span className="text-[10px] text-[#78786E]">{cs.totalValid} 人次</span>
                </div>
                <div className="text-base font-bold text-[#2C5E32]">{cs.rate}%</div>
                <div className="text-[10px] text-[#78786E] flex justify-between mt-1 pt-1 border-t border-[#EAE7DE]">
                  <span>P: {cs.p}</span>
                  <span>A: {cs.a}</span>
                  <span>L: {cs.l}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Frequent Absentees Follow-up Table */}
      {frequentAbsentees.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E2DA] overflow-hidden shadow-xs">
          <div className="p-4 bg-[#FDF0F0] border-b border-[#F5CCCC] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#8C3A3A]" />
              <h3 className="text-sm font-bold text-[#8C3A3A]">
                缺席學生關顧名單（全校累計缺席警示）
              </h3>
            </div>
            <span className="text-xs text-[#8C3A3A] font-semibold">
              共 {frequentAbsentees.length} 位學生有缺席記錄
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F5] border-b border-[#E5E2DA] text-[#606056] font-bold">
                <tr>
                  <th className="px-4 py-3">學生編號</th>
                  <th className="px-3 py-3">班別</th>
                  <th className="px-3 py-3">學號</th>
                  <th className="px-4 py-3">學生姓名</th>
                  <th className="px-3 py-3 text-center">缺席次數 (A)</th>
                  <th className="px-3 py-3 text-center">請假次數 (L)</th>
                  <th className="px-4 py-3">涉及活動小組</th>
                  <th className="px-4 py-3">緊急聯絡電話</th>
                  <th className="px-4 py-3">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE7DE] text-[#4A4A42]">
                {frequentAbsentees.map((item) => (
                  <tr key={item.student.id} className="hover:bg-[#FAF9F5]">
                    <td className="px-4 py-3 font-mono font-bold text-[#2C2C2A]">{item.student.id}</td>
                    <td className="px-3 py-3 font-semibold text-[#2C2C2A]">{item.student.class}</td>
                    <td className="px-3 py-3 font-mono text-[#78786E]">{item.student.classNo}</td>
                    <td className="px-4 py-3 font-bold text-[#2C2C2A]">
                      <div className="flex items-center gap-1.5">
                        <span>{item.student.name}</span>
                        {item.student.isSSupport && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]">
                            S支援
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-[#8C3A3A] bg-[#FDF0F0]/50">
                      {item.absentCount} 次
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-[#8C521E]">
                      {item.leaveCount} 次
                    </td>
                    <td className="px-4 py-3 text-[#78786E] max-w-xs truncate" title={item.groupNames}>
                      {item.groupNames}
                    </td>
                    <td className="px-4 py-3 font-mono text-[#78786E]">{item.student.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FDF0F0] text-[#8C3A3A] border border-[#F5CCCC]">
                        需班主任/老師跟進
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
