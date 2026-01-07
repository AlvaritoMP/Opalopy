# Solución para Problemas de Timeout con Supabase

## 🔴 Problema

La aplicación está mostrando errores de timeout al cargar datos de Supabase:

```
❌ Failed to load processes from Supabase: Error: Timeout
❌ Failed to load candidates from Supabase: Error: Timeout
❌ Failed to load users from Supabase: Error: Timeout
```

## ✅ Soluciones Implementadas

### 1. Timeout Aumentado
- **Antes**: 10 segundos
- **Ahora**: 30 segundos para la carga inicial
- Esto da más tiempo para que la base de datos responda, especialmente si está "despertando" desde un estado pausado

### 2. Sistema de Reintentos
- **Reintentos automáticos**: Hasta 3 intentos (2 reintentos)
- **Backoff exponencial**: Espera progresivamente más tiempo entre reintentos
- Esto ayuda cuando la base de datos está iniciando o hay problemas temporales de red

### 3. Mejores Mensajes de Error
- Los errores ahora indican si es un timeout específico
- Mensajes más claros para diagnosticar problemas

## 🔍 Posibles Causas del Problema

### 1. Base de Datos Pausada (Más Común)

En el plan gratuito de Supabase, la base de datos se **pausa automáticamente** después de 1 semana de inactividad.

**Solución**:
1. Ve al [Dashboard de Supabase](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Settings** > **Database**
4. Si ves un botón "Resume" o "Unpause", haz clic en él
5. Espera 1-2 minutos para que la base de datos se reactive

**Prevención**:
- Considera actualizar a un plan de pago si necesitas que la base de datos esté siempre activa
- O programa un "ping" periódico para mantener la base de datos activa

### 2. Problemas de Red o Conexión

**Solución**:
- Verifica tu conexión a internet
- Intenta desde otro navegador o dispositivo
- Verifica si hay un firewall bloqueando las conexiones a Supabase

### 3. Límites de Compute Hours Excedidos

Si has excedido los compute hours de tu plan, la base de datos puede estar limitada.

**Solución**:
1. Ve al Dashboard de Supabase
2. Revisa el uso de Compute Hours
3. Espera a que se reinicie el período de facturación
4. O actualiza tu plan

### 4. Problemas con las Políticas RLS (Row Level Security)

Si las políticas RLS están mal configuradas, las consultas pueden fallar.

**Solución**:
1. Ve al Dashboard de Supabase
2. Ve a **Authentication** > **Policies**
3. Verifica que las políticas permitan las operaciones necesarias
4. Revisa los logs de API en **Logs** > **API Logs**

## 🛠️ Verificación

### Paso 1: Verificar Estado de la Base de Datos

1. Abre el [Dashboard de Supabase](https://supabase.com/dashboard)
2. Selecciona tu proyecto: `afhiiplxqtodqxvmswor`
3. Ve a **Settings** > **Database**
4. Verifica el estado de la base de datos

### Paso 2: Verificar Variables de Entorno

Asegúrate de que las variables de entorno estén configuradas correctamente:

```env
VITE_SUPABASE_URL=https://afhiiplxqtodqxvmswor.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

### Paso 3: Verificar en la Consola del Navegador

1. Abre las Developer Tools (F12)
2. Ve a la pestaña **Console**
3. Busca mensajes de error más detallados
4. Ve a la pestaña **Network** y filtra por "supabase.co"
5. Verifica el estado de las peticiones (200 = éxito, timeout = problema)

## 📊 Mejoras Implementadas en el Código

### Antes:
```typescript
setTimeout(() => reject(new Error('Timeout')), 10000) // 10 segundos
```

### Ahora:
```typescript
const timeoutMs = 30000; // 30 segundos
// Con reintentos automáticos (hasta 3 intentos)
// Y backoff exponencial entre reintentos
```

## 🚀 Próximos Pasos

Si el problema persiste después de verificar lo anterior:

1. **Revisa los logs de Supabase**:
   - Dashboard > Logs > API Logs
   - Busca errores específicos

2. **Verifica el estado del proyecto**:
   - Dashboard > Settings > General
   - Verifica que el proyecto esté activo

3. **Contacta con Soporte de Supabase**:
   - Si el problema persiste, puede ser un problema del lado de Supabase
   - Ve a [Supabase Support](https://supabase.com/support)

## 📝 Notas Adicionales

- Los timeouts aumentados y los reintentos solo aplican a la **carga inicial** de datos
- Las operaciones normales (crear, editar, eliminar) mantienen sus timeouts originales
- Si la base de datos está pausada, la primera carga puede tardar más (hasta 1-2 minutos)

## 🔗 Referencias

- [Supabase Database Pausing](https://supabase.com/docs/guides/platform/database-pausing)
- [Supabase Compute Hours](https://supabase.com/docs/guides/platform/compute-hours)
- [Supabase Troubleshooting](https://supabase.com/docs/guides/platform/troubleshooting)
