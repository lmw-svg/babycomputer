import React, { useState, useEffect } from 'react';
import { X, User, Phone, Bookmark, Check, HeartHandshake } from 'lucide-react';
import { Student } from '../types';

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentToEdit?: Student | null;
  onSave: (student: Student) => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  isOpen,
  onClose,
  studentToEdit,
  onSave,
}) => {
  const [studentClass, setStudentClass] = useState('1A');
  const [classNo, setClassNo] = useState('01');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [grade, setGrade] = useState('一年級');
  const [isSSupport, setIsSSupport] = useState(false);
  const [mainSupportNeed, setMainSupportNeed] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'在讀' | '離校'>('在讀');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (studentToEdit) {
      setStudentClass(studentToEdit.class || '1A');
      setClassNo(studentToEdit.classNo || '01');
      setName(studentToEdit.name || '');
      setGender(studentToEdit.gender || 'M');
      setGrade(studentToEdit.grade || '一年級');
      setIsSSupport(studentToEdit.isSSupport || false);
      setMainSupportNeed(studentToEdit.mainSupportNeed || '');
      setPhone(studentToEdit.phone || '');
      setStatus(studentToEdit.status || '在讀');
      setRemarks(studentToEdit.remarks || '');
    } else {
      setStudentClass('1A');
      setClassNo('01');
      setName('');
      setGender('M');
      setGrade('一年級');
      setIsSSupport(false);
      setMainSupportNeed('');
      setPhone('');
      setStatus('在讀');
      setRemarks('');
    }
  }, [studentToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !studentClass.trim() || !classNo.trim()) return;

    const formattedClassNo = classNo.trim().padStart(2, '0');
    const autoId = `${studentClass.trim().toUpperCase()}${formattedClassNo}`;

    const student: Student = {
      id: autoId,
      class: studentClass.trim().toUpperCase(),
      classNo: formattedClassNo,
      name: name.trim(),
      gender,
      grade: grade.trim() || `${studentClass.charAt(0)}年級`,
      isSSupport,
      mainSupportNeed: mainSupportNeed.trim(),
      phone: phone.trim(),
      status,
      remarks: remarks.trim(),
    };

    onSave(student);
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
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C2C2A]/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#E5E2DA] overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#FAF9F5] border-b border-[#E5E2DA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#ECEFE9] text-[#485945] flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2C2C2A]">
                {studentToEdit ? '編輯學生資料' : '新增學生資料'}
              </h3>
              <p className="text-xs text-[#78786E]">學生編別將依「班別+學號」自動產生 (如 1A01)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#99998E] hover:text-[#2C2C2A] hover:bg-[#EFEFEA] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[#2C2C2A] mb-1">
                班別 (例如 1A, 2A, 4B) <span className="text-[#8C3A3A]">*</span>
              </label>
              <input
                type="text"
                value={studentClass}
                onChange={(e) => {
                  const val = e.target.value;
                  setStudentClass(val);
                  if (val && !studentToEdit) {
                    const g = val.charAt(0);
                    const gradeMap: Record<string, string> = {
                      '1': '一年級',
                      '2': '二年級',
                      '3': '三年級',
                      '4': '四年級',
                      '5': '五年級',
                      '6': '六年級',
                    };
                    if (gradeMap[g]) setGrade(gradeMap[g]);
                  }
                }}
                required
                className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs focus:ring-2 focus:ring-[#485945] uppercase font-bold bg-[#FAF9F5] text-[#2C2C2A]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2C2C2A] mb-1">
                學號 (例如 01, 15) <span className="text-[#8C3A3A]">*</span>
              </label>
              <input
                type="text"
                value={classNo}
                onChange={(e) => setClassNo(e.target.value)}
                required
                placeholder="01"
                className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs focus:ring-2 focus:ring-[#485945] font-mono font-bold bg-[#FAF9F5] text-[#2C2C2A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[#2C2C2A] mb-1">
                學生姓名 <span className="text-[#8C3A3A]">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="例如 李祉昕"
                className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs focus:ring-2 focus:ring-[#485945] font-semibold bg-[#FAF9F5] text-[#2C2C2A]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2C2C2A] mb-1">性別</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'M' | 'F')}
                className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs focus:ring-2 focus:ring-[#485945] bg-[#FAF9F5] text-[#2C2C2A]"
              >
                <option value="M">男 (M)</option>
                <option value="F">女 (F)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[#2C2C2A] mb-1">年級</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs focus:ring-2 focus:ring-[#485945] bg-[#FAF9F5] text-[#2C2C2A]"
              >
                <option value="一年級">一年級</option>
                <option value="二年級">二年級</option>
                <option value="三年級">三年級</option>
                <option value="四年級">四年級</option>
                <option value="五年級">五年級</option>
                <option value="六年級">六年級</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#2C2C2A] mb-1">聯絡電話 (選填)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="例如 92930729"
                className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs font-mono focus:ring-2 focus:ring-[#485945] bg-[#FAF9F5] text-[#2C2C2A]"
              />
            </div>
          </div>

          {/* S-Support Checkbox & Needs */}
          <div className="p-3.5 rounded-xl bg-[#FDF6ED] border border-[#EED7B8] space-y-2.5">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="studentIsSSupport"
                checked={isSSupport}
                onChange={(e) => setIsSSupport(e.target.checked)}
                className="w-4 h-4 text-[#8C521E] rounded border-[#EED7B8] focus:ring-[#8C521E]"
              />
              <label htmlFor="studentIsSSupport" className="font-bold text-[#8C521E] cursor-pointer flex items-center gap-1">
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>S支援學生（須安排 S支援活動小組，否則總表將提示跟進）</span>
              </label>
            </div>

            {isSSupport && (
              <div className="space-y-2 pt-1 pl-6">
                <label className="block font-semibold text-[#8C521E]">主要支援需要：</label>
                <div className="flex flex-wrap gap-1">
                  {supportNeedOptions.map(opt => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setMainSupportNeed(opt)}
                      className={`px-2 py-0.5 rounded-md text-[11px] border transition-colors ${
                        mainSupportNeed === opt
                          ? 'bg-[#8C521E] text-white border-[#8C521E]'
                          : 'bg-white text-[#4A4A42] border-[#EED7B8] hover:bg-[#FAF9F5]'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={mainSupportNeed}
                  onChange={(e) => setMainSupportNeed(e.target.value)}
                  placeholder="或直接輸入自訂支援需要項目..."
                  className="w-full px-3 py-1.5 rounded-lg border border-[#EED7B8] bg-white text-xs text-[#2C2C2A] focus:ring-2 focus:ring-[#8C521E]"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[#2C2C2A] mb-1">現時狀態</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as '在讀' | '離校')}
                className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs focus:ring-2 focus:ring-[#485945] bg-[#FAF9F5] text-[#2C2C2A]"
              >
                <option value="在讀">在讀</option>
                <option value="離校">離校</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#2C2C2A] mb-1">備註</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="選填備註"
                className="w-full px-3 py-2 rounded-xl border border-[#DDDCD4] text-xs focus:ring-2 focus:ring-[#485945] bg-[#FAF9F5] text-[#2C2C2A]"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-[#E5E2DA] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#DDDCD4] text-xs font-semibold text-[#78786E] hover:bg-[#EFEFEA] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-bold transition-colors shadow-xs"
            >
              {studentToEdit ? '儲存學生變更' : '確認新增學生'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
