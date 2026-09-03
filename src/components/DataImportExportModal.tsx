import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle,
  FileCode,
  Cloud,
  RefreshCw,
  Radio,
  Database
} from 'lucide-react';
import { AppDataState, UserRole } from '../types';
import { exportFullSchoolDataToExcel, parseUploadedFile } from '../utils/excel';
import { realtimeSync } from '../services/realtimeSync';

interface DataImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AppDataState;
  role: UserRole;
  maskPhone: boolean;
  onImportData: (partialData: Partial<AppDataState>) => void;
  onResetData: () => void;
}

export const DataImportExportModal: React.FC<DataImportExportModalProps> = ({
  isOpen,
  onClose,
  data,
  role,
  maskPhone,
  onImportData,
  onResetData,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'cloud'>('export');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const isGuest = role === 'guest';
  const effectiveMaskPhone = isGuest ? true : maskPhone;

  const handleExportExcel = () => {
    exportFullSchoolDataToExcel(data, effectiveMaskPhone);
  };

  const handleExportJSON = () => {
    let exportData = data;
    if (isGuest) {
      // Redact phone numbers in JSON for guests
      exportData = {
        ...data,
        students: data.students.map(s => ({
          ...s,
          phone: s.phone ? `${s.phone.slice(0, 2)}****${s.phone.slice(-2)}` : '',
        })),
      };
    }
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `學校課外活動系統備份_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportMessage(null);

    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text) as Partial<AppDataState>;
        onImportData(parsed);
        setImportMessage({
          type: 'success',
          text: `成功從 JSON 導入資料！包含學生、活動小組與點名記錄。`,
        });
      } else {
        const parsed = await parseUploadedFile(file);
        const updatePayload: Partial<AppDataState> = {};
        let summary = [];

        if (parsed.students && parsed.students.length > 0) {
          updatePayload.students = parsed.students as any;
          summary.push(`${parsed.students.length} 名學生`);
        }
        if (parsed.activityGroups && parsed.activityGroups.length > 0) {
          updatePayload.activityGroups = parsed.activityGroups as any;
          summary.push(`${parsed.activityGroups.length} 個活動小組`);
        }
        if (parsed.enrollments && parsed.enrollments.length > 0) {
          updatePayload.enrollments = parsed.enrollments as any;
          summary.push(`${parsed.enrollments.length} 筆選課名單`);
        }

        if (summary.length > 0) {
          onImportData(updatePayload);
          setImportMessage({
            type: 'success',
            text: `成功導入 Excel 資料：${summary.join('、')}！`,
          });
        } else {
          setImportMessage({
            type: 'error',
            text: '未能從上傳的檔案中識別出有效的工作表格式（需包含「學生」、「活動」或「名單」工作表）。',
          });
        }
      }
    } catch (err: any) {
      setImportMessage({
        type: 'error',
        text: `導入失敗：${err.message || '檔案格式無效'}`,
      });
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C2C2A]/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-[#E5E2DA] overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-[#FAF9F5] border-b border-[#E5E2DA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#ECEFE9] text-[#485945] flex items-center justify-center font-bold">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2C2C2A]">資料導出、導入與多裝置同步中心</h3>
              <p className="text-xs text-[#78786E]">支援 Excel (.xlsx)、JSON 備份與跨 PC / 手機即時同步</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#99998E] hover:text-[#2C2C2A] hover:bg-[#EFEFEA] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-6 pt-4 border-b border-[#E5E2DA] flex space-x-3 bg-white">
          <button
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'export'
                ? 'border-[#485945] text-[#485945]'
                : 'border-transparent text-[#78786E] hover:text-[#2C2C2A]'
            }`}
          >
            導出資料 (Excel / 備份)
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'import'
                ? 'border-[#485945] text-[#485945]'
                : 'border-transparent text-[#78786E] hover:text-[#2C2C2A]'
            }`}
          >
            導入資料 (Excel / JSON)
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1 ${
              activeTab === 'cloud'
                ? 'border-[#485945] text-[#485945]'
                : 'border-transparent text-[#78786E] hover:text-[#2C2C2A]'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>跨裝置即時同步</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 bg-white">
          {importMessage && (
            <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
              importMessage.type === 'success'
                ? 'bg-[#EEF5EF] text-[#2C5E32] border border-[#D0E4D3]'
                : 'bg-[#FDF0F0] text-[#8C3A3A] border border-[#F5CCCC]'
            }`}>
              {importMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2C5E32]" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-[#8C3A3A]" />
              )}
              <span>{importMessage.text}</span>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-4">
              {/* Option 1: Multi-sheet Excel */}
              <div className="p-4 rounded-xl border border-[#E5E2DA] bg-[#FAF9F5] hover:bg-[#F5F5F0] transition-colors flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-[#2C5E32]" />
                    <h4 className="text-sm font-bold text-[#2C2C2A]">導出全校標準 Excel 活頁簿 (.xlsx)</h4>
                  </div>
                  <p className="text-xs text-[#78786E] leading-relaxed">
                    自動生成包含「活動小組設定」、「學生列表」、「活動小組名單」、「學生總表」及「出席統計表」共5個分頁。
                  </p>
                </div>
                <button
                  id="modal-export-excel-btn"
                  onClick={handleExportExcel}
                  className="px-4 py-2 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-bold shrink-0 transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下載 Excel</span>
                </button>
              </div>

              {/* Option 2: Full JSON backup */}
              <div className="p-4 rounded-xl border border-[#E5E2DA] bg-[#FAF9F5] hover:bg-[#F5F5F0] transition-colors flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-[#485945]" />
                    <h4 className="text-sm font-bold text-[#2C2C2A]">系統完整 JSON 備份檔</h4>
                  </div>
                  <p className="text-xs text-[#78786E] leading-relaxed">
                    包含所有小組設定、學生資料、點名歷史記錄及關聯標籤，適用於完整備份或轉移裝置。
                  </p>
                </div>
                <button
                  id="modal-export-json-btn"
                  onClick={handleExportJSON}
                  className="px-4 py-2 rounded-xl bg-[#2C2C2A] hover:bg-[#1E1E1C] text-white text-xs font-bold shrink-0 transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下載 JSON</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              {role === 'guest' ? (
                <div className="p-4 rounded-xl bg-[#FDF6ED] border border-[#EED7B8] text-[#8C521E] text-xs">
                  ⚠️ 訪客模式僅具備查閱與導出權限。如需導入或覆蓋學校資料，請於右上角切換至「管理員」身份。
                </div>
              ) : (
                <>
                  <div className="border-2 border-dashed border-[#DDDCD4] rounded-2xl p-6 text-center hover:border-[#485945] hover:bg-[#FAF9F5] transition-all cursor-pointer relative">
                    <input
                      type="file"
                      id="file-upload-input"
                      accept=".xlsx,.xls,.csv,.json"
                      onChange={handleFileUpload}
                      disabled={isProcessing}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-10 h-10 text-[#485945] mx-auto mb-2" />
                    <p className="text-sm font-bold text-[#2C2C2A]">
                      {isProcessing ? '正在解析並導入資料...' : '點擊或拖曳檔案至此處上傳'}
                    </p>
                    <p className="text-xs text-[#78786E] mt-1">
                      支援格式：.xlsx (Excel), .csv, .json (系統備份)
                    </p>
                  </div>

                  {/* Reset to school sample data */}
                  <div className="pt-2 border-t border-[#E5E2DA] flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#2C2C2A] block">重設示例資料</span>
                      <span className="text-[11px] text-[#78786E]">將系統恢復為學校初始標準活動與學生名單</span>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm('確定要將系統資料重設為初始官方示例資料嗎？現有修改將會被覆蓋。')) {
                          onResetData();
                          onClose();
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#F5CCCC] text-[#8C3A3A] hover:bg-[#FDF0F0] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>重設為初始資料</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'cloud' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E5E2DA] space-y-3">
                <div className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-[#485945]" />
                  <h4 className="text-sm font-bold text-[#2C2C2A]">跨瀏覽器、PC 與手機多裝置同步狀態</h4>
                </div>
                <p className="text-xs text-[#78786E] leading-relaxed">
                  系統透過 Supabase (PostgreSQL Realtime) 即時資料庫進行多端資料同步。當您在電腦修改活動日期、設定或點名，手機開啟同一網址即可實時獲取一致的最新數據。
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="p-3 bg-white rounded-lg border border-[#E5E2DA] text-xs space-y-1">
                    <span className="text-[#78786E] block font-medium">當前裝置資料版本</span>
                    <span className="font-mono font-bold text-[#2C2C2A]">
                      {data.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : '初始預設'}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-[#E5E2DA] text-xs space-y-1">
                    <span className="text-[#78786E] block font-medium">電話號碼遮蔽狀態</span>
                    <span className="font-bold text-[#2C5E32]">
                      {data.settings?.maskPhone ? '已啟用遮蔽 (保護隱私)' : '已顯示完整電話'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  id="cloud-tab-pull-btn"
                  onClick={async () => {
                    setIsProcessing(true);
                    const ok = await realtimeSync.syncWithCloud(true);
                    setIsProcessing(false);
                    if (ok) {
                      setImportMessage({
                        type: 'success',
                        text: '已成功從雲端同步最新活動與學生名單！',
                      });
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span>從雲端重新整理最新資料</span>
                </button>

                {role !== 'guest' && (
                  <button
                    id="cloud-tab-push-btn"
                    onClick={async () => {
                      if (window.confirm('確定要將此裝置目前的資料強制上傳至雲端，並同步至其他瀏覽器與手機嗎？')) {
                        setIsProcessing(true);
                        const ok = await realtimeSync.forcePushToCloud(data);
                        setIsProcessing(false);
                        if (ok) {
                          setImportMessage({
                            type: 'success',
                            text: '已成功將本機最新資料強制上傳並廣播至雲端！',
                          });
                        }
                      }
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#2C2C2A] hover:bg-[#1E1E1C] text-white text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>強制上傳本機資料至雲端</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#FAF9F5] border-t border-[#E5E2DA] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#2C2C2A] hover:bg-[#1E1E1C] text-white text-xs font-semibold transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};

