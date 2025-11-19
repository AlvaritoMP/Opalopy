import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// Obtener redirect URI desde variable de entorno o construirla desde la request
const getRedirectUri = (req) => {
    // Si está en variable de entorno, usarla
    if (process.env.GOOGLE_REDIRECT_URI) {
        return process.env.GOOGLE_REDIRECT_URI;
    }
    
    // Si no, construirla desde la request (útil para el primer deploy)
    if (req) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        return `${protocol}://${host}/api/auth/google/callback`;
    }
    
    // Fallback para desarrollo local
    return process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';
};

// Crear cliente OAuth2 (se inicializará dinámicamente)
let oauth2Client = null;

const getOAuth2Client = (req = null) => {
    if (!oauth2Client || !process.env.GOOGLE_REDIRECT_URI) {
        const redirectUri = getRedirectUri(req);
        oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            redirectUri
        );
    }
    return oauth2Client;
};

// Scopes necesarios para Google Drive
// Usando scopes menos sensibles que no requieren verificación de la app
const SCOPES = [
    'https://www.googleapis.com/auth/drive.file', // Crear y editar archivos (solo los creados por la app)
    'https://www.googleapis.com/auth/userinfo.email', // Obtener email del usuario
];
// Nota: drive.metadata.readonly y userinfo.profile son scopes sensibles que requieren verificación
// drive.file es suficiente para crear y editar archivos en carpetas que la app crea

/**
 * Genera la URL de autenticación de Google
 */
export const getAuthUrl = (req = null) => {
    const client = getOAuth2Client(req);
    return client.generateAuthUrl({
        access_type: 'offline', // Necesario para obtener refresh token
        scope: SCOPES,
        prompt: 'consent', // Fuerza a pedir permisos para obtener refresh token
    });
};

/**
 * Intercambia el código de autorización por tokens
 */
export const getTokensFromCode = async (code, req = null) => {
    try {
        const client = getOAuth2Client(req);
        const { tokens } = await client.getToken(code);
        return tokens;
    } catch (error) {
        console.error('Error obteniendo tokens:', error);
        throw error;
    }
};

/**
 * Refresca el access token usando el refresh token
 */
export const refreshAccessToken = async (refreshToken, req = null) => {
    try {
        const client = getOAuth2Client(req);
        client.setCredentials({
            refresh_token: refreshToken,
        });
        const { credentials } = await client.refreshAccessToken();
        return credentials;
    } catch (error) {
        console.error('Error refrescando token:', error);
        throw error;
    }
};

/**
 * Obtiene información del usuario desde Google
 */
export const getUserInfo = async (accessToken, req = null) => {
    try {
        const client = getOAuth2Client(req);
        client.setCredentials({
            access_token: accessToken,
        });
        const oauth2 = google.oauth2({ version: 'v2', auth: client });
        const { data } = await oauth2.userinfo.get();
        return {
            email: data.email,
            name: data.name || data.email,
            picture: data.picture,
        };
    } catch (error) {
        console.error('Error obteniendo información del usuario:', error);
        throw error;
    }
};

/**
 * Crea o obtiene la carpeta raíz en Google Drive
 * Si no se especifica un nombre, usa "ATS Pro" por defecto
 */
export const getOrCreateRootFolder = async (accessToken, req = null, folderName = 'ATS Pro') => {
    try {
        const client = getOAuth2Client(req);
        client.setCredentials({
            access_token: accessToken,
        });
        const drive = google.drive({ version: 'v3', auth: client });

        // Buscar carpeta existente
        const response = await drive.files.list({
            q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
        });

        if (response.data.files && response.data.files.length > 0) {
            return response.data.files[0].id;
        }

        // Crear carpeta si no existe
        const folder = await drive.files.create({
            requestBody: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
            },
            fields: 'id',
        });

        return folder.data.id;
    } catch (error) {
        console.error('Error creando/obteniendo carpeta raíz:', error);
        throw error;
    }
};

export { getOAuth2Client };

