import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Loader, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Por favor ingresa tu correo electrónico');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API}/auth/forgot-password`, { email });
      setSuccess(true);
      toast.success('Correo enviado exitosamente');
    } catch (error) {
      console.error('Forgot password error:', error);
      toast.error('Error al enviar el correo');
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
            Correo Enviado
          </h1>
          <p className="text-gray-700 mb-6">
            Si existe una cuenta con el correo <strong>{email}</strong>, recibirás un enlace para restablecer tu contraseña.
          </p>
          <p className="text-gray-600 mb-8">
            Por favor revisa tu bandeja de entrada (y la carpeta de spam).
          </p>
          <Link to="/auth/login">
            <Button className="btn-peru px-8 py-6 rounded-full">
              Volver a Iniciar Sesión
            </Button>
          </Link>
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
          ¿Olvidaste tu contraseña?
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Ingresa tu correo y te enviaremos un enlace para restablecerla
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="email" className="text-gray-700 font-medium">Correo electrónico</Label>
            <div className="relative mt-2">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                id="email"
                data-testid="forgot-password-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="pl-10 py-6 rounded-full border-2 border-gray-300 focus:border-amber-500"
                required
              />
            </div>
          </div>

          <Button
            data-testid="forgot-password-submit"
            type="submit"
            disabled={loading}
            className="w-full btn-peru py-6 text-lg rounded-full"
          >
            {loading ? (
              <>
                <Loader className="animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              'Enviar Enlace de Recuperación'
            )}
          </Button>
        </form>

        {/* Links */}
        <div className="mt-6 text-center space-y-4">
          <Link
            to="/auth/login"
            className="block text-amber-700 hover:text-amber-900 font-medium"
          >
            ← Volver a Iniciar Sesión
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;