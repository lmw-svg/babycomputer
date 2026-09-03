import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  Cloud, 
  Radio, 
  Activity, 
  Database,
  Info,
  X,
  ExternalLink,
  Zap,
  AlertCircle,
  KeyRound,
  Check,
  Copy
} from 'lucide-react';
import { 
  realtimeSync, 
  SyncInfo, 
  SyncStatus,
  DEFAULT_SUPABASE_URL,
  getEffectiveSupabaseAnonKey
} from '../services/realtimeSync';
import { loadStoredData } from '../utils/storage';

interface ConnectionStatusBarProps {
  onManualSyncRequest?: () => void;
}

export const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = ({
  onManualSyncRequest
}) => {
  const [syncInfo, setSyncInfo] = useState<SyncInfo>(() => realtimeSync.getSyncInfo());
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [showSyncSuccessToast, setShowSyncSuccessToast] = useState(false);
  const [lastSyncTimeFormatted, setLastSyncTimeFormatted] = useState<string>('剛剛');
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Dynamic Supabase configuration states
  const [inputAnonKey, setInputAnonKey] = useState<string>(() => getEffectiveSupabaseAnonKey());
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const PROJECT_ID = 'tabpwnrixevedhobdbsx';
  const PROJECT_URL = DEFAULT_SUPABASE_URL;

  // Subscribe to real-time sync manager status updates
  useEffect(() => {
    const unsubStatus = realtimeSync.subscribeStatus((info) => {
      setSyncInfo(info);
      if (info.lastSyncedAt) {
        setLastSyncTimeFormatted(formatTime(info.lastSyncedAt));
      }
    });

    // Subscribe to sync success events to trigger the green floating toast
    const unsubSuccess = realtimeSync.subscribeSyncSuccess((timestamp) => {
      setLastSyncTimeFormatted(formatTime(timestamp));
      setShowSyncSuccessToast(true);
      const timer = setTimeout(() => {
        setShowSyncSuccessToast(false);
      }, 3200);
      return () => clearTimeout(timer);
    });

    return () => {
      unsubStatus();
      unsubSuccess();
    };
  }, []);

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      if (onManualSyncRequest) {
        onManualSyncRequest();
      }
      await realtimeSync.syncWithCloud();
    } finally {
      setTimeout(() => {
        setIsManualSyncing(false);
      }, 500);
    }
  };

  const isConnected = syncInfo.status === 'connected';
  const isSyncing = syncInfo.status === 'syncing' || isManualSyncing;
  const isOffline = syncInfo.status === 'offline';

  return (
    <>
      {/* 1. Top Connection Status Bar above Navbar */}
      <div 
        id="realtime-connection-status-bar"
        className="w-full bg-[#364733] text-[#F5F7F4] text-[11px] font-medium border-b border-[#2C3B29] transition-colors relative z-30 no-print"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-3">
          
          {/* Left: Connection State with pulsating dot and badge */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#82D982] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#52C452]"></span>
                </span>
              ) : isSyncing ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F5A623] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F5A623]"></span>
                </span>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E06A6A]"></span>
              )}

              <span className="font-bold tracking-tight text-white flex items-center gap-1">
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-[#F5E6A3]" />
                    <span>資料即時同步中...</span>
                  </>
                ) : syncInfo.mode === 'supabase' && isConnected ? (
                  <>
                    <Wifi className="w-3 h-3 text-[#9EE69E]" />
                    <span>Supabase 雲端已連線</span>
                  </>
                ) : syncInfo.status === 'error' || syncInfo.errorMessage ? (
                  <>
                    <AlertCircle className="w-3 h-3 text-[#F5A623]" />
                    <span className="text-[#FFE58F]">單機離線模式 (待配置 Supabase)</span>
                  </>
                ) : isConnected ? (
                  <>
                    <Wifi className="w-3 h-3 text-[#D0E0CE]" />
                    <span>本機分頁同步中</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-[#F5A3A3]" />
                    <span>離線快取模式</span>
                  </>
                )}
              </span>
            </div>

            {/* Sync Mode Badges */}
            <div className="hidden md:flex items-center gap-1.5 text-[10px] text-[#D0E0CE]">
              <span className="inline-flex items-center gap-1 bg-[#2C3B29] px-2 py-0.5 rounded-full border border-[#445B41]">
                <Radio className="w-2.5 h-2.5 text-[#8CE38C]" />
                <span>分頁廣播通道</span>
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                syncInfo.mode === 'supabase'
                  ? 'bg-[#1C3822] border-[#2E6B39] text-[#A6FFB4]'
                  : 'bg-[#403322] border-[#66502E] text-[#FFE299]'
              }`}>
                <Database className="w-2.5 h-2.5" />
                <span>{syncInfo.mode === 'supabase' ? 'Supabase 雲端已連線' : 'Supabase 尚未連通'}</span>
              </span>
            </div>
          </div>

          {/* Right: Last Sync Time, Manual Sync Button, and Details Trigger */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            <span className="text-[#CCD8C7] text-[11px] hidden sm:inline">
              最後同步：<strong className="text-white font-mono">{lastSyncTimeFormatted}</strong>
            </span>

            {/* Manual Sync Trigger Button */}
            <button
              id="manual-sync-btn"
              onClick={handleManualSync}
              disabled={isSyncing}
              title="立即與雲端及其他開啟的視窗同步最新資料"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#485E44] hover:bg-[#567051] active:bg-[#3D523A] text-white text-[11px] font-semibold transition-all border border-[#5C7558] shadow-2xs disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-[#F5E6A3]' : ''}`} />
              <span>{isSyncing ? '同步中' : '立即同步'}</span>
            </button>

            {/* View Detail Modal Trigger */}
            <button
              onClick={() => setShowDetailModal(true)}
              title="查看實時連線與同步狀態詳情"
              className="text-[#CCD8C7] hover:text-white p-0.5 rounded hover:bg-[#485E44] transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Green Floating Toast Notification: 『資料已同步』 */}
      {showSyncSuccessToast && (
        <div 
          id="data-synced-floating-toast"
          className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-auto shadow-2xl"
          role="status"
          aria-live="polite"
        >
          <div className="bg-[#EEF5EF] border-2 border-[#52C452] text-[#1E4A23] px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 backdrop-blur-md">
            <div className="w-8 h-8 rounded-xl bg-[#52C452] text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-[#1E4A23] tracking-wide">資料已同步</span>
                <span className="text-[10px] font-mono font-bold bg-[#D4EAD6] text-[#2C5E32] px-1.5 py-0.2 rounded border border-[#B4DCB8]">
                  {lastSyncTimeFormatted}
                </span>
              </div>
              <p className="text-[11px] text-[#36683C] mt-0.5">
                全校活動、名冊及即時點名資料已實時更新就緒
              </p>
            </div>
            <button
              onClick={() => setShowSyncSuccessToast(false)}
              className="text-[#4F7F55] hover:text-[#1E4A23] p-1 rounded-lg hover:bg-[#DCECE0] transition-colors ml-1"
              title="關閉提示"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Detail Information Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C2C2A]/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#E5E2DA] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-[#FAF9F5] border-b border-[#E5E2DA] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#485945] text-white flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[#2C2C2A]">實時同步與連線狀態詳情</h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-[#78786E] hover:text-[#2C2C2A] p-1 rounded-lg hover:bg-[#EFEFEA]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-[#4A4A42]">
              <div className="p-3 bg-[#FAF9F5] rounded-xl border border-[#E5E2DA] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#78786E]">連線通道狀態</span>
                  {syncInfo.mode === 'supabase' ? (
                    <span className="font-bold text-[#2C5E32] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#52C452] inline-block animate-pulse"></span>
                      Supabase 雲端已連線 (全域即時同步)
                    </span>
                  ) : (
                    <span className="font-bold text-[#D97706] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#F59E0B] inline-block"></span>
                      單機/分頁模式 (Supabase 待連線)
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#78786E]">最後同步時間</span>
                  <span className="font-mono font-bold text-[#2C2C2A]">{lastSyncTimeFormatted}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#78786E]">雲端資料庫系統</span>
                  <span className="font-medium text-[#485945]">Supabase (PostgreSQL + Realtime)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#78786E]">同步機制</span>
                  <span className="font-medium text-[#485945]">
                    {syncInfo.mode === 'supabase' ? 'Supabase WebSocket 實時雙向推播' : '瀏覽器本機快取 (單機獨立儲存)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#78786E]">本機資料保護</span>
                  <span className="font-medium text-[#2C2C2A]">LocalStorage 本地即時防護</span>
                </div>
              </div>

              {/* Supabase Configuration & Quick Setup Card */}
              <div className="p-3.5 bg-white rounded-xl border border-[#E5E2DA] shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#2C2C2A]">
                    <KeyRound className="w-4 h-4 text-[#485945]" />
                    <span>Supabase 雲端連線設定 (專案 ID: {PROJECT_ID})</span>
                  </div>
                  <a
                    href={`https://supabase.com/dashboard/project/${PROJECT_ID}/settings/api`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#2563EB] hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>開啟 API 設定頁</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="space-y-2 text-[11.5px]">
                  <div>
                    <label className="block text-[11px] font-medium text-[#78786E] mb-1">
                      專案 URL (已自動綁定)
                    </label>
                    <div className="font-mono text-[11px] bg-[#FAF9F5] px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] text-[#485945] select-all">
                      {PROJECT_URL}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#78786E] mb-1">
                      anon public key (貼上後點擊「連線並啟用同步」)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="supabase-anon-key-input"
                        type="text"
                        value={inputAnonKey}
                        onChange={(e) => setInputAnonKey(e.target.value)}
                        placeholder="貼上 anon public key (例如 eyJhbGciOi...)"
                        className="flex-1 px-3 py-1.5 rounded-lg border border-[#D5D2C8] font-mono text-xs focus:ring-1 focus:ring-[#485945] focus:outline-none"
                      />
                      <button
                        id="save-supabase-config-btn"
                        disabled={isConfiguring || !inputAnonKey.trim()}
                        onClick={async () => {
                          setIsConfiguring(true);
                          setConfigFeedback(null);
                          const res = await realtimeSync.configureSupabase(PROJECT_URL, inputAnonKey);
                          setIsConfiguring(false);
                          if (res.success) {
                            setConfigFeedback({ type: 'success', message: '連線成功！資料已開始雙向實時同步。' });
                          } else {
                            setConfigFeedback({ type: 'error', message: res.message || '連線測試失敗，請檢查金鑰' });
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-semibold disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1"
                      >
                        {isConfiguring ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        <span>連線並同步</span>
                      </button>
                    </div>
                  </div>

                  {configFeedback && (
                    <div className={`p-2 rounded-lg text-xs flex items-center gap-1.5 ${
                      configFeedback.type === 'success' 
                        ? 'bg-[#EEF5EF] text-[#2C5E32] border border-[#CCD8C7]' 
                        : 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]'
                    }`}>
                      {configFeedback.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                      <span>{configFeedback.message}</span>
                    </div>
                  )}
                </div>
              </div>

              {syncInfo.mode !== 'supabase' ? (
                <div className="text-[11px] leading-relaxed bg-[#FFFBEB] p-3.5 rounded-xl border border-[#FDE68A] text-[#92400E] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <strong className="font-bold text-[#B45309] flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      專案 tabpwnrixevedhobdbsx 啟用步驟：
                    </strong>
                    <button
                      type="button"
                      onClick={() => {
                        const sql = `CREATE TABLE IF NOT EXISTS public.school_activities_sync (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at BIGINT NOT NULL,
    updated_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.school_activities_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON public.school_activities_sync FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.school_activities_sync FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.school_activities_sync FOR UPDATE USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.school_activities_sync;
ALTER TABLE public.school_activities_sync REPLICA IDENTITY FULL;`;
                        navigator.clipboard.writeText(sql);
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 2500);
                      }}
                      className="px-2 py-0.5 rounded bg-[#FDE68A] hover:bg-[#FCD34D] text-[#78350F] text-[10.5px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      {copiedSql ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSql ? '已複製建表 SQL' : '複製建表 SQL'}</span>
                    </button>
                  </div>

                  <div className="space-y-1 text-[11px] text-[#78350F]">
                    <div>
                      <strong>步驟 1. 執行 SQL 建表：</strong>
                      點擊上方「複製建表 SQL」，到{' '}
                      <a 
                        href={`https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#1E40AF] underline font-medium inline-flex items-center gap-0.5"
                      >
                        SQL Editor <ExternalLink className="w-2.5 h-2.5" />
                      </a>{' '}
                      貼上並按「Run」。
                    </div>
                    <div>
                      <strong>步驟 2. 取得 anon key：</strong>
                      前往{' '}
                      <a 
                        href={`https://supabase.com/dashboard/project/${PROJECT_ID}/settings/api`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#1E40AF] underline font-medium inline-flex items-center gap-0.5"
                      >
                        API 設定頁 <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                      ，在「Project API keys」複製 <code>anon public</code> 金鑰，貼回上方輸入框按「連線並同步」。
                    </div>
                    <div>
                      <strong>步驟 3. 部署至 Vercel (永久生效)：</strong>
                      在 Vercel 專案 Settings ➔ Environment Variables 新增：
                      <div className="bg-[#FEF3C7] p-1.5 rounded font-mono text-[10px] mt-1 text-[#1E40AF]">
                        <div>VITE_SUPABASE_URL = {PROJECT_URL}</div>
                        <div>VITE_SUPABASE_ANON_KEY = 貼上 anon 金鑰</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-[#78786E] leading-relaxed bg-[#EEF5EF] p-3 rounded-xl border border-[#CCD8C7] text-[#2C5E32]">
                  <strong className="block font-bold text-[#1E4A23] mb-0.5">💡 跨瀏覽器與手機/PC 即時同步已就緒：</strong>
                  系統已與 Supabase 專案 <code>{PROJECT_ID}</code> 成功連線。在任何電腦（Chrome / Edge / Safari）或手機進行點名、修改活動日期或學生名單時，所有連線裝置將在 0.3 秒內自動同步！
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-[#FAF9F5] border-t border-[#E5E2DA] flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  id="modal-pull-cloud-btn"
                  onClick={async () => {
                    setIsManualSyncing(true);
                    await realtimeSync.syncWithCloud(true);
                    setIsManualSyncing(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                  title="強制從 Supabase 雲端下載最新資料"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>從雲端重新整理</span>
                </button>
                <button
                  id="modal-push-cloud-btn"
                  onClick={async () => {
                    if (window.confirm('確定要將此裝置目前的資料覆蓋並上傳至雲端嗎？')) {
                      setIsManualSyncing(true);
                      await realtimeSync.forcePushToCloud(loadStoredData());
                      setIsManualSyncing(false);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#EFEFEA] hover:bg-[#E2E1D9] text-[#4A4A42] text-xs font-medium border border-[#DDDCD4] flex items-center gap-1 transition-colors"
                  title="將本機資料強制推送至 Supabase 雲端"
                >
                  <Cloud className="w-3.5 h-3.5 text-[#485945]" />
                  <span>上傳本機至雲端</span>
                </button>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[#2C2C2A] hover:bg-[#44443E] text-white text-xs font-semibold transition-colors"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
