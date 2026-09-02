import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Calendar, 
  MapPin, 
  User, 
  Clock, 
  Check, 
  Users, 
  Tag, 
  Sparkles,
  Bookmark,
  FileText,
  AlertCircle,
  Wand2
} from 'lucide-react';
import { ActivityGroup, ActivityCategory, WeekDay, Enrollment } from '../types';
import { SCHOOL_VENUES } from '../data/initialData';
import { parseSessionDates, normalizeSingleDateInput, formatSessionDatesText } from '../utils/dateUtils';

interface EditActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupToEdit?: ActivityGroup | null;
  enrollments?: Enrollment[];
  onSave: (group: ActivityGroup) => void;
}

const ALL_DAYS: WeekDay[] = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const CATEGORIES: ActivityCategory[] = ['隊伍/校隊', '興趣小組', '支援小組', '託管班', '留堂/補習', '其他'];

const COMMON_TIME_PRESETS = [
  { label: '課後單節 (15:30-16:30)', start: '15:30', end: '16:30' },
  { label: '課後雙節 (15:30-17:00)', start: '15:30', end: '17:00' },
  { label: '託管長時段 (15:30-18:00)', start: '15:30', end: '18:00' },
  { label: '週六上午 (09:00-11:00)', start: '09:00', end: '11:00' },
  { label: '週六中午 (11:00-13:00)', start: '11:00', end: '13:00' },
];

const COMMON_CAPACITY_PRESETS = [
  { label: '15人 (加強/小班)', value: 15 },
  { label: '25人 (標準小組)', value: 25 },
  { label: '35人 (大組班級)', value: 35 },
  { label: '50人 (校隊/大班)', value: 50 },
];

const COMMON_QUICK_VENUES = [
  'N702',
  '2A課室(301)',
  '七樓盧碧珊堂',
  'N601(音樂室)',
  'N404(視藝室)',
  'N501(電腦室)',
  '圖書館',
  '德育廣場',
  '葵涌運動場'
];

const COMMON_QUICK_TEACHERS = [
  '羅天慧老師',
  '陳秀烽主任',
  '李志銘老師',
  '黃德華老師',
  '張翠玲老師',
  '劉家豪老師',
  '外聘教練'
];

