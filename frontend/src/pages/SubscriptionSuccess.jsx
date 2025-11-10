import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SubscriptionSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useContext(AuthContext);
  const [status, setStatus] = useState('checking'); // checking, success, failed
  const [attempts, setAttempts] = useState(0);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      navigate('/subscription');
      return;
    }

    pollPaymentStatus();
  }, [sessionId]);

  const pollPaymentStatus = async () => {
    const maxAttempts = 5;
    const pollInterval = 2000; // 2 seconds

    if (attempts >= maxAttempts) {
      setStatus('timeout');
      toast.error('El tiempo de verificación ha expirado. Por favor, verifica tu correo.');
      return;
    }

    try {
      const response = await axios.get(
        `${API}/subscriptions/status/${sessionId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.status === 'paid') {
        setStatus('success');
        toast.success('¡Suscripción activada exitosamente!');
      } else if (response.data.status === 'expired') {
        setStatus('failed');
        toast.error('La sesión de pago ha expirado');
      } else {
        // Continue polling
        setAttempts(prev => prev + 1);
        setTimeout(pollPaymentStatus, pollInterval);
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      setAttempts(prev => prev + 1);
      if (attempts < maxAttempts - 1) {
        setTimeout(pollPaymentStatus, pollInterval);
      } else {
        setStatus('failed');
        toast.error('Error al verificar el estado del pago');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <Navbar />
      
      <div className="pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div data-testid="subscription-success-container" className="glass rounded-3xl p-12 text-center">
            {status === 'checking' && (
              <>
                <Loader data-testid="checking-spinner" className="w-16 h-16 text-amber-600 mx-auto mb-6 animate-spin" />
                <h1 className="text-3xl font-bold text-amber-900 mb-4">
                  Verificando tu pago...
                </h1>
                <p className="text-gray-700">
                  Por favor espera mientras confirmamos tu suscripción.
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle data-testid="success-icon" className="w-20 h-20 text-green-600 mx-auto mb-6" />
                <h1 className="text-4xl font-bold text-amber-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                  ¡Bienvenido a Premium!
                </h1>
                <p className="text-xl text-gray-700 mb-8">
                  Tu suscripción ha sido activada exitosamente. Ahora tienes acceso completo a todo el contenido de Nazca360.
                </p>
                <div className="space-y-4">
                  <Button
                    data-testid="go-to-gallery-button"
                    onClick={() => navigate('/gallery')}
                    className="btn-peru w-full py-4 text-lg rounded-full"
                  >
                    Explorar Galería Completa
                  </Button>
                  <Button
                    data-testid="go-to-dashboard-button"
                    onClick={() => navigate('/dashboard')}
                    variant="outline"
                    className="w-full py-4 text-lg rounded-full border-2 border-amber-700"
                  >
                    Ir a Mi Dashboard
                  </Button>
                </div>
              </>
            )}

            {(status === 'failed' || status === 'timeout') && (
              <>
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">❌</span>
                </div>
                <h1 className="text-3xl font-bold text-amber-900 mb-4">
                  Error en la suscripción
                </h1>
                <p className="text-gray-700 mb-8">
                  Hubo un problema al procesar tu pago. Por favor, inténtalo nuevamente o contacta a soporte.
                </p>
                <Button
                  onClick={() => navigate('/subscription')}
                  className="btn-peru px-8 py-4 rounded-full"
                >
                  Volver a Intentar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSuccess;