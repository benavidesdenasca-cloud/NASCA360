# INFORME TÉCNICO DE IMPLEMENTACIÓN
## Base de Datos y Arquitectura de Plataforma Web
### Sistema: Nazca360 - Plataforma de Turismo Virtual Inmersivo

---

**Versión:** 1.0  
**Fecha:** Febrero 2026  
**Autor:** Max Leonard Benavides Carpio  
**Plataforma:** Nazca360 - https://ancient-lines-vr.preview.emergentagent.com

---

## ÍNDICE

1. [Introducción](#1-introducción)
2. [Objetivos del Sistema](#2-objetivos-del-sistema)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Tecnologías Utilizadas](#4-tecnologías-utilizadas)
5. [Diseño de Base de Datos](#5-diseño-de-base-de-datos)
6. [Modelos de Datos](#6-modelos-de-datos)
7. [API REST - Endpoints](#7-api-rest---endpoints)
8. [Seguridad e Integraciones](#8-seguridad-e-integraciones)
9. [Infraestructura de Despliegue](#9-infraestructura-de-despliegue)
10. [Conclusiones](#10-conclusiones)

---

## 1. INTRODUCCIÓN

### 1.1 Descripción General

**Nazca360** es una plataforma web de turismo virtual que permite a los usuarios explorar las Líneas de Nazca y Palpa a través de experiencias inmersivas en 360°. El sistema ofrece contenido multimedia de alta calidad, incluyendo videos 360°, fotografías panorámicas y un mapa interactivo con puntos de interés georreferenciados.

### 1.2 Alcance del Proyecto

- Plataforma web responsive con soporte para dispositivos VR (Meta Quest 3)
- Sistema de suscripciones con pasarela de pagos PayPal
- Panel de administración para gestión de contenido y usuarios
- Mapa 3D interactivo con 59 puntos de interés (POIs)
- Galería de videos 360° con streaming adaptativo
- Sistema de reservaciones para experiencias VR presenciales

### 1.3 Problema que Resuelve

La plataforma democratiza el acceso al patrimonio cultural de las Líneas de Nazca, permitiendo a personas de todo el mundo experimentar estos geoglifos milenarios de manera virtual e inmersiva, superando las barreras geográficas y económicas del turismo tradicional.

---

## 2. OBJETIVOS DEL SISTEMA

### 2.1 Objetivo General

Desarrollar una plataforma web de turismo virtual que permita la visualización inmersiva de las Líneas de Nazca mediante tecnologías de realidad virtual y contenido 360°.

### 2.2 Objetivos Específicos

| # | Objetivo | Estado |
|---|----------|--------|
| 1 | Implementar sistema de autenticación seguro con JWT y OAuth 2.0 | ✅ Completado |
| 2 | Diseñar base de datos NoSQL escalable para gestión de contenido | ✅ Completado |
| 3 | Integrar pasarela de pagos PayPal para suscripciones | ✅ Completado |
| 4 | Desarrollar visor 360° con soporte WebXR para dispositivos VR | ✅ Completado |
| 5 | Crear mapa interactivo con geolocalización de figuras | ✅ Completado |
| 6 | Implementar streaming de video adaptativo (HLS) | ✅ Completado |

---

## 3. ARQUITECTURA DEL SISTEMA

### 3.1 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CAPA DE PRESENTACIÓN                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │
│   │   React.js  │    │  Three.js   │    │   Leaflet   │                │
│   │  Frontend   │    │  Visor VR   │    │   Mapas     │                │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                │
│          │                  │                  │                        │
│          └──────────────────┼──────────────────┘                        │
│                             │                                           │
│                      ┌──────▼──────┐                                    │
│                      │    Axios    │                                    │
│                      │ HTTP Client │                                    │
│                      └──────┬──────┘                                    │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │ HTTPS/REST API
┌─────────────────────────────▼───────────────────────────────────────────┐
│                           CAPA DE APLICACIÓN                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                         FastAPI (Python)                         │  │
│   │                     API REST - Puerto 8001                       │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐             │
│   │ Autenticación │  │  Suscripciones│  │   Contenido   │             │
│   │  JWT + OAuth  │  │    PayPal     │  │  Videos/POIs  │             │
│   └───────────────┘  └───────────────┘  └───────────────┘             │
│                                                                         │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────────┐
│                           CAPA DE DATOS                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    MongoDB (NoSQL Database)                      │  │
│   │                       Puerto 27017                               │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│   ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐            │
│   │   users   │ │subscript- │ │   pois    │ │  videos   │            │
│   │           │ │   ions    │ │           │ │           │            │
│   └───────────┘ └───────────┘ └───────────┘ └───────────┘            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────────┐
│                        SERVICIOS EXTERNOS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐             │
│   │    PayPal     │  │  Cloudflare   │  │   SendGrid    │             │
│   │    Pagos      │  │    Stream     │  │    Emails     │             │
│   └───────────────┘  └───────────────┘  └───────────────┘             │
│                                                                         │
│   ┌───────────────┐  ┌───────────────┐                                 │
│   │ Google OAuth  │  │  Google Maps  │                                 │
│   │     Auth      │  │    Tiles      │                                 │
│   └───────────────┘  └───────────────┘                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Patrón de Arquitectura

El sistema implementa una **arquitectura de tres capas** (Three-Tier Architecture):

| Capa | Tecnología | Responsabilidad |
|------|------------|-----------------|
| **Presentación** | React.js + Three.js | Interfaz de usuario, renderizado 3D/VR |
| **Aplicación** | FastAPI (Python) | Lógica de negocio, API REST |
| **Datos** | MongoDB | Persistencia y almacenamiento |

### 3.3 Estructura de Directorios

```
/app/
├── backend/
│   ├── server.py              # API FastAPI principal
│   ├── auth_utils.py          # Utilidades de autenticación
│   ├── requirements.txt       # Dependencias Python
│   └── .env                   # Variables de entorno
│
├── frontend/
│   ├── src/
│   │   ├── components/        # Componentes reutilizables
│   │   │   ├── ui/            # Componentes Shadcn/UI
│   │   │   ├── Navbar.jsx
│   │   │   ├── Image360VRViewer.jsx
│   │   │   └── Video360Player.jsx
│   │   │
│   │   ├── pages/             # Páginas de la aplicación
│   │   │   ├── AdminPanel.jsx
│   │   │   ├── Gallery.jsx
│   │   │   ├── Map3D.jsx
│   │   │   ├── Subscription.jsx
│   │   │   └── ...
│   │   │
│   │   └── App.js             # Componente raíz
│   │
│   ├── package.json           # Dependencias Node.js
│   └── .env                   # Variables de entorno frontend
│
└── docs/
    └── INFORME_TECNICO_NAZCA360.md
```

---

## 4. TECNOLOGÍAS UTILIZADAS

### 4.1 Stack Tecnológico

#### Frontend
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| React.js | 19.0.0 | Framework de interfaz de usuario |
| Three.js | 0.182.0 | Renderizado 3D y WebXR/VR |
| Tailwind CSS | 3.4.17 | Framework de estilos |
| Shadcn/UI | Latest | Componentes de interfaz |
| Axios | 1.8.4 | Cliente HTTP |
| Leaflet | 1.9.4 | Mapas interactivos |
| HLS.js | 1.6.15 | Streaming de video adaptativo |
| PayPal React SDK | 8.9.2 | Integración de pagos |

#### Backend
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Python | 3.11 | Lenguaje de programación |
| FastAPI | 0.115.0 | Framework API REST |
| Motor | 3.6.0 | Driver MongoDB asíncrono |
| PyJWT | 2.9.0 | Tokens de autenticación |
| Bcrypt | 4.2.0 | Hash de contraseñas |
| SendGrid | 6.11.0 | Envío de emails |
| PayPal SDK | 1.13.1 | Procesamiento de pagos |

#### Base de Datos
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| MongoDB | 7.x | Base de datos NoSQL |
| MongoDB Atlas | Cloud | Producción (despliegue) |

### 4.2 Servicios de Terceros

| Servicio | Función | Tipo de Integración |
|----------|---------|---------------------|
| **PayPal** | Procesamiento de pagos | API REST (Orders v2) |
| **Cloudflare Stream** | Hosting y streaming de video | API + HLS |
| **Google OAuth** | Autenticación social | OAuth 2.0 |
| **SendGrid** | Envío de emails transaccionales | API REST |
| **Google Maps** | Tiles satelitales para mapa | CDN Tiles |

---

## 5. DISEÑO DE BASE DE DATOS

### 5.1 Modelo de Datos (NoSQL - MongoDB)

MongoDB fue seleccionado por las siguientes razones:
- **Flexibilidad de esquema**: Permite evolución del modelo sin migraciones complejas
- **Documentos JSON**: Mapeo natural con JavaScript/Python
- **Escalabilidad horizontal**: Preparado para crecimiento
- **Geoespacial**: Soporte nativo para coordenadas geográficas

### 5.2 Colecciones de la Base de Datos

```
Base de Datos: test_database
├── users                 (8 documentos)
├── subscriptions         (9 documentos)
├── pois                  (59 documentos)
├── videos                (4 documentos)
├── reservations          (6 documentos)
├── user_sessions         (350 documentos)
├── contact_messages      (8 documentos)
├── payment_transactions  (12 documentos)
├── pending_registrations (1 documento)
├── pending_renewals      (10 documentos)
├── pending_popup_payments(21 documentos)
└── kmz_layers            (2 documentos)
```

### 5.3 Diagrama Entidad-Relación (Conceptual)

```
┌─────────────────┐       ┌─────────────────┐
│     USERS       │       │  SUBSCRIPTIONS  │
├─────────────────┤       ├─────────────────┤
│ user_id (PK)    │───┐   │ id (PK)         │
│ email (UNIQUE)  │   │   │ user_id (FK)    │◄──┐
│ name            │   │   │ plan_type       │   │
│ password_hash   │   │   │ status          │   │
│ role            │   │   │ start_date      │   │
│ subscription_plan│   │   │ end_date        │   │
│ oauth_provider  │   │   │ amount_paid     │   │
│ created_at      │   │   │ payment_method  │   │
└─────────────────┘   │   └─────────────────┘   │
                      │                         │
                      └─────────────────────────┘

┌─────────────────┐       ┌─────────────────┐
│      POIS       │       │     VIDEOS      │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ name            │       │ title           │
│ description     │       │ description     │
│ latitude        │       │ url             │
│ longitude       │       │ duration        │
│ altitude        │       │ category        │
│ category        │       │ is_premium      │
│ image_url       │       │ thumbnail_url   │
│ video_id (FK)   │───────│ stereo_format   │
└─────────────────┘       └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│  RESERVATIONS   │       │ USER_SESSIONS   │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ session_token(PK)│
│ user_id (FK)    │       │ user_id (FK)    │
│ user_email      │       │ expires_at      │
│ reservation_date│       │ last_activity   │
│ time_slot       │       │ created_at      │
│ status          │       └─────────────────┘
│ qr_code         │
└─────────────────┘
```

---

## 6. MODELOS DE DATOS

### 6.1 Colección: users

Almacena la información de los usuarios registrados en la plataforma.

```javascript
{
  "_id": ObjectId("..."),
  "user_id": "user_c1a542107a82",        // Identificador único
  "email": "usuario@email.com",           // Email (índice único)
  "name": "Nombre del Usuario",           // Nombre completo
  "password_hash": "$2b$12$...",          // Contraseña hasheada (bcrypt)
  "picture": "https://...",               // URL de foto de perfil
  "role": "user",                         // Rol: "user" | "admin"
  "subscription_plan": "premium",         // Plan: "basic" | "premium"
  "is_verified": true,                    // Email verificado
  "is_blocked": false,                    // Cuenta bloqueada
  "oauth_provider": "emergent_google",    // Proveedor OAuth (opcional)
  "created_at": "2026-02-20T17:58:22Z"   // Fecha de registro
}
```

**Índices:**
- `email`: Único (previene duplicados)
- `user_id`: Único (búsquedas rápidas)

---

### 6.2 Colección: subscriptions

Gestiona las suscripciones de los usuarios.

```javascript
{
  "_id": ObjectId("..."),
  "id": "397d7661-110f-4fea-a845-7cedae11d0b3",  // UUID único
  "user_id": "user_c1a542107a82",                 // Referencia al usuario
  "user_email": "usuario@email.com",              // Email (referencia rápida)
  "plan_type": "1_month",                         // Tipo de plan
  "paypal_order_id": "3T943204GA7572806",        // ID de orden PayPal
  "payment_status": "paid",                       // Estado del pago
  "payment_method": "paypal",                     // Método de pago
  "amount_paid": 20.0,                            // Monto pagado (USD)
  "currency": "USD",                              // Moneda
  "payment_date": "2026-02-20T22:00:52Z",        // Fecha de pago
  "start_date": "2026-02-20T22:00:52Z",          // Inicio de suscripción
  "end_date": "2026-03-22T22:00:52Z",            // Fin de suscripción
  "status": "active",                             // Estado: active|expired|cancelled
  "auto_renew": false,                            // Renovación automática
  "created_at": "2026-02-20T22:00:52Z"           // Fecha de creación
}
```

**Planes disponibles:**

| Plan | Precio | Duración | Ahorro |
|------|--------|----------|--------|
| 1_month | $20 USD | 30 días | - |
| 3_months | $55 USD | 90 días | $5 |
| 6_months | $100 USD | 180 días | $20 |
| 12_months | $200 USD | 365 días | $40 |

---

### 6.3 Colección: pois (Points of Interest)

Almacena los puntos de interés georreferenciados de las Líneas de Nazca.

```javascript
{
  "_id": ObjectId("..."),
  "id": "poi_el_colibri_001",              // Identificador único
  "name": "El Colibrí",                     // Nombre de la figura
  "description": "El colibrí es uno de los geoglifos más reconocidos...",
  "longitude": -75.1234,                    // Coordenada longitud
  "latitude": -14.7234,                     // Coordenada latitud
  "altitude": 1000,                         // Altura de visualización (metros)
  "category": "geoglifo",                   // Categoría
  "image_url": "https://...",               // URL imagen 360°
  "video_id": "video_xyz",                  // Referencia a video (opcional)
  "is_active": true,                        // Visible en el mapa
  "created_by": "admin_user_id",            // Usuario que lo creó
  "created_at": "2025-11-10T00:00:00Z",    // Fecha de creación
  "updated_at": "2026-02-19T00:00:00Z"     // Última actualización
}
```

**Estadísticas actuales:**
- Total de POIs: **59 figuras**
- Con imagen 360°: **33 figuras**
- Categorías: geoglifo, mirador, museo

**Coordenadas del área cubierta:**
```
Norte: -14.48° (incluye Palpa)
Sur:   -14.82°
Este:  -74.90°
Oeste: -75.25°
```

---

### 6.4 Colección: videos

Almacena los videos 360° disponibles en la plataforma.

```javascript
{
  "_id": ObjectId("..."),
  "id": "video_nazca_spanish_27m",
  "title": "Las Líneas de Nasca 27m Español",
  "description": "Documental completo sobre las Líneas de Nazca...",
  "duration": "27:55",                      // Duración del video
  "url": "https://customer-xyz.cloudflarestream.com/...",  // URL HLS
  "category": "nasca",                      // Categoría
  "cultural_tags": ["nazca", "geoglifos", "perú"],
  "thumbnail_url": "https://...",           // Miniatura
  "is_premium": true,                       // Requiere suscripción
  "stereo_format": "mono",                  // Formato: mono|sbs|tb
  "created_at": "2025-11-10T00:00:00Z"
}
```

**Videos actuales:**

| Título | Duración | Idioma | Formato |
|--------|----------|--------|---------|
| Las Líneas de Nasca 27m | 27:55 | Español | mono |
| Líneas de Nasca 16m | 16:10 | Español | mono |
| Nazca Lines English 01 | 16:10 | Inglés | mono |
| Nazca Lines 02 English | 27:00 | Inglés | mono |

---

### 6.5 Colección: reservations

Gestiona las reservaciones para experiencias VR presenciales.

```javascript
{
  "_id": ObjectId("..."),
  "id": "res_abc123",
  "user_id": "user_xyz",
  "user_name": "Max Leonard Benavides",
  "user_email": "usuario@email.com",
  "reservation_date": "2026-02-20",         // Fecha de reserva
  "time_slot": "09:00-09:20",               // Horario
  "status": "confirmed",                     // pending|confirmed|cancelled
  "qr_code": "data:image/png;base64,...",   // Código QR
  "created_at": "2026-02-19T00:00:00Z"
}
```

---

### 6.6 Colección: user_sessions

Gestiona las sesiones activas de los usuarios.

```javascript
{
  "_id": ObjectId("..."),
  "user_id": "user_c1a542107a82",
  "session_token": "Bp-5BWAaRvQiZGOEvmPqDoPBW5tBBEsQYM3Byjw3gkI",
  "expires_at": "2026-02-28T02:48:03Z",     // Expiración
  "last_activity": "2026-02-21T02:48:03Z", // Última actividad
  "created_at": "2026-02-21T02:48:03Z"
}
```

---

### 6.7 Colección: contact_messages

Almacena los mensajes del formulario de contacto.

```javascript
{
  "_id": ObjectId("..."),
  "name": "Nombre del Contacto",
  "email": "contacto@email.com",
  "phone": "+51 999 999 999",
  "message": "Contenido del mensaje...",
  "status": "sent",                          // pending|sent|failed
  "created_at": "2026-02-21T00:00:00Z"
}
```

---

## 7. API REST - ENDPOINTS

### 7.1 Autenticación

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Registro de usuario | No |
| POST | `/api/auth/login` | Inicio de sesión | No |
| POST | `/api/auth/logout` | Cerrar sesión | Sí |
| GET | `/api/auth/me` | Obtener usuario actual | Sí |
| POST | `/api/auth/google` | Login con Google OAuth | No |

### 7.2 Suscripciones y Pagos

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/subscription/status` | Estado de suscripción | Sí |
| GET | `/api/subscription/packages` | Planes disponibles | No |
| POST | `/api/paypal/create-order` | Crear orden (nuevo usuario) | No |
| POST | `/api/paypal/create-subscription-for-user` | Crear suscripción (usuario existente) | Sí |
| POST | `/api/paypal/capture-order-popup` | Capturar pago popup | Sí |
| POST | `/api/paypal/renew-subscription` | Renovar suscripción | Sí |

### 7.3 Contenido

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/videos` | Listar videos | Opcional |
| GET | `/api/videos/{id}` | Obtener video | Sí |
| GET | `/api/pois` | Listar puntos de interés | Opcional |
| POST | `/api/pois` | Crear POI | Admin |
| PUT | `/api/pois/{id}` | Actualizar POI | Admin |
| DELETE | `/api/pois/{id}` | Eliminar POI | Admin |

### 7.4 Administración

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/admin/users` | Listar usuarios | Admin |
| PUT | `/api/admin/users/{id}` | Actualizar usuario | Admin |
| DELETE | `/api/admin/users/{id}` | Eliminar usuario | Admin |
| GET | `/api/admin/stats` | Estadísticas del sistema | Admin |

### 7.5 Otros

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/api/contact` | Enviar mensaje de contacto | No |
| GET | `/api/image-proxy` | Proxy para imágenes 360° | No |
| POST | `/api/reservations` | Crear reservación | Sí |
| GET | `/api/reservations/my` | Mis reservaciones | Sí |

---

## 8. SEGURIDAD E INTEGRACIONES

### 8.1 Autenticación y Autorización

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO DE AUTENTICACIÓN                   │
└─────────────────────────────────────────────────────────────┘

    Usuario                    Frontend                   Backend
       │                          │                          │
       │  1. Login (email/pass)   │                          │
       │─────────────────────────►│                          │
       │                          │  2. POST /auth/login     │
       │                          │─────────────────────────►│
       │                          │                          │ 3. Verificar
       │                          │                          │    credenciales
       │                          │                          │    (bcrypt)
       │                          │  4. JWT Token            │
       │                          │◄─────────────────────────│
       │  5. Guardar token        │                          │
       │◄─────────────────────────│                          │
       │                          │                          │
       │  6. Acceder contenido    │                          │
       │─────────────────────────►│                          │
       │                          │  7. GET /api/videos      │
       │                          │  Header: Bearer {token}  │
       │                          │─────────────────────────►│
       │                          │                          │ 8. Validar JWT
       │                          │                          │    y permisos
       │                          │  9. Datos                │
       │                          │◄─────────────────────────│
       │  10. Mostrar contenido   │                          │
       │◄─────────────────────────│                          │
```

### 8.2 Medidas de Seguridad Implementadas

| Aspecto | Implementación | Descripción |
|---------|----------------|-------------|
| **Contraseñas** | Bcrypt (12 rounds) | Hash seguro con salt |
| **Tokens** | JWT (HS256) | Expiración configurable |
| **Sesiones** | UUID + MongoDB | Tokens únicos por sesión |
| **HTTPS** | TLS/SSL | Comunicación encriptada |
| **CORS** | Configurado | Orígenes permitidos |
| **Validación** | Pydantic | Validación de datos de entrada |
| **Roles** | RBAC | user, admin |

### 8.3 Integración PayPal

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO DE PAGO PAYPAL                     │
└─────────────────────────────────────────────────────────────┘

    Usuario          Frontend           Backend            PayPal
       │                │                  │                  │
       │ 1. Seleccionar │                  │                  │
       │    plan        │                  │                  │
       │───────────────►│                  │                  │
       │                │ 2. Crear orden   │                  │
       │                │─────────────────►│                  │
       │                │                  │ 3. Orders API    │
       │                │                  │─────────────────►│
       │                │                  │ 4. Order ID      │
       │                │                  │◄─────────────────│
       │                │ 5. Popup PayPal  │                  │
       │                │◄─────────────────│                  │
       │ 6. Autorizar   │                  │                  │
       │   pago         │                  │                  │
       │───────────────►│                  │                  │
       │                │ 7. Capturar      │                  │
       │                │─────────────────►│                  │
       │                │                  │ 8. Capture API   │
       │                │                  │─────────────────►│
       │                │                  │ 9. Confirmación  │
       │                │                  │◄─────────────────│
       │                │                  │ 10. Crear        │
       │                │                  │     suscripción  │
       │                │ 11. Éxito        │                  │
       │ 12. Acceso     │◄─────────────────│                  │
       │◄───────────────│                  │                  │
```

### 8.4 Variables de Entorno

```bash
# Base de Datos
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"

# Autenticación
JWT_SECRET_KEY="[SECRETO]"
ACCESS_TOKEN_EXPIRE_MINUTES="10080"

# PayPal
PAYPAL_CLIENT_ID="[CLIENT_ID]"
PAYPAL_CLIENT_SECRET="[SECRETO]"
PAYPAL_MODE="live"

# Email
SENDGRID_API_KEY="[API_KEY]"
FROM_EMAIL="max@nazca360.com"

# Google OAuth
GOOGLE_CLIENT_ID="[CLIENT_ID]"
GOOGLE_CLIENT_SECRET="[SECRETO]"

# Cloudflare Stream
CF_STREAM_TOKEN="[TOKEN]"
CF_ACCOUNT_ID="[ACCOUNT_ID]"
```

---

## 9. INFRAESTRUCTURA DE DESPLIEGUE

### 9.1 Arquitectura de Despliegue

```
┌─────────────────────────────────────────────────────────────┐
│                     INTERNET / USUARIOS                      │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE (CDN/WAF)                     │
│                   - SSL/TLS Termination                     │
│                   - DDoS Protection                         │
│                   - Edge Caching                            │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 KUBERNETES CLUSTER (EMERGENT)               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────┐       ┌─────────────────┐            │
│   │    NGINX        │       │    NGINX        │            │
│   │   Ingress       │       │   Ingress       │            │
│   │   (Puerto 80)   │       │   (Puerto 443)  │            │
│   └────────┬────────┘       └────────┬────────┘            │
│            │                         │                      │
│            └───────────┬─────────────┘                      │
│                        │                                    │
│            ┌───────────┴───────────┐                       │
│            │                       │                        │
│            ▼                       ▼                        │
│   ┌─────────────────┐     ┌─────────────────┐             │
│   │    Frontend     │     │     Backend     │             │
│   │    (React)      │     │    (FastAPI)    │             │
│   │   Puerto 3000   │     │   Puerto 8001   │             │
│   └─────────────────┘     └────────┬────────┘             │
│                                    │                        │
│                                    ▼                        │
│                          ┌─────────────────┐               │
│                          │    MongoDB      │               │
│                          │  Puerto 27017   │               │
│                          └─────────────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Configuración de Servicios

| Servicio | Puerto Interno | Puerto Externo | Tecnología |
|----------|----------------|----------------|------------|
| Frontend | 3000 | 443 (HTTPS) | React + NGINX |
| Backend | 8001 | /api/* → 8001 | FastAPI + Uvicorn |
| MongoDB | 27017 | Interno | MongoDB 7.x |

### 9.3 Escalabilidad

El sistema está preparado para escalar horizontalmente:

- **Frontend**: Puede replicarse en múltiples pods
- **Backend**: Stateless, escalable horizontalmente
- **Base de datos**: MongoDB Atlas con replica sets en producción

---

## 10. CONCLUSIONES

### 10.1 Logros Técnicos

1. **Arquitectura Robusta**: Implementación exitosa de arquitectura de tres capas con separación clara de responsabilidades.

2. **Base de Datos Flexible**: MongoDB permite evolución del esquema sin downtime y manejo eficiente de datos geoespaciales.

3. **Experiencia Inmersiva**: Integración de WebXR para visualización VR compatible con Meta Quest 3 y otros dispositivos.

4. **Pagos Seguros**: Integración completa con PayPal Orders API v2 para procesamiento de pagos.

5. **Autenticación Múltiple**: Soporte para autenticación tradicional (email/password) y OAuth 2.0 (Google).

### 10.2 Métricas del Sistema

| Métrica | Valor |
|---------|-------|
| Total de usuarios registrados | 8 |
| Suscripciones activas | 1 |
| Puntos de interés (POIs) | 59 |
| Videos 360° disponibles | 4 |
| Imágenes 360° | 33 |
| Área geográfica cubierta | ~500 km² |

### 10.3 Trabajo Futuro

- [ ] Implementar DRM para protección de contenido premium
- [ ] Modularizar backend en microservicios
- [ ] Agregar soporte multiidioma completo
- [ ] Implementar analytics avanzados
- [ ] Desarrollar aplicación móvil nativa

---

## ANEXOS

### Anexo A: Credenciales de Prueba

| Tipo | Email | Contraseña | Rol |
|------|-------|------------|-----|
| Admin | benavidesdenasca@gmail.com | Benavides02@ | admin |

### Anexo B: URLs del Sistema

| Entorno | URL |
|---------|-----|
| Preview | https://ancient-lines-vr.preview.emergentagent.com |
| Admin Panel | https://ancient-lines-vr.preview.emergentagent.com/admin |
| API Base | https://ancient-lines-vr.preview.emergentagent.com/api |

### Anexo C: Contacto del Proyecto

- **Empresa**: Nazca360
- **Dirección**: Calle Lima 160 (Restobar Nazka), Nasca, Ica, Perú
- **WhatsApp**: +51 956 567 391
- **Email**: max@nazca360.com

---

*Documento generado el 21 de Febrero de 2026*
