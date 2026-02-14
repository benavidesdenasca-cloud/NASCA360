# Nazca360 - PRD

## Problema Original
Plataforma de turismo virtual premium para administrar y mostrar videos 360° de las Líneas de Nazca con paywall y streaming seguro.

## Alcance Ampliado
1. **VR Inmersivo:** Soporte para videos 360° en Meta Quest
2. **Mapa 3D:** Sección interactiva con POIs y panel admin
3. **Capa KML/GeoJSON:** Trazos oficiales del Ministerio de Cultura ✅ FUNCIONANDO

## Arquitectura
```
/app/
├── backend/
│   └── server.py          # FastAPI + MongoDB + Cloudflare Stream
└── frontend/
    ├── public/
    │   └── nazca_lines_filtered.json # 150 trazos del área central (7076 puntos)
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

## Estado Actual (Febrero 2026)

### ✅ Completado
- Sistema de autenticación JWT + Google Auth
- Pipeline de carga de videos con ffmpeg
- Reproductor VR 360° con Three.js
- Página Mapa 3D con POIs
- Panel admin para CRUD de POIs
- Controles de mapa personalizados
- Sidebar con scroll independiente
- **Capa de trazos del Ministerio de Cultura** ✅ (7076 markers divIcon)

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

## Notas Técnicas
- Bug de Leaflet 1.9.4: `L.polyline` y `L.circleMarker` fallan con error `reading 'x'`
- **Workaround:** Usar `L.divIcon` markers en lugar de polilíneas
- Las líneas están filtradas al área central: lat [-14.73, -14.69], lng [-75.14, -75.04]
