import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { AppDataState } from '../types';
import { loadStoredData, saveStoredData } from '../utils/storage';

export type SyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

export interface SyncInfo {
  status: SyncStatus;
  lastSyncedAt: Date | null;
  mode: 'supabase' | 'broadcast' | 'local';
  activeClientsCount: number;
  errorMessage?: string;
  isConfigured: boolean;
}

// Client Unique Session ID to avoid echo loops
const CLIENT_ID = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const BROADCAST_CHANNEL_NAME = 'school_activities_realtime_channel';

// Project-specific Supabase URL preconfigured from Project ID: tabpwnrixevedhobdbsx
export const DEFAULT_SUPABASE_URL = 'https://tabpwnrixevedhobdbsx.supabase.co';

export function getEffectiveSupabaseUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('school_activities_supabase_url');
    if (custom) return custom.trim();
  }
  return (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
}

export function getEffectiveSupabaseAnonKey(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('school_activities_supabase_anon_key');
    if (custom) return custom.trim();
  }
  return (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
}

class RealtimeSyncManager {
  private supabase: SupabaseClient | null = null;
  private supabaseChannel: RealtimeChannel | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private listeners: Set<(info: SyncInfo) => void> = new Set();
  private dataListeners: Set<(data: AppDataState) => void> = new Set();
  private syncSuccessListeners: Set<(timestamp: Date) => void> = new Set();

  // Local pending user edit tracking (prevents stale local cache from overriding cloud)
  private hasPendingLocalEdits: boolean = false;
  private lastLocalEditTime: number = 0;

  private currentInfo: SyncInfo = {
    status: 'connected',
    lastSyncedAt: new Date(),
    mode: 'broadcast',
    activeClientsCount: 1,
    isConfigured: !!(getEffectiveSupabaseUrl() && getEffectiveSupabaseAnonKey()),
  };

  private isInternalUpdate = false;
  private syncDebounceTimer: any = null;

  constructor() {
    this.init();
  }

