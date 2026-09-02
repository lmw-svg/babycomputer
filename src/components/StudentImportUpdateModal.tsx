import React, { useState } from 'react';
import { X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, UserCheck } from 'lucide-react';
import { Student } from '../types';
import { parseUploadedFile, downloadStudentTemplateExcel } from '../utils/excel';

interface StudentImportUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStudents: Student[];
  onApplyStudentImport: (newOrUpdatedStudents: Student[], mode: 'merge' | 'replace') => void;
}

export const StudentImportUpdateModal: React.FC<StudentImportUpdateModalProps> = ({
  isOpen,
  onClose,
  currentStudents,
  onApplyStudentImport,
}) => {
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [parsedList, setParsedList] = useState<Student[] | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentStudentMap = new Map<string, Student>(currentStudents.map(s => [s.id, s]));

  const stats = React.useMemo(() => {
    if (!parsedList) return null;
    let newCount = 0;
    let updateCount = 0;
    const diffs: { student: Student; isNew: boolean; changes: string[] }[] = [];

    parsedList.forEach((p: Student) => {
      const existing = currentStudentMap.get(p.id);
      if (!existing) {
        newCount++;
        diffs.push({ student: p, isNew: true, changes: ['新增學生資料'] });
      } else {
        updateCount++;
        const changes: string[] = [];
        if (existing.name !== p.name) changes.push(`姓名: ${existing.name} ➔ ${p.name}`);
        if (existing.class !== p.class) changes.push(`班別: ${existing.class} ➔ ${p.class}`);
        if (existing.isSSupport !== p.isSSupport) changes.push(`S支援: ${existing.isSSupport ? '✓' : '無'} ➔ ${p.isSSupport ? '✓' : '無'}`);
        if (existing.mainSupportNeed !== p.mainSupportNeed) changes.push(`需要: ${existing.mainSupportNeed || '無'} ➔ ${p.mainSupportNeed || '無'}`);
        if (existing.phone !== p.phone) changes.push(`電話: 已更新`);
        if (existing.status !== p.status) changes.push(`狀態: ${existing.status} ➔ ${p.status}`);
        diffs.push({ student: p, isNew: false, changes: changes.length > 0 ? changes : ['無重大變更'] });
      }
    });

    return {
      total: parsedList.length,
      newCount,
      updateCount,
      diffs,
    };
  }, [parsedList, currentStudents]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setIsProcessing(true);
    setFileName(file.name);

    try {
      const parsed = await parseUploadedFile(file);
      if (parsed.students && parsed.students.length > 0) {
        setParsedList(parsed.students as Student[]);
      } else {
        setErrorMsg('未能在此 Excel/CSV 檔案中找到學生資料工作表。請確保欄位包含「班別」、「學號」、「學生姓名」等。');
        setParsedList(null);
      }
    } catch (err: any) {
      setErrorMsg(`檔案讀取失敗：${err?.message || '格式無效'}`);
      setParsedList(null);
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleConfirm = () => {
    if (!parsedList || parsedList.length === 0) return;
    onApplyStudentImport(parsedList, importMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C2C2A]/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-[#E5E2DA] overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#FAF9F5] border-b border-[#E5E2DA] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#ECEFE9] text-[#485945] flex items-center justify-center font-bold">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2C2C2A]">匯入與更新學生名單 (Excel / CSV)</h3>
              <p className="text-xs text-[#78786E]">支援智能比對更新或整份名單替換</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#99998E] hover:text-[#2C2C2A] hover:bg-[#EFEFEA] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Action Step 1: Download Template */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E5E2DA] gap-3">
            <div>
              <h4 className="font-bold text-[#2C2C2A] text-xs">下載標準學生資料範本</h4>
              <p className="text-[#78786E] text-[11px] mt-0.5">
                格式包含：學生編別、班別、學號、學生姓名、性別、S支援(✓)、主要支援需要、聯絡電話、現時狀態
              </p>
            </div>
            <button
              onClick={downloadStudentTemplateExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDDCD4] bg-white hover:bg-[#EFEFEA] text-[#4A4A42] font-semibold text-xs transition-colors shrink-0 shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-[#485945]" />
              <span>下載範本 (.xlsx)</span>
            </button>
          </div>

          {/* Action Step 2: Upload File Box */}
          <div className="border-2 border-dashed border-[#DDDCD4] hover:border-[#485945] rounded-2xl p-6 text-center bg-[#FAF9F5]/50 transition-colors">
            <input
              type="file"
              id="student-excel-upload"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="student-excel-upload"
              className="cursor-pointer flex flex-col items-center justify-center space-y-2"
            >
              <div className="w-10 h-10 rounded-full bg-[#ECEFE9] text-[#485945] flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-[#485945] hover:underline">點擊選取 Excel / CSV 檔案</span>
                <span className="text-[#78786E]"> 或拖曳檔案至此</span>
              </div>
              <p className="text-[11px] text-[#99998E]">支援 .xlsx, .xls, .csv 格式</p>
            </label>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#FDF0F0] border border-[#F5C2C2] text-[#8C3A3A] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsed Result Preview */}
          {parsedList && stats && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-[#EAE7DE] pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2C5E32]" />
                  <span className="font-bold text-[#2C2C2A]">檔案分析結果：{fileName}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded-md bg-[#ECEFE9] text-[#364733] font-semibold">
                    總計 {stats.total} 名
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#E8F0FE] text-[#1967D2] font-semibold">
                    更新現有 {stats.updateCount} 名
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#EEF5EF] text-[#2C5E32] font-semibold">
                    新增 {stats.newCount} 名
                  </span>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="p-3 rounded-xl border border-[#E5E2DA] bg-[#FAF9F5] space-y-2">
                <span className="font-bold text-[#2C2C2A] block">選擇更新方式：</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      importMode === 'merge'
                        ? 'bg-white border-[#485945] shadow-xs'
                        : 'bg-transparent border-[#DDDCD4] text-[#78786E]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="mt-0.5 text-[#485945]"
                    />
                    <div>
                      <span className="font-bold text-[#2C2C2A] block">智能合併更新（推薦）</span>
                      <span className="text-[11px] text-[#78786E]">
                        保留現有學生活動小組報名與點名記錄，僅更新檔案內比對到的學生資料與新增未存在學生。
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      importMode === 'replace'
                        ? 'bg-white border-[#8C3A3A] shadow-xs'
                        : 'bg-transparent border-[#DDDCD4] text-[#78786E]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-[#8C3A3A]"
                    />
                    <div>
                      <span className="font-bold text-[#8C3A3A] block">完全取代名單</span>
                      <span className="text-[11px] text-[#78786E]">
                        清空目前所有學生名單，完全以本檔案中之學生為準。
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Preview Table List */}
              <div className="border border-[#E5E2DA] rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F5F5F0] text-[#606056] font-bold sticky top-0">
                    <tr>
                      <th className="px-3 py-2">學生編別</th>
                      <th className="px-2 py-2">班別</th>
                      <th className="px-3 py-2">學生姓名</th>
                      <th className="px-2 py-2 text-center">S支援</th>
                      <th className="px-3 py-2">支援需要</th>
                      <th className="px-3 py-2">變更預覽</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE7DE]">
                    {stats.diffs.map((d, i) => (
                      <tr key={i} className="hover:bg-[#FAF9F5]">
                        <td className="px-3 py-2 font-mono font-bold text-[#2C2C2A]">{d.student.id}</td>
                        <td className="px-2 py-2">{d.student.class}</td>
                        <td className="px-3 py-2 font-semibold text-[#2C2C2A]">{d.student.name}</td>
                        <td className="px-2 py-2 text-center">
                          {d.student.isSSupport ? <span className="text-[#8C521E] font-bold">✓</span> : '-'}
                        </td>
                        <td className="px-3 py-2 text-[#78786E]">{d.student.mainSupportNeed || '-'}</td>
                        <td className="px-3 py-2">
                          {d.isNew ? (
                            <span className="px-1.5 py-0.5 rounded-sm bg-[#EEF5EF] text-[#2C5E32] text-[10px] font-bold">
                              新增
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#485945]">
                              {d.changes.join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#FAF9F5] border-t border-[#E5E2DA] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#78786E]">
            {parsedList ? `已解析 ${parsedList.length} 筆學生紀錄` : '請先上傳欲更新之學生名單檔案'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#DDDCD4] text-xs font-semibold text-[#78786E] hover:bg-[#EFEFEA] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={!parsedList || parsedList.length === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>確認執行學生名單更新</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
