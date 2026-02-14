# Nazca360 - Product Requirements Document

## Problema Original
Plataforma de turismo virtual premium para explorar las Líneas de Nasca y Palpa en experiencias inmersivas 360°.

## Requisitos Implementados

### 1. Superusuario y Panel de Administración
- **Superusuario:** `benavidesdenasca@gmail.com` / `Benavides02@`
- Panel de admin con gestión de usuarios (ver, bloquear/desbloquear)
- Gestión de videos (CRUD con carga de MP4)

### 2. Sistema de Videos con Almacenamiento Híbrido
- **Videos pequeños (<100MB):** Almacenados localmente en `/app/backend/uploads`
- **Videos en AWS S3:** Bucket `nazca360-videos` para almacenamiento original
- **Videos en Cloudflare R2 (CDN) ⭐ NUEVO:** Bucket `nasca360video` - streaming más rápido
- **Multipart Upload:** Soporte para archivos mayores a 5GB
- **URLs Presignadas:** Videos de S3/R2 se acceden mediante URLs temporales
- Streaming seguro con autenticación JWT

### Admin Panel - Opciones de Almacenamiento
- Al subir video, elegir entre:
  - ☁️ **Cloudflare CDN (Rápido)** - R2 con CDN global
  - **AWS S3 (Original)** - almacenamiento estándar

### 3. Reproductor de Video 360° ✅ CORREGIDO
- Componente Three.js para experiencia inmersiva 360°
- Navegación con drag del mouse (horizontal y vertical)
- Controles: Play/Pause, Seek, Fullscreen
- **Control de calidad:** Auto, Alta (4K), Media (1080p), Baja (720p)
- **Control de volumen:** Slider expandible con mute/unmute
- Badge "360°" visible
- Manejo robusto de errores transitorios de CORS
- Compatible con videos grandes de S3 (probado con 5GB)

### 4. Modelo Netflix (Paywall)
- Solo usuarios con suscripción `premium` pueden hacer login
- Excepción: administradores pueden acceder siempre
- Stripe para gestión de suscripciones

### 5. Autenticación
- JWT con roles (`admin`, `user`)
- Integración con Emergent Google Auth
- Verificación de email

### 6. Reservas VR
- Sistema multi-cabina para experiencias VR
- Selección de fecha y horario
- Gestión de reservas por usuario

## Stack Técnico
- **Frontend:** React, Tailwind CSS, Shadcn/UI, Three.js
- **Backend:** FastAPI, Python, boto3
- **Database:** MongoDB
- **Storage:** AWS S3 (videos grandes)
- **Pagos:** Stripe
- **Auth:** JWT + Emergent Google Auth

## Archivos Clave
- `/app/frontend/src/components/Video360Player.jsx` - Reproductor 360° con Three.js
- `/app/frontend/src/pages/VideoPlayer.jsx` - Página de video
- `/app/frontend/src/pages/Gallery.jsx` - Galería de videos
- `/app/frontend/src/pages/AdminPanel.jsx` - Panel de administración
- `/app/backend/server.py` - API con endpoints S3 y streaming

## Endpoints de Video
- `GET /api/s3/presigned-view/{s3_key}` - URL temporal para ver video de S3
- `POST /api/s3/presigned-url` - URL temporal para subir a S3 (<5GB)
- `POST /api/s3/multipart/start` - Iniciar upload multipart (>5GB)
- `GET /api/s3/multipart/presign-part` - URL para cada parte del multipart
- `POST /api/s3/multipart/complete` - Completar upload multipart
- `GET /api/stream/{filename}` - Streaming de video local con auth

## Credenciales de Prueba
- **Superusuario:** `benavidesdenasca@gmail.com` / `Benavides02@`
- **AWS S3 Bucket:** `nazca360-videos`

## Estado Actual: ✅ ESTABLE
- Login funcionando ✓
- Galería funcionando ✓
- **Reproductor 360° funcionando** ✓ (Corregido Enero 2026)
- Panel Admin funcionando ✓
- Upload de videos grandes a S3 funcionando ✓
- Reservas funcionando ✓
- **Mapa 3D funcionando** ✓ (Corregido Feb 2026)
  - Panel de admin para CRUD de POIs ✓
  - Navbar visible ✓
  - Botones editar/eliminar siempre visibles ✓

## Tareas Pendientes (P1-P2)
1. **(P1)** Refactorizar manejo de errores API en frontend (usar `/app/frontend/src/utils/apiErrorHandler.js`)
2. **(P1)** Eliminar código AWS S3 deprecado del backend
3. **(P2)** Refactorizar `server.py` (>2600 líneas) en módulos separados
4. **(Futuro)** Integración DRM (Widevine) para máxima seguridad

## Última actualización: 14 Febrero 2026
- ✅ Corregido bug del Navbar no visible en página Mapa 3D
- ✅ Corregido botones Editar/Eliminar ahora siempre visibles (no solo hover)
- ✅ Corregido panel de edición de POIs (z-index: 9999 para aparecer encima de Leaflet)
- ✅ Testing completo del flujo admin CRUD de POIs (100% pass rate)
