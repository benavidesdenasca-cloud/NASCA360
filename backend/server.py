from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Header
from fastapi.responses import RedirectResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
import httpx
from authlib.integrations.starlette_client import OAuth

# Import custom auth utilities
from auth_utils import (
    hash_password, verify_password, create_access_token, decode_access_token,
    generate_verification_token, verify_email_token,
    generate_password_reset_token, verify_password_reset_token,
    send_verification_email, send_password_reset_email
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Stripe setup
STRIPE_API_KEY = os.environ['STRIPE_API_KEY']

# Google OAuth setup
GOOGLE_CLIENT_ID = os.environ['GOOGLE_CLIENT_ID']
GOOGLE_CLIENT_SECRET = os.environ['GOOGLE_CLIENT_SECRET']
GOOGLE_REDIRECT_URI = os.environ['GOOGLE_REDIRECT_URI']

oauth = OAuth()
oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    password_hash: Optional[str] = None  # None for OAuth users
    picture: Optional[str] = None
    role: str = "user"  # user or admin
    subscription_plan: str = "basic"  # basic or premium
    is_verified: bool = False  # Email verification status
    oauth_provider: Optional[str] = None  # google, None for email/password
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    session_token: str
    expires_at: datetime
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Subscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    plan_type: str  # basic or premium
    stripe_session_id: Optional[str] = None
    payment_status: str  # initiated, paid, failed, cancelled
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    auto_renew: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Video360(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    duration: str  # "5:30"
    url: str
    category: str  # nasca, palpa, museum
    tags: List[str] = []
    thumbnail_url: str
    is_premium: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CabinReservation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    user_email: str
    reservation_date: str  # "2025-01-15"
    time_slot: str  # "10:00-11:00"
    status: str = "pending"  # pending, confirmed, cancelled
    qr_code: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_id: str
    amount: float
    currency: str
    metadata: Dict = {}
    payment_status: str = "initiated"  # initiated, paid, failed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== REQUEST/RESPONSE MODELS ====================

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class SubscriptionCheckoutRequest(BaseModel):
    plan_type: str  # premium
    origin_url: str

class ReservationCreate(BaseModel):
    reservation_date: str
    time_slot: str

class VideoCreate(BaseModel):
    title: str
    description: str
    duration: str
    url: str
    category: str
    tags: List[str]
    thumbnail_url: str
    is_premium: bool

# ==================== AUTHENTICATION ====================

async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    """Get current authenticated user from JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    user_id = decode_access_token(token)
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Find session
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Session not found")
    
    # Check session expiration (30 minutes of inactivity)
    last_activity = datetime.fromisoformat(session['last_activity']) if isinstance(session['last_activity'], str) else session['last_activity']
    if datetime.now(timezone.utc) - last_activity > timedelta(minutes=30):
        await db.user_sessions.delete_one({"session_token": token})
        raise HTTPException(status_code=401, detail="Session expired due to inactivity")
    
    # Update last activity
    await db.user_sessions.update_one(
        {"session_token": token},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Get user
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)

async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[User]:
    """Get current user if authenticated, None otherwise"""
    try:
        return await get_current_user(authorization)
    except:
        return None

async def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(request: RegisterRequest, req: Request):
    """Register new user with email and password"""
    # Check if user already exists
    existing_user = await db.users.find_one({"email": request.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    password_hash = hash_password(request.password)
    
    # Create user
    new_user = User(
        email=request.email,
        name=request.name,
        password_hash=password_hash,
        is_verified=False,
        oauth_provider=None
    )
    
    user_dict = new_user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    await db.users.insert_one(user_dict)
    
    # Generate verification token
    verification_token = generate_verification_token(request.email)
    
    # Send verification email
    base_url = str(req.base_url).rstrip('/')
    email_sent = await send_verification_email(request.email, verification_token, base_url)
    
    if not email_sent:
        logger.error(f"Failed to send verification email to {request.email}")
    
    return {
        "message": "Registro exitoso. Por favor verifica tu correo electrónico para activar tu cuenta.",
        "email": request.email
    }

@api_router.get("/auth/verify-email")
async def verify_email(token: str):
    """Verify email address"""
    email = verify_email_token(token)
    if not email:
        raise HTTPException(status_code=400, detail="Token inválido o expirado")
    
    # Update user verification status
    result = await db.users.update_one(
        {"email": email},
        {"$set": {"is_verified": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {"message": "Email verificado exitosamente. Ya puedes iniciar sesión."}

@api_router.post("/auth/login")
async def login(request: LoginRequest):
    """Login with email and password"""
    # Find user
    user_doc = await db.users.find_one({"email": request.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    user = User(**user_doc)
    
    # Check if user registered with OAuth
    if user.oauth_provider:
        raise HTTPException(status_code=400, detail=f"Esta cuenta fue creada con {user.oauth_provider}. Por favor inicia sesión con {user.oauth_provider}.")
    
    # Verify password
    if not user.password_hash or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    # Check if email is verified
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Por favor verifica tu correo electrónico antes de iniciar sesión")
    
    # Create session token
    session_token = create_access_token(user.id)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    
    # Save session
    session = UserSession(
        user_id=user.id,
        session_token=session_token,
        expires_at=expires_at
    )
    
    session_dict = session.model_dump()
    session_dict['expires_at'] = session_dict['expires_at'].isoformat()
    session_dict['last_activity'] = session_dict['last_activity'].isoformat()
    session_dict['created_at'] = session_dict['created_at'].isoformat()
    
    await db.user_sessions.insert_one(session_dict)
    
    return {
        "access_token": session_token,
        "token_type": "bearer",
        "user": user.model_dump(exclude={'password_hash'})
    }

@api_router.get("/auth/google")
async def google_login(request: Request):
    """Initiate Google OAuth login"""
    redirect_uri = GOOGLE_REDIRECT_URI
    return await oauth.google.authorize_redirect(request, redirect_uri)

@api_router.get("/auth/google/callback")
async def google_callback(request: Request):
    """Google OAuth callback"""
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        
        if not user_info:
            raise HTTPException(status_code=400, detail="No se pudo obtener información del usuario")
        
        email = user_info.get('email')
        name = user_info.get('name', email.split('@')[0])
        picture = user_info.get('picture')
        
        # Check if user exists
        user_doc = await db.users.find_one({"email": email}, {"_id": 0})
        
        if user_doc:
            user = User(**user_doc)
        else:
            # Create new user
            new_user = User(
                email=email,
                name=name,
                picture=picture,
                is_verified=True,  # OAuth users are pre-verified
                oauth_provider="google",
                password_hash=None
            )
            
            user_dict = new_user.model_dump()
            user_dict['created_at'] = user_dict['created_at'].isoformat()
            await db.users.insert_one(user_dict)
            user = new_user
        
        # Create session
        session_token = create_access_token(user.id)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
        
        session = UserSession(
            user_id=user.id,
            session_token=session_token,
            expires_at=expires_at
        )
        
        session_dict = session.model_dump()
        session_dict['expires_at'] = session_dict['expires_at'].isoformat()
        session_dict['last_activity'] = session_dict['last_activity'].isoformat()
        session_dict['created_at'] = session_dict['created_at'].isoformat()
        
        await db.user_sessions.insert_one(session_dict)
        
        # Redirect to frontend with token
        frontend_url = str(request.base_url).rstrip('/')
        return RedirectResponse(url=f"{frontend_url}/auth-success?token={session_token}")
        
    except Exception as e:
        logger.error(f"Google OAuth error: {str(e)}")
        raise HTTPException(status_code=400, detail="Error en autenticación con Google")

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, req: Request):
    """Request password reset"""
    user_doc = await db.users.find_one({"email": request.email})
    
    # Always return success (don't reveal if email exists)
    if not user_doc:
        return {"message": "Si el correo existe, recibirás un enlace para restablecer tu contraseña"}
    
    user = User(**user_doc)
    
    # Check if user registered with OAuth
    if user.oauth_provider:
        return {"message": "Esta cuenta fue creada con OAuth. No puedes restablecer la contraseña."}
    
    # Generate reset token
    reset_token = generate_password_reset_token(request.email)
    
    # Send reset email
    base_url = str(req.base_url).rstrip('/')
    email_sent = await send_password_reset_email(request.email, reset_token, base_url)
    
    if not email_sent:
        logger.error(f"Failed to send password reset email to {request.email}")
    
    return {"message": "Si el correo existe, recibirás un enlace para restablecer tu contraseña"}

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password with token"""
    email = verify_password_reset_token(request.token)
    if not email:
        raise HTTPException(status_code=400, detail="Token inválido o expirado")
    
    # Hash new password
    new_password_hash = hash_password(request.new_password)
    
    # Update password
    result = await db.users.update_one(
        {"email": email},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Invalidate all existing sessions
    await db.user_sessions.delete_many({"user_id": {"$exists": True}})
    
    return {"message": "Contraseña actualizada exitosamente. Por favor inicia sesión con tu nueva contraseña."}

@api_router.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user.model_dump(exclude={'password_hash'})

@api_router.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_user), authorization: Optional[str] = Header(None)):
    """Logout user by deleting session"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        await db.user_sessions.delete_one({"session_token": token})
    
    return {"message": "Logged out successfully"}

# ==================== VIDEO ROUTES ====================

@api_router.get("/videos", response_model=List[Video360])
async def get_videos(category: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get videos - REQUIRES ACTIVE SUBSCRIPTION"""
    # Check if user has active subscription
    if not current_user.subscription_plan or current_user.subscription_plan == "basic":
        raise HTTPException(status_code=403, detail="Suscripción requerida para acceder al contenido")
    
    # Verify subscription is not expired
    subscription = await db.subscriptions.find_one(
        {"user_id": current_user.id, "payment_status": "paid"},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if subscription and subscription.get('end_date'):
        end_date = datetime.fromisoformat(subscription['end_date']) if isinstance(subscription['end_date'], str) else subscription['end_date']
        if datetime.now(timezone.utc) > end_date:
            raise HTTPException(status_code=403, detail="Tu suscripción ha expirado. Por favor renueva tu plan.")
    
    query = {}
    if category:
        query['category'] = category
    
    videos = await db.videos.find(query, {"_id": 0}).to_list(1000)
    
    return videos

@api_router.get("/videos/{video_id}", response_model=Video360)
async def get_video(video_id: str, current_user: User = Depends(get_current_user)):
    """Get single video details - REQUIRES ACTIVE SUBSCRIPTION"""
    # Check if user has active subscription
    if not current_user.subscription_plan or current_user.subscription_plan == "basic":
        raise HTTPException(status_code=403, detail="Suscripción requerida para acceder al contenido")
    
    # Verify subscription is not expired
    subscription = await db.subscriptions.find_one(
        {"user_id": current_user.id, "payment_status": "paid"},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if subscription and subscription.get('end_date'):
        end_date = datetime.fromisoformat(subscription['end_date']) if isinstance(subscription['end_date'], str) else subscription['end_date']
        if datetime.now(timezone.utc) > end_date:
            raise HTTPException(status_code=403, detail="Tu suscripción ha expirado. Por favor renueva tu plan.")
    
    video = await db.videos.find_one({"id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    return video

# ==================== SUBSCRIPTION ROUTES ====================

# Subscription packages - NO FREE PLAN
SUBSCRIPTION_PACKAGES = {
    "daily": {
        "amount": 20.00,
        "currency": "usd",
        "name": "Plan Diario",
        "duration_days": 1
    },
    "weekly": {
        "amount": 100.00,
        "currency": "usd",
        "name": "Plan Semanal",
        "duration_days": 7
    },
    "monthly": {
        "amount": 200.00,
        "currency": "usd",
        "name": "Plan Mensual",
        "duration_days": 30
    },
    "annual": {
        "amount": 500.00,
        "currency": "usd",
        "name": "Plan Anual",
        "duration_days": 365
    }
}

@api_router.post("/subscriptions/checkout")
async def create_subscription_checkout(
    request: SubscriptionCheckoutRequest,
    current_user: User = Depends(get_current_user),
    req: Request = None
):
    """Create Stripe checkout session for subscription"""
    if request.plan_type not in SUBSCRIPTION_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid plan type")
    
    package = SUBSCRIPTION_PACKAGES[request.plan_type]
    
    host_url = request.origin_url
    webhook_url = f"{str(req.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    success_url = f"{host_url}/subscription/success?session_id={{{{CHECKOUT_SESSION_ID}}}}"
    cancel_url = f"{host_url}/subscription"
    
    checkout_request = CheckoutSessionRequest(
        amount=package['amount'],
        currency=package['currency'],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": current_user.id,
            "plan_type": request.plan_type,
            "user_email": current_user.email
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    transaction = PaymentTransaction(
        user_id=current_user.id,
        session_id=session.session_id,
        amount=package['amount'],
        currency=package['currency'],
        metadata={
            "plan_type": request.plan_type,
            "user_email": current_user.email
        },
        payment_status="initiated"
    )
    
    transaction_dict = transaction.model_dump()
    transaction_dict['created_at'] = transaction_dict['created_at'].isoformat()
    await db.payment_transactions.insert_one(transaction_dict)
    
    subscription = Subscription(
        user_id=current_user.id,
        plan_type=request.plan_type,
        stripe_session_id=session.session_id,
        payment_status="initiated"
    )
    
    subscription_dict = subscription.model_dump()
    subscription_dict['created_at'] = subscription_dict['created_at'].isoformat()
    if subscription_dict.get('start_date'):
        subscription_dict['start_date'] = subscription_dict['start_date'].isoformat()
    if subscription_dict.get('end_date'):
        subscription_dict['end_date'] = subscription_dict['end_date'].isoformat()
    
    await db.subscriptions.insert_one(subscription_dict)
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/subscriptions/status/{session_id}")
async def get_subscription_status(
    session_id: str,
    current_user: User = Depends(get_current_user),
    req: Request = None
):
    """Check subscription payment status"""
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction['payment_status'] == "paid":
        return {"status": "paid", "message": "Subscription activated"}
    
    webhook_url = f"{str(req.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    checkout_status = await stripe_checkout.get_checkout_status(session_id)
    
    if checkout_status.payment_status == "paid" and transaction['payment_status'] != "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid"}}
        )
        
        plan_type = transaction['metadata'].get('plan_type', 'monthly')
        plan_config = SUBSCRIPTION_PACKAGES.get(plan_type, SUBSCRIPTION_PACKAGES['monthly'])
        
        start_date = datetime.now(timezone.utc)
        end_date = start_date + timedelta(days=plan_config['duration_days'])
        
        await db.subscriptions.update_one(
            {"stripe_session_id": session_id},
            {"$set": {
                "payment_status": "paid",
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            }}
        )
        
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"subscription_plan": plan_type}}
        )
        
        return {"status": "paid", "message": "Subscription activated successfully"}
    
    return {
        "status": checkout_status.payment_status,
        "message": "Payment pending"
    }

