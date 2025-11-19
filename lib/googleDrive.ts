// Google Drive API Service
// Nota: Para producción, el OAuth debe manejarse en un backend por seguridad

import { GoogleDriveConfig } from '../types';

// URL del backend API
// Configura VITE_API_URL en .env.local para producción
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface GoogleDriveFile {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    webContentLink?: string;
    size?: string;
    createdTime?: string;
    modifiedTime?: string;
}

export interface GoogleDriveFolder {
    id: string;
    name: string;
    mimeType: string;
    parents?: string[];
}

class GoogleDriveService {
    private accessToken: string | null = null;
    private refreshToken: string | null = null;

    // Inicializar con tokens guardados
    initialize(config: GoogleDriveConfig | undefined) {
        if (config?.connected && config.accessToken) {
            this.accessToken = config.accessToken;
            this.refreshToken = config.refreshToken || null;
        }
    }

    // Obtener URL de autenticación (debe redirigir al backend)
    getAuthUrl(): string {
        return `${API_BASE_URL}/api/auth/google/drive`;
    }

    // Verificar si está conectado
    isConnected(): boolean {
        return !!this.accessToken;
    }

    // Obtener token de acceso actual
    getAccessToken(): string | null {
        return this.accessToken;
    }

    // Establecer tokens (después de OAuth)
    setTokens(accessToken: string, refreshToken?: string) {
        this.accessToken = accessToken;
        if (refreshToken) {
            this.refreshToken = refreshToken;
        }
    }

    // Listar carpetas en Google Drive
    async listFolders(parentFolderId?: string): Promise<GoogleDriveFolder[]> {
        if (!this.accessToken) {
            throw new Error('No hay conexión con Google Drive');
        }

        try {
            const query = parentFolderId
                ? `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
                : `mimeType='application/vnd.google-apps.folder' and trashed=false`;

            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,parents)`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expirado, intentar refrescar
                    await this.refreshAccessToken();
                    return this.listFolders(parentFolderId);
                }
                throw new Error(`Error al listar carpetas: ${response.statusText}`);
            }

            const data = await response.json();
            return data.files || [];
        } catch (error) {
            console.error('Error listando carpetas:', error);
            throw error;
        }
    }

    // Crear carpeta en Google Drive
    async createFolder(name: string, parentFolderId?: string): Promise<GoogleDriveFolder> {
        if (!this.accessToken) {
            throw new Error('No hay conexión con Google Drive');
        }

        try {
            const metadata: any = {
                name: name,
                mimeType: 'application/vnd.google-apps.folder',
            };

            if (parentFolderId) {
                metadata.parents = [parentFolderId];
            }

            const response = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(metadata),
            });

            if (!response.ok) {
                if (response.status === 401) {
                    await this.refreshAccessToken();
                    return this.createFolder(name, parentFolderId);
                }
                throw new Error(`Error al crear carpeta: ${response.statusText}`);
            }

            const folder = await response.json();
            return folder;
        } catch (error) {
            console.error('Error creando carpeta:', error);
            throw error;
        }
    }

    // Subir archivo a Google Drive
    async uploadFile(
        file: File,
        folderId?: string,
        fileName?: string
    ): Promise<GoogleDriveFile> {
        if (!this.accessToken) {
            throw new Error('No hay conexión con Google Drive');
        }

        try {
            const metadata: any = {
                name: fileName || file.name,
            };

            if (folderId) {
                metadata.parents = [folderId];
            }

            // Crear FormData para multipart upload
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);

            const response = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size,createdTime,modifiedTime',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                    body: form,
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    await this.refreshAccessToken();
                    return this.uploadFile(file, folderId, fileName);
                }
                const errorText = await response.text();
                throw new Error(`Error al subir archivo: ${response.statusText} - ${errorText}`);
            }

            const uploadedFile = await response.json();
            return uploadedFile;
        } catch (error) {
            console.error('Error subiendo archivo:', error);
            throw error;
        }
    }

    // Obtener URL de descarga de un archivo
    getFileDownloadUrl(fileId: string): string {
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }

    // Obtener URL de visualización de un archivo
    getFileViewUrl(fileId: string): string {
        return `https://drive.google.com/file/d/${fileId}/view`;
    }

    // Eliminar archivo de Google Drive
    async deleteFile(fileId: string): Promise<void> {
        if (!this.accessToken) {
            throw new Error('No hay conexión con Google Drive');
        }

        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    await this.refreshAccessToken();
                    return this.deleteFile(fileId);
                }
                throw new Error(`Error al eliminar archivo: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error eliminando archivo:', error);
            throw error;
        }
    }

    // Eliminar carpeta de Google Drive
    async deleteFolder(folderId: string): Promise<void> {
        // Las carpetas se eliminan igual que los archivos
        return this.deleteFile(folderId);
    }

    // Obtener o crear carpeta de sección (Cartas, Formularios, etc.)
    async getOrCreateSectionFolder(sectionName: string, rootFolderId: string): Promise<GoogleDriveFolder> {
        if (!this.accessToken) {
            throw new Error('No hay conexión con Google Drive');
        }

        try {
            // Buscar carpeta existente
            const query = `name='${sectionName}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,parents)`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    await this.refreshAccessToken();
                    return this.getOrCreateSectionFolder(sectionName, rootFolderId);
                }
                throw new Error(`Error al buscar carpeta de sección: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.files && data.files.length > 0) {
                return data.files[0] as GoogleDriveFolder;
            }

            // Crear carpeta si no existe
            return await this.createFolder(sectionName, rootFolderId);
        } catch (error) {
            console.error('Error obteniendo/creando carpeta de sección:', error);
            throw error;
        }
    }

    // Refrescar token de acceso
    private async refreshAccessToken(): Promise<void> {
        if (!this.refreshToken) {
            throw new Error('No hay refresh token disponible. Por favor, reconecta tu cuenta de Google Drive.');
        }

        try {
            // En producción, esto debe hacerse en el backend por seguridad
            const response = await fetch(`${API_BASE_URL}/api/auth/google/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refreshToken: this.refreshToken }),
            });

            if (!response.ok) {
                throw new Error('Error al refrescar token');
            }

            const data = await response.json();
            this.accessToken = data.accessToken;
            if (data.refreshToken) {
                this.refreshToken = data.refreshToken;
            }
        } catch (error) {
            console.error('Error refrescando token:', error);
            // Limpiar tokens si falla
            this.accessToken = null;
            this.refreshToken = null;
            throw error;
        }
    }

    // Obtener información del usuario conectado
    async getUserInfo(): Promise<{ email: string; name: string }> {
        if (!this.accessToken) {
            throw new Error('No hay conexión con Google Drive');
        }

        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    await this.refreshAccessToken();
                    return this.getUserInfo();
                }
                throw new Error(`Error al obtener información del usuario: ${response.statusText}`);
            }

            const userInfo = await response.json();
            return {
                email: userInfo.email,
                name: userInfo.name || userInfo.email,
            };
        } catch (error) {
            console.error('Error obteniendo información del usuario:', error);
            throw error;
        }
    }
}

export const googleDriveService = new GoogleDriveService();

