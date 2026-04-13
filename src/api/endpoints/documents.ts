import type { ApiClient } from '../createApiClient';

export interface Document {
  id: number;
  user_id: number;
  folder_id?: number;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  shared_with?: number[];
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: number;
  user_id: number;
  name: string;
  parent_id?: number;
  document_count: number;
  shared_with?: number[];
  created_at: string;
  updated_at: string;
}

export function createDocumentEndpoints(api: ApiClient) {
  return {
    listDocuments: (folderId?: number) => {
      const params = folderId ? `?folder_id=${folderId}` : '';
      return api.get<{ documents: Document[] }>(`/v1/documents${params}`);
    },

    uploadDocument: (formData: FormData) =>
      api.postFile<Document>('/v1/documents', formData),

    deleteDocument: (id: number) =>
      api.del<{ success: boolean }>(`/v1/documents/${id}`),

    downloadDocument: (id: number) =>
      api.get<{ url: string }>(`/v1/documents/${id}/download`),

    listFolders: () =>
      api.get<{ folders: Folder[] }>('/v1/folders'),

    createFolder: (name: string, parentId?: number) =>
      api.post<Folder>('/v1/folders', { name, parent_id: parentId }),

    deleteFolder: (id: number) =>
      api.del<{ success: boolean }>(`/v1/folders/${id}`),

    shareDocument: (documentId: number, email: string) =>
      api.post<{ success: boolean }>(`/v1/documents/${documentId}/share`, { email }),

    shareFolder: (folderId: number, email: string) =>
      api.post<{ success: boolean }>(`/v1/folders/${folderId}/share`, { email }),
  };
}
