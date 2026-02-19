# Nazca360 - PRD

## Problema Original
Plataforma de turismo virtual premium para administrar y mostrar contenido 360° de las Líneas de Nazca con paywall y streaming seguro.

## Alcance Actual
1. **VR Inmersivo:** Soporte para videos 360° con Three.js + HLS.js
2. **Mapa 3D Interactivo:** Sección con POIs y panel admin completo
3. **Visor de imágenes 360°:** Integrado con proxy backend para CORS
4. **Sistema de Suscripciones:** Integración con Stripe
5. **Reservas VR:** Sistema de reserva de cabinas con QR
6. **Página de Contacto:** Formulario funcional con email

## Arquitectura
```
/app/
├── backend/
│   └── server.py          # FastAPI + MongoDB + SendGrid
└── frontend/
    └── src/
        ├── components/
        │   ├── Navbar.jsx
        │   └── Video360Player.jsx
        └── pages/
            ├── Contact.jsx    # NEW - Página de contacto
            ├── Gallery.jsx
            ├── Map3D.jsx
            ├── Reservations.jsx
            └── Subscription.jsx
```

## Integraciones
- Cloudflare Stream (video 360°)
- Stripe (pagos)
- SendGrid (email) - *API key necesita actualización*
- Emergent Google Auth
- Leaflet + Google Maps tiles
- Three.js + HLS.js (visor 360°)

## Estado Actual (Febrero 2026)

### ✅ Completado
- Sistema de autenticación JWT + Google Auth
- Reproductor 360° con soporte estereoscópico (mono, SBS, TB)
- Mejora de calidad de video (color space SRGB, HLS optimizado)
- Página Mapa 3D con POIs
- Panel admin para CRUD de POIs y Videos
- **Página de Contacto** (19 Feb 2026)
  - Hero con animaciones
  - Información de contacto
  - Mapa de Google embebido
  - Formulario funcional
  - Botones WhatsApp y Cómo llegar

### 🔴 Eliminado (15 Feb 2026)
- Gestión de capas KMZ
- Capa de Trazos del Ministerio

### 🟡 Pendiente (P1-P2)
- Actualizar API key de SendGrid para envío de emails
- Implementar `apiErrorHandler.js` globalmente
- Eliminar código deprecated de AWS S3 en backend

### 🔵 Futuro (Backlog)
- Modularizar server.py en routes/, models/, services/
- Refactorizar Map3D.jsx en componentes más pequeños
- Integración DRM para seguridad de medios

## Credenciales de Prueba
- **Admin:** benavidesdenasca@gmail.com / Benavides02@

## Esquema DB
- **pois:** `{ id, name, description, latitude, longitude, altitude, category, image_url, active }`
- **videos:** `{ id, title, description, url, stereo_format, category, thumbnail_url, is_premium }`
- **contact_messages:** `{ name, email, phone, message, created_at, status }` - NEW
- **users, subscriptions, reservations, payment_transactions**

## Endpoints Clave
### Contacto
- `POST /api/contact` - Enviar mensaje de contacto (guarda en DB + intenta email)

### POIs
- `GET /api/pois` - Listar POIs
- `POST /api/pois` - Crear POI (admin)
- `PUT /api/pois/{id}` - Actualizar POI (admin)
- `DELETE /api/pois/{id}` - Eliminar POI (admin)

### Videos
- `GET /api/videos` - Listar videos
- `POST /api/admin/videos` - Crear video (admin)
- `PUT /api/admin/videos/{id}` - Actualizar video (admin)

### Image Proxy
- `GET /api/image-proxy?url={url}` - Proxy para imágenes 360° (soluciona CORS)

## Información de Contacto (Nazca360)
- **Dirección:** Calle Lima 160 (Restobar Nazka), Nasca, Ica, Perú
- **WhatsApp:** +51 956 567 391
- **Email:** max@nazca360.com
- **Horario:** Lunes a Domingo, 8:00 AM - 10:00 PM

## Notas Técnicas
- Videos 360° soportan formato estereoscópico SBS y TB
- Color space SRGB para colores precisos en el visor
- HLS.js optimizado para streaming 4K
- Los mensajes de contacto se guardan en DB aunque falle el email