  private init() {
    // 1. Initialize Network Status listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.updateStatus('connected');
        this.syncWithCloud(true);
      });

      window.addEventListener('offline', () => {
        this.updateStatus('offline', '網路離線，已啟用本地快取保護');
      });

      if (!navigator.onLine) {
        this.currentInfo.status = 'offline';
      }
    }

    // 2. Initialize BroadcastChannel for cross-tab realtime sync (same browser)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          const { type, senderId, payload, timestamp } = event.data || {};
          if (senderId === CLIENT_ID) return; // Skip own messages

          if (type === 'DATA_UPDATE' && payload) {
            const incomingTimestamp = timestamp || payload.lastUpdated || Date.now();
            this.handleRemoteDataReceived(payload, 'broadcast', incomingTimestamp);
          } else if (type === 'PING') {
            this.broadcastChannel?.postMessage({
              type: 'PONG',
              senderId: CLIENT_ID,
            });
          }
        };

        // Ping to count other open windows/tabs
        this.broadcastChannel.postMessage({ type: 'PING', senderId: CLIENT_ID });
      } catch (e) {
        console.warn('BroadcastChannel not available:', e);
      }
    }

    // 3. Initialize Supabase Realtime Client if configured
    this.initSupabase();
  }

  private initSupabase() {
    const url = getEffectiveSupabaseUrl();
    const anonKey = getEffectiveSupabaseAnonKey();

    if (!url || !anonKey) {
      this.currentInfo.isConfigured = false;
      this.currentInfo.mode = 'broadcast';
      this.currentInfo.errorMessage = '尚未設定 Supabase anon key (專案 ID 已設定為 tabpwnrixevedhobdbsx)';
      this.updateStatus('offline');
      return;
    }

    try {
      this.supabase = createClient(url, anonKey, {
        auth: {
          persistSession: false,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });

      this.currentInfo.isConfigured = true;
      this.setupSupabaseListener();
      this.fetchInitialCloudState();
    } catch (err: any) {
      console.warn('Supabase initialization error:', err);
      this.currentInfo.mode = 'broadcast';
      this.currentInfo.errorMessage = `Supabase 初始化失敗: ${err?.message || err}`;
      this.updateStatus('error');
    }
  }

  /**
   * Dynamically configures or updates Supabase connection credentials in the browser
   */
  public async configureSupabase(url: string, anonKey: string): Promise<{ success: boolean; message?: string }> {
    const cleanUrl = (url || DEFAULT_SUPABASE_URL).trim();
    const cleanKey = anonKey.trim();

    if (!cleanKey) {
      return { success: false, message: '請提供 Supabase anon key' };
    }

    try {
      localStorage.setItem('school_activities_supabase_url', cleanUrl);
      localStorage.setItem('school_activities_supabase_anon_key', cleanKey);

      // Cleanup existing channel
      if (this.supabaseChannel) {
        this.supabaseChannel.unsubscribe();
        this.supabaseChannel = null;
      }

      this.supabase = createClient(cleanUrl, cleanKey, {
        auth: { persistSession: false },
        realtime: { params: { eventsPerSecond: 10 } },
      });

      this.currentInfo.isConfigured = true;
      this.setupSupabaseListener();
      await this.fetchInitialCloudState();
      this.updateStatus('connected');

      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message || '連線測試失敗' };
    }
  }

  /**
   * Sets up Supabase postgres_changes Realtime subscription
   */
  private setupSupabaseListener() {
    if (!this.supabase) return;

    try {
      this.supabaseChannel = this.supabase
        .channel('school_activities_realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'school_activities_sync',
            filter: 'id=eq.shared_state',
          },
          (payload) => {
            const row = payload.new as any;
            if (row && row.updated_by !== CLIENT_ID && row.data) {
              const remoteUpdatedAt = Number(row.updated_at) || row.data?.lastUpdated || 0;
              if (!this.hasPendingLocalEdits || remoteUpdatedAt >= this.lastLocalEditTime) {
                this.handleRemoteDataReceived(row.data, 'supabase', remoteUpdatedAt);
              }
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            this.currentInfo.mode = 'supabase';
            this.currentInfo.errorMessage = undefined;
            this.updateStatus('connected');
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('Supabase Realtime Channel error:', err);
            this.currentInfo.errorMessage = 'Supabase 即時通道錯誤，請確認資料表 school_activities_sync 是否已建立及啟用 Realtime';
            this.updateStatus('error');
          }
        });
    } catch (e: any) {
      console.warn('Failed to subscribe to Supabase Realtime channel:', e);
      this.currentInfo.errorMessage = e?.message || 'Supabase 訂閱失敗';
      this.updateStatus('error');
    }
  }

  /**
   * Fetches the latest master cloud state from Supabase on page initialization
   */
  private async fetchInitialCloudState() {
    if (!this.supabase || !navigator.onLine) return;

    try {
      const { data, error } = await this.supabase
        .from('school_activities_sync')
        .select('*')
        .eq('id', 'shared_state')
        .maybeSingle();

      if (error) {
        console.warn('Supabase fetch initial state notice:', error.message);
        if (error.code === '42P01') {
          this.currentInfo.errorMessage = 'Supabase 資料表 school_activities_sync 尚未建立，請至 SQL Editor 執行建表指令';
        } else {
          this.currentInfo.errorMessage = `Supabase 讀取錯誤: ${error.message}`;
        }
        return;
      }

      if (data && data.data) {
        const remoteUpdatedAt = Number(data.updated_at) || data.data?.lastUpdated || 0;
        if (!this.hasPendingLocalEdits || remoteUpdatedAt >= this.lastLocalEditTime) {
          this.handleRemoteDataReceived(data.data, 'supabase', remoteUpdatedAt);
        }
      } else {
        // Document does not exist yet on Supabase, push current local data to initialize
        const local = loadStoredData();
        await this.pushToSupabaseDirect(local, local.lastUpdated || Date.now());
      }
    } catch (err: any) {
      console.warn('Initial Supabase fetch error:', err);
    }
  }

  /**
   * Sanitizes payload by stripping undefined values and circular references
   */
  private sanitizeData(data: any): any {
    return JSON.parse(JSON.stringify(data, (key, value) => {
      return value === undefined ? null : value;
    }));
  }

  /**
   * Directly writes state to Supabase table
   */
  private async pushToSupabaseDirect(data: AppDataState, timestamp: number): Promise<boolean> {
    if (!this.supabase || !navigator.onLine) return false;
    try {
      const cleanData = this.sanitizeData(data);
      const { error } = await this.supabase
        .from('school_activities_sync')
        .upsert({
          id: 'shared_state',
          data: cleanData,
          updated_at: timestamp,
          updated_by: CLIENT_ID,
        }, { onConflict: 'id' });

      if (error) {
        console.warn('Supabase push error:', error.message);
        this.currentInfo.errorMessage = `Supabase 儲存失敗: ${error.message}`;
        return false;
      }

      this.hasPendingLocalEdits = false;
      this.currentInfo.errorMessage = undefined;
      return true;
    } catch (err: any) {
      console.warn('Direct Supabase push notice:', err?.message || err);
      return false;
    }
  }

  /**
   * Applies incoming remote data from Supabase or BroadcastChannel into local state & React
   */
  private handleRemoteDataReceived(newData: AppDataState, source: 'supabase' | 'broadcast', incomingUpdatedAt?: number) {
    if (this.isInternalUpdate) return;

    // Check if this device has pending local user edits newer than incoming
    if (this.hasPendingLocalEdits && incomingUpdatedAt && incomingUpdatedAt < this.lastLocalEditTime) {
      return;
    }

    this.isInternalUpdate = true;
    try {
      const timestamp = incomingUpdatedAt || newData.lastUpdated || Date.now();
      const dataToSave: AppDataState = {
        ...newData,
        isInitialDefault: false,
        lastUpdated: timestamp,
      };

      saveStoredData(dataToSave);
      const now = new Date();
      this.currentInfo.lastSyncedAt = now;
      this.currentInfo.mode = source;
      this.updateStatus('connected');

      // Notify React subscribers
      this.dataListeners.forEach((listener) => listener(dataToSave));
      // Notify visual sync banner
      this.notifySyncSuccess(now);
    } finally {
      setTimeout(() => {
        this.isInternalUpdate = false;
      }, 50);
    }
  }

  /**
   * Called by App when data is modified by the user locally.
   * Broadcasts to other open tabs and pushes to Supabase Cloud.
   */
  public broadcastDataUpdate(newData: AppDataState) {
    if (this.isInternalUpdate) return;

    const timestamp = Date.now();
    this.hasPendingLocalEdits = true;
    this.lastLocalEditTime = timestamp;
    this.updateStatus('syncing');

    const payload: AppDataState = {
      ...newData,
      isInitialDefault: false,
      lastUpdated: timestamp,
    };

    // 1. Send via local BroadcastChannel immediately for sibling tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'DATA_UPDATE',
          senderId: CLIENT_ID,
          payload,
          timestamp,
        });
      } catch (e) {
        console.warn('BroadcastChannel post error:', e);
      }
    }

    // 2. Push to Supabase Cloud (debounced by 200ms to batch rapid UI changes)
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    this.syncDebounceTimer = setTimeout(async () => {
      const now = new Date();
      if (this.supabase && navigator.onLine) {
        const success = await this.pushToSupabaseDirect(payload, timestamp);
        if (success) {
          this.currentInfo.mode = 'supabase';
        } else {
          this.currentInfo.mode = 'broadcast';
        }
      }

      this.currentInfo.lastSyncedAt = now;
      this.updateStatus('connected');
      this.notifySyncSuccess(now);
    }, 200);
  }

  /**
   * Triggers an immediate manual synchronization check (Pull from Supabase Cloud)
   */
  public async syncWithCloud(forcePull: boolean = true): Promise<boolean> {
    this.updateStatus('syncing');
    const now = new Date();

    try {
      if (this.supabase && navigator.onLine) {
        const { data, error } = await this.supabase
          .from('school_activities_sync')
          .select('*')
          .eq('id', 'shared_state')
          .maybeSingle();

        if (!error && data && data.data) {
          const remoteUpdatedAt = Number(data.updated_at) || data.data?.lastUpdated || 0;
          if (forcePull || !this.hasPendingLocalEdits || remoteUpdatedAt >= this.lastLocalEditTime) {
            this.hasPendingLocalEdits = false;
            this.handleRemoteDataReceived(data.data, 'supabase', remoteUpdatedAt);
          }
        }
      }

      // Ping sibling tabs via broadcast channel
      this.broadcastChannel?.postMessage({ type: 'PING', senderId: CLIENT_ID });

      this.currentInfo.lastSyncedAt = now;
      this.updateStatus('connected');
      this.notifySyncSuccess(now);
      return true;
    } catch (e) {
      console.warn('Sync refresh notice:', e);
      this.currentInfo.lastSyncedAt = now;
      this.updateStatus(navigator.onLine ? 'connected' : 'offline');
      this.notifySyncSuccess(now);
      return false;
    }
  }

  /**
   * Force pushes local data to cloud (overwrites cloud state with this device's data).
   */
  public async forcePushToCloud(data: AppDataState): Promise<boolean> {
    this.updateStatus('syncing');
    try {
      const timestamp = Date.now();
      this.lastLocalEditTime = timestamp;
      this.hasPendingLocalEdits = false;
      const payload: AppDataState = { ...data, isInitialDefault: false, lastUpdated: timestamp };
      saveStoredData(payload);

      if (this.supabase && navigator.onLine) {
        const success = await this.pushToSupabaseDirect(payload, timestamp);
        if (!success) {
          throw new Error('Supabase push returned false');
        }
      }

      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'DATA_UPDATE',
          senderId: CLIENT_ID,
          payload,
          timestamp,
        });
      }

      const now = new Date();
      this.currentInfo.lastSyncedAt = now;
      this.currentInfo.mode = this.supabase ? 'supabase' : 'broadcast';
      this.updateStatus('connected');
      this.notifySyncSuccess(now);
      return true;
    } catch (e: any) {
      console.error('Force push to cloud failed:', e);
      this.updateStatus('error', `上傳至雲端失敗: ${e?.message || e}`);
      return false;
    }
  }

  private updateStatus(status: SyncStatus, errorMessage?: string) {
    this.currentInfo = {
      ...this.currentInfo,
      status,
      errorMessage: errorMessage ?? this.currentInfo.errorMessage,
    };
    this.listeners.forEach((cb) => cb({ ...this.currentInfo }));
  }

  private notifySyncSuccess(timestamp: Date) {
    this.syncSuccessListeners.forEach((cb) => cb(timestamp));
  }

  public subscribeStatus(callback: (info: SyncInfo) => void): () => void {
    this.listeners.add(callback);
    callback({ ...this.currentInfo });
    return () => {
      this.listeners.delete(callback);
    };
  }

  public subscribeDataUpdates(callback: (data: AppDataState) => void): () => void {
    this.dataListeners.add(callback);
    return () => {
      this.dataListeners.delete(callback);
    };
  }

  public subscribeSyncSuccess(callback: (timestamp: Date) => void): () => void {
    this.syncSuccessListeners.add(callback);
    return () => {
      this.syncSuccessListeners.delete(callback);
    };
  }

  public getSyncInfo(): SyncInfo {
    return { ...this.currentInfo };
  }

  public cleanup() {
    if (this.supabaseChannel) {
      this.supabaseChannel.unsubscribe();
      this.supabaseChannel = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
  }
}

export const realtimeSync = new RealtimeSyncManager();

