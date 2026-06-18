// Google Drive API Service
// Nota: Para producción, el OAuth debe manejarse en un backend por seguridad

import { GoogleDriveConfig } from '../types';
import { debugLog, debugWarn } from './debugLog';

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
    private tokenExpiry: Date | null = null;
    private onTokenUpdate: ((accessToken: string, refreshToken?: string, expiresIn?: number) => void) | null = null;

    // Establecer callback para actualizar tokens en settings cuando se refrescan
    setTokenUpdateCallback(callback: (accessToken: string, refreshToken?: string, expiresIn?: number) => void) {
        this.onTokenUpdate = callback;
    }

    // Inicializar con tokens guardados
    async initialize(config: GoogleDriveConfig | undefined) {
        if (config?.connected && config.accessToken) {
            this.accessToken = config.accessToken;
            this.refreshToken = config.refreshToken || null;
            
            debugLog('Inicializando GoogleDriveService');
            
            if (config.tokenExpiry) {
                this.tokenExpiry = new Date(config.tokenExpiry);
                const now = new Date();
                const timeUntilExpiry = this.tokenExpiry.getTime() - now.getTime();
                if (this.tokenExpiry <= now || timeUntilExpiry < 5 * 60 * 1000) {
                    debugLog('Token de Google Drive expirado o próximo a expirar, refrescando...');
                    if (!this.refreshToken) {
                        console.error('No se puede refrescar: no hay refresh token guardado');
                        throw new Error('No hay refresh token disponible. Por favor, reconecta tu cuenta de Google Drive.');
                    }
                    try {
                        await this.refreshAccessToken();
                    } catch (error) {
                        console.error('Error refrescando token al inicializar:', error);
                        this.accessToken = null;
                        this.refreshToken = null;
                        throw error;
                    }
                }
            } else if (!this.refreshToken) {
                debugWarn('No hay refresh token guardado. El token puede expirar sin poder refrescarse.');
            }
        } else {
            debugLog('Google Drive no está configurado o no hay access token');
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

    // Obtener URL de visualización de un archivo (usa /preview para mejor compatibilidad con iframes)
    getFileViewUrl(fileId: string): string {
        return `https://drive.google.com/file/d/${fileId}/preview`;
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

    // Obtener o crear carpeta de candidato (evita duplicados)
    // Si existe una carpeta guardada, verifica que aún exista. Si no, busca por nombre y usa la primera encontrada.
    async getOrCreateCandidateFolder(
        candidateName: string, 
        processFolderId: string, 
        existingFolderId?: string
    ): Promise<GoogleDriveFolder> {
        if (!this.accessToken) {
            throw new Error('No hay conexión con Google Drive');
        }

        try {
            // Si hay una carpeta guardada, verificar que aún existe
            if (existingFolderId) {
                try {
                    const checkResponse = await fetch(
                        `https://www.googleapis.com/drive/v3/files/${existingFolderId}?fields=id,name,mimeType,parents,trashed`,
                        {
                            headers: {
                                'Authorization': `Bearer ${this.accessToken}`,
                            },
                        }
                    );

                    if (checkResponse.ok) {
                        const folder = await checkResponse.json();
                        // Verificar que no esté en papelera y que esté en la carpeta correcta del proceso
                        if (!folder.trashed && folder.parents && folder.parents.includes(processFolderId)) {
                            debugLog(`Carpeta existente encontrada: ${folder.name}`);
                            return folder as GoogleDriveFolder;
                        }
                    }
                } catch (error) {
                    console.warn('Carpeta guardada no existe o fue eliminada, buscando por nombre...', error);
                }
            }

            // Buscar carpetas existentes por nombre en la carpeta del proceso
            // Primero intentar búsqueda exacta
            const sanitizedName = candidateName.replace(/[^a-zA-Z0-9_\- ]/g, '_');
            let query = `name='${sanitizedName}' and '${processFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            let response = await fetch(
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
                    return this.getOrCreateCandidateFolder(candidateName, processFolderId, existingFolderId);
                }
                throw new Error(`Error al buscar carpeta de candidato: ${response.statusText}`);
            }

            let data = await response.json();
            
            // Si no encontró con búsqueda exacta, intentar búsqueda flexible (contiene el nombre)
            if (!data.files || data.files.length === 0) {
                // Extraer palabras clave del nombre (primera palabra o primeras dos palabras)
                const nameWords = candidateName.trim().split(/\s+/).filter(w => w.length > 2);
                if (nameWords.length > 0) {
                    const searchTerm = nameWords[0]; // Usar la primera palabra significativa
                    query = `name contains '${searchTerm}' and '${processFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
                    response = await fetch(
                        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,parents)`,
                        {
                            headers: {
                                'Authorization': `Bearer ${this.accessToken}`,
                            },
                        }
                    );
                    
                    if (response.ok) {
                        data = await response.json();
                    }
                }
            }

            if (data.files && data.files.length > 0) {
                // Si hay múltiples carpetas, usar la que tenga más archivos o sea más reciente
                // Primero intentar encontrar la que coincida con existingFolderId
                const matchingFolder = existingFolderId 
                    ? data.files.find((f: any) => f.id === existingFolderId)
                    : null;
                
                if (matchingFolder) {
                    debugLog(`Carpeta encontrada (coincide con guardada): ${matchingFolder.name}`);
                    return matchingFolder as GoogleDriveFolder;
                }
                
                // Si hay múltiples, buscar la que tenga más contenido (archivos)
                if (data.files.length > 1) {
                    debugLog(`Múltiples carpetas para "${candidateName}", eligiendo la con más archivos...`);
                    const foldersWithContent = await Promise.all(
                        data.files.map(async (folder: any) => {
                            try {
                                const filesResponse = await fetch(
                                    `https://www.googleapis.com/drive/v3/files?q='${folder.id}' in parents and trashed=false&fields=files(id)`,
                                    {
                                        headers: {
                                            'Authorization': `Bearer ${this.accessToken}`,
                                        },
                                    }
                                );
                                if (filesResponse.ok) {
                                    const filesData = await filesResponse.json();
                                    return {
                                        folder,
                                        fileCount: filesData.files?.length || 0
                                    };
                                }
                            } catch (error) {
                                console.warn(`Error contando archivos en carpeta ${folder.name}:`, error);
                            }
                            return { folder, fileCount: 0 };
                        })
                    );
                    
                    // Ordenar por cantidad de archivos (mayor primero) y usar la primera
                    foldersWithContent.sort((a, b) => b.fileCount - a.fileCount);
                    const bestFolder = foldersWithContent[0].folder;
                    debugLog(`Carpeta seleccionada (${foldersWithContent[0].fileCount} archivos): ${bestFolder.name}`);
                    return bestFolder as GoogleDriveFolder;
                }
                
                // Si solo hay una, usarla
                const folderToUse = data.files[0];
                debugLog(`Carpeta encontrada por nombre: ${folderToUse.name}`);
                return folderToUse as GoogleDriveFolder;
            }

            // Crear carpeta solo si no existe ninguna
            debugLog(`Creando carpeta para candidato: ${sanitizedName}`);
            return await this.createFolder(sanitizedName, processFolderId);
        } catch (error) {
            console.error('Error obteniendo/creando carpeta de candidato:', error);
            throw error;
        }
    }

    // Listar todos los archivos en una carpeta
    async listFilesInFolder(folderId: string): Promise<GoogleDriveFile[]> {
        if (!this.accessToken) {
            throw new Error('No hay conexión con Google Drive');
        }

        try {
            const query = `'${folderId}' in parents and trashed=false`;
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,webContentLink,size,createdTime,modifiedTime)&orderBy=modifiedTime desc`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    await this.refreshAccessToken();
                    return this.listFilesInFolder(folderId);
                }
                throw new Error(`Error al listar archivos: ${response.statusText}`);
            }

            const data = await response.json();
            return (data.files || []) as GoogleDriveFile[];
        } catch (error) {
            console.error('Error listando archivos en carpeta:', error);
            throw error;
        }
    }

    // Verificar si un archivo ya existe en una carpeta (por nombre)
    async findFileInFolder(fileName: string, folderId: string): Promise<GoogleDriveFile | null> {
        if (!this.accessToken) {
            throw new Error('No hay conexión con Google Drive');
        }

        try {
            const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,webContentLink,size,createdTime,modifiedTime)`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    await this.refreshAccessToken();
                    return this.findFileInFolder(fileName, folderId);
                }
                return null; // Si hay error, retornar null para permitir subir
            }

            const data = await response.json();
            if (data.files && data.files.length > 0) {
                // Retornar el archivo más reciente si hay múltiples
                const sortedFiles = data.files.sort((a: any, b: any) => {
                    const timeA = new Date(a.modifiedTime || a.createdTime || 0).getTime();
                    const timeB = new Date(b.modifiedTime || b.createdTime || 0).getTime();
                    return timeB - timeA; // Más reciente primero
                });
                return sortedFiles[0] as GoogleDriveFile;
            }

            return null;
        } catch (error) {
            console.error('Error buscando archivo en carpeta:', error);
            return null; // Si hay error, permitir subir
        }
    }

    // Buscar carpetas por nombre (en todo Google Drive)
    async searchFolders(searchQuery: string): Promise<GoogleDriveFolder[]> {
        if (!this.accessToken) {
            throw new Error('No hay conexión con Google Drive');
        }

        try {
            // Buscar carpetas que contengan el término de búsqueda
            const query = `name contains '${searchQuery}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,parents)&pageSize=50`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    await this.refreshAccessToken();
                    return this.searchFolders(searchQuery);
                }
                throw new Error(`Error al buscar carpetas: ${response.statusText}`);
            }

            const data = await response.json();
            return data.files || [];
        } catch (error) {
            console.error('Error buscando carpetas:', error);
            throw error;
        }
    }

    // Obtener información de una carpeta por ID (incluyendo nombre y padres)
    async getFolderInfo(folderId: string): Promise<GoogleDriveFolder & { fullPath?: string }> {
        if (!this.accessToken) {
            throw new Error('No hay conexión con Google Drive');
        }

        try {
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,parents`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    await this.refreshAccessToken();
                    return this.getFolderInfo(folderId);
                }
                throw new Error(`Error al obtener información de carpeta: ${response.statusText}`);
            }

            const folder = await response.json();
            return folder as GoogleDriveFolder;
        } catch (error) {
            console.error('Error obteniendo información de carpeta:', error);
            throw error;
        }
    }

    // Refrescar token de acceso
    private async refreshAccessToken(): Promise<void> {
        if (!this.refreshToken) {
            console.error('❌ No hay refresh token disponible. Refresh token:', this.refreshToken);
            throw new Error('No hay refresh token disponible. Por favor, reconecta tu cuenta de Google Drive.');
        }

        try {
            debugLog('Refrescando token de Google Drive...');
            // En producción, esto debe hacerse en el backend por seguridad
            // El backend espera 'refresh_token' (snake_case), no 'refreshToken'
            const response = await fetch(`${API_BASE_URL}/api/auth/google/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh_token: this.refreshToken }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Error del backend al refrescar token:', response.status, errorText);
                let errorMessage = 'Error al refrescar token';
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    errorMessage = errorText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            this.accessToken = data.access_token || data.accessToken;
            
            // Actualizar refresh token si se proporciona uno nuevo
            if (data.refresh_token || data.refreshToken) {
                this.refreshToken = data.refresh_token || data.refreshToken;
            }
            
            // Actualizar fecha de expiración
            if (data.expires_in) {
                this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);
            } else if (data.expiry_date) {
                this.tokenExpiry = new Date(data.expiry_date);
            }
            
            // Notificar callback para actualizar settings
            if (this.onTokenUpdate) {
                this.onTokenUpdate(
                    this.accessToken,
                    this.refreshToken || undefined,
                    data.expires_in
                );
            }
            
            debugLog('Token de Google Drive refrescado');
        } catch (error) {
            console.error('Error refrescando token:', error);
            // Limpiar tokens si falla
            this.accessToken = null;
            this.refreshToken = null;
            this.tokenExpiry = null;
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

