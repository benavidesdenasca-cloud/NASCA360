import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Users, Crown, Calendar, Video, DollarSign, TrendingUp, Edit, Trash2, Ban, CheckCircle, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper function to safely extract error messages
const getErrorMessage = (error, defaultMessage = 'Ha ocurrido un error') => {
  if (!error) return defaultMessage;
  
  // Try to get from response.data
  if (error.response && error.response.data) {
    const data = error.response.data;
    
    // If data is a string, return it
    if (typeof data === 'string') {
      return data;
    }
    
    // If data has detail and it's a string, return it
    if (data.detail) {
      if (typeof data.detail === 'string') {
        return data.detail;
      }
      // If detail is an array (FastAPI validation errors)
      if (Array.isArray(data.detail)) {
        return data.detail
          .map(err => {
            if (typeof err === 'string') return err;
            if (err.msg) return err.msg;
            return 'Error de validación';
          })
          .join(', ');
      }
    }
    
    // If data has message and it's a string, return it
    if (data.message && typeof data.message === 'string') {
      return data.message;
    }
  }
  
  // Try to get from error.message
  if (error.message && typeof error.message === 'string') {
    return error.message;
  }
  
  // Return default message
  return defaultMessage;
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const [metrics, setMetrics] = useState({
    total_users: 0,
    premium_users: 0,
    total_reservations: 0,
    total_videos: 0,
    total_revenue: 0
  });
  const [users, setUsers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Subscription filters
  const [subscriptionFilter, setSubscriptionFilter] = useState('all');
  const [subscriptionStats, setSubscriptionStats] = useState({
    total: 0, active: 0, expired: 0, cancelled: 0, total_revenue: 0
  });
  
  // Payment history modal
  const [paymentHistoryModal, setPaymentHistoryModal] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState(null);
  
  // Modal states
  const [editUserModal, setEditUserModal] = useState(null);
  const [videoModal, setVideoModal] = useState(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
    if (token) {
      fetchAdminData();
    }
  }, [user, token]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      
      if (!token) {
        console.error('No token available');
        toast.error('Error de autenticación');
        navigate('/auth/login');
        return;
      }
      
      const headers = { 'Authorization': `Bearer ${token}` };

      const [metricsRes, usersRes, videosRes, subsRes, resRes, subStatsRes] = await Promise.all([
        axios.get(`${API}/admin/metrics`, { headers }),
        axios.get(`${API}/admin/users`, { headers }),
        axios.get(`${API}/videos`, { headers }),
        axios.get(`${API}/admin/subscriptions`, { headers }),
        axios.get(`${API}/admin/reservations`, { headers }),
        axios.get(`${API}/admin/subscriptions/stats`, { headers }).catch(() => ({ data: null }))
      ]);

      setMetrics(metricsRes.data || {
        total_users: 0,
        premium_users: 0,
        total_reservations: 0,
        total_videos: 0,
        total_revenue: 0
      });
      setUsers(usersRes.data || []);
      setVideos(videosRes.data || []);
      setSubscriptions(subsRes.data || []);
      setReservations(resRes.data || []);
      if (subStatsRes.data) {
        setSubscriptionStats(subStatsRes.data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error(getErrorMessage(error, 'Error al cargar datos administrativos'));
      setLoading(false);
      
      // If unauthorized, redirect to login
      if (error.response?.status === 401 || error.response?.status === 403) {
        navigate('/auth/login');
      }
    }
  };

  // Fetch subscriptions with filter
  const fetchFilteredSubscriptions = async (filter) => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const response = await axios.get(`${API}/admin/subscriptions?status=${filter}`, { headers });
      setSubscriptions(response.data || []);
    } catch (error) {
      toast.error('Error al filtrar suscripciones');
    }
  };

  // Fetch payment history for a user
  const fetchPaymentHistory = async (userId) => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const response = await axios.get(`${API}/admin/users/${userId}/payment-history`, { headers });
      setPaymentHistory(response.data);
      setPaymentHistoryModal(userId);
    } catch (error) {
      toast.error('Error al cargar historial de pagos');
    }
  };

  // Cancel subscription
  const handleCancelSubscription = async (subscriptionId) => {
    if (!window.confirm('¿Estás seguro de cancelar esta suscripción?')) return;
    
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      await axios.put(`${API}/admin/subscriptions/${subscriptionId}/cancel`, {}, { headers });
      toast.success('Suscripción cancelada');
      fetchAdminData();
    } catch (error) {
      toast.error('Error al cancelar suscripción');
    }
  };

  // Extend subscription
  const handleExtendSubscription = async (subscriptionId, days = 30) => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const response = await axios.put(`${API}/admin/subscriptions/${subscriptionId}/extend?days=${days}`, {}, { headers });
      toast.success(response.data.message);
      fetchAdminData();
    } catch (error) {
      toast.error('Error al extender suscripción');
    }
  };

  const handleBlockUser = async (userId, isBlocked) => {
    try {
      const endpoint = isBlocked ? 'unblock' : 'block';
      await axios.put(`${API}/admin/users/${userId}/${endpoint}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success(isBlocked ? 'Usuario desbloqueado' : 'Usuario bloqueado');
      fetchAdminData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Error al cambiar estado del usuario'));
    }
  };

  const handleUpdateUser = async (userId, data) => {
    try {
      await axios.put(`${API}/admin/users/${userId}`, data, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Usuario actualizado');
      setEditUserModal(null);
      fetchAdminData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Error al actualizar usuario'));
    }
  };

  const handleDeleteVideo = async (videoId) => {
    if (!confirm('¿Estás seguro de eliminar este video?')) return;
    
    try {
      await axios.delete(`${API}/admin/videos/${videoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Video eliminado');
      fetchAdminData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Error al eliminar video'));
    }
  };

  const handleSaveVideo = async (videoData) => {
    try {
      if (videoData.id) {
        // Update existing
        await axios.put(`${API}/admin/videos/${videoData.id}`, videoData, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        toast.success('Video actualizado');
      } else {
        // Create new
        await axios.post(`${API}/admin/videos`, videoData, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        toast.success('Video creado');
      }
      setVideoModal(null);
      fetchAdminData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Error al guardar video'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
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
          <div className="mb-12">
            <h1 className="text-5xl font-bold text-amber-900 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Panel de Administración
            </h1>
            <p className="text-xl text-gray-700">
              Gestión completa de Nazca360
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
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
            <TabsList className="grid w-full grid-cols-4 mb-8">
              <TabsTrigger value="users">Usuarios</TabsTrigger>
              <TabsTrigger value="videos">Videos</TabsTrigger>
              <TabsTrigger value="subscriptions">Suscripciones</TabsTrigger>
              <TabsTrigger value="reservations">Reservas</TabsTrigger>
            </TabsList>

            {/* Users Tab */}
            <TabsContent value="users">
              <div className="glass rounded-2xl p-8">
                <h2 className="text-2xl font-bold text-amber-900 mb-6">Gestión de Usuarios</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-amber-200">
                        <th className="text-left py-3 px-4 text-amber-900">Nombre</th>
                        <th className="text-left py-3 px-4 text-amber-900">Email</th>
                        <th className="text-left py-3 px-4 text-amber-900">Plan</th>
                        <th className="text-left py-3 px-4 text-amber-900">Fecha Pago</th>
                        <th className="text-left py-3 px-4 text-amber-900">Monto</th>
                        <th className="text-left py-3 px-4 text-amber-900">Acceso</th>
                        <th className="text-left py-3 px-4 text-amber-900">Estado</th>
                        <th className="text-left py-3 px-4 text-amber-900">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.user_id} className="border-b border-amber-100 hover:bg-amber-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium">{u.name}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                u.role === 'admin'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {u.role}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm">{u.email}</td>
                          <td className="py-3 px-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              u.subscription_info
                                ? 'bg-gradient-to-r from-amber-200 to-yellow-200 text-amber-900'
                                : 'bg-gray-200 text-gray-700'
                            }`}>
                              {u.subscription_info?.plan_type || 'Sin Plan'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {u.subscription_info?.payment_date 
                              ? new Date(u.subscription_info.payment_date).toLocaleDateString('es-PE')
                              : '-'}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium">
                            {u.subscription_info?.amount_paid 
                              ? `$${u.subscription_info.amount_paid}`
                              : '-'}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {u.subscription_info?.start_date && u.subscription_info?.end_date ? (
                              <div>
                                <p className="text-green-600">
                                  Desde: {new Date(u.subscription_info.start_date).toLocaleDateString('es-PE')}
                                </p>
                                <p className="text-red-600">
                                  Hasta: {new Date(u.subscription_info.end_date).toLocaleDateString('es-PE')}
                                </p>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              u.is_blocked
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {u.is_blocked ? 'Bloqueado' : 'Activo'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditUserModal(u)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleBlockUser(u.user_id, u.is_blocked)}
                                className={u.is_blocked ? 'text-green-600' : 'text-red-600'}
                                disabled={u.user_id === user.user_id}
                              >
                                {u.is_blocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* Videos Tab */}
            <TabsContent value="videos">
              <div className="glass rounded-2xl p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-amber-900">Gestión de Videos</h2>
                  <Button onClick={() => setVideoModal({})}>
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Video
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {videos.map((video) => (
                    <div key={video.id} className="border-2 border-amber-200 rounded-xl p-4 hover:shadow-lg transition">
                      <div className="relative mb-3">
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url?.startsWith('/api') ? `${BACKEND_URL}${video.thumbnail_url}` : video.thumbnail_url}
                            alt={video.title}
                            className="w-full h-40 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-full h-40 bg-amber-100 rounded-lg flex items-center justify-center">
                            <Video className="w-12 h-12 text-amber-400" />
                          </div>
                        )}
                        {video.is_premium && (
                          <span className="absolute top-2 right-2 bg-amber-500 text-white px-2 py-1 rounded text-xs font-bold">
                            PREMIUM
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-amber-900 mb-1">{video.title}</h3>
                      <p className="text-sm text-gray-600 mb-3">{video.category}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setVideoModal(video)}
                          className="flex-1"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteVideo(video.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Subscriptions Tab */}
            <TabsContent value="subscriptions">
              <div className="glass rounded-2xl p-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-blue-700">{subscriptionStats.total}</p>
                    <p className="text-xs text-blue-600">Total</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-700">{subscriptionStats.active}</p>
                    <p className="text-xs text-green-600">Activas</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-red-700">{subscriptionStats.expired}</p>
                    <p className="text-xs text-red-600">Vencidas</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-700">{subscriptionStats.cancelled}</p>
                    <p className="text-xs text-gray-600">Canceladas</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700">${subscriptionStats.total_revenue?.toFixed(2) || '0.00'}</p>
                    <p className="text-xs text-amber-600">Ingresos</p>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <h2 className="text-2xl font-bold text-amber-900 mr-4">Suscripciones</h2>
                  {['all', 'active', 'expired', 'cancelled'].map((filter) => (
                    <Button
                      key={filter}
                      variant={subscriptionFilter === filter ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSubscriptionFilter(filter);
                        fetchFilteredSubscriptions(filter);
                      }}
                      className={subscriptionFilter === filter ? 'bg-amber-600' : ''}
                    >
                      {filter === 'all' ? 'Todas' : filter === 'active' ? 'Activas' : filter === 'expired' ? 'Vencidas' : 'Canceladas'}
                    </Button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-amber-200 bg-amber-50">
                        <th className="text-left py-3 px-3 text-amber-900">Usuario</th>
                        <th className="text-left py-3 px-3 text-amber-900">Plan</th>
                        <th className="text-left py-3 px-3 text-amber-900">Estado</th>
                        <th className="text-left py-3 px-3 text-amber-900">Fecha Pago</th>
                        <th className="text-left py-3 px-3 text-amber-900">Monto</th>
                        <th className="text-left py-3 px-3 text-amber-900">Método</th>
                        <th className="text-left py-3 px-3 text-amber-900">Inicio</th>
                        <th className="text-left py-3 px-3 text-amber-900">Vencimiento</th>
                        <th className="text-left py-3 px-3 text-amber-900">ID Trans.</th>
                        <th className="text-left py-3 px-3 text-amber-900">Auto-Renov.</th>
                        <th className="text-left py-3 px-3 text-amber-900">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions.map((sub) => {
                        const status = sub.calculated_status || sub.status || 'pending';
                        const statusColors = {
                          active: 'bg-green-100 text-green-800',
                          expired: 'bg-red-100 text-red-800',
                          cancelled: 'bg-gray-100 text-gray-800',
                          pending: 'bg-yellow-100 text-yellow-800'
                        };
                        
                        return (
                          <tr key={sub.id} className="border-b border-amber-100 hover:bg-amber-50">
                            <td className="py-3 px-3">
                              <div>
                                <p className="font-semibold text-amber-900">{sub.user_name || 'N/A'}</p>
                                <p className="text-xs text-gray-500">{sub.user_email || sub.user_id?.slice(0, 8)}</p>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 capitalize">
                                {sub.plan_type}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[status]}`}>
                                {status === 'active' ? 'Activa' : status === 'expired' ? 'Vencida' : status === 'cancelled' ? 'Cancelada' : 'Pendiente'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-gray-600">
                              {sub.payment_date ? new Date(sub.payment_date).toLocaleDateString('es-PE') : 'N/A'}
                            </td>
                            <td className="py-3 px-3 font-semibold text-green-700">
                              {sub.amount_paid ? `$${sub.amount_paid.toFixed(2)}` : 'N/A'}
                            </td>
                            <td className="py-3 px-3 text-gray-600 capitalize">
                              {sub.payment_method || 'N/A'}
                            </td>
                            <td className="py-3 px-3 text-gray-600">
                              {sub.start_date ? new Date(sub.start_date).toLocaleDateString('es-PE') : 'N/A'}
                            </td>
                            <td className="py-3 px-3">
                              <span className={status === 'expired' ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                                {sub.end_date ? new Date(sub.end_date).toLocaleDateString('es-PE') : 'N/A'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-mono text-xs text-gray-500" title={sub.stripe_payment_intent_id || sub.stripe_session_id}>
                                {(sub.stripe_payment_intent_id || sub.stripe_session_id)?.slice(0, 12) || 'N/A'}...
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              {sub.auto_renew ? (
                                <span className="text-green-600">✓ Sí</span>
                              ) : (
                                <span className="text-gray-400">✗ No</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => fetchPaymentHistory(sub.user_id)}
                                  className="text-xs px-2"
                                  title="Ver historial"
                                >
                                  📋
                                </Button>
                                {status === 'active' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCancelSubscription(sub.id)}
                                    className="text-xs px-2 text-red-600"
                                    title="Cancelar"
                                  >
                                    ✗
                                  </Button>
                                )}
                                {(status === 'expired' || status === 'active') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleExtendSubscription(sub.id, 30)}
                                    className="text-xs px-2 text-green-600"
                                    title="Extender 30 días"
                                  >
                                    +30d
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {subscriptions.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No hay suscripciones con este filtro
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Reservations Tab */}
            <TabsContent value="reservations">
              <div className="glass rounded-2xl p-8">
                <h2 className="text-2xl font-bold text-amber-900 mb-6">Reservas de Cabina VR</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-amber-200">
                        <th className="text-left py-3 px-4 text-amber-900">Usuario</th>
                        <th className="text-left py-3 px-4 text-amber-900">Cabina</th>
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
                          <td className="py-3 px-4">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900">
                              Cabina {res.cabin_number}
                            </span>
                          </td>
                          <td className="py-3 px-4">{res.reservation_date}</td>
                          <td className="py-3 px-4">{res.time_slot}</td>
                          <td className="py-3 px-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              res.status === 'confirmed'
                                ? 'bg-green-100 text-green-800'
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

      {/* Edit User Modal */}
      {editUserModal && (
        <EditUserModal
          user={editUserModal}
          onClose={() => setEditUserModal(null)}
          onSave={handleUpdateUser}
        />
      )}

      {/* Video Modal */}
      {videoModal !== null && (
        <VideoModal
          video={videoModal}
          onClose={() => setVideoModal(null)}
          onSave={handleSaveVideo}
        />
      )}

      {/* Payment History Modal */}
      {paymentHistoryModal && paymentHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white pb-4 border-b">
              <div>
                <h3 className="text-2xl font-bold text-amber-900">Historial de Pagos</h3>
                {paymentHistory.user && (
                  <p className="text-gray-600">{paymentHistory.user.name} - {paymentHistory.user.email}</p>
                )}
              </div>
              <button onClick={() => setPaymentHistoryModal(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Subscriptions History */}
            <div className="mb-8">
              <h4 className="text-lg font-semibold text-amber-800 mb-4">Suscripciones ({paymentHistory.subscriptions?.length || 0})</h4>
              {paymentHistory.subscriptions?.length > 0 ? (
                <div className="space-y-3">
                  {paymentHistory.subscriptions.map((sub, idx) => (
                    <div key={idx} className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Plan</p>
                          <p className="font-semibold capitalize">{sub.plan_type}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Estado</p>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            sub.status === 'active' ? 'bg-green-100 text-green-800' :
                            sub.status === 'expired' ? 'bg-red-100 text-red-800' :
                            sub.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {sub.status || sub.payment_status}
                          </span>
                        </div>
                        <div>
                          <p className="text-gray-500">Monto</p>
                          <p className="font-semibold text-green-700">{sub.amount_paid ? `$${sub.amount_paid.toFixed(2)}` : 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Fecha de Pago</p>
                          <p>{sub.payment_date ? new Date(sub.payment_date).toLocaleDateString('es-PE') : 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Inicio</p>
                          <p>{sub.start_date ? new Date(sub.start_date).toLocaleDateString('es-PE') : 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Vencimiento</p>
                          <p>{sub.end_date ? new Date(sub.end_date).toLocaleDateString('es-PE') : 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">ID Transacción</p>
                          <p className="font-mono text-xs">{(sub.stripe_payment_intent_id || sub.stripe_session_id)?.slice(0, 20) || 'N/A'}...</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Auto-Renovación</p>
                          <p>{sub.auto_renew ? '✓ Sí' : '✗ No'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No hay suscripciones registradas</p>
              )}
            </div>

            {/* Transactions History */}
            <div>
              <h4 className="text-lg font-semibold text-amber-800 mb-4">Transacciones ({paymentHistory.transactions?.length || 0})</h4>
              {paymentHistory.transactions?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="text-left py-2 px-3">Fecha</th>
                        <th className="text-left py-2 px-3">Tipo</th>
                        <th className="text-left py-2 px-3">Monto</th>
                        <th className="text-left py-2 px-3">Estado</th>
                        <th className="text-left py-2 px-3">ID Sesión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.transactions.map((tx, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3">{tx.created_at ? new Date(tx.created_at).toLocaleDateString('es-PE') : 'N/A'}</td>
                          <td className="py-2 px-3 capitalize">{tx.metadata?.type || 'N/A'}</td>
                          <td className="py-2 px-3 font-semibold text-green-700">${tx.amount?.toFixed(2) || '0.00'}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              tx.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {tx.payment_status}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-xs">{tx.session_id?.slice(0, 15) || 'N/A'}...</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No hay transacciones registradas</p>
              )}
            </div>

            <div className="mt-6 pt-4 border-t flex justify-end">
              <Button onClick={() => setPaymentHistoryModal(null)} variant="outline">
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Edit User Modal Component
const EditUserModal = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    role: user.role || 'user',
    is_blocked: user.is_blocked || false
  });
  
  const [subscriptionData, setSubscriptionData] = useState({
    plan_type: user.subscription_info?.plan_type || 'none',
    amount_paid: user.subscription_info?.amount_paid || 0,
    start_date: user.subscription_info?.start_date ? user.subscription_info.start_date.split('T')[0] : '',
    end_date: user.subscription_info?.end_date ? user.subscription_info.end_date.split('T')[0] : '',
    status: user.subscription_info?.status || 'none'
  });
  
  const [activeTab, setActiveTab] = useState('user');

  const handleSave = () => {
    onSave(user.user_id, {
      ...formData,
      subscription: subscriptionData
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-amber-900">Editar Usuario</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('user')}
            className={`px-4 py-2 font-medium ${activeTab === 'user' 
              ? 'text-amber-600 border-b-2 border-amber-600' 
              : 'text-gray-500 hover:text-gray-700'}`}
          >
            Datos de Usuario
          </button>
          <button
            onClick={() => setActiveTab('subscription')}
            className={`px-4 py-2 font-medium ${activeTab === 'subscription' 
              ? 'text-amber-600 border-b-2 border-amber-600' 
              : 'text-gray-500 hover:text-gray-700'}`}
          >
            Suscripción
          </button>
        </div>
        
        {/* User Data Tab */}
        {activeTab === 'user' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rol</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                <select
                  value={formData.is_blocked ? 'blocked' : 'active'}
                  onChange={(e) => setFormData({...formData, is_blocked: e.target.value === 'blocked'})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  <option value="active">Activo</option>
                  <option value="blocked">Bloqueado</option>
                </select>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mt-4">
              <p className="text-sm text-gray-600">
                <strong>user_id:</strong> {user.user_id}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Creado:</strong> {user.created_at ? new Date(user.created_at).toLocaleDateString('es-PE') : 'N/A'}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Proveedor Auth:</strong> {user.oauth_provider || 'Email/Password'}
              </p>
            </div>
          </div>
        )}
        
        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Plan de Suscripción</label>
                <select
                  value={subscriptionData.plan_type}
                  onChange={(e) => setSubscriptionData({...subscriptionData, plan_type: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  <option value="none">Sin Plan</option>
                  <option value="1_month">1 Mes ($20)</option>
                  <option value="3_months">3 Meses ($55)</option>
                  <option value="6_months">6 Meses ($100)</option>
                  <option value="12_months">12 Meses ($180)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado Suscripción</label>
                <select
                  value={subscriptionData.status}
                  onChange={(e) => setSubscriptionData({...subscriptionData, status: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  <option value="none">Sin Suscripción</option>
                  <option value="active">Activa</option>
                  <option value="expired">Expirada</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Monto Pagado ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={subscriptionData.amount_paid}
                  onChange={(e) => setSubscriptionData({...subscriptionData, amount_paid: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
                <input
                  type="text"
                  value={user.subscription_info?.payment_method || 'paypal'}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Inicio</label>
                <input
                  type="date"
                  value={subscriptionData.start_date}
                  onChange={(e) => setSubscriptionData({...subscriptionData, start_date: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Fin (Acceso hasta)</label>
                <input
                  type="date"
                  value={subscriptionData.end_date}
                  onChange={(e) => setSubscriptionData({...subscriptionData, end_date: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="bg-amber-50 rounded-lg p-4 mt-4">
              <p className="text-sm font-medium text-amber-800 mb-3">Acciones Rápidas:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const endDate = new Date(today);
                    endDate.setDate(endDate.getDate() + 30);
                    setSubscriptionData({
                      ...subscriptionData,
                      plan_type: '1_month',
                      status: 'active',
                      amount_paid: 20,
                      start_date: today.toISOString().split('T')[0],
                      end_date: endDate.toISOString().split('T')[0]
                    });
                  }}
                  className="px-3 py-1 bg-amber-200 text-amber-800 rounded-full text-xs hover:bg-amber-300"
                >
                  + 1 Mes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const endDate = new Date(today);
                    endDate.setDate(endDate.getDate() + 90);
                    setSubscriptionData({
                      ...subscriptionData,
                      plan_type: '3_months',
                      status: 'active',
                      amount_paid: 55,
                      start_date: today.toISOString().split('T')[0],
                      end_date: endDate.toISOString().split('T')[0]
                    });
                  }}
                  className="px-3 py-1 bg-amber-200 text-amber-800 rounded-full text-xs hover:bg-amber-300"
                >
                  + 3 Meses
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const endDate = new Date(today);
                    endDate.setDate(endDate.getDate() + 180);
                    setSubscriptionData({
                      ...subscriptionData,
                      plan_type: '6_months',
                      status: 'active',
                      amount_paid: 100,
                      start_date: today.toISOString().split('T')[0],
                      end_date: endDate.toISOString().split('T')[0]
                    });
                  }}
                  className="px-3 py-1 bg-amber-200 text-amber-800 rounded-full text-xs hover:bg-amber-300"
                >
                  + 6 Meses
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const endDate = new Date(today);
                    endDate.setDate(endDate.getDate() + 365);
                    setSubscriptionData({
                      ...subscriptionData,
                      plan_type: '12_months',
                      status: 'active',
                      amount_paid: 180,
                      start_date: today.toISOString().split('T')[0],
                      end_date: endDate.toISOString().split('T')[0]
                    });
                  }}
                  className="px-3 py-1 bg-amber-200 text-amber-800 rounded-full text-xs hover:bg-amber-300"
                >
                  + 12 Meses
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubscriptionData({
                      plan_type: 'none',
                      status: 'none',
                      amount_paid: 0,
                      start_date: '',
                      end_date: ''
                    });
                  }}
                  className="px-3 py-1 bg-red-200 text-red-800 rounded-full text-xs hover:bg-red-300"
                >
                  Quitar Acceso
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
          <Button onClick={onClose} variant="outline" className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 btn-peru"
          >
            Guardar Cambios
          </Button>
        </div>
      </div>
    </div>
  );
};

// Video Modal Component
const VideoModal = ({ video, onClose, onSave }) => {
  const { token } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    id: video.id || null,
    title: video.title || '',
    description: video.description || '',
    url: video.url || '',
    thumbnail_url: video.thumbnail_url || '',
    category: video.category || 'nasca',
    duration: video.duration || '',
    cultural_tags: video.cultural_tags?.join(', ') || '',
    stereo_format: video.stereo_format || 'mono',
    is_premium: video.is_premium ?? true
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    video: 0,
    thumbnail: 0
  });

  const handleFileUpload = async (file, fieldName) => {
    if (!file) return;
    
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const fileSizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(2);
    
    // For video files, use Cloudflare Stream with metadata fix
    if (fieldName === 'video') {
      try {
        setUploading(true);
        setUploadProgress(prev => ({ ...prev, [fieldName]: 1 }));
        
        const sizeDisplay = file.size > 1024*1024*1024 ? fileSizeGB + 'GB' : fileSizeMB + 'MB';
        toast.info(`Procesando y subiendo video (${sizeDisplay})...`);
        
        // Use the new endpoint that fixes metadata with ffmpeg
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await axios.post(`${API}/stream/upload-fixed`, formData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 0, // No timeout for large files
          onUploadProgress: (progressEvent) => {
            if (progressEvent.lengthComputable) {
              // Show upload progress (first 50%)
              const percentage = Math.round((progressEvent.loaded / progressEvent.total) * 50);
              setUploadProgress(prev => ({ ...prev, [fieldName]: Math.min(percentage, 49) }));
              console.log(`Upload progress: ${percentage}%`);
            }
          }
        });
        
        if (response.data.success && response.data.video_id) {
          setUploadProgress(prev => ({ ...prev, [fieldName]: 100 }));
          setFormData(prev => ({ ...prev, url: `stream://${response.data.video_id}` }));
          toast.success('¡Video procesado y subido! Metadata corregido.');
        } else {
          throw new Error(response.data.message || 'Error al subir video');
        }
        
        setUploading(false);
        setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
        
      } catch (error) {
        console.error('Video upload error:', error);
        const errorMsg = error.response?.data?.detail || error.message || 'Error al subir video';
        toast.error(`Error: ${errorMsg}`);
        setUploading(false);
        setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
      }
      return;
    }
    
    // For thumbnails and other files - upload to local server
    try {
      setUploading(true);
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await axios.post(`${API}/upload`, uploadFormData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        timeout: 300000,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(prev => ({ ...prev, [fieldName]: percentCompleted }));
        }
      });

      setFormData(prev => ({
        ...prev,
        thumbnail_url: response.data.url
      }));
      
      toast.success('Imagen subida correctamente');
      setUploading(false);
      setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(getErrorMessage(error, 'Error al subir archivo'));
      setUploading(false);
      setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
    }
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.description || !formData.url) {
      toast.error('Por favor completa los campos obligatorios');
      return;
    }

    const dataToSave = {
      ...formData,
      cultural_tags: formData.cultural_tags.split(',').map(t => t.trim()).filter(t => t)
    };
    onSave(dataToSave);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 my-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-amber-900">
            {video.id ? 'Editar Video' : 'Agregar Video'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Título*</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción*</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              rows="3"
              required
            />
          </div>

          {/* Video Original Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video Original (Alta Calidad)*
            </label>
            <p className="text-xs text-green-600 mb-2">
              🎬 Cloudflare Stream: Transcoding automático • CDN global • Streaming adaptativo HLS
            </p>
            
            <div className="space-y-3">
              {/* Option 1: Upload file */}
              <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                <p className="text-xs font-medium text-gray-600 mb-2">Opción 1: Subir archivo</p>
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={(e) => handleFileUpload(e.target.files[0], 'video')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                  disabled={uploading}
                />
              </div>
              
              {/* Option 2: Paste Cloudflare Video ID */}
              <div className="p-3 border border-blue-200 rounded-lg bg-blue-50">
                <p className="text-xs font-medium text-blue-600 mb-2">
                  Opción 2: Pegar Video ID de Cloudflare (si ya subiste directo a Cloudflare)
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ej: a1b2c3d4e5f6..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    id="cloudflare-video-id"
                    disabled={uploading}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      const videoId = document.getElementById('cloudflare-video-id').value.trim();
                      if (videoId) {
                        setFormData(prev => ({ ...prev, url: `stream://${videoId}` }));
                        toast.success('Video ID vinculado correctamente');
                      } else {
                        toast.error('Ingresa un Video ID válido');
                      }
                    }}
                    disabled={uploading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4"
                  >
                    Vincular
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Encuentra el Video ID en tu panel de Cloudflare Stream
                </p>
              </div>
              
              {uploading && uploadProgress.video > 0 && (
                <div className="space-y-1">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="h-3 rounded-full transition-all duration-300 bg-orange-500"
                      style={{ width: `${uploadProgress.video}%` }}
                    ></div>
                  </div>
                  <p className="text-sm font-medium text-orange-600">
                    🎬 Procesando y subiendo a Cloudflare Stream... {uploadProgress.video}%
                  </p>
                </div>
              )}
              {formData.url && !uploading && (
                <p className="text-sm text-green-600 font-medium">
                  ✓ Video vinculado: {formData.url.startsWith('stream://') ? `🎬 Cloudflare Stream (${formData.url.replace('stream://', '')})` : 'Local'}
                </p>
              )}
            </div>
          </div>

          {/* Thumbnail Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Miniatura (Imagen - Opcional)
            </label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e.target.files[0], 'thumbnail')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                disabled={uploading}
              />
              {uploading && uploadProgress.thumbnail > 0 && (
                <div className="space-y-1">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-amber-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress.thumbnail}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-amber-600 font-medium">
                    Subiendo imagen... {uploadProgress.thumbnail}%
                  </p>
                </div>
              )}
              {formData.thumbnail_url && !uploading && (
                <p className="text-sm text-green-600 font-medium">
                  ✓ Imagen subida: {formData.thumbnail_url.split('/').pop()}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Categoría*</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            >
              <option value="nasca">Nasca</option>
              <option value="palpa">Palpa</option>
              <option value="museum">Museo Virtual</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Formato de Video 360°</label>
            <select
              value={formData.stereo_format}
              onChange={(e) => setFormData({...formData, stereo_format: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            >
              <option value="mono">Monoscópico (Normal)</option>
              <option value="sbs">Estereoscópico Side-by-Side (SBS)</option>
              <option value="tb">Estereoscópico Top-Bottom (TB)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Si el video se ve dividido en dos, selecciona el formato estereoscópico correspondiente.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Duración (ej: 5:30)</label>
            <input
              type="text"
              value={formData.duration}
              onChange={(e) => setFormData({...formData, duration: e.target.value})}
              placeholder="5:30"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Etiquetas Culturales (separadas por comas)</label>
            <input
              type="text"
              value={formData.cultural_tags}
              onChange={(e) => setFormData({...formData, cultural_tags: e.target.value})}
              placeholder="geoglifo, líneas, colibrí"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-900">
              <strong>Nota:</strong> Todo el contenido requiere suscripción activa para ser visualizado (modelo Netflix).
            </p>
          </div>

          <div className="flex gap-3 mt-6 pt-6 border-t">
            <Button onClick={onClose} variant="outline" className="flex-1" disabled={uploading}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 btn-peru"
              disabled={!formData.title || !formData.description || !formData.url || uploading}
            >
              {uploading ? 'Subiendo...' : (video.id ? 'Actualizar' : 'Crear')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
