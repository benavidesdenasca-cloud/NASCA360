import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader, XCircle, Calendar, Clock, MapPin } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ReservationSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useContext(AuthContext);
  const [status, setStatus] = useState('processing'); // processing, success, failed
  const [reservation, setReservation] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // PayPal returns: paymentId, PayerID
  const paymentId = searchParams.get('paymentId');
  const payerId = searchParams.get('PayerID');

  useEffect(() => {
    if (!paymentId || !payerId) {
      // Check if cancelled
      if (searchParams.get('cancelled')) {
        toast.error('Pago cancelado');
      }
      navigate('/reservations');
      return;
    }

    executePayment();
  }, [paymentId, payerId]);

  const executePayment = async () => {
    try {
      setStatus('processing');
      
      const response = await axios.get(
        `${API}/reservations/execute-payment?paymentId=${paymentId}&PayerID=${payerId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setStatus('success');
        setReservation(response.data.reservation);
        toast.success(response.data.message || '¡Reserva confirmada!');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <Navbar />
      
      <div className="pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div data-testid="reservation-success-container" className="glass rounded-3xl p-12 text-center">
            
            {/* Processing */}
            {status === 'processing' && (
              <>
                <Loader data-testid="processing-spinner" className="w-16 h-16 text-amber-600 mx-auto mb-6 animate-spin" />
                <h1 className="text-3xl font-bold text-amber-900 mb-4">
                  Procesando tu pago...
                </h1>
                <p className="text-gray-700">
                  Por favor espera mientras confirmamos tu reserva con PayPal.
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
                  ¡Reserva Confirmada!
                </h1>
                <p className="text-xl text-gray-700 mb-6">
                  Tu reserva de cabina VR ha sido confirmada exitosamente.
                </p>
                
                {reservation && (
                  <div className="bg-amber-50 rounded-xl p-6 mb-8 text-left">
                    <h3 className="font-bold text-amber-900 mb-4 text-center">Detalles de tu Reserva</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-amber-600" />
                        <span className="text-gray-700"><strong>Cabina:</strong> #{reservation.cabin_number}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-amber-600" />
                        <span className="text-gray-700"><strong>Fecha:</strong> {reservation.reservation_date}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-amber-600" />
                        <span className="text-gray-700"><strong>Horario:</strong> {reservation.time_slot}</span>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center mt-4">
                        <p className="text-sm text-gray-600 mb-1">Tu código QR</p>
                        <p className="font-mono text-2xl font-bold text-amber-700">{reservation.qr_code}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  <Button
                    data-testid="go-to-reservations-button"
                    onClick={() => navigate('/reservations')}
                    className="btn-peru w-full py-4 text-lg rounded-full"
                  >
                    Ver Mis Reservas
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
                
                <p className="text-sm text-gray-500 mt-6">
                  Recibirás un correo de confirmación con los detalles de tu reserva.
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
                  Error en la Reserva
                </h1>
                <p className="text-gray-700 mb-4">
                  {errorMessage || 'Hubo un problema al procesar tu pago con PayPal.'}
                </p>
                <p className="text-sm text-gray-500 mb-8">
                  Tu tarjeta no fue cargada. Por favor, inténtalo nuevamente.
                </p>
                <div className="space-y-4">
                  <Button
                    onClick={() => navigate('/reservations')}
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

export default ReservationSuccess;
