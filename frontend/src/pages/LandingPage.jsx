import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Play, Calendar, Leaf, Eye } from 'lucide-react';
import Navbar from '@/components/Navbar';

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <Navbar />
      
      {/* Hero Section */}
      <section 
        data-testid="hero-section"
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="absolute inset-0 hero-gradient"></div>
        
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          <div className="mb-8 flex justify-center">
            <img 
              src="/logo.jpg" 
              alt="Nazca360 Logo" 
              className="h-32 sm:h-40 lg:h-48 w-auto object-contain drop-shadow-2xl"
            />
          </div>
          <h1 
            data-testid="hero-title"
            className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 drop-shadow-2xl"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Nazca360
          </h1>
          <p 
            data-testid="hero-subtitle"
            className="text-xl sm:text-2xl text-white/90 mb-8 max-w-3xl mx-auto"
          >
            Descubre las misteriosas Líneas de Nasca y Palpa en una experiencia inmersiva 360° que te transportará a través del tiempo
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              data-testid="explore-button"
              onClick={() => navigate('/gallery')}
              className="btn-peru text-lg px-8 py-6 rounded-full shadow-2xl hover:scale-105"
            >
              <Eye className="mr-2" />
              Explorar Líneas
            </Button>
            {!user && (
              <Button
                data-testid="login-button"
                onClick={() => navigate('/auth/login')}
                variant="outline"
                className="text-lg px-8 py-6 rounded-full bg-white/90 hover:bg-white border-2 border-amber-700 text-amber-900 hover:scale-105"
              >
                Iniciar Sesión
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section data-testid="features-section" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-16 text-amber-900">
            Una Experiencia Única
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div data-testid="feature-card-explore" className="card-peru p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-600 to-orange-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <Eye className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-amber-900">Explora en 360°</h3>
              <p className="text-gray-700">
                Experimenta las Líneas de Nasca como nunca antes. Vuela sobre los geoglifos en una experiencia inmersiva de realidad virtual.
              </p>
            </div>

            <div data-testid="feature-card-subscribe" className="card-peru p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-600 to-orange-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <Play className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-amber-900">Contenido Exclusivo</h3>
              <p className="text-gray-700">
                Accede a nuestra colección completa de videos 360°, incluyendo las Líneas de Palpa y nuestro museo virtual.
              </p>
            </div>

            <div data-testid="feature-card-reserve" className="card-peru p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-600 to-orange-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-amber-900">Cabina VR Física</h3>
              <p className="text-gray-700">
                Reserva tu sesión en nuestra cabina VR para vivir la experiencia completa con visores Meta Quest.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Subscribe CTA */}
      <section data-testid="subscribe-cta" className="py-24 px-4 bg-gradient-to-r from-amber-100 to-orange-100">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-amber-900">
            Suscríbete Ahora
          </h2>
          <p className="text-xl text-gray-700 mb-8">
            Obtén acceso ilimitado a todos los contenidos y experiencias 360°
          </p>
          <Button
            data-testid="subscribe-button"
            onClick={() => navigate('/subscription')}
            className="btn-peru text-lg px-10 py-6 rounded-full hover:scale-105"
          >
            Ver Planes
          </Button>
        </div>
      </section>

      {/* Impact Section */}
      <section data-testid="impact-section" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="glass rounded-3xl p-12">
            <div className="flex items-center justify-center mb-8">
              <Leaf className="w-12 h-12 text-green-700 mr-4" />
              <h2 className="text-4xl font-bold text-amber-900">Impacto Ambiental Positivo</h2>
            </div>
            <p className="text-xl text-gray-700 text-center max-w-3xl mx-auto">
              Al experimentar las Líneas de Nasca virtualmente, reduces el impacto ambiental del turismo físico, 
              ayudando a preservar estos tesoros ancestrales para las futuras generaciones.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-amber-900 to-orange-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-4 flex justify-center">
            <img 
              src="/logo.jpg" 
              alt="Nazca360 Logo" 
              className="h-16 w-auto object-contain opacity-90"
            />
          </div>
          <h3 className="text-2xl font-bold mb-4">Nazca360</h3>
          <p className="text-amber-200 mb-4">
            Preservando y compartiendo el patrimonio cultural del Perú
          </p>
          <p className="text-amber-300 text-sm">
            © 2025 Nazca360. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;