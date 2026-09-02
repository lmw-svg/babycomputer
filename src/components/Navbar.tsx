import React from 'react';
import { 
  Users, 
  Calendar, 
  ClipboardCheck, 
  BarChart3, 
  Layers, 
  MapPin, 
  Printer, 
  Download, 
  Shield, 
  Eye, 
  EyeOff, 
  RotateCcw,
  School,
  Lock,
  LogOut,
  Cloud
} from 'lucide-react';
import { UserRole } from '../types';
import { getRoleInfo } from '../utils/auth';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  role: UserRole;
  onRequestRoleChange: (targetRole: UserRole) => void;
  maskPhone: boolean;
  setMaskPhone: (mask: boolean) => void;
  onOpenImportExport: () => void;
  onResetData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  role,
  onRequestRoleChange,
  maskPhone,
  setMaskPhone,
  onOpenImportExport,
  onResetData,
}) => {
  const tabs = [
    { id: 'dashboard', label: '總覽概況', icon: Layers },
    { id: 'activity-groups', label: '活動小組設定', icon: Calendar },
    { id: 'students', label: '學生總表與名單', icon: Users },
    { id: 'schedule', label: '場地與時程表', icon: MapPin },
    { id: 'roll-call', label: '活動點名', icon: ClipboardCheck },
    { id: 'statistics', label: '出席統計分析', icon: BarChart3 },
    { id: 'share', label: '同事分享/列印版', icon: Printer },
    { id: 'google-drive', label: 'Google 雲端備份', icon: Cloud },
  ];

  const currentRoleInfo = getRoleInfo(role);

  return (
    <header className="sticky top-0 z-40 bg-[#FAF9F5]/95 backdrop-blur border-b border-[#E5E2DA] shadow-[0_1px_3px_rgba(44,44,40,0.04)] no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#485945] flex items-center justify-center text-[#F5F5F0] shadow-xs">
              <School className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#2C2C2A] text-lg tracking-tight">學校課外活動與支援統計系統</span>
                <span className="text-[11px] font-semibold bg-[#ECEFE9] text-[#364733] border border-[#CCD8C7] px-2 py-0.5 rounded-full">
                  2026-2027年度
                </span>
              </div>
              <p className="text-xs text-[#78786E] hidden sm:block">活動小組設定 ‧ 學生名單 ‧ 場地安排 ‧ 即時點名 ‧ 出席分析</p>
            </div>
          </div>

          {/* Controls: Role switcher, Privacy Mask, Import/Export */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Privacy Phone Masking Toggle */}
            {role === 'guest' ? (
              <div
                id="privacy-toggle-btn"
                title="訪客身份禁止查閱學生聯絡電話（若需查看請切換為教師或管理員）"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-[#FDF6ED] text-[#8C521E] border-[#EED7B8] cursor-not-allowed select-none"
              >
                <Lock className="w-3.5 h-3.5 text-[#8C521E]" />
                <span className="hidden md:inline">電話已隱藏 (訪客保密)</span>
                <span className="md:hidden">已保密</span>
              </div>
            ) : (
              <button
                id="privacy-toggle-btn"
                onClick={() => setMaskPhone(!maskPhone)}
                title={maskPhone ? '已啟用電話隱私遮蔽 (點擊取消)' : '點擊隱藏學生電話號碼'}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  maskPhone 
                    ? 'bg-[#FDF6ED] text-[#8C521E] border-[#EED7B8] hover:bg-[#FAEEDB]' 
                    : 'bg-[#EFEFEA] text-[#4A4A42] border-[#DDDCD4] hover:bg-[#E5E5DD]'
                }`}
              >
                {maskPhone ? <EyeOff className="w-3.5 h-3.5 text-[#8C521E]" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">{maskPhone ? '電話已遮蔽' : '遮蔽電話'}</span>
              </button>
            )}

            {/* Role Switcher with Password Protection indicator */}
            <div className="flex items-center bg-[#EFEFEA] p-1 rounded-xl border border-[#DDDCD4]">
              <span className="text-xs text-[#78786E] px-1.5 hidden xl:inline flex items-center gap-1">
                <Shield className="w-3 h-3 text-[#99998E]" /> 身份：
              </span>

              {/* Guest button (No password needed) */}
              <button
                id="role-guest-btn"
                onClick={() => onRequestRoleChange('guest')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  role === 'guest'
                    ? 'bg-white text-[#2C2C2A] shadow-xs border border-[#DDDCD4]'
                    : 'text-[#68685E] hover:text-[#2C2C2A]'
                }`}
                title="訪客身份 (唯讀查閱，無需密碼)"
              >
                訪客
              </button>

              {/* Teacher button (Requires password) */}
              <button
                id="role-teacher-btn"
                onClick={() => onRequestRoleChange('teacher')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                  role === 'teacher'
                    ? 'bg-[#485945] text-white shadow-xs'
                    : 'text-[#68685E] hover:text-[#2C2C2A]'
                }`}
                title="教師身份 (需密碼：可進行小組點名)"
              >
                {role !== 'teacher' && <Lock className="w-2.5 h-2.5 opacity-60" />}
                <span>教師</span>
              </button>

              {/* Head Teacher button (Requires password) */}
              <button
                id="role-head-teacher-btn"
                onClick={() => onRequestRoleChange('head-teacher')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                  role === 'head-teacher'
                    ? 'bg-[#8C521E] text-white shadow-xs'
                    : 'text-[#68685E] hover:text-[#2C2C2A]'
                }`}
                title="科主任身份 (需密碼：管理所有小組與點名)"
              >
                {role !== 'head-teacher' && <Lock className="w-2.5 h-2.5 opacity-60" />}
                <span>科主任</span>
              </button>

              {/* Admin button (Requires password) */}
              <button
                id="role-admin-btn"
                onClick={() => onRequestRoleChange('admin')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                  role === 'admin'
                    ? 'bg-[#8C3A3A] text-white shadow-xs'
                    : 'text-[#68685E] hover:text-[#2C2C2A]'
                }`}
                title="管理員身份 (需密碼：全校最高管理權限)"
              >
                {role !== 'admin' && <Lock className="w-2.5 h-2.5 opacity-60" />}
                <span>管理員</span>
              </button>
            </div>

            {/* Quick Logout to Guest button if logged in as a privileged role */}
            {role !== 'guest' && (
              <button
                id="logout-to-guest-btn"
                onClick={() => onRequestRoleChange('guest')}
                title={`登出當前「${currentRoleInfo.title}」身份並切換為「訪客」`}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1.5 text-xs text-[#78786E] hover:text-[#8C3A3A] hover:bg-[#FDF0F0] rounded-lg transition-colors border border-transparent hover:border-[#F2D1D1]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-[11px]">登出</span>
              </button>
            )}

            {/* Import / Export Data Button */}
            <button
              id="import-export-btn"
              onClick={onOpenImportExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#ECEFE9] text-[#364733] border border-[#CCD8C7] hover:bg-[#E0E7DC] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">導入 / 導出</span>
            </button>

            {/* Reset Data Button (Admin only) */}
            {role === 'admin' && (
              <button
                id="reset-data-btn"
                onClick={onResetData}
                title="重設為學校初始示例資料"
                className="p-1.5 text-[#88887E] hover:text-[#8C3A3A] hover:bg-[#FDF0F0] rounded-lg border border-transparent hover:border-[#F2D1D1] transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-1.5 border-t border-[#EAE7DE] scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setCurrentTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#485945] text-white shadow-xs'
                    : 'text-[#606056] hover:text-[#2C2C2A] hover:bg-[#EAE8DE]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#78786E]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

