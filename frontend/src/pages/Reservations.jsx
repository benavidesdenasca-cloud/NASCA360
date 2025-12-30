import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Clock, CheckCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Reservations = () => {
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const [selectedCabin, setSelectedCabin] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [myReservations, setMyReservations] = useState([]);

  useEffect(() => {
    if (user) {
      fetchMyReservations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedDate && selectedCabin && token) {
      fetchAvailableSlots();
    }
  }, [selectedDate, selectedCabin, token]);

  const fetchAvailableSlots = async () => {
    if (!selectedDate || !selectedCabin) return;
    
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await axios.get(
        `${API}/reservations/available?date=${dateStr}&cabin_number=${selectedCabin}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      setAvailableSlots(response.data.available_slots || []);
    } catch (error) {
      console.error('Error fetching slots:', error);
      toast.error('Error al cargar horarios disponibles');
      setAvailableSlots([]);
    }
  };

  const fetchMyReservations = async () => {
    try {
      const response = await axios.get(`${API}/reservations/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setMyReservations(response.data);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    }
  };

  const handleReservation = async () => {
    if (!user) {
      toast.error('Debes iniciar sesión para hacer una reserva');
      navigate('/auth/login');
      return;
    }

    if (!selectedCabin) {
      toast.error('Por favor selecciona una cabina');
      return;
    }

    if (!selectedDate || !selectedSlot) {
      toast.error('Por favor selecciona una fecha y horario');
      return;
    }

    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const response = await axios.post(
        `${API}/reservations/checkout`,
        {
          reservation_date: dateStr,
          time_slot: selectedSlot,
          cabin_number: selectedCabin
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      // Redirect to Stripe checkout
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Reservation error:', error);
      toast.error(error.response?.data?.detail || 'Error al procesar la reserva');
      setLoading(false);
    }
  };

  const cancelReservation = async (reservationId) => {
    try {
      await axios.put(
        `${API}/reservations/${reservationId}?status=cancelled`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      toast.success('Reserva cancelada');
      fetchMyReservations();
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error('Error al cancelar la reserva');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <Navbar />
      
      <div className="pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div data-testid="reservations-header" className="text-center mb-12">
            <h1 className="text-5xl font-bold text-amber-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
              Reserva Tu Cabina VR
            </h1>
            <p className="text-xl text-gray-700">
              Vive la experiencia completa con visores Meta Quest en nuestra cabina VR
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {/* Booking Form */}
            <div data-testid="booking-form" className="glass rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-amber-900 mb-6">Nueva Reserva</h2>
              
              {/* Cabin Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  1. Selecciona una cabina
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((cabinNum) => (
                    <button
                      key={cabinNum}
                      data-testid={`cabin-${cabinNum}`}
                      onClick={() => {
                        setSelectedCabin(cabinNum);
                        setSelectedDate(null);
                        setSelectedSlot(null);
                        setAvailableSlots([]);
                      }}
                      className={`p-4 rounded-lg border-2 font-medium transition-all ${
                        selectedCabin === cabinNum
                          ? 'bg-gradient-to-r from-amber-600 to-orange-700 text-white border-amber-700 shadow-lg'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-amber-500 hover:shadow-md'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-lg font-bold">Cabina {cabinNum}</div>
                        <div className="text-xs mt-1 opacity-80">Meta Quest 2</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Calendar */}
              {selectedCabin && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    2. Selecciona una fecha
                  </label>
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return date < today;
                      }}
                      locale={es}
                      className="rounded-md border"
                    />
                  </div>
                </div>
              )}

              {/* Time Slots */}
              {selectedDate && selectedCabin && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    3. Horarios disponibles para Cabina {selectedCabin} - {format(selectedDate, 'dd/MM/yyyy', { locale: es })}
                  </label>
                  {availableSlots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          data-testid={`time-slot-${slot}`}
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-4 rounded-lg border-2 font-medium transition-all ${
                            selectedSlot === slot
                              ? 'bg-gradient-to-r from-amber-600 to-orange-700 text-white border-amber-700'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-amber-500'
                          }`}
                        >
                          <Clock className="w-4 h-4 inline mr-2" />
                          {slot}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 text-center py-4">
                      No hay horarios disponibles para esta fecha
                    </p>
                  )}
                </div>
              )}

              <Button
                data-testid="confirm-reservation-button"
                onClick={handleReservation}
                disabled={!selectedCabin || !selectedDate || !selectedSlot || loading}
                className="w-full btn-peru py-6 text-lg rounded-full"
              >
                {loading ? 'Procesando...' : 'Confirmar Reserva - $10 USD'}
              </Button>
            </div>

            {/* Info */}
            <div className="space-y-6">
              <div className="glass rounded-2xl p-8">
                <h3 className="text-xl font-bold text-amber-900 mb-4">Información de las Cabinas</h3>
                <p className="text-sm text-gray-600 mb-4">3 cabinas independientes disponibles</p>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                    <span>Visor Meta Quest 2 de alta resolución</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                    <span>Sesión privada de 20 minutos</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                    <span>Acceso a todo el contenido 360°</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                    <span>Guía personalizada incluida</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                    <span>Cabina privada y desinfectada</span>
                  </li>
                </ul>
              </div>

              <div className="glass rounded-2xl p-8 bg-gradient-to-r from-amber-100 to-orange-100">
                <h3 className="text-xl font-bold text-amber-900 mb-2">Precio</h3>
                <p className="text-4xl font-bold text-amber-900 mb-2">$10.00</p>
                <p className="text-sm text-gray-700">
                  USD por sesión de 20 minutos
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  *Mismo precio para todos los usuarios
                </p>
              </div>
            </div>
          </div>

          {/* My Reservations */}
          {user && myReservations.length > 0 && (
            <div data-testid="my-reservations" className="glass rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-amber-900 mb-6">Mis Reservas</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myReservations.filter(r => r.status !== 'cancelled').map((reservation) => (
                  <div
                    key={reservation.id}
                    data-testid={`reservation-${reservation.id}`}
                    className="bg-white rounded-xl p-6 border-2 border-amber-200"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        reservation.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {reservation.status === 'confirmed' ? 'Confirmada' : 'Pendiente'}
                      </span>
                    </div>
                    <div className="space-y-2 mb-4">
                      <p className="text-sm font-semibold text-amber-900">
                        Cabina {reservation.cabin_number}
                      </p>
                      <p className="text-sm text-gray-600">
                        <CalendarIcon className="w-4 h-4 inline mr-2" />
                        {reservation.reservation_date}
                      </p>
                      <p className="text-sm text-gray-600">
                        <Clock className="w-4 h-4 inline mr-2" />
                        {reservation.time_slot}
                      </p>
                      <p className="text-sm font-mono text-amber-900">
                        QR: {reservation.qr_code}
                      </p>
                    </div>
                    {reservation.status === 'confirmed' && (
                      <Button
                        data-testid={`cancel-reservation-${reservation.id}`}
                        onClick={() => cancelReservation(reservation.id)}
                        variant="outline"
                        size="sm"
                        className="w-full border-red-300 text-red-600 hover:bg-red-50"
                      >
                        Cancelar Reserva
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reservations;