# Verificar Columna `agreed_salary_in_words`

Si la columna `agreed_salary_in_words` no se está llenando en la base de datos, verifica lo siguiente:

## 1. Verificar si la columna existe

Ejecuta este SQL en Supabase para verificar si la columna existe:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'candidates' 
  AND column_name = 'agreed_salary_in_words';
```

**Si no devuelve resultados**, la columna NO EXISTE y necesitas ejecutar la migración.

## 2. Ejecutar la migración

Si la columna no existe, ejecuta el script de migración:

**Archivo:** `MIGRATION_COMPLETA_CANDIDATES.sql`

Este script agrega todas las columnas nuevas incluyendo `agreed_salary_in_words`.

### Pasos:

1. Ve a tu proyecto en Supabase (https://supabase.com)
2. Abre el **SQL Editor**
3. Copia el contenido completo del archivo `MIGRATION_COMPLETA_CANDIDATES.sql`
4. Pega y ejecuta el script (botón "Run")
5. Verifica que se hayan creado las columnas con el query de verificación

## 3. Verificar datos existentes

Después de ejecutar la migración, para candidatos existentes que ya tienen `agreed_salary`, puedes verificar si tienen `agreed_salary_in_words`:

```sql
SELECT 
    id,
    name,
    agreed_salary,
    agreed_salary_in_words
FROM candidates
WHERE agreed_salary IS NOT NULL 
  AND agreed_salary != ''
ORDER BY created_at DESC
LIMIT 10;
```

## 4. Qué hace el sistema automáticamente

- ✅ **Al crear un candidato** con `agreed_salary`, se genera automáticamente `agreed_salary_in_words`
- ✅ **Al actualizar un candidato** y cambiar `agreed_salary`, se regenera automáticamente `agreed_salary_in_words`
- ✅ **Al actualizar un candidato** que tiene `agreed_salary` pero no tiene `agreed_salary_in_words`, se genera automáticamente

## 5. Ver logs en la consola del navegador

Abre la consola del navegador (F12) y busca mensajes como:

- ✅ `✅ Salario en letras guardado correctamente en la base de datos`
- ❌ `❌ La columna agreed_salary_in_words NO EXISTE en la base de datos`
- ⚠️ `⚠️ Ejecuta el script MIGRATION_COMPLETA_CANDIDATES.sql`

## 6. Si la columna existe pero no se llena

Si la columna existe pero aún no se está llenando, verifica:

1. **Consola del navegador**: Busca errores o warnings
2. **Network tab**: Verifica que las peticiones a Supabase se estén realizando correctamente
3. **Logs de Supabase**: Revisa los logs en el dashboard de Supabase para ver errores

## Formato del salario en letras

El sistema genera el salario en letras en formato peruano:

- `1800` → `"Mil ochocientos y 00/100 soles"`
- `2500` → `"Dos mil quinientos y 00/100 soles"`
- `1800.50` → `"Mil ochocientos y 50/100 soles"`

Este valor se usa automáticamente en las plantillas de Word con el campo `{{Salarioacordadoletras}}`.

