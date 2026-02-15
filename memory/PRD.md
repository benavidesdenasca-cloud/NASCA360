# Nazca360 - PRD

## Problema Original
Plataforma de turismo virtual premium para administrar y mostrar contenido 360° de las Líneas de Nazca con paywall y streaming seguro.

## Alcance Actual
1. **VR Inmersivo:** Soporte para imágenes 360° con Pannellum.js
2. **Mapa 3D Interactivo:** Sección con POIs y panel admin completo
3. **Capa de trazos del Ministerio:** Trazos oficiales como puntos (GeoJSON local)
4. **Visor de imágenes 360°:** Integrado con proxy backend para CORS

## Arquitectura
```
/app/
├── backend/
│   └── server.py          # FastAPI + MongoDB + Image Proxy
└── frontend/
    ├── public/
    │   └── nazca_lines_filtered.json # 150 trazos del Ministerio
    └── src/
        └── pages/
            └── Map3D.jsx   # Mapa interactivo con visor 360°
```

## Integraciones
- Cloudflare Stream (video) - Deprecado, reemplazado por imágenes 360°
- Stripe (pagos)
- SendGrid (email)
- Emergent Google Auth
- Leaflet + Google Maps tiles
- Pannellum.js (visor 360°)

## Estado Actual (Febrero 2026)

### ✅ Completado
- Sistema de autenticación JWT + Google Auth
- Reproductor 360° con Pannellum.js
- Página Mapa 3D con POIs
- Panel admin para CRUD de POIs
- Controles de mapa personalizados
- Sidebar con scroll independiente
- Capa de trazos del Ministerio de Cultura
- Backend proxy para imágenes 360° (soluciona CORS)
- **Eliminación de funcionalidad KMZ** (15 Feb 2026)

### 🔴 Eliminado (15 Feb 2026)
- Gestión de capas KMZ - Removido por solicitud del usuario
  - Endpoints: /api/kmz/upload, /api/kmz/layers/*
  - Modelos: KMZFeature, KMZLayer, KMZLayerUpdate
  - Frontend: Estados, funciones y UI de KMZ en Map3D.jsx

### 🟡 Pendiente (P1-P2)
- Implementar apiErrorHandler.js globalmente
- Eliminar código deprecated de AWS S3
- Refactorizar Map3D.jsx (>1000 líneas)

### 🔵 Futuro (Backlog)
- Modularizar server.py en routes/, models/, services/
- Integración DRM para seguridad de medios

## Credenciales de Prueba
- **Admin:** benavidesdenasca@gmail.com / Benavides02@

## Esquema DB
- **pois:** `{ id, name, description, latitude, longitude, altitude, category, image_url, active }`
- **users, subscriptions, videos, reservations, payment_transactions**

## Endpoints Clave
### POIs
- `GET /api/pois` - Listar POIs
- `POST /api/pois` - Crear POI (admin)
- `PUT /api/pois/{id}` - Actualizar POI (admin)
- `DELETE /api/pois/{id}` - Eliminar POI (admin)

### Image Proxy
- `GET /api/image-proxy?url={url}` - Proxy para imágenes 360° (soluciona CORS)

## Notas Técnicas
- Bug de Leaflet 1.9.4: `L.polyline` y `L.circleMarker` fallan con error `reading 'x'`
- **Workaround estable:** Usar `L.divIcon` markers en lugar de polilíneas
- Las imágenes 360° deben pasar por el proxy backend para evitar CORS en Pannellum
