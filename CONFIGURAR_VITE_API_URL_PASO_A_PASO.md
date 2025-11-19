# 🔧 Configurar VITE_API_URL - Paso a Paso

## 📍 Tu Situación Actual

- **Frontend URL**: `https://opalo-atsalfaoro.bouasv.easypanel.host/`
- **Problema**: El frontend intenta conectarse a `localhost:5000` en lugar del backend en producción

## ✅ Solución

### Opción A: Si YA tienes el backend desplegado

1. **Identifica la URL de tu backend**:
   - Ve a Easypanel
   - Busca tu aplicación **backend** (debe ser una app separada)
   - Anota la URL (ej: `https://backend-xyz.easypanel.host`)

2. **Configura `VITE_API_URL` en el frontend**:
   - Ve a tu app frontend en Easypanel
   - Environment Variables
   - Agrega: `VITE_API_URL=https://url-de-tu-backend.easypanel.host`
   - Rebuild

### Opción B: Si NO tienes el backend desplegado aún

Necesitas desplegar el backend primero. Sigue estos pasos:

#### Paso 1: Crear Nueva App para el Backend

1. En Easypanel, haz clic en **"+ Service"** o **"Nuevo Servicio"**
2. Selecciona **"App"** o **"Aplicación"**
3. Configura:
   - **Name**: `ats-backend` (o el nombre que prefieras)
   - **Source**: Tu repositorio Git
   - **Branch**: `main`
   - **Root Directory**: `backend` ⚠️ IMPORTANTE

#### Paso 2: Configurar Build

- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Port**: `5000`

#### Paso 3: Configurar Variables de Entorno del Backend

Agrega estas variables:

```
PORT=5000
FRONTEND_URL=https://opalo-atsalfaoro.bouasv.easypanel.host
GOOGLE_CLIENT_ID=tu_client_id_de_google
GOOGLE_CLIENT_SECRET=tu_client_secret_de_google
GOOGLE_REDIRECT_URI=https://url-del-backend/api/auth/google/callback
SESSION_SECRET=genera_un_secret_aleatorio
```

**⚠️ IMPORTANTE**: 
- `GOOGLE_REDIRECT_URI` necesitará la URL del backend, pero primero despliega para obtenerla
- Puedes actualizarla después del primer deploy

#### Paso 4: Deploy y Obtener URL

1. Haz clic en **"Deploy"**
2. Espera a que termine
3. **Anota la URL** que te da Easypanel (ej: `https://backend-abc123.easypanel.host`)

#### Paso 5: Actualizar Variables del Backend

1. Ve a las variables de entorno del backend
2. Actualiza `GOOGLE_REDIRECT_URI` con la URL real:
   ```
   GOOGLE_REDIRECT_URI=https://url-del-backend/api/auth/google/callback
   ```
3. Redeploy el backend

#### Paso 6: Configurar Frontend

1. Ve a tu app frontend en Easypanel
2. Environment Variables
3. Agrega:
   ```
   VITE_API_URL=https://url-del-backend
   ```
   (Reemplaza con la URL real del backend)
4. **Rebuild** el frontend

---

## 🔍 Cómo Identificar si Tienes Backend

En Easypanel, busca en la lista de servicios:
- ¿Hay una app llamada "backend" o similar?
- ¿Hay una app con puerto 5000?
- ¿Hay una app que no sea el frontend?

Si no encuentras ninguna, necesitas crear el backend (Opción B).

---

## 📝 Resumen de URLs Necesarias

### Para el Backend (Variables de Entorno):
```
FRONTEND_URL=https://opalo-atsalfaoro.bouasv.easypanel.host
GOOGLE_REDIRECT_URI=https://url-del-backend/api/auth/google/callback
```

### Para el Frontend (Variables de Entorno):
```
VITE_API_URL=https://url-del-backend
```

### Para Google Cloud Console:
```
Authorized redirect URIs: https://url-del-backend/api/auth/google/callback
```

---

## ⚠️ Recordatorios

1. ✅ El backend y frontend son **dos apps separadas** en Easypanel
2. ✅ El backend necesita `Root Directory: backend`
3. ✅ Después de agregar `VITE_API_URL`, **SIEMPRE haz rebuild** del frontend
4. ✅ La URL del backend debe ser `https://` (no `http://`)

