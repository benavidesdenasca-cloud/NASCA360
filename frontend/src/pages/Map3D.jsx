import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '@/App';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { MapPin, Info, X, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Plus, Edit, Trash2, Save, Settings, Image } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Nazca Lines area boundaries
const NAZCA_CENTER = {
  longitude: -75.08,  // Centrado más hacia el área con mejor cobertura
  latitude: -14.72,
  height: 15000
};

const NAZCA_BOUNDS = {
  west: -75.20,   
  south: -14.82,  
  east: -74.95,   
  north: -14.62   
};

const CATEGORIES = [
  { value: 'geoglifo', label: 'Geoglifo', color: '#f59e0b' },
  { value: 'mirador', label: 'Mirador', color: '#06b6d4' },
  { value: 'museo', label: 'Museo', color: '#a855f7' }
];

const Map3D = () => {
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const tempMarkerRef = useRef(null); // Marcador temporal para edición
  
  const [pois, setPois] = useState([]);
  const [selectedPoi, setSelectedPoi] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  // 360° Image Viewer State
  const [show360Viewer, setShow360Viewer] = useState(false);
  const [current360Image, setCurrent360Image] = useState(null);
  
  // Admin Panel States
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [editingPoi, setEditingPoi] = useState(null);
  const [poiForm, setPoiForm] = useState({
    name: '',
    description: '',
    longitude: -75.0298,
    latitude: -14.7391,
    altitude: 2000,
    category: 'geoglifo',
    image_url: ''
  });

  // Refs to track current state for map click handler
  const adminPanelOpenRef = useRef(adminPanelOpen);
  const setPoiFormRef = useRef(setPoiForm);

  // Keep refs updated
  useEffect(() => {
    adminPanelOpenRef.current = adminPanelOpen;
  }, [adminPanelOpen]);

  // Check if user is admin (check both role and email for safety)
  const isAdmin = user?.role === 'admin' || user?.email === 'benavidesdenasca@gmail.com';
  const isAdminRef = useRef(isAdmin);
  
  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);
  
  // Debug log
  useEffect(() => {
    console.log('Map3D - User:', user);
    console.log('Map3D - isAdmin:', isAdmin);
  }, [user, isAdmin]);

  // Fetch POIs
  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        // Fetch POIs
        const poisRes = await axios.get(`${API}/api/pois`, { headers });
        setPois(poisRes.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (token) {
      fetchData();
    }
  }, [token]);

  // Initialize Leaflet map
  useEffect(() => {
    // Prevent re-initialization
    if (mapRef.current) return;

    const leafletCSS = document.createElement('link');
    leafletCSS.rel = 'stylesheet';
    leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(leafletCSS);

    const leafletScript = document.createElement('script');
    leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    leafletScript.onload = () => {
      // Double check map isn't already initialized
      if (!mapRef.current && mapContainerRef.current) {
        initMap();
      }
    };
    document.head.appendChild(leafletScript);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when POIs change
  useEffect(() => {
    if (mapRef.current && mapLoaded && pois.length > 0) {
      updateMarkers();
    }
  }, [pois, selectedPoi, mapLoaded]);

  const initMap = () => {
    const L = window.L;
    if (!L || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [NAZCA_CENTER.latitude, NAZCA_CENTER.longitude],
      zoom: 13,
      minZoom: 10,
      maxZoom: 21,
      maxBounds: [
        [NAZCA_BOUNDS.south, NAZCA_BOUNDS.west],
        [NAZCA_BOUNDS.north, NAZCA_BOUNDS.east]
      ],
      maxBoundsViscosity: 0.8,
      zoomControl: false  // Disable default zoom controls, we use custom ones
    });

    // Google Maps Satellite with maximum zoom support
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 22,
      maxNativeZoom: 20,
      attribution: '&copy; Google Maps'
    }).addTo(map);

    // Add pulse animation CSS
    if (!document.getElementById('marker-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'marker-pulse-style';
      style.textContent = `
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .leaflet-marker-icon { transition: all 0.3s ease; }
      `;
      document.head.appendChild(style);
    }

    mapRef.current = map;
    setMapLoaded(true);
    
    // Add click handler for admin to add/edit POIs
    map.on('click', (e) => {
      if (isAdminRef.current && adminPanelOpenRef.current && mapRef.current) {
        const L = window.L;
        
        // Update form coordinates
        setPoiForm(prev => ({
          ...prev,
          latitude: e.latlng.lat,
          longitude: e.latlng.lng
        }));
        
        // Create or move temporary marker
        if (tempMarkerRef.current) {
          tempMarkerRef.current.setLatLng(e.latlng);
        } else {
          // Create a red pulsing marker for the new/edited position
          const tempIcon = L.divIcon({
            className: 'temp-marker',
            html: `<div style="
              position: relative;
              width: 44px;
              height: 44px;
            ">
              <div style="
                position: absolute;
                width: 100%;
                height: 100%;
                background: #ef4444;
                border-radius: 50%;
                opacity: 0.5;
                animation: pulse 1s ease-out infinite;
              "></div>
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 36px;
                height: 36px;
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                border: 4px solid white;
                border-radius: 50%;
                box-shadow: 0 4px 20px rgba(239,68,68,0.6);
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
            </div>`,
            iconSize: [44, 44],
            iconAnchor: [22, 22]
          });
          tempMarkerRef.current = L.marker(e.latlng, { icon: tempIcon, zIndexOffset: 1000 }).addTo(mapRef.current);
        }
        
        toast.info(`Coordenadas actualizadas: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
      }
    });
  };

  const createIcon = (color, isSelected = false) => {
    const L = window.L;
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        position: relative;
        width: ${isSelected ? '44px' : '32px'};
        height: ${isSelected ? '44px' : '32px'};
      ">
        ${isSelected ? `<div style="
          position: absolute;
          width: 100%;
          height: 100%;
          background: ${color};
          border-radius: 50%;
          opacity: 0.4;
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
          cursor: pointer;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      </div>`,
      iconSize: [isSelected ? 44 : 32, isSelected ? 44 : 32],
      iconAnchor: [isSelected ? 22 : 16, isSelected ? 22 : 16]
    });
  };

  const updateMarkers = () => {
    const L = window.L;
    if (!L || !mapRef.current) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // Add markers for each POI
    pois.forEach(poi => {
      const category = CATEGORIES.find(c => c.value === poi.category) || CATEGORIES[0];
      const isSelected = selectedPoi?.id === poi.id;
      
      const marker = L.marker([poi.latitude, poi.longitude], {
        icon: createIcon(category.color, isSelected)
      }).addTo(mapRef.current);

      marker.on('click', () => {
        setSelectedPoi(poi);
        flyToPoi(poi);
      });

      markersRef.current[poi.id] = marker;
    });
  };

  const flyToPoi = (poi) => {
    if (!mapRef.current) return;
    
    // Calculate zoom level based on altitude (viewing height)
    // Permitir zoom alto para ver detalle de las figuras
    const altitude = poi.altitude || 2000;
    let zoomLevel;
    
    if (altitude <= 300) {
      zoomLevel = 18; // Muy cerca - máximo detalle
    } else if (altitude <= 800) {
      zoomLevel = 17; // Cerca
    } else if (altitude <= 1500) {
      zoomLevel = 16; // Medio-cerca
    } else if (altitude <= 3000) {
      zoomLevel = 15; // Medio
    } else {
      zoomLevel = 14; // Lejos
    }
    
    mapRef.current.flyTo([poi.latitude, poi.longitude], zoomLevel, {
      duration: 1.5
    });
    setSelectedPoi(poi);
  };

  const resetView = () => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([NAZCA_CENTER.latitude, NAZCA_CENTER.longitude], 14, { duration: 1.5 });
    setSelectedPoi(null);
  };

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  // Open 360° image viewer
  const view360Image = (poi) => {
    if (poi.image_url) {
      setCurrent360Image({
        url: poi.image_url,
        name: poi.name,
        description: poi.description
      });
      setShow360Viewer(true);
    } else {
      toast.info('No hay imagen 360° disponible para este geoglifo aún');
    }
  };

  // Close 360° viewer
  const close360Viewer = () => {
    setShow360Viewer(false);
    setCurrent360Image(null);
  };

  // Function to clear temporary marker
  const clearTempMarker = () => {
    if (tempMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(tempMarkerRef.current);
      tempMarkerRef.current = null;
    }
  };

  // Admin functions
  const handleSavePoi = async () => {
    // Verificar que hay token antes de intentar guardar
    if (!token) {
      toast.error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      return;
    }
    
    try {
      const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      if (editingPoi) {
        await axios.put(`${API}/api/pois/${editingPoi.id}`, poiForm, { headers });
        toast.success('POI actualizado correctamente');
      } else {
        await axios.post(`${API}/api/pois`, poiForm, { headers });
        toast.success('POI creado correctamente');
      }
      
      // Refresh POIs
      const response = await axios.get(`${API}/api/pois`, { headers });
      setPois(response.data || []);
      
      // Clear temp marker and reset form
      clearTempMarker();
      setAdminPanelOpen(false);
      setEditingPoi(null);
      setPoiForm({
        name: '',
        description: '',
        longitude: -75.0298,
        latitude: -14.7391,
        altitude: 2000,
        category: 'geoglifo',
        image_url: ''
      });
    } catch (error) {
      console.error('Error saving POI:', error);
      if (error.response?.status === 401) {
        toast.error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      } else {
        toast.error('Error al guardar POI: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  const handleEditPoi = (poi) => {
    setEditingPoi(poi);
    setPoiForm({
      name: poi.name,
      description: poi.description,
      longitude: poi.longitude,
      latitude: poi.latitude,
      altitude: poi.altitude || 2000,
      category: poi.category,
      image_url: poi.image_url || ''
    });
    setAdminPanelOpen(true);
  };

  const handleDeletePoi = async (poi) => {
    if (!window.confirm(`¿Eliminar "${poi.name}"?`)) return;
    
    try {
      await axios.delete(`${API}/api/pois/${poi.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('POI eliminado');
      setPois(pois.filter(p => p.id !== poi.id));
      if (selectedPoi?.id === poi.id) setSelectedPoi(null);
    } catch (error) {
      toast.error('Error al eliminar POI');
    }
  };

  const seedDefaultPois = async () => {
    try {
      await axios.post(`${API}/api/pois/seed`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const response = await axios.get(`${API}/api/pois`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPois(response.data || []);
      toast.success('POIs por defecto creados');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al crear POIs');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex flex-col">
      <Navbar />
      
      {/* Admin Panel - Fixed position for overlay */}
      {isAdmin && adminPanelOpen && (
        <div 
          data-testid="admin-panel"
          className="fixed bg-white rounded-xl shadow-2xl p-4 w-80 max-h-[80vh] overflow-y-auto border border-gray-200"
          style={{ left: '330px', top: '84px', zIndex: 9999 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">
              {editingPoi ? 'Editar Figura' : 'Nueva Figura'}
            </h3>
            <button onClick={() => { setAdminPanelOpen(false); setEditingPoi(null); clearTempMarker(); }} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre*</label>
              <input
                type="text"
                data-testid="poi-name-input"
                value={poiForm.name}
                onChange={(e) => setPoiForm({ ...poiForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                placeholder="El Colibrí"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción*</label>
              <textarea
                data-testid="poi-description-input"
                value={poiForm.description}
                onChange={(e) => setPoiForm({ ...poiForm, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                rows={3}
                placeholder="Descripción de la figura..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Latitud*</label>
                <input
                  type="number"
                  step="0.0001"
                  data-testid="poi-latitude-input"
                  value={poiForm.latitude}
                  onChange={(e) => setPoiForm({ ...poiForm, latitude: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Longitud*</label>
                <input
                  type="number"
                  step="0.0001"
                  data-testid="poi-longitude-input"
                  value={poiForm.longitude}
                  onChange={(e) => setPoiForm({ ...poiForm, longitude: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Altura de visión (metros)</label>
              <input
                type="number"
                data-testid="poi-altitude-input"
                value={poiForm.altitude}
                onChange={(e) => setPoiForm({ ...poiForm, altitude: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                placeholder="2000"
              />
              <p className="text-xs text-gray-400 mt-1">A mayor altura, más alejado se ve el mapa al seleccionar</p>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
              <select
                data-testid="poi-category-select"
                value={poiForm.category}
                onChange={(e) => setPoiForm({ ...poiForm, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">URL Imagen 360°</label>
              <input
                data-testid="poi-image-url-input"
                type="url"
                value={poiForm.image_url}
                onChange={(e) => setPoiForm({ ...poiForm, image_url: e.target.value })}
                placeholder="https://ejemplo.com/imagen360.jpg"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
              />
              {poiForm.image_url && (
                <div className="mt-2 rounded-lg overflow-hidden border">
                  <img 
                    src={poiForm.image_url} 
                    alt="Preview" 
                    className="w-full h-20 object-cover"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
              )}
            </div>
            
            <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
              Tip: Haz clic en el mapa para seleccionar coordenadas
            </p>
            
            <div className="flex gap-2">
              <Button 
                data-testid="save-poi-btn"
                onClick={handleSavePoi}
                disabled={!poiForm.name || !poiForm.description}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingPoi ? 'Actualizar' : 'Guardar'}
              </Button>
              {editingPoi && (
                <Button 
                  data-testid="cancel-edit-btn"
                  variant="outline"
                  onClick={() => {
                    setEditingPoi(null);
                    clearTempMarker();
                    setPoiForm({
                      name: '',
                      description: '',
                      longitude: -75.0298,
                      latitude: -14.7391,
                      altitude: 2000,
                      category: 'geoglifo',
                      image_url: ''
                    });
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Add padding-top to account for fixed navbar */}
      <div className="relative flex-1 flex" style={{ marginTop: '64px', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        {/* Sidebar - POI List */}
        <div className={`absolute md:relative z-20 bg-white/95 backdrop-blur-lg shadow-2xl transition-all duration-300 ${
          sidebarOpen ? 'w-80' : 'w-0 overflow-hidden'
        }`} style={{ height: '100%' }}>
          <div className="h-full flex flex-col overflow-hidden">
            {/* Sidebar Header - Fixed */}
            <div className="flex-shrink-0 p-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Líneas de Nazca</h2>
                  <p className="text-amber-100 text-sm">
                    {isAdmin ? '🔧 Modo Administrador' : 'Patrimonio de la Humanidad'}
                  </p>
                </div>
                <div className="flex gap-1">
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAdminPanelOpen(!adminPanelOpen);
                        if (!adminPanelOpen) {
                          setEditingPoi(null);
                          setPoiForm({
                            name: '',
                            description: '',
                            longitude: -75.0298,
                            latitude: -14.7391,
                            altitude: 2000,
                            category: 'geoglifo',
                            image_url: ''
                          });
                        }
                      }}
                      className="text-white hover:bg-white/20"
                      title="Panel de Administración"
                    >
                      <Settings className="w-5 h-5" />
                    </Button>
                  )}
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
            </div>

            {/* POI List - Scrollable independently */}
            <div 
              className="flex-1 overflow-y-auto overscroll-contain"
              style={{ maxHeight: 'calc(100vh - 64px - 80px - 80px)' }}
              onWheel={(e) => e.stopPropagation()}
            >
              {pois.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <p>No hay figuras registradas</p>
                  {isAdmin && (
                    <Button onClick={seedDefaultPois} className="mt-2" size="sm">
                      Crear POIs por defecto
                    </Button>
                  )}
                </div>
              ) : (
                pois.map((poi) => {
                  const category = CATEGORIES.find(c => c.value === poi.category) || CATEGORIES[0];
                  return (
                    <div
                      key={poi.id}
                      data-testid={`poi-item-${poi.id}`}
                      className={`p-3 border-b cursor-pointer transition-all group ${
                        selectedPoi?.id === poi.id 
                          ? 'bg-amber-100 border-l-4 border-l-amber-600' 
                          : 'hover:bg-amber-50'
                      }`}
                      onClick={() => flyToPoi(poi)}
                    >
                      <div className="flex items-start gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                          style={{ backgroundColor: category.color }}
                        >
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-gray-800 truncate flex-1">{poi.name}</h3>
                            {isAdmin && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  data-testid={`edit-poi-${poi.id}`}
                                  onClick={(e) => { e.stopPropagation(); handleEditPoi(poi); }}
                                  className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white shadow-sm transition-colors"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  data-testid={`delete-poi-${poi.id}`}
                                  onClick={(e) => { e.stopPropagation(); handleDeletePoi(poi); }}
                                  className="p-2 bg-red-500 hover:bg-red-600 rounded-lg text-white shadow-sm transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 capitalize">{category.label}</p>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{poi.description}</p>
                          <p className="text-xs text-gray-400 mt-1">Altura visión: {poi.altitude || 2000}m</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Stats Footer - Fixed at bottom */}
            <div className="flex-shrink-0 p-3 bg-gray-50 border-t">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white rounded-lg p-2">
                  <div className="text-xl font-bold text-amber-600">{pois.length}</div>
                  <div className="text-xs text-gray-500">Figuras</div>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <div className="text-xl font-bold text-amber-600">{pois.filter(p => p.image_url).length}</div>
                  <div className="text-xs text-gray-500">Con Foto 360°</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Toggle Sidebar Button */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-amber-600 text-white p-2 rounded-r-lg shadow-lg hover:bg-amber-700"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Map Container */}
        <div className="flex-1 relative">
          <div ref={mapContainerRef} className="w-full h-full" style={{ background: '#c4a76e' }} />

          {/* Loading overlay */}
          {!mapLoaded && (
            <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-10">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
                <p>Cargando mapa satelital...</p>
              </div>
            </div>
          )}

          {/* Admin Add Button and Map Controls - Top left of map area */}
          <div className="absolute left-4 top-4 z-[9999] flex items-center gap-2">
            {isAdmin && !adminPanelOpen && (
              <Button
                onClick={() => setAdminPanelOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 shadow-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Figura
              </Button>
            )}
            
            <div className="flex gap-1 bg-white/80 backdrop-blur-sm p-1 rounded-lg shadow-lg">
              <Button onClick={zoomIn} className="bg-white hover:bg-gray-100 text-gray-800 border" size="icon" title="Acercar">
                <ZoomIn className="w-5 h-5" />
              </Button>
              <Button onClick={zoomOut} className="bg-white hover:bg-gray-100 text-gray-800 border" size="icon" title="Alejar">
                <ZoomOut className="w-5 h-5" />
              </Button>
              <Button onClick={resetView} className="bg-white hover:bg-gray-100 text-gray-800 border" size="icon" title="Restablecer">
                <RotateCcw className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Selected POI Info Panel */}
          {selectedPoi && !adminPanelOpen && (
            <div 
              data-testid="poi-detail-panel"
              className="absolute top-20 right-4 z-[9998] bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-6 max-w-md"
            >
              <button
                onClick={() => setSelectedPoi(null)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-start gap-4">
                <div 
                  className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-white shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${CATEGORIES.find(c => c.value === selectedPoi.category)?.color || '#f59e0b'} 0%, ${CATEGORIES.find(c => c.value === selectedPoi.category)?.color || '#f59e0b'}dd 100%)` }}
                >
                  <MapPin className="w-7 h-7" />
                </div>
                
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-1">{selectedPoi.name}</h3>
                  <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full capitalize mb-2">
                    {CATEGORIES.find(c => c.value === selectedPoi.category)?.label || selectedPoi.category}
                  </span>
                  <p className="text-gray-600 text-sm mb-2">{selectedPoi.description}</p>
                  <p className="text-xs text-gray-400 mb-4">Altura de visión: {selectedPoi.altitude}m</p>
                  
                  {/* Thumbnail of 360 image if available */}
                  {selectedPoi.image_url && (
                    <div className="mb-3 rounded-lg overflow-hidden border">
                      <img 
                        src={selectedPoi.image_url} 
                        alt={selectedPoi.name}
                        className="w-full h-24 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => view360Image(selectedPoi)}
                      />
                    </div>
                  )}
                  
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => view360Image(selectedPoi)}
                      className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                      disabled={!selectedPoi.image_url}
                    >
                      <Image className="w-4 h-4 mr-2" />
                      Ver en 360°
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(`${selectedPoi.latitude}, ${selectedPoi.longitude}`);
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
              {CATEGORIES.map(cat => (
                <div key={cat.value} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                  <span className="text-xs text-gray-600">{cat.label}</span>
                </div>
              ))}
              {showNazcaLines && (
                <div className="flex items-center gap-2 pt-1 border-t border-gray-200 mt-1">
                  <div className="w-6 h-0.5 bg-yellow-500"></div>
                  <span className="text-xs text-gray-600">Trazos Ministerio</span>
                </div>
              )}
            </div>
          </div>

          {/* Coordinates Display */}
          <div className="absolute right-4 bottom-4 z-10 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg">
            Nazca, Perú | -14.74°, -75.03°
          </div>
        </div>
      </div>
      
      {/* 360° Image Viewer Modal */}
      {show360Viewer && current360Image && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white text-xl font-bold">{current360Image.name}</h2>
                <p className="text-white/70 text-sm">{current360Image.description}</p>
              </div>
              <Button
                onClick={close360Viewer}
                variant="ghost"
                className="text-white hover:bg-white/20"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>
          
          {/* 360° Viewer - Using iframe with Pannellum CDN and proxy */}
          <div className="flex-1 relative">
            <iframe
              src={`https://cdn.pannellum.org/2.5/pannellum.htm#panorama=${encodeURIComponent(`${API}/api/image-proxy?url=${encodeURIComponent(current360Image.url)}`)}&autoLoad=true&autoRotate=-2`}
              className="w-full h-full border-0"
              allowFullScreen
              title="360° Viewer"
            />
          </div>
          
          {/* Footer with controls hint */}
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4">
            <p className="text-white/70 text-sm text-center">
              Arrastra para mirar alrededor • Usa la rueda del mouse para zoom
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Map3D;
