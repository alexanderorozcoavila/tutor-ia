## PRD: Optimización de Sincronización de Configuración Móvil
### 1. Resumen Ejecutivo
El proyecto consiste en refactorizar el sistema de actualización de configuración entre una aplicación Node.js (alojada en Render) y un entorno móvil Android (ejecutando Python vía Termux). El objetivo es reemplazar la actual arquitectura de polling (consultas continuas a la API de Supabase) por una *arquitectura orientada a eventos* utilizando NTFY.sh y un sistema de caché mediante archivos locales.
### 2. Definición del Problema
Actualmente, el script de Python en el dispositivo móvil consulta la API de Supabase cada 20 segundos para verificar cambios. Esto genera los siguientes inconvenientes:
 * *Desperdicio de recursos de red:* Genera aproximadamente 130,000 peticiones mensuales, la mayoría redundantes.
 * *Consumo excesivo de batería:* Impide que la antena de red del dispositivo Android entre en estado de reposo (deep sleep).
 * *Latencia intrínseca:* Existe un retraso de hasta 20 segundos en la aplicación de nuevas configuraciones.
 * *Fragilidad estructural:* El script principal es vulnerable a micro-cortes de red, requiriendo un manejo de excepciones complejo para evitar cierres inesperados.
### 3. Solución Propuesta
Desacoplar la lógica de red de la lógica de procesamiento en el dispositivo móvil mediante la creación de dos scripts independientes y un sistema de mensajería push ligero.
> *Nota de Arquitectura:* El sistema operará con un flujo unidireccional reactivo: App Node -> NTFY -> Script A -> Archivo Local -> Script B.
> 
### 4. Requisitos Funcionales
#### 4.1. Aplicación Node (Backend / Render)
 * Tras una actualización exitosa en la base de datos de Supabase, el sistema debe emitir una petición HTTP POST a un canal privado de NTFY.sh.
 * El payload de la petición debe contener la configuración actualizada en formato JSON.
#### 4.2. Script A (Receptor de Red / Termux)
 * Debe establecer y mantener una conexión HTTP en modo streaming constante contra el canal asignado en NTFY.sh.
 * Al recibir un nuevo mensaje, debe extraer el payload JSON.
 * Debe implementar *escritura atómica*: guardar los datos en un archivo temporal (ej. config_temp.json) y luego reemplazar el archivo principal (config.json) mediante una operación del sistema operativo (os.replace).
 * Debe implementar un mecanismo de reconexión automática (Exponential Backoff) en caso de pérdida de señal de internet.
#### 4.3. Script B (Trabajador Principal / Termux)
 * Debe leer la configuración exclusivamente del archivo local config.json.
 * Debe integrar la librería watchdog para monitorizar los eventos del sistema de archivos (inotify).
 * Al detectar una modificación exitosa en config.json, debe recargar las variables en memoria inmediatamente.
 * Debe ejecutar su ciclo de trabajo principal sin ninguna dependencia directa de acceso a internet.
### 5. Requisitos No Funcionales y Restricciones Técnicas
 * *Entorno de Ejecución:* Los scripts A y B deben ejecutarse dentro de Termux en Android.
 * *Gestión de Energía:* Se debe ejecutar el comando termux-wake-lock previo al inicio de los scripts para evitar que el sistema operativo suspenda los procesos con la pantalla apagada.
 * *Almacenamiento:* El archivo config.json y los scripts deben alojarse en el almacenamiento interno de Termux (/data/data/com.termux/files/home/) para garantizar la compatibilidad de los eventos inotify de la librería watchdog.
 * *Costos:* La infraestructura completa (Supabase, Render, NTFY, ejecución local) debe mantenerse en el nivel de suscripción gratuita ($0).
### 6. Criterios de Aceptación (Métricas de Éxito)
| Métrica | Estado Actual | Objetivo |
|---|---|---|
| *Peticiones a Supabase (Cliente Móvil)* | ~4,320 / día | 0 / día |
| *Latencia de Actualización* | Hasta 20 segundos | < 2 segundos |
| *Dependencia de Red (Script Principal)* | Crítica | Nula (Modo Offline soportado) |
| *Tasa de fallos por micro-cortes* | Alta | 0% |
### 7. Riesgos y Mitigaciones
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Condición de carrera al leer/escribir archivo | Alto | Uso estricto de escritura atómica en Script A. |
| Android "mata" la conexión de NTFY | Medio | Implementar auto-reconexión robusta en Script A y usar termux-wake-lock. |
| Exposición del canal de NTFY | Bajo | Utilizar un nombre de canal generado aleatoriamente (UUID) para evitar intercepciones. |