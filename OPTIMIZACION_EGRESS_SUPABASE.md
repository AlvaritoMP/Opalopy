# Optimización de Egress Usage en Supabase

## 🔴 Problema

El egress (transferencia de datos) de Supabase se excede fácilmente porque:

1. **Se cargan TODAS las columnas** (`select('*')`) incluso las que no se usan
2. **Se cargan TODAS las relaciones** (attachments, comments, history) siempre, incluso cuando no se necesitan
3. **No hay paginación** - se cargan hasta 1000 registros de una vez
4. **Attachments se cargan siempre** - estos pueden ser muy grandes (archivos)
5. **No hay caché** - cada recarga descarga todo de nuevo

## ✅ Soluciones Implementadas

### 1. Seleccionar Solo Campos Necesarios
En lugar de `select('*')`, ahora se seleccionan solo los campos que realmente se usan.

### 2. Lazy Loading de Relaciones Pesadas
- **Attachments**: Solo se cargan cuando se abren detalles de un candidato/proceso
- **Comments**: Solo se cargan cuando se necesita ver comentarios
- **History**: Se carga pero con campos limitados

### 3. Paginación
- Cargar solo 50-100 registros por vez en lugar de 1000
- Cargar más cuando el usuario hace scroll o cambia de página

### 4. Caché en Frontend
- Guardar datos en localStorage
- Solo recargar cuando hay cambios reales
- Invalidar caché después de crear/actualizar/eliminar

### 5. Campos Mínimos para Listas
- En listas, solo cargar: id, name, email, stage_id, process_id
- Cargar detalles completos solo cuando se abre un registro específico

## 📊 Impacto Esperado

**Antes:**
- 100 candidatos = ~5-10 MB de egress
- 1000 candidatos = ~50-100 MB de egress

**Después:**
- 100 candidatos (lista) = ~0.5-1 MB de egress
- 1000 candidatos (lista) = ~5-10 MB de egress
- **Reducción del 80-90% en egress**

## 🚀 Próximos Pasos

1. Implementar paginación en las vistas de lista
2. Agregar caché con invalidación inteligente
3. Lazy load de attachments y comentarios
4. Monitorear egress después de los cambios

