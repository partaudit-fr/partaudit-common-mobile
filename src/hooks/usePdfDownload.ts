// Cross-app PDF download / preview / share. The mobile-pro and
// mobile-client apps both reach the same /v2/deviation-reports/{id}/pdf
// style endpoints, which can return:
//   - direct application/pdf
//   - gRPC-gateway JSON wrapper: { contentType, data (base64) }
//   - raw base64
//
// Original lived in mobile-client/lib/usePdfDownload. Extracted here so
// both apps share one implementation.
//
// expo-file-system and expo-sharing are loaded lazily inside the
// functions — when this hook lives in a shared package, a consumer app
// without these installed at the exact subpath we'd import (`legacy`)
// would crash the entire module load, taking down DeviationReportScreen
// and anything else exported alongside. Lazy require() returns null on
// failure and PDF preview/share degrade gracefully to no-ops.

import { useState } from 'react';
import { Alert } from 'react-native';

function loadFileSystem(): any | null {
  try {
    return require('expo-file-system/legacy');
  } catch {
    try { return require('expo-file-system'); } catch { return null; }
  }
}
function loadSharing(): any | null {
  try { return require('expo-sharing'); } catch { return null; }
}

export interface UsePdfDownloadConfig {
  getAccessToken: () => Promise<string | null>;
  onPreviewUri?: (uri: string, title: string) => void;
}

export function usePdfDownload({ getAccessToken, onPreviewUri }: UsePdfDownloadConfig) {
  const [downloading, setDownloading] = useState(false);

  const downloadPdf = async (url: string): Promise<string | null> => {
    const FileSystem = loadFileSystem();
    if (!FileSystem) return null;
    const token = await getAccessToken();
    const fileUri = FileSystem.cacheDirectory + `pdf-${Date.now()}.pdf`;
    const result = await FileSystem.downloadAsync(url, fileUri, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (result.status !== 200) return null;

    const headers = result.headers || {};
    const ct = headers['Content-Type'] || headers['content-type'] || '';

    if (ct.includes('pdf') || ct.includes('octet-stream')) return result.uri;

    try {
      const raw = await FileSystem.readAsStringAsync(result.uri);

      if (raw.startsWith('{')) {
        const json = JSON.parse(raw);
        let base64Data = json.data || json.content || json.pdf || json.file;
        if (!base64Data && json.download_url) {
          const dataUri = json.download_url;
          const commaIdx = dataUri.indexOf(',');
          base64Data = commaIdx !== -1 ? dataUri.substring(commaIdx + 1) : dataUri;
        }
        if (!base64Data && json.download_url) {
          const dataUri = json.download_url;
          const commaIdx = dataUri.indexOf(',');
          base64Data = commaIdx !== -1 ? dataUri.substring(commaIdx + 1) : dataUri;
        }
        if (base64Data) {
          const decoded = FileSystem.cacheDirectory + `pdf-decoded-${Date.now()}.pdf`;
          await FileSystem.writeAsStringAsync(decoded, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return decoded;
        }
      }

      if (raw.length > 100 && !raw.startsWith('<') && !raw.startsWith('{')) {
        const decoded = FileSystem.cacheDirectory + `pdf-raw-${Date.now()}.pdf`;
        await FileSystem.writeAsStringAsync(decoded, raw.trim(), {
          encoding: FileSystem.EncodingType.Base64,
        });
        return decoded;
      }

      if (raw.startsWith('%PDF')) return result.uri;
    } catch {
      return result.uri;
    }

    return null;
  };

  const preview = async (url: string, title: string) => {
    setDownloading(true);
    try {
      const uri = await downloadPdf(url);
      setDownloading(false);
      if (uri) {
        if (onPreviewUri) onPreviewUri(uri, title);
        else {
          const Sharing = loadSharing();
          if (Sharing) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
        }
      } else {
        Alert.alert('Erreur', 'PDF non disponible');
      }
    } catch (err: any) {
      setDownloading(false);
      Alert.alert('Erreur', err?.message || '');
    }
  };

  const share = async (url: string) => {
    setDownloading(true);
    try {
      const uri = await downloadPdf(url);
      if (uri) {
        const Sharing = loadSharing();
        if (Sharing) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('Erreur', 'PDF non disponible');
      }
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || '');
    } finally {
      setDownloading(false);
    }
  };

  return { downloading, preview, share };
}
