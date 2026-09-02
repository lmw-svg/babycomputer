import React, { useState } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import { Student, ActivityGroup, Enrollment, DismissalMethod } from '../types';

interface QuickEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: Student | null;
  groupId?: string | null;
  students: Student[];
  activityGroups: ActivityGroup[];
  enrollments: Enrollment[];
  onEnroll: (groupId: string, studentId: string, dismissalMethod: DismissalMethod) => void;
}

const DISMISSAL_METHODS: DismissalMethod[] = ['自行放學', '家長接送', '課後託管班', '校車', '留校', '其他'];

export const QuickEnrollModal: React.FC<QuickEnrollModalProps> = ({
  isOpen,
  onClose,
  student,
  groupId,
  students,
  activityGroups,
  enrollments,
  onEnroll,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState(student ? student.id : (students[0]?.id || ''));
  const [selectedGroupId, setSelectedGroupId] = useState(groupId || (activityGroups[0]?.id || ''));
  const [dismissalMethod, setDismissalMethod] = useState<DismissalMethod>('自行放學');

  if (!isOpen) return null;

  const currentStudentId = student ? student.id : selectedStudentId;
  const currentGroupId = groupId || selectedGroupId;

  // Check if already enrolled
  const isAlreadyEnrolled = enrollments.some(
    e => e.groupId === currentGroupId && e.studentId === currentStudentId
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudentId || !currentGroupId || isAlreadyEnrolled) return;

    onEnroll(currentGroupId, currentStudentId, dismissalMethod);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C2C2A]/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#E5E2DA] overflow-hidden">
        <div className="px-6 py-4 bg-[#FAF9F5] border-b border-[#E5E2DA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#ECEFE9] text-[#485945] flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2C2C2A]">分配活動小組 / 報名登記</h3>
              <p className="text-xs text-[#78786E]">將學生加入課外活動班或支援小組</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#99998E] hover:text-[#2C2C2A] hover:bg-[#EFEFEA] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-white">
          {/* Select Student (if not preselected) */}
          {student ? (
            <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#E5E2DA]">
              <span className="text-xs text-[#78786E] block">指定學生：</span>
              <p className="text-sm font-bold text-[#2C2C2A] mt-0.5">
                {student.class} ({student.classNo}) {student.name} <span className="font-mono text-xs text-[#78786E]">[{student.id}]</span>
              </p>
              {student.isSSupport && (
                <span className="inline-block mt-1 text-[11px] font-semibold text-[#8C521E] bg-[#FDF6ED] border border-[#EED7B8] px-2 py-0.5 rounded-md">
                  ★ S支援學生 ({student.mainSupportNeed || '需支援'})
                </span>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-[#4A4A42] mb-1">選擇學生</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] text-[#2C2C2A] text-sm focus:ring-2 focus:ring-[#485945]"
              >
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.class} ({s.classNo}) {s.name} [{s.id}] {s.isSSupport ? '★ S支援' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Select Activity Group (if not preselected) */}
          {groupId ? (
            <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#E5E2DA]">
              <span className="text-xs text-[#78786E] block">指定活動小組：</span>
              {(() => {
                const g = activityGroups.find(x => x.id === groupId);
                return (
                  <p className="text-sm font-bold text-[#2C2C2A] mt-0.5">
                    {g?.id} {g?.name} <span className="text-xs font-normal text-[#78786E]">({g?.days.join('、')} {g?.startTime}-{g?.endTime})</span>
                  </p>
                );
              })()}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-[#4A4A42] mb-1">選擇活動小組</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] text-[#2C2C2A] text-sm focus:ring-2 focus:ring-[#485945]"
              >
                {activityGroups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.id} {g.name} ({g.days.join('、')} {g.startTime}-{g.endTime}) {g.isSSupportGroup ? '★ S支援組' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dismissal Method */}
          <div>
            <label className="block text-xs font-bold text-[#4A4A42] mb-1">放學 / 接送方式</label>
            <select
              value={dismissalMethod}
              onChange={(e) => setDismissalMethod(e.target.value as DismissalMethod)}
              className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] text-[#2C2C2A] text-sm focus:ring-2 focus:ring-[#485945] font-semibold"
            >
              {DISMISSAL_METHODS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {isAlreadyEnrolled && (
            <div className="p-3 rounded-xl bg-[#FDF0F0] border border-[#F5CCCC] text-[#8C3A3A] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#8C3A3A]" />
              <span>該學生已經登記於此活動小組中，請勿重複加入。</span>
            </div>
          )}

          <div className="pt-4 border-t border-[#E5E2DA] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#DDDCD4] text-xs font-semibold text-[#4A4A42] hover:bg-[#FAF9F5] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isAlreadyEnrolled}
              className="px-5 py-2 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow-sm"
            >
              確認加入
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

