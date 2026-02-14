import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '@/App';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { MapPin, Eye, Info, X, ChevronLeft, ChevronRight, Play, Compass, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Nazca Lines area boundaries (restricted navigation)
const NAZCA_CENTER = {
  longitude: -75.0298,
  latitude: -14.7391,
  height: 15000
};

const NAZCA_BOUNDS = {
  west: -75.15,
  south: -14.85,
  east: -74.90,
  north: -14.60
};

// Default Points of Interest for Nazca Lines
const DEFAULT_POIS = [
  {
    id: 'colibri',
    name: 'El Colibrí',
    description: 'El colibrí es uno de los geoglifos más reconocidos, mide aproximadamente 96 metros de largo. Representa al ave sagrada asociada con la fertilidad.',
    longitude: -75.1067,
    latitude: -14.6922,
    category: 'geoglifo',
    videoId: null
  },
  {
    id: 'mono',
    name: 'El Mono',
    description: 'El mono tiene una cola en espiral y mide unos 110 metros. Es uno de los diseños más complejos con 9 dedos.',
    longitude: -75.0283,
    latitude: -14.7061,
    category: 'geoglifo',
    videoId: null
  },
  {
    id: 'arana',
    name: 'La Araña',
    description: 'La araña mide 46 metros y muestra una especie rara de araña conocida como Ricinulei.',
    longitude: -75.1225,
    latitude: -14.6944,
    category: 'geoglifo',
    videoId: null
  },
  {
    id: 'condor',
    name: 'El Cóndor',
    description: 'El cóndor es una de las figuras más grandes, con 134 metros de longitud. Representa al mensajero de los dioses.',
    longitude: -75.1278,
    latitude: -14.6978,
    category: 'geoglifo',
    videoId: null
  },
  {
    id: 'perro',
    name: 'El Perro',
    description: 'El perro mide aproximadamente 51 metros. Algunos investigadores creen que podría representar una llama.',
    longitude: -75.0775,
    latitude: -14.7208,
    category: 'geoglifo',
    videoId: null
  },
  {
    id: 'manos',
    name: 'Las Manos',
    description: 'Las manos muestran dos manos con diferente número de dedos, una con 4 y otra con 5.',
    longitude: -75.1106,
    latitude: -14.6961,
    category: 'geoglifo',
    videoId: null
  },
  {
    id: 'arbol',
    name: 'El Árbol',
    description: 'El árbol está junto a las manos y representa la conexión entre el mundo de los vivos y los muertos.',
    longitude: -75.1103,
    latitude: -14.6958,
    category: 'geoglifo',
    videoId: null
  },
  {
    id: 'astronauta',
    name: 'El Astronauta',
    description: 'También conocido como "El Hombre Búho", mide 32 metros y está en una ladera. Es una de las figuras más misteriosas.',
    longitude: -75.0689,
    latitude: -14.7447,
    category: 'geoglifo',
    videoId: null
  },
  {
    id: 'ballena',
    name: 'La Ballena',
    description: 'La ballena u orca mide 63 metros y representa la conexión de Nazca con el mar.',
    longitude: -75.0906,
    latitude: -14.7183,
    category: 'geoglifo',
    videoId: null
  },
  {
    id: 'flamenco',
    name: 'El Flamenco',
    description: 'El flamenco tiene 300 metros de largo, siendo una de las figuras más grandes.',
    longitude: -75.0833,
    latitude: -14.7028,
    category: 'geoglifo',
    videoId: null
  }
];

const Map3D = () => {
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  
  const [pois, setPois] = useState(DEFAULT_POIS);
  const [selectedPoi, setSelectedPoi] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredPoi, setHoveredPoi] = useState(null);

  // Fetch videos to link with POIs
  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.get(`${API}/videos`, { headers });
        setVideos(response.data || []);
      } catch (error) {
        console.error('Error fetching videos:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [token]);

  // Initialize Leaflet map with satellite imagery
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Load Leaflet CSS
    const leafletCSS = document.createElement('link');
    leafletCSS.rel = 'stylesheet';
    leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(leafletCSS);

    // Load Leaflet JS
    const leafletScript = document.createElement('script');
    leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    leafletScript.onload = () => {
      initMap();
    };
    document.head.appendChild(leafletScript);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const initMap = () => {
    const L = window.L;
    if (!L || !mapContainerRef.current) return;

    // Create map centered on Nazca
    const map = L.map(mapContainerRef.current, {
      center: [NAZCA_CENTER.latitude, NAZCA_CENTER.longitude],
      zoom: 13,
      minZoom: 11,
      maxZoom: 18,
      maxBounds: [
        [NAZCA_BOUNDS.south, NAZCA_BOUNDS.west],
        [NAZCA_BOUNDS.north, NAZCA_BOUNDS.east]
      ],
      maxBoundsViscosity: 1.0
    });

    // Add Google Maps Satellite (higher resolution)
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '&copy; Google Maps'
    }).addTo(map);

    // Add labels layer on top (Google hybrid labels)
    L.tileLayer('https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: ''
    }).addTo(map);

    // Custom marker icon with pulse animation
    const createIcon = (color, isSelected = false) => L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        position: relative;
        width: ${isSelected ? '40px' : '32px'};
        height: ${isSelected ? '40px' : '32px'};
      ">
        ${isSelected ? `<div style="
          position: absolute;
          width: 100%;
          height: 100%;
          background: ${color};
          border-radius: 50%;
          opacity: 0.3;
          animation: pulse 1.5s ease-out infinite;
        "></div>` : ''}
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 4px 15px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      </div>`,
      iconSize: [isSelected ? 40 : 32, isSelected ? 40 : 32],
      iconAnchor: [isSelected ? 20 : 16, isSelected ? 20 : 16]
    });

    // Add CSS animation for pulse
    if (!document.getElementById('marker-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'marker-pulse-style';
      style.textContent = `
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.3; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    // Add markers for each POI
    pois.forEach(poi => {
      const color = poi.category === 'geoglifo' ? '#f59e0b' : 
                   poi.category === 'mirador' ? '#06b6d4' : '#a855f7';
      
      const marker = L.marker([poi.latitude, poi.longitude], {
        icon: createIcon(color)
      }).addTo(map);

      marker.bindPopup(`
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-weight: bold; color: #92400e;">${poi.name}</h3>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #666;">${poi.description}</p>
          <span style="
            display: inline-block;
            padding: 2px 8px;
            background: ${color};
            color: white;
            border-radius: 12px;
            font-size: 11px;
            text-transform: capitalize;
          ">${poi.category}</span>
        </div>
      `);

      marker.on('click', () => {
        setSelectedPoi(poi);
      });
    });

    mapRef.current = map;
    setMapLoaded(true);
  };

  // Fly to POI
  const flyToPoi = (poi) => {
    if (!mapRef.current) return;
    
    mapRef.current.flyTo([poi.latitude, poi.longitude], 16, {
      duration: 1.5
    });
    setSelectedPoi(poi);
  };

  // Reset view to default
  const resetView = () => {
    if (!mapRef.current) return;
    
    mapRef.current.flyTo([NAZCA_CENTER.latitude, NAZCA_CENTER.longitude], 13, {
      duration: 1.5
    });
    setSelectedPoi(null);
  };

  // Zoom controls
  const zoomIn = () => {
    if (!mapRef.current) return;
    mapRef.current.zoomIn();
  };

  const zoomOut = () => {
    if (!mapRef.current) return;
    mapRef.current.zoomOut();
  };

  // Watch video associated with POI
  const watchVideo = (poi) => {
    const linkedVideo = videos.find(v => 
      v.title?.toLowerCase().includes(poi.name.toLowerCase().replace('el ', '').replace('la ', '').replace('las ', '')) ||
      poi.videoId === v.id
    );
    
    if (linkedVideo) {
      navigate(`/video/${linkedVideo.id}`);
    } else {
      toast.info('No hay video 360° disponible para este geoglifo aún');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <Navbar />
      
      <div className="relative h-[calc(100vh-80px)] flex">
        {/* Sidebar */}
        <div 
          className={`absolute md:relative z-20 h-full bg-white/95 backdrop-blur-lg shadow-2xl transition-all duration-300 ${
            sidebarOpen ? 'w-80' : 'w-0 overflow-hidden'
          }`}
        >
          <div className="h-full flex flex-col">
            {/* Sidebar Header */}
            <div className="p-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Líneas de Nazca</h2>
                  <p className="text-amber-100 text-sm">Patrimonio de la Humanidad</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                  className="text-white hover:bg-white/20 md:hidden"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Search/Filter */}
            <div className="p-3 border-b">
              <input
                type="text"
                placeholder="Buscar geoglifo..."
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* POI List */}
            <div className="flex-1 overflow-y-auto">
              {pois.map((poi) => (
                <div
                  key={poi.id}
                  data-testid={`poi-item-${poi.id}`}
                  className={`p-3 border-b cursor-pointer transition-all ${
                    selectedPoi?.id === poi.id 
                      ? 'bg-amber-100 border-l-4 border-l-amber-600' 
                      : 'hover:bg-amber-50'
                  }`}
                  onClick={() => flyToPoi(poi)}
                  onMouseEnter={() => setHoveredPoi(poi)}
                  onMouseLeave={() => setHoveredPoi(null)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      poi.category === 'geoglifo' ? 'bg-amber-500' : 
                      poi.category === 'mirador' ? 'bg-cyan-500' : 'bg-purple-500'
                    } text-white`}>
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{poi.name}</h3>
                      <p className="text-xs text-gray-500 capitalize">{poi.category}</p>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {poi.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats Footer */}
            <div className="p-3 bg-gray-50 border-t">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white rounded-lg p-2">
                  <div className="text-xl font-bold text-amber-600">{pois.length}</div>
                  <div className="text-xs text-gray-500">Geoglifos</div>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <div className="text-xl font-bold text-amber-600">{videos.length}</div>
                  <div className="text-xs text-gray-500">Videos 360°</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Toggle Sidebar Button */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-amber-600 text-white p-2 rounded-r-lg shadow-lg hover:bg-amber-700 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Map Container */}
        <div className="flex-1 relative">
          {/* Map */}
          <div 
            ref={mapContainerRef} 
            className="w-full h-full"
            style={{ background: '#1a1a2e' }}
          />

          {/* Loading overlay */}
          {!mapLoaded && (
            <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-10">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
                <p>Cargando mapa satelital...</p>
              </div>
            </div>
          )}

          {/* Map Controls */}
          <div className="absolute right-4 top-4 flex flex-col gap-2 z-10">
            <Button
              onClick={zoomIn}
              className="bg-white hover:bg-gray-100 text-gray-800 shadow-lg"
              size="icon"
            >
              <ZoomIn className="w-5 h-5" />
            </Button>
            <Button
              onClick={zoomOut}
              className="bg-white hover:bg-gray-100 text-gray-800 shadow-lg"
              size="icon"
            >
              <ZoomOut className="w-5 h-5" />
            </Button>
            <Button
              onClick={resetView}
              className="bg-white hover:bg-gray-100 text-gray-800 shadow-lg"
              size="icon"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
          </div>

          {/* Selected POI Info Panel */}
          {selectedPoi && (
            <div 
              data-testid="poi-detail-panel"
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-6 max-w-lg w-[90%] md:w-auto"
            >
              <button
                onClick={() => setSelectedPoi(null)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${
                  selectedPoi.category === 'geoglifo' ? 'bg-gradient-to-br from-amber-500 to-amber-600' : 
                  selectedPoi.category === 'mirador' ? 'bg-gradient-to-br from-cyan-500 to-cyan-600' : 
                  'bg-gradient-to-br from-purple-500 to-purple-600'
                } text-white shadow-lg`}>
                  <MapPin className="w-7 h-7" />
                </div>
                
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-1">{selectedPoi.name}</h3>
                  <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full capitalize mb-2">
                    {selectedPoi.category}
                  </span>
                  <p className="text-gray-600 text-sm mb-4">{selectedPoi.description}</p>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => watchVideo(selectedPoi)}
                      className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Ver en 360°
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${selectedPoi.latitude}, ${selectedPoi.longitude}`
                        );
                        toast.success('Coordenadas copiadas');
                      }}
                    >
                      <Info className="w-4 h-4 mr-2" />
                      Coordenadas
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute left-4 bottom-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">Leyenda</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span className="text-xs text-gray-600">Geoglifos</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                <span className="text-xs text-gray-600">Miradores</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="text-xs text-gray-600">Museos</span>
              </div>
            </div>
          </div>

          {/* Coordinates Display */}
          <div className="absolute right-4 bottom-4 z-10 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg">
            Nazca, Perú | -14.74°, -75.03°
          </div>
        </div>
      </div>
    </div>
  );
};

export default Map3D;
