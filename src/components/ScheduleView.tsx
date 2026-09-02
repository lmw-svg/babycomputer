import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Clock, 
  Calendar, 
  Search, 
  Printer, 
  ClipboardCheck, 
  Building2, 
  User,
  Edit
} from 'lucide-react';
import { ActivityGroup, WeekDay, UserRole } from '../types';
import { SCHOOL_VENUES } from '../data/initialData';

interface ScheduleViewProps {
  activityGroups: ActivityGroup[];
  role: UserRole;
  onStartRollCall: (groupId: string) => void;
  onViewShare: (groupId: string) => void;
  onEditGroup?: (group: ActivityGroup) => void;
}

const WEEKDAYS: WeekDay[] = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const TIME_SLOTS = [
  '09:00–10:30',
  '14:30–15:30',
  '15:30–16:30',
  '15:30–16:45',
  '15:30–17:00',
  '15:30–18:30',
];

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  activityGroups,
  role,
  onStartRollCall,
  onViewShare,
  onEditGroup,
}) => {
  const [activeTab, setActiveTab] = useState<'venue' | 'timeslot' | 'daily'>('venue');
  const [selectedDay, setSelectedDay] = useState<WeekDay>('星期二');
  const [venueSearch, setVenueSearch] = useState('');

  // Dynamically collect all venues including any custom ones created
  const allVenues = useMemo(() => {
    const list = [...SCHOOL_VENUES];
    activityGroups.forEach(g => {
      if (g.venue && !list.includes(g.venue)) {
        list.push(g.venue);
      }
    });
    if (!venueSearch) return list;
    return list.filter(v => v.toLowerCase().includes(venueSearch.toLowerCase()));
  }, [activityGroups, venueSearch]);

  // Daily activities
  const dailyActivities = useMemo(() => {
    return activityGroups.filter(g => g.days.includes(selectedDay));
  }, [activityGroups, selectedDay]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#2C2C2A]">場地與時程活動總表</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ECEFE9] text-[#364733] border border-[#CCD8C7]">
              全校星期一至六聯網排課
            </span>
          </div>
          <p className="text-xs text-[#78786E] mt-1">
            依照場地及星期自動生成活動安排，即時檢視場地佔用與每日活動小組時段
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-[#EFEFEA] p-1 rounded-xl border border-[#DDDCD4]">
          <button
            id="tab-venue-matrix-btn"
            onClick={() => setActiveTab('venue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'venue'
                ? 'bg-white text-[#485945] shadow-xs'
                : 'text-[#78786E] hover:text-[#2C2C2A]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>場地表 (按場地)</span>
          </button>
          <button
            id="tab-timeslot-matrix-btn"
            onClick={() => setActiveTab('timeslot')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'timeslot'
                ? 'bg-white text-[#485945] shadow-xs'
                : 'text-[#78786E] hover:text-[#2C2C2A]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>時段活動表</span>
          </button>
          <button
            id="tab-daily-view-btn"
            onClick={() => setActiveTab('daily')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'daily'
                ? 'bg-white text-[#485945] shadow-xs'
                : 'text-[#78786E] hover:text-[#2C2C2A]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>每日活動清單</span>
          </button>
        </div>
      </div>

      {/* --- 1. 場地表 (Venue Schedule Matrix) --- */}
      {activeTab === 'venue' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] flex items-center justify-between gap-4 shadow-xs">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#99998E]" />
              <input
                type="text"
                value={venueSearch}
                onChange={(e) => setVenueSearch(e.target.value)}
                placeholder="搜尋場地名稱 (如 N702、盧碧珊堂、401...)"
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#DDDCD4] text-xs bg-[#FAF9F5] text-[#2C2C2A] focus:ring-2 focus:ring-[#485945] focus:bg-white"
              />
            </div>
            <span className="text-xs text-[#78786E] hidden sm:inline">
              空白欄位表示該場地於該星期未有排定活動
            </span>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E2DA] shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#3D4C3A] text-white sticky top-0 z-20">
                  <tr>
                    <th className="px-4 py-3 font-bold border-r border-[#4E5E4B] w-44 min-w-36 bg-[#3D4C3A]">
                      場地
                    </th>
                    {WEEKDAYS.map((day) => (
                      <th key={day} className="px-3 py-3 font-bold text-center border-r border-[#4E5E4B] min-w-44">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE7DE]">
                  {allVenues.map((v) => {
                    return (
                      <tr key={v} className="hover:bg-[#FAF9F5] transition-colors">
                        <td className="px-4 py-2.5 font-bold text-[#2C2C2A] bg-[#FAF9F5] border-r border-[#E5E2DA] sticky left-0 z-10">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-[#485945] shrink-0" />
                            <span>{v}</span>
                          </div>
                        </td>

                        {WEEKDAYS.map((day) => {
                          const matched = activityGroups.filter(
                            g => g.venue === v && g.days.includes(day)
                          );

                          return (
                            <td key={day} className="px-2 py-2 border-r border-[#E5E2DA] align-top">
                              {matched.length > 0 ? (
                                <div className="space-y-1.5">
                                  {matched.map((g) => (
                                    <div
                                      key={g.id}
                                      className={`p-2 rounded-lg border text-[11px] transition-all hover:shadow-xs ${
                                        g.isSSupportGroup
                                          ? 'bg-[#FDF6ED] border-[#EED7B8] text-[#8C521E]'
                                          : g.category === '託管班'
                                          ? 'bg-[#EEF5EF] border-[#D0E4D3] text-[#2C5E32]'
                                          : 'bg-[#ECEFE9] border-[#CCD8C7] text-[#364733]'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <span className="font-bold truncate">{g.name}</span>
                                        <span className="font-mono text-[10px] opacity-75">({g.id})</span>
                                      </div>
                                      <div className="text-[10px] opacity-85 flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" />
                                        <span>{g.startTime}–{g.endTime}</span>
                                      </div>
                                      <div className="text-[10px] opacity-80 truncate mt-0.5">
                                        老師：{g.teacher}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[#B8B8AC] block text-center py-2">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- 2. 星期各時段活動表 (Time-slot Schedule Matrix) --- */}
      {activeTab === 'timeslot' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#E5E2DA] shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-[#FAF9F5] border-b border-[#E5E2DA] text-xs text-[#78786E] flex items-center justify-between">
              <span className="font-bold text-[#2C2C2A]">星期各時段活動總表（依時段分佈）</span>
              <span className="text-[11px] text-[#78786E]">用於快速排查各時段課程負荷與學生重疊</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#3D4C3A] text-white">
                  <tr>
                    <th className="px-4 py-3 font-bold border-r border-[#4E5E4B] w-36 bg-[#3D4C3A]">
                      時段
                    </th>
                    {WEEKDAYS.map((day) => (
                      <th key={day} className="px-3 py-3 font-bold text-center border-r border-[#4E5E4B] min-w-44">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE7DE]">
                  {TIME_SLOTS.map((slot) => {
                    const [slotStart] = slot.split('–');
                    return (
                      <tr key={slot} className="hover:bg-[#FAF9F5] transition-colors">
                        <td className="px-4 py-3 font-bold font-mono text-[#2C2C2A] bg-[#FAF9F5] border-r border-[#E5E2DA] align-top">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#485945] shrink-0" />
                            <span>{slot}</span>
                          </div>
                        </td>

                        {WEEKDAYS.map((day) => {
                          const matched = activityGroups.filter(g => {
                            if (!g.days.includes(day)) return false;
                            const gSlot = `${g.startTime}–${g.endTime}`;
                            if (gSlot === slot) return true;
                            return g.startTime === slotStart;
                          });

                          return (
                            <td key={day} className="px-2 py-2 border-r border-[#E5E2DA] align-top">
                              {matched.length > 0 ? (
                                <div className="space-y-1.5">
                                  {matched.map((g) => (
                                    <div
                                      key={g.id}
                                      className={`p-2.5 rounded-lg border text-[11px] shadow-xs ${
                                        g.isSSupportGroup
                                          ? 'bg-[#FDF6ED] border-[#EED7B8] text-[#8C521E]'
                                          : 'bg-white border-[#E5E2DA] text-[#2C2C2A]'
                                      }`}
                                    >
                                      <div className="font-bold text-xs text-[#2C2C2A] mb-0.5">{g.name}</div>
                                      <div className="text-[10px] text-[#78786E] flex items-center gap-1">
                                        <MapPin className="w-3 h-3 text-[#99998E]" />
                                        <span>{g.venue}</span>
                                      </div>
                                      <div className="text-[10px] text-[#78786E] flex items-center gap-1 mt-0.5">
                                        <User className="w-3 h-3 text-[#99998E]" />
                                        <span className="truncate">{g.teacher}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[#B8B8AC] block text-center py-2">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- 3. 星期一至星期六 每日分頁 (Daily View) --- */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          {/* Day selection pills */}
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const count = activityGroups.filter(g => g.days.includes(d)).length;
              const isSelected = selectedDay === d;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-[#485945] text-white border-[#485945] shadow-xs'
                      : 'bg-white text-[#4A4A42] border-[#DDDCD4] hover:bg-[#FAF9F5]'
                  }`}
                >
                  <span>{d}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#EFEFEA] text-[#78786E]'
                  }`}>
                    {count} 組
                  </span>
                </button>
              );
            })}
          </div>

          {/* List of activities for the selected day */}
          <div className="bg-white rounded-xl border border-[#E5E2DA] overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-[#FAF9F5] border-b border-[#E5E2DA] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#2C2C2A]">
                {selectedDay} 課外活動小組名單與安排 (共 {dailyActivities.length} 組)
              </h3>
            </div>

            {dailyActivities.length === 0 ? (
              <div className="text-center py-12 text-[#99998E] text-xs">
                {selectedDay} 暫無任何安排的活動
              </div>
            ) : (
              <div className="divide-y divide-[#EAE7DE]">
                {dailyActivities.map((group) => (
                  <div
                    key={group.id}
                    className="p-4 hover:bg-[#FAF9F5] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[#EFEFEA] text-[#2C2C2A] rounded-md border border-[#DDDCD4]">
                          {group.id}
                        </span>
                        <h4 className="text-sm font-bold text-[#2C2C2A]">{group.name}</h4>
                        {group.isSSupportGroup && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8]">
                            S支援
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EFEFEA] text-[#4A4A42]">
                          {group.category}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#78786E] pt-1">
                        <span className="flex items-center gap-1 font-mono text-[#4A4A42]">
                          <Clock className="w-3.5 h-3.5 text-[#99998E]" />
                          {group.startTime} - {group.endTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#99998E]" />
                          {group.venue}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-[#99998E]" />
                          {group.teacher}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {role !== 'guest' && onEditGroup && (
                        <button
                          onClick={() => onEditGroup(group)}
                          title="修改活動小組設定 (名稱、日期、時間、地點、人數、負責老師)"
                          className="px-2.5 py-1.5 rounded-lg bg-[#EEF5EF] hover:bg-[#D0E4D3] text-[#2C5E32] text-xs font-semibold transition-colors flex items-center gap-1 border border-[#D0E4D3]"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>修改設定</span>
                        </button>
                      )}
                      <button
                        onClick={() => onStartRollCall(group.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>點名</span>
                      </button>
                      <button
                        onClick={() => onViewShare(group.id)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-[#DDDCD4] hover:bg-[#FAF9F5] text-[#2C2C2A] text-xs font-medium transition-colors flex items-center gap-1"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>分享/列印</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

