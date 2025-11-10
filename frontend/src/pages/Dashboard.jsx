import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { User, Crown, Calendar, Play, LogOut } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, sessionToken, logout } = useContext(AuthContext);
  const [subscription, setSubscription] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch subscription
      const subResponse = await axios.get(`${API}/subscriptions/me`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      setSubscription(subResponse.data);

      // Fetch reservations
      const resResponse = await axios.get(`${API}/reservations/me`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      setReservations(resResponse.data.filter(r => r.status !== 'cancelled'));

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Error al cargar datos del dashboard');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
        <Navbar />
        <div data-testid="dashboard-loading" className="flex items-center justify-center min-h-screen">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <Navbar />
      
      <div className="pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div data-testid="dashboard-header" className="mb-12">
            <h1 className="text-5xl font-bold text-amber-900 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Mi Dashboard
            </h1>
            <p className="text-xl text-gray-700">
              Bienvenido, {user.name}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {/* Profile Card */}
            <div data-testid="profile-card" className="glass rounded-2xl p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-orange-700 rounded-full flex items-center justify-center mr-4">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-amber-900">Perfil</h3>
                  <p className="text-sm text-gray-600">Tu información</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Email:</span> {user.email}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Rol:</span> {user.role === 'admin' ? 'Administrador' : 'Usuario'}
                </p>
              </div>
            </div>

            {/* Subscription Card */}
            <div data-testid="subscription-card" className="glass rounded-2xl p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-orange-700 rounded-full flex items-center justify-center mr-4">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-amber-900">Suscripción</h3>
                  <p className="text-sm text-gray-600">Tu plan actual</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-amber-900 capitalize">
                  {user.subscription_plan || 'basic'}
                </p>
                {user.subscription_plan === 'premium' ? (
                  <p className="text-sm text-green-600 font-semibold">Activa</p>
                ) : (
                  <Button
                    onClick={() => navigate('/subscription')}
                    className="btn-peru mt-2 w-full"
                    size="sm"
                  >
                    Actualizar a Premium
                  </Button>
                )}
              </div>
            </div>

            {/* Reservations Count */}
            <div data-testid="reservations-count-card" className="glass rounded-2xl p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-orange-700 rounded-full flex items-center justify-center mr-4">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-amber-900">Reservas</h3>
                  <p className="text-sm text-gray-600">Cabina VR</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-amber-900">
                  {reservations.length}
                </p>
                <Button
                  onClick={() => navigate('/reservations')}
                  variant="outline"
                  className="w-full border-2 border-amber-700"
                  size="sm"
                >
                  Nueva Reserva
                </Button>
              </div>
            </div>
          </div>

          {/* Recent Reservations */}
          {reservations.length > 0 && (
            <div data-testid="recent-reservations" className="glass rounded-2xl p-8 mb-8">
              <h2 className="text-2xl font-bold text-amber-900 mb-6">Reservas Recientes</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reservations.slice(0, 6).map((reservation) => (
                  <div
                    key={reservation.id}
                    className="bg-white rounded-xl p-4 border-2 border-amber-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-amber-900">
                        {reservation.reservation_date}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        reservation.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {reservation.status === 'confirmed' ? 'Confirmada' : 'Pendiente'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{reservation.time_slot}</p>
                    <p className="text-xs text-gray-500 mt-2">QR: {reservation.qr_code}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div data-testid="quick-actions" className="glass rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-amber-900 mb-6">Acciones Rápidas</h2>
            <div className="grid md:grid-cols-4 gap-4">
              <Button
                onClick={() => navigate('/gallery')}
                className="btn-peru py-6 flex flex-col items-center"
              >
                <Play className="w-6 h-6 mb-2" />
                Ver Galería
              </Button>
              <Button
                onClick={() => navigate('/subscription')}
                className="bg-white text-amber-900 border-2 border-amber-700 hover:bg-amber-50 py-6 flex flex-col items-center"
              >
                <Crown className="w-6 h-6 mb-2" />
                Suscripciones
              </Button>
              <Button
                onClick={() => navigate('/reservations')}
                className="bg-white text-amber-900 border-2 border-amber-700 hover:bg-amber-50 py-6 flex flex-col items-center"
              >
                <Calendar className="w-6 h-6 mb-2" />
                Reservar VR
              </Button>
              <Button
                onClick={logout}
                variant="outline"
                className="border-2 border-red-300 text-red-600 hover:bg-red-50 py-6 flex flex-col items-center"
              >
                <LogOut className="w-6 h-6 mb-2" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;