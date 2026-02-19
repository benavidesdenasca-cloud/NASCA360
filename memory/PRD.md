# Nazca360 - PRD

## Problema Original
Plataforma de turismo virtual premium para administrar y mostrar contenido 360° de las Líneas de Nazca con paywall y streaming seguro.

## Alcance Actual
1. **VR Inmersivo:** Soporte para videos 360° con Three.js + HLS.js
2. **Mapa 3D Interactivo:** Sección con POIs y panel admin completo
3. **Visor de imágenes 360°:** Integrado con proxy backend para CORS
4. **Sistema de Suscripciones:** Integración con Stripe + panel admin mejorado
5. **Reservas VR:** Sistema de reserva de cabinas con QR
6. **Página de Contacto:** Formulario funcional con email

## Arquitectura
```
/app/
├── backend/
│   └── server.py          # FastAPI + MongoDB + SendGrid + Stripe
└── frontend/
    └── src/
        ├── components/
        │   ├── Navbar.jsx
        │   └── Video360Player.jsx
        └── pages/
            ├── AdminPanel.jsx  # UPDATED - Panel financiero mejorado
            ├── Contact.jsx
            ├── Gallery.jsx
            ├── Map3D.jsx
            ├── Reservations.jsx
            └── Subscription.jsx
```

## Estado Actual (Febrero 2026)

### ✅ Completado
- Sistema de autenticación JWT + Google Auth
- Reproductor 360° con soporte estereoscópico (mono, SBS, TB)
- Mejora de calidad de video (color space SRGB, HLS optimizado)
- Página Mapa 3D con POIs
- Panel admin para CRUD de POIs y Videos
- Página de Contacto (19 Feb 2026)
- **Panel Admin Financiero Mejorado** (19 Feb 2026)
  - Estadísticas de suscripciones (activas, vencidas, canceladas, ingresos)
  - Tabla detallada con: fecha pago, monto, método, fechas, ID transacción, auto-renovación
  - Filtros por estado (todas, activas, vencidas, canceladas)
  - Historial de pagos por usuario
  - Acciones: cancelar suscripción, extender 30 días

## Modelo de Suscripción (Actualizado)
```json
{
  "id": "uuid",
  "user_id": "string",
  "user_email": "string",
  "user_name": "string",
  "plan_type": "premium|daily|monthly|annual",
  "stripe_session_id": "string",
  "stripe_payment_intent_id": "string",
  "payment_status": "initiated|paid|failed|cancelled|expired",
  "payment_method": "card|paypal",
  "amount_paid": 29.99,
  "currency": "USD",
  "payment_date": "datetime",
  "start_date": "datetime",
  "end_date": "datetime",
  "status": "pending|active|expired|cancelled",
  "auto_renew": true,
  "cancelled_at": "datetime",
  "cancellation_reason": "string"
}
```

## Endpoints Admin (Nuevos)
- `GET /api/admin/subscriptions?status={filter}` - Lista filtrada de suscripciones
- `GET /api/admin/subscriptions/stats` - Estadísticas de suscripciones
- `GET /api/admin/users/{user_id}/payment-history` - Historial de pagos de usuario
- `PUT /api/admin/subscriptions/{id}/cancel` - Cancelar suscripción
- `PUT /api/admin/subscriptions/{id}/extend?days=30` - Extender suscripción

## Credenciales de Prueba
- **Admin:** benavidesdenasca@gmail.com / Benavides02@

## Información de Contacto (Nazca360)
- **Dirección:** Calle Lima 160 (Restobar Nazka), Nasca, Ica, Perú
- **WhatsApp:** +51 956 567 391
- **Email:** max@nazca360.com
- **Horario:** Lunes a Domingo, 8:00 AM - 10:00 PM

### 🟡 Pendiente (P1-P2)
- Actualizar API key de SendGrid para envío de emails
- Implementar `apiErrorHandler.js` globalmente

### 🔵 Futuro (Backlog)
- Modularizar server.py en routes/, models/, services/
- Refactorizar Map3D.jsx en componentes más pequeños
- Integración DRM para seguridad de medios
