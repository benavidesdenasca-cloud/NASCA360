import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '@/App';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { MapPin, Eye, Info, X, ChevronLeft, ChevronRight, Play, Compass, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

// Cesium imports
import { Viewer, Entity, PointGraphics, BillboardGraphics, LabelGraphics, Camera, CameraFlyTo } from 'resium';
import { 
  Ion, 
  Cartesian3, 
  Color, 
  VerticalOrigin, 
  HorizontalOrigin,
  Math as CesiumMath,
  Rectangle,
  HeadingPitchRange,
  Cartographic
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

const API = process.env.REACT_APP_BACKEND_URL;

// Cesium Ion access token (free tier)
Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWMxMzcyYy0zZjJkLTQwODctODNlNi01MDRkZTUzMjU2NmMiLCJpZCI6MjU5LCJpYXQiOjE0ODkyOTM2OTR9.EuHMR1Lti0BjJkYNjsxO4bDxoWLbNQoNEhJLq8I-SLA';

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
    id: 'colibrí',
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
  const viewerRef = useRef(null);
  
  const [pois, setPois] = useState(DEFAULT_POIS);
  const [selectedPoi, setSelectedPoi] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cameraPosition, setCameraPosition] = useState(NAZCA_CENTER);
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

  // Restrict camera to Nazca area
  const restrictCamera = () => {
    if (!viewerRef.current?.cesiumElement) return;
    
    const viewer = viewerRef.current.cesiumElement;
    const camera = viewer.camera;
    const position = camera.positionCartographic;
    
    let needsUpdate = false;
    let newLon = position.longitude;
    let newLat = position.latitude;
    let newHeight = position.height;
    
    // Clamp longitude
    if (CesiumMath.toDegrees(position.longitude) < NAZCA_BOUNDS.west) {
      newLon = CesiumMath.toRadians(NAZCA_BOUNDS.west);
      needsUpdate = true;
    } else if (CesiumMath.toDegrees(position.longitude) > NAZCA_BOUNDS.east) {
      newLon = CesiumMath.toRadians(NAZCA_BOUNDS.east);
      needsUpdate = true;
    }
    
    // Clamp latitude
    if (CesiumMath.toDegrees(position.latitude) < NAZCA_BOUNDS.south) {
      newLat = CesiumMath.toRadians(NAZCA_BOUNDS.south);
      needsUpdate = true;
    } else if (CesiumMath.toDegrees(position.latitude) > NAZCA_BOUNDS.north) {
      newLat = CesiumMath.toRadians(NAZCA_BOUNDS.north);
      needsUpdate = true;
    }
    
    // Clamp height
    if (position.height < 500) {
      newHeight = 500;
      needsUpdate = true;
    } else if (position.height > 50000) {
      newHeight = 50000;
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      camera.setView({
        destination: Cartesian3.fromRadians(newLon, newLat, newHeight)
      });
    }
  };

  // Fly to POI
  const flyToPoi = (poi) => {
    if (!viewerRef.current?.cesiumElement) return;
    
    const viewer = viewerRef.current.cesiumElement;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(poi.longitude, poi.latitude, 2000),
      duration: 2,
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-45),
        roll: 0
      }
    });
    setSelectedPoi(poi);
  };

  // Reset view to default
  const resetView = () => {
    if (!viewerRef.current?.cesiumElement) return;
    
    const viewer = viewerRef.current.cesiumElement;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        NAZCA_CENTER.longitude,
        NAZCA_CENTER.latitude,
        NAZCA_CENTER.height
      ),
      duration: 2
    });
    setSelectedPoi(null);
  };

  // Zoom controls
  const zoomIn = () => {
    if (!viewerRef.current?.cesiumElement) return;
    const viewer = viewerRef.current.cesiumElement;
    viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.3);
  };

  const zoomOut = () => {
    if (!viewerRef.current?.cesiumElement) return;
    const viewer = viewerRef.current.cesiumElement;
    viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.3);
  };

  // Watch video associated with POI
  const watchVideo = (poi) => {
    const linkedVideo = videos.find(v => 
      v.title?.toLowerCase().includes(poi.name.toLowerCase()) ||
      poi.videoId === v.id
    );
    
    if (linkedVideo) {
      navigate(`/video/${linkedVideo.id}`);
    } else {
      toast.info('No hay video 360° disponible para este geoglifo aún');
    }
  };

  // Get category color
  const getCategoryColor = (category) => {
    switch (category) {
      case 'geoglifo': return Color.GOLD;
      case 'mirador': return Color.CYAN;
      case 'museo': return Color.MAGENTA;
      default: return Color.WHITE;
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
          {/* Cesium Viewer */}
          <Viewer
            ref={viewerRef}
            full
            timeline={false}
            animation={false}
            homeButton={false}
            sceneModePicker={false}
            baseLayerPicker={false}
            navigationHelpButton={false}
            geocoder={false}
            fullscreenButton={false}
            infoBox={false}
            selectionIndicator={false}
            creditContainer={document.createElement('div')}
            onCameraMoveEnd={restrictCamera}
          >
            {/* Initial Camera Position */}
            <Camera
              defaultLookAt={{
                center: Cartesian3.fromDegrees(
                  NAZCA_CENTER.longitude,
                  NAZCA_CENTER.latitude,
                  0
                ),
                range: new HeadingPitchRange(
                  CesiumMath.toRadians(0),
                  CesiumMath.toRadians(-45),
                  NAZCA_CENTER.height
                )
              }}
            />

            {/* POI Markers */}
            {pois.map((poi) => (
              <Entity
                key={poi.id}
                position={Cartesian3.fromDegrees(poi.longitude, poi.latitude, 100)}
                name={poi.name}
                description={poi.description}
                onClick={() => {
                  setSelectedPoi(poi);
                  flyToPoi(poi);
                }}
              >
                <PointGraphics
                  pixelSize={selectedPoi?.id === poi.id || hoveredPoi?.id === poi.id ? 18 : 12}
                  color={getCategoryColor(poi.category)}
                  outlineColor={Color.WHITE}
                  outlineWidth={2}
                />
                <LabelGraphics
                  text={poi.name}
                  font="14px sans-serif"
                  fillColor={Color.WHITE}
                  outlineColor={Color.BLACK}
                  outlineWidth={2}
                  style={2} // FILL_AND_OUTLINE
                  verticalOrigin={VerticalOrigin.BOTTOM}
                  pixelOffset={{ x: 0, y: -15 }}
                  show={selectedPoi?.id === poi.id || hoveredPoi?.id === poi.id}
                />
              </Entity>
            ))}
          </Viewer>

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
