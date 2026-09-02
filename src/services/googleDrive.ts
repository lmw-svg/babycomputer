// Google Drive REST API v3 Client Services

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  createdTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

export interface DriveStorageInfo {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
  usageInDriveTrash?: string;
  user?: {
    displayName: string;
    emailAddress: string;
    photoLink?: string;
  };
}

export const APP_DEFAULT_DRIVE_FOLDER = '學校課外活動系統_雲端備份';

/**
 * Fetch Google Drive storage quota and user profile info
 */
export async function getDriveStorageInfo(accessToken: string): Promise<DriveStorageInfo> {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/about?fields=user,storageQuota',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `無法讀取 Google Drive 儲存資訊 (${res.status})`);
  }

  const data = await res.json();
  return {
    limit: data.storageQuota?.limit,
    usage: data.storageQuota?.usage,
    usageInDrive: data.storageQuota?.usageInDrive,
    usageInDriveTrash: data.storageQuota?.usageInDriveTrash,
    user: data.user,
  };
}

/**
 * Find or automatically create the dedicated application backup folder in Google Drive
 */
export async function findOrCreateAppFolder(
  accessToken: string,
  folderName: string = APP_DEFAULT_DRIVE_FOLDER
): Promise<{ id: string; name: string; webViewLink?: string }> {
  // Search for existing folder
  const query = encodeURIComponent(
    `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`
  );
  
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&pageSize=1`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!searchRes.ok) {
    const err = await searchRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `搜尋 Google Drive 資料夾失敗 (${searchRes.status})`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0];
  }

  // Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: '學校課外活動小組支援與點名管理系統 - 雲端備份與報表資料夾',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `建立 Google Drive 資料夾失敗 (${createRes.status})`);
  }

  return await createRes.json();
}

/**
 * List files in the Google Drive app folder or root
 */
export async function listDriveFiles(
  accessToken: string,
  folderId?: string,
  searchQuery?: string
): Promise<DriveFileItem[]> {
  let query = 'trashed = false';
  
  if (folderId) {
    query += ` and '${folderId}' in parents`;
  }

  if (searchQuery && searchQuery.trim()) {
    const cleanSearch = searchQuery.trim().replace(/'/g, "\\'");
    query += ` and name contains '${cleanSearch}'`;
  }

  const fields = 'files(id,name,mimeType,size,modifiedTime,createdTime,webViewLink,webContentLink,iconLink,thumbnailLink)';
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&fields=${fields}&orderBy=modifiedTime desc&pageSize=100`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `讀取 Google Drive 檔案清單失敗 (${res.status})`);
  }

  const data = await res.json();
  return (data.files || []).filter((f: DriveFileItem) => f.mimeType !== 'application/vnd.google-apps.folder');
}

/**
 * Upload JSON backup to Google Drive using multipart upload
 */
export async function uploadJsonToDrive(
  accessToken: string,
  fileName: string,
  jsonData: any,
  folderId?: string
): Promise<DriveFileItem> {
  const metadata: Record<string, any> = {
    name: fileName,
    mimeType: 'application/json',
    description: `學校課外活動系統備份 - 產生時間: ${new Date().toLocaleString('zh-HK')}`,
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const jsonString = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2);
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonString +
    closeDelimiter;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `上傳備份至 Google Drive 失敗 (${res.status})`);
  }

  return await res.json();
}

/**
 * Upload Binary Blob (e.g. Excel .xlsx) to Google Drive
 */
export async function uploadBlobToDrive(
  accessToken: string,
  fileName: string,
  blob: Blob,
  mimeType: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  folderId?: string
): Promise<DriveFileItem> {
  const metadata: Record<string, any> = {
    name: fileName,
    mimeType: mimeType,
    description: `學校課外活動系統報表 - 產生時間: ${new Date().toLocaleString('zh-HK')}`,
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' })
  );
  form.append('file', blob);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `上傳檔案至 Google Drive 失敗 (${res.status})`);
  }

  return await res.json();
}

/**
 * Download file content directly from Google Drive
 */
export async function downloadDriveFileContent(
  accessToken: string,
  fileId: string
): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `下載 Google Drive 檔案內容失敗 (${res.status})`);
  }

  return await res.text();
}

/**
 * Download binary file blob (for Excel / images etc)
 */
export async function downloadDriveFileBlob(
  accessToken: string,
  fileId: string
): Promise<Blob> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `下載 Google Drive 檔案失敗 (${res.status})`);
  }

  return await res.blob();
}

/**
 * Delete a file from Google Drive (MUST be confirmed by user in UI first)
 */
export async function deleteDriveFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `自 Google Drive 刪除檔案失敗 (${res.status})`);
  }
}

/**
 * Format bytes to readable size
 */
export function formatBytes(bytes?: string | number): string {
  if (!bytes) return '0 B';
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(num) || num === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${parseFloat((num / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
