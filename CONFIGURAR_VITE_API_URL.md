# ⚠️ IMPORTANTE: Configurar VITE_API_URL en Easypanel

## 🔴 Problema

El frontend está intentando conectarse a `localhost:5000` en lugar de usar la URL del backend en Easypanel.

**Tu Frontend**: `https://opalo-atsalfaoro.bouasv.easypanel.host/`

## ✅ Solución

### Paso 1: Obtener la URL del Backend

1. Ve a tu aplicación **backend** en Easypanel
2. Anota la URL que te da (ej: `https://backend-abc123.easypanel.host`)
3. O si tienes dominio personalizado: `https://api.tu-dominio.com`

### Paso 2: Configurar VITE_API_URL en el Frontend

1. Ve a tu aplicación **frontend** en Easypanel
2. Ve a **"Environment Variables"** o **"Variables de Entorno"**
3. **Agrega esta variable**:

   ```
   VITE_API_URL=https://tu-backend-url.easypanel.host
   ```

   **Ejemplo:**
   ```
   VITE_API_URL=https://backend-abc123.easypanel.host
   ```

   **⚠️ IMPORTANTE**: 
   - Reemplaza `tu-backend-url.easypanel.host` con la URL REAL de tu backend
   - NO incluyas `/api` al final, solo la URL base
   - Debe ser `https://` (no `http://`)

### Paso 3: Hacer Rebuild del Frontend

**CRÍTICO**: Después de agregar `VITE_API_URL`, debes hacer **rebuild** porque Vite inyecta estas variables durante el build:

1. En Easypanel, ve a tu aplicación frontend
2. Haz clic en **"Redeploy"** o **"Rebuild"**
3. Espera a que termine el build

### Paso 4: Verificar

1. Abre tu aplicación frontend en el navegador
2. Ve a Settings → Almacenamiento de Archivos
3. Haz clic en "Conectar con Google Drive"
4. Ahora debería abrir la URL correcta del backend (no localhost)

---

## 📋 Variables de Entorno Completas para Frontend

En Easypanel Frontend, asegúrate de tener:

```
VITE_SUPABASE_URL=https://afhiiplxqtodqxvmswor.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GEMINI_API_KEY=tu_clave_si_la_tienes
VITE_API_URL=https://tu-backend-url.easypanel.host
```

---

## 🔍 Cómo Verificar que Funciona

1. Abre la consola del navegador (F12)
2. Ve a la pestaña "Network" (Red)
3. Intenta conectar Google Drive
4. Deberías ver una petición a: `https://tu-backend-url.easypanel.host/api/auth/google/drive`
5. NO deberías ver peticiones a `localhost:5000`

---

## ⚠️ Recordatorios

- ✅ `VITE_API_URL` debe configurarse en el **frontend** (no en el backend)
- ✅ Debe ser la URL del **backend Node.js** (no Supabase)
- ✅ Debe incluir `https://` (no `http://`)
- ✅ NO debe incluir `/api` al final
- ✅ Después de agregar, **SIEMPRE haz rebuild** del frontend

