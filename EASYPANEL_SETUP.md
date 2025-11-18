# Configuración Completa para Easypanel

## Problema Identificado

Easypanel está usando **Nixpacks** automáticamente en lugar del Dockerfile. Esto requiere una configuración diferente.

## Solución: Configurar Variables de Entorno en Easypanel

### Paso 1: Acceder a Variables de Entorno

1. En Easypanel, ve a tu aplicación
2. Busca la sección **"Environment Variables"** o **"Variables de Entorno"**
3. Puede estar en:
   - **Settings** → **Environment Variables**
   - **Configuration** → **Env Vars**
   - **Build Settings** → **Environment Variables**

### Paso 2: Agregar Variables (IMPORTANTE: Configurar como "Build-time")

Agrega estas variables y asegúrate de que estén marcadas como **"Build-time"** o **"Build & Runtime"**:

**Variable 1:**
- **Nombre**: `VITE_SUPABASE_URL`
- **Valor**: `https://afhiiplxqtodqxvmswor.supabase.co`
- **Scope**: **Build-time** o **Build & Runtime** ⚠️ (MUY IMPORTANTE)

**Variable 2:**
- **Nombre**: `VITE_SUPABASE_ANON_KEY`
- **Valor**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmaGlpcGx4cXRvZHF4dm1zd29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4Njg4MTYsImV4cCI6MjA3ODQ0NDgxNn0.r9YmrHHajLsd5YHUkPnmD7UazpvmsW0TfqC5jy0_3ZU`
- **Scope**: **Build-time** o **Build & Runtime** ⚠️ (MUY IMPORTANTE)

**Variable 3 (Opcional):**
- **Nombre**: `GEMINI_API_KEY`
- **Valor**: (tu clave si la tienes)
- **Scope**: **Build-time** o **Build & Runtime**

### Paso 3: Forzar Rebuild

**CRÍTICO**: Después de agregar las variables:

1. Ve a **"Deployments"** o **"Despliegues"**
2. Haz clic en **"Redeploy"** o **"Rebuild"**
3. Esto es **obligatorio** porque las variables `VITE_*` se inyectan durante el build

## Verificación

Después del rebuild, verifica:

1. ✅ El build se completa sin errores
2. ✅ La aplicación carga en el navegador
3. ✅ En la consola del navegador (F12) ves: "Loading data from Supabase..."
4. ✅ No hay errores de conexión a Supabase

## Archivos Creados

He creado estos archivos para facilitar el despliegue:

- `nixpacks.toml`: Configuración para usar Node 20 y Caddy
- `Caddyfile`: Configuración del servidor web
- `package.json`: Actualizado con `engines` para requerir Node 20

## Si Aún No Funciona

Si después de configurar las variables y hacer rebuild aún no funciona:

1. **Verifica en los logs de build** que las variables estén disponibles
2. **Revisa la consola del navegador** para ver errores específicos
3. **Asegúrate de que el scope de las variables sea "Build-time"**

## Nota sobre Nixpacks vs Dockerfile

Easypanel está usando Nixpacks automáticamente. Si prefieres usar el Dockerfile:

1. En la configuración de la aplicación, busca **"Build Method"** o **"Build Type"**
2. Cambia de "Auto" a **"Dockerfile"**
3. Especifica la ruta: `./Dockerfile`

