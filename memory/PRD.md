# Nazca360 - PRD

## Problema Original
Plataforma de turismo virtual premium para administrar y mostrar videos 360° de las Líneas de Nazca con paywall y streaming seguro.

## Alcance Ampliado
1. **VR Inmersivo:** Soporte para videos 360° en Meta Quest
2. **Mapa 3D:** Sección interactiva con POIs y panel admin
3. **Capa de trazos del Ministerio:** Trazos oficiales como puntos ✅
4. **Gestión de capas KMZ:** Subir, visualizar y gestionar archivos KMZ ✅ NUEVO

## Arquitectura
```
/app/
├── backend/
│   └── server.py          # FastAPI + MongoDB + Cloudflare Stream + KMZ parsing
└── frontend/
    ├── public/
    │   └── nazca_lines_filtered.json # 150 trazos del Ministerio
    └── src/
        └── pages/
            └── Map3D.jsx   # Mapa interactivo + Capas KMZ
```

## Integraciones
- Cloudflare Stream (video)
- Stripe (pagos)
- SendGrid (email)
- Emergent Google Auth
- Leaflet + Google Maps tiles

## Estado Actual (Febrero 2026)

### ✅ Completado
- Sistema de autenticación JWT + Google Auth
- Pipeline de carga de videos con ffmpeg
- Reproductor VR 360° con Three.js
- Página Mapa 3D con POIs
- Panel admin para CRUD de POIs
- Controles de mapa personalizados
- Sidebar con scroll independiente
- Capa de trazos del Ministerio de Cultura
- **Gestión de capas KMZ** ← NUEVO
  - Upload de archivos KMZ
  - Parseo automático de KML a GeoJSON
  - UI en panel admin para gestionar capas
  - Toggle mostrar/ocultar por capa

### 🟡 Pendiente
- Integrar apiErrorHandler.js globalmente
- Eliminar código deprecated de AWS S3
- Refactorizar Map3D.jsx (>1000 líneas)

## Credenciales de Prueba
- **Admin:** benavidesdenasca@gmail.com / Benavides02@

## Esquema DB
- **pois:** `{ id, name, description, latitude, longitude, altitude, category, video_id, active }`
- **kmz_layers:** `{ id, name, description, features, feature_count, bounds, color, is_active, created_by, created_at }` ← NUEVO

## Endpoints Clave
### POIs
- `GET /api/pois` - Listar POIs
- `POST /api/pois` - Crear POI (admin)
- `PUT /api/pois/{id}` - Actualizar POI (admin)
- `DELETE /api/pois/{id}` - Eliminar POI (admin)

### KMZ Layers (NUEVO)
- `POST /api/kmz/upload` - Subir archivo KMZ (admin)
- `GET /api/kmz/layers` - Listar capas activas
- `GET /api/kmz/layers/{id}` - Obtener capa con features
- `GET /api/kmz/layers/{id}/geojson` - Obtener como GeoJSON
- `PUT /api/kmz/layers/{id}` - Actualizar capa (admin)
- `DELETE /api/kmz/layers/{id}` - Eliminar capa (admin)

## Notas Técnicas
- Bug de Leaflet 1.9.4: `L.polyline` y `L.circleMarker` fallan con error `reading 'x'`
- **Workaround:** Usar `L.divIcon` markers en lugar de polilíneas
- El parseo de KML extrae LineString y Polygon como GeoJSON features
