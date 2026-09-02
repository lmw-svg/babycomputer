import React, { useMemo } from 'react';
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
  Sparkles,
  ArrowUpRight,
  Bookmark,
  UserCheck,
  Plus,
  Cloud
} from 'lucide-react';
import { AppDataState, NavigationTab, UserRole, WeekDay } from '../types';

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

  // Determine current day of week in Chinese
  const todayWeekDay: WeekDay = useMemo(() => {
    const dayIndex = new Date().getDay(); // 0 = Sunday, 1 = Monday...
    const map: Record<number, WeekDay> = {
      1: '星期一',
      2: '星期二',
      3: '星期三',
      4: '星期四',
      5: '星期五',
      6: '星期六',
      0: '星期一',
    };
    return map[dayIndex] || '星期二';
  }, []);

  // Today's activities
  const todayActivities = useMemo(() => {
    return activityGroups.filter(g => g.days.includes(todayWeekDay));
  }, [activityGroups, todayWeekDay]);

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
            <span>當前權限：{role === 'admin' ? '管理員 (全權編輯與資料管理)' : role === 'head-teacher' ? '科主任 (管理小組與點名)' : role === 'teacher' ? '教師 (點名記錄與學生查閱)' : '訪客 (唯讀查閱)'}</span>
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
            {role === 'admin' && onAddActivity && (
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
        {/* Left Column: Today's Activity Groups */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E2DA] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#2C2C2A]">今日活動安排</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ECEFE9] text-[#364733] border border-[#CCD8C7]">
                  {todayWeekDay}
                </span>
              </div>
              <p className="text-xs text-[#78786E] mt-0.5">共 {todayActivities.length} 個活動小組於今日開展</p>
            </div>
            <button
              id="dash-view-full-schedule"
              onClick={() => onNavigateTab('schedule')}
              className="text-xs font-semibold text-[#485945] hover:text-[#2C382A] flex items-center gap-1"
            >
              <span>完整時程場地表</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {todayActivities.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-[#DDDCD4] rounded-xl bg-[#FAF9F5]">
              <Calendar className="w-8 h-8 text-[#99998E] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#4A4A42]">今日暫無排定的課外活動</p>
              <p className="text-xs text-[#78786E] mt-1">可切換至「場地與時程表」檢視其他星期的活動安排</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayActivities.map((group) => {
                const groupEnrolls = enrollments.filter(e => e.groupId === group.id);
                return (
                  <div
                    key={group.id}
                    className="p-4 rounded-xl border border-[#EAE7DE] bg-[#FAF9F5] hover:bg-white hover:border-[#CCD8C7] hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
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
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#78786E]">
                        <span className="flex items-center gap-1">
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
                        className="px-3 py-1.5 rounded-lg bg-[#485945] hover:bg-[#3B4A3D] text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
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

