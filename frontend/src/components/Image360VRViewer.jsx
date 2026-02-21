import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { X, Maximize2, Minimize2, RotateCcw, Eye } from 'lucide-react';

/**
 * Image360VRViewer - Immersive 360° photo viewer with WebXR/VR support
 * Uses Three.js for WebXR compatibility with Meta Quest 3 and other VR headsets
 */
const Image360VRViewer = ({ 
  imageUrl, 
  title = '360° Image', 
  description = '',
  onClose,
  proxyUrl = null // Optional: use proxy for CORS
}) => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const sphereRef = useRef(null);
  const cleanupRef = useRef(null);
  const vrButtonRef = useRef(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [vrSupported, setVrSupported] = useState(false);
  const [isInVR, setIsInVR] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  
  // Mouse/touch control refs
  const lonRef = useRef(0);
  const latRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const autoRotateRef = useRef(autoRotate);

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
  
  // Keep autoRotateRef in sync
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  // Initialize Three.js scene with WebXR
  useEffect(() => {
    if (!containerRef.current || !imageUrl) return;

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
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.xr.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Load texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = 'anonymous';
    
    setIsLoading(true);
    textureLoader.load(
      getFinalImageUrl(),
      (texture) => {
        // Success
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        // Create sphere with inverted normals for inside view
        const geometry = new THREE.SphereGeometry(500, 80, 60);
        geometry.scale(-1, 1, 1);
        
        const material = new THREE.MeshBasicMaterial({ 
          map: texture,
          side: THREE.FrontSide
        });
        
        const sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);
        sphereRef.current = sphere;
        
        setIsLoading(false);
        setError(null);
      },
      undefined,
      (err) => {
        // Error
        console.error('Error loading panorama:', err);
        setIsLoading(false);
        setError('Error al cargar la imagen 360°. Verifica la URL.');
      }
    );

    // Add VR Button if supported
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        if (supported) {
          // Dynamically import VRButton
          import('three/examples/jsm/webxr/VRButton.js').then(({ VRButton }) => {
            const vrButton = VRButton.createButton(renderer);
            vrButton.style.position = 'absolute';
            vrButton.style.bottom = '100px';
            vrButton.style.left = '50%';
            vrButton.style.transform = 'translateX(-50%)';
            vrButton.style.zIndex = '100';
            vrButton.style.background = 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)';
            vrButton.style.border = 'none';
            vrButton.style.borderRadius = '25px';
            vrButton.style.padding = '16px 32px';
            vrButton.style.fontWeight = 'bold';
            vrButton.style.fontSize = '16px';
            vrButton.style.cursor = 'pointer';
            container.appendChild(vrButton);
            vrButtonRef.current = vrButton;
          });

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

    // Animation loop
    let lastTime = 0;
    renderer.setAnimationLoop((time) => {
      if (!rendererRef.current) return;
      
      // Auto-rotate when not dragging and not in VR
      if (autoRotateRef.current && !isDraggingRef.current && !renderer.xr.isPresenting) {
        const delta = (time - lastTime) / 1000;
        lonRef.current += delta * 3; // 3 degrees per second
      }
      lastTime = time;
      
      // Update camera only when not in VR
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

    // Cleanup function
    cleanupRef.current = () => {
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      
      if (renderer.xr.isPresenting) {
        const session = renderer.xr.getSession();
        if (session) session.end().catch(() => {});
      }
      
      renderer.setAnimationLoop(null);
      
      if (vrButtonRef.current && container.contains(vrButtonRef.current)) {
        container.removeChild(vrButtonRef.current);
      }
      
      if (sphereRef.current) {
        sphereRef.current.geometry.dispose();
        sphereRef.current.material.map?.dispose();
        sphereRef.current.material.dispose();
      }
      
      renderer.dispose();
      
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      sphereRef.current = null;
    };
  }, [imageUrl, getFinalImageUrl]);

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
