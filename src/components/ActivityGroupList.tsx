import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Clock, 
  MapPin, 
  User, 
  Calendar, 
  Edit, 
  Trash2, 
  ClipboardCheck, 
  Users, 
  Grid, 
  List, 
  Printer, 
  Bookmark,
  UserPlus,
  X,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Download,
  FileText
} from 'lucide-react';
import { ActivityGroup, Enrollment, Student, UserRole, ActivityCategory, WeekDay, DismissalMethod } from '../types';
import { BatchEnrollModal } from './BatchEnrollModal';
import { downloadGroupEnrollmentSampleExcel, downloadGroupEnrollmentSampleCsv, exportSingleGroupRollCallToExcel } from '../utils/excel';

interface ActivityGroupListProps {
  activityGroups: ActivityGroup[];
  enrollments: Enrollment[];
  students: Student[];
  role: UserRole;
  maskPhone?: boolean;
  onAddGroup: () => void;
  onEditGroup: (group: ActivityGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onOpenRollCall?: (groupId: string) => void;
  onStartRollCall?: (groupId: string) => void;
  onOpenShareView?: (groupId: string) => void;
  onViewShare?: (groupId: string) => void;
  onEnrollStudent?: (groupId: string) => void;
  onBatchEnrollStudents?: (
    groupId: string,
    enrollmentsToAdd: { studentId: string; dismissalMethod: DismissalMethod; remarks?: string }[],
    newStudentsToCreate?: Student[]
  ) => void;
  onRemoveEnrollment?: (enrollmentId: string) => void;
  onUpdateDismissal?: (enrollmentId: string, method: DismissalMethod) => void;
}

const ALL_DAYS: WeekDay[] = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const CATEGORIES: ('全部' | ActivityCategory)[] = ['全部', '隊伍/校隊', '興趣小組', '支援小組', '託管班', '留堂/補習', '其他'];

export const ActivityGroupList: React.FC<ActivityGroupListProps> = ({
  activityGroups,
  enrollments,
  students,
  role,
  maskPhone = false,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
  onOpenRollCall,
  onStartRollCall,
  onOpenShareView,
  onViewShare,
  onEnrollStudent,
  onBatchEnrollStudents,
  onRemoveEnrollment,
  onUpdateDismissal,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'全部' | ActivityCategory>('全部');
  const [selectedDay, setSelectedDay] = useState<string>('全部');
  const [selectedSupportOnly, setSelectedSupportOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedRosterGroupId, setSelectedRosterGroupId] = useState<string | null>(null);
  const [batchEnrollTargetGroup, setBatchEnrollTargetGroup] = useState<ActivityGroup | null>(null);

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

  const handleRollCall = onOpenRollCall || onStartRollCall || (() => {});
  const handleShare = onOpenShareView || onViewShare || (() => {});

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    return activityGroups.filter(g => {
      const matchesSearch = 
        !search ||
        g.id.toLowerCase().includes(search.toLowerCase()) ||
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.venue.toLowerCase().includes(search.toLowerCase()) ||
        g.teacher.toLowerCase().includes(search.toLowerCase());

      const matchesCat = selectedCategory === '全部' || g.category === selectedCategory;
      const matchesDay = selectedDay === '全部' || g.days.includes(selectedDay as WeekDay);
      const matchesSupport = !selectedSupportOnly || g.isSSupportGroup;

      return matchesSearch && matchesCat && matchesDay && matchesSupport;
    });
  }, [activityGroups, search, selectedCategory, selectedDay, selectedSupportOnly]);

  const activeRosterGroup = useMemo(() => {
    if (!selectedRosterGroupId) return null;
    return activityGroups.find(g => g.id === selectedRosterGroupId) || null;
  }, [activityGroups, selectedRosterGroupId]);

