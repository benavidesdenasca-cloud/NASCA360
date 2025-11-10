import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, User, Loader, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!name || !email || !password || !confirmPassword) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API}/auth/register`, {
        name,
        email,
        password
      });

      setSuccess(true);
      toast.success('¡Registro exitoso! Revisa tu correo para verificar tu cuenta');
    } catch (error) {
      console.error('Register error:', error);
      const message = error.response?.data?.detail || 'Error al registrarse';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center px-4 py-12">
        <div className="glass rounded-3xl p-8 sm:p-12 w-full max-w-md shadow-2xl text-center">
          <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-amber-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            ¡Registro Exitoso!
          </h1>
          <p className="text-gray-700 mb-6">
            Hemos enviado un correo de verificación a <strong>{email}</strong>
          </p>
          <p className="text-gray-600 mb-8">
            Por favor revisa tu bandeja de entrada y haz clic en el enlace de verificación para activar tu cuenta.
          </p>
          <Button
            onClick={() => navigate('/auth/login')}
            className="btn-peru px-8 py-6 rounded-full"
          >
            Ir a Iniciar Sesión
          </Button>
        </div>
      </div>
    );
  }

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
          Crear Cuenta
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Únete a la experiencia Nazca360
        </p>

        {/* Register Form */}
        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <Label htmlFor="name" className="text-gray-700 font-medium">Nombre completo</Label>
            <div className="relative mt-2">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                id="name"
                data-testid="register-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Pérez"
                className="pl-10 py-6 rounded-full border-2 border-gray-300 focus:border-amber-500"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email" className="text-gray-700 font-medium">Correo electrónico</Label>
            <div className="relative mt-2">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                id="email"
                data-testid="register-email"
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
                data-testid="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="pl-10 py-6 rounded-full border-2 border-gray-300 focus:border-amber-500"
                required
                minLength={6}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">Confirmar contraseña</Label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                id="confirmPassword"
                data-testid="register-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirma tu contraseña"
                className="pl-10 py-6 rounded-full border-2 border-gray-300 focus:border-amber-500"
                required
                minLength={6}
              />
            </div>
          </div>

          <Button
            data-testid="register-submit-button"
            type="submit"
            disabled={loading}
            className="w-full btn-peru py-6 text-lg rounded-full"
          >
            {loading ? (
              <>
                <Loader className="animate-spin mr-2" />
                Creando cuenta...
              </>
            ) : (
              'Crear Cuenta'
            )}
          </Button>
        </form>

        {/* Links */}
        <div className="mt-6 text-center space-y-4">
          <div className="pt-4 border-t border-gray-300">
            <p className="text-gray-600">
              ¿Ya tienes cuenta?{' '}
              <Link
                to="/auth/login"
                data-testid="login-link"
                className="text-amber-700 hover:text-amber-900 font-semibold"
              >
                Inicia sesión aquí
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

export default Register;