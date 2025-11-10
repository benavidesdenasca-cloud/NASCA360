import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, Loader } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Login = () => {
  const navigate = useNavigate();
  const { setUser, setToken } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API}/auth/login`, {
        email,
        password
      });

      const { access_token, user } = response.data;
      
      localStorage.setItem('access_token', access_token);
      setToken(access_token);
      setUser(user);
      
      toast.success('¡Bienvenido a Nazca360!');
      navigate('/gallery');
    } catch (error) {
      console.error('Login error:', error);
      const message = error.response?.data?.detail || 'Error al iniciar sesión';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center px-4 py-12">
      <div className="glass rounded-3xl p-8 sm:p-12 w-full max-w-md shadow-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img 
            src="/logo.jpg" 
            alt="Nazca360 Logo" 
            className="h-24 w-auto object-contain"
          />
        </div>

        <h1 className="text-3xl font-bold text-center text-amber-900 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          Iniciar Sesión
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Accede a tu cuenta de Nazca360
        </p>

        {/* Google Login Button */}
        <Button
          data-testid="google-login-button"
          onClick={handleGoogleLogin}
          type="button"
          className="w-full mb-6 py-6 bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300 rounded-full font-semibold flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Entrar con Gmail
        </Button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">O continúa con email</span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <Label htmlFor="email" className="text-gray-700 font-medium">Correo electrónico</Label>
            <div className="relative mt-2">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                id="email"
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="pl-10 py-6 rounded-full border-2 border-gray-300 focus:border-amber-500"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password" className="text-gray-700 font-medium">Contraseña</Label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                id="password"
                data-testid="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10 py-6 rounded-full border-2 border-gray-300 focus:border-amber-500"
                required
              />
            </div>
          </div>

          <Button
            data-testid="login-submit-button"
            type="submit"
            disabled={loading}
            className="w-full btn-peru py-6 text-lg rounded-full"
          >
            {loading ? (
              <>
                <Loader className="animate-spin mr-2" />
                Iniciando sesión...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </Button>
        </form>

        {/* Links */}
        <div className="mt-6 space-y-4 text-center">
          <Link
            to="/auth/forgot-password"
            data-testid="forgot-password-link"
            className="block text-amber-700 hover:text-amber-900 font-medium"
          >
            ¿Olvidaste tu contraseña?
          </Link>
          
          <div className="pt-4 border-t border-gray-300">
            <p className="text-gray-600">
              ¿No tienes cuenta?{' '}
              <Link
                to="/auth/register"
                data-testid="register-link"
                className="text-amber-700 hover:text-amber-900 font-semibold"
              >
                Regístrate aquí
              </Link>
            </p>
          </div>

          <Link
            to="/"
            className="block text-gray-600 hover:text-gray-800"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;