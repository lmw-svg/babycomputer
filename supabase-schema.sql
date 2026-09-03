-- ==============================================================================
-- 學校課外活動小組支援與點名管理系統 - Supabase 即時同步資料表建置腳本
-- ==============================================================================
-- 請在 Supabase 控制台 (Dashboard) -> 左側選單「SQL Editor」-> 貼上本段腳本並點擊「Run」
-- ==============================================================================

-- 1. 建立同步資料表
CREATE TABLE IF NOT EXISTS public.school_activities_sync (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at BIGINT NOT NULL,
    updated_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 啟用 Row Level Security (RLS)
ALTER TABLE public.school_activities_sync ENABLE ROW LEVEL SECURITY;

-- 3. 建立免登入存取政策（允許匿名 anon 金鑰讀取與寫入同步狀態）
CREATE POLICY "Allow public read access" 
ON public.school_activities_sync
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access" 
ON public.school_activities_sync
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access" 
ON public.school_activities_sync
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- 4. 開啟 Supabase Realtime 即時推播監聽
ALTER PUBLICATION supabase_realtime ADD TABLE public.school_activities_sync;

-- 5. 設定 REPLICA IDENTITY FULL 確保即時推播包含完整更新內容
ALTER TABLE public.school_activities_sync REPLICA IDENTITY FULL;
