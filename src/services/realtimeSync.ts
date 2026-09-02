import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  setDoc, 
  getDoc,
  Firestore 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppDataState } from '../types';
import { loadStoredData, saveStoredData } from '../utils/storage';

export type SyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

export interface SyncInfo {
  status: SyncStatus;
  lastSyncedAt: Date | null;
  mode: 'firebase' | 'broadcast' | 'local';
  activeClientsCount: number;
  errorMessage?: string;
}

// Client Unique Session ID to avoid echo loops
const CLIENT_ID = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const BROADCAST_CHANNEL_NAME = 'school_activities_realtime_channel';

class RealtimeSyncManager {
  private firestore: Firestore | null = null;
  private unsubscribeFirestore: (() => void) | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private listeners: Set<(info: SyncInfo) => void> = new Set();
  private dataListeners: Set<(data: AppDataState) => void> = new Set();
  private syncSuccessListeners: Set<(timestamp: Date) => void> = new Set();

  private isLocalDefault: boolean = false;
  private localLastUpdated: number = 0;

  private currentInfo: SyncInfo = {
    status: 'connected',
    lastSyncedAt: new Date(),
    mode: 'broadcast',
    activeClientsCount: 1,
  };

  private isInternalUpdate = false;
  private syncDebounceTimer: any = null;

  constructor() {
    this.init();
  }

