import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

const Video360Player = ({ videoUrl, posterUrl, title }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const rendererRef = useRef(null);
  const frameIdRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const textureRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [buffered, setBuffered] = useState(0);
  
  const lonRef = useRef(0);
  const latRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const initializedRef = useRef(false);

  // Initialize Three.js scene
  const initThreeJS = useCallback((video) => {
    if (!containerRef.current || initializedRef.current) return;
    
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

    // Renderer - use simpler settings for better compatibility
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

    // Sphere geometry (inverted for 360 view from inside)
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    
    const material = new THREE.MeshBasicMaterial({ 
      map: texture,
      side: THREE.FrontSide
    });
    
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Render loop
    const render = () => {
      if (!rendererRef.current) return;
      
      // Update camera based on drag
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

    // Mouse/Touch handlers for 360 navigation
    const canvas = renderer.domElement;
    canvas.style.cursor = 'grab';

    const onMouseDown = (e) => {
      isDraggingRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    };

    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - lastPosRef.current.x;
      const deltaY = e.clientY - lastPosRef.current.y;
      lonRef.current -= deltaX * 0.15;
      latRef.current += deltaY * 0.15;
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
      const deltaX = e.touches[0].clientX - lastPosRef.current.x;
      const deltaY = e.touches[0].clientY - lastPosRef.current.y;
      lonRef.current -= deltaX * 0.15;
      latRef.current += deltaY * 0.15;
      lastPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onTouchEnd = () => {
      isDraggingRef.current = false;
    };

    // Add event listeners
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd);

    // Resize handler
    const onResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    initializedRef.current = true;

    // Return cleanup function
    return () => {
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // Main effect - setup video and Three.js
  useEffect(() => {
    if (!videoUrl || !containerRef.current) return;

    let cleanupThree = null;
    
    // Create hidden video element
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.preload = 'metadata';
    video.muted = false;
    video.loop = false;
    videoRef.current = video;

    // Video event handlers
    video.onloadedmetadata = () => {
      console.log('Video metadata loaded:', video.duration, 'seconds');
      setDuration(video.duration);
      // Initialize Three.js once we have metadata
      cleanupThree = initThreeJS(video);
    };

    video.oncanplay = () => {
      console.log('Video can play');
      setIsLoading(false);
    };

    video.onwaiting = () => {
      setIsLoading(true);
    };

    video.onplaying = () => {
      setIsLoading(false);
    };

    video.ontimeupdate = () => {
      setCurrentTime(video.currentTime);
    };

    video.onprogress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const duration = video.duration || 1;
        setBuffered(Math.round((bufferedEnd / duration) * 100));
      }
    };

    video.onended = () => {
      setIsPlaying(false);
    };

    video.onerror = (e) => {
      console.error('Video error:', e, video.error);
      // Don't immediately show error - could be transient during initialization
      const errorCode = video.error?.code || 0;
      // Only show error if we haven't successfully loaded metadata yet
      if (!video.duration || video.duration === 0) {
        const errorMessages = {
          1: 'Carga del video abortada',
          2: 'Error de red al cargar el video',
          3: 'Error decodificando el video',
          4: 'Formato de video no soportado'
        };
        setError(errorMessages[errorCode] || 'Error cargando el video');
        setIsLoading(false);
      }
    };

    // Set video source directly - S3 presigned URLs support Range requests natively
    console.log('Setting video source:', videoUrl.substring(0, 100) + '...');
    video.src = videoUrl;

    // Cleanup
    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      
      if (cleanupThree) {
        cleanupThree();
      }
      
      // Stop and cleanup video
      video.pause();
      video.src = '';
      video.load();
      videoRef.current = null;

      // Cleanup Three.js resources
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current && rendererRef.current.domElement.parentNode === containerRef.current) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current = null;
      }

      sceneRef.current = null;
      cameraRef.current = null;
      initializedRef.current = false;
    };
  }, [videoUrl, initThreeJS]);

  // Play/Pause toggle
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
      // Try muted autoplay as fallback (browser policy)
      try {
        video.muted = true;
        await video.play();
        setIsPlaying(true);
        // Unmute after starting
        setTimeout(() => { video.muted = false; }, 100);
      } catch (err2) {
        setError('No se pudo reproducir el video. Intenta de nuevo.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Seek handler
  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = percentage * duration;
    
    console.log('Seeking to:', newTime);
    video.currentTime = newTime;
  };

  // Format time helper
  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen().catch(err => {
        console.log('Fullscreen error:', err);
      });
    }
  };

  return (
    <div 
      data-testid="video-360-player"
      className="relative w-full bg-black rounded-xl overflow-hidden" 
      style={{ height: '500px' }}
    >
      {/* Three.js container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 pointer-events-none z-10">
          <div className="text-center text-white">
            <div className="w-12 h-12 border-4 border-white/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm">Cargando video 360°...</p>
            {buffered > 0 && buffered < 100 && (
              <p className="text-xs text-white/60 mt-2">Buffering: {buffered}%</p>
            )}
          </div>
        </div>
      )}

      {/* Error overlay */}
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
          {/* Progress bar */}
          <div 
            className="h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group relative"
            onClick={handleSeek}
          >
            {/* Buffer indicator */}
            <div 
              className="absolute h-full bg-white/30 rounded-full transition-all"
              style={{ width: `${buffered}%` }}
            />
            {/* Playback progress */}
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
                disabled={isLoading && !isPlaying}
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
