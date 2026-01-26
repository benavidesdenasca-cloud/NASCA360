import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

const Video360Player = ({ videoUrl, posterUrl, title }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const rendererRef = useRef(null);
  const frameIdRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [error, setError] = useState(null);
  
  const lonRef = useRef(0);
  const latRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const sceneInitializedRef = useRef(false);
  const fetchControllerRef = useRef(null);

  // Streaming video loader using MediaSource API
  const initMediaSource = useCallback(async () => {
    if (!videoUrl || !videoRef.current) return;

    const video = videoRef.current;
    
    // Check if MediaSource is supported
    if (!window.MediaSource || !MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')) {
      console.log('MediaSource not supported, falling back to direct URL');
      video.src = videoUrl;
      return;
    }

    try {
      const mediaSource = new MediaSource();
      mediaSourceRef.current = mediaSource;
      video.src = URL.createObjectURL(mediaSource);

      mediaSource.addEventListener('sourceopen', async () => {
        try {
          // Try different codecs
          let mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
          if (!MediaSource.isTypeSupported(mimeType)) {
            mimeType = 'video/mp4; codecs="avc1.64001F, mp4a.40.2"';
          }
          if (!MediaSource.isTypeSupported(mimeType)) {
            mimeType = 'video/mp4';
          }

          const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
          sourceBufferRef.current = sourceBuffer;
          
          // Fetch video in chunks
          const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
          let start = 0;
          let totalSize = 0;

          // First, get the file size
          const headResponse = await fetch(videoUrl, { method: 'HEAD' });
          if (headResponse.headers.get('content-length')) {
            totalSize = parseInt(headResponse.headers.get('content-length'), 10);
          }

          // Function to fetch a chunk
          const fetchChunk = async (rangeStart, rangeEnd) => {
            const response = await fetch(videoUrl, {
              headers: {
                'Range': `bytes=${rangeStart}-${rangeEnd}`
              }
            });
            
            if (!response.ok && response.status !== 206) {
              throw new Error(`HTTP error: ${response.status}`);
            }
            
            return await response.arrayBuffer();
          };

          // Load initial chunks to start playback
          const loadInitialData = async () => {
            const initialChunks = Math.min(3, Math.ceil(totalSize / CHUNK_SIZE)); // Load first 3 chunks
            
            for (let i = 0; i < initialChunks; i++) {
              const rangeStart = i * CHUNK_SIZE;
              const rangeEnd = Math.min(rangeStart + CHUNK_SIZE - 1, totalSize - 1);
              
              const chunk = await fetchChunk(rangeStart, rangeEnd);
              
              // Wait for sourceBuffer to be ready
              await new Promise((resolve) => {
                if (!sourceBuffer.updating) {
                  resolve();
                } else {
                  sourceBuffer.addEventListener('updateend', resolve, { once: true });
                }
              });
              
              sourceBuffer.appendBuffer(chunk);
              
              // Wait for append to complete
              await new Promise((resolve) => {
                sourceBuffer.addEventListener('updateend', resolve, { once: true });
              });
              
              start = rangeEnd + 1;
              setBuffered(Math.round((start / totalSize) * 100));
            }
            
            setIsLoading(false);
          };

          await loadInitialData();

          // Continue loading more chunks in background
          const loadMoreChunks = async () => {
            while (start < totalSize && mediaSourceRef.current?.readyState === 'open') {
              // Wait a bit to not overwhelm
              await new Promise(r => setTimeout(r, 100));
              
              const rangeEnd = Math.min(start + CHUNK_SIZE - 1, totalSize - 1);
              
              try {
                const chunk = await fetchChunk(start, rangeEnd);
                
                // Wait for sourceBuffer
                await new Promise((resolve) => {
                  if (!sourceBuffer.updating) {
                    resolve();
                  } else {
                    sourceBuffer.addEventListener('updateend', resolve, { once: true });
                  }
                });
                
                if (mediaSourceRef.current?.readyState !== 'open') break;
                
                sourceBuffer.appendBuffer(chunk);
                
                await new Promise((resolve) => {
                  sourceBuffer.addEventListener('updateend', resolve, { once: true });
                });
                
                start = rangeEnd + 1;
                setBuffered(Math.round((start / totalSize) * 100));
                
              } catch (err) {
                console.error('Error loading chunk:', err);
                break;
              }
            }
            
            // All data loaded
            if (mediaSourceRef.current?.readyState === 'open' && start >= totalSize) {
              try {
                mediaSource.endOfStream();
              } catch (e) {
                console.log('End of stream:', e);
              }
            }
          };

          loadMoreChunks();

        } catch (err) {
          console.error('SourceBuffer error:', err);
          // Fallback to direct URL
          video.src = videoUrl;
          setIsLoading(false);
        }
      });

      mediaSource.addEventListener('error', (e) => {
        console.error('MediaSource error:', e);
        video.src = videoUrl;
      });

    } catch (err) {
      console.error('MediaSource init error:', err);
      video.src = videoUrl;
      setIsLoading(false);
    }
  }, [videoUrl]);

  // Initialize video and Three.js
  useEffect(() => {
    if (!containerRef.current || !videoUrl || sceneInitializedRef.current) return;

    const container = containerRef.current;
    let scene, camera, renderer, texture, geometry, material;

    // Create video element
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.preload = 'auto';
    video.muted = false;
    videoRef.current = video;

    video.onloadedmetadata = () => {
      setDuration(video.duration);
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
      console.error('Video error:', e);
      // Try direct URL as fallback
      if (!video.src.startsWith('blob:')) {
        setError('Error cargando el video');
      }
    };

    video.onwaiting = () => {
      setIsLoading(true);
    };

    video.onplaying = () => {
      setIsLoading(false);
    };

    // Initialize MediaSource streaming
    initMediaSource();

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
    geometry = new THREE.SphereGeometry(500, 32, 32);
    geometry.scale(-1, 1, 1);
    material = new THREE.MeshBasicMaterial({ map: texture });
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
    canvas.addEventListener('touchstart', onTouchStart);
    canvas.addEventListener('touchmove', onTouchMove);
    canvas.addEventListener('touchend', onTouchEnd);

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
      if (fetchControllerRef.current) fetchControllerRef.current.abort();
      
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
      
      if (mediaSourceRef.current) {
        try {
          if (mediaSourceRef.current.readyState === 'open') {
            mediaSourceRef.current.endOfStream();
          }
        } catch (e) {}
      }
      
      texture?.dispose();
      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
      
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      
      sceneInitializedRef.current = false;
    };
  }, [videoUrl, initMediaSource]);

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

      {/* Loading overlay */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 pointer-events-none">
          <div className="text-center text-white">
            <div className="w-12 h-12 border-4 border-white/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm">Cargando video 360°...</p>
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
          {/* Progress bar with buffer indicator */}
          <div 
            className="h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group relative"
            onClick={handleSeek}
          >
            {/* Buffered indicator */}
            <div 
              className="absolute h-full bg-white/30 rounded-full"
              style={{ width: `${buffered}%` }}
            />
            {/* Playback progress */}
            <div 
              className="h-full bg-amber-500 rounded-full relative z-10"
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
                disabled={isLoading && buffered < 5}
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
              {/* Buffer indicator */}
              {buffered < 100 && (
                <span className="text-xs text-white/60">
                  Buffer: {buffered}%
                </span>
              )}
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
