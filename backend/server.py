from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Header, UploadFile, File
from fastapi.responses import RedirectResponse, JSONResponse, FileResponse
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
import aiofiles
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

import jwt

# Import custom auth utilities
from auth_utils import (
    hash_password, verify_password, create_access_token, decode_access_token,
    generate_verification_token, verify_email_token,
    generate_password_reset_token, verify_password_reset_token,
    send_verification_email, send_password_reset_email,
    JWT_SECRET_KEY, JWT_ALGORITHM
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

# AWS S3 Configuration
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
S3_BUCKET_NAME = os.environ.get('S3_BUCKET_NAME', 'nazca360-videos')

# Cloudflare R2 Configuration (CDN)
R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY')
R2_ENDPOINT = os.environ.get('R2_ENDPOINT')
R2_BUCKET_NAME = os.environ.get('R2_BUCKET_NAME', 'nasca360video')
R2_ACCOUNT_ID = os.environ.get('R2_ACCOUNT_ID')

# Initialize S3 client
s3_client = None
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    s3_client = boto3.client(
        's3',
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_REGION,
        config=Config(signature_version='s3v4')
    )

# Initialize R2 client (Cloudflare - S3 compatible)
r2_client = None
if R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY and R2_ENDPOINT:
    r2_client = boto3.client(
        's3',
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        endpoint_url=R2_ENDPOINT,
        config=Config(signature_version='s3v4')
    )

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
    user_id: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:12]}")
    email: str
    name: str
    password_hash: Optional[str] = None  # None for OAuth users
    picture: Optional[str] = None
    role: str = "user"  # user or admin
    subscription_plan: str = "basic"  # basic or premium
    is_verified: bool = False  # Email verification status
    is_blocked: bool = False  # Account blocked status
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
    cultural_tags: List[str] = []
    thumbnail_url: Optional[str] = None
    is_premium: bool = True  # All content is premium by default
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CabinReservation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    user_email: str
    reservation_date: str  # "2025-01-15"
    time_slot: str  # "09:00-09:20" (20 minutes)
    cabin_number: int  # 1, 2, or 3
    status: str = "pending"  # pending, confirmed, cancelled
    qr_code: str = ""
    stripe_session_id: Optional[str] = None
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
    cabin_number: int  # 1, 2, or 3

