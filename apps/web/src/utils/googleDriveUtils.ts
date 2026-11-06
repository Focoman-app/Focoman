/**
 * Google Drive URL Parser & Native Embed Preview Generator
 * Enables zero-server-bandwidth in-app preview using Google Drive's official embed endpoints
 * (/file/d/{id}/preview for files and /embeddedfolderview?id={id}#grid for folders).
 */

export interface ParsedGoogleDriveLink {
  isValidDriveUrl: boolean;
  id: string | null;
  kind: 'FILE' | 'FOLDER' | 'EXTERNAL';
  previewEmbedUrl: string | null;
  openUrl: string;
  canEmbedPreview: boolean;
}

export function parseGoogleDriveUrl(rawUrl: string): ParsedGoogleDriveLink {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return {
      isValidDriveUrl: false,
      id: null,
      kind: 'EXTERNAL',
      previewEmbedUrl: null,
      openUrl: '',
      canEmbedPreview: false,
    };
  }

  let normalizedUrl = trimmed;
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  try {
    const urlObj = new URL(normalizedUrl);
    const host = urlObj.hostname.toLowerCase();
    const isDriveHost =
      host.includes('drive.google.com') || host.includes('docs.google.com');

    if (!isDriveHost) {
      return {
        isValidDriveUrl: false,
        id: null,
        kind: 'EXTERNAL',
        previewEmbedUrl: null,
        openUrl: normalizedUrl,
        canEmbedPreview: false,
      };
    }

    // 1. Check Folder URL pattern: /drive/folders/{id} or /drive/u/0/folders/{id}
    const folderMatch = urlObj.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch && folderMatch[1]) {
      const folderId = folderMatch[1];
      return {
        isValidDriveUrl: true,
        id: folderId,
        kind: 'FOLDER',
        previewEmbedUrl: `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#grid`,
        openUrl: `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`,
        canEmbedPreview: true,
      };
    }

    // 2. Check File URL pattern: /file/d/{id} or /document/d/{id} or /presentation/d/{id}
    const fileMatch = urlObj.pathname.match(/\/(?:file|document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch && fileMatch[1]) {
      const fileId = fileMatch[1];
      return {
        isValidDriveUrl: true,
        id: fileId,
        kind: 'FILE',
        previewEmbedUrl: `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`,
        openUrl: `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`,
        canEmbedPreview: true,
      };
    }

    // 3. Check ?id={id} query parameter (e.g. drive.google.com/open?id=... or uc?id=...)
    const queryId = urlObj.searchParams.get('id');
    if (queryId && /^[a-zA-Z0-9_-]+$/.test(queryId)) {
      const isEmbeddedFolder = urlObj.pathname.includes('embeddedfolderview');
      if (isEmbeddedFolder) {
        return {
          isValidDriveUrl: true,
          id: queryId,
          kind: 'FOLDER',
          previewEmbedUrl: `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(queryId)}#grid`,
          openUrl: `https://drive.google.com/drive/folders/${encodeURIComponent(queryId)}`,
          canEmbedPreview: true,
        };
      }
      return {
        isValidDriveUrl: true,
        id: queryId,
        kind: 'FILE',
        previewEmbedUrl: `https://drive.google.com/file/d/${encodeURIComponent(queryId)}/preview`,
        openUrl: `https://drive.google.com/file/d/${encodeURIComponent(queryId)}/view`,
        canEmbedPreview: true,
      };
    }

    return {
      isValidDriveUrl: true,
      id: null,
      kind: 'EXTERNAL',
      previewEmbedUrl: null,
      openUrl: normalizedUrl,
      canEmbedPreview: false,
    };
  } catch {
    return {
      isValidDriveUrl: false,
      id: null,
      kind: 'EXTERNAL',
      previewEmbedUrl: null,
      openUrl: normalizedUrl,
      canEmbedPreview: false,
    };
  }
}
