import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Lock, Play, Clock } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Gallery = () => {
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Subscription verification state
  const [hasActiveSubscription, setHasActiveSubscription] = useState(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  // Check subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      if (!token) {
        setCheckingSubscription(false);
        setHasActiveSubscription(false);
        return;
      }
      
      try {
        const response = await axios.get(`${API}/subscription/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Admin always has access
        if (response.data.is_admin) {
          setHasActiveSubscription(true);
        } else {
          setHasActiveSubscription(response.data.has_active_subscription);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        setHasActiveSubscription(false);
      } finally {
        setCheckingSubscription(false);
      }
    };
    
    checkSubscription();
  }, [token]);

  useEffect(() => {
    if (hasActiveSubscription) {
      fetchVideos();
    }
  }, [selectedCategory, hasActiveSubscription]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const params = selectedCategory !== 'all' ? `?category=${selectedCategory}` : '';
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      const response = await axios.get(`${API}/videos${params}`, { headers });
      setVideos(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast.error('Error al cargar videos');
      setLoading(false);
    }
  };

  const handleVideoClick = (video) => {
    if (video.is_premium && (!user || user.subscription_plan !== 'premium')) {
      toast.error('Necesitas una suscripción Premium para acceder a este contenido');
      navigate('/subscription');
      return;
    }
    navigate(`/video/${video.id}`);
  };

  const categories = [
    { value: 'all', label: 'Todos' },
    { value: 'nasca', label: 'Líneas de Nasca' },
    { value: 'palpa', label: 'Líneas de Palpa' },
    { value: 'museum', label: 'Museo Virtual' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <Navbar />
      
      <div className="pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div data-testid="gallery-header" className="text-center mb-12">
            <h1 className="text-5xl font-bold text-amber-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
              Galería de Videos 360°
            </h1>
            <p className="text-xl text-gray-700">
              Explora las Líneas de Nasca y Palpa en experiencias inmersivas
            </p>
          </div>

          {/* Category Filters */}
          <div data-testid="category-filters" className="flex flex-wrap justify-center gap-4 mb-12">
            {categories.map((category) => (
              <Button
                key={category.value}
                data-testid={`category-${category.value}`}
                onClick={() => setSelectedCategory(category.value)}
                className={`px-6 py-3 rounded-full font-medium ${
                  selectedCategory === category.value
                    ? 'bg-gradient-to-r from-amber-600 to-orange-700 text-white'
                    : 'bg-white text-gray-700 border-2 border-amber-300 hover:border-amber-500'
                }`}
              >
                {category.label}
              </Button>
            ))}
          </div>

          {/* Videos Grid */}
          {loading ? (
            <div data-testid="loading-spinner" className="flex justify-center py-20">
              <div className="spinner"></div>
            </div>
          ) : (
            <div data-testid="videos-grid" className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {videos.map((video) => (
                <div
                  key={video.id}
                  data-testid={`video-card-${video.id}`}
                  className="card-peru cursor-pointer group"
                  onClick={() => handleVideoClick(video)}
                >
                  {/* Thumbnail */}
                  <div className="relative overflow-hidden">
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url.startsWith('/api') ? `${BACKEND_URL}${video.thumbnail_url}` : video.thumbnail_url}
                        alt={video.title}
                        className="w-full h-56 object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-56 bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                        <Play className="w-16 h-16 text-amber-500" />
                      </div>
                    )}
                    
                    {/* Demo Badge */}
                    {video.is_demo && (
                      <div className="absolute top-4 right-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center">
                        <Lock className="w-3 h-3 mr-1" />
                        Demo
                      </div>
                    )}

                    {/* Quality Badge */}
                    {video.is_demo && (
                      <div className="absolute top-4 left-4 bg-yellow-500 text-black px-2 py-1 rounded text-xs font-bold">
                        BAJA CALIDAD
                      </div>
                    )}

                    {/* Play Overlay */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                        <Play className="w-8 h-8 text-amber-900 ml-1" />
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {video.duration}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-amber-900 mb-2">
                      {video.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {video.description}
                    </p>
                    
                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                      {video.cultural_tags?.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && videos.length === 0 && (
            <div data-testid="no-videos" className="text-center py-20">
              <p className="text-xl text-gray-600">No se encontraron videos en esta categoría</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Gallery;