import React, { useState, useMemo } from 'react';
import { 
  ClipboardCheck, 
  Check, 
  X, 
  Clock, 
  Calendar, 
  Plus, 
  Download, 
  AlertCircle, 
  CheckCircle2,
  History,
  ShieldCheck,
  Search,
  Filter,
  Edit,
  Cloud,
  CloudUpload,
  ExternalLink,
  Lock,
  UserPlus,
  UserMinus,
  FileSpreadsheet
} from 'lucide-react';
import { ActivityGroup, Student, Enrollment, AttendanceRecord, AttendanceStatus, UserRole, WeekDay, DismissalMethod } from '../types';
import { exportSingleGroupRollCallToExcel, generateSingleGroupExcelBlob } from '../utils/excel';
import { normalizeSingleDateInput } from '../utils/dateUtils';
import { getAccessToken, googleSignIn } from '../services/googleAuth';
import { findOrCreateAppFolder, uploadBlobToDrive } from '../services/googleDrive';
import { BatchEnrollModal } from './BatchEnrollModal';

interface RollCallViewProps {
  activityGroups: ActivityGroup[];
  students: Student[];
  enrollments: Enrollment[];
  attendanceRecords: AttendanceRecord[];
  role: UserRole;
  maskPhone: boolean;
  initialGroupId?: string;
  onUpdateAttendance: (records: AttendanceRecord[]) => void;
  onEditGroup?: (group: ActivityGroup) => void;
  onEnrollStudent?: (groupId: string) => void;
  onBatchEnrollStudents?: (
    groupId: string,
    enrollmentsToAdd: { studentId: string; dismissalMethod: DismissalMethod; remarks?: string }[],
    newStudentsToCreate?: Student[]
  ) => void;
  onRemoveEnrollment?: (enrollmentId: string) => void;
}

