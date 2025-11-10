from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Header
from fastapi.responses import RedirectResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Stripe setup
STRIPE_API_KEY = os.environ['STRIPE_API_KEY']

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
    picture: Optional[str] = None
    role: str = "user"  # user or admin
    subscription_plan: str = "basic"  # basic or premium
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    session_token: str
    expires_at: datetime
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

async def get_current_user(authorization: Optional[str] = Header(None), session_token: Optional[str] = None) -> User:
    """Get current authenticated user from session token"""
    token = None
    
    # Try to get token from Authorization header
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    # Fallback to direct session_token
    elif session_token:
        token = session_token
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session token")
    
    # Check if session expired
    if datetime.fromisoformat(session['expires_at']) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one({"id": session['user_id']}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)

async def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ==================== AUTH ROUTES ====================

@api_router.get("/auth/login")
async def auth_login(request: Request):
    """Redirect to Emergent Auth for Google/Facebook login"""
    # Get the origin from request
    origin = str(request.base_url).rstrip('/')
    redirect_url = f"{origin}/dashboard"
    
    # Redirect to Emergent Auth
    emergent_auth_url = os.environ.get('EMERGENT_AUTH_URL', 'https://auth.emergentagent.com')
    auth_url = f"{emergent_auth_url}/?redirect={redirect_url}"
    return RedirectResponse(url=auth_url)

@api_router.get("/auth/session")
async def get_session_data(x_session_id: str = Header(None)):
    """Exchange session_id for user data and session_token"""
    if not x_session_id:
        raise HTTPException(status_code=400, detail="X-Session-ID header required")
    
    # Call Emergent Auth API to get user data
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": x_session_id}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session ID")
        
        auth_data = response.json()
    
    # Check if user exists
    user_doc = await db.users.find_one({"email": auth_data['email']}, {"_id": 0})
    
    if not user_doc:
        # Create new user
        new_user = User(
            id=auth_data['id'],
            email=auth_data['email'],
            name=auth_data.get('name', ''),
            picture=auth_data.get('picture', ''),
            role="user",
            subscription_plan="basic"
        )
        user_dict = new_user.model_dump()
        user_dict['created_at'] = user_dict['created_at'].isoformat()
        await db.users.insert_one(user_dict)
        user_doc = new_user.model_dump()
    
    user = User(**user_doc)
    
    # Create or update session
    session_token = auth_data['session_token']
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "user_id": user.id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {
        "user": user.model_dump(),
        "session_token": session_token
    }

@api_router.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user

@api_router.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_user), authorization: Optional[str] = Header(None)):
    """Logout user by deleting session"""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    
    return {"message": "Logged out successfully"}

# ==================== VIDEO ROUTES ====================

@api_router.get("/videos", response_model=List[Video360])
async def get_videos(category: Optional[str] = None, current_user: Optional[User] = None):
    """Get videos (filter by subscription level)"""
    query = {}
    if category:
        query['category'] = category
    
    videos = await db.videos.find(query, {"_id": 0}).to_list(1000)
    
    # Filter premium videos for non-premium users
    if current_user is None or current_user.subscription_plan != "premium":
        videos = [v for v in videos if not v.get('is_premium', False)]
    
    return videos

@api_router.get("/videos/{video_id}", response_model=Video360)
async def get_video(video_id: str, current_user: Optional[User] = None):
    """Get single video details"""
    video = await db.videos.find_one({"id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Check if user can access premium video
    if video.get('is_premium', False):
        if current_user is None or current_user.subscription_plan != "premium":
            raise HTTPException(status_code=403, detail="Premium subscription required")
    
    return video

# ==================== SUBSCRIPTION ROUTES ====================

# Subscription packages
SUBSCRIPTION_PACKAGES = {
    "premium": {"amount": 29.99, "currency": "usd", "name": "Premium Plan"}
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
    
    # Initialize Stripe checkout
    host_url = request.origin_url
    webhook_url = f"{str(req.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create checkout session
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
    
    # Create payment transaction record
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
    
    # Create subscription record
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
    # Check if already processed
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # If already paid, return immediately
    if transaction['payment_status'] == "paid":
        return {"status": "paid", "message": "Subscription activated"}
    
    # Poll Stripe for status
    webhook_url = f"{str(req.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    checkout_status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction
    if checkout_status.payment_status == "paid" and transaction['payment_status'] != "paid":
        # Update payment transaction
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid"}}
        )
        
        # Update subscription
        start_date = datetime.now(timezone.utc)
        end_date = start_date + timedelta(days=365)
        
        await db.subscriptions.update_one(
            {"stripe_session_id": session_id},
            {"$set": {
                "payment_status": "paid",
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            }}
        )
        
        # Update user subscription plan
        plan_type = transaction['metadata'].get('plan_type', 'premium')
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
            
            # Update transaction
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid"}}
            )
            
            # Update subscription
            transaction = await db.payment_transactions.find_one({"session_id": session_id})
            if transaction:
                start_date = datetime.now(timezone.utc)
                end_date = start_date + timedelta(days=365)
                
                await db.subscriptions.update_one(
                    {"stripe_session_id": session_id},
                    {"$set": {
                        "payment_status": "paid",
                        "start_date": start_date.isoformat(),
                        "end_date": end_date.isoformat()
                    }}
                )
                
                # Update user
                user_id = transaction['user_id']
                plan_type = transaction['metadata'].get('plan_type', 'premium')
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
async def get_available_slots(date: str):
    """Get available time slots for a date"""
    # Get existing reservations for date
    reservations = await db.reservations.find(
        {"reservation_date": date, "status": {"$ne": "cancelled"}},
        {"_id": 0}
    ).to_list(100)
    
    booked_slots = [r['time_slot'] for r in reservations]
    
    # All possible slots (9 AM to 6 PM, 1-hour slots)
    all_slots = [
        "09:00-10:00", "10:00-11:00", "11:00-12:00",
        "12:00-13:00", "13:00-14:00", "14:00-15:00",
        "15:00-16:00", "16:00-17:00", "17:00-18:00"
    ]
    
    available_slots = [slot for slot in all_slots if slot not in booked_slots]
    
    return {"date": date, "available_slots": available_slots}

@api_router.post("/reservations")
async def create_reservation(
    reservation: ReservationCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a cabin reservation"""
    # Check if slot is available
    existing = await db.reservations.find_one({
        "reservation_date": reservation.reservation_date,
        "time_slot": reservation.time_slot,
        "status": {"$ne": "cancelled"}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Time slot already booked")
    
    # Create reservation
    new_reservation = CabinReservation(
        user_id=current_user.id,
        user_name=current_user.name,
        user_email=current_user.email,
        reservation_date=reservation.reservation_date,
        time_slot=reservation.time_slot,
        status="confirmed",
        qr_code=f"QR-{str(uuid.uuid4())[:8].upper()}"
    )
    
    reservation_dict = new_reservation.model_dump()
    reservation_dict['created_at'] = reservation_dict['created_at'].isoformat()
    await db.reservations.insert_one(reservation_dict)
    
    return new_reservation

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
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
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
    
    # Revenue calculation
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

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.on_event("startup")
async def startup_db():
    """Initialize database with sample videos"""
    # Check if videos already exist
    count = await db.videos.count_documents({})
    if count == 0:
        # Add sample videos
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