# 🔧 Solución: Backend Usando Caddy en Lugar de Node.js

## 🔴 Problema

El backend está usando Caddy (para servir archivos estáticos) en lugar de ejecutar el servidor Node.js. Por eso cuando accedes a `/api/auth/google/drive` te lleva al login de la app (el frontend) en lugar de redirigir a Google.

## ✅ Solución

### Paso 1: Verificar Root Directory en Easypanel

1. Ve a tu app **backend** en Easypanel
2. Verifica que **Root Directory** sea exactamente:
   ```
   backend
   ```
   (Sin barra al final, sin espacios)

### Paso 2: Verificar que NO Haya Caddyfile en la Carpeta Backend

El backend NO debe tener un `Caddyfile`. Si lo tiene, elimínalo.

### Paso 3: Verificar el Comando de Start

En Easypanel, verifica que el comando de start sea:
```
node src/server.js
```

O si usas npm:
```
npm start
```

**NO debe ser**: `caddy run ...`

### Paso 4: Redeploy el Backend

1. En Easypanel, haz clic en **"Redeploy"** o **"Rebuild"**
2. Espera a que termine
3. Verifica los logs para asegurarte de que dice:
   ```
   🚀 Servidor backend corriendo en http://localhost:5000
   ```

### Paso 5: Verificar que Funciona

1. Abre: `https://opalo-ats-backend.bouasv.easypanel.host/health`
2. Deberías ver:
   ```json
   {
     "status": "ok",
     "timestamp": "...",
     "service": "ATS Pro Backend - Google Drive API"
   }
   ```

Si ves esto, el backend está funcionando correctamente.

---

## 🔍 Verificación en Easypanel

En la configuración de tu app backend, verifica:

- [ ] **Root Directory**: `backend` (exactamente así)
- [ ] **Build Method**: `Nixpacks`
- [ ] **Start Command**: `node src/server.js` o `npm start`
- [ ] **Port**: `5000` (en variables de entorno)

---

## 📝 Nota

El problema es que Nixpacks está detectando el `Caddyfile` de la raíz del proyecto (del frontend) y lo está usando para el backend. Al configurar el **Root Directory** como `backend`, Nixpacks debería usar solo los archivos de esa carpeta y ejecutar el servidor Node.js.

---

## 🆘 Si Sigue Sin Funcionar

1. **Elimina la app backend** en Easypanel
2. **Crea una nueva app** desde cero
3. Configura:
   - **Source**: Tu repositorio Git
   - **Branch**: `main`
   - **Root Directory**: `backend` ⚠️ MUY IMPORTANTE
   - **Build Method**: `Nixpacks`
4. **Variables de entorno**:
   ```
   PORT=5000
   FRONTEND_URL=https://opalo-atsalfaoro.bouasv.easypanel.host
   GOOGLE_CLIENT_ID=tu_client_id
   GOOGLE_CLIENT_SECRET=tu_client_secret
   SESSION_SECRET=tu_secret
   ```
5. **Deploy**

