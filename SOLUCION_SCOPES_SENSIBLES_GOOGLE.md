# 🔧 Solución: Scopes Sensibles que Requieren Verificación

## 🔴 Problema

Google está pidiendo verificación porque los scopes que solicitamos son considerados "sensitive" o "restricted". El mensaje indica que los usuarios verán la pantalla de "app no verificada".

## ✅ Soluciones

### Opción 1: Usar Scopes Menos Sensibles (Temporal)

Podemos cambiar a scopes menos sensibles que no requieren verificación:

**Scopes actuales (sensibles):**
- `drive.file` - Crear y editar archivos
- `drive.metadata.readonly` - Leer metadatos
- `userinfo.email` - Obtener email
- `userinfo.profile` - Obtener perfil

**Scopes alternativos (menos sensibles):**
- `drive.file` - Solo archivos creados por la app (más limitado pero no requiere verificación)
- `userinfo.email` - Obtener email (generalmente no requiere verificación)

### Opción 2: Verificar la App (Recomendado para Producción)

Para usar todos los scopes sin restricciones, necesitas verificar la app:

1. Ve a Google Cloud Console → **"Verification Center"** o **"OAuth consent screen"**
2. Completa el proceso de verificación:
   - Información de la app
   - Scopes que solicitas
   - Política de privacidad
   - Términos de servicio
   - Video de demostración (si es necesario)
3. Google revisará tu app (puede tardar varios días)

### Opción 3: Agregar Usuarios de Prueba (Si Está Disponible)

Si la opción de agregar usuarios está disponible en otra sección:

1. Ve a **"OAuth consent screen"** → **"Test users"** (no "Audience")
2. O busca **"Users and access"** en el menú lateral
3. Agrega usuarios de prueba allí

---

## 🎯 Recomendación

**Para empezar rápido**: Usa la Opción 1 (scopes menos sensibles) para que funcione inmediatamente.

**Para producción**: Verifica la app (Opción 2) para tener acceso completo.

---

## 📝 Cambiar a Scopes Menos Sensibles

Puedo modificar el código para usar solo `drive.file` (que es más limitado pero no requiere verificación). Esto permitirá:
- ✅ Crear archivos en Google Drive
- ✅ Editar archivos creados por la app
- ❌ NO podrá acceder a archivos existentes en Google Drive

¿Quieres que modifique el código para usar scopes menos sensibles?

