import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token no proporcionado');
      return;
    }

    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    try {
      const response = await axios.get(`${API}/auth/verify-email?token=${token}`);
      setStatus('success');
      setMessage(response.data.message || 'Email verificado exitosamente');
    } catch (error) {
      console.error('Verify email error:', error);
      setStatus('error');
      const errorMessage = error.response?.data?.detail || 'Error al verificar el email';
      setMessage(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center px-4 py-12">
      <div className="glass rounded-3xl p-8 sm:p-12 w-full max-w-md shadow-2xl text-center">
        <div className="flex justify-center mb-8">
          <img 
            src="/logo.jpg" 
            alt="Nazca360 Logo" 
            className="h-24 w-auto object-contain"
          />
        </div>

        {status === 'verifying' && (
          <>
            <Loader className="w-20 h-20 text-amber-600 mx-auto mb-6 animate-spin" />
            <h1 className="text-3xl font-bold text-amber-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
              Verificando Email...
            </h1>
            <p className="text-gray-700">
              Por favor espera mientras verificamos tu correo electrónico.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-amber-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
              ¡Email Verificado!
            </h1>
            <p className="text-gray-700 mb-8">
              {message}
            </p>
            <Button
              onClick={() => navigate('/auth/login')}
              className="btn-peru px-8 py-6 rounded-full"
            >
              Iniciar Sesión
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-20 h-20 text-red-600 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-amber-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
              Error de Verificación
            </h1>
            <p className="text-gray-700 mb-8">
              {message}
            </p>
            <div className="space-y-4">
              <Button
                onClick={() => navigate('/auth/login')}
                className="btn-peru px-8 py-6 rounded-full w-full"
              >
                Ir a Iniciar Sesión
              </Button>
              <Link to="/auth/register" className="block">
                <Button
                  variant="outline"
                  className="border-2 border-amber-700 px-8 py-6 rounded-full w-full"
                >
                  Registrarse Nuevamente
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;