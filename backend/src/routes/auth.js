import express from 'express';
import { getAuthUrl, getTokensFromCode, getUserInfo, getOrCreateRootFolder, refreshAccessToken } from '../config/googleDrive.js';

const router = express.Router();

/**
 * Inicia el flujo de autenticación OAuth2
 * Redirige al usuario a Google para autorizar la aplicación
 */
router.get('/google/drive', (req, res) => {
    try {
        const authUrl = getAuthUrl(req);
        res.redirect(authUrl);
    } catch (error) {
        console.error('Error generando URL de autenticación:', error);
        res.status(500).json({ error: 'Error al iniciar autenticación' });
    }
});

/**
 * Callback después de que el usuario autoriza la aplicación
 * Google redirige aquí con un código de autorización
 */
router.get('/google/callback', async (req, res) => {
    try {
        const { code, error } = req.query;

        if (error) {
            console.error('Error en callback de OAuth:', error);
            // Redirigir al frontend con error
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            return res.redirect(`${frontendUrl}/settings?error=auth_failed&message=${encodeURIComponent(error)}`);
        }

        if (!code) {
            return res.status(400).json({ error: 'Código de autorización no proporcionado' });
        }

        // Intercambiar código por tokens
        const tokens = await getTokensFromCode(code, req);

        if (!tokens.access_token) {
            throw new Error('No se recibió access token');
        }

        // Obtener información del usuario
        const userInfo = await getUserInfo(tokens.access_token, req);

        // Crear o obtener carpeta raíz "ATS Pro" (por defecto)
        const rootFolderId = await getOrCreateRootFolder(tokens.access_token, req, 'ATS Pro');
        
        // Obtener el nombre de la carpeta raíz
        let rootFolderName = 'ATS Pro';
        try {
            const { google } = await import('googleapis');
            const client = getOAuth2Client(req);
            client.setCredentials({ access_token: tokens.access_token });
            const drive = google.drive({ version: 'v3', auth: client });
            const folderInfo = await drive.files.get({ fileId: rootFolderId, fields: 'name' });
            rootFolderName = folderInfo.data.name || 'ATS Pro';
        } catch (error) {
            console.error('Error obteniendo nombre de carpeta raíz:', error);
        }

        // Preparar datos para enviar al frontend
        const responseData = {
            type: 'GOOGLE_DRIVE_AUTH_SUCCESS',
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : undefined,
            userInfo: {
                email: userInfo.email,
                name: userInfo.name,
            },
            rootFolderId,
            rootFolderName,
        };

        // Redirigir al frontend con los datos en la URL
        // El frontend leerá los parámetros de la URL
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const redirectUrl = new URL(`${frontendUrl}/settings`);
        redirectUrl.searchParams.set('drive_connected', 'true');
        redirectUrl.searchParams.set('access_token', tokens.access_token);
        if (tokens.refresh_token) {
            redirectUrl.searchParams.set('refresh_token', tokens.refresh_token);
        }
        if (tokens.expiry_date) {
            redirectUrl.searchParams.set('expires_in', Math.floor((tokens.expiry_date - Date.now()) / 1000).toString());
        }
        if (userInfo.email) {
            redirectUrl.searchParams.set('user_email', userInfo.email);
        }
        if (userInfo.name) {
            redirectUrl.searchParams.set('user_name', userInfo.name);
        }
        if (rootFolderId) {
            redirectUrl.searchParams.set('root_folder_id', rootFolderId);
        }
        if (rootFolderName) {
            redirectUrl.searchParams.set('root_folder_name', rootFolderName);
        }

        res.redirect(redirectUrl.toString());
    } catch (error) {
        console.error('Error en callback de OAuth:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const errorMessage = error.message || 'Error desconocido';
        res.redirect(`${frontendUrl}/settings?error=auth_failed&message=${encodeURIComponent(errorMessage)}`);
    }
});

/**
 * Endpoint para refrescar el access token
 * El frontend puede llamar esto cuando el token expire
 */
router.post('/google/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token no proporcionado' });
        }

        const credentials = await refreshAccessToken(refreshToken, req);

        res.json({
            accessToken: credentials.access_token,
            refreshToken: credentials.refresh_token || refreshToken, // Mantener el refresh token si no se devuelve uno nuevo
            tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : undefined,
        });
    } catch (error) {
        console.error('Error refrescando token:', error);
        res.status(500).json({ error: error.message || 'Error al refrescar token' });
    }
});

export default router;

