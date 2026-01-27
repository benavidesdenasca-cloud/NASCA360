import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import Navbar from '@/components/Navbar';
import Video360Player from '@/components/Video360Player';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VideoPlayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [streamUrl, setStreamUrl] = useState(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchVideoData = async () => {
      try {
        setLoading(true);
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        const response = await axios.get(`${API}/videos/${id}`, { headers });
        
        if (!isMounted) return;
        
        setVideo(response.data);
        
        const videoUrl = response.data.url;
        
        // Handle different video URL types
        if (videoUrl && videoUrl.startsWith('stream://')) {
          // Cloudflare Stream video (best quality - HLS adaptive streaming)
          const videoId = videoUrl.replace('stream://', '');
          try {
            const streamResponse = await axios.get(
              `${API}/stream/embed/${videoId}`,
              { headers }
            );
            console.log('Cloudflare Stream HLS URL:', streamResponse.data.hls_url);
            setStreamUrl(streamResponse.data.hls_url);
          } catch (err) {
            console.error('Error getting Cloudflare Stream URL:', err);
            toast.error('Error al cargar el video desde Cloudflare Stream');
          }
        } else if (videoUrl && videoUrl.startsWith('r2://')) {
          // R2 video (Cloudflare CDN)
          const r2Key = videoUrl.replace('r2://', '').replace(/^[^/]+\//, '');
          try {
            const presignedResponse = await axios.get(
              `${API}/r2/presigned-view/${r2Key}`,
              { headers }
            );
            console.log('R2 CDN URL obtained:', presignedResponse.data.presigned_url.substring(0, 100));
            setStreamUrl(presignedResponse.data.presigned_url);
          } catch (err) {
            console.error('Error getting R2 URL:', err);
            toast.error('Error al cargar el video desde CDN');
          }
        } else if (videoUrl && videoUrl.startsWith('s3://')) {
          // S3 video - get presigned URL for viewing
          const s3Key = videoUrl.replace('s3://', '');
          try {
            const presignedResponse = await axios.get(
              `${API}/s3/presigned-view/${s3Key}`,
              { headers }
            );
            console.log('S3 presigned URL obtained:', presignedResponse.data.presigned_url.substring(0, 100));
            setStreamUrl(presignedResponse.data.presigned_url);
          } catch (err) {
            console.error('Error getting S3 presigned URL:', err);
            toast.error('Error al cargar el video desde la nube');
          }
        } else if (videoUrl && videoUrl.startsWith('/api/files/')) {
          // Local video - convert to streaming endpoint
          const filename = videoUrl.replace('/api/files/', '');
          setStreamUrl(`${BACKEND_URL}/api/stream/${filename}`);
        } else if (videoUrl) {
          // External URL - use directly
          setStreamUrl(videoUrl);
        }
        
        if (isMounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching video:', error);
        if (!isMounted) return;
        
        setLoading(false);
        
        let errorMessage = 'Error al cargar el video';
        if (error.response?.status === 403) {
          errorMessage = 'Necesitas una suscripción Premium para acceder a este contenido';
          toast.error(errorMessage);
          navigate('/subscription');
          return;
        }
        
        if (error.response?.data?.detail) {
          errorMessage = typeof error.response.data.detail === 'string' 
            ? error.response.data.detail 
            : errorMessage;
        }
        
        toast.error(errorMessage);
        navigate('/gallery');
      }
    };
    
    fetchVideoData();
    
    return () => {
      isMounted = false;
    };
  }, [id, token, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
        <Navbar />
        <div data-testid="video-loading" className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-amber-800 mx-auto mb-4"></div>
            <p className="text-amber-800">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-amber-800 text-xl mb-4">Video no encontrado</p>
            <Button onClick={() => navigate('/gallery')}>
              Volver a la Galería
            </Button>
          </div>
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

          {/* Video Player 360 */}
          <div data-testid="video-player-container" className="bg-white rounded-2xl shadow-2xl overflow-hidden mb-8">
            {streamUrl ? (
              <Video360Player
                videoUrl={streamUrl}
                posterUrl={video.thumbnail_url?.startsWith('/api') ? `${BACKEND_URL}${video.thumbnail_url}` : (video.thumbnail_url?.startsWith('s3://') ? null : video.thumbnail_url)}
                title={video.title}
              />
            ) : (
              <div className="flex items-center justify-center h-[500px] bg-black text-white">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                  <p>Cargando video 360°...</p>
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
                <div className="inline-flex items-center bg-gradient-to-r from-amber-600 to-amber-700 text-white px-4 py-2 rounded-full text-sm font-semibold">
                  🎬 Video 360° Premium
                </div>
              </div>
            </div>

            <p className="text-lg text-gray-700 mb-6">
              {video.description}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-6">
              {video.cultural_tags?.map((tag, index) => (
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