const WEEKDAYS: WeekDay[] = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export const RollCallView: React.FC<RollCallViewProps> = ({
  activityGroups,
  students,
  enrollments,
  attendanceRecords,
  role,
  maskPhone,
  initialGroupId,
  onUpdateAttendance,
  onEditGroup,
  onEnrollStudent,
  onBatchEnrollStudents,
  onRemoveEnrollment,
}) => {
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('全部');
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    initialGroupId || activityGroups[0]?.id || ''
  );
  const [customDateInput, setCustomDateInput] = useState('');
  const [showAddDate, setShowAddDate] = useState(false);
  const [historyStudentId, setHistoryStudentId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [isExportingToDrive, setIsExportingToDrive] = useState(false);
  const [driveExportSuccessUrl, setDriveExportSuccessUrl] = useState<string | null>(null);
  const [isBatchEnrollOpen, setIsBatchEnrollOpen] = useState(false);

  // Filter groups by selected day if specified
  const filteredGroups = useMemo(() => {
    if (selectedDayFilter === '全部') return activityGroups;
    return activityGroups.filter(g => g.days.includes(selectedDayFilter as WeekDay));
  }, [activityGroups, selectedDayFilter]);

  // Ensure selectedGroupId exists within filtered groups or fallback
  const selectedGroup = useMemo(() => {
    const found = activityGroups.find(g => g.id === selectedGroupId);
    if (found) return found;
    return filteredGroups[0] || activityGroups[0];
  }, [activityGroups, filteredGroups, selectedGroupId]);

  // Session Dates available for this group
  const sessionDates = useMemo(() => {
    if (!selectedGroup) return ['9/10'];
    return selectedGroup.sessionDates && selectedGroup.sessionDates.length > 0
      ? selectedGroup.sessionDates
      : ['9/10', '16/10', '23/10', '30/10'];
  }, [selectedGroup]);

  const [selectedDate, setSelectedDate] = useState<string>(sessionDates[0] || '9/10');

  // If group changes and selectedDate is not in the new group's dates, update selectedDate
  React.useEffect(() => {
    if (selectedGroup && selectedGroup.sessionDates && selectedGroup.sessionDates.length > 0) {
      if (!selectedGroup.sessionDates.includes(selectedDate)) {
        setSelectedDate(selectedGroup.sessionDates[0]);
      }
    }
  }, [selectedGroup, selectedDate]);

  // Enrolled students for this group
  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
  const groupEnrollments = useMemo(() => {
    if (!selectedGroup) return [];
    const list = enrollments.filter(e => e.groupId === selectedGroup.id);
    if (!studentSearch.trim()) return list;
    const term = studentSearch.trim().toLowerCase();
    return list.filter(en => {
      const s = studentMap.get(en.studentId);
      return (
        en.studentId.toLowerCase().includes(term) ||
        (s?.name && s.name.toLowerCase().includes(term)) ||
        (s?.class && s.class.toLowerCase().includes(term)) ||
        (s?.classNo && s.classNo.toString().includes(term))
      );
    });
  }, [enrollments, selectedGroup, studentSearch, studentMap]);

  // Current session attendance map { studentId -> AttendanceRecord }
  const currentAttendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    if (!selectedGroup) return map;

    attendanceRecords
      .filter(r => r.groupId === selectedGroup.id && r.date === selectedDate)
      .forEach(r => map.set(r.studentId, r));

    return map;
  }, [attendanceRecords, selectedGroup, selectedDate]);

  // Attendance summary metrics
  const summary = useMemo(() => {
    let p = 0;
    let a = 0;
    let l = 0;
    let na = 0;

    const allGroupEnrollments = enrollments.filter(e => e.groupId === selectedGroup?.id);

    allGroupEnrollments.forEach(en => {
      const rec = currentAttendanceMap.get(en.studentId);
      const status = rec ? rec.status : 'NA';
      if (status === 'P') p++;
      else if (status === 'A') a++;
      else if (status === 'L') l++;
      else na++;
    });

    const totalValid = p + a + l;
    const rate = totalValid > 0 ? ((p / totalValid) * 100).toFixed(1) : '100.0';

    return { p, a, l, na, total: allGroupEnrollments.length, rate, totalValid };
  }, [enrollments, selectedGroup, currentAttendanceMap]);

  // Single student status update handler
  const handleSetStatus = (studentId: string, status: AttendanceStatus) => {
    if (role === 'guest') return;
    if (!selectedGroup) return;

    const existing = attendanceRecords.find(
      r => r.groupId === selectedGroup.id && r.studentId === studentId && r.date === selectedDate
    );

    let updated: AttendanceRecord[];
    if (existing) {
      updated = attendanceRecords.map(r => 
        r.id === existing.id ? { ...r, status, updatedAt: Date.now() } : r
      );
    } else {
      const newRec: AttendanceRecord = {
        id: `att-${selectedGroup.id}-${studentId}-${selectedDate}-${Date.now()}`,
        groupId: selectedGroup.id,
        studentId,
        date: selectedDate,
        status,
        updatedAt: Date.now(),
      };
      updated = [...attendanceRecords, newRec];
    }

    onUpdateAttendance(updated);
  };

  // Single student note update handler
  const handleSetNote = (studentId: string, note: string) => {
    if (role === 'guest') return;
    if (!selectedGroup) return;

    const existing = attendanceRecords.find(
      r => r.groupId === selectedGroup.id && r.studentId === studentId && r.date === selectedDate
    );

    let updated: AttendanceRecord[];
    if (existing) {
      updated = attendanceRecords.map(r => 
        r.id === existing.id ? { ...r, note, updatedAt: Date.now() } : r
      );
    } else {
      const newRec: AttendanceRecord = {
        id: `att-${selectedGroup.id}-${studentId}-${selectedDate}-${Date.now()}`,
        groupId: selectedGroup.id,
        studentId,
        date: selectedDate,
        status: 'NA',
        note,
        updatedAt: Date.now(),
      };
      updated = [...attendanceRecords, newRec];
    }

    onUpdateAttendance(updated);
  };

  // Batch "Mark All Present"
  const handleMarkAllPresent = () => {
    if (role === 'guest') return;
    if (!selectedGroup) return;

    let updated = [...attendanceRecords];
    const allEnrolls = enrollments.filter(e => e.groupId === selectedGroup.id);

    allEnrolls.forEach(en => {
      const idx = updated.findIndex(
        r => r.groupId === selectedGroup.id && r.studentId === en.studentId && r.date === selectedDate
      );
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], status: 'P', updatedAt: Date.now() };
      } else {
        updated.push({
          id: `att-${selectedGroup.id}-${en.studentId}-${selectedDate}-${Date.now()}`,
          groupId: selectedGroup.id,
          studentId: en.studentId,
          date: selectedDate,
          status: 'P',
          updatedAt: Date.now(),
        });
      }
    });

    onUpdateAttendance(updated);
  };

  // Batch "Reset to NA"
  const handleResetAttendance = () => {
    if (role === 'guest') return;
    if (!selectedGroup) return;

    const updated = attendanceRecords.filter(
      r => !(r.groupId === selectedGroup.id && r.date === selectedDate)
    );
    onUpdateAttendance(updated);
  };

  // Add custom date to session list
  const handleAddCustomDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDateInput.trim() || !selectedGroup) return;

    const newDate = normalizeSingleDateInput(customDateInput.trim());
    if (!newDate) return;
    if (!selectedGroup.sessionDates.includes(newDate)) {
      selectedGroup.sessionDates.push(newDate);
      selectedGroup.datesText = selectedGroup.sessionDates.join('、');
    }
    setSelectedDate(newDate);
    setCustomDateInput('');
    setShowAddDate(false);
  };

  const handleExportGroupExcel = () => {
    if (!selectedGroup) return;
    exportSingleGroupRollCallToExcel(selectedGroup, students, enrollments, attendanceRecords, maskPhone);
  };

  const handleExportGroupToDrive = async () => {
    if (!selectedGroup) return;
    setIsExportingToDrive(true);
    setDriveExportSuccessUrl(null);
    try {
      let token = getAccessToken();
      if (!token) {
        const authRes = await googleSignIn();
        token = authRes.accessToken;
      }
      const folder = await findOrCreateAppFolder(token);
      const blob = generateSingleGroupExcelBlob(selectedGroup, students, enrollments, attendanceRecords, maskPhone);
      const fileName = `${selectedGroup.id}_${selectedGroup.name}_點名表_${new Date().toLocaleDateString('zh-HK').replace(/\//g, '-')}.xlsx`;
      const uploaded = await uploadBlobToDrive(token, fileName, blob, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', folder.id);
      
      setDriveExportSuccessUrl(uploaded.webViewLink || null);
      alert(`✅ 點名表已成功儲存至 Google Drive：\n${uploaded.name}`);
    } catch (err: any) {
      console.error('Export to Drive error:', err);
      alert(`儲存至 Google Drive 失敗：${err.message || '請確認授權'}`);
    } finally {
      setIsExportingToDrive(false);
    }
  };

  // Student Attendance History modal info
  const historyStudent = historyStudentId ? studentMap.get(historyStudentId) : null;
  const historyStudentRecords = useMemo(() => {
    if (!historyStudentId || !selectedGroup) return [];
    return attendanceRecords.filter(
      r => r.studentId === historyStudentId && r.groupId === selectedGroup.id
    );
  }, [historyStudentId, selectedGroup, attendanceRecords]);

  return (
    <div className="space-y-6">
      {/* Top Header & Day/Group Filter */}
      <div className="bg-white rounded-xl border border-[#E5E2DA] p-5 shadow-xs">
        {/* Role permission info strip */}
        <div className="mb-4 pb-3 border-b border-[#EAE7DE] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#485945]" />
            <span className="font-semibold text-[#2C2C2A]">
              當前權限：{role === 'admin' ? '管理員 (可進行所有點名、新增堂數及管理)' : role === 'head-teacher' ? '科主任 (可點名、標記出席與備註)' : role === 'teacher' ? '教師 (可進行負責小組點名與出勤登記)' : '訪客 (唯讀查閱)'}
            </span>
          </div>
          <span className="text-[#78786E]">
            共 <strong className="text-[#485945]">{activityGroups.length}</strong> 個活動小組 (支援星期一至星期六)
          </span>
        </div>

        {/* Weekday Selector Pills */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-bold text-[#78786E] shrink-0 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> 星期篩選：
          </span>
          <button
            onClick={() => setSelectedDayFilter('全部')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              selectedDayFilter === '全部'
                ? 'bg-[#485945] text-white shadow-xs'
                : 'bg-[#EFEFEA] text-[#4A4A42] hover:bg-[#E5E2DA]'
            }`}
          >
            全部 ({activityGroups.length})
          </button>
          {WEEKDAYS.map((day) => {
            const count = activityGroups.filter(g => g.days.includes(day)).length;
            const isSelected = selectedDayFilter === day;
            return (
              <button
                key={day}
                onClick={() => setSelectedDayFilter(day)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#485945] text-white shadow-xs'
                    : 'bg-[#EFEFEA] text-[#4A4A42] hover:bg-[#E5E2DA]'
                }`}
              >
                <span>{day}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-[#DDDCD4] text-[#606056]'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Group Dropdown */}
          <div className="flex-1 max-w-xl">
            <label className="block text-xs font-bold text-[#4A4A42] mb-1.5 flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4 text-[#485945]" />
              <span>選擇點名活動小組 (Group ID)</span>
            </label>
            <select
              id="rollcall-group-select"
              value={selectedGroup?.id || ''}
              onChange={(e) => {
                const gid = e.target.value;
                setSelectedGroupId(gid);
                const g = activityGroups.find(x => x.id === gid);
                if (g && g.sessionDates && g.sessionDates.length > 0) {
                  setSelectedDate(g.sessionDates[0]);
                }
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-[#DDDCD4] text-sm font-bold text-[#2C2C2A] bg-[#FAF9F5] focus:bg-white focus:ring-2 focus:ring-[#485945]"
            >
              {filteredGroups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.id} - {g.name} ({g.days.join('、')} {g.startTime}-{g.endTime} @ {g.venue}) {g.isSSupportGroup ? '★ S支援' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Export and Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
            <button
              onClick={handleExportGroupExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF9F5] hover:bg-[#EFEFEA] text-[#2C2C2A] text-xs font-semibold transition-colors border border-[#DDDCD4] shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>導出 Excel</span>
            </button>

            <button
              onClick={handleExportGroupToDrive}
              disabled={isExportingToDrive}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EEF5EF] hover:bg-[#D0E4D3] text-[#2C5E32] text-xs font-bold transition-colors border border-[#D0E4D3] shadow-xs disabled:opacity-50"
            >
              <CloudUpload className={`w-3.5 h-3.5 ${isExportingToDrive ? 'animate-bounce' : ''}`} />
              <span>{isExportingToDrive ? '上傳至 Drive...' : '儲存至 Google Drive'}</span>
            </button>

            {driveExportSuccessUrl && (
              <a
                href={driveExportSuccessUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="在 Google 雲端硬碟中開啟"
                className="p-2 text-[#1A73E8] bg-[#E8F0FE] border border-[#D2E3FC] rounded-xl hover:bg-[#D2E3FC] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Selected Group Info Header */}
        {selectedGroup && (
          <div className="mt-4 pt-4 border-t border-[#EAE7DE] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[#78786E]">
              <span className="font-bold text-[#2C2C2A] text-sm">{selectedGroup.name}</span>
              {selectedGroup.isSSupportGroup && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]">
                  S支援小組
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EFEFEA] text-[#4A4A42]">
                {selectedGroup.category}
              </span>
              <span>負責教師：<strong className="text-[#2C2C2A]">{selectedGroup.teacher}</strong></span>
              <span>地點：<strong className="text-[#2C2C2A]">{selectedGroup.venue}</strong></span>
              <span>上課時間：<strong className="text-[#2C2C2A]">{selectedGroup.days.join('、')} {selectedGroup.startTime}–{selectedGroup.endTime}</strong></span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-[#78786E] font-medium text-xs">
                報讀學生：<strong className="text-[#485945] text-sm font-bold">{enrollments.filter(e => e.groupId === selectedGroup.id).length}</strong> / {selectedGroup.maxCapacity || 35} 人
              </div>
              {role !== 'guest' && onBatchEnrollStudents && (
                <button
                  onClick={() => setIsBatchEnrollOpen(true)}
                  title="批量挑選全校名冊或匯入 Excel/CSV 名單 (掛上樣本)"
                  className="px-2.5 py-1 rounded-lg bg-[#2C5E32] hover:bg-[#234B28] text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>批量導入名單</span>
                </button>
              )}
              {role !== 'guest' && onEnrollStudent && (
                <button
                  onClick={() => onEnrollStudent(selectedGroup.id)}
                  title="為此活動小組加入新學生"
                  className="px-2.5 py-1 rounded-lg bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>單一新增</span>
                </button>
              )}
              {role !== 'guest' && onEditGroup && (
                <button
                  onClick={() => onEditGroup(selectedGroup)}
                  title="修改活動小組設定 (名稱、日期、時間、地點、人數、負責老師)"
                  className="px-2.5 py-1 rounded-lg bg-[#EEF5EF] hover:bg-[#D0E4D3] text-[#2C5E32] text-xs font-semibold flex items-center gap-1 transition-colors border border-[#D0E4D3]"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>修改小組設定</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Session Dates & Quick Batch Actions Bar */}
      <div className="bg-white rounded-xl border border-[#E5E2DA] p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Date / Session selector pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <span className="text-xs font-bold text-[#78786E] shrink-0 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> 點名堂數/日期：
          </span>
          {sessionDates.map((date) => {
            const isSelected = selectedDate === date;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#485945] text-white shadow-xs'
                    : 'bg-[#EFEFEA] text-[#4A4A42] hover:bg-[#E5E2DA]'
                }`}
              >
                {date}
              </button>
            );
          })}

          {/* Add custom date button */}
          {role !== 'guest' && (
            showAddDate ? (
              <form onSubmit={handleAddCustomDate} className="flex items-center gap-1">
                <input
                  type="text"
                  value={customDateInput}
                  onChange={(e) => setCustomDateInput(e.target.value)}
                  placeholder="如 9/10"
                  className="w-16 px-2 py-1 text-xs rounded-md border border-[#485945] bg-[#FAF9F5] text-[#2C2C2A] focus:ring-1 focus:ring-[#485945]"
                  autoFocus
                />
                <button type="submit" className="p-1 bg-[#485945] text-white rounded-md text-xs">
                  <Check className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => setShowAddDate(false)} className="p-1 bg-[#EFEFEA] text-[#78786E] rounded-md text-xs">
                  <X className="w-3 h-3" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowAddDate(true)}
                className="p-1.5 rounded-lg bg-[#EFEFEA] text-[#78786E] hover:text-[#485945] hover:bg-[#ECEFE9] transition-colors flex items-center gap-1 text-xs"
                title="新增自訂堂數/日期"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>加堂</span>
              </button>
            )
          )}
        </div>

        {/* Quick Batch Actions & Search in Roll Call */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#99998E]" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="搜尋此組學生..."
              className="pl-8 pr-2 py-1.5 text-xs rounded-lg border border-[#DDDCD4] bg-[#FAF9F5] text-[#2C2C2A] focus:ring-1 focus:ring-[#485945] w-36"
            />
          </div>

          {role !== 'guest' && (
            <>
              <button
                id="batch-mark-present-btn"
                onClick={handleMarkAllPresent}
                className="px-3 py-1.5 rounded-lg bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>全體出席 (P)</span>
              </button>
              <button
                id="batch-reset-btn"
                onClick={handleResetAttendance}
                className="px-3 py-1.5 rounded-lg bg-[#FAF9F5] hover:bg-[#EFEFEA] text-[#78786E] text-xs font-semibold transition-colors border border-[#DDDCD4]"
              >
                重設此堂
              </button>
            </>
          )}
        </div>
      </div>

      {/* Real-time Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-[#E5E2DA] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#78786E] block">應到人數</span>
            <span className="text-xl font-bold text-[#2C2C2A]">{summary.total}</span>
          </div>
          <span className="text-xs text-[#99998E]">人</span>
        </div>

        <div className="bg-[#EEF5EF] p-3.5 rounded-xl border border-[#D0E4D3] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#2C5E32] block">實到出席 (P)</span>
            <span className="text-xl font-bold text-[#2C5E32]">{summary.p}</span>
          </div>
          <Check className="w-5 h-5 text-[#2C5E32]" />
        </div>

        <div className="bg-[#FDF0F0] p-3.5 rounded-xl border border-[#F5CCCC] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#8C3A3A] block">缺席 (A)</span>
            <span className="text-xl font-bold text-[#8C3A3A]">{summary.a}</span>
          </div>
          <X className="w-5 h-5 text-[#8C3A3A]" />
        </div>

        <div className="bg-[#FDF6ED] p-3.5 rounded-xl border border-[#EED7B8] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#8C521E] block">請假 (L)</span>
            <span className="text-xl font-bold text-[#8C521E]">{summary.l}</span>
          </div>
          <Clock className="w-5 h-5 text-[#8C521E]" />
        </div>

        <div className="bg-[#ECEFE9] p-3.5 rounded-xl border border-[#CCD8C7] shadow-xs col-span-2 sm:col-span-1 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#364733] block">即時出席率</span>
            <span className="text-xl font-bold text-[#364733]">{summary.rate}%</span>
          </div>
          <span className="text-[10px] text-[#364733] bg-white px-1.5 py-0.5 rounded font-mono border border-[#CCD8C7]">
            P/(P+A+L)
          </span>
        </div>
      </div>

      {/* Guest Read-only Alert */}
      {role === 'guest' && (
        <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E5E2DA] text-[#78786E] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#8C521E] shrink-0" />
          <span>目前以「訪客」身份瀏覽點名表（唯讀模式）。請於右上角切換至「教師」或「管理員」進行即時點名操作。</span>
        </div>
      )}

      {/* Student Roll Call Table */}
      <div className="bg-white rounded-xl border border-[#E5E2DA] overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-[#FAF9F5] border-b border-[#E5E2DA] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#2C2C2A]">
            {selectedDate} 學生點名名單 (共 {groupEnrollments.length} 名)
          </h3>
          <span className="text-xs text-[#78786E]">
            點擊狀態按鈕即可即時儲存點名
          </span>
        </div>

        {groupEnrollments.length === 0 ? (
          <div className="text-center py-16 text-[#99998E] text-xs">
            此活動小組目前尚未加入符合搜尋條件的學生。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F5F0] border-b border-[#E5E2DA] text-[#606056] font-bold">
                <tr>
                  <th className="px-3 py-3 w-12 text-center">編號</th>
                  <th className="px-3 py-3">班別</th>
                  <th className="px-3 py-3">學號</th>
                  <th className="px-4 py-3">學生姓名</th>
                  <th className="px-2 py-3 text-center">性別</th>
                  <th className="px-3 py-3">放學方式</th>
                  <th className="px-4 py-3">緊急聯絡電話</th>
                  <th className="px-4 py-3 text-center min-w-56">點名狀態 (P / A / L / NA)</th>
                  <th className="px-4 py-3 min-w-44">備註 (請假原因/說明)</th>
                  <th className="px-3 py-3 text-center">歷史</th>
                  {role !== 'guest' && onRemoveEnrollment && (
                    <th className="px-3 py-3 text-center">操作</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE7DE] text-[#4A4A42]">
                {groupEnrollments.map((en, idx) => {
                  const s = studentMap.get(en.studentId);
                  const record = currentAttendanceMap.get(en.studentId);
                  const currentStatus: AttendanceStatus = record ? record.status : 'NA';
                  const note = record?.note || '';

                  return (
                    <tr 
                      key={en.id} 
                      className={`hover:bg-[#FAF9F5] transition-colors ${
                        currentStatus === 'A' ? 'bg-[#FDF0F0]/50' : currentStatus === 'L' ? 'bg-[#FDF6ED]/50' : ''
                      }`}
                    >
                      <td className="px-3 py-3 text-center font-mono font-bold text-[#78786E]">{idx + 1}</td>
                      <td className="px-3 py-3 font-semibold text-[#2C2C2A]">{s?.class || '-'}</td>
                      <td className="px-3 py-3 font-mono text-[#78786E]">{s?.classNo || '-'}</td>
                      <td className="px-4 py-3 font-bold text-[#2C2C2A]">
                        <div className="flex items-center gap-1.5">
                          <span>{s?.name || en.studentId}</span>
                          {s?.isSSupport && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]">
                              S支援
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center font-medium text-[#78786E]">{s?.gender || '-'}</td>
                      <td className="px-3 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EFEFEA] text-[#4A4A42]">
                          {en.dismissalMethod || '自行放學'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {role === 'guest' ? (
                          <span className="inline-flex items-center gap-1 text-[#99998E] text-[11px] font-sans italic" title="訪客身份無權限查閱電話">
                            <Lock className="w-3 h-3 text-[#99998E]" />
                            <span>訪客無權查閱</span>
                          </span>
                        ) : s?.phone ? (
                          maskPhone ? (
                            <span>{s.phone.slice(0, 2)}****{s.phone.slice(-2)}</span>
                          ) : (
                            <span className="text-[#2C2C2A]">{s.phone}</span>
                          )
                        ) : (
                          <span className="text-[#B8B8AC]">-</span>
                        )}
                      </td>

                      {/* Status Buttons */}
                      <td className="px-4 py-2 text-center">
                        <div className="inline-flex items-center gap-1 p-1 bg-[#EFEFEA] rounded-xl border border-[#DDDCD4]">
                          <button
                            type="button"
                            disabled={role === 'guest'}
                            onClick={() => handleSetStatus(en.studentId, 'P')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                              currentStatus === 'P'
                                ? 'bg-[#485945] text-white shadow-xs'
                                : 'text-[#78786E] hover:text-[#2C5E32] hover:bg-[#EEF5EF]'
                            }`}
                            title="出席 (Present)"
                          >
                            P 出席
                          </button>
                          <button
                            type="button"
                            disabled={role === 'guest'}
                            onClick={() => handleSetStatus(en.studentId, 'A')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                              currentStatus === 'A'
                                ? 'bg-[#8C3A3A] text-white shadow-xs'
                                : 'text-[#78786E] hover:text-[#8C3A3A] hover:bg-[#FDF0F0]'
                            }`}
                            title="缺席 (Absent)"
                          >
                            A 缺席
                          </button>
                          <button
                            type="button"
                            disabled={role === 'guest'}
                            onClick={() => handleSetStatus(en.studentId, 'L')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                              currentStatus === 'L'
                                ? 'bg-[#8C521E] text-white shadow-xs'
                                : 'text-[#78786E] hover:text-[#8C521E] hover:bg-[#FDF6ED]'
                            }`}
                            title="請假 (Leave)"
                          >
                            L 請假
                          </button>
                          <button
                            type="button"
                            disabled={role === 'guest'}
                            onClick={() => handleSetStatus(en.studentId, 'NA')}
                            className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                              currentStatus === 'NA'
                                ? 'bg-[#DDDCD4] text-[#2C2C2A] shadow-xs'
                                : 'text-[#99998E] hover:text-[#2C2C2A]'
                            }`}
                            title="不適用 / 未記錄 (NA)"
                          >
                            NA
                          </button>
                        </div>
                      </td>

                      {/* Note Input */}
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          disabled={role === 'guest'}
                          value={note}
                          onChange={(e) => handleSetNote(en.studentId, e.target.value)}
                          placeholder="例如 病假、早退、代表比賽..."
                          className="w-full px-2.5 py-1 text-xs rounded-lg border border-[#DDDCD4] bg-[#FAF9F5] text-[#2C2C2A] focus:ring-1 focus:ring-[#485945] focus:bg-white disabled:bg-[#EFEFEA] disabled:text-[#99998E]"
                        />
                      </td>

                      {/* History button */}
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setHistoryStudentId(en.studentId)}
                          className="p-1 text-[#78786E] hover:text-[#485945] hover:bg-[#EFEFEA] rounded-md transition-colors"
                          title="查看該生在此小組之過往出席記錄"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </td>

                      {/* Remove from group button for teacher/head-teacher/admin */}
                      {role !== 'guest' && onRemoveEnrollment && (
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              const sName = s?.name || en.studentId;
                              if (window.confirm(`確定要將學生「${sName} (${s?.class || ''}${s?.classNo || ''})」從本活動小組「${selectedGroup.name}」移出嗎？\n\n移出後該生將不再列入此小組名單。`)) {
                                onRemoveEnrollment(en.id);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-[#8C3A3A] bg-[#FDF0F0] hover:bg-[#FBE2E2] border border-[#F5CCCC] hover:border-[#8C3A3A] transition-colors"
                            title="從此活動小組移出此學生"
                          >
                            <UserMinus className="w-3 h-3" />
                            <span>移出小組</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student History Modal */}
      {historyStudentId && historyStudent && selectedGroup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5E2DA] max-w-md w-full p-5 shadow-lg space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE7DE]">
              <div>
                <h4 className="text-base font-bold text-[#2C2C2A]">
                  {historyStudent.name} ({historyStudent.class} {historyStudent.classNo}號)
                </h4>
                <p className="text-xs text-[#78786E] mt-0.5">
                  活動小組：{selectedGroup.name} ({selectedGroup.id})
                </p>
              </div>
              <button
                onClick={() => setHistoryStudentId(null)}
                className="p-1 rounded-lg text-[#78786E] hover:bg-[#EFEFEA]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {sessionDates.map(date => {
                const rec = attendanceRecords.find(
                  r => r.groupId === selectedGroup.id && r.studentId === historyStudent.id && r.date === date
                );
                const st = rec ? rec.status : 'NA';
                return (
                  <div key={date} className="p-2.5 rounded-xl border border-[#EAE7DE] bg-[#FAF9F5] flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#2C2C2A]">{date}</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                        st === 'P' ? 'bg-[#EEF5EF] text-[#2C5E32]' : st === 'A' ? 'bg-[#FDF0F0] text-[#8C3A3A]' : st === 'L' ? 'bg-[#FDF6ED] text-[#8C521E]' : 'bg-[#EFEFEA] text-[#78786E]'
                      }`}>
                        {st === 'P' ? 'P 出席' : st === 'A' ? 'A 缺席' : st === 'L' ? 'L 請假' : 'NA 未記錄'}
                      </span>
                      {rec?.note && (
                        <span className="text-[#78786E] text-[11px] italic">({rec.note})</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setHistoryStudentId(null)}
                className="px-4 py-2 rounded-xl bg-[#485945] text-white text-xs font-bold"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Enroll & Import Modal */}
      {isBatchEnrollOpen && selectedGroup && (
        <BatchEnrollModal
          isOpen={isBatchEnrollOpen}
          onClose={() => setIsBatchEnrollOpen(false)}
          group={selectedGroup}
          students={students}
          enrollments={enrollments}
          onBatchEnroll={(groupId, list, newStudents) => {
            if (onBatchEnrollStudents) {
              onBatchEnrollStudents(groupId, list, newStudents);
            }
          }}
        />
      )}
    </div>
  );
};
