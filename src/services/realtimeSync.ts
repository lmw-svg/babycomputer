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
            this.handleRemoteDataReceived(payload, 'broadcast');
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

    // 3. Initialize Firebase Firestore real-time listener
    try {
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      this.firestore = getFirestore(app);
      this.setupFirestoreListener();
    } catch (e) {
      console.warn('Firebase Firestore initialization notice:', e);
      this.currentInfo.mode = 'broadcast';
    }

    // 4. Window storage event fallback
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('school_activities_system')) {
          try {
            const parsed = loadStoredData();
            this.handleRemoteDataReceived(parsed, 'broadcast');
          } catch (err) {
            console.error('Storage sync error:', err);
          }
        }
      });
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
            if (remoteData?.updatedBy !== CLIENT_ID && remoteData?.state) {
              this.handleRemoteDataReceived(remoteData.state, 'firebase');
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

  private handleRemoteDataReceived(newData: AppDataState, source: 'firebase' | 'broadcast') {
    if (this.isInternalUpdate) return;

    this.isInternalUpdate = true;
    try {
      saveStoredData(newData);
      const now = new Date();
      this.currentInfo.lastSyncedAt = now;
      this.currentInfo.mode = source;
      this.updateStatus('connected');

      // Notify data listeners in React
      this.dataListeners.forEach((listener) => listener(newData));
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

    this.updateStatus('syncing');

    // 1. Send via local BroadcastChannel immediately
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'DATA_UPDATE',
          senderId: CLIENT_ID,
          payload: newData,
          timestamp: Date.now(),
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
            state: newData,
            updatedAt: Date.now(),
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
    }, 400);
  }

  /**
   * Triggers an immediate manual synchronization check
   */
  public async syncWithCloud(): Promise<boolean> {
    this.updateStatus('syncing');
    const now = new Date();

    try {
      if (this.firestore && navigator.onLine) {
        const docRef = doc(this.firestore, 'school_activities_system', 'shared_state');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const remoteData = snap.data();
          if (remoteData?.state) {
            this.handleRemoteDataReceived(remoteData.state, 'firebase');
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
