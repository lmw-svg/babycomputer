import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
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

  // Local pending user edit tracking (prevents stale local cache from overriding cloud)
  private hasPendingLocalEdits: boolean = false;
  private lastLocalEditTime: number = 0;

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

    // 3. Initialize Firebase Firestore real-time listener and do immediate cloud pull
    try {
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      try {
        this.firestore = initializeFirestore(app, {
          ignoreUndefinedProperties: true,
        });
      } catch {
        this.firestore = getFirestore(app);
      }
      this.setupFirestoreListener();
      // Fetch immediately on startup to ensure mobile & all browsers show latest cloud data
      this.fetchInitialCloudState();
    } catch (e) {
      console.warn('Firebase Firestore initialization notice:', e);
      this.currentInfo.mode = 'broadcast';
    }
  }

  /**
   * Fetches the latest master cloud state from Firestore on page initialization.
   * Ensures new/existing devices immediately receive the freshest cloud data.
   */
  private async fetchInitialCloudState() {
    if (!this.firestore || !navigator.onLine) return;
    try {
      const docRef = doc(this.firestore, 'school_activities_system', 'shared_state');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const remoteData = snap.data();
        const remoteUpdatedAt = remoteData?.updatedAt || remoteData?.state?.lastUpdated || 0;
        if (remoteData?.state) {
          // If no unsaved local user edits occurred in this session, always adopt cloud data
          if (!this.hasPendingLocalEdits || remoteUpdatedAt >= this.lastLocalEditTime) {
            this.handleRemoteDataReceived(remoteData.state, 'firebase', remoteUpdatedAt);
          }
        }
      } else {
        // Cloud document does not exist yet; initialize cloud document with current local data
        const local = loadStoredData();
        await this.pushToFirestoreDirect(local, local.lastUpdated || Date.now());
      }
    } catch (err) {
      console.warn('Initial cloud fetch notice:', err);
    }
  }

  /**
   * Sets up continuous real-time Firestore listener (onSnapshot).
   * Automatically synchronizes updates made on PC Chrome to Mobile Safari, Edge, etc.
   */
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
            // Only adopt if update came from a different client
            if (remoteData?.updatedBy !== CLIENT_ID && remoteData?.state) {
              if (!this.hasPendingLocalEdits || remoteUpdatedAt >= this.lastLocalEditTime) {
                this.handleRemoteDataReceived(remoteData.state, 'firebase', remoteUpdatedAt);
              }
            }
          }
          this.currentInfo.mode = 'firebase';
          this.updateStatus('connected');
        },
        (error) => {
          console.warn('Firestore real-time listener notice:', error.message);
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

  /**
   * Sanitizes payload by stripping undefined values and circular references.
   */
  private sanitizeForFirestore(data: any): any {
    return JSON.parse(JSON.stringify(data, (key, value) => {
      return value === undefined ? null : value;
    }));
  }

  /**
   * Directly writes sanitized state to Firestore without auto-overwriting loops.
   */
  private async pushToFirestoreDirect(data: AppDataState, timestamp: number): Promise<boolean> {
    if (!this.firestore || !navigator.onLine) return false;
    try {
      const cleanData = this.sanitizeForFirestore(data);
      const docRef = doc(this.firestore, 'school_activities_system', 'shared_state');
      await setDoc(docRef, {
        state: cleanData,
        updatedAt: timestamp,
        updatedBy: CLIENT_ID,
      }, { merge: true });
      this.hasPendingLocalEdits = false;
      return true;
    } catch (err: any) {
      console.warn('Direct Firestore push notice:', err?.message || err);
      return false;
    }
  }

  /**
   * Applies incoming remote data from Firebase or BroadcastChannel into local state & React
   */
  private handleRemoteDataReceived(newData: AppDataState, source: 'firebase' | 'broadcast', incomingUpdatedAt?: number) {
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
   * Broadcasts to other open tabs and pushes to Cloud Firestore.
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

    // 2. Push to Firestore Cloud (debounced by 200ms to batch rapid UI typing/clicking)
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    this.syncDebounceTimer = setTimeout(async () => {
      const now = new Date();
      if (this.firestore && navigator.onLine) {
        const success = await this.pushToFirestoreDirect(payload, timestamp);
        if (success) {
          this.currentInfo.mode = 'firebase';
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
   * Triggers an immediate manual synchronization check (Pull from Cloud).
   * @param forcePull If true, overwrites any local cache with the latest cloud state.
   */
  public async syncWithCloud(forcePull: boolean = true): Promise<boolean> {
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
            if (forcePull || !this.hasPendingLocalEdits || remoteUpdatedAt >= this.lastLocalEditTime) {
              this.hasPendingLocalEdits = false;
              this.handleRemoteDataReceived(remoteData.state, 'firebase', remoteUpdatedAt);
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
   * Force pushes local data to cloud (overwrites cloud state with this device's data).
   */
  public async forcePushToCloud(data: AppDataState): Promise<boolean> {
    if (!this.firestore || !navigator.onLine) return false;
    this.updateStatus('syncing');
    try {
      const timestamp = Date.now();
      this.lastLocalEditTime = timestamp;
      this.hasPendingLocalEdits = false;
      const payload: AppDataState = { ...data, isInitialDefault: false, lastUpdated: timestamp };
      saveStoredData(payload);

      const success = await this.pushToFirestoreDirect(payload, timestamp);
      if (!success) {
        throw new Error('Firestore push returned false');
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

