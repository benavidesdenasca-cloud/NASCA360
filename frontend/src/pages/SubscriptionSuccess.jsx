import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SubscriptionSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, token, setUser, setToken } = useContext(AuthContext);
  const [status, setStatus] = useState('processing'); // processing, success, failed
  const [subscriptionEnd, setSubscriptionEnd] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // PayPal returns: paymentId, PayerID, plan
  const paymentId = searchParams.get('paymentId');
  const payerId = searchParams.get('PayerID');
  const plan = searchParams.get('plan');
  const isRenewal = searchParams.get('renew') === 'true';

  useEffect(() => {
    if (!paymentId || !payerId) {
      toast.error('Parámetros de pago inválidos');
      navigate('/subscription');
      return;
    }

    executePayment();
  }, [paymentId, payerId]);

  const executePayment = async () => {
    try {
      setStatus('processing');
      
      const endpoint = isRenewal && token
        ? `${API}/paypal/execute-renewal`
        : `${API}/paypal/execute-payment`;
      
      const params = new URLSearchParams({
        paymentId,
        PayerID: payerId,
        plan
      });
      
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.get(`${endpoint}?${params}`, { headers });
      
      if (response.data.success) {
        setStatus('success');
        setSubscriptionEnd(response.data.subscription_end || response.data.user?.subscription_end);
        
        // If new user, auto-login
        if (response.data.access_token && !token) {
          localStorage.setItem('token', response.data.access_token);
          setToken(response.data.access_token);
          
          if (response.data.user) {
            localStorage.setItem('user', JSON.stringify(response.data.user));
            setUser(response.data.user);
          }
        }
        
        toast.success(response.data.message || '¡Pago exitoso!');
      } else {
        setStatus('failed');
        setErrorMessage('El pago no pudo ser procesado');
      }
    } catch (error) {
      console.error('Error executing payment:', error);
      setStatus('failed');
      setErrorMessage(error.response?.data?.detail || 'Error al procesar el pago');
      toast.error(error.response?.data?.detail || 'Error al procesar el pago');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <Navbar />
      
      <div className="pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div data-testid="subscription-success-container" className="glass rounded-3xl p-12 text-center">
            
            {/* Processing */}
            {status === 'processing' && (
              <>
                <Loader data-testid="processing-spinner" className="w-16 h-16 text-amber-600 mx-auto mb-6 animate-spin" />
                <h1 className="text-3xl font-bold text-amber-900 mb-4">
                  Procesando tu pago...
                </h1>
                <p className="text-gray-700">
                  Por favor espera mientras confirmamos tu suscripción con PayPal.
                </p>
              </>
            )}

            {/* Success */}
            {status === 'success' && (
              <>
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                  <CheckCircle className="w-14 h-14 text-green-600" />
                </div>
                <h1 className="text-4xl font-bold text-amber-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {isRenewal ? '¡Renovación Exitosa!' : '¡Bienvenido a Nazca360!'}
                </h1>
                <p className="text-xl text-gray-700 mb-4">
                  {isRenewal 
                    ? 'Tu suscripción ha sido renovada exitosamente.'
                    : 'Tu cuenta ha sido creada y tu suscripción está activa.'
                  }
                </p>
                
                {subscriptionEnd && (
                  <div className="bg-amber-50 rounded-xl p-4 mb-8">
                    <p className="text-amber-800">
                      <strong>Tu suscripción es válida hasta:</strong><br />
                      <span className="text-2xl font-bold">{formatDate(subscriptionEnd)}</span>
                    </p>
                  </div>
                )}
                
                <div className="space-y-4">
                  <Button
                    data-testid="go-to-gallery-button"
                    onClick={() => navigate('/gallery')}
                    className="btn-peru w-full py-4 text-lg rounded-full"
                  >
                    🎬 Explorar Videos 360°
                  </Button>
                  <Button
                    data-testid="go-to-map-button"
                    onClick={() => navigate('/map3d')}
                    variant="outline"
                    className="w-full py-4 text-lg rounded-full border-2 border-amber-700"
                  >
                    🗺️ Ver Mapa Interactivo
                  </Button>
                </div>
                
                <p className="text-sm text-gray-500 mt-6">
                  Recibirás un correo de confirmación con los detalles de tu suscripción.
                </p>
              </>
            )}

            {/* Failed */}
            {status === 'failed' && (
              <>
                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <XCircle className="w-14 h-14 text-red-600" />
                </div>
                <h1 className="text-3xl font-bold text-amber-900 mb-4">
                  Error en el Pago
                </h1>
                <p className="text-gray-700 mb-4">
                  {errorMessage || 'Hubo un problema al procesar tu pago con PayPal.'}
                </p>
                <p className="text-sm text-gray-500 mb-8">
                  Tu tarjeta no fue cargada. Por favor, inténtalo nuevamente.
                </p>
                <div className="space-y-4">
                  <Button
                    onClick={() => navigate('/subscription')}
                    className="btn-peru w-full py-4 text-lg rounded-full"
                  >
                    Volver a Intentar
                  </Button>
                  <Button
                    onClick={() => navigate('/contact')}
                    variant="outline"
                    className="w-full py-4 rounded-full"
                  >
                    Contactar Soporte
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSuccess;
