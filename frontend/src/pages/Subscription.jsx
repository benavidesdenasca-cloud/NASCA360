import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Check, Crown } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Subscription = () => {
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (plan) => {
    if (!user) {
      toast.error('Debes iniciar sesión para suscribirte');
      navigate('/auth/login');
      return;
    }

    if (plan === 'basic') {
      toast.info('Ya tienes acceso al plan básico');
      navigate('/gallery');
      return;
    }

    try {
      setLoading(true);
      const originUrl = window.location.origin;
      
      const response = await axios.post(
        `${API}/subscriptions/checkout`,
        {
          plan_type: plan,
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
    }
  };

  const plans = [
    {
      id: 'basic',
      name: 'Plan Básico',
      price: 'Gratis',
      description: 'Perfecto para explorar',
      features: [
        'Acceso a 3 videos 360° gratuitos',
        'Líneas de Nasca básicas',
        'Calidad HD',
        'Compatible con todos los dispositivos'
      ],
      cta: 'Empezar Gratis',
      highlighted: false
    },
    {
      id: 'premium',
      name: 'Plan Premium',
      price: '$29.99',
      period: '/año',
      description: 'Acceso total sin límites',
      features: [
        'Acceso a TODOS los videos 360°',
        'Líneas de Nasca y Palpa completas',
        'Museo Virtual Nasca360',
        'Calidad 4K',
        'Contenido exclusivo mensual',
        'Sin anuncios',
        'Soporte prioritario',
        'Descuento en reservas VR'
      ],
      cta: 'Suscribirme Ahora',
      highlighted: true
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
            <p className="text-xl text-gray-700">
              Desbloquea todas las experiencias 360° de las Líneas de Nasca
            </p>
          </div>

          {/* Plans */}
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                data-testid={`plan-${plan.id}`}
                className={`card-peru p-8 relative ${
                  plan.highlighted ? 'ring-4 ring-amber-500 shadow-2xl' : ''
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-amber-600 to-orange-700 text-white px-6 py-2 rounded-full text-sm font-semibold flex items-center">
                    <Crown className="w-4 h-4 mr-2" />
                    Más Popular
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-amber-900 mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-gray-600 mb-4">{plan.description}</p>
                  <div className="text-5xl font-bold text-amber-900 mb-2">
                    {plan.price}
                    {plan.period && (
                      <span className="text-lg text-gray-600">{plan.period}</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  data-testid={`subscribe-${plan.id}-button`}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading}
                  className={`w-full py-6 text-lg rounded-full ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-amber-600 to-orange-700 text-white hover:scale-105'
                      : 'bg-white text-amber-900 border-2 border-amber-700 hover:bg-amber-50'
                  }`}
                >
                  {loading ? 'Procesando...' : plan.cta}
                </Button>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div data-testid="subscription-faq" className="max-w-3xl mx-auto mt-16">
            <h2 className="text-3xl font-bold text-center text-amber-900 mb-8">
              Preguntas Frecuentes
            </h2>
            <div className="space-y-6">
              <div className="glass rounded-xl p-6">
                <h3 className="font-bold text-lg text-amber-900 mb-2">
                  ¿Puedo cancelar en cualquier momento?
                </h3>
                <p className="text-gray-700">
                  Sí, puedes cancelar tu suscripción en cualquier momento desde tu dashboard. No hay contratos ni penalizaciones.
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
                  ¿Necesito equipo especial?
                </h3>
                <p className="text-gray-700">
                  No, puedes ver los videos en cualquier dispositivo con navegador web. Para una experiencia VR completa, puedes reservar nuestra cabina con Meta Quest.
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