@api_router.get("/subscriptions/me")
async def get_my_subscription(current_user: User = Depends(get_current_user)):
    """Get current user's subscription"""
    subscription = await db.subscriptions.find_one(
        {"user_id": current_user.id, "payment_status": "paid"},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if not subscription:
        return {"plan_type": "basic", "status": "active"}
    
    return subscription

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.event_type == "checkout.session.completed":
            session_id = webhook_response.session_id
            
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid"}}
            )
            
            transaction = await db.payment_transactions.find_one({"session_id": session_id})
            if transaction:
                plan_type = transaction['metadata'].get('plan_type', 'monthly')
                plan_config = SUBSCRIPTION_PACKAGES.get(plan_type, SUBSCRIPTION_PACKAGES['monthly'])
                
                start_date = datetime.now(timezone.utc)
                end_date = start_date + timedelta(days=plan_config['duration_days'])
                
                await db.subscriptions.update_one(
                    {"stripe_session_id": session_id},
                    {"$set": {
                        "payment_status": "paid",
                        "start_date": start_date.isoformat(),
                        "end_date": end_date.isoformat()
                    }}
                )
                
                user_id = transaction['user_id']
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"subscription_plan": plan_type}}
                )
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# ==================== RESERVATION ROUTES ====================

@api_router.get("/reservations/available")
async def get_available_slots(date: str, current_user: User = Depends(get_current_user)):
    """Get available time slots for a date - REQUIRES AUTHENTICATION"""
    reservations = await db.reservations.find(
        {"reservation_date": date, "status": {"$ne": "cancelled"}},
        {"_id": 0}
    ).to_list(100)
    
    booked_slots = [r['time_slot'] for r in reservations]
    
    # Generate 20-minute slots from 9 AM to 6 PM
    all_slots = []
    for hour in range(9, 18):
        for minute in [0, 20, 40]:
            start_time = f"{hour:02d}:{minute:02d}"
            end_minute = minute + 20
            end_hour = hour
            if end_minute >= 60:
                end_minute -= 60
                end_hour += 1
            end_time = f"{end_hour:02d}:{end_minute:02d}"
            all_slots.append(f"{start_time}-{end_time}")
    
    available_slots = [slot for slot in all_slots if slot not in booked_slots]
    
    return {"date": date, "available_slots": available_slots}

