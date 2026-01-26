import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const Video360Player = ({ videoUrl, posterUrl, title }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const rendererRef = useRef(null);
  const frameIdRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  
  const lonRef = useRef(0);
  const latRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const sceneInitializedRef = useRef(false);

  // Fetch video as blob first (to handle CORS)
  useEffect(() => {
    if (!videoUrl) return;

    let cancelled = false;

    const fetchVideo = async () => {
      try {
        setIsLoading(true);
        setLoadingProgress(0);
        setError(null);

        const response = await fetch(videoUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        
        const reader = response.body.getReader();
        const chunks = [];
        let loaded = 0;

        while (true) {
          const { done, value } = await reader.read();
          
          if (cancelled) {
            reader.cancel();
            return;
          }
          
          if (done) break;
          
          chunks.push(value);
          loaded += value.length;
          
          if (total > 0) {
            setLoadingProgress(Math.round((loaded / total) * 100));
          }
        }

        if (cancelled) return;

        const blob = new Blob(chunks, { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        
      } catch (err) {
        console.error('Error fetching video:', err);
        if (!cancelled) {
          setError('Error cargando el video. Intenta recargar la página.');
          setIsLoading(false);
        }
      }
    };

    fetchVideo();

    return () => {
      cancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [videoUrl]);

  // Initialize Three.js when blob URL is ready
  useEffect(() => {
    if (!containerRef.current || !blobUrl || sceneInitializedRef.current) return;

    const container = containerRef.current;
    let scene, camera, renderer, texture;

    // Create video element with blob URL
    const video = document.createElement('video');
    video.src = blobUrl;
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.preload = 'auto';
    video.muted = false;
    videoRef.current = video;

    video.onloadedmetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };

    video.oncanplay = () => {
      setIsLoading(false);
    };

    video.ontimeupdate = () => {
      setCurrentTime(video.currentTime);
    };

    video.onended = () => {
      setIsPlaying(false);
    };

    video.onerror = (e) => {
      console.error('Video element error:', e);
      setError('Error reproduciendo el video');
    };

    // Three.js setup
    const width = container.clientWidth;
    const height = container.clientHeight;

    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(75, width / height, 1, 1100);
    camera.position.set(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ 
      antialias: false,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Video texture
    texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Sphere (inverted for 360 view)
    const geometry = new THREE.SphereGeometry(500, 32, 32);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    sceneInitializedRef.current = true;

    // Render loop
    const render = () => {
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

    // Mouse handlers
    const onMouseDown = (e) => {
      isDraggingRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      lonRef.current -= (e.clientX - lastPosRef.current.x) * 0.15;
      latRef.current += (e.clientY - lastPosRef.current.y) * 0.15;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    // Touch handlers
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

    // Attach events
    const canvas = renderer.domElement;
    canvas.style.cursor = 'grab';
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart);
    canvas.addEventListener('touchmove', onTouchMove);
    canvas.addEventListener('touchend', onTouchEnd);

    // Resize
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Cleanup
    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      window.removeEventListener('resize', onResize);
      
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      
      video.pause();
      video.src = '';
      
      texture?.dispose();
      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
      
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      
      sceneInitializedRef.current = false;
    };
  }, [blobUrl]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
      } else {
        await video.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Play error:', err);
      setError('Error al reproducir');
    }
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = percentage * duration;
  };

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  };

  return (
    <div className="relative w-full bg-black rounded-xl overflow-hidden" style={{ height: '500px' }}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading with progress */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center text-white">
            <div className="w-12 h-12 border-4 border-white/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm mb-2">Cargando video 360°...</p>
            {loadingProgress > 0 && (
              <div className="w-48 mx-auto">
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
                <p className="text-xs mt-1 text-white/60">{loadingProgress}%</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <div className="text-center text-white p-6">
            <p className="text-red-400 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      {!error && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          {/* Progress bar */}
          <div 
            className="h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group"
            onClick={handleSeek}
          >
            <div 
              className="h-full bg-amber-500 rounded-full relative"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                disabled={isLoading}
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
