import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';

console.log('🔵 Cargando webhookRoutes...');
import webhookRoutes from './routes/webhooks.js';
console.log('🔵 webhookRoutes cargado:', webhookRoutes ? 'OK' : 'ERROR');

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// Permitir múltiples orígenes para desarrollo, webhooks y despliegues compartidos
const allowedOrigins = [
    'http://localhost:3000',  // Opalopy desarrollo
    'http://localhost:3001',  // Desarrollo alternativo
    'http://localhost:5173',  // Vite por defecto
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_OPALOPY,
    process.env.FRONTEND_URL_OPALO_ATS,
].filter(Boolean); // Eliminar valores undefined/null

// Middleware CORS - Permitir todos los orígenes para webhooks
app.use((req, res, next) => {
    // Para webhooks, permitir todos los orígenes
    if (req.path && req.path.includes('/webhooks/')) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
    }
    next();
});

app.use(cors({
    origin: (origin, callback) => {
        // Permitir requests sin origin (Postman, curl, webhooks, etc.)
        if (!origin) {
            console.log('🔍 Request sin origin - permitiendo (webhook/curl)');
            return callback(null, true);
        }
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️  CORS bloqueado para origen: ${origin}`);
            // Permitir siempre para desarrollo/debugging
            callback(null, true);
        }
    },
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log(`🔍 Request URL completa: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
    next();
});

// Rutas
app.use('/api/auth', authRoutes);
console.log('🔵 Registrando ruta /api/webhooks');
app.use('/api/webhooks', webhookRoutes);
console.log('🔵 Ruta /api/webhooks registrada correctamente');

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'Opalopy Backend - Google Drive API'
    });
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Iniciar servidor
// Escuchar en 0.0.0.0 para que sea accesible desde Caddy/proxy
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor backend corriendo en http://0.0.0.0:${PORT}`);
    console.log(`📡 Frontend URL: ${FRONTEND_URL}`);
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';
    console.log(`🔐 Google OAuth Redirect URI: ${redirectUri}`);
    if (!process.env.GOOGLE_CLIENT_ID) {
        console.log(`⚠️  ADVERTENCIA: GOOGLE_CLIENT_ID no está configurada. Google Drive no funcionará.`);
    }
    console.log(`\n✅ Backend listo para recibir peticiones`);
});
