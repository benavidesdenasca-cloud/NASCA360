import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

const QUALITY_SETTINGS = {
  auto: { label: 'Auto', pixelRatio: -1, segments: 60 },
  high: { label: 'Alta (4K)', pixelRatio: 2, segments: 64 },
  medium: { label: 'Media (1080p)', pixelRatio: 1.5, segments: 48 },
  low: { label: 'Baja (720p)', pixelRatio: 1, segments: 32 },
};

const Video360Player = ({ videoUrl, posterUrl, title }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const rendererRef = useRef(null);
  const frameIdRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const textureRef = useRef(null);
  const cleanupFnRef = useRef(null);
  const sphereRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [buffered, setBuffered] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [quality, setQuality] = useState('auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  const lonRef = useRef(0);
  const latRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const mountedRef = useRef(false);

  // Initialize Three.js scene
  const initThreeJS = useCallback((video) => {
    if (!containerRef.current || rendererRef.current) return null;
    
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 1, 1100);
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: false,
      powerPreference: 'default',
      alpha: false
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Video Texture
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBAFormat;
    texture.generateMipmaps = false;
    textureRef.current = texture;

    // Sphere geometry (inverted for 360 view)
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    
    const material = new THREE.MeshBasicMaterial({ 
      map: texture,
      side: THREE.FrontSide
    });
    
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    sphereRef.current = sphere;

    // Render loop
    const render = () => {
      if (!rendererRef.current || !mountedRef.current) return;
      
      const lat = Math.max(-85, Math.min(85, latRef.current));
      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lonRef.current);

      camera.lookAt(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta)
      );

      renderer.render(scene, camera);
      frameIdRef.current = requestAnimationFrame(render);
    };

    render();

    // Mouse/Touch handlers
    const canvas = renderer.domElement;
    canvas.style.cursor = 'grab';

    const onMouseDown = (e) => {
      isDraggingRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    };

    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      lonRef.current -= (e.clientX - lastPosRef.current.x) * 0.15;
      latRef.current += (e.clientY - lastPosRef.current.y) * 0.15;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      canvas.style.cursor = 'grab';
    };

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDraggingRef.current = true;
        lastPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e) => {
      if (!isDraggingRef.current || e.touches.length !== 1) return;
      lonRef.current -= (e.touches[0].clientX - lastPosRef.current.x) * 0.15;
      latRef.current += (e.touches[0].clientY - lastPosRef.current.y) * 0.15;
      lastPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onTouchEnd = () => {
      isDraggingRef.current = false;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd);

    const onResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Return cleanup
    return () => {
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      
      texture?.dispose();
      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
      
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Main effect
  useEffect(() => {
    if (!videoUrl || !containerRef.current) return;

    mountedRef.current = true;
    let video = null;
    
    // Create video element
    video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.preload = 'metadata';
    video.muted = false;
    video.loop = false;
    videoRef.current = video;

    let hasMetadata = false;
    let hadError = false;

    video.onloadedmetadata = () => {
      if (!mountedRef.current) return;
      hasMetadata = true;
      console.log('Video metadata loaded:', video.duration, 'seconds');
      setDuration(video.duration);
      setIsReady(true);
      // Clear any previous error since video is working
      setError(null);
      // Initialize Three.js
      cleanupFnRef.current = initThreeJS(video);
    };

    video.oncanplay = () => {
      if (!mountedRef.current) return;
      console.log('Video can play');
      setIsLoading(false);
      setError(null);
    };

    video.onwaiting = () => {
      if (mountedRef.current) setIsLoading(true);
    };

    video.onplaying = () => {
      if (mountedRef.current) setIsLoading(false);
    };

    video.ontimeupdate = () => {
      if (mountedRef.current) setCurrentTime(video.currentTime);
    };

    video.onprogress = () => {
      if (!mountedRef.current) return;
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const dur = video.duration || 1;
        setBuffered(Math.round((bufferedEnd / dur) * 100));
      }
    };

    video.onended = () => {
      if (mountedRef.current) setIsPlaying(false);
    };

    video.onerror = (e) => {
      console.error('Video error event:', e);
      // Ignore errors that happen after successful metadata load
      // The video is working even if some requests fail
    };

    // Set source
    console.log('Setting video source:', videoUrl.substring(0, 80) + '...');
    video.src = videoUrl;

    // Timeout for initial load - show error only if nothing happens in 30 seconds
    const loadTimeout = setTimeout(() => {
      if (!hasMetadata && mountedRef.current) {
        setError('El video está tardando demasiado en cargar. Verifica tu conexión.');
        setIsLoading(false);
      }
    }, 30000);

    // Cleanup
    return () => {
      mountedRef.current = false;
      clearTimeout(loadTimeout);
      
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      
      if (cleanupFnRef.current) {
        cleanupFnRef.current();
        cleanupFnRef.current = null;
      }
      
      if (video) {
        video.pause();
        video.src = '';
        video.load();
      }
      
      videoRef.current = null;
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      textureRef.current = null;
    };
  }, [videoUrl, initThreeJS]);

  // Play/Pause
  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        await video.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Play error:', err);
      // Try muted autoplay
      try {
        video.muted = true;
        await video.play();
        setIsPlaying(true);
        setTimeout(() => { video.muted = false; }, 100);
      } catch (err2) {
        setError('No se pudo reproducir. Intenta de nuevo.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Seek
  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pct * duration;
  };

  // Quality change
  const handleQualityChange = (newQuality) => {
    setQuality(newQuality);
    setShowQualityMenu(false);
    
    const settings = QUALITY_SETTINGS[newQuality];
    
    // Update renderer pixel ratio
    if (rendererRef.current) {
      const pixelRatio = settings.pixelRatio === -1 
        ? Math.min(window.devicePixelRatio, 2) 
        : settings.pixelRatio;
      rendererRef.current.setPixelRatio(pixelRatio);
    }
    
    // Update sphere geometry for quality
    if (sphereRef.current && sceneRef.current) {
      const oldSphere = sphereRef.current;
      const texture = textureRef.current;
      
      // Create new geometry with different segment count
      const newGeometry = new THREE.SphereGeometry(500, settings.segments, Math.round(settings.segments * 0.67));
      newGeometry.scale(-1, 1, 1);
      
      const newMaterial = new THREE.MeshBasicMaterial({ 
        map: texture,
        side: THREE.FrontSide
      });
      
      const newSphere = new THREE.Mesh(newGeometry, newMaterial);
      
      sceneRef.current.remove(oldSphere);
      sceneRef.current.add(newSphere);
      sphereRef.current = newSphere;
      
      // Dispose old resources
      oldSphere.geometry.dispose();
      oldSphere.material.dispose();
    }
  };

  // Volume control
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted && volume === 0) {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
      }
    }
  };

  // Format time
  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Fullscreen
  const toggleFullscreen = () => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div 
      data-testid="video-360-player"
      className="relative w-full bg-black rounded-xl overflow-hidden" 
      style={{ height: '500px' }}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 pointer-events-none z-10">
          <div className="text-center text-white">
            <div className="w-12 h-12 border-4 border-white/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm">Cargando video 360°...</p>
            {buffered > 0 && buffered < 100 && (
              <p className="text-xs text-white/60 mt-2">Buffer: {buffered}%</p>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20">
          <div className="text-center text-white p-6">
            <p className="text-red-400 mb-4">{error}</p>
            <button 
              onClick={() => {
                setError(null);
                setIsLoading(true);
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }}
              className="px-6 py-2 bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      {!error && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-10">
          {/* Progress */}
          <div 
            className="h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group relative"
            onClick={handleSeek}
          >
            <div 
              className="absolute h-full bg-white/30 rounded-full transition-all"
              style={{ width: `${buffered}%` }}
            />
            <div 
              className="h-full bg-amber-500 rounded-full relative z-10 transition-all"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                data-testid="play-pause-btn"
                onClick={togglePlay}
                disabled={isLoading && !isReady}
                className="w-10 h-10 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 rounded-full flex items-center justify-center text-white transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6zm8 0h4v16h-4z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>
              <span className="text-white text-sm tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs bg-amber-600 text-white px-2 py-0.5 rounded-full font-medium">
                360°
              </span>
              <button
                data-testid="fullscreen-btn"
                onClick={toggleFullscreen}
                className="text-white/70 hover:text-white p-1.5 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                </svg>
              </button>
            </div>
          </div>
          
          <p className="text-white/40 text-xs text-center mt-2">
            Arrastra para ver en 360°
          </p>
        </div>
      )}
    </div>
  );
};

export default Video360Player;
