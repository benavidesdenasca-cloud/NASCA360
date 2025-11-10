import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Check, Crown, Star } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Subscription = () => {
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const handleSubscribe = async (planId) => {
    if (!user) {
      toast.error('Debes iniciar sesión para suscribirte');
      navigate('/auth/login');
      return;
    }

    try {
      setLoading(true);
      setSelectedPlan(planId);
      const originUrl = window.location.origin;
      
      const response = await axios.post(
        `${API}/subscriptions/checkout`,
        {
          plan_type: planId,
          origin_url: originUrl
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      // Redirect to Stripe checkout
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Error al iniciar el proceso de pago');
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  const plans = [
    {
      id: 'daily',
      name: 'Plan Diario',
      subtitle: 'Perfecto para visitas rápidas',
      price: '$20',
      period: '/día',
      duration: '24 horas desde la compra',
      features: [
        'Acceso completo a todos los videos 360°',
        'Contenido exclusivo',
        'Sin anuncios'
      ],
      cta: 'Suscribirme por 1 día',
      highlighted: false,
      badge: null
    },
    {
      id: 'weekly',
      name: 'Plan Semanal',
      subtitle: 'Más Popular',
      price: '$100',
      period: '/semana',
      duration: '7 días desde la compra',
      features: [
        'Acceso completo a todos los videos 360°',
        'Contenido exclusivo',
        'Sin anuncios',
        'Soporte prioritario'
      ],
      cta: 'Suscribirme por 1 semana',
      highlighted: true,
      badge: 'Más Popular'
    },
    {
      id: 'monthly',
      name: 'Plan Mensual',
      subtitle: 'Ideal para exploradores frecuentes',
      price: '$200',
      period: '/mes',
      duration: '30 días desde la compra',
      features: [
        'Acceso completo a todos los videos 360°',
        'Contenido exclusivo',
        'Sin anuncios'
      ],
      cta: 'Suscribirme por 1 mes',
      highlighted: false,
      badge: null
    },
    {
      id: 'annual',
      name: 'Plan Anual',
      subtitle: 'Para verdaderos exploradores',
      price: '$500',
      period: '/año',
      duration: '12 meses desde la compra',
      features: [
        'Acceso completo y permanente durante un año a todos los videos 360°',
        'Contenido exclusivo mensual',
        'Sin anuncios'
      ],
      cta: 'Suscribirme por 1 año',
      highlighted: false,
      badge: 'Mejor Valor'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <Navbar />
      
      <div className="pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div data-testid="subscription-header" className="text-center mb-16">
            <h1 className="text-5xl font-bold text-amber-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
              Elige Tu Plan
            </h1>
            <p className="text-xl text-gray-700 mb-2">
              Desbloquea todas las experiencias 360° de las Líneas de Nasca
            </p>
            <p className="text-lg text-gray-600">
              Vive el sobrevuelo inmersivo y accede a contenido exclusivo solo para suscriptores
            </p>
          </div>

          {/* Plans Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-12">
            {plans.map((plan) => (
              <div
                key={plan.id}
                data-testid={`plan-${plan.id}`}
                className={`card-peru p-6 relative flex flex-col h-full ${
                  plan.highlighted ? 'ring-4 ring-amber-500 shadow-2xl transform scale-105' : ''
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-amber-600 to-orange-700 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center">
                    {plan.badge === 'Más Popular' ? (
                      <Star className="w-4 h-4 mr-1" />
                    ) : (
                      <Crown className="w-4 h-4 mr-1" />
                    )}
                    {plan.badge}
                  </div>
                )}

                <div className="text-center mb-4 flex-grow">
                  <h3 className="text-2xl font-bold text-amber-900 mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">{plan.subtitle}</p>
                  <div className="text-4xl font-bold text-amber-900 mb-1">
                    {plan.price}
                    <span className="text-base text-gray-600">{plan.period}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">{plan.duration}</p>
                </div>

                <ul className="space-y-3 mb-6 flex-grow">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm">
                      <Check className="w-4 h-4 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  data-testid={`subscribe-${plan.id}-button`}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading && selectedPlan === plan.id}
                  className={`w-full py-4 text-base rounded-full ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-amber-600 to-orange-700 text-white hover:scale-105'
                      : 'bg-white text-amber-900 border-2 border-amber-700 hover:bg-amber-50'
                  }`}
                >
                  {loading && selectedPlan === plan.id ? 'Procesando...' : plan.cta}
                </Button>
              </div>
            ))}
          </div>

          {/* Info Box */}
          <div className="max-w-4xl mx-auto">
            <div className="glass rounded-2xl p-8 bg-gradient-to-r from-amber-100 to-orange-100">
              <h3 className="text-2xl font-bold text-amber-900 mb-4 text-center">
                ¿Por qué suscribirte a Nazca360?
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold text-amber-900 mb-2">✨ Contenido Exclusivo</h4>
                  <p className="text-gray-700 text-sm">
                    Acceso completo a todos nuestros videos 360° de las Líneas de Nasca, Palpa y museo virtual
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-amber-900 mb-2">🎥 Calidad Premium</h4>
                  <p className="text-gray-700 text-sm">
                    Videos en alta resolución compatibles con visores VR y navegación 360°
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-amber-900 mb-2">🚫 Sin Anuncios</h4>
                  <p className="text-gray-700 text-sm">
                    Disfruta de una experiencia inmersiva sin interrupciones
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-amber-900 mb-2">🌍 Impacto Positivo</h4>
                  <p className="text-gray-700 text-sm">
                    Tu suscripción ayuda a preservar el patrimonio cultural del Perú
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div data-testid="subscription-faq" className="max-w-3xl mx-auto mt-16">
            <h2 className="text-3xl font-bold text-center text-amber-900 mb-8">
              Preguntas Frecuentes
            </h2>
            <div className="space-y-6">
              <div className="glass rounded-xl p-6">
                <h3 className="font-bold text-lg text-amber-900 mb-2">
                  ¿Cuándo se activa mi suscripción?
                </h3>
                <p className="text-gray-700">
                  Tu suscripción se activa inmediatamente después de confirmar el pago. Tendrás acceso instantáneo a todo el contenido.
                </p>
              </div>
              <div className="glass rounded-xl p-6">
                <h3 className="font-bold text-lg text-amber-900 mb-2">
                  ¿Qué métodos de pago aceptan?
                </h3>
                <p className="text-gray-700">
                  Aceptamos todas las tarjetas de crédito y débito principales a través de Stripe, nuestra plataforma de pagos segura.
                </p>
              </div>
              <div className="glass rounded-xl p-6">
                <h3 className="font-bold text-lg text-amber-900 mb-2">
                  ¿Puedo cambiar de plan?
                </h3>
                <p className="text-gray-700">
                  Sí, puedes actualizar a un plan superior en cualquier momento. El nuevo plan se activará inmediatamente.
                </p>
              </div>
              <div className="glass rounded-xl p-6">
                <h3 className="font-bold text-lg text-amber-900 mb-2">
                  ¿Necesito equipo especial?
                </h3>
                <p className="text-gray-700">
                  No, puedes ver los videos en cualquier dispositivo. Para una experiencia VR completa, puedes usar visores como Meta Quest o reservar nuestra cabina VR.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
