import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Users, Crown, Calendar, Video, DollarSign, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const [metrics, setMetrics] = useState(null);
  const [users, setUsers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchAdminData();
  }, [user]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      
      const headers = { 'Authorization': `Bearer ${token}` };

      const [metricsRes, usersRes, subsRes, resRes] = await Promise.all([
        axios.get(`${API}/admin/metrics`, { headers }),
        axios.get(`${API}/admin/users`, { headers }),
        axios.get(`${API}/admin/subscriptions`, { headers }),
        axios.get(`${API}/admin/reservations`, { headers })
      ]);

      setMetrics(metricsRes.data);
      setUsers(usersRes.data);
      setSubscriptions(subsRes.data);
      setReservations(resRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error('Error al cargar datos administrativos');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
        <Navbar />
        <div data-testid="admin-loading" className="flex items-center justify-center min-h-screen">
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
          <div data-testid="admin-header" className="mb-12">
            <h1 className="text-5xl font-bold text-amber-900 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Panel de Administración
            </h1>
            <p className="text-xl text-gray-700">
              Gestión completa de Nazca360
            </p>
          </div>

          {/* Metrics Grid */}
          <div data-testid="metrics-grid" className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 text-amber-700" />
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-amber-900">{metrics.total_users}</p>
              <p className="text-sm text-gray-600">Total Usuarios</p>
            </div>

            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <Crown className="w-8 h-8 text-amber-700" />
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-amber-900">{metrics.premium_users}</p>
              <p className="text-sm text-gray-600">Usuarios Premium</p>
            </div>

            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="w-8 h-8 text-amber-700" />
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-amber-900">{metrics.total_reservations}</p>
              <p className="text-sm text-gray-600">Total Reservas</p>
            </div>

            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <Video className="w-8 h-8 text-amber-700" />
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-amber-900">{metrics.total_videos}</p>
              <p className="text-sm text-gray-600">Total Videos</p>
            </div>

            <div className="glass rounded-2xl p-6 bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 text-green-700" />
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-900">${metrics.total_revenue.toFixed(2)}</p>
              <p className="text-sm text-gray-600">Ingresos Totales</p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="users" data-testid="tab-users">Usuarios</TabsTrigger>
              <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">Suscripciones</TabsTrigger>
              <TabsTrigger value="reservations" data-testid="tab-reservations">Reservas</TabsTrigger>
            </TabsList>

            {/* Users Tab */}
            <TabsContent value="users" data-testid="users-tab-content">
              <div className="glass rounded-2xl p-8">
                <h2 className="text-2xl font-bold text-amber-900 mb-6">Usuarios Registrados</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-amber-200">
                        <th className="text-left py-3 px-4 text-amber-900">Nombre</th>
                        <th className="text-left py-3 px-4 text-amber-900">Email</th>
                        <th className="text-left py-3 px-4 text-amber-900">Plan</th>
                        <th className="text-left py-3 px-4 text-amber-900">Rol</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-amber-100 hover:bg-amber-50">
                          <td className="py-3 px-4">{u.name}</td>
                          <td className="py-3 px-4">{u.email}</td>
                          <td className="py-3 px-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              u.subscription_plan === 'premium'
                                ? 'bg-gradient-to-r from-amber-200 to-yellow-200 text-amber-900'
                                : 'bg-gray-200 text-gray-700'
                            }`}>
                              {u.subscription_plan || 'basic'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              u.role === 'admin'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* Subscriptions Tab */}
            <TabsContent value="subscriptions" data-testid="subscriptions-tab-content">
              <div className="glass rounded-2xl p-8">
                <h2 className="text-2xl font-bold text-amber-900 mb-6">Suscripciones Activas</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-amber-200">
                        <th className="text-left py-3 px-4 text-amber-900">Plan</th>
                        <th className="text-left py-3 px-4 text-amber-900">Estado</th>
                        <th className="text-left py-3 px-4 text-amber-900">Inicio</th>
                        <th className="text-left py-3 px-4 text-amber-900">Fin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions.filter(s => s.payment_status === 'paid').map((sub) => (
                        <tr key={sub.id} className="border-b border-amber-100 hover:bg-amber-50">
                          <td className="py-3 px-4 capitalize font-semibold text-amber-900">
                            {sub.plan_type}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              {sub.payment_status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {sub.start_date ? new Date(sub.start_date).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {sub.end_date ? new Date(sub.end_date).toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* Reservations Tab */}
            <TabsContent value="reservations" data-testid="reservations-tab-content">
              <div className="glass rounded-2xl p-8">
                <h2 className="text-2xl font-bold text-amber-900 mb-6">Reservas de Cabina VR</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-amber-200">
                        <th className="text-left py-3 px-4 text-amber-900">Usuario</th>
                        <th className="text-left py-3 px-4 text-amber-900">Fecha</th>
                        <th className="text-left py-3 px-4 text-amber-900">Horario</th>
                        <th className="text-left py-3 px-4 text-amber-900">Estado</th>
                        <th className="text-left py-3 px-4 text-amber-900">QR Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map((res) => (
                        <tr key={res.id} className="border-b border-amber-100 hover:bg-amber-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-semibold">{res.user_name}</p>
                              <p className="text-xs text-gray-600">{res.user_email}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">{res.reservation_date}</td>
                          <td className="py-3 px-4">{res.time_slot}</td>
                          <td className="py-3 px-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              res.status === 'confirmed'
                                ? 'bg-green-100 text-green-800'
                                : res.status === 'cancelled'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {res.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-sm">{res.qr_code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
