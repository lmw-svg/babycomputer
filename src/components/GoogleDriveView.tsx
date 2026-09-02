import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Cloud, 
  CloudUpload, 
  CloudDownload, 
  RefreshCw, 
  Trash2, 
  ExternalLink, 
  FolderOpen, 
  FileSpreadsheet, 
  FileJson, 
  FileText,
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  LogOut, 
  Search, 
  Download,
  AlertCircle,
  HardDrive,
  Clock,
  Sparkles,
  Info,
  Layers,
  ChevronRight,
  Database
} from 'lucide-react';
import { AppDataState, UserRole } from '../types';
import { 
  googleSignIn, 
  googleSignOut, 
  getAccessToken, 
  initAuth, 
  auth 
} from '../services/googleAuth';
import { 
  findOrCreateAppFolder, 
  listDriveFiles, 
  uploadJsonToDrive, 
  uploadBlobToDrive, 
  downloadDriveFileContent, 
  downloadDriveFileBlob, 
  deleteDriveFile, 
  getDriveStorageInfo, 
  formatBytes, 
  DriveFileItem, 
  DriveStorageInfo,
  APP_DEFAULT_DRIVE_FOLDER
} from '../services/googleDrive';
import { generateFullSchoolExcelBlob } from '../utils/excel';

interface GoogleDriveViewProps {
  data: AppDataState;
  role: UserRole;
  maskPhone: boolean;
  onRestoreData: (restoredData: AppDataState) => void;
  onShowToast: (message: string) => void;
}