  private init() {
    // Read initial local timestamp and default state flag
    try {
      const initialLocal = loadStoredData();
      this.isLocalDefault = !!(initialLocal.isInitialDefault || !initialLocal.lastUpdated);
      this.localLastUpdated = initialLocal.lastUpdated || 0;
    } catch (e) {
      this.isLocalDefault = true;
      this.localLastUpdated = 0;
    }

    // 1. Initialize Network Status listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.updateStatus('connected');
        this.syncWithCloud();
      });

      window.addEventListener('offline', () => {
        this.updateStatus('offline', '網路離線，已啟用本地快取保護');
      });

      if (!navigator.onLine) {
        this.currentInfo.status = 'offline';
      }
    }

    // 2. Initialize BroadcastChannel for cross-tab realtime sync
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

    // 3. Initialize Firebase Firestore real-time listener and do immediate cloud pull
    try {
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      this.firestore = getFirestore(app);
      this.setupFirestoreListener();
      // Fetch immediately on startup
      this.fetchInitialCloudState();
    } catch (e) {
      console.warn('Firebase Firestore initialization notice:', e);
      this.currentInfo.mode = 'broadcast';
    }
  }

  private async fetchInitialCloudState() {
    if (!this.firestore || !navigator.onLine) return;
    try {
      const docRef = doc(this.firestore, 'school_activities_system', 'shared_state');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const remoteData = snap.data();
        const remoteUpdatedAt = remoteData?.updatedAt || remoteData?.state?.lastUpdated || 0;
        if (remoteData?.state) {
          if (this.isLocalDefault || remoteUpdatedAt >= this.localLastUpdated) {
            this.handleRemoteDataReceived(remoteData.state, 'firebase', remoteUpdatedAt);
            this.isLocalDefault = false;
          }
        }
      } else {
        // Cloud document does not exist yet, seed initial data to cloud
        this.broadcastDataUpdate(loadStoredData());
      }
    } catch (err) {
      console.warn('Initial cloud fetch notice:', err);
    }
  }

  private setupFirestoreListener() {
    if (!this.firestore) return;

    try {
      const docRef = doc(this.firestore, 'school_activities_system', 'shared_state');
      this.unsubscribeFirestore = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const remoteData = docSnap.data();
            const remoteUpdatedAt = remoteData?.updatedAt || remoteData?.state?.lastUpdated || 0;
            if (remoteData?.updatedBy !== CLIENT_ID && remoteData?.state) {
              // If local state was only default template OR if remote is newer or equal:
              if (this.isLocalDefault || remoteUpdatedAt >= this.localLastUpdated) {
                this.handleRemoteDataReceived(remoteData.state, 'firebase', remoteUpdatedAt);
                this.isLocalDefault = false;
              } else if (this.localLastUpdated > remoteUpdatedAt + 2000 && !this.isLocalDefault) {
                // If local data is genuinely newer from actual user edits on this device, sync to cloud
                this.broadcastDataUpdate(loadStoredData());
              }
            }
          } else {
            // First time cloud initialization
            if (!this.isLocalDefault) {
              this.broadcastDataUpdate(loadStoredData());
            }
          }
          this.currentInfo.mode = 'firebase';
          this.updateStatus('connected');
        },
        (error) => {
          // If Firestore permissions or network restriction, fallback gracefully to BroadcastChannel
          console.warn('Firestore real-time listener fallback:', error.message);
          this.currentInfo.mode = 'broadcast';
          if (navigator.onLine) {
            this.updateStatus('connected');
          }
        }
      );
    } catch (e) {
      console.warn('Failed to attach Firestore snapshot listener:', e);
      this.currentInfo.mode = 'broadcast';
    }
  }

  private handleRemoteDataReceived(newData: AppDataState, source: 'firebase' | 'broadcast', incomingUpdatedAt?: number) {
    if (this.isInternalUpdate) return;

    // Check if incoming is older than genuine local user edits
    if (!this.isLocalDefault && incomingUpdatedAt && incomingUpdatedAt < this.localLastUpdated) {
      return;
    }

    this.isInternalUpdate = true;
    try {
      this.isLocalDefault = false;
      this.localLastUpdated = incomingUpdatedAt || newData.lastUpdated || Date.now();
      const dataToSave = { ...newData, isInitialDefault: false, lastUpdated: this.localLastUpdated };
      saveStoredData(dataToSave);
      const now = new Date();
      this.currentInfo.lastSyncedAt = now;
      this.currentInfo.mode = source;
      this.updateStatus('connected');

      // Notify data listeners in React
      this.dataListeners.forEach((listener) => listener(dataToSave));
      // Notify sync success for floating banner
      this.notifySyncSuccess(now);
    } finally {
      setTimeout(() => {
        this.isInternalUpdate = false;
      }, 100);
    }
  }

  /**
   * Called by App when data is modified locally.
   * Broadcasts to other open tabs and syncs to Cloud Firestore.
   */
  public broadcastDataUpdate(newData: AppDataState) {
    if (this.isInternalUpdate) return;

    this.isLocalDefault = false;
    const timestamp = newData.lastUpdated || Date.now();
    this.localLastUpdated = timestamp;
    this.updateStatus('syncing');

    const payload = { ...newData, isInitialDefault: false, lastUpdated: timestamp };

    // 1. Send via local BroadcastChannel immediately
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

    // 2. Debounce Firestore Cloud push to prevent rapid burst writes
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    this.syncDebounceTimer = setTimeout(async () => {
      const now = new Date();
      if (this.firestore && navigator.onLine) {
        try {
          const docRef = doc(this.firestore, 'school_activities_system', 'shared_state');
          await setDoc(docRef, {
            state: payload,
            updatedAt: timestamp,
            updatedBy: CLIENT_ID,
          }, { merge: true });
          this.currentInfo.mode = 'firebase';
        } catch (err: any) {
          console.warn('Cloud sync push notice (local cache active):', err?.message || err);
          this.currentInfo.mode = 'broadcast';
        }
      }

      this.currentInfo.lastSyncedAt = now;
      this.updateStatus('connected');
      this.notifySyncSuccess(now);
    }, 300);
  }

  /**
   * Triggers an immediate manual synchronization check (Pull from Cloud)
   */
  public async syncWithCloud(forcePull: boolean = false): Promise<boolean> {
    this.updateStatus('syncing');
    const now = new Date();

    try {
      if (this.firestore && navigator.onLine) {
        const docRef = doc(this.firestore, 'school_activities_system', 'shared_state');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const remoteData = snap.data();
          const remoteUpdatedAt = remoteData?.updatedAt || remoteData?.state?.lastUpdated || 0;
          if (remoteData?.state) {
            if (forcePull || this.isLocalDefault || remoteUpdatedAt >= this.localLastUpdated) {
              this.handleRemoteDataReceived(remoteData.state, 'firebase', remoteUpdatedAt);
              this.isLocalDefault = false;
            }
          }
        }
      }

      // Ping broadcast channel
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
   * Force pushes local data to cloud (overwrites cloud state)
   */
  public async forcePushToCloud(data: AppDataState): Promise<boolean> {
    if (!this.firestore || !navigator.onLine) return false;
    this.updateStatus('syncing');
    try {
      const timestamp = Date.now();
      this.localLastUpdated = timestamp;
      this.isLocalDefault = false;
      const payload = { ...data, isInitialDefault: false, lastUpdated: timestamp };
      saveStoredData(payload);

      const docRef = doc(this.firestore, 'school_activities_system', 'shared_state');
      await setDoc(docRef, {
        state: payload,
        updatedAt: timestamp,
        updatedBy: CLIENT_ID,
      }, { merge: true });

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
      this.currentInfo.mode = 'firebase';
      this.updateStatus('connected');
      this.notifySyncSuccess(now);
      return true;
    } catch (e) {
      console.error('Force push to cloud failed:', e);
      this.updateStatus('error', '上傳至雲端失敗');
      return false;
    }
  }

  private updateStatus(status: SyncStatus, errorMessage?: string) {
    this.currentInfo = {
      ...this.currentInfo,
      status,
      errorMessage,
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
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
      this.unsubscribeFirestore = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
  }
}

export const realtimeSync = new RealtimeSyncManager();