class VideoCreate(BaseModel):
    title: str
    description: str
    duration: str
    url: str
    category: str
    cultural_tags: List[str] = []
    thumbnail_url: Optional[str] = None
    is_premium: bool = True

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
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Session not found")
    
    # Check session expiration using expires_at field
    expires_at = session['expires_at']
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": token})
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Update last activity
    await db.user_sessions.update_one(
        {"session_token": token},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Get user
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    user = User(**user_doc)
    
    # Check if account is blocked
    if user.is_blocked:
        await db.user_sessions.delete_many({"user_id": user_id})
        raise HTTPException(status_code=403, detail="Tu cuenta ha sido bloqueada")
    
    return user

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
    """Login with email and password - requires active subscription"""
    # Find user
    user_doc = await db.users.find_one({"email": request.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    user = User(**user_doc)
    
    # Check if account is blocked
    if user.is_blocked:
        raise HTTPException(status_code=403, detail="Tu cuenta ha sido bloqueada. Contacta al administrador.")
    
    # Check if user registered with OAuth
    if user.oauth_provider:
        raise HTTPException(status_code=400, detail=f"Esta cuenta fue creada con {user.oauth_provider}. Por favor inicia sesión con {user.oauth_provider}.")
    
    # Verify password
    if not user.password_hash or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    # Check if email is verified
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Por favor verifica tu correo electrónico antes de iniciar sesión")
    
    # NETFLIX MODEL: Check if user has active subscription (except admin)
    if user.role != 'admin' and user.subscription_plan == 'basic':
        raise HTTPException(
            status_code=403, 
            detail="Necesitas una suscripción activa para acceder. Por favor suscríbete para continuar."
        )
    
    # Create session token
    session_token = create_access_token(user.user_id)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    
    # Save session
    session = UserSession(
        user_id=user.user_id,
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
        session_token = create_access_token(user.user_id)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
        
        session = UserSession(
            user_id=user.user_id,
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

@api_router.post("/auth/session")
async def process_emergent_session(request: Request):
    """Process Emergent Auth session_id and create user session"""
    try:
        body = await request.json()
        session_id = body.get('session_id')
        
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id is required")
        
        # Call Emergent Auth API to get user data
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
                timeout=10.0
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid session_id")
            
            user_data = response.json()
        
        # Extract user info
        email = user_data.get('email')
        name = user_data.get('name')
        picture = user_data.get('picture')
        emergent_session_token = user_data.get('session_token')
        
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
                is_verified=True,  # Emergent Auth users are pre-verified
                oauth_provider="emergent_google",
                password_hash=None
            )
            
            user_dict = new_user.model_dump()
            user_dict['created_at'] = user_dict['created_at'].isoformat()
            await db.users.insert_one(user_dict)
            user = new_user
        
        # Create session with 7-day expiry
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        session = UserSession(
            user_id=user.user_id,
            session_token=emergent_session_token,
            expires_at=expires_at
        )
        
        session_dict = session.model_dump()
        session_dict['expires_at'] = session_dict['expires_at'].isoformat()
        session_dict['last_activity'] = session_dict['last_activity'].isoformat()
        session_dict['created_at'] = session_dict['created_at'].isoformat()
        
        await db.user_sessions.insert_one(session_dict)
        
        return {
            "session_token": emergent_session_token,
            "user": user.model_dump()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Emergent Auth error: {str(e)}")
        raise HTTPException(status_code=400, detail="Error en autenticación")

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current user from session cookie or Authorization header"""
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    session_token = None
    
    # Try to get session_token from cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Session not found")
    
    # Check session expiration (7 days for Emergent Auth, 30 mins for email/password)
    expires_at = session['expires_at']
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": session_token})
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Update last activity
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Get user
    user_id = session['user_id']
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    user = User(**user_doc)
    return user.model_dump(exclude={'password_hash'})

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
    """Get videos - Returns demo videos for non-subscribers, full videos for subscribers"""
    query = {}
    if category:
        query['category'] = category
    
    videos = await db.videos.find(query, {"_id": 0}).to_list(1000)
    
    # Check if user has active subscription
    has_subscription = False
    if current_user.subscription_plan and current_user.subscription_plan != "basic":
        subscription = await db.subscriptions.find_one(
            {"user_id": current_user.user_id, "payment_status": "paid"},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        
        if subscription and subscription.get('end_date'):
            end_date = datetime.fromisoformat(subscription['end_date']) if isinstance(subscription['end_date'], str) else subscription['end_date']
            if datetime.now(timezone.utc) > end_date:
                has_subscription = False
            else:
                has_subscription = True
    
    # Modify videos based on subscription status
    for video in videos:
        if not has_subscription:
            # Replace with demo/low quality URL
            video['url_demo'] = video['url']
            video['url'] = video.get('url_demo', video['url'])  # Use demo URL
            video['is_demo'] = True
            video['quality'] = 'low'
        else:
            video['is_demo'] = False
            video['quality'] = 'high'
    
    return videos

@api_router.get("/videos/{video_id}", response_model=Video360)
async def get_video(video_id: str, current_user: User = Depends(get_current_user)):
    """Get single video details - Returns demo or full quality based on subscription"""
    video = await db.videos.find_one({"id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Check if user has active subscription
    has_subscription = False
    if current_user.subscription_plan and current_user.subscription_plan != "basic":
        subscription = await db.subscriptions.find_one(
            {"user_id": current_user.user_id, "payment_status": "paid"},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        
        if subscription and subscription.get('end_date'):
            end_date = datetime.fromisoformat(subscription['end_date']) if isinstance(subscription['end_date'], str) else subscription['end_date']
            if datetime.now(timezone.utc) > end_date:
                has_subscription = False
            else:
                has_subscription = True
    
    # Modify video based on subscription status
    if not has_subscription:
        # Use demo/low quality URL
        video['url_demo'] = video['url']
        video['url'] = video.get('url_demo', video['url'])
        video['is_demo'] = True
        video['quality'] = 'low'
    else:
        video['is_demo'] = False
        video['quality'] = 'high'
    
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
            "user_id": current_user.user_id,
            "plan_type": request.plan_type,
            "user_email": current_user.email
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    transaction = PaymentTransaction(
        user_id=current_user.user_id,
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
        user_id=current_user.user_id,
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
            {"user_id": current_user.user_id},
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
        {"user_id": current_user.user_id, "payment_status": "paid"},
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
                transaction_type = transaction['metadata'].get('type', 'subscription')
                
                if transaction_type == 'reservation':
                    # Handle reservation payment
                    await db.reservations.update_one(
                        {"stripe_session_id": session_id},
                        {"$set": {"status": "confirmed"}}
                    )
                else:
                    # Handle subscription payment
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
                        {"user_id": user_id},
                        {"$set": {"subscription_plan": plan_type}}
                    )
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# ==================== RESERVATION ROUTES ====================

@api_router.get("/reservations/available")
async def get_available_slots(date: str, cabin_number: Optional[int] = None, current_user: User = Depends(get_current_user)):
    """Get available time slots for a date and cabin - REQUIRES AUTHENTICATION
    
    Returns slots with cabin availability:
    - If cabin_number specified: returns available slots for that cabin
    - If no cabin_number: returns all slots with cabin availability count
    """
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
    
    if cabin_number:
        # Get booked slots for specific cabin
        reservations = await db.reservations.find(
            {
                "reservation_date": date, 
                "cabin_number": cabin_number,
                "status": {"$ne": "cancelled"}
            },
            {"_id": 0}
        ).to_list(100)
        
        booked_slots = [r['time_slot'] for r in reservations]
        available_slots = [slot for slot in all_slots if slot not in booked_slots]
        
        return {
            "date": date,
            "cabin_number": cabin_number,
            "available_slots": available_slots
        }
    else:
        # Get all reservations for the date
        reservations = await db.reservations.find(
            {"reservation_date": date, "status": {"$ne": "cancelled"}},
            {"_id": 0}
        ).to_list(1000)
        
        # Count cabins available per slot
        slots_with_availability = []
        for slot in all_slots:
            # Count how many cabins are booked for this slot
            booked_cabins = [r['cabin_number'] for r in reservations if r['time_slot'] == slot]
            available_cabins_count = 3 - len(booked_cabins)
            available_cabin_numbers = [i for i in [1, 2, 3] if i not in booked_cabins]
            
            if available_cabins_count > 0:
                slots_with_availability.append({
                    "time_slot": slot,
                    "available_cabins_count": available_cabins_count,
                    "available_cabin_numbers": available_cabin_numbers
                })
        
        return {
            "date": date,
            "total_cabins": 3,
            "slots": slots_with_availability
        }

@api_router.post("/reservations/checkout")
async def create_reservation_checkout(
    reservation: ReservationCreate,
    current_user: User = Depends(get_current_user),
    req: Request = None
):
    """Create Stripe checkout session for cabin reservation - PRICE: $10 USD"""
    # Validate cabin number
    if reservation.cabin_number not in [1, 2, 3]:
        raise HTTPException(status_code=400, detail="Invalid cabin number. Must be 1, 2, or 3")
    
    # Check if slot is available for this specific cabin
    existing = await db.reservations.find_one({
        "reservation_date": reservation.reservation_date,
        "time_slot": reservation.time_slot,
        "cabin_number": reservation.cabin_number,
        "status": {"$ne": "cancelled"}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Cabina {reservation.cabin_number} ya está reservada para este horario")
    
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
            "user_id": current_user.user_id,
            "reservation_date": reservation.reservation_date,
            "time_slot": reservation.time_slot,
            "cabin_number": str(reservation.cabin_number),
            "user_name": current_user.name,
            "user_email": current_user.email,
            "type": "reservation"
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create pending reservation
    new_reservation = CabinReservation(
        user_id=current_user.user_id,
        user_name=current_user.name,
        user_email=current_user.email,
        reservation_date=reservation.reservation_date,
        time_slot=reservation.time_slot,
        cabin_number=reservation.cabin_number,
        status="pending",
        qr_code=f"QR-{str(uuid.uuid4())[:8].upper()}"
    )
    
    reservation_dict = new_reservation.model_dump()
    reservation_dict['created_at'] = reservation_dict['created_at'].isoformat()
    reservation_dict['stripe_session_id'] = session.session_id
    await db.reservations.insert_one(reservation_dict)
    
    # Create payment transaction
    transaction = PaymentTransaction(
        user_id=current_user.user_id,
        session_id=session.session_id,
        amount=10.00,
        currency="usd",
        metadata={
            "type": "reservation",
            "reservation_date": reservation.reservation_date,
            "time_slot": reservation.time_slot,
            "cabin_number": reservation.cabin_number
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
        {"user_id": current_user.user_id},
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
    reservation = await db.reservations.find_one({"id": reservation_id, "user_id": current_user.user_id})
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

# ==================== ADMIN USER MANAGEMENT ====================

@api_router.put("/admin/users/{user_id}/block")
async def block_user(user_id: str, admin: User = Depends(require_admin)):
    """Block a user account (admin only)"""
    # Don't allow blocking yourself
    if user_id == admin.user_id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_blocked": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete all active sessions for this user
    await db.user_sessions.delete_many({"user_id": user_id})
    
    return {"message": "User blocked successfully"}

@api_router.put("/admin/users/{user_id}/unblock")
async def unblock_user(user_id: str, admin: User = Depends(require_admin)):
    """Unblock a user account (admin only)"""
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_blocked": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User unblocked successfully"}

@api_router.put("/admin/users/{user_id}")
async def update_user(
    user_id: str,
    update_data: dict,
    admin: User = Depends(require_admin)
):
    """Update user details (admin only)"""
    # Don't allow changing your own role
    if user_id == admin.user_id and "role" in update_data:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    
    # Allowed fields to update
    allowed_fields = ["name", "email", "role", "subscription_plan", "is_verified"]
    update_dict = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User updated successfully"}

# ==================== BASIC ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "Nazca360 API"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# ==================== AWS S3 UPLOAD ROUTES ====================

@api_router.post("/s3/presigned-url")
async def get_s3_presigned_url(
    filename: str,
    content_type: str = "application/octet-stream",
    file_size: int = 0,
    current_user: User = Depends(get_current_user)
):
    """Generate a presigned URL for direct S3 upload"""
    if not s3_client:
        raise HTTPException(status_code=500, detail="S3 no está configurado")
    
    # Generate unique key
    file_extension = Path(filename).suffix.lower() if filename else ""
    unique_key = f"videos/{uuid.uuid4().hex}{file_extension}"
    
    # Determine correct content type based on extension
    content_type_map = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    }
    actual_content_type = content_type_map.get(file_extension, 'application/octet-stream')
    
    try:
        # Create bucket if it doesn't exist
        try:
            s3_client.head_bucket(Bucket=S3_BUCKET_NAME)
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                # Bucket doesn't exist, create it
                if AWS_REGION == 'us-east-1':
                    s3_client.create_bucket(Bucket=S3_BUCKET_NAME)
                else:
                    s3_client.create_bucket(
                        Bucket=S3_BUCKET_NAME,
                        CreateBucketConfiguration={'LocationConstraint': AWS_REGION}
                    )
                logger.info(f"Created S3 bucket: {S3_BUCKET_NAME}")
            else:
                raise
        
        # Generate presigned URL for upload WITHOUT ContentType restriction
        # This allows the browser to set any Content-Type
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': S3_BUCKET_NAME,
                'Key': unique_key
            },
            ExpiresIn=7200  # 2 hours
        )
        
        # Generate the public URL for accessing the file
        s3_url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{unique_key}"
        
        return {
            "presigned_url": presigned_url,
            "s3_key": unique_key,
            "s3_url": s3_url,
            "content_type": actual_content_type,
            "expires_in": 7200
        }
    except ClientError as e:
        logger.error(f"S3 error: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando URL de S3: {str(e)}")

# ==================== S3 MULTIPART UPLOAD (for files > 5GB) ====================

@api_router.post("/s3/multipart/init")
async def init_multipart_upload(
    filename: str,
    file_size: int,
    current_user: User = Depends(get_current_user)
):
    """Initialize a multipart upload for large files (> 5GB)"""
    if not s3_client:
        raise HTTPException(status_code=500, detail="S3 no está configurado")
    
    file_extension = Path(filename).suffix.lower() if filename else ""
    unique_key = f"videos/{uuid.uuid4().hex}{file_extension}"
    
    # Determine content type
    content_type_map = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
    }
    content_type = content_type_map.get(file_extension, 'application/octet-stream')
    
    try:
        # Start multipart upload
        response = s3_client.create_multipart_upload(
            Bucket=S3_BUCKET_NAME,
            Key=unique_key,
            ContentType=content_type
        )
        
        upload_id = response['UploadId']
        
        # Calculate number of parts (100MB each, minimum 5MB, maximum 10000 parts)
        part_size = 100 * 1024 * 1024  # 100MB
        num_parts = (file_size + part_size - 1) // part_size
        
        return {
            "upload_id": upload_id,
            "s3_key": unique_key,
            "part_size": part_size,
            "num_parts": num_parts,
            "s3_url": f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{unique_key}"
        }
    except ClientError as e:
        logger.error(f"S3 multipart init error: {e}")
        raise HTTPException(status_code=500, detail=f"Error iniciando subida: {str(e)}")

@api_router.post("/s3/multipart/presign-part")
async def get_multipart_presigned_url(
    upload_id: str,
    s3_key: str,
    part_number: int,
    current_user: User = Depends(get_current_user)
):
    """Generate a presigned URL for uploading a single part"""
    if not s3_client:
        raise HTTPException(status_code=500, detail="S3 no está configurado")
    
    try:
        presigned_url = s3_client.generate_presigned_url(
            'upload_part',
            Params={
                'Bucket': S3_BUCKET_NAME,
                'Key': s3_key,
                'UploadId': upload_id,
                'PartNumber': part_number
            },
            ExpiresIn=3600  # 1 hour per part
        )
        
        return {
            "presigned_url": presigned_url,
            "part_number": part_number
        }
    except ClientError as e:
        logger.error(f"S3 presign part error: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando URL de parte: {str(e)}")

class PartInfo(BaseModel):
    part_number: int
    etag: str

class CompleteMultipartRequest(BaseModel):
    upload_id: str
    s3_key: str
    parts: List[PartInfo]

@api_router.post("/s3/multipart/complete")
async def complete_multipart_upload(
    request: CompleteMultipartRequest,
    current_user: User = Depends(get_current_user)
):
    """Complete a multipart upload by combining all parts"""
    if not s3_client:
        raise HTTPException(status_code=500, detail="S3 no está configurado")
    
    try:
        # Format parts for S3
        parts = [{'PartNumber': p.part_number, 'ETag': p.etag} for p in request.parts]
        
        s3_client.complete_multipart_upload(
            Bucket=S3_BUCKET_NAME,
            Key=request.s3_key,
            UploadId=request.upload_id,
            MultipartUpload={'Parts': parts}
        )
        
        s3_url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{request.s3_key}"
        
        return {
            "success": True,
            "s3_key": request.s3_key,
            "s3_url": s3_url
        }
    except ClientError as e:
        logger.error(f"S3 complete multipart error: {e}")
        raise HTTPException(status_code=500, detail=f"Error completando subida: {str(e)}")

@api_router.post("/s3/multipart/abort")
async def abort_multipart_upload(
    upload_id: str,
    s3_key: str,
    current_user: User = Depends(get_current_user)
):
    """Abort a multipart upload (cleanup)"""
    if not s3_client:
        raise HTTPException(status_code=500, detail="S3 no está configurado")
    
    try:
        s3_client.abort_multipart_upload(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            UploadId=upload_id
        )
        return {"success": True}
    except ClientError as e:
        logger.error(f"S3 abort multipart error: {e}")
        raise HTTPException(status_code=500, detail=f"Error abortando subida: {str(e)}")

@api_router.post("/s3/confirm-upload")
async def confirm_s3_upload(
    s3_key: str,
    s3_url: str,
    original_filename: str,
    file_size: int,
    current_user: User = Depends(get_current_user)
):
    """Confirm that an S3 upload was completed successfully"""
    if not s3_client:
        raise HTTPException(status_code=500, detail="S3 no está configurado")
    
    try:
        # Verify the file exists in S3
        s3_client.head_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
        
        return {
            "success": True,
            "url": s3_url,
            "key": s3_key,
            "filename": original_filename,
            "size": file_size
        }
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            raise HTTPException(status_code=404, detail="Archivo no encontrado en S3")
        raise HTTPException(status_code=500, detail=f"Error verificando archivo: {str(e)}")

@api_router.get("/s3/presigned-view/{s3_key:path}")
async def get_s3_presigned_view_url(
    s3_key: str,
    current_user: User = Depends(get_current_user)
):
    """Generate a presigned URL for viewing a video (streaming)"""
    if not s3_client:
        raise HTTPException(status_code=500, detail="S3 no está configurado")
    
    # NETFLIX MODEL: Only allow premium users and admins
    if current_user.role != 'admin' and current_user.subscription_plan == 'basic':
        raise HTTPException(
            status_code=403, 
            detail="Necesitas una suscripción activa para ver contenido"
        )
    
    try:
        # Generate presigned URL for viewing (valid for 1 hour)
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': S3_BUCKET_NAME,
                'Key': s3_key
            },
            ExpiresIn=3600  # 1 hour
        )
        
        return {
            "presigned_url": presigned_url,
            "expires_in": 3600
        }
    except ClientError as e:
        logger.error(f"S3 error: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando URL de visualización: {str(e)}")

# ==================== FILE UPLOAD ROUTES (LOCAL) ====================

# Store for tracking chunked uploads
chunked_uploads = {}

@api_router.post("/upload/init")
async def init_chunked_upload(
    filename: str,
    total_size: int,
    total_chunks: int,
    current_user: User = Depends(get_current_user)
):
    """Initialize a chunked upload session"""
    upload_id = uuid.uuid4().hex
    file_extension = Path(filename).suffix if filename else ""
    unique_filename = f"{upload_id}{file_extension}"
    
    chunked_uploads[upload_id] = {
        "filename": unique_filename,
        "original_filename": filename,
        "total_size": total_size,
        "total_chunks": total_chunks,
        "received_chunks": set(),
        "user_id": current_user.user_id
    }
    
    return {
        "upload_id": upload_id,
        "filename": unique_filename
    }

@api_router.post("/upload/chunk/{upload_id}/{chunk_index}")
async def upload_chunk(
    upload_id: str,
    chunk_index: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload a single chunk of a file"""
    if upload_id not in chunked_uploads:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    upload_info = chunked_uploads[upload_id]
    
    # Verify user
    if upload_info["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Create uploads directory
    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    
    # Save chunk to temp file
    chunk_path = upload_dir / f"{upload_id}_chunk_{chunk_index}"
    
    try:
        async with aiofiles.open(chunk_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        upload_info["received_chunks"].add(chunk_index)
        
        return {
            "chunk_index": chunk_index,
            "received": len(upload_info["received_chunks"]),
            "total": upload_info["total_chunks"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving chunk: {str(e)}")

@api_router.post("/upload/complete/{upload_id}")
async def complete_chunked_upload(
    upload_id: str,
    current_user: User = Depends(get_current_user)
):
    """Combine all chunks into final file"""
    if upload_id not in chunked_uploads:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    upload_info = chunked_uploads[upload_id]
    
    # Verify all chunks received
    if len(upload_info["received_chunks"]) != upload_info["total_chunks"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing chunks: received {len(upload_info['received_chunks'])} of {upload_info['total_chunks']}"
        )
    
    upload_dir = Path("uploads")
    final_path = upload_dir / upload_info["filename"]
    
    try:
        # Combine chunks
        async with aiofiles.open(final_path, 'wb') as final_file:
            for i in range(upload_info["total_chunks"]):
                chunk_path = upload_dir / f"{upload_id}_chunk_{i}"
                async with aiofiles.open(chunk_path, 'rb') as chunk_file:
                    content = await chunk_file.read()
                    await final_file.write(content)
                # Delete chunk file
                chunk_path.unlink()
        
        # Clean up upload session
        del chunked_uploads[upload_id]
        
        return {
            "filename": upload_info["filename"],
            "original_filename": upload_info["original_filename"],
            "size": upload_info["total_size"],
            "url": f"/api/files/{upload_info['filename']}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error combining chunks: {str(e)}")

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload a file with chunked streaming (supports large files up to 10GB)"""
    # Create uploads directory if it doesn't exist
    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    
    # Generate unique filename
    file_extension = Path(file.filename).suffix if file.filename else ""
    unique_filename = f"{uuid.uuid4().hex}{file_extension}"
    file_path = upload_dir / unique_filename
    
    # Save file in chunks to handle large files
    total_size = 0
    chunk_size = 1024 * 1024  # 1MB chunks
    
    try:
        async with aiofiles.open(file_path, 'wb') as f:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                await f.write(chunk)
                total_size += len(chunk)
    except Exception as e:
        # Clean up partial file on error
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")
    
    return {
        "filename": unique_filename,
        "original_filename": file.filename,
        "size": total_size,
        "content_type": file.content_type,
        "url": f"/api/files/{unique_filename}"
    }

@api_router.get("/stream/{filename}")
async def stream_video(
    filename: str, 
    request: Request,
    authorization: str = Header(None)
):
    """
    Stream video files with Range support - prevents direct download.
    Only authenticated premium users can access videos.
    """
    file_path = Path("uploads") / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    # Only allow video files through this endpoint
    if not filename.endswith(('.mp4', '.webm', '.mov', '.avi')):
        raise HTTPException(status_code=400, detail="Este endpoint es solo para videos")
    
    # Require authentication for all video streaming
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Se requiere autenticación")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
        
        user_data = await db.users.find_one({"user_id": user_id})
        if not user_data:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        
        # NETFLIX MODEL: Only allow premium users and admins
        if user_data.get("role") != 'admin' and user_data.get("subscription_plan") == 'basic':
            raise HTTPException(
                status_code=403, 
                detail="Necesitas una suscripción activa para ver contenido"
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    # Get file size
    file_size = file_path.stat().st_size
    
    # Parse Range header for streaming
    range_header = request.headers.get("range")
    
    if range_header:
        # Parse range header: "bytes=start-end"
        range_match = range_header.replace("bytes=", "").split("-")
        start = int(range_match[0]) if range_match[0] else 0
        end = int(range_match[1]) if range_match[1] else file_size - 1
        
        # Limit chunk size to 1MB for streaming
        chunk_size = min(1024 * 1024, end - start + 1)
        end = min(start + chunk_size - 1, file_size - 1)
        
        content_length = end - start + 1
        
        # Read the specific range
        def iterfile():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = content_length
                while remaining > 0:
                    chunk = f.read(min(8192, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk
        
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": "video/mp4",
            # Security headers to prevent download
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Pragma": "no-cache",
        }
        
        from starlette.responses import StreamingResponse
        return StreamingResponse(
            iterfile(),
            status_code=206,
            headers=headers,
            media_type="video/mp4"
        )
    else:
        # No range header - return full file info but encourage range requests
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": "video/mp4",
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
        }
        
        def iterfile():
            with open(file_path, "rb") as f:
                while chunk := f.read(8192):
                    yield chunk
        
        from starlette.responses import StreamingResponse
        return StreamingResponse(
            iterfile(),
            headers=headers,
            media_type="video/mp4"
        )

@api_router.get("/files/{filename}")
async def get_file(
    filename: str, 
    request: Request,
    authorization: str = Header(None)
):
    """Serve uploaded files - only thumbnails/images allowed, videos must use /stream endpoint"""
    file_path = Path("uploads") / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Block direct video file access - must use streaming endpoint
    is_video = filename.endswith(('.mp4', '.webm', '.mov', '.avi'))
    
    if is_video:
        raise HTTPException(
            status_code=403, 
            detail="Los videos solo están disponibles via streaming. Use /api/stream/{filename}"
        )
    
    # Allow access for images (thumbnails) without auth
    return FileResponse(file_path)

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
