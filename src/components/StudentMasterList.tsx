import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  AlertTriangle, 
  Check, 
  FileSpreadsheet, 
  UserPlus, 
  Edit, 
  Trash2, 
  Lock, 
  Upload, 
  Download, 
  Layers, 
  RefreshCw, 
  CheckSquare, 
  Square,
  Sparkles,
  Plus
} from 'lucide-react';
import { Student, ActivityGroup, Enrollment, UserRole } from '../types';
import { exportStudentsDetailToExcel, exportStudentMasterToExcel } from '../utils/excel';
import { StudentBatchUpdateModal } from './StudentBatchUpdateModal';
import { StudentImportUpdateModal } from './StudentImportUpdateModal';

interface StudentMasterListProps {
  students: Student[];
  activityGroups: ActivityGroup[];
  enrollments: Enrollment[];
  role: UserRole;
  maskPhone: boolean;
  initialFilterPendingSupport?: boolean;
  onAddStudent: () => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onQuickEnroll: (student: Student) => void;
  onSaveStudent?: (student: Student) => void;
  onRemoveEnrollment?: (enrollmentId: string) => void;
  onBatchUpdateStudents?: (
    studentIds: string[],
    updates: Partial<Student>,
    options?: { addGroupId?: string; removeGroupId?: string }
  ) => void;
  onBulkImportStudents?: (newOrUpdatedStudents: Student[], mode: 'merge' | 'replace') => void;
  onShowToast?: (msg: string) => void;
}

