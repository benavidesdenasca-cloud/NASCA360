# Nazca360 - Product Requirements Document

## Problema Original
Plataforma de turismo virtual para explorar las Líneas de Nasca y Palpa en experiencias inmersivas 360°.

## Requisitos Implementados

### 1. Superusuario y Panel de Administración
- **Superusuario:** `benavidesdenasca@gmail.com` / `Benavides02@`
- Panel de admin con gestión de usuarios (ver, bloquear/desbloquear)
- Gestión de videos (CRUD con carga de MP4)

### 2. Sistema de Videos con Streaming Protegido
- Carga directa de archivos MP4 al servidor (`/app/backend/uploads`)
- **Streaming seguro:** Videos se sirven via `/api/stream/{filename}` con:
  - Autenticación JWT obligatoria
  - Soporte de Range requests (HTTP 206)
  - Headers anti-descarga: `Content-Disposition: inline`, `Cache-Control: no-store`
- **Protección contra descargas:**
  - Acceso directo a archivos MP4 bloqueado (`/api/files/` retorna 403 para videos)
  - Atributo `controlsList="nodownload"` en el reproductor
  - Menú contextual deshabilitado (`onContextMenu`)
  - Picture-in-Picture deshabilitado

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
- `/app/backend/server.py` - API principal con endpoints de streaming
- `/app/frontend/src/pages/AdminPanel.jsx` - Panel de administración
- `/app/frontend/src/pages/Gallery.jsx` - Galería de videos
- `/app/frontend/src/pages/VideoPlayer.jsx` - Reproductor con protección anti-descarga
- `/app/frontend/src/pages/Reservations.jsx` - Sistema de reservas

## Endpoints de Video
- `GET /api/stream/{filename}` - Streaming de video con auth (soporta Range requests)
- `GET /api/files/{filename}` - Solo para imágenes/thumbnails (videos bloqueados)
- `POST /api/upload` - Subir videos (solo admin)

## Credenciales de Prueba
- **Superusuario:** `benavidesdenasca@gmail.com` / `Benavides02@`

## Estado Actual: ESTABLE
- Login funcionando
- Galería funcionando
- VideoPlayer con streaming protegido
- Panel Admin funcionando
- Reservas funcionando

## Última actualización: Enero 2025
- Implementado streaming seguro de videos
- Bloqueado acceso directo a archivos MP4
- Deshabilitadas opciones de descarga en el reproductor
