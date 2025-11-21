# Manual de Super Admin - ATS Pro

## Índice
1. [Introducción](#introducción)
2. [Acceso y Seguridad](#acceso-y-seguridad)
3. [Gestión de Usuarios](#gestión-de-usuarios)
4. [Configuración del Sistema](#configuración-del-sistema)
5. [Google Drive](#google-drive)
6. [Todas las Funcionalidades de Reclutador](#todas-las-funcionalidades-de-reclutador)
7. [Mantenimiento y Resolución de Problemas](#mantenimiento-y-resolución-de-problemas)

---

## Introducción

Este manual está dirigido a usuarios con rol de **Super Admin** o **Admin** en el sistema ATS Pro. Como Super Admin, tiene acceso completo a todas las funcionalidades del sistema, incluyendo la gestión de usuarios, configuración del sistema y administración de Google Drive.

### Permisos del Super Admin

El Super Admin tiene acceso a **TODAS** las secciones y funcionalidades:
- Panel (Dashboard)
- Procesos (crear, editar, eliminar)
- Archivados
- Candidatos (crear, editar, eliminar, archivar)
- Formularios
- Cartas
- Calendario
- Reportes
- Comparador
- Importación Masiva
- **Usuarios** (solo Super Admin)
- **Configuración** (solo Super Admin)

---

## Acceso y Seguridad

### Iniciar Sesión como Super Admin

1. Acceda a la URL del sistema
2. Ingrese su correo electrónico y contraseña
3. Verifique que su rol sea "admin" o "superadmin"

### Cambiar Contraseña

Como Super Admin, puede cambiar su propia contraseña desde la sección de Configuración (si está disponible) o contactando al administrador de la base de datos.

### Cerrar Sesión

1. Haga clic en el icono de **cerrar sesión** (LogOut) en la parte inferior del menú lateral
2. O cierre la ventana del navegador

---

## Gestión de Usuarios

**Ubicación**: Menú lateral → Usuarios

### Lista de Usuarios

La vista muestra todos los usuarios registrados en el sistema con:
- Nombre
- Email
- Rol
- Fecha de creación
- Acciones disponibles

### Crear Usuario

1. Haga clic en **"Nuevo Usuario"**
2. Complete el formulario:
   - **Nombre completo**: Nombre y apellidos del usuario
   - **Correo electrónico**: Email único (se usa para login)
   - **Contraseña**: Contraseña inicial (el usuario puede cambiarla después)
   - **Rol**: Seleccione el rol:
     - **Admin**: Acceso completo (similar a Super Admin)
     - **Reclutador**: Gestión de procesos y candidatos
     - **Cliente**: Visualización y movimiento de candidatos
     - **Consulta (Viewer)**: Solo visualización
   - **Foto de perfil**: Suba una foto (opcional)
3. **Permisos** (Opcional):
   - Configure permisos específicos por categoría:
     - **Procesos**: Ver, Crear, Editar, Eliminar
     - **Candidatos**: Ver, Crear, Editar, Eliminar, Archivar, Exportar
     - **Calendario**: Ver, Crear, Editar, Eliminar
     - **Reportes**: Ver, Exportar
     - **Usuarios**: Ver, Crear, Editar, Eliminar
     - **Configuración**: Ver, Editar
     - **Cartas**: Ver, Crear, Descargar
     - **Comparador**: Ver, Exportar
     - **Formularios**: Ver, Editar
4. **Secciones Visibles**:
   - Seleccione qué secciones del menú puede ver el usuario:
     - Panel, Procesos, Archivados, Candidatos, Formularios, Cartas, Calendario, Reportes, Comparador, Importación Masiva, Usuarios, Configuración
   - Puede ocultar secciones específicas según las necesidades
5. Haga clic en **"Guardar"**

### Editar Usuario

1. En la lista de usuarios, haga clic en el usuario que desea editar
2. O haga clic en el botón **"Editar"** (icono de lápiz)
3. Modifique los campos necesarios:
   - Puede cambiar nombre, email, rol
   - Puede actualizar permisos
   - Puede modificar secciones visibles
4. Haga clic en **"Guardar"**

**Nota**: Al cambiar el rol de un usuario, los permisos y secciones se actualizan automáticamente según los valores por defecto del rol, pero puede personalizarlos.

### Eliminar Usuario

1. En la lista de usuarios, haga clic en el botón **"Eliminar"** (icono de papelera)
2. Confirme la eliminación

**⚠️ Advertencia**: 
- Al eliminar un usuario, sus referencias en el sistema se mantienen pero se marcan como "Usuario eliminado"
- Las acciones realizadas por el usuario (comentarios, movimientos, etc.) se conservan para mantener el historial

### Permisos Personalizados

Puede crear configuraciones de permisos personalizadas para cada usuario:

**Ejemplo**: Un usuario "Reclutador Junior" que puede:
- Ver y crear candidatos
- Ver procesos
- Pero NO puede eliminar candidatos ni procesos

Para esto:
1. Al crear/editar usuario, configure los permisos manualmente
2. Desmarque los permisos que NO desea otorgar
3. Guarde los cambios

### Secciones Visibles Personalizadas

Puede controlar qué secciones del menú lateral ve cada usuario:

**Ejemplo**: Un cliente que solo necesita ver procesos y candidatos:
1. Al crear/editar usuario, en "Secciones Visibles"
2. Desmarque todas las secciones excepto:
   - Panel
   - Procesos
   - Candidatos
3. Guarde los cambios

---

## Configuración del Sistema

**Ubicación**: Menú lateral → Configuración

### Información General

#### Nombre de la Aplicación
- Cambie el nombre que aparece en el menú lateral
- Ejemplo: "ATS Pro", "Sistema de Reclutamiento", etc.

#### Logo
- Suba un logo personalizado para la aplicación
- El logo aparece en el menú lateral y en reportes
- Formatos soportados: PNG, JPG, SVG
- Tamaño recomendado: 200x50 píxeles

#### Símbolo de Moneda
- Configure el símbolo de moneda para mostrar salarios
- Ejemplo: "$", "€", "S/", etc.
- Se usa en expectativas salariales y rangos

### Etiquetas Personalizadas

Puede personalizar los textos de la aplicación:

1. Haga clic en **"Personalizar Etiquetas"**
2. Modifique los textos según su preferencia:
   - Títulos de secciones
   - Etiquetas de campos
   - Mensajes
3. Los cambios se aplican inmediatamente en toda la aplicación

### Base de Datos

**⚠️ Solo para administradores técnicos**

Esta sección muestra la configuración de la base de datos. Normalmente no requiere cambios.

### Almacenamiento de Archivos

#### Google Drive (Recomendado)

Vea la sección [Google Drive](#google-drive) más abajo para configuración detallada.

#### Almacenamiento Local

Si no usa Google Drive, los archivos se almacenan localmente en formato Base64. Esto tiene limitaciones de tamaño.

### Guardar Configuración

Después de realizar cambios:
1. Revise todos los cambios
2. Haga clic en **"Guardar Configuración"**
3. Espere la confirmación de guardado

---

## Google Drive

**Ubicación**: Configuración → Google Drive

**⚠️ Solo Super Admin puede configurar Google Drive**

### ¿Por qué usar Google Drive?

- Almacenamiento ilimitado (según su plan de Google)
- Organización automática de documentos
- Acceso desde cualquier lugar
- Respaldos automáticos
- Compartir documentos fácilmente

### Configuración Inicial

#### Paso 1: Crear Proyecto en Google Cloud Console

1. Vaya a [Google Cloud Console](https://console.cloud.google.com/)
2. Cree un nuevo proyecto o seleccione uno existente
3. Habilite la **API de Google Drive**:
   - Vaya a "APIs & Services" → "Library"
   - Busque "Google Drive API"
   - Haga clic en "Enable"

#### Paso 2: Crear Credenciales OAuth 2.0

1. Vaya a "APIs & Services" → "Credentials"
2. Haga clic en "Create Credentials" → "OAuth client ID"
3. Configure:
   - **Application type**: Web application
   - **Name**: ATS Pro (o el nombre que prefiera)
   - **Authorized JavaScript origins**: 
     - `http://localhost:5173` (para desarrollo local)
     - `https://tu-dominio.com` (para producción)
   - **Authorized redirect URIs**:
     - `http://localhost:5000/api/auth/google/callback` (backend local)
     - `https://tu-backend.com/api/auth/google/callback` (backend producción)
4. Guarde y copie:
   - **Client ID**
   - **Client Secret**

#### Paso 3: Configurar OAuth Consent Screen

1. Vaya a "APIs & Services" → "OAuth consent screen"
2. Configure:
   - **User Type**: Internal (si es para organización) o External
   - **App name**: ATS Pro
   - **User support email**: Su email
   - **Developer contact**: Su email
3. Agregue los **Scopes**:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
4. Agregue **Test users** (si la app está en modo testing):
   - Agregue los emails de los usuarios que usarán el sistema
5. Guarde y continúe

#### Paso 4: Configurar en ATS Pro

1. En ATS Pro, vaya a **Configuración → Google Drive**
2. Ingrese:
   - **Client ID**: El Client ID copiado
   - **Client Secret**: El Client Secret copiado
   - **Redirect URI**: Debe coincidir con el configurado en Google Cloud
3. Haga clic en **"Guardar Credenciales"**

#### Paso 5: Conectar Google Drive

1. Haga clic en **"Conectar Google Drive"**
2. Se abrirá una ventana de Google para autorizar
3. Seleccione la cuenta de Google que desea usar
4. Revise los permisos solicitados
5. Haga clic en **"Permitir"**
6. La ventana se cerrará automáticamente
7. Verá el estado "Conectado" en verde

### Configurar Carpeta Raíz

1. Una vez conectado, haga clic en **"Seleccionar Carpeta Raíz"**
2. **Buscar carpeta**:
   - Use la barra de búsqueda para encontrar una carpeta existente
   - O navegue por las carpetas de nivel superior
3. Seleccione la carpeta que será la raíz para todos los archivos del ATS
4. Haga clic en **"Seleccionar"**
5. La carpeta raíz quedará configurada

**Estructura de Carpetas**:
```
[Carpeta Raíz]/
  ├── [Nombre del Proceso]/
  │   ├── [Nombre del Candidato]/
  │   │   ├── CV.pdf
  │   │   ├── DNI.pdf
  │   │   └── ...
  │   └── [Documentos del Proceso]/
  ├── Cartas/
  │   ├── Oferta_Juan_Perez.docx
  │   └── ...
  └── Reportes/
      ├── Comparacion_Candidatos_2024.pdf
      └── ...
```

### Actualizar Carpetas

Si necesita actualizar la lista de carpetas disponibles:
1. Haga clic en **"Actualizar carpetas"**
2. El sistema refrescará la lista de carpetas de Google Drive

### Desconectar Google Drive

1. Haga clic en **"Desconectar"**
2. Confirme la acción
3. Los archivos existentes en Google Drive NO se eliminarán
4. Los nuevos archivos se guardarán localmente

### Solución de Problemas

#### Error 401 (Unauthorized)
- **Causa**: Token de acceso expirado
- **Solución**: 
  1. Desconecte Google Drive
  2. Vuelva a conectar
  3. O espere a que el token se renueve automáticamente

#### Error al buscar carpetas
- **Causa**: Permisos insuficientes
- **Solución**: 
  1. Verifique que los scopes estén correctamente configurados
  2. Asegúrese de que `drive.readonly` esté habilitado
  3. Reconecte Google Drive

#### No se pueden subir archivos
- **Causa**: Permisos de la carpeta
- **Solución**: 
  1. Verifique que la carpeta raíz tenga permisos de escritura
  2. Verifique que el proceso tenga una carpeta configurada
  3. Revise los logs en la consola del navegador

---

## Todas las Funcionalidades de Reclutador

Como Super Admin, tiene acceso a **TODAS** las funcionalidades descritas en el [Manual de Usuario para Reclutador](MANUAL_USUARIO.md#manual-para-reclutador). Consulte ese manual para:

- Panel (Dashboard)
- Gestión de Procesos
- Gestión de Candidatos
- Archivados
- Formularios
- Cartas
- Calendario
- Reportes
- Comparador
- Importación Masiva

**Además**, como Super Admin puede:
- Eliminar procesos y candidatos
- Acceder a todas las configuraciones
- Gestionar usuarios
- Configurar Google Drive

---

## Mantenimiento y Resolución de Problemas

### Verificar Estado del Sistema

#### Revisar Logs
1. Abra la consola del navegador (F12)
2. Revise los mensajes de error o advertencias
3. Los logs muestran:
   - Errores de conexión
   - Problemas con Google Drive
   - Errores de base de datos

#### Verificar Conexión a Base de Datos
- Si los datos no cargan, verifique:
  1. La conexión a Supabase
  2. Las variables de entorno
  3. Los permisos de la base de datos

### Problemas Comunes

#### Los usuarios no pueden iniciar sesión
1. Verifique que el usuario exista en la base de datos
2. Verifique que la contraseña sea correcta
3. Revise los permisos del usuario
4. Verifique que el usuario no esté deshabilitado

#### Los documentos no se suben a Google Drive
1. Verifique que Google Drive esté conectado
2. Revise que la carpeta raíz esté configurada
3. Verifique que el proceso tenga una carpeta asignada
4. Revise los permisos de Google Drive
5. Verifique los logs en la consola

#### Los candidatos no se mueven entre etapas
1. Verifique los permisos del usuario
2. Revise que el proceso tenga etapas configuradas
3. Verifique que no haya restricciones de documentos requeridos
4. Revise los logs de errores

#### Los reportes no se generan
1. Verifique que haya datos para el período seleccionado
2. Revise los permisos del usuario
3. Verifique la conexión a la base de datos
4. Intente generar el reporte con menos datos

### Respaldo de Datos

#### Respaldo Manual
1. Exporte los datos desde Supabase
2. Descargue los archivos de Google Drive
3. Guarde las configuraciones

#### Respaldo Automático
- Supabase realiza respaldos automáticos
- Google Drive mantiene versiones de archivos
- Revise la configuración de respaldos en Supabase

### Actualizar el Sistema

Cuando haya actualizaciones:
1. **Backend**: 
   - Actualice el código en el servidor
   - Reinicie el servicio
   - Verifique que las migraciones de base de datos se ejecuten
2. **Frontend**:
   - Actualice el código
   - Reconstruya la aplicación
   - Verifique que las variables de entorno estén correctas

### Migraciones de Base de Datos

Si necesita ejecutar migraciones:
1. Acceda a Supabase Dashboard
2. Vaya a "SQL Editor"
3. Ejecute las migraciones necesarias
4. Verifique que no haya errores

---

## Mejores Prácticas

### Gestión de Usuarios
- Asigne roles apropiados según las responsabilidades
- Use permisos personalizados solo cuando sea necesario
- Revise periódicamente los usuarios activos
- Elimine usuarios que ya no necesiten acceso

### Organización de Procesos
- Use nombres descriptivos para los procesos
- Configure etapas claras y lógicas
- Asigne carpetas de Google Drive a cada proceso
- Mantenga los procesos actualizados

### Seguridad
- Cambie las contraseñas periódicamente
- No comparta credenciales de Super Admin
- Revise los permisos de usuarios regularmente
- Mantenga Google Drive seguro con permisos apropiados

### Mantenimiento
- Revise los logs regularmente
- Limpie candidatos archivados antiguos si es necesario
- Organice las carpetas de Google Drive
- Actualice el sistema cuando haya nuevas versiones

---

## Preguntas Frecuentes

### ¿Cómo restablezco la contraseña de un usuario?
1. Edite el usuario
2. Cambie la contraseña
3. Informe al usuario de la nueva contraseña
4. Recomiende que la cambie después del primer login

### ¿Puedo tener múltiples Super Admins?
Sí, puede crear múltiples usuarios con rol "admin" o "superadmin".

### ¿Cómo cambio la carpeta raíz de Google Drive?
1. Vaya a Configuración → Google Drive
2. Haga clic en "Seleccionar Carpeta Raíz"
3. Elija la nueva carpeta
4. Los nuevos archivos se guardarán en la nueva ubicación
5. Los archivos existentes NO se moverán automáticamente

### ¿Qué pasa si elimino un proceso?
- El proceso se elimina del sistema
- Todos los candidatos asociados se eliminan
- La carpeta en Google Drive se elimina (si está configurado)
- **⚠️ Esta acción NO se puede deshacer**

### ¿Cómo exporto todos los datos?
- Use la función de exportación de Supabase
- Descargue las carpetas de Google Drive
- Exporte reportes desde cada sección

---

## Contacto y Soporte

Para soporte técnico avanzado o problemas que no pueda resolver:
1. Revise los logs del sistema
2. Documente el problema con capturas de pantalla
3. Contacte al equipo de desarrollo
4. Proporcione:
   - Descripción del problema
   - Pasos para reproducirlo
   - Logs de error
   - Configuración relevante

---

**Versión del Manual**: 1.0  
**Fecha de actualización**: 2024  
**Rol**: Super Admin / Admin

