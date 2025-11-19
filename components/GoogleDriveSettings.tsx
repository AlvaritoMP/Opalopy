import React, { useState, useEffect } from 'react';
import { useAppState } from '../App';
import { GoogleDriveConfig } from '../types';
import { googleDriveService, GoogleDriveFolder } from '../lib/googleDrive';
import { Cloud, CheckCircle, XCircle, Loader, Folder, RefreshCw, AlertCircle } from 'lucide-react';

interface GoogleDriveSettingsProps {
    config: GoogleDriveConfig | undefined;
    onConfigChange: (config: GoogleDriveConfig) => void;
}

export const GoogleDriveSettings: React.FC<GoogleDriveSettingsProps> = ({ config, onConfigChange }) => {
    const { state } = useAppState();
    const [isConnecting, setIsConnecting] = useState(false);
    const [isLoadingFolders, setIsLoadingFolders] = useState(false);
    const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        // Manejar el callback de OAuth desde la URL
        const urlParams = new URLSearchParams(window.location.search);
        const driveConnected = urlParams.get('drive_connected');
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');
        const tokenExpiry = urlParams.get('expires_in');
        const userEmail = urlParams.get('user_email');
        const userName = urlParams.get('user_name');
        const rootFolderId = urlParams.get('root_folder_id');

        if (driveConnected === 'true' && accessToken) {
            const newConfig: GoogleDriveConfig = {
                connected: true,
                accessToken: accessToken,
                refreshToken: refreshToken || config?.refreshToken,
                tokenExpiry: tokenExpiry ? new Date(Date.now() + parseInt(tokenExpiry) * 1000).toISOString() : config?.tokenExpiry,
                userEmail: userEmail || config?.userEmail,
                userName: userName || config?.userName,
                rootFolderId: rootFolderId || config?.rootFolderId,
            };
            googleDriveService.setTokens(accessToken, refreshToken || '');
            onConfigChange(newConfig);
            setSuccess('Conectado exitosamente a Google Drive');
            setIsConnecting(false);
            
            // Limpiar URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Cerrar popup si está abierto
            if (window.opener) {
                window.close();
            }
            
            // Cargar carpetas después de conectar
            setTimeout(() => loadFolders(), 1000);
        }

        if (config?.connected && config.accessToken) {
            googleDriveService.initialize(config);
            loadFolders();
        }
    }, [config?.connected]);

    const loadFolders = async () => {
        if (!config?.connected || !config.accessToken) return;

        setIsLoadingFolders(true);
        setError(null);
        try {
            googleDriveService.initialize(config);
            const rootFolderId = config.rootFolderId;
            const foldersList = await googleDriveService.listFolders(rootFolderId);
            setFolders(foldersList);
        } catch (err: any) {
            console.error('Error cargando carpetas:', err);
            setError(err.message || 'Error al cargar carpetas de Google Drive');
        } finally {
            setIsLoadingFolders(false);
        }
    };

    const handleConnect = () => {
        setIsConnecting(true);
        setError(null);
        
        // Redirigir al backend para OAuth
        // En producción, esto debe ser una URL del backend
        const authUrl = googleDriveService.getAuthUrl();
        
        // Abrir ventana de OAuth
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        const popup = window.open(
            authUrl,
            'Google Drive Auth',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        // Verificar si el popup se cerró o redirigió
        const checkClosed = setInterval(() => {
            if (popup?.closed) {
                clearInterval(checkClosed);
                setIsConnecting(false);
                // Si el popup se cerró, verificar si hay parámetros en la URL
                // (el useEffect los manejará)
            }
        }, 1000);
    };

    const handleDisconnect = () => {
        if (confirm('¿Estás seguro de que deseas desconectar Google Drive? Los archivos ya subidos no se eliminarán, pero no podrás subir nuevos archivos.')) {
            const newConfig: GoogleDriveConfig = {
                connected: false,
            };
            onConfigChange(newConfig);
            googleDriveService.setTokens('', '');
            setFolders([]);
            setSuccess('Google Drive desconectado');
        }
    };

    const handleRefreshFolders = () => {
        loadFolders();
    };

    return (
        <div className="space-y-4">
            {/* Estado de conexión */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center space-x-3">
                    <Cloud className={`w-6 h-6 ${config?.connected ? 'text-green-600' : 'text-gray-400'}`} />
                    <div>
                        <p className="font-medium text-gray-900">Google Drive</p>
                        <div className="flex items-center space-x-2 mt-1">
                            {config?.connected ? (
                                <>
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    <span className="text-sm text-green-600">Conectado</span>
                                    {config.userEmail && (
                                        <span className="text-sm text-gray-500">({config.userEmail})</span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <XCircle className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-500">No conectado</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                {config?.connected ? (
                    <button
                        onClick={handleDisconnect}
                        className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
                    >
                        Desconectar
                    </button>
                ) : (
                    <button
                        onClick={handleConnect}
                        disabled={isConnecting}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                        {isConnecting ? (
                            <>
                                <Loader className="w-4 h-4 animate-spin" />
                                <span>Conectando...</span>
                            </>
                        ) : (
                            <>
                                <Cloud className="w-4 h-4" />
                                <span>Conectar con Google Drive</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Mensajes de éxito/error */}
            {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-800">{success}</span>
                    <button
                        onClick={() => setSuccess(null)}
                        className="ml-auto text-green-600 hover:text-green-800"
                    >
                        ×
                    </button>
                </div>
            )}

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm text-red-800">{error}</span>
                    <button
                        onClick={() => setError(null)}
                        className="ml-auto text-red-600 hover:text-red-800"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Información adicional */}
            {config?.connected && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Información de conexión</h4>
                    <div className="space-y-1 text-sm text-blue-800">
                        {config.userName && (
                            <p><strong>Usuario:</strong> {config.userName}</p>
                        )}
                        {config.userEmail && (
                            <p><strong>Email:</strong> {config.userEmail}</p>
                        )}
                        {config.rootFolderId && (
                            <p><strong>Carpeta raíz:</strong> ATS Pro</p>
                        )}
                    </div>
                    <div className="mt-3">
                        <button
                            onClick={handleRefreshFolders}
                            disabled={isLoadingFolders}
                            className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoadingFolders ? 'animate-spin' : ''}`} />
                            <span>Actualizar carpetas</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Lista de carpetas (para referencia) */}
            {config?.connected && folders.length > 0 && (
                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                        <Folder className="w-5 h-5 mr-2" />
                        Carpetas disponibles
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {folders.map((folder) => (
                            <div
                                key={folder.id}
                                className="p-2 bg-gray-50 rounded-md flex items-center space-x-2"
                            >
                                <Folder className="w-4 h-4 text-gray-500" />
                                <span className="text-sm text-gray-700">{folder.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Nota sobre backend */}
            {!config?.connected && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div className="text-sm text-yellow-800">
                            <p className="font-medium mb-1">Nota importante:</p>
                            <p>Para conectar Google Drive, necesitas configurar un backend que maneje la autenticación OAuth2. Consulta el archivo <code className="bg-yellow-100 px-1 rounded">GOOGLE_DRIVE_SETUP.md</code> para más información.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

