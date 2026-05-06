import React, { useState, useEffect } from 'react';
import { useAppState } from '../App';
import { GoogleDriveConfig } from '../types';
import { googleDriveService, GoogleDriveFolder } from '../lib/googleDrive';
import { Cloud, CheckCircle, XCircle, Loader, Folder, RefreshCw, AlertCircle, Info, Search, ChevronLeft } from 'lucide-react';

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
    const [showRootFolderSelector, setShowRootFolderSelector] = useState(false);
    const [availableRootFolders, setAvailableRootFolders] = useState<GoogleDriveFolder[]>([]);
    const [isLoadingRootFolders, setIsLoadingRootFolders] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<GoogleDriveFolder[]>([]);

    useEffect(() => {
        // Si estamos en un popup (window.opener existe), leer parámetros y enviarlos a la ventana principal
        if (window.opener && !window.opener.closed) {
            console.log('🔵 Popup detectado, leyendo parámetros de URL...');
            const urlParams = new URLSearchParams(window.location.search);
            const driveConnected = urlParams.get('drive_connected');
            const accessToken = urlParams.get('access_token');
            const refreshToken = urlParams.get('refresh_token');
            const tokenExpiry = urlParams.get('expires_in');
            const userEmail = urlParams.get('user_email');
            const userName = urlParams.get('user_name');
            const rootFolderId = urlParams.get('root_folder_id');
            const rootFolderName = urlParams.get('root_folder_name');

            console.log('📋 Parámetros encontrados:', {
                driveConnected,
                hasAccessToken: !!accessToken,
                hasRefreshToken: !!refreshToken,
                userEmail,
            });

            if (driveConnected === 'true' && accessToken) {
                const messageData = {
                    type: 'GOOGLE_DRIVE_AUTH_SUCCESS',
                    accessToken,
                    refreshToken,
                    tokenExpiry,
                    userInfo: {
                        email: userEmail,
                        name: userName,
                    },
                    rootFolderId,
                    rootFolderName,
                };
                
                console.log('📤 Enviando mensaje a ventana principal:', messageData);
                console.log('📍 Origen:', window.location.origin);
                
                try {
                    // Intentar enviar mensaje primero
                    window.opener.postMessage(messageData, window.location.origin);
                    console.log('✅ Mensaje enviado, cerrando popup en 500ms...');
                    
                    // También redirigir la ventana principal como fallback
                    const redirectUrl = new URL(window.location.href);
                    redirectUrl.pathname = '/settings';
                    window.opener.location.href = redirectUrl.toString();
                    
                    // Esperar un poco antes de cerrar para asegurar que el mensaje se envíe
                    setTimeout(() => {
                        console.log('🔴 Cerrando popup...');
                        window.close();
                    }, 500);
                } catch (error) {
                    console.error('❌ Error enviando mensaje, redirigiendo ventana principal:', error);
                    // Si falla el mensaje, redirigir la ventana principal directamente
                    const redirectUrl = new URL(window.location.href);
                    redirectUrl.pathname = '/settings';
                    window.opener.location.href = redirectUrl.toString();
                    setTimeout(() => window.close(), 1000);
                }
                return;
            } else {
                console.log('⚠️ Parámetros incompletos o inválidos');
            }
        }

        // Si estamos en la ventana principal, escuchar mensajes del popup
        const messageListener = async (event: MessageEvent) => {
            // Verificar que el mensaje viene del mismo origen
            if (event.origin !== window.location.origin) return;

            if (event.data.type === 'GOOGLE_DRIVE_AUTH_SUCCESS') {
                const { accessToken, refreshToken, userInfo, rootFolderId, rootFolderName, tokenExpiry } = event.data;
                
                const newConfig: GoogleDriveConfig = {
                    connected: true,
                    accessToken,
                    refreshToken: refreshToken || config?.refreshToken,
                    tokenExpiry: tokenExpiry ? new Date(Date.now() + parseInt(tokenExpiry) * 1000).toISOString() : config?.tokenExpiry,
                    userEmail: userInfo?.email || config?.userEmail,
                    userName: userInfo?.name || config?.userName,
                    rootFolderId: rootFolderId || config?.rootFolderId,
                    rootFolderName: rootFolderName || config?.rootFolderName || 'Opalopy',
                };

                googleDriveService.setTokens(accessToken, refreshToken || '');
                
                // onConfigChange guardará automáticamente en Supabase
                await onConfigChange(newConfig);
                
                setSuccess('Conectado exitosamente a Google Drive');
                setIsConnecting(false);
                
                // Cargar carpetas después de conectar
                setTimeout(() => {
                    // Actualizar config local para que loadFolders use los nuevos datos
                    loadFolders();
                }, 1000);
            }
        };

        window.addEventListener('message', messageListener);

        // También manejar parámetros en la URL si se carga directamente (sin popup)
        const urlParams = new URLSearchParams(window.location.search);
        const driveConnected = urlParams.get('drive_connected');
        const accessToken = urlParams.get('access_token');
        if (driveConnected === 'true' && accessToken && !window.opener) {
            (async () => {
                const refreshToken = urlParams.get('refresh_token');
                const tokenExpiry = urlParams.get('expires_in');
                const userEmail = urlParams.get('user_email');
                const userName = urlParams.get('user_name');
                const rootFolderId = urlParams.get('root_folder_id');
                const rootFolderName = urlParams.get('root_folder_name');

                const newConfig: GoogleDriveConfig = {
                    connected: true,
                    accessToken: accessToken,
                    refreshToken: refreshToken || config?.refreshToken,
                    tokenExpiry: tokenExpiry ? new Date(Date.now() + parseInt(tokenExpiry) * 1000).toISOString() : config?.tokenExpiry,
                    userEmail: userEmail || config?.userEmail,
                    userName: userName || config?.userName,
                    rootFolderId: rootFolderId || config?.rootFolderId,
                    rootFolderName: rootFolderName || config?.rootFolderName || 'Opalopy',
                };
                googleDriveService.setTokens(accessToken, refreshToken || '');
                
                // onConfigChange guardará automáticamente en Supabase
                await onConfigChange(newConfig);
                
                setSuccess('Conectado exitosamente a Google Drive');
                
                // Limpiar URL
                window.history.replaceState({}, document.title, window.location.pathname);
                
                // Cargar carpetas después de conectar
                setTimeout(() => loadFolders(), 1000);
            })();
        }

        if (config?.connected && config.accessToken) {
            googleDriveService.initialize(config);
            loadFolders();
        }

        return () => {
            window.removeEventListener('message', messageListener);
        };
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
        setSuccess(null);
        
        console.log('🔵 Iniciando conexión con Google Drive...');
        
        // Registrar listener ANTES de abrir el popup
        const messageListener = (event: MessageEvent) => {
            console.log('📨 Mensaje recibido:', event.origin, event.data);
            
            // Verificar que el mensaje viene del mismo origen O del backend (el popup puede enviar desde el backend)
            const frontendOrigin = window.location.origin;
            const backendOrigin = frontendOrigin.replace(/^https?:\/\/([^.]+)\./, 'https://opalo-ats-backend.');
            const allowedOrigins = [frontendOrigin, backendOrigin];
            
            // También permitir cualquier origen de easypanel.host para desarrollo
            const isAllowedOrigin = allowedOrigins.includes(event.origin) || 
                                   event.origin.includes('easypanel.host');
            
            if (!isAllowedOrigin) {
                console.log('⚠️ Origen no permitido:', event.origin, 'vs', frontendOrigin);
                return;
            }
            
            // Ignorar mensajes que no son de Google Drive OAuth
            if (!event.data || event.data?.target === 'metamask-inpage' || event.data?.type !== 'GOOGLE_DRIVE_AUTH_SUCCESS') {
                return;
            }

            if (event.data.type === 'GOOGLE_DRIVE_AUTH_SUCCESS') {
                console.log('✅ Mensaje de éxito recibido:', event.data);
                (async () => {
                    try {
                        const { accessToken, refreshToken, userInfo, rootFolderId, rootFolderName, tokenExpiry } = event.data;
                        
                        const newConfig: GoogleDriveConfig = {
                            connected: true,
                            accessToken,
                            refreshToken: refreshToken || config?.refreshToken,
                            tokenExpiry: tokenExpiry ? new Date(Date.now() + parseInt(tokenExpiry) * 1000).toISOString() : config?.tokenExpiry,
                            userEmail: userInfo?.email || config?.userEmail,
                            userName: userInfo?.name || config?.userName,
                            rootFolderId: rootFolderId || config?.rootFolderId,
                            rootFolderName: rootFolderName || config?.rootFolderName || 'Opalopy',
                        };

                        console.log('💾 Guardando configuración:', { connected: newConfig.connected, hasToken: !!newConfig.accessToken });
                        googleDriveService.setTokens(accessToken, refreshToken || '');
                        
                        // onConfigChange guardará automáticamente en Supabase
                        await onConfigChange(newConfig);
                        
                        console.log('✅ Configuración guardada exitosamente');
                        setSuccess('Conectado exitosamente a Google Drive');
                        setIsConnecting(false);
                        
                        // Cargar carpetas después de conectar
                        setTimeout(() => {
                            loadFolders();
                        }, 1000);
                    } catch (error) {
                        console.error('❌ Error procesando mensaje:', error);
                        setError('Error al procesar la conexión: ' + (error as Error).message);
                        setIsConnecting(false);
                    }
                })();
                
                // Remover listener después de procesar
                window.removeEventListener('message', messageListener);
            }
        };

        window.addEventListener('message', messageListener);
        console.log('👂 Listener de mensajes registrado');
        
        // Redirigir al backend para OAuth
        const authUrl = googleDriveService.getAuthUrl();
        console.log('🔗 URL de autenticación:', authUrl);
        
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

        if (!popup) {
            setError('No se pudo abrir la ventana de autenticación. Verifica que los popups no estén bloqueados.');
            setIsConnecting(false);
            window.removeEventListener('message', messageListener);
            return;
        }

        // Verificar si el popup se cerró
        const checkClosed = setInterval(() => {
            if (popup?.closed) {
                clearInterval(checkClosed);
                console.log('🔴 Popup cerrado');
                window.removeEventListener('message', messageListener);
                
                // Esperar un momento para ver si el mensaje llega después de que el popup se cierra
                setTimeout(() => {
                    // Si el popup se cerró pero no recibimos el mensaje, verificar si hay parámetros en la URL actual
                    // (esto puede pasar si el popup redirigió a la ventana principal en lugar de enviar un mensaje)
                    const urlParams = new URLSearchParams(window.location.search);
                    const driveConnected = urlParams.get('drive_connected');
                    const accessToken = urlParams.get('access_token');
                    
                    console.log('🔍 Verificando parámetros en URL después de cerrar popup:', {
                        driveConnected,
                        hasAccessToken: !!accessToken,
                        currentUrl: window.location.href
                    });
                    
                    if (driveConnected === 'true' && accessToken) {
                        console.log('✅ Parámetros encontrados en URL principal, procesando...');
                        // Procesar directamente desde la URL
                        (async () => {
                            try {
                                const refreshToken = urlParams.get('refresh_token');
                                const tokenExpiry = urlParams.get('expires_in');
                                const userEmail = urlParams.get('user_email');
                                const userName = urlParams.get('user_name');
                                const rootFolderId = urlParams.get('root_folder_id');
                                const rootFolderName = urlParams.get('root_folder_name');

                                const newConfig: GoogleDriveConfig = {
                                    connected: true,
                                    accessToken: accessToken,
                                    refreshToken: refreshToken || config?.refreshToken,
                                    tokenExpiry: tokenExpiry ? new Date(Date.now() + parseInt(tokenExpiry) * 1000).toISOString() : config?.tokenExpiry,
                                    userEmail: userEmail || config?.userEmail,
                                    userName: userName || config?.userName,
                                    rootFolderId: rootFolderId || config?.rootFolderId,
                                    rootFolderName: rootFolderName || config?.rootFolderName || 'Opalopy',
                                };
                                
                                console.log('💾 Guardando configuración desde URL:', { connected: newConfig.connected, hasToken: !!newConfig.accessToken });
                                googleDriveService.setTokens(accessToken, refreshToken || '');
                                await onConfigChange(newConfig);
                                console.log('✅ Configuración guardada exitosamente desde URL');
                                setSuccess('Conectado exitosamente a Google Drive');
                                setIsConnecting(false);
                                
                                // Limpiar URL
                                window.history.replaceState({}, document.title, window.location.pathname);
                                
                                setTimeout(() => loadFolders(), 1000);
                            } catch (error) {
                                console.error('❌ Error procesando parámetros de URL:', error);
                                setError('Error al procesar la conexión: ' + (error as Error).message);
                                setIsConnecting(false);
                            }
                        })();
                    } else {
                        console.log('⚠️ No se encontraron parámetros en URL, el popup se cerró sin completar la conexión');
                        setIsConnecting(false);
                    }
                }, 1000); // Esperar 1 segundo para dar tiempo a que llegue el mensaje
            }
        }, 500);
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

    const loadRootFolders = async () => {
        if (!config?.connected || !config.accessToken) return;

        setIsLoadingRootFolders(true);
        setError(null);
        try {
            googleDriveService.initialize(config);
            // Listar todas las carpetas en la raíz de Google Drive (sin parent)
            const foldersList = await googleDriveService.listFolders();
            setAvailableRootFolders(foldersList);
        } catch (err: any) {
            console.error('Error cargando carpetas raíz:', err);
            setError(err.message || 'Error al cargar carpetas raíz de Google Drive');
        } finally {
            setIsLoadingRootFolders(false);
        }
    };

    const handleSearchFolders = async () => {
        if (!config?.connected || !config.accessToken || !searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        setError(null);
        try {
            googleDriveService.initialize(config);
            const results = await googleDriveService.searchFolders(searchQuery.trim());
            setSearchResults(results);
        } catch (err: any) {
            console.error('Error buscando carpetas:', err);
            setError(err.message || 'Error al buscar carpetas en Google Drive');
        } finally {
            setIsSearching(false);
        }
    };

    // Buscar automáticamente cuando el usuario escribe (con debounce)
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const timeoutId = setTimeout(() => {
            handleSearchFolders();
        }, 500); // Esperar 500ms después de que el usuario deje de escribir

        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

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

            {/* Información adicional y explicación */}
            {config?.connected && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                        <Info className="w-4 h-4 mr-2" />
                        ¿Cómo funciona el almacenamiento?
                    </h4>
                    <div className="text-sm text-blue-800 space-y-2">
                        <p>
                            <strong>Carpeta raíz:</strong> Todos los archivos se almacenan en la carpeta raíz configurada (por defecto <strong>"Opalopy"</strong>). Puedes cambiarla haciendo clic en "Cambiar" arriba.
                        </p>
                        <p>
                            <strong>Organización por proceso:</strong> Puedes configurar una carpeta específica para cada proceso de contratación. 
                            Ve a <strong>Procesos → Editar Proceso</strong> y busca la sección "Carpeta de Google Drive".
                        </p>
                        <p>
                            <strong>Dónde se suben los archivos:</strong>
                        </p>
                        <ul className="list-disc list-inside ml-2 space-y-1">
                            <li>Si el proceso tiene una carpeta configurada → Los archivos se suben a esa carpeta</li>
                            <li>Si el proceso NO tiene carpeta → Los archivos se suben directamente a "Opalopy"</li>
                        </ul>
                        <p className="mt-2">
                            <strong>Botón "Actualizar carpetas":</strong> Lista las carpetas disponibles dentro de "Opalopy" para que puedas asignarlas a procesos.
                        </p>
                    </div>
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
                            <div className="flex items-center justify-between">
                                <p><strong>Carpeta raíz:</strong> {config.rootFolderName || 'Opalopy'}</p>
                                <button
                                    onClick={() => {
                                        setShowRootFolderSelector(!showRootFolderSelector);
                                        if (!showRootFolderSelector) {
                                            loadRootFolders();
                                        }
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                    Cambiar
                                </button>
                            </div>
                        )}
                    </div>
                    {showRootFolderSelector && (
                        <div className="mt-3 p-3 bg-white rounded-md border border-blue-200">
                            <p className="text-xs text-blue-900 mb-3 font-medium">Selecciona cualquier carpeta de Google Drive:</p>
                            
                            {/* Buscador */}
                            <div className="mb-3">
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Buscar carpeta por nombre..."
                                        className="w-full pl-8 pr-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                {searchQuery.trim() && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {isSearching ? 'Buscando...' : searchResults.length > 0 ? `${searchResults.length} carpeta(s) encontrada(s)` : 'No se encontraron carpetas'}
                                    </p>
                                )}
                            </div>

                            {/* Resultados de búsqueda o carpetas raíz */}
                            {searchQuery.trim() ? (
                                // Mostrar resultados de búsqueda
                                isSearching ? (
                                    <p className="text-xs text-gray-500 text-center py-4">Buscando carpetas...</p>
                                ) : searchResults.length > 0 ? (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {searchResults.map((folder) => (
                                            <button
                                                key={folder.id}
                                                onClick={async () => {
                                                    try {
                                                        const newConfig = {
                                                            ...config!,
                                                            rootFolderId: folder.id,
                                                            rootFolderName: folder.name,
                                                        };
                                                        await onConfigChange(newConfig);
                                                        setShowRootFolderSelector(false);
                                                        setSearchQuery('');
                                                        setSearchResults([]);
                                                        setSuccess(`Carpeta raíz cambiada a: ${folder.name}`);
                                                    } catch (error: any) {
                                                        setError('Error al cambiar carpeta raíz: ' + error.message);
                                                    }
                                                }}
                                                className={`w-full text-left p-2 rounded text-xs ${
                                                    config?.rootFolderId === folder.id
                                                        ? 'bg-blue-100 border border-blue-300'
                                                        : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                                                }`}
                                            >
                                                <Folder className="w-3 h-3 inline mr-1" />
                                                {folder.name}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 text-center py-4">No se encontraron carpetas con ese nombre</p>
                                )
                            ) : (
                                // Mostrar carpetas raíz cuando no hay búsqueda
                                isLoadingRootFolders ? (
                                    <p className="text-xs text-gray-500 text-center py-4">Cargando carpetas raíz...</p>
                                ) : availableRootFolders.length > 0 ? (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {availableRootFolders.map((folder) => (
                                            <button
                                                key={folder.id}
                                                onClick={async () => {
                                                    try {
                                                        const newConfig = {
                                                            ...config!,
                                                            rootFolderId: folder.id,
                                                            rootFolderName: folder.name,
                                                        };
                                                        await onConfigChange(newConfig);
                                                        setShowRootFolderSelector(false);
                                                        setSuccess(`Carpeta raíz cambiada a: ${folder.name}`);
                                                    } catch (error: any) {
                                                        setError('Error al cambiar carpeta raíz: ' + error.message);
                                                    }
                                                }}
                                                className={`w-full text-left p-2 rounded text-xs ${
                                                    config?.rootFolderId === folder.id
                                                        ? 'bg-blue-100 border border-blue-300'
                                                        : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                                                }`}
                                            >
                                                <Folder className="w-3 h-3 inline mr-1" />
                                                {folder.name}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 text-center py-4">No hay carpetas en la raíz. Usa el buscador para encontrar carpetas.</p>
                                )
                            )}
                        </div>
                    )}
                    <div className="mt-3 flex space-x-2">
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