  const activeRosterEnrollments = useMemo(() => {
    if (!selectedRosterGroupId) return [];
    return enrollments.filter(e => e.groupId === selectedRosterGroupId);
  }, [enrollments, selectedRosterGroupId]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#2C2C2A]">活動小組設定</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ECEFE9] text-[#364733] border border-[#CCD8C7]">
              共 {filteredGroups.length} 組
            </span>
          </div>
          <p className="text-xs text-[#78786E] mt-1">
            設定各班級活動名稱、星期、上課時段、場地、負責老師及支援目標
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-[#EFEFEA] p-1 rounded-xl border border-[#DDDCD4]">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'grid' ? 'bg-white text-[#2C2C2A] shadow-xs' : 'text-[#78786E] hover:text-[#2C2C2A]'
              }`}
              title="網格卡片視圖"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'table' ? 'bg-white text-[#2C2C2A] shadow-xs' : 'text-[#78786E] hover:text-[#2C2C2A]'
              }`}
              title="表格視圖"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Add Group (Admin only) */}
          {role === 'admin' && (
            <button
              id="add-activity-group-btn"
              onClick={onAddGroup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>建立活動小組</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-[#E5E2DA] p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#99998E]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋 Group ID、活動名稱、地點、負責老師..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#DDDCD4] text-xs bg-[#FAF9F5] text-[#2C2C2A] focus:ring-2 focus:ring-[#485945] focus:bg-white"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs font-medium bg-[#FAF9F5] text-[#2C2C2A] focus:ring-2 focus:ring-[#485945]"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat === '全部' ? '全部類別' : cat}</option>
              ))}
            </select>

            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs font-medium bg-[#FAF9F5] text-[#2C2C2A] focus:ring-2 focus:ring-[#485945]"
            >
              <option value="全部">全部星期 (一至六)</option>
              {ALL_DAYS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <button
              onClick={() => setSelectedSupportOnly(!selectedSupportOnly)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors flex items-center gap-1.5 ${
                selectedSupportOnly
                  ? 'bg-[#FDF6ED] text-[#8C521E] border-[#EED7B8]'
                  : 'bg-[#FAF9F5] text-[#606056] border-[#DDDCD4] hover:bg-[#EFEFEA]'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>僅看 S支援小組</span>
            </button>
          </div>
        </div>
      </div>

      {/* Group Content: Grid or Table */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-[#E5E2DA] p-8">
          <Calendar className="w-10 h-10 text-[#B8B8AC] mx-auto mb-3" />
          <h4 className="text-sm font-bold text-[#4A4A42]">找不到符合條件的活動小組</h4>
          <p className="text-xs text-[#78786E] mt-1">請嘗試清除搜尋條件或新增活動小組</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => {
            const groupEnrolls = enrollments.filter(e => e.groupId === group.id);
            return (
              <div
                key={group.id}
                className="bg-white rounded-xl border border-[#E5E2DA] p-5 shadow-xs hover:border-[#485945] transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[#EFEFEA] text-[#2C2C2A] rounded-md border border-[#DDDCD4]">
                        {group.id}
                      </span>
                      {group.isSSupportGroup && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]">
                          S支援
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#ECEFE9] text-[#364733] border border-[#CCD8C7]">
                        {group.category}
                      </span>
                    </div>

                    {/* Edit/Delete Actions */}
                    {role !== 'guest' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEditGroup(group)}
                          title="修改活動小組設定 (名稱、日期、時間、地點、人數、負責老師)"
                          className="px-2 py-1 bg-[#EEF5EF] hover:bg-[#D0E4D3] text-[#2C5E32] rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-[#D0E4D3]"
                        >
                          <Edit className="w-3 h-3" />
                          <span>修改設定</span>
                        </button>
                        {role === 'admin' && (
                          <button
                            onClick={() => onDeleteGroup(group.id)}
                            title="刪除小組"
                            className="p-1 text-[#78786E] hover:text-[#8C3A3A] hover:bg-[#FDF0F0] rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-[#2C2C2A] mb-2">{group.name}</h3>

                  {/* Support Target */}
                  {group.supportTarget && (
                    <p className="text-xs text-[#8C521E] bg-[#FDF6ED] px-2.5 py-1 rounded-lg border border-[#EED7B8] mb-3">
                      🎯 目標：{group.supportTarget}
                    </p>
                  )}

                  {/* Details (Date, Time, Venue, Teacher, Capacity) */}
                  <div className="space-y-2 text-xs text-[#606056] mb-4 bg-[#FAF9F5] p-3 rounded-xl border border-[#EAE7DE]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-medium text-[#485945]">
                        <Calendar className="w-3.5 h-3.5 text-[#485945] shrink-0" />
                        <span>上課：{group.days.join('、')}</span>
                      </div>
                      <span className="font-mono font-semibold text-[#2C2C2A] bg-white px-2 py-0.5 rounded border border-[#DDDCD4] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#78786E]" />
                        <span>{group.startTime} - {group.endTime}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#EAE7DE]/60">
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-[#78786E] shrink-0" />
                        <span className="font-medium text-[#2C2C2A] truncate">{group.venue}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Users className="w-3.5 h-3.5 text-[#78786E] shrink-0" />
                        <span className={`font-bold ${groupEnrolls.length >= (group.maxCapacity || 35) ? 'text-[#8C3A3A]' : 'text-[#2C5E32]'}`}>
                          {groupEnrolls.length} / {group.maxCapacity || 35} 人
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 border-t border-[#EAE7DE]/60">
                      <User className="w-3.5 h-3.5 text-[#78786E] shrink-0" />
                      <span className="truncate">負責老師：<strong className="text-[#2C2C2A]">{group.teacher}</strong></span>
                    </div>
                  </div>

                  {/* Dates preview */}
                  <div className="p-2.5 rounded-lg bg-white border border-[#EAE7DE] text-[11px] text-[#78786E] mb-4 shadow-2xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[#4A4A42] flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#485945]" />
                        <span>活動日期及堂數：</span>
                      </span>
                      <span className="text-[10px] font-bold text-[#485945] bg-[#EEF5EF] px-1.5 py-0.5 rounded border border-[#CCD8C7]">
                        共 {group.sessionDates?.length || 0} 堂
                      </span>
                    </div>
                    <p className="line-clamp-2 leading-relaxed font-mono font-medium text-[#2C2C2A]">
                      {group.datesText || (group.sessionDates && group.sessionDates.length > 0 ? group.sessionDates.join('、') : '按學校行事曆')}
                    </p>
                  </div>
                </div>

                {/* Bottom Bar: Students count & Actions */}
                <div className="pt-3 border-t border-[#EAE7DE] flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedRosterGroupId(group.id)}
                    className="text-xs font-semibold text-[#485945] hover:underline flex items-center gap-1"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>學生名單 ({groupEnrolls.length} 人)</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {onBatchEnrollStudents && role !== 'guest' && (
                      <button
                        onClick={() => setBatchEnrollTargetGroup(group)}
                        className="px-2 py-1.5 rounded-lg bg-[#EEF5EF] hover:bg-[#E0EFE2] text-[#2C5E32] border border-[#CCD8C7] text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                        title="批量新增或導入學生名單 (含樣本)"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">批量/導入</span>
                      </button>
                    )}
                    {onEnrollStudent && role !== 'guest' && (
                      <button
                        onClick={() => onEnrollStudent(group.id)}
                        className="p-1.5 rounded-lg bg-[#FAF9F5] border border-[#DDDCD4] hover:bg-[#EFEFEA] text-[#333330] transition-colors"
                        title="登記報讀學生"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleRollCall(group.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span>點名</span>
                    </button>
                    <button
                      onClick={() => handleShare(group.id)}
                      className="p-1.5 rounded-lg border border-[#DDDCD4] hover:bg-[#EFEFEA] text-[#606056] transition-colors"
                      title="同事分享/列印版"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl border border-[#E5E2DA] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F5] border-b border-[#E5E2DA] text-[#606056] font-bold">
                <tr>
                  <th className="px-4 py-3">Group ID</th>
                  <th className="px-4 py-3">活動小組名稱</th>
                  <th className="px-4 py-3">類別</th>
                  <th className="px-4 py-3">星期</th>
                  <th className="px-4 py-3">時間</th>
                  <th className="px-4 py-3">地點</th>
                  <th className="px-4 py-3 min-w-44">上課日期及堂數</th>
                  <th className="px-4 py-3">負責職員</th>
                  <th className="px-4 py-3">S支援</th>
                  <th className="px-4 py-3">人數</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE7DE] text-[#4A4A42]">
                {filteredGroups.map((group) => {
                  const enrollCount = enrollments.filter(e => e.groupId === group.id).length;
                  const datesDisplay = group.datesText || (group.sessionDates && group.sessionDates.length > 0 ? group.sessionDates.join('、') : '-');
                  return (
                    <tr key={group.id} className="hover:bg-[#FAF9F5] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#2C2C2A]">{group.id}</td>
                      <td className="px-4 py-3 font-semibold text-[#2C2C2A]">{group.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EFEFEA] text-[#4A4A42]">
                          {group.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-[#485945]">{group.days.join('、')}</td>
                      <td className="px-4 py-3 font-mono">{group.startTime}-{group.endTime}</td>
                      <td className="px-4 py-3">{group.venue}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <span className="font-mono text-[11px] text-[#333330] line-clamp-2" title={datesDisplay}>
                          {datesDisplay}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate">{group.teacher}</td>
                      <td className="px-4 py-3">
                        {group.isSSupportGroup ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FDF6ED] text-[#8C521E]">
                            ✓ S支援
                          </span>
                        ) : (
                          <span className="text-[#B8B8AC]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#2C2C2A]">{enrollCount}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {onBatchEnrollStudents && role !== 'guest' && (
                            <button
                              onClick={() => setBatchEnrollTargetGroup(group)}
                              className="px-2 py-1 rounded-lg bg-[#EEF5EF] hover:bg-[#E0EFE2] text-[#2C5E32] text-[11px] font-semibold border border-[#CCD8C7] transition-colors flex items-center gap-1"
                              title="批量新增或導入名單 (含樣本)"
                            >
                              <FileSpreadsheet className="w-3 h-3" />
                              <span>批量/導入</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedRosterGroupId(group.id)}
                            className="px-2 py-1 rounded-lg border border-[#DDDCD4] hover:bg-[#EFEFEA] text-[#485945] text-[11px] font-medium transition-colors"
                          >
                            名單
                          </button>
                          <button
                            onClick={() => handleRollCall(group.id)}
                            className="px-2 py-1 rounded-lg bg-[#485945] hover:bg-[#3D4C3A] text-white text-[11px] font-semibold transition-colors"
                          >
                            點名
                          </button>
                          <button
                            onClick={() => handleShare(group.id)}
                            className="px-2 py-1 rounded-lg border border-[#DDDCD4] hover:bg-[#EFEFEA] text-[#4A4A42] text-[11px] font-medium transition-colors"
                          >
                            分享版
                          </button>
                          {role !== 'guest' && (
                            <button
                              onClick={() => onEditGroup(group)}
                              title="修改活動小組設定"
                              className="px-2 py-1 bg-[#EEF5EF] hover:bg-[#D0E4D3] text-[#2C5E32] rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors border border-[#D0E4D3]"
                            >
                              <Edit className="w-3 h-3" />
                              <span>修改</span>
                            </button>
                          )}
                          {role === 'admin' && (
                            <button
                              onClick={() => onDeleteGroup(group.id)}
                              title="刪除小組"
                              className="p-1 text-[#78786E] hover:text-[#8C3A3A] hover:bg-[#FDF0F0] rounded-md transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Group Roster Slide-over / Modal */}
      {activeRosterGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C2C2A]/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-[#E5E2DA] overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 bg-[#FAF9F5] border-b border-[#E5E2DA] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs px-2 py-0.5 bg-[#EFEFEA] text-[#2C2C2A] rounded-md">
                    {activeRosterGroup.id}
                  </span>
                  <h3 className="text-base font-bold text-[#2C2C2A]">{activeRosterGroup.name} 學生名單</h3>
                  {activeRosterGroup.isSSupportGroup && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#FDF6ED] text-[#8C521E]">
                      S支援小組
                    </span>
                  )}
                  {role !== 'guest' && (
                    <button
                      onClick={() => {
                        const target = activeRosterGroup;
                        setSelectedRosterGroupId(null);
                        onEditGroup(target);
                      }}
                      className="ml-2 px-2 py-0.5 rounded-md bg-[#EEF5EF] text-[#2C5E32] text-xs font-semibold hover:bg-[#D0E4D3] border border-[#D0E4D3] flex items-center gap-1 transition-colors"
                    >
                      <Edit className="w-3 h-3" />
                      <span>修改此組設定</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#78786E] mt-0.5">
                  上課：{activeRosterGroup.days.join('、')} {activeRosterGroup.startTime}-{activeRosterGroup.endTime} ‧ 地點：{activeRosterGroup.venue} ‧ 教師：{activeRosterGroup.teacher}
                </p>
              </div>
              <button
                onClick={() => setSelectedRosterGroupId(null)}
                className="p-1.5 text-[#78786E] hover:text-[#2C2C2A] hover:bg-[#EFEFEA] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Action Banner for Batch and Single Add */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E5E2DA]">
                <div>
                  <span className="text-xs font-bold text-[#4A4A42] block">
                    已登記學生 ({activeRosterEnrollments.length} 人 / 上限 {activeRosterGroup.maxCapacity || 35} 人)
                  </span>
                  <span className="text-[11px] text-[#78786E]">
                    支援名冊多選挑選或以 Excel/CSV 檔案批量導入
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => downloadGroupEnrollmentSampleExcel(activeRosterGroup)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-[#CCD8C7] hover:bg-[#EEF5EF] text-[#2C5E32] text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                    title="下載標準 Excel 匯入樣本"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>下載樣本 (.xlsx)</span>
                  </button>

                  {onBatchEnrollStudents && role !== 'guest' && (
                    <button
                      onClick={() => {
                        const target = activeRosterGroup;
                        setSelectedRosterGroupId(null);
                        setBatchEnrollTargetGroup(target);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#2C5E32] hover:bg-[#234B28] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>批量新增 / 導入名單</span>
                    </button>
                  )}

                  {onEnrollStudent && role !== 'guest' && (
                    <button
                      onClick={() => {
                        setSelectedRosterGroupId(null);
                        onEnrollStudent(activeRosterGroup.id);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>單一新增</span>
                    </button>
                  )}
                </div>
              </div>

              {activeRosterEnrollments.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-[#DDDCD4] rounded-xl bg-white space-y-3">
                  <Users className="w-10 h-10 text-[#B8B8AC] mx-auto" />
                  <div>
                    <p className="text-sm font-bold text-[#4A4A42]">此小組目前尚未登記任何學生</p>
                    <p className="text-xs text-[#78786E] mt-0.5">您可以點擊上方「批量新增 / 導入名單」快速從全校名冊挑選或上傳 Excel 檔案</p>
                  </div>
                  {onBatchEnrollStudents && role !== 'guest' && (
                    <button
                      onClick={() => {
                        const target = activeRosterGroup;
                        setSelectedRosterGroupId(null);
                        setBatchEnrollTargetGroup(target);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>立即批量挑選 / 導入學生名單</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="border border-[#E5E2DA] rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F5] border-b border-[#E5E2DA] text-[#606056] font-bold">
                      <tr>
                        <th className="px-3 py-2 w-8">#</th>
                        <th className="px-3 py-2">班別</th>
                        <th className="px-3 py-2">學號</th>
                        <th className="px-3 py-2">學生姓名</th>
                        <th className="px-3 py-2">性別</th>
                        <th className="px-3 py-2">S支援</th>
                        <th className="px-3 py-2">放學方式</th>
                        {role !== 'guest' && <th className="px-3 py-2 text-right">操作</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAE7DE] text-[#4A4A42]">
                      {activeRosterEnrollments.map((en, idx) => {
                        const s = studentMap.get(en.studentId);
                        const sName = s?.name || en.studentId;
                        return (
                          <tr key={en.id} className="hover:bg-[#FAF9F5]">
                            <td className="px-3 py-2 text-[#99998E] font-mono text-[11px]">{idx + 1}</td>
                            <td className="px-3 py-2 font-bold text-[#2C2C2A]">{s?.class || '-'}</td>
                            <td className="px-3 py-2 font-mono">{s?.classNo || '-'}</td>
                            <td className="px-3 py-2 font-semibold text-[#2C2C2A]">{sName}</td>
                            <td className="px-3 py-2">{s?.gender || '-'}</td>
                            <td className="px-3 py-2">
                              {s?.isSSupport ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FDF6ED] text-[#8C521E]">
                                  S支援
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="px-3 py-2">{en.dismissalMethod || '自行放學'}</td>
                            {role !== 'guest' && (
                              <td className="px-3 py-2 text-right">
                                {onRemoveEnrollment && (
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`確定要將學生「${sName} (${s?.class || ''}${s?.classNo || ''})」從「${activeRosterGroup.name}」名單中移出嗎？`)) {
                                        onRemoveEnrollment(en.id);
                                      }
                                    }}
                                    className="px-2 py-0.5 text-[#8C3A3A] hover:bg-[#FDF0F0] border border-[#F5C2C2] hover:border-[#8C3A3A] rounded transition-colors text-xs font-semibold"
                                    title="移出此活動小組"
                                  >
                                    移出
                                  </button>
                                )}
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

            <div className="px-6 py-3 bg-[#FAF9F5] border-t border-[#E5E2DA] flex items-center justify-between">
              <span className="text-xs text-[#78786E]">
                共 {activeRosterEnrollments.length} 名學生
              </span>
              <button
                onClick={() => setSelectedRosterGroupId(null)}
                className="px-4 py-1.5 rounded-xl bg-[#2C2C2A] hover:bg-[#44443E] text-white text-xs font-semibold transition-colors"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Enroll & Import Modal */}
      {batchEnrollTargetGroup && (
        <BatchEnrollModal
          isOpen={!!batchEnrollTargetGroup}
          onClose={() => setBatchEnrollTargetGroup(null)}
          group={batchEnrollTargetGroup}
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

