# 🚀 Configurar Backend en Easypanel - Guía Paso a Paso

## ✅ Respuesta Rápida

**Elige: Nixpacks** ✅

---

## 📋 Configuración Completa del Backend

### Paso 1: Seleccionar Método de Build

En Easypanel, cuando te pregunte por el método de build:

**Selecciona: Nixpacks** ✅

**¿Por qué Nixpacks?**
- ✅ Detecta automáticamente Node.js
- ✅ Ejecuta `npm ci` automáticamente
- ✅ Usa el comando `npm start` del `package.json`
- ✅ Ya tenemos `nixpacks.toml` configurado

---

### Paso 2: Configuración de la App

1. **Name**: `ats-backend` (o el nombre que prefieras)
2. **Source**: Tu repositorio Git
3. **Branch**: `main` (o la rama que uses)
4. **Root Directory**: `backend` ⚠️ **MUY IMPORTANTE**

---

### Paso 3: Configuración de Build (Nixpacks)

Nixpacks detectará automáticamente:
- **Build Command**: `npm ci` (instala dependencias)
- **Start Command**: `npm start` (ejecuta `node src/server.js`)
- **Port**: `5000` (configúralo en las variables de entorno)

---

### Paso 4: Variables de Entorno (Primer Deploy)

Haz clic en **"Environment Variables"** y agrega:

```env
PORT=5000
FRONTEND_URL=https://opalo-atsalfaoro.bouasv.easypanel.host
GOOGLE_CLIENT_ID=tu_client_id_de_google_cloud
GOOGLE_CLIENT_SECRET=tu_client_secret_de_google_cloud
SESSION_SECRET=genera_un_secret_aleatorio_aqui
```

**✅ IMPORTANTE**:
- **NO incluyas `GOOGLE_REDIRECT_URI` todavía** - El backend la construirá automáticamente
- `SESSION_SECRET`: Genera uno aleatorio (ej: `openssl rand -hex 32`)

---

### Paso 5: Deploy

1. Haz clic en **"Deploy"** o **"Save"**
2. Espera a que termine el build
3. **Anota la URL** que te da Easypanel (ej: `https://backend-abc123.easypanel.host`)

---

### Paso 6: Verificar que Funciona

1. Abre en tu navegador: `https://url-del-backend/health`
2. Deberías ver:
   ```json
   {
     "status": "ok",
     "timestamp": "...",
     "service": "ATS Pro Backend - Google Drive API"
   }
   ```

**✅ El backend ya funciona sin `GOOGLE_REDIRECT_URI`** - La construye automáticamente.

---

### Paso 7: (Opcional) Actualizar Variables de Entorno

Aunque el backend funciona sin `GOOGLE_REDIRECT_URI`, es recomendable agregarla:

1. Ve a las variables de entorno del backend
2. **Agrega**:
   ```
   GOOGLE_REDIRECT_URI=https://url-del-backend/api/auth/google/callback
   ```
   (Reemplaza `url-del-backend` con la URL real)
3. **Redeploy** el backend

**Nota**: Esto es opcional pero recomendado para mayor seguridad y rendimiento.

---

### Paso 8: Actualizar Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** → **Credentials**
3. Haz clic en tu OAuth Client ID
4. En **"Authorized JavaScript origins"**, agrega:
   - `https://url-del-backend` (sin `/api/...`)
5. En **"Authorized redirect URIs"**, agrega:
   - `https://url-del-backend/api/auth/google/callback`
6. Haz clic en **"Save"**

---

### Paso 9: Configurar Frontend

1. Ve a tu app **frontend** en Easypanel
2. **Environment Variables**
3. Agrega:
   ```
   VITE_API_URL=https://url-del-backend
   ```
   (Reemplaza con la URL real del backend)
4. **Rebuild** el frontend

---

## ✅ Resumen

1. ✅ Selecciona **Nixpacks** como método de build
2. ✅ Root Directory: `backend`
3. ✅ Configura las variables de entorno
4. ✅ Deploy y anota la URL
5. ✅ Actualiza `GOOGLE_REDIRECT_URI` y redeploy
6. ✅ Actualiza Google Cloud Console
7. ✅ Configura `VITE_API_URL` en el frontend y rebuild

---

## 🔍 Troubleshooting

### Error: "Cannot find module"
- Verifica que `Root Directory` sea `backend`
- Verifica que `package.json` esté en `backend/package.json`

### Error: "Port already in use"
- Verifica que `PORT=5000` esté en las variables de entorno

### Error: "CORS error"
- Verifica que `FRONTEND_URL` sea correcta
- Debe ser `https://opalo-atsalfaoro.bouasv.easypanel.host` (sin `/` al final)

### El backend no responde
- Verifica que el puerto sea `5000`
- Revisa los logs en Easypanel
- Prueba `/health` endpoint

