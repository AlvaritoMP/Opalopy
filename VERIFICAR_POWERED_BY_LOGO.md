# Verificar que POWERED BY Logo Funcione

## 🔍 Pasos para Verificar

### 1. Ejecutar Migración SQL (CRÍTICO)

**IMPORTANTE**: Antes de que el logo funcione, necesitas ejecutar la migración SQL en Supabase:

1. Ve a Supabase Dashboard: https://supabase.com
2. Selecciona tu proyecto
3. Ve a **SQL Editor**
4. Abre el archivo `MIGRATION_ADD_POWERED_BY_LOGO.sql`
5. Copia y pega el contenido
6. Haz clic en **Run**
7. Verifica que veas el mensaje de confirmación

**Sin esta migración, el campo no existirá en la base de datos y el logo no se guardará.**

### 2. Verificar que el Deploy se Completó

1. Verifica en tu plataforma de deploy (Easypanel) que el último commit se haya desplegado
2. Espera a que el build termine completamente
3. Recarga la aplicación con Ctrl+F5 (forzar recarga sin caché)

### 3. Subir el Logo

1. Inicia sesión en la aplicación
2. Ve a **Settings** (Configuración)
3. En la sección **Branding**, busca **"POWERED BY Logo"**
4. Haz clic en **"Upload POWERED BY Logo"**
5. Selecciona tu imagen
6. Haz clic en **"Save Changes"** (botón arriba a la derecha)
7. Espera a que se guarde

### 4. Verificar en el Sidebar

1. Después de guardar, el logo debería aparecer automáticamente en el footer del sidebar
2. Debe aparecer debajo de todas las secciones
3. Debe mostrar el texto "POWERED BY" arriba del logo

## 🐛 Si No Funciona

### Problema 1: No veo el campo en Settings

**Solución**: 
- Verifica que el deploy se haya completado
- Recarga la página con Ctrl+F5
- Verifica en la consola del navegador si hay errores

### Problema 2: El logo no se guarda

**Solución**:
- **Ejecuta la migración SQL** (paso 1 arriba)
- La columna `powered_by_logo_url` debe existir en la tabla `app_settings`
- Verifica en Supabase → Table Editor → app_settings que la columna existe

### Problema 3: El logo no aparece en el sidebar

**Solución**:
- Verifica que hayas guardado los settings después de subir el logo
- Abre la consola del navegador (F12) y verifica si hay errores
- Verifica que `state.settings?.poweredByLogoUrl` tenga un valor
- Puedes verificar en la consola: `console.log(state.settings?.poweredByLogoUrl)`

### Problema 4: Error al guardar

**Solución**:
- Si ves un error sobre "column does not exist" o "schema cache", ejecuta la migración SQL
- Si ves un error de CORS, verifica la configuración de CORS en Supabase
- Revisa los logs de Supabase para ver errores específicos

## 🔧 Verificar Manualmente en Supabase

Para verificar que la columna existe:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'app_settings' 
  AND column_name = 'powered_by_logo_url';
```

Si no devuelve resultados, la columna no existe y necesitas ejecutar la migración.

## 📝 Notas

- El logo se guarda como base64 en la base de datos
- Si el logo es muy grande (>1MB), puede causar problemas
- El logo solo se muestra si está configurado (no es obligatorio)

