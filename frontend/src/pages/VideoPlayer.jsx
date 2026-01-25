import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Clock, Tag, Lock } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VideoPlayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState(null);

  useEffect(() => {
    fetchVideo();
    
    // Cleanup blob URL on unmount
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [fetchVideo, videoUrl]);

  const loadAuthenticatedVideo = useCallback(async (videoSrc) => {
    try {
      // Fetch video with authentication
      const response = await fetch(`${BACKEND_URL}${videoSrc}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load video');
      }

      // Convert to blob
      const blob = await response.blob();
      
      // Create blob URL
      const blobUrl = URL.createObjectURL(blob);
      setVideoUrl(blobUrl);
    } catch (error) {
      console.error('Error loading authenticated video:', error);
      toast.error('Error al cargar el video protegido');
    }
  }, [token]);

  const fetchVideo = useCallback(async () => {
    try {
      setLoading(true);
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      const response = await axios.get(`${API}/videos/${id}`, { headers });
      setVideo(response.data);
      
      // Fetch the video file with authentication and create blob URL
      if (response.data.url) {
        await loadAuthenticatedVideo(response.data.url);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching video:', error);
      if (error.response?.status === 403) {
        toast.error('Necesitas una suscripción Premium para acceder a este contenido');
        navigate('/subscription');
      } else {
        toast.error('Error al cargar el video');
        navigate('/gallery');
      }
      setLoading(false);
    }
  }, [id, token, navigate, loadAuthenticatedVideo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
        <Navbar />
        <div data-testid="video-loading" className="flex items-center justify-center min-h-screen">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-xl text-gray-600">Video no encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <Navbar />
      
      <div className="pt-24 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <Button
            data-testid="back-button"
            onClick={() => navigate('/gallery')}
            variant="outline"
            className="mb-6 border-2 border-amber-700"
          >
            <ArrowLeft className="mr-2" />
            Volver a la Galería
          </Button>

          {/* Video Player */}
          <div data-testid="video-player-container" className="bg-white rounded-2xl shadow-2xl overflow-hidden mb-8 relative">
            <div className="video-container bg-black">
              {videoUrl ? (
                <video
                  data-testid="video-element"
                  controls
                  className="w-full h-full"
                  poster={video.thumbnail_url}
                  key={videoUrl}
                >
                  <source src={videoUrl} type="video/mp4" />
                  Tu navegador no soporta el reproductor de video.
                </video>
              ) : (
                <div className="flex items-center justify-center h-96 text-white">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                    <p>Cargando video seguro...</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Demo Overlay */}
            {video.is_demo && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-center pb-12 pointer-events-none">
                <div className="glass p-6 rounded-2xl max-w-2xl mx-4 pointer-events-auto">
                  <div className="text-center">
                    <div className="bg-yellow-500 text-black px-4 py-2 rounded-full inline-block mb-4 font-bold">
                      VIDEO DEMO - BAJA CALIDAD
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Esto es solo una vista previa
                    </h3>
                    <p className="text-white/90 mb-4">
                      Suscríbete para ver este video en alta calidad y acceder a todo el contenido exclusivo
                    </p>
                    <Button
                      onClick={() => navigate('/subscription')}
                      className="btn-peru px-8 py-4 rounded-full"
                    >
                      Ver Planes de Suscripción
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Video Info */}
          <div data-testid="video-info" className="glass rounded-2xl p-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold text-amber-900 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {video.title}
                </h1>
                {video.is_demo ? (
                  <div className="inline-flex items-center bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-2 rounded-full text-sm font-semibold">
                    <Lock className="w-4 h-4 mr-2" />
                    Video Demo (Baja Calidad)
                  </div>
                ) : (
                  <div className="inline-flex items-center bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-full text-sm font-semibold">
                    ✓ Calidad Premium
                  </div>
                )}
              </div>
            </div>

            <p className="text-lg text-gray-700 mb-6">
              {video.description}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-6">
              {video.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Category Badge */}
            <div className="inline-block">
              <span className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-700 text-white rounded-full text-sm font-semibold">
                Categoría: {video.category.charAt(0).toUpperCase() + video.category.slice(1)}
              </span>
            </div>
          </div>

          {/* VR Info */}
          <div className="glass rounded-2xl p-8 mt-8">
            <h2 className="text-2xl font-bold text-amber-900 mb-4">
              Experiencia VR
            </h2>
            <p className="text-gray-700 mb-4">
              ¿Quieres vivir esta experiencia en realidad virtual? Reserva tu sesión en nuestra cabina VR con visores Meta Quest.
            </p>
            <Button
              data-testid="reserve-vr-button"
              onClick={() => navigate('/reservations')}
              className="btn-peru"
            >
              Reservar Cabina VR
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;