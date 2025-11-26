# Instrucciones para Agregar Columnas Province y District

Este documento explica cómo agregar las columnas `province` y `district` a la tabla `candidates` en Supabase.

## 📋 Prerrequisitos

- Acceso a tu proyecto en Supabase
- Permisos de administrador en el proyecto

## 🚀 Pasos para Ejecutar la Migración

### Paso 1: Abrir SQL Editor en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Inicia sesión en tu cuenta
3. Selecciona tu proyecto
4. En el menú lateral izquierdo, haz clic en **"SQL Editor"** (Editor SQL)

### Paso 2: Ejecutar el Script de Migración

1. Haz clic en el botón **"New query"** (Nueva consulta) o selecciona un query existente
2. Abre el archivo `MIGRATION_ADD_PROVINCE_DISTRICT.sql` en tu proyecto local
3. Copia **todo el contenido** del archivo
4. Pega el contenido en el SQL Editor de Supabase
5. Haz clic en el botón **"Run"** (Ejecutar) o presiona `Ctrl+Enter` (Windows/Linux) o `Cmd+Enter` (Mac)

### Paso 3: Verificar que la Migración se Ejecutó Correctamente

Después de ejecutar el script, deberías ver:

1. Un mensaje de éxito que indica que las columnas se agregaron
2. Una tabla con 2 filas mostrando las columnas `province` y `district` con:
   - `column_name`: province o district
   - `data_type`: text
   - `is_nullable`: YES

## ✅ Verificación Adicional (Opcional)

Si quieres verificar manualmente que las columnas existen:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'candidates' 
  AND column_name IN ('province', 'district')
ORDER BY column_name;
```

Deberías ver 2 filas: una para `province` y otra para `district`.

## 🎯 Después de Ejecutar la Migración

Una vez ejecutada la migración:

1. Las columnas `province` y `district` estarán disponibles en la tabla `candidates`
2. Los candidatos existentes tendrán estos campos como `NULL`
3. Puedes actualizar candidatos existentes con información de provincia y distrito
4. Los nuevos candidatos pueden incluir provincia y distrito desde el inicio

## 🔍 Solución de Problemas

### Error: "permission denied"

- Verifica que tienes permisos de administrador en el proyecto
- Asegúrate de estar usando la cuenta correcta

### Error: "column already exists"

- Esto significa que las columnas ya existen (no es un problema)
- Puedes ignorar este error y continuar

### Las columnas no aparecen después de ejecutar

- Refresca la página del SQL Editor
- Ve a **Table Editor** → **candidates** y verifica las columnas manualmente
- Si no aparecen, ejecuta el script nuevamente

## 📝 Notas Importantes

- La migración usa `IF NOT EXISTS`, por lo que es seguro ejecutarla múltiples veces
- Las columnas son de tipo `TEXT` y pueden ser `NULL` (opcionales)
- El distrito puede quedar en blanco según los requisitos del sistema
- Los valores se almacenan en mayúsculas según los datos UBIGEO

## 🔗 Archivos Relacionados

- `MIGRATION_ADD_PROVINCE_DISTRICT.sql` - Script de migración
- `lib/api/candidates.ts` - Código que usa estas columnas
- `lib/ubicaciones.json` - Datos UBIGEO completos

