import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Maximize2, Minimize2, RotateCcw, Eye, EyeOff } from 'lucide-react';

/**
 * Image360VRViewer - Immersive 360° photo viewer with WebXR/VR support
 * Uses A-Frame for WebXR compatibility with Meta Quest 3 and other VR headsets
 */
const Image360VRViewer = ({ 
  imageUrl, 
  title = '360° Image', 
  description = '',
  onClose,
  proxyUrl = null // Optional: use proxy for CORS
}) => {
  const containerRef = useRef(null);
  const aframeSceneRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [vrSupported, setVrSupported] = useState(false);
  const [isInVR, setIsInVR] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);

  // Get the final image URL (with proxy if needed)
  const getFinalImageUrl = useCallback(() => {
    if (proxyUrl) {
      return `${proxyUrl}?url=${encodeURIComponent(imageUrl)}`;
    }
    return imageUrl;
  }, [imageUrl, proxyUrl]);

  // Check for WebXR VR support
  useEffect(() => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        setVrSupported(supported);
        console.log('WebXR VR supported:', supported);
      }).catch(() => {
        setVrSupported(false);
      });
    }
  }, []);

  // Initialize A-Frame scene
  useEffect(() => {
    if (!containerRef.current || !imageUrl) return;

    // Dynamically load A-Frame if not already loaded
    const loadAFrame = () => {
      return new Promise((resolve, reject) => {
        if (window.AFRAME) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://aframe.io/releases/1.7.0/aframe.min.js';
        script.async = true;
        script.onload = () => {
          // Wait a bit for AFRAME to fully initialize
          setTimeout(resolve, 100);
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    const initScene = async () => {
      try {
        await loadAFrame();
        
        if (!containerRef.current) return;

        // Clear any existing content
        containerRef.current.innerHTML = '';

        // Create A-Frame scene
        const scene = document.createElement('a-scene');
        scene.setAttribute('embedded', '');
        scene.setAttribute('vr-mode-ui', 'enabled: true; enterVRButton: #enterVRButton; exitVRButton: #exitVRButton');
        scene.setAttribute('webxr', 'requiredFeatures: local-floor; optionalFeatures: hand-tracking, layers');
        scene.setAttribute('renderer', 'antialias: true; colorManagement: true');
        scene.setAttribute('loading-screen', 'enabled: false');
        
        // Create assets container for preloading
        const assets = document.createElement('a-assets');
        assets.setAttribute('timeout', '30000');
        
        const img = document.createElement('img');
        img.id = 'panorama-img';
        img.crossOrigin = 'anonymous';
        img.src = getFinalImageUrl();
        
        img.onload = () => {
          setIsLoading(false);
          setError(null);
        };
        
        img.onerror = () => {
          setIsLoading(false);
          setError('Error al cargar la imagen 360°. Verifica la URL.');
        };
        
        assets.appendChild(img);
        scene.appendChild(assets);

        // Create sky (360° sphere with panorama)
        const sky = document.createElement('a-sky');
        sky.setAttribute('src', '#panorama-img');
        sky.setAttribute('rotation', '0 -90 0');
        
        if (autoRotate) {
          sky.setAttribute('animation', 'property: rotation; from: 0 0 0; to: 0 360 0; loop: true; dur: 200000; easing: linear');
        }
        
        scene.appendChild(sky);

        // Create camera rig for better VR control
        const cameraRig = document.createElement('a-entity');
        cameraRig.id = 'cameraRig';
        cameraRig.setAttribute('position', '0 1.6 0');
        
        const camera = document.createElement('a-camera');
        camera.setAttribute('look-controls', 'enabled: true; magicWindowTrackingEnabled: true; touchEnabled: true');
        camera.setAttribute('wasd-controls', 'enabled: false');
        
        cameraRig.appendChild(camera);
        scene.appendChild(cameraRig);

        // Add instruction text that's visible in VR
        const textEntity = document.createElement('a-text');
        textEntity.setAttribute('value', title);
        textEntity.setAttribute('position', '0 2.5 -3');
        textEntity.setAttribute('align', 'center');
        textEntity.setAttribute('color', '#ffffff');
        textEntity.setAttribute('width', '6');
        textEntity.setAttribute('font', 'roboto');
        textEntity.setAttribute('opacity', '0.8');
        scene.appendChild(textEntity);

        // Add event listeners for VR session
        scene.addEventListener('enter-vr', () => {
          setIsInVR(true);
          console.log('Entered VR mode');
        });

        scene.addEventListener('exit-vr', () => {
          setIsInVR(false);
          console.log('Exited VR mode');
        });

        containerRef.current.appendChild(scene);
        aframeSceneRef.current = scene;

      } catch (err) {
        console.error('Error initializing A-Frame:', err);
        setError('Error al inicializar el visor VR');
        setIsLoading(false);
      }
    };

    initScene();

    return () => {
      // Cleanup
      if (aframeSceneRef.current) {
        try {
          // Exit VR if still in it
          if (aframeSceneRef.current.is && aframeSceneRef.current.is('vr-mode')) {
            aframeSceneRef.current.exitVR();
          }
        } catch (e) {
          console.log('VR exit error:', e);
        }
        aframeSceneRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [imageUrl, getFinalImageUrl, title, autoRotate]);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    const container = containerRef.current?.parentElement;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.log('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Toggle auto-rotate
  const toggleAutoRotate = () => {
    setAutoRotate(!autoRotate);
    
    if (aframeSceneRef.current) {
      const sky = aframeSceneRef.current.querySelector('a-sky');
      if (sky) {
        if (!autoRotate) {
          sky.setAttribute('animation', 'property: rotation; from: 0 0 0; to: 0 360 0; loop: true; dur: 200000; easing: linear');
        } else {
          sky.removeAttribute('animation');
        }
      }
    }
  };

  // Enter VR mode
  const enterVR = () => {
    if (aframeSceneRef.current && aframeSceneRef.current.enterVR) {
      aframeSceneRef.current.enterVR();
    }
  };

  // Reset camera view
  const resetView = () => {
    if (aframeSceneRef.current) {
      const camera = aframeSceneRef.current.querySelector('a-camera');
      if (camera) {
        camera.setAttribute('rotation', '0 0 0');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col" data-testid="image-360-vr-viewer">
      {/* Header with controls */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/90 via-black/60 to-transparent p-4 pointer-events-auto">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-white text-xl font-bold drop-shadow-lg">{title}</h2>
            {description && (
              <p className="text-white/80 text-sm mt-1 drop-shadow">{description}</p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Auto-rotate toggle */}
            <button
              onClick={toggleAutoRotate}
              className={`p-2 rounded-full transition-all ${
                autoRotate 
                  ? 'bg-amber-500 text-white' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title={autoRotate ? 'Detener rotación' : 'Activar rotación'}
              data-testid="toggle-autorotate-btn"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            
            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all"
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              data-testid="toggle-fullscreen-btn"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/20 text-white hover:bg-red-500 transition-all"
              title="Cerrar"
              data-testid="close-viewer-btn"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* A-Frame container */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full h-full"
        style={{ minHeight: '100vh' }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center text-white">
            <div className="w-16 h-16 border-4 border-white/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg">Cargando imagen 360°...</p>
            <p className="text-sm text-white/60 mt-2">Preparando experiencia inmersiva</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
          <div className="text-center text-white p-8 max-w-md">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-xl mb-2">Error</p>
            <p className="text-white/70 mb-6">{error}</p>
            <button 
              onClick={onClose}
              className="px-6 py-2 bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Footer with VR button and instructions */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 pointer-events-auto">
        <div className="flex flex-col items-center gap-4">
          {/* VR Button - Only show if VR is supported */}
          {vrSupported && !isInVR && (
            <button
              onClick={enterVR}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-full font-bold text-lg shadow-2xl transition-all transform hover:scale-105 flex items-center gap-3"
              data-testid="enter-vr-btn"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.74 6H3.21C1.99 6 1 6.99 1 8.21v7.58C1 17.01 1.99 18 3.21 18h5.35c.63 0 1.22-.35 1.52-.91l.81-1.52c.26-.49.71-.79 1.22-.79h1.78c.51 0 .97.3 1.22.79l.81 1.52c.3.56.88.91 1.52.91h5.35c1.22 0 2.21-.99 2.21-2.21V8.21C23 6.99 22.01 6 20.74 6zM7.75 14c-1.24 0-2.25-1.01-2.25-2.25S6.51 9.5 7.75 9.5 10 10.51 10 11.75 8.99 14 7.75 14zm8.5 0c-1.24 0-2.25-1.01-2.25-2.25s1.01-2.25 2.25-2.25 2.25 1.01 2.25 2.25S17.49 14 16.25 14z"/>
              </svg>
              Entrar en Modo VR
            </button>
          )}
          
          {/* In VR indicator */}
          {isInVR && (
            <div className="px-6 py-3 bg-green-600 text-white rounded-full font-medium flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Modo VR Activo
            </div>
          )}
          
          {/* Instructions */}
          <p className="text-white/70 text-sm text-center max-w-lg">
            {vrSupported 
              ? 'Arrastra para mirar alrededor • Usa el botón VR para experiencia inmersiva con Meta Quest 3' 
              : 'Arrastra para mirar alrededor • Usa la rueda del mouse para zoom'
            }
          </p>
          
          {/* VR not supported message */}
          {!vrSupported && (
            <p className="text-amber-400/80 text-xs text-center">
              Para experiencia VR inmersiva, abre esta página desde un visor Meta Quest 3 u otro dispositivo WebXR compatible
            </p>
          )}
        </div>
      </div>

      {/* Custom VR enter/exit buttons (hidden, used by A-Frame) */}
      <button id="enterVRButton" style={{ display: 'none' }} />
      <button id="exitVRButton" style={{ display: 'none' }} />
    </div>
  );
};

export default Image360VRViewer;
