import os
import jwt
import bcrypt
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from itsdangerous import URLSafeTimedSerializer
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', 30))

# Email configuration
SMTP_SERVER = os.environ.get('SMTP_SERVER')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_EMAIL = os.environ.get('SMTP_EMAIL')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
FROM_EMAIL = os.environ.get('FROM_EMAIL')
FROM_NAME = os.environ.get('FROM_NAME', 'Nazca360')

# URL Serializer for email tokens
serializer = URLSafeTimedSerializer(JWT_SECRET_KEY)


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    if expires_delta is None:
        expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {
        "sub": user_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    }
    
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[str]:
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        return user_id
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def generate_verification_token(email: str) -> str:
    """Generate email verification token"""
    return serializer.dumps(email, salt='email-verification')


def verify_email_token(token: str, max_age: int = 86400) -> Optional[str]:
    """Verify email token (default: 24 hours)"""
    try:
        email = serializer.loads(token, salt='email-verification', max_age=max_age)
        return email
    except:
        return None


def generate_password_reset_token(email: str) -> str:
    """Generate password reset token"""
    return serializer.dumps(email, salt='password-reset')


def verify_password_reset_token(token: str, max_age: int = 3600) -> Optional[str]:
    """Verify password reset token (default: 1 hour)"""
    try:
        email = serializer.loads(token, salt='password-reset', max_age=max_age)
        return email
    except:
        return None


async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send email using Gmail SMTP"""
    try:
        message = MIMEMultipart('alternative')
        message['Subject'] = subject
        message['From'] = f'{FROM_NAME} <{FROM_EMAIL}>'
        message['To'] = to_email
        
        html_part = MIMEText(html_content, 'html')
        message.attach(html_part)
        
        await aiosmtplib.send(
            message,
            hostname=SMTP_SERVER,
            port=SMTP_PORT,
            username=SMTP_EMAIL,
            password=SMTP_PASSWORD,
            use_tls=True
        )
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False


async def send_verification_email(email: str, token: str, base_url: str) -> bool:
    """Send email verification link"""
    verification_link = f"{base_url}/verify-email?token={token}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f8f5f0; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
            .logo {{ text-align: center; margin-bottom: 30px; }}
            .logo img {{ height: 80px; }}
            h1 {{ color: #8B4513; font-size: 28px; margin-bottom: 20px; }}
            p {{ color: #666; line-height: 1.6; font-size: 16px; }}
            .button {{ display: inline-block; background: linear-gradient(135deg, #C19A6B 0%, #8B4513 100%); color: white; padding: 15px 40px; border-radius: 50px; text-decoration: none; font-weight: bold; margin: 20px 0; }}
            .footer {{ text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 14px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <img src="https://virtual-nasca.preview.emergentagent.com/logo.jpg" alt="Nazca360">
            </div>
            <h1>¡Bienvenido a Nazca360!</h1>
            <p>Gracias por registrarte en Nazca360, la plataforma inmersiva de turismo virtual de las Líneas de Nasca.</p>
            <p>Para completar tu registro y activar tu cuenta, por favor verifica tu correo electrónico haciendo clic en el siguiente botón:</p>
            <div style="text-align: center;">
                <a href="{verification_link}" class="button">Verificar mi correo</a>
            </div>
            <p>O copia y pega este enlace en tu navegador:</p>
            <p style="word-break: break-all; color: #8B4513;">{verification_link}</p>
            <p style="color: #999; font-size: 14px;">Este enlace expirará en 24 horas.</p>
            <div class="footer">
                <p>© 2025 Nazca360. Todos los derechos reservados.</p>
                <p>Preservando el patrimonio cultural del Perú</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return await send_email(email, "Verifica tu correo - Nazca360", html_content)


async def send_password_reset_email(email: str, token: str, base_url: str) -> bool:
    """Send password reset email"""
    reset_link = f"{base_url}/reset-password?token={token}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f8f5f0; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
            .logo {{ text-align: center; margin-bottom: 30px; }}
            .logo img {{ height: 80px; }}
            h1 {{ color: #8B4513; font-size: 28px; margin-bottom: 20px; }}
            p {{ color: #666; line-height: 1.6; font-size: 16px; }}
            .button {{ display: inline-block; background: linear-gradient(135deg, #C19A6B 0%, #8B4513 100%); color: white; padding: 15px 40px; border-radius: 50px; text-decoration: none; font-weight: bold; margin: 20px 0; }}
            .footer {{ text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 14px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <img src="https://virtual-nasca.preview.emergentagent.com/logo.jpg" alt="Nazca360">
            </div>
            <h1>Restablecer contraseña</h1>
            <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Nazca360.</p>
            <p>Si solicitaste este cambio, haz clic en el siguiente botón para crear una nueva contraseña:</p>
            <div style="text-align: center;">
                <a href="{reset_link}" class="button">Restablecer contraseña</a>
            </div>
            <p>O copia y pega este enlace en tu navegador:</p>
            <p style="word-break: break-all; color: #8B4513;">{reset_link}</p>
            <p style="color: #999; font-size: 14px;">Este enlace expirará en 1 hora por seguridad.</p>
            <p style="color: #d32f2f; font-size: 14px; margin-top: 20px;">Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura.</p>
            <div class="footer">
                <p>© 2025 Nazca360. Todos los derechos reservados.</p>
                <p>Preservando el patrimonio cultural del Perú</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return await send_email(email, "Restablece tu contraseña - Nazca360", html_content)
