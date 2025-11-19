import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Middleware
app.use(cors({
    origin: FRONTEND_URL,
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Rutas
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'ATS Pro Backend - Google Drive API'
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
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
    console.log(`📡 Frontend URL: ${FRONTEND_URL}`);
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'Se construirá automáticamente desde la request';
    console.log(`🔐 Google OAuth Redirect URI: ${redirectUri}`);
    if (!process.env.GOOGLE_REDIRECT_URI) {
        console.log(`⚠️  NOTA: GOOGLE_REDIRECT_URI no está configurada. Se construirá automáticamente.`);
        console.log(`   Después del primer deploy, actualiza esta variable con la URL real del backend.`);
    }
    console.log(`\n✅ Backend listo para recibir peticiones`);
});

