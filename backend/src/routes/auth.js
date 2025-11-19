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

        // Crear o obtener carpeta raíz "ATS Pro"
        const rootFolderId = await getOrCreateRootFolder(tokens.access_token, req);

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
        };

        // Enviar datos al frontend mediante postMessage
        // El frontend abrirá esta URL en un popup
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Autenticación exitosa</title>
            </head>
            <body>
                <script>
                    // Enviar datos al window.opener (el popup del frontend)
                    if (window.opener) {
                        window.opener.postMessage(${JSON.stringify(responseData)}, '${frontendUrl}');
                        window.close();
                    } else {
                        // Si no hay opener, redirigir directamente
                        window.location.href = '${frontendUrl}/settings?drive_connected=true';
                    }
                </script>
                <p>Autenticación exitosa. Esta ventana se cerrará automáticamente...</p>
            </body>
            </html>
        `;

        res.send(html);
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

