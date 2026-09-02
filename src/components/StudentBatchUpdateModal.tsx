import React, { useState } from 'react';
import { X, CheckSquare, Layers, UserCheck, AlertCircle, HeartHandshake, School, Plus, Minus } from 'lucide-react';
import { Student, ActivityGroup } from '../types';

interface StudentBatchUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStudentIds: string[];
  students: Student[];
  activityGroups: ActivityGroup[];
  onApplyBatchUpdate: (
    studentIds: string[],
    updates: Partial<Student>,
    options?: { addGroupId?: string; removeGroupId?: string }
  ) => void;
}

export const StudentBatchUpdateModal: React.FC<StudentBatchUpdateModalProps> = ({
  isOpen,
  onClose,
  selectedStudentIds,
  students,
  activityGroups,
  onApplyBatchUpdate,
}) => {
  const [updateClass, setUpdateClass] = useState(false);
  const [targetClass, setTargetClass] = useState('');

  const [updateGrade, setUpdateGrade] = useState(false);
  const [targetGrade, setTargetGrade] = useState('一年級');

  const [updateSSupport, setUpdateSSupport] = useState(false);
  const [targetSSupport, setTargetSSupport] = useState<boolean>(true);

  const [updateSupportNeed, setUpdateSupportNeed] = useState(false);
  const [targetSupportNeed, setTargetSupportNeed] = useState('');

  const [updateStatus, setUpdateStatus] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'在讀' | '離校'>('在讀');

  const [updateAddGroup, setUpdateAddGroup] = useState(false);
  const [targetAddGroupId, setTargetAddGroupId] = useState('');

  const [updateRemoveGroup, setUpdateRemoveGroup] = useState(false);
  const [targetRemoveGroupId, setTargetRemoveGroupId] = useState('');

  if (!isOpen) return null;

  const selectedStudents = students.filter(s => selectedStudentIds.includes(s.id));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Partial<Student> = {};

    if (updateClass && targetClass.trim()) {
      updates.class = targetClass.trim().toUpperCase();
    }
    if (updateGrade && targetGrade) {
      updates.grade = targetGrade;
    }
    if (updateSSupport) {
      updates.isSSupport = targetSSupport;
      if (!targetSSupport) {
        updates.mainSupportNeed = '';
      }
    }
    if (updateSupportNeed) {
      updates.mainSupportNeed = targetSupportNeed.trim();
      if (targetSupportNeed.trim()) {
        updates.isSSupport = true;
      }
    }
    if (updateStatus) {
      updates.status = targetStatus;
    }

    const options: { addGroupId?: string; removeGroupId?: string } = {};
    if (updateAddGroup && targetAddGroupId) {
      options.addGroupId = targetAddGroupId;
    }
    if (updateRemoveGroup && targetRemoveGroupId) {
      options.removeGroupId = targetRemoveGroupId;
    }

    onApplyBatchUpdate(selectedStudentIds, updates, options);
    onClose();
  };

  const supportNeedOptions = [
    '專注力與執行功能訓練',
    '讀寫障礙 / 語文支援',
    '自閉症譜系社交溝通',
    '社交情緒與同儕適應',
    '言語治療及發音溝通',
    '肢體協調與小肌肉發展',
    '課後功課輔導支援',
    '非華語學生中文支援',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C2C2A]/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-[#E5E2DA] overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#FAF9F5] border-b border-[#E5E2DA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#ECEFE9] text-[#485945] flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2C2C2A]">批量更新學生資料</h3>
              <p className="text-xs text-[#78786E]">已選擇 {selectedStudentIds.length} 名學生（勾選欲更新的項目即可）</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#99998E] hover:text-[#2C2C2A] hover:bg-[#EFEFEA] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Students Preview Pill */}
        <div className="px-6 py-3 bg-[#FAF9F5] border-b border-[#EAE7DE] flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[#78786E] shrink-0 font-medium">選取名單：</span>
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto py-1">
            {selectedStudents.map(s => (
              <span key={s.id} className="px-2 py-0.5 rounded-md bg-white border border-[#DDDCD4] text-[#4A4A42] font-mono text-[11px]">
                {s.class}{s.classNo ? ` (${s.classNo})` : ''} {s.name}
              </span>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          {/* 1. S 支援狀態更新 */}
          <div className="p-3 rounded-xl border border-[#E5E2DA] bg-[#FAF9F5] space-y-2">
            <label className="flex items-center gap-2 font-bold text-[#2C2C2A] cursor-pointer">
              <input
                type="checkbox"
                checked={updateSSupport}
                onChange={e => setUpdateSSupport(e.target.checked)}
                className="w-4 h-4 text-[#485945] rounded border-[#DDDCD4] focus:ring-[#485945]"
              />
              <HeartHandshake className="w-4 h-4 text-[#8C521E]" />
              <span>更新 S 支援標記 (✓)</span>
            </label>
            {updateSSupport && (
              <div className="pl-6 pt-1 flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#8C521E]">
                  <input
                    type="radio"
                    name="batchSSupport"
                    checked={targetSSupport === true}
                    onChange={() => setTargetSSupport(true)}
                    className="text-[#8C521E] focus:ring-[#8C521E]"
                  />
                  <span>設為「需要 S 支援 (✓)」</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#78786E]">
                  <input
                    type="radio"
                    name="batchSSupport"
                    checked={targetSSupport === false}
                    onChange={() => setTargetSSupport(false)}
                    className="text-[#485945] focus:ring-[#485945]"
                  />
                  <span>取消 S 支援標記</span>
                </label>
              </div>
            )}
          </div>

          {/* 2. 主要支援需要 */}
          <div className="p-3 rounded-xl border border-[#E5E2DA] bg-[#FAF9F5] space-y-2">
            <label className="flex items-center gap-2 font-bold text-[#2C2C2A] cursor-pointer">
              <input
                type="checkbox"
                checked={updateSupportNeed}
                onChange={e => setUpdateSupportNeed(e.target.checked)}
                className="w-4 h-4 text-[#485945] rounded border-[#DDDCD4] focus:ring-[#485945]"
              />
              <UserCheck className="w-4 h-4 text-[#485945]" />
              <span>設定主要支援需要</span>
            </label>
            {updateSupportNeed && (
              <div className="pl-6 pt-1 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {supportNeedOptions.map(opt => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setTargetSupportNeed(opt)}
                      className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                        targetSupportNeed === opt
                          ? 'bg-[#485945] text-white border-[#485945]'
                          : 'bg-white text-[#4A4A42] border-[#DDDCD4] hover:bg-[#EFEFEA]'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={targetSupportNeed}
                  onChange={e => setTargetSupportNeed(e.target.value)}
                  placeholder="或直接輸入自訂支援需要項目..."
                  className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs bg-white focus:ring-2 focus:ring-[#485945]"
                />
              </div>
            )}
          </div>

          {/* 3. 班別與年級更新 (升班/轉班) */}
          <div className="p-3 rounded-xl border border-[#E5E2DA] bg-[#FAF9F5] space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-2 font-bold text-[#2C2C2A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateClass}
                    onChange={e => setUpdateClass(e.target.checked)}
                    className="w-4 h-4 text-[#485945] rounded border-[#DDDCD4] focus:ring-[#485945]"
                  />
                  <span>更新班別</span>
                </label>
                {updateClass && (
                  <input
                    type="text"
                    value={targetClass}
                    onChange={e => setTargetClass(e.target.value)}
                    placeholder="如 1A, 2B..."
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs bg-white focus:ring-2 focus:ring-[#485945]"
                  />
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 font-bold text-[#2C2C2A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateGrade}
                    onChange={e => setUpdateGrade(e.target.checked)}
                    className="w-4 h-4 text-[#485945] rounded border-[#DDDCD4] focus:ring-[#485945]"
                  />
                  <span>更新年級</span>
                </label>
                {updateGrade && (
                  <select
                    value={targetGrade}
                    onChange={e => setTargetGrade(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs bg-white focus:ring-2 focus:ring-[#485945]"
                  >
                    <option value="一年級">一年級</option>
                    <option value="二年級">二年級</option>
                    <option value="三年級">三年級</option>
                    <option value="四年級">四年級</option>
                    <option value="五年級">五年級</option>
                    <option value="六年級">六年級</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* 4. 現時在讀狀態 */}
          <div className="p-3 rounded-xl border border-[#E5E2DA] bg-[#FAF9F5] space-y-2">
            <label className="flex items-center gap-2 font-bold text-[#2C2C2A] cursor-pointer">
              <input
                type="checkbox"
                checked={updateStatus}
                onChange={e => setUpdateStatus(e.target.checked)}
                className="w-4 h-4 text-[#485945] rounded border-[#DDDCD4] focus:ring-[#485945]"
              />
              <span>更新在讀 / 離校狀態</span>
            </label>
            {updateStatus && (
              <div className="pl-6 pt-1 flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#2C5E32]">
                  <input
                    type="radio"
                    name="batchStatus"
                    checked={targetStatus === '在讀'}
                    onChange={() => setTargetStatus('在讀')}
                    className="text-[#485945]"
                  />
                  <span>在讀 (正常在校)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#8C3A3A]">
                  <input
                    type="radio"
                    name="batchStatus"
                    checked={targetStatus === '離校'}
                    onChange={() => setTargetStatus('離校')}
                    className="text-[#8C3A3A]"
                  />
                  <span>已離校 / 轉校</span>
                </label>
              </div>
            )}
          </div>

          {/* 5. 批量加選活動小組 */}
          <div className="p-3 rounded-xl border border-[#E5E2DA] bg-[#FAF9F5] space-y-2">
            <label className="flex items-center gap-2 font-bold text-[#2C2C2A] cursor-pointer">
              <input
                type="checkbox"
                checked={updateAddGroup}
                onChange={e => setUpdateAddGroup(e.target.checked)}
                className="w-4 h-4 text-[#485945] rounded border-[#DDDCD4] focus:ring-[#485945]"
              />
              <Plus className="w-4 h-4 text-[#485945]" />
              <span>批量加入活動小組</span>
            </label>
            {updateAddGroup && (
              <div className="pl-6 pt-1">
                <select
                  value={targetAddGroupId}
                  onChange={e => setTargetAddGroupId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs bg-white focus:ring-2 focus:ring-[#485945]"
                >
                  <option value="">-- 請選擇欲報名的活動小組 --</option>
                  {activityGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.id} - {g.name} ({g.days.join('、')} {g.startTime}-{g.endTime}){g.isSSupportGroup ? ' [S支援]' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#E5E2DA] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#DDDCD4] text-xs font-semibold text-[#78786E] hover:bg-[#EFEFEA] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!updateClass && !updateGrade && !updateSSupport && !updateSupportNeed && !updateStatus && !updateAddGroup && !updateRemoveGroup}
              className="px-5 py-2 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              確認批量更新 ({selectedStudentIds.length} 人)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
