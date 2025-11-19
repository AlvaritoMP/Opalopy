# 🚀 Desplegar Backend SIN GOOGLE_REDIRECT_URI (Solución al Problema)

## ✅ Problema Resuelto

El backend ahora puede desplegarse **SIN** `GOOGLE_REDIRECT_URI` inicialmente. Construirá la URL automáticamente desde la request.

---

## 📋 Pasos para Desplegar

### Paso 1: Configurar Variables de Entorno Mínimas

En Easypanel, agrega estas variables (sin `GOOGLE_REDIRECT_URI`):

```env
PORT=5000
FRONTEND_URL=https://opalo-atsalfaoro.bouasv.easypanel.host
GOOGLE_CLIENT_ID=tu_client_id_de_google_cloud
GOOGLE_CLIENT_SECRET=tu_client_secret_de_google_cloud
SESSION_SECRET=genera_un_secret_aleatorio_aqui
```

**⚠️ NO incluyas `GOOGLE_REDIRECT_URI` todavía**

---

### Paso 2: Deploy

1. Haz clic en **"Deploy"** o **"Save"**
2. Espera a que termine el build
3. **Anota la URL** que te da Easypanel (ej: `https://backend-abc123.easypanel.host`)

---

### Paso 3: Verificar que Funciona

1. Abre en tu navegador: `https://url-del-backend/health`
2. Deberías ver:
   ```json
   {
     "status": "ok",
     "timestamp": "...",
     "service": "ATS Pro Backend - Google Drive API"
   }
   ```

---

### Paso 4: Actualizar Variables de Entorno

Ahora que tienes la URL del backend:

1. Ve a las variables de entorno del backend en Easypanel
2. **Agrega**:
   ```
   GOOGLE_REDIRECT_URI=https://url-del-backend/api/auth/google/callback
   ```
   (Reemplaza `url-del-backend` con la URL real)
3. **Redeploy** el backend

---

### Paso 5: Actualizar Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** → **Credentials**
3. Haz clic en tu OAuth Client ID
4. En **"Authorized JavaScript origins"**, agrega:
   - `https://url-del-backend` (sin `/api/...`)
5. En **"Authorized redirect URIs"**, agrega:
   - `https://url-del-backend/api/auth/google/callback`
6. Haz clic en **"Save"**

---

### Paso 6: Configurar Frontend

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

1. ✅ Despliega el backend **SIN** `GOOGLE_REDIRECT_URI`
2. ✅ Obtén la URL del backend
3. ✅ Agrega `GOOGLE_REDIRECT_URI` con la URL real
4. ✅ Redeploy el backend
5. ✅ Actualiza Google Cloud Console
6. ✅ Configura `VITE_API_URL` en el frontend

---

## 🔍 Cómo Funciona

El backend ahora:
- Si `GOOGLE_REDIRECT_URI` está configurada → la usa
- Si NO está configurada → construye la URL automáticamente desde la request usando:
  - `x-forwarded-proto` o `req.protocol` (https)
  - `x-forwarded-host` o `req.headers.host` (el dominio)
  - Construye: `https://dominio/api/auth/google/callback`

Esto permite que el backend funcione desde el primer deploy, incluso sin la variable configurada.

---

## ⚠️ Nota Importante

Aunque el backend funciona sin `GOOGLE_REDIRECT_URI`, es **recomendable** configurarla después del primer deploy para:
- Mayor seguridad
- Evitar problemas con proxies/load balancers
- Mejor rendimiento

Pero ya no es **obligatorio** para el primer deploy. ✅

