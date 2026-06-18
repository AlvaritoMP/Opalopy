/** Textos de ayuda para interpretar indicadores del Panel (contactología, registros, citas). */

export const CONTACTOLOGY_DEFS = {
    tiempoPrimerContacto:
        'Promedio desde la fecha de alta del registro (created_at) hasta el primer intento con botón de contacto (llamada, WhatsApp o correo). Incluye intentos fallidos y efectivos (no contestó, sin respuesta, contestó, etc.). No cuenta cambios de estado manual, deshacer ni reinicios. Solo entran al promedio candidatos que ya fueron contactados.',
    reaccionMasRapida:
        'Consultor con menor tiempo promedio al 1.er contacto entre los registros creados en la semana en curso (misma regla de intento con botón que arriba).',
    intentosHastaRespuesta:
        'Promedio de intentos (cualquier canal) hasta la primera respuesta del candidato: contestó, interesado o no interesado. Distinto del tiempo al 1.er contacto: aquí se mide cuántas veces hubo que intentar, no cuánto tardó en días.',
    ratioConInteres:
        'Porcentaje de contactos clasificados como Interesado sobre el total clasificado (Interesado + No interesado). Usa intentos registrados y estados en columnas de contacto. No incluye «solo contestó» sin clasificar interés.',
    ratioSinInteres:
        'Porcentaje de contactos clasificados como No interesado sobre el total clasificado (Interesado + No interesado). Complementa el ratio con interés; ambos suman 100 % del universo clasificado.',
    evolucionSemanaEnCurso:
        'Cohorte de registros creados en la semana actual. Línea azul: tiempo promedio acumulado al 1.er intento (min, h o d según magnitud). Barras verdes: contrataciones por día de contrato (hora Lima).',
    contactadosPorSemana:
        'Por semana de alta del registro: barras azules = registros ya contactados (≥1 intento con botón); verdes = contratados esa semana. Línea azul = tiempo promedio al 1.er intento solo entre los contactados (* = semana en curso, parcial).',
    resultadoLlamadas:
        'Desglose por tipo de resultado en llamadas donde el candidato respondió o marcó interés/desinterés por teléfono en el periodo seleccionado.',
    intentosHastaContactoDist:
        'Cuántos candidatos necesitaron 1, 2, 3… intentos (cualquier canal) antes de la primera respuesta del candidato en el periodo seleccionado.',
    seccionAvanzada:
        'El periodo semanal/mensual/anual aplica a la fecha del intento. El tiempo al 1.er contacto y los gráficos por semana usan la fecha de alta (created_at) como inicio de cohorte.',
} as const;

export const CONTACT_CHANNEL_DEFS = {
    masLlamadas: 'Consultor con más intentos de llamada registrados con botón en el periodo.',
    masWhatsapp: 'Consultor con más intentos de WhatsApp registrados con botón en el periodo.',
    masCorreos: 'Consultor con más intentos de correo registrados con botón en el periodo.',
    llamadasEfectivas: 'Consultor con más llamadas que terminaron en «Interesado» (botón o menú) en el periodo.',
    canalMasUsado: 'Canal con más acciones de contacto (intentos fallidos + efectivos) en el periodo.',
    mayorEfectividad: 'Canal con mayor % de acciones que terminaron en «Interesado» en el periodo.',
    intentosTotales: 'Acciones con botón de contacto en el periodo. Total = fallidos + efectivos (marcar Interesado cuenta como efectivo).',
    intentosFallidos: 'Intentos sin marcar interés: no contestó, sin respuesta, ocupado, etc.',
    intentosEfectivos: 'Intentos que terminaron en «Interesado» (botón o cambio de estado a interesado en ese canal).',
} as const;

export const REGISTRATION_DEFS = {
    origenRegistros:
        'Cuántos registros vienen de postulación directa por formulario Tally vs altas hechas en el ATS (manual, Excel o importación). La latencia Tally→ATS solo se muestra cuando hay ambas fechas (envío del formulario y alta en sistema).',
    latenciaTally:
        'Tiempo entre el envío del formulario Tally (first_application_at) y el alta en el ATS (created_at). Solo aplica a postulaciones por formulario; altas manuales no tienen este dato.',
    intervaloAltas:
        'Tiempo promedio entre altas consecutivas según created_at de los candidatos en el filtro actual.',
    franjaMayor:
        'Franja horaria (hora Lima) con más postulaciones directas por formulario en el filtro.',
    graficoFranjas:
        'Formulario = postulación Tally por franja de first_application_at. Manual (ATS) = alta por reclutador según created_at. Contratados = fecha de contrato en esa franja.',
} as const;

export const SCHEDULING_DEFS = {
    totalAgendas:
        'Acciones de agenda y reagenda registradas en el periodo (fecha de la acción, hora Lima). Incluye datos de columnas Próxima entrevista y citas personalizadas reconciliadas.',
    citasAsistencia:
        'Ciclos de cita cerrados con asistencia confirmada en el periodo (fecha de asistencia o apertura del ciclo).',
    promedioHastaAsistir:
        'Promedio de acciones (agenda + reagendas) que necesitó cada candidato que finalmente asistió.',
    quienMasAgenda: 'Trabajador que registró más acciones de agenda o reagenda en el periodo.',
    tasaAsistencia:
        'Candidatos únicos que asistieron ÷ candidatos únicos con al menos una agenda en el periodo.',
    contratadosTrasAsistir:
        'De quienes asistieron, cuántos fueron contratados (etapa de contratación o lista de contratados del proceso).',
    diasAgendaAsistencia:
        'Promedio en días desde la primera agenda del candidato hasta marcar asistencia.',
    diasAgendaContratacion:
        'Promedio en días desde la primera agenda hasta la fecha de contratación, entre candidatos agendados que fueron contratados.',
    evolucionAgendas:
        'Cantidad diaria de acciones de agenda y reagenda según la fecha en que se registró cada acción (hora Lima).',
    asistenciasVsContratados:
        'Por día: citas con asistencia registrada vs contrataciones (fecha del evento, hora Lima). Permite comparar volumen de asistencia y cierre.',
    embudo:
        'Candidatos únicos en el periodo: cuántos fueron agendados, cuántos asistieron y cuántos de los agendados terminaron contratados. Los tiempos en días están en las tarjetas superiores.',
    efectividadAgendas:
        'Por candidato único agendado en el periodo: Efectiva = asistió a la cita · Sin asistencia = cita cancelada o cerrada sin asistencia · Sin resultado = ciclo abierto o sin dato de cierre. Atribución por quien hizo la primera agenda.',
    efectividadPorUsuario:
        'Misma clasificación que el gráfico general, desglosada por consultor que registró la primera agenda del candidato.',
} as const;

export const HIRED_PROFILE_DEF =
    'Promedios y valores más frecuentes (moda) calculados solo sobre candidatos contratados en el filtro actual. Agrupa demografía, origen, tiempos de contacto y citas.';

/** Leyenda unificada para la línea de tiempo al 1.er contacto en gráficos */
export const FIRST_CONTACT_LINE_LABEL = 'Tiempo prom. al 1.er contacto';
