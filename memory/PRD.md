# Nazca360 - PRD

## Problema Original
Plataforma de turismo virtual premium para administrar y mostrar contenido 360° de las Líneas de Nazca con paywall y streaming seguro.

## Modelo de Negocio (Actualizado Feb 2026)
- **Suscripción mensual:** $20 USD/mes
- **Pasarela de pago:** PayPal (reemplazó a Stripe)
- **Flujo:** Pago obligatorio antes del registro
- **Opciones de pago:** 1, 3, 6 o 12 meses con descuentos

### Precios de Suscripción
| Plan | Precio | Ahorro | Días |
|------|--------|--------|------|
| 1 Mes | $20 | - | 30 |
| 3 Meses | $55 | $5 | 90 |
| 6 Meses | $100 | $20 | 180 |
| 12 Meses | $200 | $40 | 365 |

## Arquitectura
```
/app/
├── backend/
│   └── server.py          # FastAPI + MongoDB + PayPal
└── frontend/
    └── src/
        └── pages/
            ├── AdminPanel.jsx   # Panel financiero
            ├── Contact.jsx
            ├── Gallery.jsx
            ├── Map3D.jsx
            ├── Reservations.jsx # PayPal integrado
            ├── Subscription.jsx # PayPal + nuevo flujo
            └── SubscriptionSuccess.jsx
```

## Integraciones
- **PayPal** (pagos - NUEVO, reemplaza Stripe)
- Cloudflare Stream (video 360°)
- SendGrid (email)
- Emergent Google Auth
- Leaflet + Google Maps tiles
- Three.js + HLS.js (visor 360°)

## Estado Actual (Febrero 2026)

### ✅ Completado
- Sistema de autenticación JWT + Google Auth
- Reproductor 360° con soporte estereoscópico
- Mejora de calidad de video (SRGB, HLS optimizado)
- Página Mapa 3D con POIs
- Panel admin financiero mejorado
- Página de Contacto
- **Integración PayPal para suscripciones** (19 Feb 2026)
  - Nuevo flujo: Registro + Pago en un paso
  - Descuentos por pago adelantado
  - Renovación manual
- **Integración PayPal para reservaciones VR** (19 Feb 2026)
- **Mapa 3D expandido 15km al norte** (19 Feb 2026)
  - Límites: Norte -14.48 (antes -14.62), Sur -14.82
  - Centro ajustado para cubrir Nazca y Palpa
  - Bounds: West -75.25, East -74.90

### 🔴 Eliminado
- Integración Stripe (reemplazada por PayPal)
- Capas KMZ y Trazos del Ministerio

## Endpoints PayPal (Nuevos)

### Suscripciones
- `GET /api/subscription/packages` - Obtener paquetes disponibles
- `POST /api/paypal/create-order` - Crear orden PayPal (nuevo usuario)
- `GET /api/paypal/execute-payment` - Ejecutar pago y crear cuenta
- `POST /api/paypal/renew-subscription` - Renovar suscripción (usuario existente)
- `GET /api/paypal/execute-renewal` - Ejecutar renovación

### Reservaciones VR
- `POST /api/reservations/checkout` - Crear pago PayPal para reserva
- `GET /api/reservations/execute-payment` - Ejecutar pago de reserva

## Credenciales
- **Admin:** benavidesdenasca@gmail.com / Benavides02@
- **PayPal:** Configurado en .env (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)

## Esquema DB

### pending_registrations (NUEVO)
```json
{
  "payment_id": "PAYPAL-xxx",
  "email": "user@email.com",
  "name": "Nombre",
  "password_hash": "hash",
  "plan_type": "3_months",
  "amount": 55.00,
  "duration_days": 90,
  "status": "pending|completed|failed"
}
```

### subscriptions (Actualizado)
```json
{
  "id": "uuid",
  "user_id": "string",
  "paypal_payment_id": "string",
  "paypal_payer_id": "string",
  "payment_method": "paypal",
  "amount_paid": 55.00,
  "status": "active|expired|cancelled"
}
```

## Información de Contacto (Nazca360)
- **Dirección:** Calle Lima 160 (Restobar Nazka), Nasca, Ica, Perú
- **WhatsApp:** +51 956 567 391
- **Email:** max@nazca360.com

### 🟡 Pendiente
- Actualizar API key de SendGrid para emails
- Probar flujo completo de PayPal en producción

### 🔵 Backlog
- Modularizar server.py
- Refactorizar Map3D.jsx
- Integración DRM
