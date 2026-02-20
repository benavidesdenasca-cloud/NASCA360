import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AuthContext } from '@/App';
import { Check, Crown, Shield, Globe, Headphones, Star, ArrowRight, Eye, EyeOff } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID;

const PLANS = [
  {
    id: '1_month',
    name: '1 Mes',
    price: 20,
    originalPrice: null,
    duration: 30,
    popular: false,
    savings: null
  },
  {
    id: '3_months',
    name: '3 Meses',
    price: 55,
    originalPrice: 60,
    duration: 90,
    popular: true,
    savings: 5
  },
  {
    id: '6_months',
    name: '6 Meses',
    price: 100,
    originalPrice: 120,
    duration: 180,
    popular: false,
    savings: 20
  },
  {
    id: '12_months',
    name: '12 Meses',
    price: 200,
    originalPrice: 240,
    duration: 365,
    popular: false,
    savings: 40
  }
];

const FEATURES = [
  { icon: Globe, text: 'Acceso ilimitado a videos 360°' },
  { icon: Crown, text: 'Contenido exclusivo de las Líneas de Nazca' },
  { icon: Headphones, text: 'Experiencia VR inmersiva' },
  { icon: Shield, text: 'Streaming en alta calidad 4K' }
];

const Subscription = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, token, setUser, setToken } = useContext(AuthContext);
  
  const [selectedPlan, setSelectedPlan] = useState('3_months');
  const [step, setStep] = useState(user ? 'plan' : 'register'); // 'register' or 'plan'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasExistingSubscription, setHasExistingSubscription] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Check for cancelled payment
  useEffect(() => {
    if (searchParams.get('cancelled')) {
      toast.error('Pago cancelado. Puedes intentar de nuevo cuando quieras.');
    }
  }, [searchParams]);

  // Check if user has existing subscription (for renewal vs new subscription)
  useEffect(() => {
    const checkSubscription = async () => {
      if (user && token) {
        try {
          const response = await axios.get(`${API}/subscription/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          // User has subscription if they had one before (even if expired)
          // Check if subscription data exists
          setHasExistingSubscription(response.data.subscription !== null);
        } catch (error) {
          console.error('Error checking subscription:', error);
          setHasExistingSubscription(false);
        }
      }
    };
    checkSubscription();
  }, [user, token]);

  // If user is logged in, show renewal options
  useEffect(() => {
    if (user) {
      setStep('plan');
    }
  }, [user]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const validateForm = () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Por favor completa todos los campos');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Por favor ingresa un email válido');
      return false;
    }
    
    if (formData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return false;
    }
    
    return true;
  };

  const proceedToPayment = () => {
    if (!user && !validateForm()) return;
    setStep('plan');
  };

  const createPayPalOrder = async () => {
    try {
      setLoading(true);
      
      // Determine which endpoint to use:
      // - User logged in WITH existing subscription -> renew
      // - User logged in WITHOUT subscription (e.g., Google Auth new user) -> create new subscription for existing user
      // - No user -> create order with registration
      let endpoint;
      let payload;
      let headers = {};
      
      if (user && hasExistingSubscription) {
        // Renew existing subscription
        endpoint = `${API}/paypal/renew-subscription`;
        payload = { plan_type: selectedPlan, origin_url: window.location.origin };
        headers = { Authorization: `Bearer ${token}` };
      } else if (user && !hasExistingSubscription) {
        // User logged in (e.g., via Google) but no subscription yet
        // Use a new endpoint for existing users to create their first subscription
        endpoint = `${API}/paypal/create-subscription-for-user`;
        payload = { plan_type: selectedPlan, origin_url: window.location.origin };
        headers = { Authorization: `Bearer ${token}` };
      } else {
        // New user registration + subscription
        endpoint = `${API}/paypal/create-order`;
        payload = {
          plan_type: selectedPlan,
          email: formData.email,
          name: formData.name,
          password: formData.password,
          origin_url: window.location.origin
        };
      }
      
      const response = await axios.post(endpoint, payload, { headers });
      
      if (response.data.approval_url) {
        // Redirect to PayPal
        window.location.href = response.data.approval_url;
      }
      
      return response.data.payment_id;
    } catch (error) {
      console.error('Error creating order:', error);
      // Handle Pydantic validation errors (array of objects) vs string errors
      let errorMessage = 'Error al crear el pago';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          errorMessage = detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
        } else if (typeof detail === 'object') {
          errorMessage = detail.msg || detail.message || JSON.stringify(detail);
        }
      }
      toast.error(errorMessage);
      setLoading(false);
      throw error;
    }
  };

  const selectedPlanData = PLANS.find(p => p.id === selectedPlan);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <Navbar />
      
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Crown className="w-4 h-4" />
              Acceso Premium
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-amber-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
              {user ? 'Renovar Suscripción' : 'Suscríbete a Nazca360'}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {user 
                ? 'Extiende tu acceso premium y sigue explorando las maravillas de Nazca'
                : 'Crea tu cuenta y accede a contenido exclusivo de las Líneas de Nazca en 360°'
              }
            </p>
          </div>

          {/* Step 1: Registration Form (only for new users) */}
          {!user && step === 'register' && (
            <div className="max-w-md mx-auto mb-12">
              <div className="glass rounded-2xl p-8">
                <h2 className="text-2xl font-bold text-amber-900 mb-6 text-center">
                  Paso 1: Crear Cuenta
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre Completo
                    </label>
                    <Input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Tu nombre"
                      className="w-full"
                      data-testid="register-name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <Input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="tu@email.com"
                      className="w-full"
                      data-testid="register-email"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full pr-10"
                        data-testid="register-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirmar Contraseña
                    </label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="Repite tu contraseña"
                      className="w-full"
                      data-testid="register-confirm-password"
                    />
                  </div>
                  
                  <Button
                    onClick={proceedToPayment}
                    className="w-full btn-peru py-6 text-lg font-semibold"
                    data-testid="proceed-to-plan"
                  >
                    Continuar <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
                
                <p className="text-center text-sm text-gray-600 mt-4">
                  ¿Ya tienes cuenta?{' '}
                  <a href="/login" className="text-amber-600 hover:text-amber-800 font-medium">
                    Inicia Sesión
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Plan Selection */}
          {(user || step === 'plan') && (
            <>
              {!user && (
                <div className="text-center mb-8">
                  <p className="text-green-600 font-medium">
                    ✓ Datos guardados: {formData.name} ({formData.email})
                  </p>
                  <button 
                    onClick={() => setStep('register')}
                    className="text-amber-600 hover:underline text-sm"
                  >
                    Editar datos
                  </button>
                </div>
              )}
              
              <h2 className="text-2xl font-bold text-amber-900 mb-6 text-center">
                {user ? 'Selecciona tu plan' : 'Paso 2: Selecciona tu plan'}
              </h2>
              
              {/* Plans Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`relative glass rounded-2xl p-6 cursor-pointer transition-all duration-300 ${
                      selectedPlan === plan.id 
                        ? 'ring-2 ring-amber-500 shadow-xl scale-105' 
                        : 'hover:shadow-lg hover:-translate-y-1'
                    }`}
                    data-testid={`plan-${plan.id}`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                          MÁS POPULAR
                        </span>
                      </div>
                    )}
                    
                    {plan.savings && (
                      <div className="absolute -top-2 -right-2">
                        <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          -${plan.savings}
                        </span>
                      </div>
                    )}
                    
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-amber-900 mb-2">{plan.name}</h3>
                      
                      <div className="mb-4">
                        {plan.originalPrice && (
                          <span className="text-gray-400 line-through text-lg mr-2">
                            ${plan.originalPrice}
                          </span>
                        )}
                        <span className="text-4xl font-bold text-amber-600">${plan.price}</span>
                        <span className="text-gray-600"> USD</span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-4">
                        {plan.duration} días de acceso
                      </p>
                      
                      {selectedPlan === plan.id && (
                        <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center mx-auto">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Features */}
              <div className="glass rounded-2xl p-8 mb-8">
                <h3 className="text-xl font-bold text-amber-900 mb-6 text-center">
                  Incluido en todos los planes
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {FEATURES.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <feature.icon className="w-5 h-5 text-amber-600" />
                      </div>
                      <span className="text-gray-700">{feature.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Summary & PayPal Button */}
              <div className="max-w-md mx-auto">
                <div className="glass rounded-2xl p-8">
                  <h3 className="text-xl font-bold text-amber-900 mb-4 text-center">
                    Resumen de tu pedido
                  </h3>
                  
                  <div className="border-b border-amber-200 pb-4 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">{selectedPlanData?.name}</span>
                      <span className="font-bold text-amber-900">${selectedPlanData?.price} USD</span>
                    </div>
                    {selectedPlanData?.savings && (
                      <div className="flex justify-between items-center text-sm text-green-600 mt-1">
                        <span>Descuento</span>
                        <span>-${selectedPlanData.savings}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center text-lg font-bold mb-6">
                    <span className="text-amber-900">Total</span>
                    <span className="text-amber-600">${selectedPlanData?.price} USD</span>
                  </div>
                  
                  {/* PayPal Button - Popup Flow */}
                  <PayPalScriptProvider 
                    options={{ 
                      "client-id": PAYPAL_CLIENT_ID,
                      currency: "USD",
                      intent: "capture"
                    }}
                  >
                    <PayPalButtons
                      style={{ 
                        layout: "vertical",
                        color: "gold",
                        shape: "rect",
                        label: "paypal",
                        height: 50
                      }}
                      fundingSource="paypal"
                      disabled={loading || (!user && !validateForm())}
                      createOrder={async () => {
                        try {
                          setLoading(true);
                          
                          const payload = {
                            plan_type: selectedPlan
                          };
                          
                          // Add user data if not logged in
                          if (!user) {
                            payload.email = formData.email;
                            payload.name = formData.name;
                            payload.password = formData.password;
                          }
                          
                          const headers = token ? { Authorization: `Bearer ${token}` } : {};
                          
                          const response = await axios.post(
                            `${API}/paypal/popup/create-order`,
                            payload,
                            { headers }
                          );
                          
                          return response.data.orderID;
                        } catch (error) {
                          console.error('Error creating order:', error);
                          let errorMessage = 'Error al crear el pago';
                          if (error.response?.data?.detail) {
                            const detail = error.response.data.detail;
                            errorMessage = typeof detail === 'string' ? detail : JSON.stringify(detail);
                          }
                          toast.error(errorMessage);
                          setLoading(false);
                          throw error;
                        }
                      }}
                      onApprove={async (data) => {
                        try {
                          const headers = token ? { Authorization: `Bearer ${token}` } : {};
                          
                          const response = await axios.post(
                            `${API}/paypal/popup/capture-order?orderID=${data.orderID}`,
                            {},
                            { headers }
                          );
                          
                          if (response.data.success) {
                            toast.success(response.data.message);
                            
                            // If new user, save credentials
                            if (response.data.access_token) {
                              localStorage.setItem('access_token', response.data.access_token);
                              setToken(response.data.access_token);
                              if (response.data.user) {
                                setUser(response.data.user);
                              }
                            }
                            
                            // Navigate to success or map
                            setTimeout(() => {
                              navigate('/mapa');
                            }, 1500);
                          }
                        } catch (error) {
                          console.error('Error capturing order:', error);
                          toast.error(error.response?.data?.detail || 'Error al procesar el pago');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      onCancel={() => {
                        toast.info('Pago cancelado');
                        setLoading(false);
                      }}
                      onError={(err) => {
                        console.error('PayPal error:', err);
                        toast.error('Error en PayPal. Por favor intenta de nuevo.');
                        setLoading(false);
                      }}
                    />
                  </PayPalScriptProvider>
                  
                  <p className="text-center text-xs text-gray-500 mt-4">
                    El pago se procesa en una ventana segura de PayPal sin salir de esta página.
                  </p>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default Subscription;