@api_router.post("/reservations/checkout")
async def create_reservation_checkout(
    reservation: ReservationCreate,
    current_user: User = Depends(get_current_user),
    req: Request = None
):
    """Create Stripe checkout session for cabin reservation - PRICE: $10 USD"""
    # Check if slot is available
    existing = await db.reservations.find_one({
        "reservation_date": reservation.reservation_date,
        "time_slot": reservation.time_slot,
        "status": {"$ne": "cancelled"}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Time slot already booked")
    
    # Create Stripe checkout session
    host_url = str(req.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    success_url = f"{host_url}/reservations/success?session_id={{{{CHECKOUT_SESSION_ID}}}}"
    cancel_url = f"{host_url}/reservations"
    
    checkout_request = CheckoutSessionRequest(
        amount=10.00,  # $10 USD for all users
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": current_user.id,
            "reservation_date": reservation.reservation_date,
            "time_slot": reservation.time_slot,
            "user_name": current_user.name,
            "user_email": current_user.email,
            "type": "reservation"
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create pending reservation
    new_reservation = CabinReservation(
        user_id=current_user.id,
        user_name=current_user.name,
        user_email=current_user.email,
        reservation_date=reservation.reservation_date,
        time_slot=reservation.time_slot,
        status="pending",
        qr_code=f"QR-{str(uuid.uuid4())[:8].upper()}"
    )
    
    reservation_dict = new_reservation.model_dump()
    reservation_dict['created_at'] = reservation_dict['created_at'].isoformat()
    reservation_dict['stripe_session_id'] = session.session_id
    await db.reservations.insert_one(reservation_dict)
    
    # Create payment transaction
    transaction = PaymentTransaction(
        user_id=current_user.id,
        session_id=session.session_id,
        amount=10.00,
        currency="usd",
        metadata={
            "type": "reservation",
            "reservation_date": reservation.reservation_date,
            "time_slot": reservation.time_slot
        },
        payment_status="initiated"
    )
    
    transaction_dict = transaction.model_dump()
    transaction_dict['created_at'] = transaction_dict['created_at'].isoformat()
    await db.payment_transactions.insert_one(transaction_dict)
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/reservations/status/{session_id}")
async def get_reservation_status(
    session_id: str,
    current_user: User = Depends(get_current_user),
    req: Request = None
):
    """Check reservation payment status"""
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction['payment_status'] == "paid":
        return {"status": "paid", "message": "Reserva confirmada"}
    
    webhook_url = f"{str(req.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    checkout_status = await stripe_checkout.get_checkout_status(session_id)
    
    if checkout_status.payment_status == "paid" and transaction['payment_status'] != "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid"}}
        )
        
        await db.reservations.update_one(
            {"stripe_session_id": session_id},
            {"$set": {"status": "confirmed"}}
        )
        
        return {"status": "paid", "message": "Reserva confirmada exitosamente"}
    
    return {
        "status": checkout_status.payment_status,
        "message": "Payment pending"
    }

@api_router.get("/reservations/me")
async def get_my_reservations(current_user: User = Depends(get_current_user)):
    """Get current user's reservations"""
    reservations = await db.reservations.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return reservations

@api_router.put("/reservations/{reservation_id}")
async def update_reservation(
    reservation_id: str,
    status: str,
    current_user: User = Depends(get_current_user)
):
    """Update reservation status (cancel)"""
    reservation = await db.reservations.find_one({"id": reservation_id, "user_id": current_user.id})
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    await db.reservations.update_one(
        {"id": reservation_id},
        {"$set": {"status": status}}
    )
    
    return {"message": "Reservation updated"}

# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/users")
async def get_all_users(admin: User = Depends(require_admin)):
    """Get all users (admin only)"""
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.get("/admin/subscriptions")
async def get_all_subscriptions(admin: User = Depends(require_admin)):
    """Get all subscriptions (admin only)"""
    subscriptions = await db.subscriptions.find({}, {"_id": 0}).to_list(1000)
    return subscriptions

@api_router.get("/admin/reservations")
async def get_all_reservations(admin: User = Depends(require_admin)):
    """Get all reservations (admin only)"""
    reservations = await db.reservations.find({}, {"_id": 0}).to_list(1000)
    return reservations

@api_router.get("/admin/metrics")
async def get_admin_metrics(admin: User = Depends(require_admin)):
    """Get dashboard metrics (admin only)"""
    total_users = await db.users.count_documents({})
    premium_users = await db.users.count_documents({"subscription_plan": "premium"})
    total_reservations = await db.reservations.count_documents({})
    total_videos = await db.videos.count_documents({})
    
    paid_transactions = await db.payment_transactions.find(
        {"payment_status": "paid"},
        {"_id": 0}
    ).to_list(1000)
    
    total_revenue = sum(t['amount'] for t in paid_transactions)
    
    return {
        "total_users": total_users,
        "premium_users": premium_users,
        "total_reservations": total_reservations,
        "total_videos": total_videos,
        "total_revenue": total_revenue
    }

@api_router.post("/admin/videos")
async def create_video(video: VideoCreate, admin: User = Depends(require_admin)):
    """Create new video (admin only)"""
    new_video = Video360(**video.model_dump())
    video_dict = new_video.model_dump()
    video_dict['created_at'] = video_dict['created_at'].isoformat()
    await db.videos.insert_one(video_dict)
    return new_video

@api_router.put("/admin/videos/{video_id}")
async def update_video(
    video_id: str,
    video: VideoCreate,
    admin: User = Depends(require_admin)
):
    """Update video (admin only)"""
    await db.videos.update_one(
        {"id": video_id},
        {"$set": video.model_dump()}
    )
    return {"message": "Video updated"}

@api_router.delete("/admin/videos/{video_id}")
async def delete_video(video_id: str, admin: User = Depends(require_admin)):
    """Delete video (admin only)"""
    result = await db.videos.delete_one({"id": video_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Video not found")
    return {"message": "Video deleted"}

# ==================== BASIC ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "Nazca360 API"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Add middlewares BEFORE including routers
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get('JWT_SECRET_KEY', 'nazca360_super_secret_key_2025'),
    max_age=3600
)

# Include the router in the main app
app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.on_event("startup")
async def startup_db():
    """Initialize database with sample videos"""
    count = await db.videos.count_documents({})
    if count == 0:
        sample_videos = [
            {
                "id": str(uuid.uuid4()),
                "title": "Las Líneas de Nasca - El Colibrí",
                "description": "Sobrevuela el famoso geoglifo del colibrí, una de las figuras más icónicas de las Líneas de Nasca.",
                "duration": "4:30",
                "url": "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4",
                "category": "nasca",
                "tags": ["colibrí", "geoglifo", "patrimonio"],
                "thumbnail_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
                "is_premium": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "El Astronauta de Nasca",
                "description": "Descubre el misterioso geoglifo conocido como 'El Astronauta', una figura enigmática que ha fascinado a investigadores durante décadas.",
                "duration": "5:15",
                "url": "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4",
                "category": "nasca",
                "tags": ["astronauta", "misterio", "antiguo"],
                "thumbnail_url": "https://images.unsplash.com/photo-1464550838636-1a3496df938b?w=800",
                "is_premium": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "La Araña de Nasca",
                "description": "Explora uno de los geoglifos más grandes y complejos: la araña, con sus líneas perfectas trazadas en el desierto hace más de 2000 años.",
                "duration": "6:00",
                "url": "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4",
                "category": "nasca",
                "tags": ["araña", "geoglifo", "arqueología"],
                "thumbnail_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
                "is_premium": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Líneas de Palpa - El Pelícano",
                "description": "Descubre las menos conocidas pero igualmente impresionantes líneas de Palpa, con esta vista del geoglifo del pelícano.",
                "duration": "4:45",
                "url": "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4",
                "category": "palpa",
                "tags": ["palpa", "pelícano", "cultura"],
                "thumbnail_url": "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=800",
                "is_premium": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Museo Virtual - Colección Cerámica",
                "description": "Recorre nuestra colección de cerámica Nasca en 360°, observando de cerca los intrincados diseños y símbolos ancestrales.",
                "duration": "7:20",
                "url": "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4",
                "category": "museum",
                "tags": ["museo", "cerámica", "cultura nasca"],
                "thumbnail_url": "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=800",
                "is_premium": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        
        await db.videos.insert_many(sample_videos)
        logger.info("Sample videos initialized")
