# Nazca360 - Product Requirements Document

## Problema Original
Plataforma de turismo virtual para explorar las Líneas de Nasca y Palpa en experiencias inmersivas 360°.

## Requisitos Implementados

### 1. Superusuario y Panel de Administración
- **Superusuario:** `benavidesdenasca@gmail.com` / `Benavides02@`
- Panel de admin con gestión de usuarios (ver, bloquear/desbloquear)
- Gestión de videos (CRUD con carga de MP4)

### 2. Sistema de Videos
- Carga directa de archivos MP4 al servidor (`/app/uploads`)
- Streaming autenticado via Blob URLs
- Protección contra descargas no autorizadas

### 3. Modelo Netflix (Paywall)
- Solo usuarios con suscripción `premium` pueden hacer login
- Excepción: administradores pueden acceder siempre
- Se eliminaron las opciones de "demo" y "baja calidad"

### 4. Autenticación
- JWT con roles (`admin`, `user`)
- Integración con Emergent Google Auth
- Verificación de email

### 5. Reservas VR
- Sistema multi-cabina para experiencias VR
- Selección de fecha y horario
- Gestión de reservas por usuario

## Stack Técnico
- **Frontend:** React, Tailwind CSS, Shadcn/UI
- **Backend:** FastAPI, Python
- **Database:** MongoDB
- **Pagos:** Stripe
- **Auth:** JWT + Emergent Google Auth

## Archivos Clave
- `/app/backend/server.py` - API principal
- `/app/frontend/src/pages/AdminPanel.jsx` - Panel de administración
- `/app/frontend/src/pages/Gallery.jsx` - Galería de videos
- `/app/frontend/src/pages/VideoPlayer.jsx` - Reproductor de videos
- `/app/frontend/src/pages/Reservations.jsx` - Sistema de reservas

## Bugs Resueltos (Enero 2025)

### Bug Crítico - Gallery Crash
- **Error:** `TypeError: Cannot read properties of undefined (reading 'slice')`
- **Causa:** Backend cambió de `video.tags` a `video.cultural_tags`
- **Solución:** Actualizado `Gallery.jsx` y `VideoPlayer.jsx` con optional chaining (`?.`)
- **Estado:** RESUELTO

### Bug Recurrente - Objects Not Valid as React Child
- **Causa:** Respuestas de error de API no procesadas correctamente
- **Solución:** Creada utilidad `/app/frontend/src/utils/apiErrorHandler.js`
- **Estado:** PARCIALMENTE RESUELTO (utilidad creada, pendiente implementación global)

## Credenciales de Prueba
- **Superusuario:** `benavidesdenasca@gmail.com` / `Benavides02@`

## Próximos Pasos
1. Implementar manejador de errores centralizado en todos los componentes
2. Agregar más videos de contenido real
3. Configurar notificaciones por email

## Estado Actual: ESTABLE
- Login funcionando
- Galería funcionando
- VideoPlayer funcionando
- Panel Admin funcionando
- Reservas funcionando