export const StudentMasterList: React.FC<StudentMasterListProps> = ({
  students,
  activityGroups,
  enrollments,
  role,
  maskPhone,
  initialFilterPendingSupport = false,
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  onQuickEnroll,
  onSaveStudent,
  onRemoveEnrollment,
  onBatchUpdateStudents,
  onBulkImportStudents,
  onShowToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'master' | 'detail'>('master');
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('全部');
  const [selectedGrade, setSelectedGrade] = useState('全部');
  const [selectedSSupportFilter, setSelectedSSupportFilter] = useState<'all' | 'ssupport_only' | 'pending_only'>(
    initialFilterPendingSupport ? 'pending_only' : 'all'
  );

  // Multi-select state
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const groupMap = useMemo(() => new Map(activityGroups.map(g => [g.id, g])), [activityGroups]);

  // Unique Classes & Grades
  const availableClasses = useMemo(() => {
    const set = new Set(students.map(s => s.class).filter(Boolean));
    return Array.from(set).sort();
  }, [students]);

  const availableGrades = useMemo(() => {
    const set = new Set(students.map(s => s.grade).filter(Boolean));
    return Array.from(set).sort();
  }, [students]);

  // Compute stats for each student for the Master Table
  const enrichedStudents = useMemo(() => {
    return students.map(s => {
      const studentEnrolls = enrollments.filter(e => e.studentId === s.id);
      const joinedGroups = studentEnrolls.map(e => groupMap.get(e.groupId)).filter(Boolean) as ActivityGroup[];

      const sSupportGroups = joinedGroups.filter(g => g.isSSupportGroup);
      const otherGroups = joinedGroups.filter(g => !g.isSSupportGroup);

      const joinedDays = Array.from(new Set(joinedGroups.flatMap(g => g.days)));

      let followUp = '';
      let isPendingSupport = false;

      if (s.isSSupport) {
        if (sSupportGroups.length === 0) {
          followUp = '尚未編排S支援活動小組';
          isPendingSupport = true;
        } else {
          followUp = '正常';
        }
      }

      return {
        ...s,
        enrollmentsCount: studentEnrolls.length,
        sSupportCount: sSupportGroups.length,
        otherCount: otherGroups.length,
        joinedGroups,
        joinedDays,
        followUp,
        isPendingSupport,
      };
    });
  }, [students, enrollments, groupMap]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return enrichedStudents.filter(s => {
      const matchesSearch = 
        !search ||
        s.id.toLowerCase().includes(search.toLowerCase()) ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.class.toLowerCase().includes(search.toLowerCase()) ||
        (role !== 'guest' && s.phone && s.phone.includes(search)) ||
        (s.mainSupportNeed && s.mainSupportNeed.toLowerCase().includes(search.toLowerCase())) ||
        s.joinedGroups.some(g => g.name.toLowerCase().includes(search.toLowerCase()));

      const matchesClass = selectedClass === '全部' || s.class === selectedClass;
      const matchesGrade = selectedGrade === '全部' || s.grade === selectedGrade;

      let matchesSupport = true;
      if (selectedSSupportFilter === 'ssupport_only') {
        matchesSupport = s.isSSupport;
      } else if (selectedSSupportFilter === 'pending_only') {
        matchesSupport = s.isPendingSupport;
      }

      return matchesSearch && matchesClass && matchesGrade && matchesSupport;
    });
  }, [enrichedStudents, search, selectedClass, selectedGrade, selectedSSupportFilter, role]);

  const pendingCount = enrichedStudents.filter(s => s.isPendingSupport).length;

  // Selection helpers
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map(s => s.id));
    }
  };

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Quick inline toggle for S-Support (admin / teacher)
  const handleQuickToggleSSupport = (student: Student) => {
    if (role === 'guest') return;
    if (!onSaveStudent) return;
    const nextState = !student.isSSupport;
    const updated: Student = {
      ...student,
      isSSupport: nextState,
      mainSupportNeed: nextState ? (student.mainSupportNeed || '專注力與執行功能訓練') : '',
    };
    onSaveStudent(updated);
    if (onShowToast) {
      onShowToast(`已更新 ${student.name} 的 S 支援狀態為「${nextState ? '需要支援 ✓' : '一般'}」`);
    }
  };

  // Quick refresh
  const handleRefreshCalculation = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      if (onShowToast) {
        onShowToast('已重新計算並同步學生總表與活動關聯！');
      }
    }, 300);
  };

  // Export handlers
  const handleExportCurrent = () => {
    if (activeSubTab === 'master') {
      exportStudentMasterToExcel(filteredStudents, activityGroups, enrollments);
      if (onShowToast) onShowToast('已成功匯出學生總表彙總 Excel！');
    } else {
      const isGuest = role === 'guest';
      exportStudentsDetailToExcel(filteredStudents, isGuest ? true : maskPhone);
      if (onShowToast) onShowToast('已成功匯出學生列表詳細檔案 Excel！');
    }
  };

  const canEdit = role === 'admin' || role === 'teacher';

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#2C2C2A]">學生總表與學生列表</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ECEFE9] text-[#364733] border border-[#CCD8C7]">
              顯示 {filteredStudents.length} / {students.length} 名
            </span>
            {selectedStudentIds.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]">
                已選取 {selectedStudentIds.length} 名
              </span>
            )}
          </div>
          <p className="text-xs text-[#78786E] mt-1">
            提供「學生總表 (參加小組數與S支援跟進)」及「學生列表 (詳細檔案)」即時更新與批量維護
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sub-tab switcher */}
          <div className="flex items-center bg-[#EFEFEA] p-1 rounded-xl border border-[#DDDCD4]">
            <button
              onClick={() => setActiveSubTab('master')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'master'
                  ? 'bg-white text-[#485945] shadow-xs'
                  : 'text-[#78786E] hover:text-[#2C2C2A]'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>學生總表</span>
            </button>
            <button
              onClick={() => setActiveSubTab('detail')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'detail'
                  ? 'bg-white text-[#485945] shadow-xs'
                  : 'text-[#78786E] hover:text-[#2C2C2A]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>學生列表</span>
            </button>
          </div>

          {/* Recalculate Sync Button */}
          <button
            onClick={handleRefreshCalculation}
            title="重新整理總表計算與活動關聯"
            className="p-2 rounded-xl bg-white border border-[#DDDCD4] hover:bg-[#FAF9F5] text-[#4A4A42] text-xs transition-colors shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#485945]' : ''}`} />
          </button>

          {/* Export Excel Button */}
          <button
            onClick={handleExportCurrent}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-[#FAF9F5] border border-[#DDDCD4] text-[#4A4A42] text-xs font-semibold transition-colors shadow-xs"
            title={`匯出當前${activeSubTab === 'master' ? '學生總表' : '學生列表'}為 Excel`}
          >
            <Download className="w-4 h-4 text-[#485945]" />
            <span className="hidden sm:inline">匯出 Excel</span>
          </button>

          {/* Batch Update Button (Active when students selected) */}
          {canEdit && selectedStudentIds.length > 0 && (
            <button
              onClick={() => setIsBatchModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8C521E] hover:bg-[#744318] text-white text-xs font-bold transition-colors shadow-xs animate-in fade-in"
            >
              <Layers className="w-4 h-4" />
              <span>批量更新 ({selectedStudentIds.length})</span>
            </button>
          )}

          {/* Import / Update Excel (Teachers & Admins) */}
          {canEdit && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FAF9F5] hover:bg-[#EFEFEA] border border-[#DDDCD4] text-[#2C2C2A] text-xs font-semibold transition-colors shadow-xs"
            >
              <Upload className="w-4 h-4 text-[#485945]" />
              <span>更新學生名單 (Excel)</span>
            </button>
          )}

          {/* Add Student Button */}
          {canEdit && (
            <button
              id="add-student-btn"
              onClick={onAddStudent}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-semibold transition-colors shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>新增學生</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar & Batch Selection Summary */}
      <div className="bg-white rounded-xl border border-[#E5E2DA] p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#99998E]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋學生編別 (如 1A01)、姓名、班別、支援需要、參加活動小組..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#DDDCD4] text-xs bg-[#FAF9F5] text-[#2C2C2A] focus:ring-2 focus:ring-[#485945] focus:bg-white"
            />
          </div>

          {/* Select Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs font-medium bg-[#FAF9F5] text-[#2C2C2A] focus:ring-2 focus:ring-[#485945]"
            >
              <option value="全部">全部班別</option>
              {availableClasses.map(c => (
                <option key={c} value={c}>{c} 班</option>
              ))}
            </select>

            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs font-medium bg-[#FAF9F5] text-[#2C2C2A] focus:ring-2 focus:ring-[#485945]"
            >
              <option value="全部">全部年級</option>
              {availableGrades.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            <select
              value={selectedSSupportFilter}
              onChange={(e) => setSelectedSSupportFilter(e.target.value as any)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                selectedSSupportFilter === 'pending_only'
                  ? 'bg-[#FDF6ED] text-[#8C521E] border-[#EED7B8]'
                  : selectedSSupportFilter === 'ssupport_only'
                  ? 'bg-[#ECEFE9] text-[#364733] border-[#CCD8C7]'
                  : 'bg-[#FAF9F5] text-[#2C2C2A] border-[#DDDCD4]'
              }`}
            >
              <option value="all">全部學生 ({students.length})</option>
              <option value="ssupport_only">僅看 S支援學生 (✓)</option>
              <option value="pending_only">⚠️ 僅看 S支援待跟進 ({pendingCount}人)</option>
            </select>
          </div>
        </div>

        {/* Selection Bar Helper if any selected */}
        {canEdit && selectedStudentIds.length > 0 && (
          <div className="pt-2 border-t border-[#EAE7DE] flex items-center justify-between text-xs bg-[#FAF9F5] -mx-4 -mb-4 px-4 py-2 rounded-b-xl">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#8C521E]">
                已勾選 {selectedStudentIds.length} 名學生
              </span>
              <button
                onClick={() => setSelectedStudentIds([])}
                className="text-[#78786E] hover:underline"
              >
                取消全選
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBatchModalOpen(true)}
                className="px-3 py-1 rounded-lg bg-[#8C521E] text-white font-bold text-[11px] hover:bg-[#744318] transition-colors"
              >
                開啟批量更新設定
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tables based on sub-tab */}
      {activeSubTab === 'master' ? (
        /* --- 學生總表 (按學生排列) --- */
        <div className="bg-white rounded-xl border border-[#E5E2DA] overflow-hidden shadow-xs">
          <div className="px-4 py-3 bg-[#FAF9F5] border-b border-[#E5E2DA] text-xs text-[#78786E] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-1 text-[#4A4A42] font-semibold hover:text-[#2C2C2A]"
                  title="全選 / 取消全選"
                >
                  {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-[#485945]" />
                  ) : (
                    <Square className="w-4 h-4 text-[#99998E]" />
                  )}
                  <span>全選</span>
                </button>
              )}
              <span className="font-semibold text-[#4A4A42]">學生總表（自動關聯「學生列表」與「活動小組名單」）</span>
            </div>
            <span className="text-[11px] text-[#78786E]">提示：點擊 S 支援標記可直接切換更新</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F5F0] border-b border-[#E5E2DA] text-[#606056] font-bold">
                <tr>
                  {canEdit && <th className="px-3 py-3 w-8 text-center">選取</th>}
                  <th className="px-4 py-3">學生編別</th>
                  <th className="px-3 py-3">班別</th>
                  <th className="px-4 py-3">學生姓名</th>
                  <th className="px-2 py-3 text-center">性別</th>
                  <th className="px-3 py-3">支援需要</th>
                  <th className="px-3 py-3 text-center">支援小組數</th>
                  <th className="px-3 py-3 text-center">興趣/校隊/課託數</th>
                  <th className="px-4 py-3">參加活動小組</th>
                  <th className="px-3 py-3">參加星期</th>
                  <th className="px-4 py-3">跟進提示</th>
                  {canEdit && <th className="px-3 py-3 text-right">操作</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE7DE] text-[#4A4A42]">
                {filteredStudents.map((student) => {
                  const isSelected = selectedStudentIds.includes(student.id);
                  return (
                    <tr 
                      key={student.id} 
                      className={`hover:bg-[#FAF9F5] transition-colors ${
                        isSelected ? 'bg-[#ECEFE9]/40' : student.isPendingSupport ? 'bg-[#FDF6ED]/50' : ''
                      }`}
                    >
                      {canEdit && (
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleStudent(student.id)}
                            className="w-3.5 h-3.5 text-[#485945] rounded border-[#DDDCD4] focus:ring-[#485945] cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono font-bold text-[#2C2C2A]">{student.id}</td>
                      <td className="px-3 py-3 font-semibold text-[#2C2C2A]">{student.class}</td>
                      <td className="px-4 py-3 font-bold text-[#2C2C2A]">
                        <div className="flex items-center gap-1.5">
                          <span>{student.name}</span>
                          {student.isSSupport && (
                            <span 
                              className="w-2 h-2 rounded-full bg-[#8C521E] shrink-0" 
                              title="S支援學生" 
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center font-medium text-[#78786E]">{student.gender}</td>
                      <td className="px-3 py-3">
                        {canEdit ? (
                          <button
                            onClick={() => handleQuickToggleSSupport(student)}
                            className="text-left group"
                            title="點擊切換 S 支援狀態"
                          >
                            {student.mainSupportNeed ? (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#ECEFE9] text-[#364733] border border-[#CCD8C7] group-hover:border-[#485945] transition-colors">
                                {student.mainSupportNeed}
                              </span>
                            ) : student.isSSupport ? (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]">
                                S支援 ✓
                              </span>
                            ) : (
                              <span className="text-[#B8B8AC] hover:text-[#485945] transition-colors">-</span>
                            )}
                          </button>
                        ) : (
                          student.mainSupportNeed ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#ECEFE9] text-[#364733] border border-[#CCD8C7]">
                              {student.mainSupportNeed}
                            </span>
                          ) : student.isSSupport ? (
                            <span className="text-[11px] text-[#8C521E]">需支援</span>
                          ) : (
                            <span className="text-[#B8B8AC]">-</span>
                          )
                        )}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-[#8C521E]">
                        {student.sSupportCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8] text-[11px]">
                            {student.sSupportCount}
                          </span>
                        ) : (
                          <span className="text-[#B8B8AC]">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-[#364733]">
                        {student.otherCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#ECEFE9] text-[#364733] border border-[#CCD8C7] text-[11px]">
                            {student.otherCount}
                          </span>
                        ) : (
                          <span className="text-[#B8B8AC]">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {student.joinedGroups.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {student.joinedGroups.map(g => {
                              const en = enrollments.find(e => e.groupId === g.id && e.studentId === student.id);
                              return (
                                <span 
                                  key={g.id} 
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${
                                    g.isSSupportGroup 
                                      ? 'bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]' 
                                      : 'bg-[#EFEFEA] text-[#4A4A42] border border-[#DDDCD4]'
                                  }`}
                                >
                                  <span>{g.name}</span>
                                  {canEdit && en && onRemoveEnrollment && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm(`確定要將學生「${student.name} (${student.class})」從「${g.name}」名單中移出嗎？`)) {
                                          onRemoveEnrollment(en.id);
                                        }
                                      }}
                                      className="hover:text-[#8C3A3A] hover:bg-white/80 rounded px-0.5 text-xs font-bold leading-none transition-colors"
                                      title={`將 ${student.name} 移出 ${g.name}`}
                                    >
                                      ×
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[#99998E] italic">未參加任何小組</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[#485945] font-medium whitespace-nowrap">
                        {student.joinedDays.length > 0 ? student.joinedDays.join('、') : <span className="text-[#B8B8AC]">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        {student.followUp ? (
                          student.isPendingSupport ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]">
                              <AlertTriangle className="w-3 h-3 text-[#8C521E]" />
                              <span>{student.followUp}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#EEF5EF] text-[#2C5E32] border border-[#D0E4D3]">
                              <Check className="w-3 h-3" />
                              <span>{student.followUp}</span>
                            </span>
                          )
                        ) : (
                          <span className="text-[#B8B8AC]">-</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onEditStudent(student)}
                              className="p-1.5 text-[#78786E] hover:text-[#485945] hover:bg-[#EFEFEA] rounded-lg transition-colors"
                              title="編輯學生資料"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onQuickEnroll(student)}
                              className="px-2 py-1 rounded-lg bg-[#ECEFE9] hover:bg-[#CCD8C7] text-[#364733] text-[11px] font-semibold transition-colors"
                            >
                              加選活動
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`確定要將學生「${student.name} (${student.class}${student.classNo})」從學生名單中移出/刪除嗎？\n\n注意：此操作同時會清除該生所有小組報讀與出席記錄。`)) {
                                  onDeleteStudent(student.id);
                                }
                              }}
                              className="p-1.5 text-[#78786E] hover:text-[#8C3A3A] hover:bg-[#FDF0F0] rounded-lg transition-colors"
                              title="移出 / 刪除此學生"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* --- 學生詳細列表 (個人檔案) --- */
        <div className="bg-white rounded-xl border border-[#E5E2DA] overflow-hidden shadow-xs">
          <div className="px-4 py-3 bg-[#FAF9F5] border-b border-[#E5E2DA] text-xs text-[#78786E] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-1 text-[#4A4A42] font-semibold hover:text-[#2C2C2A]"
                  title="全選 / 取消全選"
                >
                  {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-[#485945]" />
                  ) : (
                    <Square className="w-4 h-4 text-[#99998E]" />
                  )}
                  <span>全選</span>
                </button>
              )}
              <span className="font-semibold text-[#4A4A42]">學生列表檔案（基本資料、S支援欄位及個人檔案）</span>
            </div>
            {role === 'guest' ? (
              <span className="text-[11px] font-semibold text-[#8C521E] bg-[#FDF6ED] px-2 py-0.5 rounded-md border border-[#EED7B8] flex items-center gap-1">
                <Lock className="w-3 h-3 text-[#8C521E]" />
                <span>訪客限制：已禁止查閱聯絡電話（僅可看出席與分組）</span>
              </span>
            ) : (
              <span className="text-[11px] text-[#78786E]">電話號碼已{maskPhone ? '自動遮蔽' : '公開顯示'}</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F5F0] border-b border-[#E5E2DA] text-[#606056] font-bold">
                <tr>
                  {canEdit && <th className="px-3 py-3 w-8 text-center">選取</th>}
                  <th className="px-4 py-3">學生編別</th>
                  <th className="px-3 py-3">班別</th>
                  <th className="px-3 py-3">學號</th>
                  <th className="px-4 py-3">學生姓名</th>
                  <th className="px-2 py-3 text-center">性別</th>
                  <th className="px-3 py-3">年級</th>
                  <th className="px-3 py-3 text-center">S支援 (✓)</th>
                  <th className="px-4 py-3">主要支援需要</th>
                  <th className="px-4 py-3">聯絡電話</th>
                  <th className="px-3 py-3">現時狀態</th>
                  <th className="px-3 py-3">備註</th>
                  {canEdit && <th className="px-3 py-3 text-right">操作</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE7DE] text-[#4A4A42]">
                {filteredStudents.map((student) => {
                  const isSelected = selectedStudentIds.includes(student.id);
                  return (
                    <tr 
                      key={student.id} 
                      className={`hover:bg-[#FAF9F5] transition-colors ${
                        isSelected ? 'bg-[#ECEFE9]/40' : ''
                      }`}
                    >
                      {canEdit && (
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleStudent(student.id)}
                            className="w-3.5 h-3.5 text-[#485945] rounded border-[#DDDCD4] focus:ring-[#485945] cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono font-bold text-[#2C2C2A]">{student.id}</td>
                      <td className="px-3 py-3 font-semibold text-[#2C2C2A]">{student.class}</td>
                      <td className="px-3 py-3 font-mono text-[#78786E]">{student.classNo}</td>
                      <td className="px-4 py-3 font-bold text-[#2C2C2A]">{student.name}</td>
                      <td className="px-2 py-3 text-center font-medium text-[#78786E]">{student.gender}</td>
                      <td className="px-3 py-3">{student.grade}</td>
                      <td className="px-3 py-3 text-center">
                        {canEdit ? (
                          <button
                            onClick={() => handleQuickToggleSSupport(student)}
                            className="hover:opacity-80 transition-opacity"
                            title="點擊切換 S 支援標記"
                          >
                            {student.isSSupport ? (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]">
                                ✓
                              </span>
                            ) : (
                              <span className="text-[#B8B8AC] hover:text-[#485945]">-</span>
                            )}
                          </button>
                        ) : (
                          student.isSSupport ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FDF6ED] text-[#8C521E]">
                              ✓
                            </span>
                          ) : (
                            <span className="text-[#B8B8AC]">-</span>
                          )
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {student.mainSupportNeed ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#ECEFE9] text-[#364733] border border-[#CCD8C7]">
                            {student.mainSupportNeed}
                          </span>
                        ) : (
                          <span className="text-[#B8B8AC]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {role === 'guest' ? (
                          <span className="inline-flex items-center gap-1 text-[#99998E] text-[11px] font-sans italic" title="訪客身份無權限查閱學生電話">
                            <Lock className="w-3 h-3 text-[#99998E]" />
                            <span>訪客無權查閱</span>
                          </span>
                        ) : student.phone ? (
                          maskPhone ? (
                            <span>{student.phone.slice(0, 2)}****{student.phone.slice(-2)}</span>
                          ) : (
                            <span className="text-[#2C2C2A]">{student.phone}</span>
                          )
                        ) : (
                          <span className="text-[#B8B8AC]">未登記</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          student.status === '在讀' ? 'bg-[#EEF5EF] text-[#2C5E32]' : 'bg-[#EFEFEA] text-[#78786E]'
                        }`}>
                          {student.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[#78786E] truncate max-w-xs">{student.remarks || '-'}</td>
                      {canEdit && (
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onEditStudent(student)}
                              className="p-1 text-[#78786E] hover:text-[#485945] hover:bg-[#EFEFEA] rounded-md transition-colors"
                              title="編輯學生資料"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`確定要將學生「${student.name} (${student.class}${student.classNo})」從學生名單中移出/刪除嗎？\n\n注意：此操作同時會清除該生所有小組報讀與出席記錄。`)) {
                                  onDeleteStudent(student.id);
                                }
                              }}
                              className="p-1 text-[#78786E] hover:text-[#8C3A3A] hover:bg-[#FDF0F0] rounded-md transition-colors"
                              title="移出 / 刪除學生"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch Update Modal */}
      {isBatchModalOpen && (
        <StudentBatchUpdateModal
          isOpen={isBatchModalOpen}
          onClose={() => {
            setIsBatchModalOpen(false);
            setSelectedStudentIds([]);
          }}
          selectedStudentIds={selectedStudentIds}
          students={students}
          activityGroups={activityGroups}
          onApplyBatchUpdate={(ids, updates, options) => {
            if (onBatchUpdateStudents) {
              onBatchUpdateStudents(ids, updates, options);
            }
          }}
        />
      )}

      {/* Import / Update Excel Modal */}
      {isImportModalOpen && (
        <StudentImportUpdateModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          currentStudents={students}
          onApplyStudentImport={(newOrUpdatedStudents, mode) => {
            if (onBulkImportStudents) {
              onBulkImportStudents(newOrUpdatedStudents, mode);
            }
          }}
        />
      )}
    </div>
  );
};