export const GoogleDriveView: React.FC<GoogleDriveViewProps> = ({
  data,
  role,
  maskPhone,
  onRestoreData,
  onShowToast,
}) => {
  // Auth state
  const [user, setUser] = useState(auth.currentUser);
  const [token, setToken] = useState<string | null>(getAccessToken());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Drive state
  const [appFolder, setAppFolder] = useState<{ id: string; name: string; webViewLink?: string } | null>(null);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [storageInfo, setStorageInfo] = useState<DriveStorageInfo | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Restore Modal State
  const [fileToRestore, setFileToRestore] = useState<{ file: DriveFileItem; parsedData: AppDataState } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // File Upload
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, accessToken) => {
        setUser(authedUser);
        setToken(accessToken);
        setAuthError(null);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch Drive folder, storage & files when token is available
  const loadDriveData = useCallback(async (accessToken: string) => {
    setIsLoadingFiles(true);
    setErrorMessage(null);
    try {
      // 1. Get or create dedicated app folder
      const folder = await findOrCreateAppFolder(accessToken, APP_DEFAULT_DRIVE_FOLDER);
      setAppFolder(folder);

      // 2. Fetch files in folder
      const fileList = await listDriveFiles(accessToken, folder.id);
      setFiles(fileList);

      // 3. Storage info
      const storage = await getDriveStorageInfo(accessToken).catch(() => null);
      if (storage) {
        setStorageInfo(storage);
      }
    } catch (err: any) {
      console.error('Load Drive Data Error:', err);
      setErrorMessage(err.message || '讀取 Google Drive 雲端資料夾失敗');
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadDriveData(token);
    }
  }, [token, loadDriveData]);

  // Handle Google Sign In
  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      setUser(res.user);
      setToken(res.accessToken);
      onShowToast(`已成功登入 Google 帳號 (${res.user.email})`);
      loadDriveData(res.accessToken);
    } catch (err: any) {
      console.error('Sign In Failed:', err);
      setAuthError(err.message || 'Google 登入失敗或已取消');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handle Google Sign Out
  const handleSignOut = async () => {
    if (window.confirm('確定要登出 Google 帳號嗎？')) {
      await googleSignOut();
      setUser(null);
      setToken(null);
      setFiles([]);
      setAppFolder(null);
      setStorageInfo(null);
      onShowToast('已中斷 Google 帳號連線');
    }
  };

  // One-click Backup Full JSON data to Drive
  const handleBackupJsonToDrive = async () => {
    if (!token) return;
    setIsBackingUp(true);
    setBackupSuccessMessage(null);
    setErrorMessage(null);
    try {
      const folder = appFolder || await findOrCreateAppFolder(token);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const dateLabel = new Date().toLocaleDateString('zh-HK').replace(/\//g, '-');
      const fileName = `學校活動點名系統_完整備份_${dateLabel}_${timestamp.slice(11, 16)}.json`;

      let exportPayload = data;
      if (role === 'guest') {
        exportPayload = {
          ...data,
          students: data.students.map(s => ({
            ...s,
            phone: s.phone ? `${s.phone.slice(0, 2)}****${s.phone.slice(-2)}` : '',
          })),
        };
      }

      const uploaded = await uploadJsonToDrive(token, fileName, exportPayload, folder.id);
      
      setBackupSuccessMessage(`成功備份至 Google Drive: ${uploaded.name}`);
      onShowToast(`✅ 系統資料已成功備份至 Google Drive！`);
      
      // Refresh files
      const fileList = await listDriveFiles(token, folder.id);
      setFiles(fileList);
    } catch (err: any) {
      console.error('Backup to Drive Error:', err);
      setErrorMessage(err.message || '備份至 Google Drive 失敗');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Export Full School Excel to Drive
  const handleExportExcelToDrive = async () => {
    if (!token) return;
    setIsBackingUp(true);
    setBackupSuccessMessage(null);
    setErrorMessage(null);
    try {
      const folder = appFolder || await findOrCreateAppFolder(token);
      const dateLabel = new Date().toLocaleDateString('zh-HK').replace(/\//g, '-');
      const fileName = `學校課外活動與點名總表_${dateLabel}.xlsx`;
      
      const effectiveMaskPhone = role === 'guest' ? true : maskPhone;
      const blob = generateFullSchoolExcelBlob(data, effectiveMaskPhone);
      const uploaded = await uploadBlobToDrive(
        token, 
        fileName, 
        blob, 
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        folder.id
      );

      setBackupSuccessMessage(`成功匯出 Excel 報表至 Google Drive: ${uploaded.name}`);
      onShowToast(`📊 點名總表 Excel 已儲存至 Google 雲端硬碟！`);

      // Refresh files
      const fileList = await listDriveFiles(token, folder.id);
      setFiles(fileList);
    } catch (err: any) {
      console.error('Export Excel to Drive Error:', err);
      setErrorMessage(err.message || '匯出 Excel 至 Google Drive 失敗');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Prepare restore from JSON file
  const handleStartRestore = async (file: DriveFileItem) => {
    if (!token) return;
    try {
      setIsLoadingFiles(true);
      const content = await downloadDriveFileContent(token, file.id);
      const parsed = JSON.parse(content);
      
      if (!parsed.activityGroups || !parsed.students || !parsed.enrollments) {
        throw new Error('此檔案格式不符合系統備份結構');
      }

      setFileToRestore({
        file,
        parsedData: parsed as AppDataState,
      });
    } catch (err: any) {
      alert(`無法解析此備份檔案：${err.message}`);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Execute restore after user confirmation
  const handleConfirmRestore = () => {
    if (!fileToRestore) return;
    setIsRestoring(true);
    try {
      onRestoreData(fileToRestore.parsedData);
      onShowToast(`✅ 已成功從 Google Drive 還原備份 (${fileToRestore.file.name})！`);
      setFileToRestore(null);
    } catch (err: any) {
      setErrorMessage(`還原失敗: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Delete file from Drive
  const handleConfirmDelete = async () => {
    if (!fileToDelete || !token) return;
    setIsDeleting(true);
    try {
      await deleteDriveFile(token, fileToDelete.id);
      onShowToast(`已自 Google Drive 刪除檔案 (${fileToDelete.name})`);
      setFileToDelete(null);
      
      // Refresh list
      if (appFolder) {
        const fileList = await listDriveFiles(token, appFolder.id);
        setFiles(fileList);
      }
    } catch (err: any) {
      alert(`刪除失敗: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Download file locally from Drive
  const handleDownloadFileLocally = async (file: DriveFileItem) => {
    if (!token) return;
    try {
      const blob = await downloadDriveFileBlob(token, file.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onShowToast(`已下載 ${file.name}`);
    } catch (err: any) {
      alert(`下載失敗: ${err.message}`);
    }
  };

  // Handle local file upload to Drive
  const handleUploadFileToDrive = async (uploadedFile: File) => {
    if (!token || !uploadedFile) return;
    setIsUploadingLocal(true);
    setErrorMessage(null);
    try {
      const folder = appFolder || await findOrCreateAppFolder(token);
      let uploaded: DriveFileItem;

      if (uploadedFile.name.endsWith('.json')) {
        const text = await uploadedFile.text();
        uploaded = await uploadJsonToDrive(token, uploadedFile.name, text, folder.id);
      } else {
        uploaded = await uploadBlobToDrive(
          token, 
          uploadedFile.name, 
          uploadedFile, 
          uploadedFile.type || 'application/octet-stream',
          folder.id
        );
      }

      onShowToast(`已上傳 ${uploaded.name} 至 Google Drive！`);
      const fileList = await listDriveFiles(token, folder.id);
      setFiles(fileList);
    } catch (err: any) {
      console.error('Upload Error:', err);
      setErrorMessage(err.message || '上傳至 Google Drive 失敗');
    } finally {
      setIsUploadingLocal(false);
    }
  };

  // Filtered files
  const filteredFiles = files.filter(f => {
    if (!searchQuery.trim()) return true;
    return f.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl p-6 border border-[#E5E2DA] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F0FE] text-[#1A73E8] border border-[#D2E3FC] flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#2C2C2A]">Google 雲端硬碟 (Google Drive) 備份與同步</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EEF5EF] text-[#2C5E32] border border-[#D0E4D3]">
                  官方 OAuth 整合
                </span>
              </div>
              <p className="text-xs text-[#78786E] mt-1 max-w-2xl leading-relaxed">
                將全校課外活動小組名單、點名記錄與學生資料安全備份至 Google Drive 專屬資料夾，支援一鍵雲端還原、匯出 Excel 報表及多端檔案同步。
              </p>
            </div>
          </div>

          {/* Account Status / Login */}
          <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
            {user ? (
              <div className="flex items-center gap-3 bg-[#FAF9F5] p-2.5 rounded-2xl border border-[#EAE7DE]">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-9 h-9 rounded-full border border-[#DDDCD4]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#485945] text-white flex items-center justify-center font-bold text-xs">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="text-left">
                  <div className="text-xs font-bold text-[#2C2C2A] truncate max-w-[160px]">
                    {user.displayName || 'Google 用戶'}
                  </div>
                  <div className="text-[11px] text-[#78786E] truncate max-w-[160px]">
                    {user.email}
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  title="登出 Google 帳號"
                  className="p-1.5 text-[#78786E] hover:text-[#8C3A3A] hover:bg-[#FDF0F0] rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                disabled={isAuthenticating}
                className="gsi-material-button inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white border border-[#DDDCD4] hover:bg-[#F8F9FA] hover:shadow-md transition-all text-xs font-bold text-[#3C4043]"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
                <span>{isAuthenticating ? '連接中...' : '使用 Google 帳號登入'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#FDF0F0] border border-[#F5CCCC] text-[#8C3A3A] text-xs flex items-center justify-between gap-2 animate-shake">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
            <button
              onClick={handleSignIn}
              className="px-2.5 py-1 bg-white border border-[#F5CCCC] text-[#8C3A3A] font-bold rounded-lg hover:bg-[#FDF0F0]"
            >
              重新連接
            </button>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#FDF0F0] border border-[#F5CCCC] text-[#8C3A3A] text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => token && loadDriveData(token)}
              className="px-2.5 py-1 bg-white border border-[#F5CCCC] text-[#8C3A3A] font-bold rounded-lg"
            >
              重試
            </button>
          </div>
        )}

        {/* Backup Success Banner */}
        {backupSuccessMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#EEF5EF] border border-[#D0E4D3] text-[#2C5E32] text-xs flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{backupSuccessMessage}</span>
            </div>
            <button
              onClick={() => setBackupSuccessMessage(null)}
              className="text-xs font-semibold hover:underline"
            >
              關閉
            </button>
          </div>
        )}
      </div>

      {/* Main Drive Operations Section */}
      {!user ? (
        <div className="bg-white rounded-2xl p-10 border border-[#E5E2DA] text-center max-w-2xl mx-auto shadow-xs space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center mx-auto shadow-sm">
            <Cloud className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#2C2C2A]">登入 Google 帳號以啟用 Google Drive 備份</h3>
            <p className="text-xs text-[#78786E] mt-2 max-w-md mx-auto leading-relaxed">
              點擊下方按鈕以 Google 帳號授權連接。系統將在您的 Google Drive 建立專屬備份資料夾，供您隨時備份、還原與匯出點名表。
            </p>
          </div>
          <button
            onClick={handleSignIn}
            disabled={isAuthenticating}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-bold text-sm shadow-md transition-all"
          >
            <CloudUpload className="w-5 h-5" />
            <span>{isAuthenticating ? '正在授權連接...' : '授權並連接 Google Drive'}</span>
          </button>
          <div className="text-[11px] text-[#99998E] flex items-center justify-center gap-1.5 pt-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#485945]" />
            <span>嚴格遵循官方授權規範，權杖僅保存在記憶體中，保障學校資料安全</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Quick Actions & Folder Info (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Quick Cloud Actions Card */}
            <div className="bg-white rounded-2xl p-5 border border-[#E5E2DA] shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#EAE7DE]">
                <div className="flex items-center gap-2">
                  <CloudUpload className="w-4 h-4 text-[#485945]" />
                  <h3 className="text-xs font-bold text-[#2C2C2A] uppercase tracking-wider">
                    立即備份至 Google Drive
                  </h3>
                </div>
              </div>

              <div className="space-y-2.5">
                {/* JSON Full Backup */}
                <button
                  onClick={handleBackupJsonToDrive}
                  disabled={isBackingUp}
                  className="w-full px-4 py-3 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-bold flex items-center justify-between transition-all shadow-xs disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <FileJson className="w-4 h-4 text-[#E6EFE5]" />
                    <div className="text-left">
                      <div className="font-bold">完整系統資料備份 (JSON)</div>
                      <div className="text-[10px] text-[#D0E4D3] font-normal">
                        含 {data.activityGroups.length} 組活動、{data.students.length} 位學生、{data.attendanceRecords.length} 筆點名
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 text-[#CCD8C7]" />
                </button>

                {/* Excel Export to Drive */}
                <button
                  onClick={handleExportExcelToDrive}
                  disabled={isBackingUp}
                  className="w-full px-4 py-3 rounded-xl bg-[#FAF9F5] hover:bg-[#EEF5EF] text-[#2C5E32] border border-[#D0E4D3] text-xs font-bold flex items-center justify-between transition-all shadow-2xs disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet className="w-4 h-4 text-[#2C5E32]" />
                    <div className="text-left">
                      <div className="font-bold">匯出全校點名總表 (Excel)</div>
                      <div className="text-[10px] text-[#78786E] font-normal">
                        自動生成四個工作表並儲存至 Drive
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 text-[#2C5E32]" />
                </button>
              </div>

              {/* Local File Upload to Drive */}
              <div className="pt-2 border-t border-[#EAE7DE]">
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleUploadFileToDrive(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-3.5 rounded-xl border-2 border-dashed text-center cursor-pointer transition-all ${
                    isDragOver 
                      ? 'border-[#485945] bg-[#EEF5EF]' 
                      : 'border-[#DDDCD4] hover:border-[#485945] hover:bg-[#FAF9F5]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleUploadFileToDrive(e.target.files[0]);
                      }
                    }}
                  />
                  <CloudUpload className="w-5 h-5 text-[#78786E] mx-auto mb-1" />
                  <div className="text-xs font-bold text-[#2C2C2A]">上傳本機檔案至 Drive</div>
                  <div className="text-[10px] text-[#78786E] mt-0.5">
                    {isUploadingLocal ? '正在上傳中...' : '拖放或點擊選取 (.json, .xlsx)'}
                  </div>
                </div>
              </div>
            </div>

            {/* Google Drive App Folder Card */}
            <div className="bg-white rounded-2xl p-5 border border-[#E5E2DA] shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#EAE7DE]">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-[#1A73E8]" />
                  <h3 className="text-xs font-bold text-[#2C2C2A] uppercase tracking-wider">
                    Google Drive 專屬資料夾
                  </h3>
                </div>
                {appFolder?.webViewLink && (
                  <a
                    href={appFolder.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#1A73E8] hover:underline font-semibold flex items-center gap-0.5"
                  >
                    <span>在 Drive 開啟</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="bg-[#FAF9F5] p-3 rounded-xl border border-[#EAE7DE] space-y-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-[#1A73E8] shrink-0" />
                  <span className="text-xs font-bold text-[#2C2C2A] truncate">
                    {appFolder?.name || APP_DEFAULT_DRIVE_FOLDER}
                  </span>
                </div>
                <div className="text-[11px] text-[#78786E] leading-relaxed">
                  系統備份與導出的點名表格均自動歸類至此資料夾，便於學校老師於 Google 雲端集中管理與分享。
                </div>
              </div>

              {/* Current Local Snapshot Summary */}
              <div className="pt-2 text-xs text-[#606056] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span>目前活動小組：</span>
                  <strong className="text-[#2C2C2A]">{data.activityGroups.length} 組</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>目前學生總數：</span>
                  <strong className="text-[#2C2C2A]">{data.students.length} 人</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>目前點名記錄：</span>
                  <strong className="text-[#2C2C2A]">{data.attendanceRecords.length} 筆</strong>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Drive Files List & Management (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-[#E5E2DA] shadow-xs space-y-4">
              
              {/* Header & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EAE7DE]">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#485945]" />
                  <h3 className="text-sm font-bold text-[#2C2C2A]">
                    雲端檔案與備份清單 ({filteredFiles.length})
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#99998E] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜尋檔案名稱..."
                      className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] text-[#2C2C2A] focus:bg-white focus:ring-1 focus:ring-[#485945] w-40 sm:w-48"
                    />
                  </div>

                  {/* Refresh button */}
                  <button
                    onClick={() => token && loadDriveData(token)}
                    disabled={isLoadingFiles}
                    title="重新整理清單"
                    className="p-1.5 rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] hover:bg-[#EFEFEA] text-[#606056] transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Files Table / Cards */}
              {isLoadingFiles ? (
                <div className="py-12 text-center text-xs text-[#78786E] flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#485945]" />
                  <span>正在從 Google Drive 讀取備份檔案...</span>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#78786E] space-y-2">
                  <Cloud className="w-8 h-8 text-[#DDDCD4] mx-auto" />
                  <div className="font-bold text-[#4A4A42]">資料夾目前尚無備份檔案</div>
                  <p className="text-[11px] text-[#99998E]">
                    點擊左側「完整系統資料備份」或「匯出全校點名總表」即可建立第一份雲端存檔。
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#EAE7DE] overflow-hidden">
                  {filteredFiles.map((file) => {
                    const isJson = file.name.endsWith('.json') || file.mimeType === 'application/json';
                    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.mimeType.includes('spreadsheet');
                    
                    return (
                      <div
                        key={file.id}
                        className="py-3 px-2 hover:bg-[#FAF9F5] rounded-xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        {/* File Icon & Info */}
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isJson 
                              ? 'bg-[#EEF5EF] text-[#2C5E32] border border-[#D0E4D3]' 
                              : isExcel 
                              ? 'bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]' 
                              : 'bg-[#EFEFEA] text-[#606056] border border-[#DDDCD4]'
                          }`}>
                            {isJson ? (
                              <FileJson className="w-4 h-4" />
                            ) : isExcel ? (
                              <FileSpreadsheet className="w-4 h-4" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#2C2C2A] truncate" title={file.name}>
                                {file.name}
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold ${
                                isJson 
                                  ? 'bg-[#EEF5EF] text-[#2C5E32]' 
                                  : isExcel 
                                  ? 'bg-[#E6F4EA] text-[#137333]' 
                                  : 'bg-[#EFEFEA] text-[#606056]'
                              }`}>
                                {isJson ? 'JSON 備份' : isExcel ? 'Excel 報表' : '檔案'}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-[#78786E] mt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[#99998E]" />
                                <span>{new Date(file.modifiedTime).toLocaleString('zh-HK')}</span>
                              </span>
                              {file.size && (
                                <span className="font-mono text-[10px]">
                                  {formatBytes(file.size)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                          {/* Restore from JSON backup */}
                          {isJson && (
                            <button
                              onClick={() => handleStartRestore(file)}
                              title="從此 Google Drive 備份還原至系統"
                              className="px-2.5 py-1 bg-[#EEF5EF] hover:bg-[#D0E4D3] text-[#2C5E32] rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border border-[#D0E4D3]"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>還原</span>
                            </button>
                          )}

                          {/* Open in Drive */}
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="在 Google 雲端硬碟中開啟"
                              className="p-1.5 text-[#1A73E8] hover:bg-[#E8F0FE] rounded-lg transition-colors border border-[#D2E3FC]"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Download locally */}
                          <button
                            onClick={() => handleDownloadFileLocally(file)}
                            title="下載此檔案至本機"
                            className="p-1.5 text-[#606056] hover:text-[#2C2C2A] hover:bg-[#EFEFEA] rounded-lg transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete File */}
                          <button
                            onClick={() => setFileToDelete(file)}
                            title="自 Google Drive 刪除此檔案"
                            className="p-1.5 text-[#78786E] hover:text-[#8C3A3A] hover:bg-[#FDF0F0] rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Restore Confirmation Modal (Mandatory User Confirmation for Destructive/Overwrite Actions) */}
      {fileToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E5E2DA] space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FDF6ED] text-[#8C521E] border border-[#EED7B8] flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#2C2C2A]">確認自 Google Drive 還原備份？</h3>
                <p className="text-xs text-[#78786E]">請仔細核對即將載入的備份資料內容</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE7DE] space-y-2 text-xs text-[#4A4A42]">
              <div className="font-bold text-[#2C2C2A] truncate">
                檔案名稱：{fileToRestore.file.name}
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#EAE7DE]">
                <div className="bg-white p-2 rounded-lg border border-[#DDDCD4] text-center">
                  <span className="text-[10px] text-[#78786E] block">活動小組</span>
                  <strong className="text-sm text-[#485945]">{fileToRestore.parsedData.activityGroups?.length || 0} 組</strong>
                </div>
                <div className="bg-white p-2 rounded-lg border border-[#DDDCD4] text-center">
                  <span className="text-[10px] text-[#78786E] block">學生人數</span>
                  <strong className="text-sm text-[#485945]">{fileToRestore.parsedData.students?.length || 0} 人</strong>
                </div>
                <div className="bg-white p-2 rounded-lg border border-[#DDDCD4] text-center">
                  <span className="text-[10px] text-[#78786E] block">點名記錄</span>
                  <strong className="text-sm text-[#485945]">{fileToRestore.parsedData.attendanceRecords?.length || 0} 筆</strong>
                </div>
              </div>
              <p className="text-[11px] text-[#8C521E] font-medium pt-1">
                ⚠️ 注意：還原將會覆蓋當前系統中的所有活動、學生名冊與點名數據。
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAE7DE]">
              <button
                type="button"
                onClick={() => setFileToRestore(null)}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl border border-[#DDDCD4] text-xs font-semibold text-[#606056] hover:bg-[#EFEFEA]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="px-5 py-2 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                <span>{isRestoring ? '正在還原中...' : '確認覆蓋並還原'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Mandatory User Confirmation for Destructive Actions) */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E5E2DA] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FDF0F0] text-[#8C3A3A] border border-[#F5CCCC] flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#2C2C2A]">自 Google Drive 刪除檔案？</h3>
                <p className="text-xs text-[#78786E]">此操作將從您的 Google 雲端永久移除該檔案</p>
              </div>
            </div>

            <div className="p-3 bg-[#FAF9F5] rounded-xl border border-[#EAE7DE] text-xs font-bold text-[#2C2C2A] truncate">
              {fileToDelete.name}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAE7DE]">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-[#DDDCD4] text-xs font-semibold text-[#606056] hover:bg-[#EFEFEA]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-[#8C3A3A] hover:bg-[#782F2F] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isDeleting ? 'animate-spin' : ''}`} />
                <span>{isDeleting ? '正在刪除...' : '確定刪除檔案'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
