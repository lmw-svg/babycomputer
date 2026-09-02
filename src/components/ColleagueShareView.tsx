import React, { useState, useMemo } from 'react';
import { Printer, Download, Eye, EyeOff, CloudUpload, ExternalLink, Lock } from 'lucide-react';
import { ActivityGroup, Student, Enrollment, AttendanceRecord, UserRole } from '../types';
import { exportSingleGroupRollCallToExcel, generateSingleGroupExcelBlob } from '../utils/excel';
import { parseSessionDates } from '../utils/dateUtils';
import { getAccessToken, googleSignIn } from '../services/googleAuth';
import { findOrCreateAppFolder, uploadBlobToDrive } from '../services/googleDrive';

interface ColleagueShareViewProps {
  activityGroups: ActivityGroup[];
  students: Student[];
  enrollments: Enrollment[];
  attendanceRecords: AttendanceRecord[];
  initialGroupId?: string;
  maskPhone: boolean;
  setMaskPhone: (mask: boolean) => void;
  role?: UserRole;
}

export const ColleagueShareView: React.FC<ColleagueShareViewProps> = ({
  activityGroups,
  students,
  enrollments,
  attendanceRecords,
  initialGroupId,
  maskPhone,
  setMaskPhone,
  role = 'guest',
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    initialGroupId || activityGroups[1]?.id || activityGroups[0]?.id || ''
  );

  const selectedGroup = useMemo(() => {
    return activityGroups.find(g => g.id === selectedGroupId) || activityGroups[0];
  }, [activityGroups, selectedGroupId]);

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

  const groupEnrollments = useMemo(() => {
    if (!selectedGroup) return [];
    return enrollments.filter(e => e.groupId === selectedGroup.id);
  }, [enrollments, selectedGroup]);

  // Show all session dates
  const displayDates = useMemo(() => {
    if (!selectedGroup) return ['第一堂', '第二堂', '第三堂', '第四堂', '第五堂'];
    if (selectedGroup.sessionDates && selectedGroup.sessionDates.length > 0) {
      return selectedGroup.sessionDates;
    }
    const parsed = parseSessionDates(selectedGroup.datesText || '');
    if (parsed.length > 0) {
      return parsed;
    }
    return ['第一堂', '第二堂', '第三堂', '第四堂', '第五堂'];
  }, [selectedGroup]);

  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveSuccessUrl, setDriveSuccessUrl] = useState<string | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const isGuest = role === 'guest';
  const effectiveMaskPhone = isGuest ? true : maskPhone;

  const handleExport = () => {
    if (!selectedGroup) return;
    exportSingleGroupRollCallToExcel(selectedGroup, students, enrollments, attendanceRecords, effectiveMaskPhone);
  };

  const handleSaveToDrive = async () => {
    if (!selectedGroup) return;
    setIsUploadingToDrive(true);
    setDriveSuccessUrl(null);
    try {
      let token = getAccessToken();
      if (!token) {
        const authRes = await googleSignIn();
        token = authRes.accessToken;
      }
      const folder = await findOrCreateAppFolder(token);
      const blob = generateSingleGroupExcelBlob(selectedGroup, students, enrollments, attendanceRecords, effectiveMaskPhone);
      const fileName = `${selectedGroup.id}_${selectedGroup.name}_分享名單_${new Date().toLocaleDateString('zh-HK').replace(/\//g, '-')}.xlsx`;
      const uploaded = await uploadBlobToDrive(token, fileName, blob, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', folder.id);
      
      setDriveSuccessUrl(uploaded.webViewLink || null);
      alert(`✅ 已成功儲存至 Google Drive：\n${uploaded.name}`);
    } catch (err: any) {
      console.error('Save to Drive error:', err);
      alert(`儲存至 Google Drive 失敗：${err.message || '請確認授權'}`);
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  // Pad table with empty rows up to at least 20 for standard sheet appearance
  const totalRowsCount = Math.max(groupEnrollments.length, 20);
  const rows = useMemo(() => {
    const list: (Enrollment | null)[] = [...groupEnrollments];
    while (list.length < totalRowsCount) {
      list.push(null);
    }
    return list;
  }, [groupEnrollments, totalRowsCount]);

  return (
    <div className="space-y-6">
      {/* Top Toolbar (hidden when printing) */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-[#4A4A42] whitespace-nowrap">
            選擇 Group ID：
          </label>
          <select
            id="share-group-select"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#CCD8C7] bg-[#FAF9F5] text-[#2C2C2A] font-bold text-xs focus:ring-2 focus:ring-[#485945]"
          >
            {activityGroups.map(g => (
              <option key={g.id} value={g.id}>
                {g.id} - {g.name} ({g.days.join('、')})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {isGuest ? (
            <div
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-[#FDF6ED] text-[#8C521E] border-[#EED7B8] flex items-center gap-1.5 cursor-not-allowed"
              title="訪客身份禁止查閱學生聯絡電話（請切換為教師或管理員）"
            >
              <Lock className="w-3.5 h-3.5 text-[#8C521E]" />
              <span>電話已隱藏 (訪客限制)</span>
            </div>
          ) : (
            <button
              onClick={() => setMaskPhone(!maskPhone)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                maskPhone
                  ? 'bg-[#FDF6ED] text-[#8C521E] border-[#EED7B8]'
                  : 'bg-[#FAF9F5] text-[#4A4A42] border-[#DDDCD4] hover:bg-[#EFEFEA]'
              }`}
            >
              {maskPhone ? <EyeOff className="w-3.5 h-3.5 text-[#8C521E]" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{maskPhone ? '電話已遮蔽 (符合私隱)' : '顯示完整電話'}</span>
            </button>
          )}

          <button
            id="share-export-excel-btn"
            onClick={handleExport}
            className="px-3 py-1.5 rounded-lg bg-[#FAF9F5] hover:bg-[#EFEFEA] text-[#2C2C2A] text-xs font-semibold border border-[#DDDCD4] flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>導出 Excel</span>
          </button>

          <button
            onClick={handleSaveToDrive}
            disabled={isUploadingToDrive}
            className="px-3 py-1.5 rounded-lg bg-[#EEF5EF] hover:bg-[#D0E4D3] text-[#2C5E32] text-xs font-bold border border-[#D0E4D3] flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <CloudUpload className={`w-3.5 h-3.5 ${isUploadingToDrive ? 'animate-bounce' : ''}`} />
            <span>{isUploadingToDrive ? '上傳中...' : '儲存至 Drive'}</span>
          </button>

          {driveSuccessUrl && (
            <a
              href={driveSuccessUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="在 Google 雲端硬碟中開啟"
              className="p-1.5 text-[#1A73E8] bg-[#E8F0FE] border border-[#D2E3FC] rounded-lg hover:bg-[#D2E3FC] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <button
            id="share-print-btn"
            onClick={handlePrint}
            className="px-4 py-1.5 rounded-lg bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>列印點名名單 (A4版面)</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet Container */}
      <div className="bg-white border border-[#DDDCD4] rounded-xl p-6 sm:p-8 shadow-sm print:border-none print:p-0 print:shadow-none text-[#2C2C2A]">
        {/* Title Banner */}
        <div className="bg-[#2C2C2A] text-white text-center py-2.5 px-4 font-bold text-base sm:text-lg tracking-wider rounded-t-lg mb-3 print:rounded-none">
          活動小組支援名單及點名表
        </div>

        <p className="text-[11px] text-[#78786E] mb-4 italic print:text-[10px]">
          本頁為發放給同事的簡潔介面。只需在 Group ID 選擇欄位選擇小組；活動小組資料及學生名單會自動帶出。正式分享前請按需要隱藏或移除敏感欄位。
        </p>

        {selectedGroup && (
          <div className="border border-[#DDDCD4] text-xs mb-4">
            {/* Header row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-4 border-b border-[#DDDCD4]">
              <div className="p-2.5 bg-[#FAF9F5] border-r border-[#DDDCD4] font-bold flex items-center gap-2">
                <span className="text-[#485945] font-mono text-sm">{selectedGroup.id}</span>
                <span className="text-[#2C2C2A] text-sm font-bold">{selectedGroup.name}</span>
              </div>
              <div className="p-2.5 border-r border-[#DDDCD4] font-semibold md:col-span-2 flex items-center">
                <span>時間：{selectedGroup.days.join('、')} {selectedGroup.startTime} - {selectedGroup.endTime}</span>
              </div>
              <div className="p-2.5 font-semibold flex items-center">
                <span>地點：{selectedGroup.venue}</span>
              </div>
            </div>

            {/* Header row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-[#DDDCD4]">
              <div className="p-2.5 border-r border-[#DDDCD4]">
                <span className="font-bold text-[#78786E]">活動日期及堂數：</span>
                <span className="text-[#2C2C2A] ml-1 font-mono font-medium">
                  {selectedGroup.datesText || (selectedGroup.sessionDates && selectedGroup.sessionDates.length > 0 ? selectedGroup.sessionDates.join('、') : '按學校行事曆')}
                </span>
              </div>
              <div className="p-2.5">
                <span className="font-bold text-[#78786E]">負責老師：</span>
                <span className="text-[#2C2C2A] ml-1">{selectedGroup.teacher}</span>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border border-[#DDDCD4] border-collapse">
            <thead>
              <tr className="bg-[#F5F5F0] text-[#2C2C2A] font-bold border-b border-[#DDDCD4] text-center">
                <th className="border border-[#DDDCD4] px-2 py-2 w-10">編號</th>
                <th className="border border-[#DDDCD4] px-2 py-2 w-12">班別</th>
                <th className="border border-[#DDDCD4] px-2 py-2 w-12">學號</th>
                <th className="border border-[#DDDCD4] px-3 py-2 text-left min-w-24">學生姓名</th>
                <th className="border border-[#DDDCD4] px-2 py-2 w-10">性別</th>
                <th className="border border-[#DDDCD4] px-2 py-2 w-20">放學方式</th>
                <th className="border border-[#DDDCD4] px-2 py-2 w-24">聯絡電話</th>
                <th className="border border-[#DDDCD4] px-2 py-2 w-16">學生編別</th>
                {displayDates.map((date, idx) => (
                  <th key={idx} className="border border-[#DDDCD4] px-2 py-2 w-14 bg-[#EEF5EF]">
                    <span className="block text-[10px] text-[#78786E] font-normal">第{idx + 1}堂</span>
                    <span className="font-bold font-mono text-[#2C5E32]">{date}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((en, idx) => {
                if (!en) {
                  return (
                    <tr key={`empty-${idx}`} className="text-center h-7 text-[#DDDCD4] border-b border-[#DDDCD4]">
                      <td className="border border-[#DDDCD4] font-mono">{idx + 1}</td>
                      <td className="border border-[#DDDCD4]"></td>
                      <td className="border border-[#DDDCD4]"></td>
                      <td className="border border-[#DDDCD4]"></td>
                      <td className="border border-[#DDDCD4]"></td>
                      <td className="border border-[#DDDCD4]"></td>
                      <td className="border border-[#DDDCD4]"></td>
                      <td className="border border-[#DDDCD4]"></td>
                      {displayDates.map((_, dIdx) => (
                        <td key={dIdx} className="border border-[#DDDCD4]"></td>
                      ))}
                    </tr>
                  );
                }

                const s = studentMap.get(en.studentId);
                return (
                  <tr key={en.id} className="text-center hover:bg-[#FAF9F5]">
                    <td className="border border-[#DDDCD4] px-2 py-1.5 font-mono font-bold text-[#78786E]">
                      {idx + 1}
                    </td>
                    <td className="border border-[#DDDCD4] px-2 py-1.5 font-bold text-[#2C2C2A]">
                      {s?.class || '-'}
                    </td>
                    <td className="border border-[#DDDCD4] px-2 py-1.5 font-mono text-[#78786E]">
                      {s?.classNo || '-'}
                    </td>
                    <td className="border border-[#DDDCD4] px-3 py-1.5 text-left font-bold text-[#2C2C2A]">
                      {s?.name || en.studentId}
                    </td>
                    <td className="border border-[#DDDCD4] px-2 py-1.5 font-medium text-[#78786E]">
                      {s?.gender || '-'}
                    </td>
                    <td className="border border-[#DDDCD4] px-2 py-1.5 font-medium text-[#4A4A42]">
                      {en.dismissalMethod || '自行放學'}
                    </td>
                    <td className="border border-[#DDDCD4] px-2 py-1.5 font-mono text-[10px] text-[#4A4A42]">
                      {isGuest ? (
                        <span className="text-[#99998E] italic flex items-center justify-center gap-0.5 text-[9px]">
                          <Lock className="w-2.5 h-2.5 text-[#99998E]" />
                          <span>訪客保密</span>
                        </span>
                      ) : s?.phone ? (
                        maskPhone ? (
                          <span>{s.phone.slice(0, 2)}****{s.phone.slice(-2)}</span>
                        ) : (
                          <span>{s.phone}</span>
                        )
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="border border-[#DDDCD4] px-2 py-1.5 font-mono text-[#78786E]">
                      {en.studentId}
                    </td>

                    {/* Attendance mark cells */}
                    {displayDates.map((date) => {
                      const rec = attendanceRecords.find(
                        r => r.groupId === selectedGroup?.id && r.studentId === en.studentId && r.date === date
                      );
                      const status = rec ? rec.status : 'NA';

                      let badgeClass = 'text-[#B8B8AC]';
                      if (status === 'P') badgeClass = 'font-bold text-[#2C5E32] bg-[#EEF5EF] rounded px-1.5 py-0.5';
                      else if (status === 'A') badgeClass = 'font-bold text-[#8C3A3A] bg-[#FDF0F0] rounded px-1.5 py-0.5';
                      else if (status === 'L') badgeClass = 'font-bold text-[#8C521E] bg-[#FDF6ED] rounded px-1.5 py-0.5';

                      return (
                        <td key={date} className="border border-[#DDDCD4] px-2 py-1.5">
                          <span className={badgeClass}>{status === 'NA' ? '' : status}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info & codes */}
        <div className="mt-4 pt-3 border-t border-[#DDDCD4] flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-[#78786E] gap-2">
          <div>
            <strong>出席代碼：</strong> P＝出席； A＝缺席； L＝請假； NA＝不適用／未有記錄。出席率不把 NA 計入分母。
          </div>
          <div className="text-[#99998E] font-mono text-[10px]">
            製表日期：{new Date().toLocaleDateString('zh-HK')}
          </div>
        </div>
      </div>
    </div>
  );
};

