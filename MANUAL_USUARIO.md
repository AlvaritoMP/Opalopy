# Manual de Usuario - ATS Pro

## Índice
1. [Introducción](#introducción)
2. [Acceso al Sistema](#acceso-al-sistema)
3. [Manual para Reclutador](#manual-para-reclutador)
4. [Manual para Cliente](#manual-para-cliente)
5. [Manual para Consulta (Viewer)](#manual-para-consulta-viewer)

---

## Introducción

ATS Pro es un sistema de gestión de talento (Applicant Tracking System) diseñado para facilitar el proceso de reclutamiento y selección de personal. Este manual le guiará en el uso de todas las funcionalidades disponibles según su rol en el sistema.

### Roles del Sistema

- **Reclutador**: Gestiona procesos de selección, candidatos, formularios y genera reportes
- **Cliente**: Visualiza procesos y candidatos, puede mover candidatos entre etapas y ver reportes
- **Consulta (Viewer)**: Solo visualiza información, sin capacidad de edición

---

## Acceso al Sistema

1. Abra su navegador web y acceda a la URL proporcionada por su administrador
2. Ingrese su **correo electrónico** y **contraseña**
3. Haga clic en **"Iniciar Sesión"**
4. Si olvidó su contraseña, contacte al administrador del sistema

---

## Manual para Reclutador

### Secciones Disponibles

El rol de Reclutador tiene acceso a las siguientes secciones:
- Panel (Dashboard)
- Procesos
- Archivados
- Candidatos
- Formularios
- Cartas
- Calendario
- Reportes
- Comparador
- Importación Masiva

---

### 1. Panel (Dashboard)

**Ubicación**: Menú lateral → Panel

**Descripción**: Vista general con estadísticas y gráficos del sistema.

**Funcionalidades**:
- **Tarjetas de Estadísticas**: Muestra métricas clave:
  - Total de Procesos
  - Total de Candidatos
  - Candidatos Activos
  - Entrevistas Programadas
- **Gráficos**:
  - Distribución de candidatos por proceso
  - Candidatos por fuente (LinkedIn, Referido, Sitio web, Otro)
  - Candidatos por etapa
  - Progreso de procesos

**Cómo usar**:
- El dashboard se actualiza automáticamente con los datos del sistema
- Use los filtros para ver estadísticas específicas por período o proceso

---

### 2. Procesos

**Ubicación**: Menú lateral → Procesos

**Descripción**: Gestión de procesos de selección.

#### 2.1. Lista de Procesos

**Vista**: Lista de todos los procesos de selección activos.

**Información mostrada**:
- Título del proceso
- Estado (En Proceso, Stand By, Terminado)
- Número de vacantes
- Cantidad de candidatos
- Fechas de inicio y fin

**Acciones disponibles**:
- **Ver proceso**: Haga clic en un proceso para ver su detalle
- **Crear proceso**: Botón "Nuevo Proceso" (arriba a la derecha)
- **Filtrar**: Use los filtros para buscar procesos por estado o nombre

#### 2.2. Crear Proceso

**Cómo crear un proceso**:
1. Haga clic en **"Nuevo Proceso"**
2. Complete el formulario:
   - **Título**: Nombre del proceso (ej: "Desarrollador Full Stack")
   - **Descripción**: Detalles del puesto
   - **Rango salarial**: Ej: "$50,000 - $70,000"
   - **Nivel de experiencia**: Junior, Semi-senior, Senior
   - **Seniority**: Nivel jerárquico
   - **Código de orden de servicio**: Identificador interno
   - **Fecha de inicio**: Cuándo inicia el proceso
   - **Fecha de fin**: Fecha límite (opcional)
   - **Estado**: En Proceso, Stand By, Terminado
   - **Vacantes**: Número de posiciones disponibles
3. **Configurar Etapas**:
   - Haga clic en **"Agregar Etapa"**
   - Ingrese el nombre de la etapa (ej: "Revisión CV", "Entrevista Técnica", "Oferta")
   - Arrastre las etapas para reordenarlas
   - Puede marcar etapas como requeridas para avanzar
4. **Categorías de Documentos** (Opcional):
   - Haga clic en **"Agregar Categoría"**
   - Defina categorías de documentos requeridos (ej: "CV", "DNI", "Contrato")
   - Marque si son obligatorios
5. **Carpeta de Google Drive** (Si está configurado):
   - Seleccione o cree una carpeta en Google Drive para almacenar documentos del proceso
6. Haga clic en **"Guardar"**

#### 2.3. Editar Proceso

**Cómo editar**:
1. En la lista de procesos, haga clic en el proceso deseado
2. Haga clic en el botón **"Editar"** (icono de lápiz)
3. Modifique los campos necesarios
4. Haga clic en **"Guardar"**

#### 2.4. Eliminar Proceso

**Cómo eliminar**:
1. En la lista de procesos, haga clic en el menú de tres puntos (⋮) del proceso
2. Seleccione **"Eliminar"**
3. Confirme la eliminación

**⚠️ Advertencia**: Al eliminar un proceso, también se eliminarán todos los candidatos asociados.

#### 2.5. Vista de Proceso (Board)

**Descripción**: Vista tipo Kanban con candidatos organizados por etapas.

**Funcionalidades**:
- **Columnas**: Cada columna representa una etapa del proceso
- **Tarjetas de Candidatos**: Cada tarjeta muestra:
  - Foto del candidato
  - Nombre
  - Etapa actual
  - Indicadores visuales

**Acciones en el Board**:
- **Mover candidato**: Arrastre y suelte una tarjeta entre columnas para cambiar su etapa
- **Ver detalles**: Haga clic en una tarjeta para ver información completa
- **Agregar candidato**: Botón **"Agregar Candidato"** en la parte superior
- **Filtros**: Filtre candidatos por nombre, email o etapa
- **Búsqueda**: Use la barra de búsqueda para encontrar candidatos específicos

**Botones adicionales**:
- **Documentos del Proceso**: Ver documentos adjuntos al proceso
- **Cartas Masivas**: Generar cartas para múltiples candidatos
- **Exportar**: Exportar información del proceso

---

### 3. Candidatos

**Ubicación**: Menú lateral → Candidatos

**Descripción**: Gestión completa de candidatos en el sistema.

#### 3.1. Agregar Candidato

**Desde el Board de un Proceso**:
1. Haga clic en **"Agregar Candidato"**
2. Complete el formulario:
   - **Nombre completo**: Nombre y apellidos
   - **Correo electrónico**: Email de contacto
   - **Teléfono**: Número de contacto
   - **Edad**: Edad del candidato
   - **DNI**: Documento de identidad
   - **Dirección**: Ciudad o dirección
   - **LinkedIn**: URL del perfil de LinkedIn
   - **Fuente**: Cómo llegó el candidato (LinkedIn, Referido, Sitio web, Otro)
   - **Expectativa salarial**: Rango salarial esperado
   - **Resumen**: Descripción o notas sobre el candidato
   - **Foto**: Suba una foto del candidato (opcional)
   - **Documentos**: Adjunte documentos (CV, DNI, etc.)
3. Haga clic en **"Agregar Candidato"**

**Nota**: El candidato se agregará automáticamente a la primera etapa del proceso.

#### 3.2. Detalles del Candidato

**Cómo acceder**:
- Haga clic en cualquier tarjeta de candidato en el board
- O desde la lista de candidatos

**Pestañas disponibles**:

##### Pestaña "Detalles"
- **Información Personal**:
  - Nombre, email, teléfono
  - Botones de contacto rápido:
    - 📋 Copiar teléfono
    - 📞 Llamar
    - 💬 Mensaje WhatsApp
    - 📞 Llamada WhatsApp
  - LinkedIn, edad, DNI, dirección
  - Fuente, expectativa salarial
  - Fecha de contratación (si aplica)
- **Resumen**: Descripción del candidato
- **Adjuntos**: Lista de documentos adjuntos
  - **Previsualizar**: Ver documento
  - **Descargar**: Descargar archivo
  - **Eliminar**: Eliminar documento
  - **Subir documento**: Agregar nuevos documentos

**Acciones en Detalles**:
- **Editar**: Modificar información del candidato
- **Archivar**: Mover candidato a archivados
- **Eliminar**: Eliminar candidato del sistema
- **Mover/Duplicar**: Cambiar de proceso o duplicar en otro proceso
- **Exportar ZIP**: Descargar toda la información del candidato en un archivo ZIP

##### Pestaña "Historial"
- Muestra el historial de movimientos del candidato entre etapas
- Fecha de cada movimiento
- Usuario que realizó el movimiento

##### Pestaña "Agenda"
- **Entrevistas programadas**: Lista de entrevistas
- **Agendar entrevista**: Botón para crear nueva entrevista
  - Título de la entrevista
  - Fecha y hora de inicio
  - Fecha y hora de fin
  - Entrevistador
  - Notas
  - Emails de asistentes
- **Acciones**: Editar o eliminar entrevistas

##### Pestaña "Comentarios"
- Chat/comentarios sobre el candidato
- Agregar comentarios con texto
- Adjuntar imágenes a los comentarios
- Ver historial de conversaciones

##### Pestaña "Documentos"
- **Checklist de Documentos**: Lista de documentos requeridos por etapa
- Ver qué documentos faltan para avanzar a la siguiente etapa
- Marcar documentos como completados

#### 3.3. Mover Candidato entre Etapas

**Método 1 - Arrastrar y Soltar**:
1. En el board del proceso, arrastre la tarjeta del candidato
2. Suéltela en la columna de la etapa deseada

**Método 2 - Desde Detalles**:
1. Abra los detalles del candidato
2. Use el selector de etapa en la parte superior
3. Seleccione la nueva etapa

#### 3.4. Archivar Candidato

**Cómo archivar**:
1. Abra los detalles del candidato
2. Haga clic en el botón **"Archivar"**
3. Confirme la acción

**Candidatos Archivados**: Los candidatos archivados no aparecen en el board pero se pueden ver en la sección "Archivados".

#### 3.5. Restaurar Candidato Archivado

1. Vaya a **Archivados** en el menú lateral
2. Busque el candidato
3. Abra sus detalles
4. Haga clic en **"Restaurar"**

---

### 4. Archivados

**Ubicación**: Menú lateral → Archivados

**Descripción**: Vista de todos los candidatos archivados.

**Funcionalidades**:
- Ver lista de candidatos archivados
- Buscar candidatos archivados
- Restaurar candidatos
- Ver detalles completos
- Eliminar permanentemente

---

### 5. Formularios

**Ubicación**: Menú lateral → Formularios

**Descripción**: Gestión de formularios de aplicación para candidatos.

#### 5.1. Lista de Formularios

Muestra todos los formularios creados en el sistema.

#### 5.2. Crear Formulario

1. Haga clic en **"Nuevo Formulario"**
2. Complete:
   - **Nombre del formulario**
   - **Proceso asociado**: Seleccione el proceso
   - **Campos**: Agregue campos personalizados
3. **Configurar integración** (opcional):
   - Plataforma (Google Forms, Typeform, etc.)
   - URL del formulario
   - Webhook para recibir respuestas
4. Haga clic en **"Guardar"**

#### 5.3. Editar/Eliminar Formulario

- Use los botones de acción en cada formulario
- Puede editar o eliminar formularios existentes

---

### 6. Cartas

**Ubicación**: Menú lateral → Cartas

**Descripción**: Generación de cartas de oferta y felicitación.

#### 6.1. Crear Carta

1. Haga clic en **"Nueva Carta"**
2. **Seleccionar candidato**: Elija el candidato para quien se generará la carta
3. **Seleccionar plantilla**: 
   - Suba una plantilla en formato Word (.docx)
   - O use una plantilla existente
4. **Campos dinámicos**: 
   - El sistema detecta automáticamente los campos en la plantilla
   - Los campos se completan automáticamente con datos del candidato
   - Puede editar los valores antes de generar
5. **Resumen de datos**: Revise todos los datos que se insertarán
6. Haga clic en **"Generar y Descargar"**

**Campos dinámicos comunes**:
- `{{Nombre}}`: Nombre del candidato
- `{{Email}}`: Correo electrónico
- `{{Telefono}}`: Teléfono
- `{{Puesto}}`: Nombre del proceso/puesto
- `{{Fecha}}`: Fecha actual
- Y más según los datos del candidato

**Nota**: Las cartas generadas se guardan automáticamente en Google Drive (si está configurado) en la carpeta "Cartas".

---

### 7. Calendario

**Ubicación**: Menú lateral → Calendario

**Descripción**: Vista de calendario con todas las entrevistas programadas.

**Funcionalidades**:
- **Vista mensual**: Ver todas las entrevistas del mes
- **Vista semanal**: Ver entrevistas de la semana
- **Vista diaria**: Ver entrevistas del día
- **Crear entrevista**: Haga clic en una fecha/hora para crear nueva entrevista
- **Ver detalles**: Haga clic en una entrevista para ver/editar detalles
- **Exportar**: Generar archivo .ics para agregar a su calendario
- **Enviar invitación**: Enviar invitación por email

**Filtros**:
- Filtrar por proceso
- Filtrar por entrevistador
- Filtrar por candidato

---

### 8. Reportes

**Ubicación**: Menú lateral → Reportes

**Descripción**: Generación de reportes y estadísticas.

**Tipos de reportes disponibles**:
- Reporte de procesos
- Reporte de candidatos
- Reporte de entrevistas
- Estadísticas por período

**Cómo generar un reporte**:
1. Seleccione el tipo de reporte
2. Configure filtros (fechas, procesos, etc.)
3. Haga clic en **"Generar Reporte"**
4. Descargue el reporte en PDF o Excel

---

### 9. Comparador

**Ubicación**: Menú lateral → Comparador

**Descripción**: Comparación visual de candidatos con gráficos y tablas.

#### 9.1. Crear Comparación

1. Haga clic en **"Nueva Comparación"**
2. **Seleccionar candidatos**: Elija los candidatos a comparar (mínimo 2)
3. **Agregar widgets**:
   - **Gráficos**: Barras, líneas, radar, pie, área
   - **Tablas**: Tablas de datos
   - **Listas**: Listas de información
4. **Configurar cada widget**:
   - Seleccione qué datos mostrar
   - Configure ejes, colores, etiquetas
   - Para gráficos radar, configure múltiples ejes
5. **Datos manuales** (opcional):
   - Agregue datos que no estén en la base de datos
   - Use tablas editables para ingresar información
6. **Exportar**:
   - **PDF**: Genera reporte en PDF con todos los gráficos
   - **Word**: Genera documento Word con la comparación

**Nota**: Los reportes generados se guardan en Google Drive en la carpeta "Reportes".

---

### 10. Importación Masiva

**Ubicación**: Menú lateral → Importación Masiva

**Descripción**: Importar múltiples candidatos desde un archivo Excel.

#### 10.1. Importar Candidatos

1. **Preparar archivo Excel**:
   - Descargue la plantilla de ejemplo
   - Complete con los datos de los candidatos
   - Columnas requeridas: Nombre, Email, Proceso
   - Columnas opcionales: Teléfono, LinkedIn, etc.
2. **Subir archivo**:
   - Haga clic en **"Seleccionar archivo"**
   - Elija su archivo Excel
3. **Mapear columnas**:
   - El sistema detecta automáticamente las columnas
   - Verifique que el mapeo sea correcto
4. **Revisar datos**:
   - Vea una vista previa de los candidatos a importar
   - Corrija errores si los hay
5. Haga clic en **"Importar"**

**Resultado**: Los candidatos se crearán automáticamente en el proceso seleccionado.

---

## Manual para Cliente

### Secciones Disponibles

El rol de Cliente tiene acceso a:
- Panel (Dashboard)
- Procesos
- Candidatos
- Calendario
- Reportes
- Comparador

### Diferencias con Reclutador

**Lo que SÍ puede hacer**:
- Ver todos los procesos y candidatos
- Mover candidatos entre etapas (drag & drop en el board)
- Ver detalles completos de candidatos
- Ver calendario de entrevistas
- Generar reportes
- Comparar candidatos
- Agregar comentarios a candidatos

**Lo que NO puede hacer**:
- Crear, editar o eliminar procesos
- Crear, editar o eliminar candidatos
- Archivar candidatos
- Gestionar formularios
- Generar cartas
- Importar candidatos masivamente
- Gestionar usuarios
- Acceder a configuración

### Guía de Uso

Siga las mismas instrucciones del Manual para Reclutador para las secciones a las que tiene acceso, pero tenga en cuenta las limitaciones mencionadas arriba.

**Uso principal**: Los clientes suelen usar el sistema para:
1. Revisar candidatos en los procesos asignados
2. Mover candidatos entre etapas según su evaluación
3. Ver reportes de progreso
4. Comparar candidatos para tomar decisiones

---

## Manual para Consulta (Viewer)

### Secciones Disponibles

El rol de Consulta (Viewer) tiene acceso solo a:
- Panel (Dashboard)
- Procesos
- Candidatos
- Calendario
- Reportes

### Limitaciones

**Solo visualización**: Este rol tiene acceso de solo lectura a todas las secciones.

**Lo que NO puede hacer**:
- Crear, editar o eliminar procesos
- Crear, editar o eliminar candidatos
- Mover candidatos entre etapas
- Archivar candidatos
- Agregar comentarios
- Generar reportes (solo ver)
- Comparar candidatos
- Cualquier acción de edición

### Guía de Uso

**Panel**: Ver estadísticas generales del sistema

**Procesos**: 
- Ver lista de procesos
- Abrir procesos para ver el board
- Ver candidatos en cada etapa

**Candidatos**:
- Ver lista de candidatos
- Abrir detalles de candidatos
- Ver historial, entrevistas, comentarios y documentos
- **No puede editar** ninguna información

**Calendario**:
- Ver entrevistas programadas
- **No puede crear o editar** entrevistas

**Reportes**:
- Ver reportes existentes
- **No puede generar** nuevos reportes

**Uso principal**: Este rol es ideal para stakeholders que necesitan monitorear el progreso sin realizar cambios.

---

## Funcionalidades Comunes

### Búsqueda

La mayoría de secciones tienen una barra de búsqueda:
- Busque por nombre, email, teléfono
- Los resultados se filtran en tiempo real

### Filtros

Use los filtros disponibles para:
- Filtrar por proceso
- Filtrar por etapa
- Filtrar por fecha
- Filtrar por estado

### Exportar Datos

Varias secciones permiten exportar:
- **ZIP**: Exportar información completa de un candidato
- **PDF**: Generar reportes en PDF
- **Excel**: Exportar listas a Excel
- **Word**: Generar documentos en Word

### Google Drive (Si está configurado)

Si el sistema está conectado a Google Drive:
- Los documentos se guardan automáticamente en Google Drive
- Cada proceso tiene su carpeta
- Cada candidato tiene su carpeta dentro del proceso
- Las cartas y reportes se guardan en carpetas específicas

---

## Preguntas Frecuentes

### ¿Cómo cambio mi contraseña?
Contacte al administrador del sistema para cambiar su contraseña.

### ¿Puedo ver candidatos de otros procesos?
Sí, puede ver todos los candidatos del sistema según su rol.

### ¿Cómo agrego documentos a un candidato?
1. Abra los detalles del candidato
2. Vaya a la pestaña "Detalles"
3. En la sección "Adjuntos", haga clic en "Subir documento"
4. Seleccione el archivo y la categoría (si aplica)

### ¿Cómo programo una entrevista?
1. Abra los detalles del candidato
2. Vaya a la pestaña "Agenda"
3. Haga clic en "Agendar entrevista"
4. Complete los datos y guarde

### ¿Qué pasa si archivo un candidato?
El candidato desaparece del board pero se mantiene en el sistema. Puede restaurarlo desde la sección "Archivados".

---

## Soporte

Para soporte técnico o preguntas, contacte a su administrador del sistema o al equipo de soporte.

---

**Versión del Manual**: 1.0  
**Fecha de actualización**: 2024

