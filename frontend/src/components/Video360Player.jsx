import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import Hls from 'hls.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

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
  const hlsRef = useRef(null);
  const vrButtonRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [buffered, setBuffered] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [quality, setQuality] = useState('auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [hlsLevels, setHlsLevels] = useState([]);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [vrSupported, setVrSupported] = useState(false);
  const [isInVR, setIsInVR] = useState(false);
  
  const lonRef = useRef(0);
  const latRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const mountedRef = useRef(false);

  // Check for WebXR VR support
  useEffect(() => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        setVrSupported(supported);
        console.log('WebXR VR supported:', supported);
      });
    }
  }, []);

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

    // Renderer with WebXR support
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.xr.enabled = true; // Enable WebXR
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add VR Button if supported
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        if (supported) {
          const vrButton = VRButton.createButton(renderer);
          vrButton.style.position = 'absolute';
          vrButton.style.bottom = '80px';
          vrButton.style.left = '50%';
          vrButton.style.transform = 'translateX(-50%)';
          vrButton.style.zIndex = '100';
          vrButton.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
          vrButton.style.border = 'none';
          vrButton.style.borderRadius = '25px';
          vrButton.style.padding = '12px 24px';
          vrButton.style.fontWeight = 'bold';
          vrButton.style.fontSize = '14px';
          container.appendChild(vrButton);
          vrButtonRef.current = vrButton;
          
          // Track VR session state
          renderer.xr.addEventListener('sessionstart', () => {
            setIsInVR(true);
            console.log('VR session started');
          });
          renderer.xr.addEventListener('sessionend', () => {
            setIsInVR(false);
            console.log('VR session ended');
          });
        }
      });
    }

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

    // Render loop - supports both regular and VR rendering
    renderer.setAnimationLoop(() => {
      if (!rendererRef.current || !mountedRef.current) return;
      
      // Only update camera rotation when not in VR (VR handles its own camera)
      if (!renderer.xr.isPresenting) {
        const lat = Math.max(-85, Math.min(85, latRef.current));
        const phi = THREE.MathUtils.degToRad(90 - lat);
        const theta = THREE.MathUtils.degToRad(lonRef.current);

        camera.lookAt(
          500 * Math.sin(phi) * Math.cos(theta),
          500 * Math.cos(phi),
          500 * Math.sin(phi) * Math.sin(theta)
        );
      }

      renderer.render(scene, camera);
    });

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
      
      // Stop animation loop
      renderer.setAnimationLoop(null);
      
      // Remove VR button if exists
      if (vrButtonRef.current && container.contains(vrButtonRef.current)) {
        container.removeChild(vrButtonRef.current);
      }
      
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

    // Set source - check if HLS stream
    console.log('Setting video source:', videoUrl.substring(0, 80) + '...');
    
    const isHLS = videoUrl.includes('.m3u8') || videoUrl.includes('cloudflarestream.com');
    
    if (isHLS && Hls.isSupported()) {
      // Use HLS.js for adaptive streaming
      console.log('Using HLS.js for adaptive streaming');
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90
      });
      
      hls.loadSource(videoUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log('HLS manifest parsed, levels:', data.levels.length);
        setHlsLevels(data.levels.map((level, index) => ({
          index,
          height: level.height,
          bitrate: level.bitrate
        })));
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error('HLS fatal error:', data);
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          }
        }
      });
      
      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = videoUrl;
    } else {
      // Regular video source
      video.src = videoUrl;
    }

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
      
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      
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
              
              {/* Volume control */}
              <div className="flex items-center gap-1 group">
                <button
                  data-testid="mute-btn"
                  onClick={toggleMute}
                  className="text-white/70 hover:text-white p-1 transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                    </svg>
                  ) : volume < 0.5 ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-0 group-hover:w-16 transition-all duration-200 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer opacity-0 group-hover:opacity-100 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
              </div>
              
              <span className="text-white text-sm tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Quality selector */}
              <div className="relative">
                <button
                  data-testid="quality-btn"
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="flex items-center gap-1 text-white/70 hover:text-white px-2 py-1 rounded transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                  </svg>
                  <span className="hidden sm:inline">{QUALITY_SETTINGS[quality].label}</span>
                </button>
                
                {showQualityMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-black/95 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
                    {Object.entries(QUALITY_SETTINGS).map(([key, settings]) => (
                      <button
                        key={key}
                        onClick={() => handleQualityChange(key)}
                        className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                          quality === key 
                            ? 'bg-amber-600 text-white' 
                            : 'text-white/80 hover:bg-white/10'
                        }`}
                      >
                        {settings.label}
                        {quality === key && (
                          <svg className="w-4 h-4 inline ml-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* VR Mode Button */}
              {vrSupported && (
                <button
                  data-testid="vr-mode-btn"
                  onClick={() => {
                    // The VRButton handles entering VR, but we can also trigger it
                    if (vrButtonRef.current) {
                      vrButtonRef.current.click();
                    }
                  }}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-all ${
                    isInVR 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.74 6H3.21C1.99 6 1 6.99 1 8.21v7.58C1 17.01 1.99 18 3.21 18h5.35c.63 0 1.22-.35 1.52-.91l.81-1.52c.26-.49.71-.79 1.22-.79h1.78c.51 0 .97.3 1.22.79l.81 1.52c.3.56.88.91 1.52.91h5.35c1.22 0 2.21-.99 2.21-2.21V8.21C23 6.99 22.01 6 20.74 6zM7.75 14c-1.24 0-2.25-1.01-2.25-2.25S6.51 9.5 7.75 9.5 10 10.51 10 11.75 8.99 14 7.75 14zm8.5 0c-1.24 0-2.25-1.01-2.25-2.25s1.01-2.25 2.25-2.25 2.25 1.01 2.25 2.25S17.49 14 16.25 14z"/>
                  </svg>
                  <span className="hidden sm:inline">{isInVR ? 'En VR' : 'Meta VR'}</span>
                </button>
              )}
              
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
            Arrastra para ver en 360° {vrSupported && '• Usa Meta Quest para experiencia inmersiva'}
          </p>
        </div>
      )}
    </div>
  );
};

export default Video360Player;