export const EditActivityModal: React.FC<EditActivityModalProps> = ({
  isOpen,
  onClose,
  groupToEdit,
  enrollments = [],
  onSave,
}) => {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ActivityCategory>('興趣小組');
  const [days, setDays] = useState<WeekDay[]>(['星期一']);
  const [startTime, setStartTime] = useState('15:30');
  const [endTime, setEndTime] = useState('17:00');
  const [venue, setVenue] = useState('N702');
  const [customVenue, setCustomVenue] = useState('');
  const [teacher, setTeacher] = useState('');
  const [isSSupportGroup, setIsSSupportGroup] = useState(false);
  const [supportTarget, setSupportTarget] = useState('');
  const [datesText, setDatesText] = useState('21/9、28/9、5/10、12/10、19/10、26/10');
  const [newDateInput, setNewDateInput] = useState('');
  const [remarks, setRemarks] = useState('');
  const [maxCapacity, setMaxCapacity] = useState<number>(35);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Current enrolled count
  const currentEnrolledCount = useMemo(() => {
    if (!groupToEdit) return 0;
    return enrollments.filter(e => e.groupId === groupToEdit.id).length;
  }, [groupToEdit, enrollments]);

  // Parse session dates preview with dedicated parser
  const parsedDates = useMemo(() => {
    if (!datesText.trim()) return [];
    const parsed = parseSessionDates(datesText);
    if (parsed.length > 0) return parsed;
    return datesText
      .split(/[、,，;；\n\r\t&與及至和~～\s]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }, [datesText]);

  useEffect(() => {
    if (groupToEdit) {
      setId(groupToEdit.id);
      setName(groupToEdit.name);
      setCategory(groupToEdit.category || '興趣小組');
      setDays(groupToEdit.days && groupToEdit.days.length > 0 ? groupToEdit.days : ['星期一']);
      setStartTime(groupToEdit.startTime || '15:30');
      setEndTime(groupToEdit.endTime || '17:00');
      if (SCHOOL_VENUES.includes(groupToEdit.venue)) {
        setVenue(groupToEdit.venue);
        setCustomVenue('');
      } else {
        setVenue('自訂地點');
        setCustomVenue(groupToEdit.venue || '');
      }
      setTeacher(groupToEdit.teacher || '');
      setIsSSupportGroup(groupToEdit.isSSupportGroup || false);
      setSupportTarget(groupToEdit.supportTarget || '');
      const validDates = groupToEdit.sessionDates && groupToEdit.sessionDates.length > 0
        ? groupToEdit.sessionDates.join('、')
        : '';
      setDatesText(groupToEdit.datesText || validDates || '9/10、16/10、23/10、30/10');
      setRemarks(groupToEdit.remarks || '');
      setMaxCapacity(groupToEdit.maxCapacity || 35);
      setErrorMessage(null);
    } else {
      setId(`G${Math.floor(100 + Math.random() * 900)}`);
      setName('');
      setCategory('興趣小組');
      setDays(['星期一']);
      setStartTime('15:30');
      setEndTime('17:00');
      setVenue('2A課室(301)');
      setCustomVenue('');
      setTeacher('');
      setIsSSupportGroup(false);
      setSupportTarget('');
      setDatesText('9/10、16/10、23/10、30/10');
      setRemarks('');
      setMaxCapacity(35);
      setErrorMessage(null);
    }
  }, [groupToEdit, isOpen]);

  if (!isOpen) return null;

  const toggleDay = (day: WeekDay) => {
    if (days.includes(day)) {
      if (days.length > 1) {
        setDays(days.filter(d => d !== day));
      }
    } else {
      setDays([...days, day]);
    }
  };

  const handleAddSingleDate = () => {
    if (!newDateInput.trim()) return;
    const cleanDate = normalizeSingleDateInput(newDateInput.trim());
    if (!cleanDate) return;
    if (parsedDates.includes(cleanDate)) {
      setErrorMessage(`日期「${cleanDate}」已在清單中`);
      return;
    }
    const updated = datesText.trim() ? `${datesText.trim()}、${cleanDate}` : cleanDate;
    setDatesText(updated);
    setNewDateInput('');
    setErrorMessage(null);
  };

  const handleRemoveDate = (dateToRemove: string) => {
    const remaining = parsedDates.filter(d => d !== dateToRemove);
    setDatesText(formatSessionDatesText(remaining));
  };

  const handleAutoGenerateDates = () => {
    // Generate 4 consecutive weeks based on today or standard schedule (D/M format)
    const now = new Date();
    const currentDay = now.getDate();
    const generated: string[] = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date(now);
      d.setDate(currentDay + i * 7);
      generated.push(`${d.getDate()}/${d.getMonth() + 1}`);
    }
    setDatesText(formatSessionDatesText(generated));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim()) {
      setErrorMessage('請填寫小組編號 (Group ID)');
      return;
    }
    if (!name.trim()) {
      setErrorMessage('請填寫活動小組名稱');
      return;
    }
    if (days.length === 0) {
      setErrorMessage('請至少選擇一個上課星期');
      return;
    }

    let sessionDates = parsedDates;
    if (sessionDates.length === 0 && datesText.trim()) {
      sessionDates = datesText
        .split(/[、,，;；\n\r\t&與及至和~～\s]+/)
        .map(s => s.trim())
        .filter(Boolean);
    }
    if (sessionDates.length === 0) {
      sessionDates = ['9/10', '16/10', '23/10', '30/10'];
    }
    const finalVenue = venue === '自訂地點' ? customVenue.trim() || '未定地點' : venue;
    const finalTeacher = teacher.trim() || '負責職員未指定';

    const group: ActivityGroup = {
      id: id.trim().toUpperCase(),
      name: name.trim(),
      category,
      days,
      startTime: startTime || '15:30',
      endTime: endTime || '17:00',
      venue: finalVenue,
      teacher: finalTeacher,
      isSSupportGroup,
      supportTarget: supportTarget.trim(),
      datesText: datesText.trim() || formatSessionDatesText(sessionDates),
      sessionDates,
      remarks: remarks.trim(),
      maxCapacity: Number(maxCapacity) || 35,
    };

    onSave(group);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-[#E5E2DA] overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-[#FAF9F5] border-b border-[#E5E2DA] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EEF5EF] text-[#2C5E32] border border-[#D0E4D3] flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#2C2C2A]">
                  {groupToEdit ? `修改活動小組設定` : '新增活動小組'}
                </h3>
                {groupToEdit && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-[#EFEFEA] text-[#2C2C2A] font-bold border border-[#DDDCD4]">
                    {groupToEdit.id}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#78786E] mt-0.5">
                完整修改活動名稱、日期堂數、上課時間、地點、人數上限及負責老師
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#78786E] hover:text-[#2C2C2A] hover:bg-[#EFEFEA] rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-[#FDF0F0] border border-[#F5CCCC] text-[#8C3A3A] text-xs flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: 基本資料 (活動名稱、ID、類別) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-[#EAE7DE]">
              <Tag className="w-4 h-4 text-[#485945]" />
              <h4 className="text-xs font-bold text-[#2C2C2A] uppercase tracking-wider">
                1. 活動名稱與小組編號
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              {/* Group ID */}
              <div className="sm:col-span-4">
                <label className="block text-xs font-bold text-[#4A4A42] mb-1">
                  小組編號 (Group ID) <span className="text-[#8C3A3A]">*</span>
                </label>
                <input
                  type="text"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="例如 S001, M002a, P001"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] text-sm font-mono font-bold text-[#2C2C2A] focus:bg-white focus:ring-2 focus:ring-[#485945] focus:border-[#485945]"
                />
              </div>

              {/* Activity Name */}
              <div className="sm:col-span-8">
                <label className="block text-xs font-bold text-[#4A4A42] mb-1">
                  活動小組名稱 <span className="text-[#8C3A3A]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如 獅藝校隊、光輝樂隊校隊、中文讀寫樂小組、課後託管班"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] text-sm font-semibold text-[#2C2C2A] focus:bg-white focus:ring-2 focus:ring-[#485945] focus:border-[#485945]"
                />
              </div>
            </div>

            {/* Category Select */}
            <div>
              <label className="block text-xs font-bold text-[#4A4A42] mb-1.5">
                活動小組類別
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => {
                  const isSelected = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-[#485945] text-white border-[#485945] shadow-xs'
                          : 'bg-[#FAF9F5] text-[#606056] border-[#DDDCD4] hover:bg-[#EFEFEA]'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: 日期設定 (上課星期 & 個別堂數日期) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-[#EAE7DE]">
              <Calendar className="w-4 h-4 text-[#485945]" />
              <h4 className="text-xs font-bold text-[#2C2C2A] uppercase tracking-wider">
                2. 上課日期與個別堂數 (星期一至星期六)
              </h4>
            </div>

            {/* Weekday multi-select */}
            <div>
              <label className="block text-xs font-bold text-[#4A4A42] mb-1.5">
                上課星期 (可多選，系統將在全週場地與時段表自動同步) <span className="text-[#8C3A3A]">*</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {ALL_DAYS.map((day) => {
                  const isSelected = days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border text-center transition-all flex items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-[#485945] text-white border-[#485945] shadow-xs ring-2 ring-[#485945]/20'
                          : 'bg-[#FAF9F5] text-[#606056] border-[#DDDCD4] hover:bg-[#EFEFEA]'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      <span>{day}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Session Dates parsing and quick tags */}
            <div className="bg-[#FAF9F5] rounded-xl p-3.5 border border-[#EAE7DE] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#4A4A42]">
                    個別活動堂數日期清單 (文字格式)
                  </label>
                  <p className="text-[11px] text-[#78786E]">
                    系統點名頁將按這些日期建立各堂出席記錄，使用頓號「、」或逗號「,」分隔
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAutoGenerateDates}
                  className="text-xs text-[#485945] hover:underline font-semibold flex items-center gap-1 self-start sm:self-auto"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>自動生成 4 週日期</span>
                </button>
              </div>

              <textarea
                value={datesText}
                onChange={(e) => setDatesText(e.target.value)}
                rows={2}
                placeholder="例如 16/3、23/3、30/3、6/4 或 29/9, 6/10, 13/10..."
                className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] bg-white text-xs text-[#2C2C2A] focus:ring-2 focus:ring-[#485945] focus:border-[#485945] leading-relaxed"
              />

              {/* Parsed Session Dates Chips */}
              <div>
                <span className="text-[11px] font-bold text-[#606056] block mb-1.5">
                  已解析堂數預覽 (共 {parsedDates.length} 堂課)：
                </span>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {parsedDates.map((dateStr, idx) => (
                    <span
                      key={`${dateStr}-${idx}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#DDDCD4] text-xs font-mono font-medium text-[#2C2C2A] shadow-2xs"
                    >
                      <span className="text-[10px] text-[#78786E]">第{idx + 1}堂:</span>
                      <strong>{dateStr}</strong>
                      <button
                        type="button"
                        onClick={() => handleRemoveDate(dateStr)}
                        className="text-[#99998E] hover:text-[#8C3A3A] ml-0.5 p-0.5 rounded-xs"
                        title="移除此堂日期"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                  {/* Add date input helper */}
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      value={newDateInput}
                      onChange={(e) => setNewDateInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSingleDate();
                        }
                      }}
                      placeholder="手動新增日期 如 13/4"
                      className="px-2.5 py-1 text-xs rounded-lg border border-[#DDDCD4] bg-white w-32 focus:ring-1 focus:ring-[#485945]"
                    />
                    <button
                      type="button"
                      onClick={handleAddSingleDate}
                      className="px-2 py-1 bg-[#485945] text-white rounded-lg text-xs font-semibold hover:bg-[#3D4C3A]"
                    >
                      + 加堂
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: 時間設定 (開始、結束、快捷時段) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-[#EAE7DE]">
              <Clock className="w-4 h-4 text-[#485945]" />
              <h4 className="text-xs font-bold text-[#2C2C2A] uppercase tracking-wider">
                3. 上課時間與時段
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#4A4A42] mb-1">開始時間</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] text-sm font-mono font-bold text-[#2C2C2A] focus:bg-white focus:ring-2 focus:ring-[#485945]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4A4A42] mb-1">結束時間</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] text-sm font-mono font-bold text-[#2C2C2A] focus:bg-white focus:ring-2 focus:ring-[#485945]"
                />
              </div>
            </div>

            {/* Quick time presets */}
            <div>
              <span className="text-[11px] font-bold text-[#78786E] block mb-1.5">
                常用上課時段快捷填入：
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_TIME_PRESETS.map(preset => {
                  const isActive = startTime === preset.start && endTime === preset.end;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setStartTime(preset.start);
                        setEndTime(preset.end);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        isActive
                          ? 'bg-[#EEF5EF] text-[#2C5E32] border-[#D0E4D3] font-bold'
                          : 'bg-[#FAF9F5] text-[#606056] border-[#DDDCD4] hover:bg-[#EFEFEA]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 4: 地點設定 (標準場地清單 + 自訂地點) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-[#EAE7DE]">
              <MapPin className="w-4 h-4 text-[#485945]" />
              <h4 className="text-xs font-bold text-[#2C2C2A] uppercase tracking-wider">
                4. 活動地點與場地
              </h4>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4A4A42] mb-1">
                選擇校內場地 (與場地總表聯動)
              </label>
              <select
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] text-sm font-semibold text-[#2C2C2A] focus:bg-white focus:ring-2 focus:ring-[#485945]"
              >
                <optgroup label="常用活動室與特別室">
                  <option value="N702">N702 (特別活動室)</option>
                  <option value="N701">N701</option>
                  <option value="七樓盧碧珊堂">七樓盧碧珊堂 (禮堂)</option>
                  <option value="七樓創科世界">七樓創科世界</option>
                  <option value="七樓乒乓球區">七樓乒乓球區</option>
                  <option value="N601(音樂室)">N601 (音樂室)</option>
                  <option value="N404(視藝室)">N404 (視藝室)</option>
                  <option value="N501(電腦室)">N501 (電腦室)</option>
                  <option value="圖書館">圖書館</option>
                  <option value="樂藝坊(1區)">樂藝坊 (1區)</option>
                  <option value="樂藝坊(2區)">樂藝坊 (2區)</option>
                  <option value="德育廣場">德育廣場 (地下)</option>
                </optgroup>
                <optgroup label="一般標準課室">
                  <option value="2A課室(301)">2A課室 (301)</option>
                  <option value="3A課室(302)">3A課室 (302)</option>
                  <option value="3B課室(305)">3B課室 (305)</option>
                  <option value="4A課室(303)">4A課室 (303)</option>
                  <option value="4A課室(306)">4A課室 (306)</option>
                  <option value="4C課室(406)">4C課室 (406)</option>
                  <option value="5A課室(403)">5A課室 (403)</option>
                  <option value="5B課室(402)">5B課室 (402)</option>
                  <option value="5C課室(401)">5C課室 (401)</option>
                  <option value="5D課室(506)">5D課室 (506)</option>
                  <option value="6A課室(503)">6A課室 (503)</option>
                  <option value="6B課室(502)">6B課室 (502)</option>
                  <option value="6C課室(501)">6C課室 (501)</option>
                  <option value="6D課室(504)">6D課室 (504)</option>
                </optgroup>
                <optgroup label="校外及其他場地">
                  <option value="葵涌運動場">葵涌運動場</option>
                  <option value="游泳池">游泳池</option>
                  <option value="自訂地點">-- 自訂其他場地 / 室外地點 --</option>
                </optgroup>
              </select>

              {venue === '自訂地點' && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={customVenue}
                    onChange={(e) => setCustomVenue(e.target.value)}
                    placeholder="請輸入自訂地點名稱（例如：家長資源中心、校外足球場）"
                    className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] bg-white text-xs font-semibold text-[#2C2C2A] focus:ring-2 focus:ring-[#485945]"
                    autoFocus
                  />
                </div>
              )}

              {/* Quick Venue Buttons */}
              <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] text-[#78786E]">常用：</span>
                {COMMON_QUICK_VENUES.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setVenue(v);
                      setCustomVenue('');
                    }}
                    className="px-2 py-0.5 rounded-md bg-[#FAF9F5] hover:bg-[#EFEFEA] text-[11px] text-[#606056] border border-[#DDDCD4] transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 5: 人數上限 & 負責老師 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-[#EAE7DE]">
              <Users className="w-4 h-4 text-[#485945]" />
              <h4 className="text-xs font-bold text-[#2C2C2A] uppercase tracking-wider">
                5. 人數名額與負責職員
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Capacity */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#4A4A42]">人數名額上限</label>
                  {groupToEdit && (
                    <span className="text-[11px] text-[#485945] font-semibold">
                      現已報讀 {currentEnrolledCount} 人
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(parseInt(e.target.value) || 35)}
                  min={1}
                  max={120}
                  className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] text-sm font-bold text-[#2C2C2A] focus:bg-white focus:ring-2 focus:ring-[#485945]"
                />
                {/* Capacity Presets */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {COMMON_CAPACITY_PRESETS.map(cap => (
                    <button
                      key={cap.value}
                      type="button"
                      onClick={() => setMaxCapacity(cap.value)}
                      className={`px-2 py-0.5 rounded-md text-[11px] border transition-colors ${
                        maxCapacity === cap.value
                          ? 'bg-[#EEF5EF] text-[#2C5E32] border-[#D0E4D3] font-bold'
                          : 'bg-[#FAF9F5] text-[#78786E] border-[#DDDCD4] hover:bg-[#EFEFEA]'
                      }`}
                    >
                      {cap.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Responsible Teacher / Staff */}
              <div>
                <label className="block text-xs font-bold text-[#4A4A42] mb-1">
                  負責職員 / 老師 <span className="text-[#8C3A3A]">*</span>
                </label>
                <input
                  type="text"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  placeholder="例如 羅天慧老師、陳秀烽主任、李志銘老師"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] text-sm font-semibold text-[#2C2C2A] focus:bg-white focus:ring-2 focus:ring-[#485945]"
                />
                {/* Quick teacher tags */}
                <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] text-[#78786E]">快捷：</span>
                  {COMMON_QUICK_TEACHERS.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        if (!teacher) {
                          setTeacher(t);
                        } else if (!teacher.includes(t)) {
                          setTeacher(`${teacher}、${t}`);
                        }
                      }}
                      className="px-1.5 py-0.5 rounded-md bg-[#FAF9F5] hover:bg-[#EFEFEA] text-[10px] text-[#606056] border border-[#DDDCD4]"
                    >
                      +{t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: S支援小組設定與備註 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-[#EAE7DE]">
              <Bookmark className="w-4 h-4 text-[#8C521E]" />
              <h4 className="text-xs font-bold text-[#2C2C2A] uppercase tracking-wider">
                6. 支援屬性與其他備註
              </h4>
            </div>

            {/* S-Support Checkbox */}
            <div className="p-4 rounded-xl bg-[#FDF6ED] border border-[#EED7B8] space-y-3">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="isSSupportGroupModal"
                  checked={isSSupportGroup}
                  onChange={(e) => setIsSSupportGroup(e.target.checked)}
                  className="w-4 h-4 text-[#8C521E] rounded-md border-[#DDDCD4] focus:ring-[#8C521E]"
                />
                <label htmlFor="isSSupportGroupModal" className="text-xs font-bold text-[#8C521E] cursor-pointer">
                  設為「S支援活動小組」 (學生總表將以此小組核對 S 支援對象是否已妥善編排)
                </label>
              </div>

              {isSSupportGroup && (
                <div>
                  <label className="block text-xs font-semibold text-[#8C521E] mb-1">
                    支援目標 / 適用對象
                  </label>
                  <input
                    type="text"
                    value={supportTarget}
                    onChange={(e) => setSupportTarget(e.target.value)}
                    placeholder="例如 讀寫能力輔導、注意力強化、專注力練習、情緒管理"
                    className="w-full px-3 py-2 rounded-xl border border-[#EED7B8] bg-white text-xs text-[#2C2C2A] focus:ring-2 focus:ring-[#8C521E]"
                  />
                </div>
              )}
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs font-bold text-[#4A4A42] mb-1">補充備註事項 (選填)</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="例如 需自備運動鞋、材料費已由學校資助、每逢雨天改至禮堂"
                className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] text-xs text-[#2C2C2A] focus:bg-white focus:ring-2 focus:ring-[#485945]"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-[#EAE7DE] flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-[#78786E]">
              {groupToEdit ? '變更將即時同步至全校場地、時段與出席統計總表' : '新增後即可在活動總表進行學生編排與點名'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#DDDCD4] text-xs font-semibold text-[#606056] hover:bg-[#EFEFEA] transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{groupToEdit ? '儲存小組設定變更' : '建立活動小組'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
