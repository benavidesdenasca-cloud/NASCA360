# Nazca360 - PRD

## Problema Original
Plataforma de turismo virtual premium para administrar y mostrar videos 360° de las Líneas de Nazca con paywall y streaming seguro.

## Alcance Ampliado
1. **VR Inmersivo:** Soporte para videos 360° en Meta Quest
2. **Mapa 3D:** Sección interactiva con POIs y panel admin
3. **Capa KML/GeoJSON:** Trazos oficiales del Ministerio de Cultura (en progreso)

## Arquitectura
```
/app/
├── backend/
│   └── server.py          # FastAPI + MongoDB + Cloudflare Stream
└── frontend/
    ├── public/
    │   ├── nazca_lines.json
    │   └── nazca_lines_clean.json
    └── src/
        └── pages/
            └── Map3D.jsx   # Mapa interactivo con Leaflet
```

## Integraciones
- Cloudflare Stream (video)
- Stripe (pagos)
- SendGrid (email)
- Emergent Google Auth
- Leaflet + Google Maps tiles

## Estado Actual

### ✅ Completado
- Sistema de autenticación JWT + Google Auth
- Pipeline de carga de videos con ffmpeg
- Reproductor VR 360° con Three.js
- Página Mapa 3D con POIs
- Panel admin para CRUD de POIs
- Controles de mapa personalizados
- Sidebar con scroll independiente

### 🔴 En Progreso (Bloqueado)
- **Capa GeoJSON de trazos del Ministerio**
  - Error interno de Leaflet: `Cannot read properties of undefined (reading 'x')`
  - Ocurre en `_clipPoints` durante renderizado
  - Múltiples enfoques probados sin éxito

### 🟡 Pendiente
- Integrar apiErrorHandler.js globalmente
- Eliminar código deprecated de AWS S3
- Refactorizar Map3D.jsx (>1000 líneas)

## Credenciales de Prueba
- **Admin:** benavidesdenasca@gmail.com / Benavides02@

## Esquema DB
- **pois:** `{ id, name, description, latitude, longitude, altitude, category, video_id, active }`

## Endpoints Clave
- `GET /api/pois` - Listar POIs
- `POST /api/pois` - Crear POI (admin)
- `PUT /api/pois/{id}` - Actualizar POI (admin)
- `DELETE /api/pois/{id}` - Eliminar POI (admin)
