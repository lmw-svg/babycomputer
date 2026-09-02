import React, { useState, useMemo, useRef } from 'react';
import { 
  X, 
  Users, 
  UserPlus, 
  FileSpreadsheet, 
  Download, 
  Upload, 
  Check, 
  AlertCircle, 
  Search, 
  Filter, 
  Trash2, 
  CheckSquare, 
  Square, 
  FileText, 
  Clipboard, 
  HelpCircle, 
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Student, ActivityGroup, Enrollment, DismissalMethod } from '../types';
import { 
  downloadGroupEnrollmentSampleExcel, 
  downloadGroupEnrollmentSampleCsv, 
  parseGroupEnrollmentFile, 
  parseGroupEnrollmentText, 
  ParsedGroupEnrollmentItem 
} from '../utils/excel';

interface BatchEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: ActivityGroup | null;
  students: Student[];
  enrollments: Enrollment[];
  onBatchEnroll: (
    groupId: string,
    enrollmentsToAdd: { studentId: string; dismissalMethod: DismissalMethod; remarks?: string }[],
    newStudentsToCreate?: Student[]
  ) => void;
}

const DISMISSAL_METHODS: DismissalMethod[] = ['自行放學', '家長接送', '課後託管班', '校車', '留校', '其他'];

export const BatchEnrollModal: React.FC<BatchEnrollModalProps> = ({
  isOpen,
  onClose,
  group,
  students,
  enrollments,
  onBatchEnroll,
}) => {
  if (!isOpen || !group) return null;

  const [activeTab, setActiveTab] = useState<'roster' | 'import'>('roster');

  // Existing enrollments in this group
  const existingGroupEnrollments = useMemo(() => {
    return enrollments.filter(e => e.groupId === group.id);
  }, [enrollments, group.id]);

  const existingStudentIdsSet = useMemo(() => {
    return new Set(existingGroupEnrollments.map(e => e.studentId));
  }, [existingGroupEnrollments]);

  // ==========================================
  // TAB 1: Roster Pick State
  // ==========================================
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSupportFilter, setSelectedSupportFilter] = useState<'all' | 'support' | 'normal'>('all');
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<'all' | 'M' | 'F'>('all');
  const [hideAlreadyEnrolled, setHideAlreadyEnrolled] = useState(true);

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [batchDismissalMethod, setBatchDismissalMethod] = useState<DismissalMethod>('自行放學');

  // Available classes list
  const availableClasses = useMemo(() => {
    const set = new Set(students.map(s => s.class).filter(Boolean));
    return Array.from(set).sort();
  }, [students]);

  // Filtered students for Tab 1
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = s.name.toLowerCase().includes(q);
        const matchClass = s.class.toLowerCase().includes(q);
        const matchId = s.id.toLowerCase().includes(q);
        const matchClassNo = s.classNo.toLowerCase().includes(q);
        if (!matchName && !matchClass && !matchId && !matchClassNo) return false;
      }

      // Class
      if (selectedClass !== 'all' && s.class !== selectedClass) return false;

      // Grade
      if (selectedGrade !== 'all') {
        const gradeChar = selectedGrade;
        if (!s.class.startsWith(gradeChar)) return false;
      }

      // S Support
      if (selectedSupportFilter === 'support' && !s.isSSupport) return false;
      if (selectedSupportFilter === 'normal' && s.isSSupport) return false;

      // Gender
      if (selectedGenderFilter !== 'all' && s.gender !== selectedGenderFilter) return false;

      // Hide already enrolled
      if (hideAlreadyEnrolled && existingStudentIdsSet.has(s.id)) return false;

      return true;
    });
  }, [
    students,
    searchQuery,
    selectedClass,
    selectedGrade,
    selectedSupportFilter,
    selectedGenderFilter,
    hideAlreadyEnrolled,
    existingStudentIdsSet,
  ]);

  // Toggle single student
  const toggleStudentSelection = (sid: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(sid)) {
      next.delete(sid);
    } else {
      next.add(sid);
    }
    setSelectedStudentIds(next);
  };

  // Select all visible
  const handleSelectAllVisible = () => {
    const next = new Set(selectedStudentIds);
    filteredStudents.forEach(s => {
      if (!existingStudentIdsSet.has(s.id)) {
        next.add(s.id);
      }
    });
    setSelectedStudentIds(next);
  };

  // Clear all selections
  const handleClearSelections = () => {
    setSelectedStudentIds(new Set());
  };

  // Submit Tab 1 (Roster pick)
  const handleRosterSubmit = () => {
    if (selectedStudentIds.size === 0) return;

    const list = Array.from(selectedStudentIds).map(sid => ({
      studentId: sid,
      dismissalMethod: batchDismissalMethod,
    }));

    onBatchEnroll(group.id, list);
    onClose();
  };

  // ==========================================
  // TAB 2: Import Roster (Excel / CSV / Paste)
  // ==========================================
  const [importMode, setImportMode] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showSampleDetails, setShowSampleDetails] = useState(false);
  const [autoRegisterNewStudents, setAutoRegisterNewStudents] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsed raw items
  const [parsedItems, setParsedItems] = useState<ParsedGroupEnrollmentItem[]>([]);

  // Analyze parsed items against existing students and enrollments
  const analyzedRoster = useMemo(() => {
    const studentById = new Map<string, Student>();
    const studentByClassNo = new Map<string, Student>();
    const studentByNameAndClass = new Map<string, Student>();

    students.forEach(s => {
      studentById.set(s.id.toUpperCase(), s);
      studentByClassNo.set(`${s.class.toUpperCase()}-${s.classNo.padStart(2, '0')}`, s);
      studentByNameAndClass.set(`${s.class.toUpperCase()}-${s.name}`, s);
    });

    return parsedItems.map((item, index) => {
      // Look for match in existing students
      let matchedStudent: Student | undefined = undefined;

      if (item.studentId) {
        matchedStudent = studentById.get(item.studentId.toUpperCase());
      }

      if (!matchedStudent && item.rawClass && item.rawClassNo) {
        matchedStudent = studentByClassNo.get(`${item.rawClass.toUpperCase()}-${item.rawClassNo.padStart(2, '0')}`);
      }

      if (!matchedStudent && item.rawClass && item.name) {
        matchedStudent = studentByNameAndClass.get(`${item.rawClass.toUpperCase()}-${item.name}`);
      }

      const finalId = matchedStudent ? matchedStudent.id : (item.studentId || `${item.rawClass}${item.rawClassNo || '01'}`);
      const isAlreadyInGroup = existingStudentIdsSet.has(finalId);

      return {
        id: `parsed-${index}`,
        raw: item,
        matchedStudent,
        finalId,
        isAlreadyInGroup,
        willCreateNewStudent: !matchedStudent,
        dismissalMethod: item.dismissalMethod || '自行放學',
        selected: !isAlreadyInGroup, // default checked if not already enrolled
      };
    });
  }, [parsedItems, students, existingStudentIdsSet]);

  const handleFileProcess = async (file: File) => {
    setIsProcessing(true);
    setImportError(null);
    try {
      const items = await parseGroupEnrollmentFile(file);
      if (items.length === 0) {
        setImportError('無法從檔案中讀取到學生名單，請確保欄位包含「班別、學號、學生姓名」等資訊。');
      } else {
        setParsedItems(items);
      }
    } catch (err) {
      console.error(err);
      setImportError('檔案解析失敗，請確認檔案為標準 .xlsx, .xls 或 .csv 格式。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePastedTextProcess = () => {
    if (!pastedText.trim()) return;
    setIsProcessing(true);
    setImportError(null);
    try {
      const items = parseGroupEnrollmentText(pastedText);
      if (items.length === 0) {
        setImportError('無法從文字中解析出名單，請確認表格每行包含班別、學號或姓名。');
      } else {
        setParsedItems(items);
      }
    } catch (err) {
      console.error(err);
      setImportError('文字解析失敗，請檢查文字格式。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleParsedSelect = (index: number) => {
    setParsedItems(prev => {
      // We can manage selection in local state if needed
      return [...prev];
    });
  };

  const handleDeleteParsedItem = (idx: number) => {
    setParsedItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateParsedDismissal = (idx: number, method: DismissalMethod) => {
    setParsedItems(prev => prev.map((item, i) => i === idx ? { ...item, dismissalMethod: method } : item));
  };

  // Submit Tab 2 (Import)
  const handleImportSubmit = () => {
    const validRows = analyzedRoster.filter(r => !r.isAlreadyInGroup);
    if (validRows.length === 0) return;

    const newStudentsToCreate: Student[] = [];
    const enrollmentsToAdd: { studentId: string; dismissalMethod: DismissalMethod; remarks?: string }[] = [];

    validRows.forEach(row => {
      let studentId = row.finalId;

      if (row.willCreateNewStudent && autoRegisterNewStudents) {
        const raw = row.raw;
        const newStudent: Student = {
          id: studentId,
          class: raw.rawClass || '1A',
          classNo: raw.rawClassNo || '01',
          name: raw.name || `學生 ${studentId}`,
          gender: raw.gender || 'M',
          grade: raw.rawClass ? `${raw.rawClass.slice(0, 1)}年級` : '一年級',
          isSSupport: !!raw.isSSupport,
          mainSupportNeed: raw.mainSupportNeed || '',
          phone: raw.phone || '',
          status: '在讀',
          remarks: raw.remarks || '從小組名單導入',
        };
        newStudentsToCreate.push(newStudent);
      }

      enrollmentsToAdd.push({
        studentId,
        dismissalMethod: row.dismissalMethod,
        remarks: row.raw.remarks,
      });
    });

    onBatchEnroll(group.id, enrollmentsToAdd, newStudentsToCreate);
    onClose();
  };

  const currentCapacity = existingGroupEnrollments.length;
  const maxCap = group.maxCapacity || 35;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2C2C2A]/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-[#E5E2DA] flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-[#FAF9F5] border-b border-[#E5E2DA] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#485945] text-white flex items-center justify-center font-bold shadow-xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-[#2C2C2A]">
                  批量新增 / 導入小組名單
                </h3>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#EAE7DE] text-[#4A4A42]">
                  {group.id}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EEF5EF] text-[#2C5E32] border border-[#CCD8C7]">
                  {group.name}
                </span>
              </div>
              <p className="text-xs text-[#78786E] mt-0.5 flex items-center gap-2">
                <span>時間：{group.days.join('、')} {group.startTime}-{group.endTime}</span>
                <span>•</span>
                <span>地點：{group.venue}</span>
                <span>•</span>
                <span className={`font-semibold ${currentCapacity >= maxCap ? 'text-[#C55353]' : 'text-[#485945]'}`}>
                  現有名單：{currentCapacity} / {maxCap} 人
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#99998E] hover:text-[#2C2C2A] hover:bg-[#EFEFEA] rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E5E2DA] bg-[#FAF9F5] px-6 pt-2">
          <button
            onClick={() => setActiveTab('roster')}
            className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'roster'
                ? 'border-[#485945] text-[#485945]'
                : 'border-transparent text-[#78786E] hover:text-[#2C2C2A]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>從全校學生名冊批量挑選</span>
            {selectedStudentIds.size > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#485945] text-white text-[11px]">
                {selectedStudentIds.size}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-[#485945] text-[#485945]'
                : 'border-transparent text-[#78786E] hover:text-[#2C2C2A]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>導入名單檔案 (Excel / CSV / 貼上)</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#E8F1EC] text-[#2C5E32] border border-[#CCD8C7]">
              掛上樣本
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FCFBF7]">
          
          {/* ======================================================== */}
          {/* TAB 1: Roster Pick Content */}
          {/* ======================================================== */}
          {activeTab === 'roster' && (
            <div className="space-y-4">
              
              {/* Filter Bar */}
              <div className="p-4 rounded-xl bg-white border border-[#E5E2DA] shadow-2xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#99998E]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜尋姓名 / 班別 / 學號..."
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#DDDCD4] bg-[#FAF9F5] text-sm text-[#2C2C2A] focus:ring-2 focus:ring-[#485945] focus:outline-hidden"
                    />
                  </div>

                  {/* Class Filter */}
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#DDDCD4] bg-[#FAF9F5] text-sm text-[#2C2C2A] focus:ring-2 focus:ring-[#485945]"
                  >
                    <option value="all">全校所有班別 (全部)</option>
                    {availableClasses.map(c => (
                      <option key={c} value={c}>{c} 班</option>
                    ))}
                  </select>

                  {/* S Support */}
                  <select
                    value={selectedSupportFilter}
                    onChange={(e) => setSelectedSupportFilter(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#DDDCD4] bg-[#FAF9F5] text-sm text-[#2C2C2A] focus:ring-2 focus:ring-[#485945]"
                  >
                    <option value="all">S支援分類：全部學生</option>
                    <option value="support">★ 僅顯示 S支援學生</option>
                    <option value="normal">非 S支援學生</option>
                  </select>

                  {/* Gender */}
                  <select
                    value={selectedGenderFilter}
                    onChange={(e) => setSelectedGenderFilter(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#DDDCD4] bg-[#FAF9F5] text-sm text-[#2C2C2A] focus:ring-2 focus:ring-[#485945]"
                  >
                    <option value="all">性別：不限</option>
                    <option value="M">男 (M)</option>
                    <option value="F">女 (F)</option>
                  </select>
                </div>

                {/* Quick Selection Actions & Options */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F0EFEA] text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSelectAllVisible}
                      className="px-2.5 py-1 rounded-md bg-[#FAF9F5] hover:bg-[#EFEFEA] text-[#4A4A42] font-semibold border border-[#DDDCD4] flex items-center gap-1.5 transition-colors"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-[#485945]" />
                      <span>全選可選結果 ({filteredStudents.filter(s => !existingStudentIdsSet.has(s.id)).length})</span>
                    </button>
                    {selectedStudentIds.size > 0 && (
                      <button
                        type="button"
                        onClick={handleClearSelections}
                        className="px-2.5 py-1 rounded-md bg-[#FAF9F5] hover:bg-[#FDF0F0] text-[#8C3A3A] font-semibold border border-[#DDDCD4] hover:border-[#F5C2C2] transition-colors"
                      >
                        清除已選 ({selectedStudentIds.size})
                      </button>
                    )}
                  </div>

                  <label className="flex items-center gap-1.5 cursor-pointer text-[#606056] font-medium">
                    <input
                      type="checkbox"
                      checked={hideAlreadyEnrolled}
                      onChange={(e) => setHideAlreadyEnrolled(e.target.checked)}
                      className="rounded border-[#DDDCD4] text-[#485945] focus:ring-[#485945]"
                    />
                    <span>隱藏已在「{group.name}」中的學生</span>
                  </label>
                </div>
              </div>

              {/* Student Table */}
              <div className="bg-white rounded-xl border border-[#E5E2DA] overflow-hidden shadow-2xs">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F5] sticky top-0 border-b border-[#E5E2DA] text-[#606056] font-bold z-10">
                      <tr>
                        <th className="px-3 py-2.5 w-10 text-center">選擇</th>
                        <th className="px-3 py-2.5">班別</th>
                        <th className="px-3 py-2.5">學號</th>
                        <th className="px-3 py-2.5">學生姓名</th>
                        <th className="px-3 py-2.5">性別</th>
                        <th className="px-3 py-2.5">S支援</th>
                        <th className="px-3 py-2.5">學生狀態</th>
                        <th className="px-3 py-2.5 text-right">已報讀小組</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAE7DE] text-[#4A4A42]">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-[#99998E]">
                            沒有符合篩選條件的學生
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((s) => {
                          const isAlreadyIn = existingStudentIdsSet.has(s.id);
                          const isSelected = selectedStudentIds.has(s.id);
                          const studentEns = enrollments.filter(e => e.studentId === s.id);

                          return (
                            <tr
                              key={s.id}
                              onClick={() => {
                                if (!isAlreadyIn) toggleStudentSelection(s.id);
                              }}
                              className={`transition-colors ${
                                isAlreadyIn
                                  ? 'bg-[#F9F9F8] opacity-60 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-[#EEF5EF] hover:bg-[#E2EFE4] cursor-pointer'
                                  : 'hover:bg-[#FAF9F5] cursor-pointer'
                              }`}
                            >
                              <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  disabled={isAlreadyIn}
                                  checked={isSelected}
                                  onChange={() => toggleStudentSelection(s.id)}
                                  className="rounded border-[#DDDCD4] text-[#485945] focus:ring-[#485945] cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-3 py-2 font-bold text-[#2C2C2A]">{s.class}</td>
                              <td className="px-3 py-2 font-mono">{s.classNo}</td>
                              <td className="px-3 py-2 font-semibold text-[#2C2C2A]">
                                {s.name}
                                {isAlreadyIn && (
                                  <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#EAE7DE] text-[#78786E]">
                                    已在此組
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">{s.gender === 'F' ? '女' : '男'}</td>
                              <td className="px-3 py-2">
                                {s.isSSupport ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]">
                                    ★ S支援 {s.mainSupportNeed ? `(${s.mainSupportNeed})` : ''}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="px-3 py-2 text-[#78786E]">{s.status}</td>
                              <td className="px-3 py-2 text-right font-mono text-[#485945]">
                                {studentEns.length} 個小組
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Config & Submit */}
              <div className="p-4 rounded-xl bg-white border border-[#E5E2DA] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-[#4A4A42] whitespace-nowrap">
                    統一指定所選學生放學方式：
                  </label>
                  <select
                    value={batchDismissalMethod}
                    onChange={(e) => setBatchDismissalMethod(e.target.value as DismissalMethod)}
                    className="px-3 py-1.5 rounded-lg border border-[#DDDCD4] bg-[#FAF9F5] text-xs font-semibold text-[#2C2C2A]"
                  >
                    {DISMISSAL_METHODS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-[#78786E] block">
                      已選擇：<strong className="text-[#2C2C2A] text-sm">{selectedStudentIds.size}</strong> 位學生
                    </span>
                    {selectedStudentIds.size + currentCapacity > maxCap && (
                      <span className="text-[11px] font-bold text-[#C55353] flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        加入後將達 {selectedStudentIds.size + currentCapacity} 人 (超過上限 {maxCap} 人)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={selectedStudentIds.size === 0}
                    onClick={handleRosterSubmit}
                    className="px-4 py-2 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs sm:text-sm font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>確認加入名單 ({selectedStudentIds.size} 人)</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: Import Roster (Excel / CSV / Paste) Content */}
          {/* ======================================================== */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              
              {/* Sample Download Section (掛上樣本) */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#EEF5EF] via-[#F4F8F4] to-[#FAF9F5] border border-[#CCD8C7] shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#485945] text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[#2C2C2A]">
                          掛上範本：小組學生名單匯入樣本
                        </h4>
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#D8E8DC] text-[#2C5E32]">
                          推薦下載填寫
                        </span>
                      </div>
                      <p className="text-xs text-[#606056] mt-0.5">
                        支援自動匹配班級、學號及姓名，亦支援填寫放學方式、性別與 S 支援屬性。
                      </p>
                    </div>
                  </div>

                  {/* Sample Download Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => downloadGroupEnrollmentSampleExcel(group)}
                      className="px-3 py-1.5 rounded-lg bg-[#2C5E32] hover:bg-[#234B28] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                      title="下載標準 Excel 格式範本"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>下載 Excel 範本 (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadGroupEnrollmentSampleCsv(group)}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FAF9F5] text-[#2C2C2A] border border-[#CCD8C7] text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                      title="下載 CSV 格式範本"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#485945]" />
                      <span>下載 CSV 範本</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSampleDetails(!showSampleDetails)}
                      className="p-1.5 text-[#606056] hover:text-[#2C2C2A] rounded-lg hover:bg-white/60 transition-colors"
                      title="展開查看範本格式說明"
                    >
                      {showSampleDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Collapsible Sample Format Table */}
                {showSampleDetails && (
                  <div className="mt-3 pt-3 border-t border-[#CCD8C7]/60 text-xs animate-in fade-in duration-100">
                    <p className="font-bold text-[#4A4A42] mb-1.5 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-[#485945]" />
                      <span>標準範本欄位說明（Excel / CSV 第一列需包含以下欄位名稱）：</span>
                    </p>
                    <div className="overflow-x-auto border border-[#CCD8C7] rounded-lg bg-white">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-[#FAF9F5] text-[#4A4A42] font-bold border-b border-[#CCD8C7]">
                          <tr>
                            <th className="px-2.5 py-1.5">班別 (必填)</th>
                            <th className="px-2.5 py-1.5">學號 (必填)</th>
                            <th className="px-2.5 py-1.5">學生姓名 (必填)</th>
                            <th className="px-2.5 py-1.5">性別 (選填)</th>
                            <th className="px-2.5 py-1.5">放學方式 (選填)</th>
                            <th className="px-2.5 py-1.5">聯絡電話 (選填)</th>
                            <th className="px-2.5 py-1.5">S支援 (選填)</th>
                            <th className="px-2.5 py-1.5">備註 (選填)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EAE7DE] text-[#606056]">
                          <tr>
                            <td className="px-2.5 py-1 font-mono font-bold text-[#2C2C2A]">4B</td>
                            <td className="px-2.5 py-1 font-mono">11</td>
                            <td className="px-2.5 py-1 font-semibold text-[#2C2C2A]">陳小明</td>
                            <td className="px-2.5 py-1">男</td>
                            <td className="px-2.5 py-1 text-[#485945] font-semibold">自行放學</td>
                            <td className="px-2.5 py-1 font-mono">91234567</td>
                            <td className="px-2.5 py-1">否</td>
                            <td className="px-2.5 py-1">常規隊員</td>
                          </tr>
                          <tr>
                            <td className="px-2.5 py-1 font-mono font-bold text-[#2C2C2A]">4B</td>
                            <td className="px-2.5 py-1 font-mono">12</td>
                            <td className="px-2.5 py-1 font-semibold text-[#2C2C2A]">李美美</td>
                            <td className="px-2.5 py-1">女</td>
                            <td className="px-2.5 py-1 text-[#485945] font-semibold">家長接送</td>
                            <td className="px-2.5 py-1 font-mono">92345678</td>
                            <td className="px-2.5 py-1 text-[#8C521E] font-bold">是</td>
                            <td className="px-2.5 py-1">樂隊小提琴部</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Input Method Switch */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setImportMode('file')}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                    importMode === 'file'
                      ? 'bg-[#485945] text-white shadow-2xs'
                      : 'bg-white border border-[#DDDCD4] text-[#78786E] hover:text-[#2C2C2A]'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>上傳 Excel / CSV 檔案</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('paste')}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                    importMode === 'paste'
                      ? 'bg-[#485945] text-white shadow-2xs'
                      : 'bg-white border border-[#DDDCD4] text-[#78786E] hover:text-[#2C2C2A]'
                  }`}
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  <span>從 Excel / 表格直接貼上文字</span>
                </button>
              </div>

              {/* Upload Area */}
              {importMode === 'file' ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileProcess(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-6 sm:p-8 rounded-xl border-2 border-dashed text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#485945] bg-[#EEF5EF]'
                      : 'border-[#DDDCD4] hover:border-[#485945] bg-white hover:bg-[#FAF9F5]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileProcess(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-[#EEF5EF] text-[#485945] flex items-center justify-center mx-auto mb-3 shadow-2xs">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-[#2C2C2A]">
                    點擊選擇或拖放 Excel / CSV 名單檔案至此處
                  </p>
                  <p className="text-xs text-[#78786E] mt-1">
                    支援 .xlsx, .xls, .csv 檔案格式
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="請直接從 Excel、Google 試算表或 Word 表格複製並粘貼於此...&#10;範例：&#10;4B&#9;11&#9;陳小明&#9;自行放學&#10;4B&#9;12&#9;李美美&#9;家長接送"
                      rows={5}
                      className="w-full p-3 rounded-xl border border-[#DDDCD4] bg-white font-mono text-xs text-[#2C2C2A] focus:ring-2 focus:ring-[#485945] focus:outline-hidden"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!pastedText.trim() || isProcessing}
                      onClick={handlePastedTextProcess}
                      className="px-4 py-1.5 rounded-lg bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>解析文字名單</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Error display */}
              {importError && (
                <div className="p-3 rounded-xl bg-[#FDF0F0] border border-[#F5C2C2] text-xs text-[#8C3A3A] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Parsed Results Preview */}
              {parsedItems.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-[#2C2C2A]">
                        辨識解析預覽 (共 {parsedItems.length} 筆記錄)
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#EEF5EF] text-[#2C5E32] border border-[#CCD8C7]">
                        {analyzedRoster.filter(r => !r.isAlreadyInGroup).length} 筆即將新增
                      </span>
                      {analyzedRoster.some(r => r.isAlreadyInGroup) && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#EAE7DE] text-[#78786E]">
                          {analyzedRoster.filter(r => r.isAlreadyInGroup).length} 筆已在組內(將略過)
                        </span>
                      )}
                    </div>

                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#4A4A42] font-semibold">
                      <input
                        type="checkbox"
                        checked={autoRegisterNewStudents}
                        onChange={(e) => setAutoRegisterNewStudents(e.target.checked)}
                        className="rounded border-[#DDDCD4] text-[#485945] focus:ring-[#485945]"
                      />
                      <span>若名單含未註冊學生，自動建立全校基本資料檔</span>
                    </label>
                  </div>

                  {/* Preview Table */}
                  <div className="bg-white rounded-xl border border-[#E5E2DA] overflow-hidden shadow-2xs">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#FAF9F5] sticky top-0 border-b border-[#E5E2DA] text-[#606056] font-bold z-10">
                          <tr>
                            <th className="px-3 py-2 w-8">#</th>
                            <th className="px-3 py-2">班別</th>
                            <th className="px-3 py-2">學號</th>
                            <th className="px-3 py-2">學生姓名</th>
                            <th className="px-3 py-2">比對狀態</th>
                            <th className="px-3 py-2">放學方式</th>
                            <th className="px-3 py-2">S支援</th>
                            <th className="px-3 py-2 text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EAE7DE] text-[#4A4A42]">
                          {analyzedRoster.map((item, idx) => {
                            return (
                              <tr 
                                key={item.id} 
                                className={`transition-colors ${
                                  item.isAlreadyInGroup 
                                    ? 'bg-[#F9F9F8] opacity-60' 
                                    : 'hover:bg-[#FAF9F5]'
                                }`}
                              >
                                <td className="px-3 py-2 text-[#99998E] font-mono text-[11px]">{idx + 1}</td>
                                <td className="px-3 py-2 font-bold text-[#2C2C2A]">{item.raw.rawClass || item.matchedStudent?.class || '-'}</td>
                                <td className="px-3 py-2 font-mono">{item.raw.rawClassNo || item.matchedStudent?.classNo || '-'}</td>
                                <td className="px-3 py-2 font-semibold text-[#2C2C2A]">
                                  {item.raw.name || item.matchedStudent?.name || item.finalId}
                                </td>
                                <td className="px-3 py-2">
                                  {item.isAlreadyInGroup ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EAE7DE] text-[#78786E]">
                                      已在小組中
                                    </span>
                                  ) : item.matchedStudent ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EEF5EF] text-[#2C5E32] border border-[#CCD8C7] flex items-center gap-1 w-fit">
                                      <Check className="w-2.5 h-2.5" />
                                      <span>已匹配現有學生 [{item.matchedStudent.id}]</span>
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EBF2FA] text-[#1E5D8C] border border-[#BFDBFE] flex items-center gap-1 w-fit">
                                      <Sparkles className="w-2.5 h-2.5" />
                                      <span>新學生檔案 [{item.finalId}]</span>
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <select
                                    disabled={item.isAlreadyInGroup}
                                    value={item.dismissalMethod}
                                    onChange={(e) => handleUpdateParsedDismissal(idx, e.target.value as DismissalMethod)}
                                    className="px-2 py-1 rounded border border-[#DDDCD4] bg-[#FAF9F5] text-xs text-[#2C2C2A]"
                                  >
                                    {DISMISSAL_METHODS.map(m => (
                                      <option key={m} value={m}>{m}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  {item.raw.isSSupport || item.matchedStudent?.isSSupport ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FDF6ED] text-[#8C521E]">
                                      S支援
                                    </span>
                                  ) : '-'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteParsedItem(idx)}
                                    className="p-1 text-[#C55353] hover:bg-[#FDF0F0] rounded transition-colors"
                                    title="刪除此列"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Submit Action */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-[#78786E]">
                      將為 <strong className="text-[#2C2C2A]">{group.name}</strong> 新增{' '}
                      <strong className="text-[#485945]">
                        {analyzedRoster.filter(r => !r.isAlreadyInGroup).length}
                      </strong>{' '}
                      名學生
                    </span>
                    <button
                      type="button"
                      disabled={analyzedRoster.filter(r => !r.isAlreadyInGroup).length === 0}
                      onClick={handleImportSubmit}
                      className="px-4 py-2 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs sm:text-sm font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        確認導入並加入小組 ({analyzedRoster.filter(r => !r.isAlreadyInGroup).length} 人)
                      </span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
