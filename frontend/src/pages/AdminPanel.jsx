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

      const [metricsRes, usersRes, videosRes, subsRes, resRes] = await Promise.all([
        axios.get(`${API}/admin/metrics`, { headers }),
        axios.get(`${API}/admin/users`, { headers }),
        axios.get(`${API}/videos`, { headers }),
        axios.get(`${API}/admin/subscriptions`, { headers }),
        axios.get(`${API}/admin/reservations`, { headers })
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
                        <th className="text-left py-3 px-4 text-amber-900">Rol</th>
                        <th className="text-left py-3 px-4 text-amber-900">Estado</th>
                        <th className="text-left py-3 px-4 text-amber-900">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.user_id} className="border-b border-amber-100 hover:bg-amber-50">
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
    </div>
  );
};

// Edit User Modal Component
const EditUserModal = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    role: user.role,
    subscription_plan: user.subscription_plan
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-amber-900">Editar Usuario</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Plan</label>
            <select
              value={formData.subscription_plan}
              onChange={(e) => setFormData({...formData, subscription_plan: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            >
              <option value="basic">Básico</option>
              <option value="premium">Premium</option>
            </select>
          </div>

          <div className="flex gap-3 mt-6">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={() => onSave(user.user_id, formData)}
              className="flex-1 btn-peru"
            >
              Guardar
            </Button>
          </div>
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
    
    // For files > 100MB, use S3 direct upload
    if (file.size > 100 * 1024 * 1024) {
      try {
        setUploading(true);
        setUploadProgress(prev => ({ ...prev, [fieldName]: 1 }));
        
        if (file.size > 500 * 1024 * 1024) {
          toast.info(`Subiendo archivo grande (${fileSizeGB}GB) directamente a la nube...`);
        }
        
        // Step 1: Get presigned URL from backend
        const presignedResponse = await axios.post(`${API}/s3/presigned-url`, null, {
          params: {
            filename: file.name,
            content_type: file.type || 'video/mp4',
            file_size: file.size
          },
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const { presigned_url, s3_key, s3_url } = presignedResponse.data;
        
        setUploadProgress(prev => ({ ...prev, [fieldName]: 5 }));
        
        // Step 2: Upload directly to S3 using fetch with XMLHttpRequest for progress
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percentCompleted = Math.round((event.loaded * 100) / event.total);
              const scaledProgress = 5 + Math.round(percentCompleted * 0.9);
              setUploadProgress(prev => ({ ...prev, [fieldName]: scaledProgress }));
            }
          });
          
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });
          
          xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
          });
          
          xhr.addEventListener('abort', () => {
            reject(new Error('Upload aborted'));
          });
          
          xhr.open('PUT', presigned_url);
          xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
          xhr.send(file);
        });
        
        // Step 3: Confirm upload with backend
        await axios.post(`${API}/s3/confirm-upload`, null, {
          params: {
            s3_key: s3_key,
            s3_url: s3_url,
            original_filename: file.name,
            file_size: file.size
          },
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        setUploadProgress(prev => ({ ...prev, [fieldName]: 100 }));
        
        // Store S3 URL - use s3:// prefix to identify S3 files
        setFormData(prev => ({
          ...prev,
          [fieldName === 'video' ? 'url' : 'thumbnail_url']: `s3://${s3_key}`
        }));
        
        toast.success(`Archivo subido a la nube (${fileSizeMB}MB)`);
        setUploading(false);
        setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
        
      } catch (error) {
        console.error('S3 upload error:', error);
        const errorMsg = error.response?.data?.detail || error.message || 'Error al subir archivo';
        toast.error(`Error: ${errorMsg}`);
        setUploading(false);
        setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
      }
    } else {
      // Regular upload for smaller files (< 100MB) to local server
      try {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post(`${API}/upload`, formData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 300000, // 5 minutes
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(prev => ({ ...prev, [fieldName]: percentCompleted }));
          }
        });

        setFormData(prev => ({
          ...prev,
          [fieldName === 'video' ? 'url' : 'thumbnail_url']: response.data.url
        }));
        
        toast.success('Archivo subido correctamente');
        setUploading(false);
        setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(getErrorMessage(error, 'Error al subir archivo'));
        setUploading(false);
        setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
      }
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
            <div className="space-y-2">
              <input
                type="file"
                accept="video/mp4,video/webm"
                onChange={(e) => handleFileUpload(e.target.files[0], 'video')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                disabled={uploading}
              />
              {uploading && uploadProgress.video > 0 && (
                <div className="space-y-1">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-amber-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress.video}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-amber-600 font-medium">
                    Subiendo video... {uploadProgress.video}%
                  </p>
                </div>
              )}
              {formData.url && !uploading && (
                <p className="text-sm text-green-600 font-medium">
                  ✓ Video subido correctamente: {formData.url.split('/').pop()}
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
