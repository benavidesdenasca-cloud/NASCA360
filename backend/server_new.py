from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Header
from fastapi.responses import RedirectResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
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
