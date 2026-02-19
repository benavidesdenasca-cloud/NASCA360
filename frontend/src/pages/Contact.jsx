import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MapPin, Phone, Mail, Clock, Send, MessageCircle, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [visibleSections, setVisibleSections] = useState({});
  const sectionRefs = useRef({});

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => ({
              ...prev,
              [entry.target.id]: true
            }));
          }
        });
      },
      { threshold: 0.1 }
    );

    const sections = ['hero', 'info', 'map', 'form'];
    sections.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.message) {
      toast.error('Por favor completa los campos obligatorios');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Por favor ingresa un email válido');
      return;
    }

    setSending(true);
    
    try {
      await axios.post(`${API}/contact`, formData);
      setSent(true);
      toast.success('¡Mensaje enviado correctamente! Te responderemos pronto.');
      setFormData({ name: '', email: '', phone: '', message: '' });
      
      // Reset sent state after 5 seconds
      setTimeout(() => setSent(false), 5000);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error.response?.data?.detail || 'Error al enviar el mensaje. Intenta de nuevo.');
    } finally {
      setSending(false);
    }
  };

  const contactInfo = [
    {
      icon: MapPin,
      title: 'Dirección',
      content: 'Calle Lima 160 (Restobar Nazka)',
      subContent: 'Nasca, Ica, Perú',
      color: 'text-red-500'
    },
    {
      icon: Phone,
      title: 'Teléfono / WhatsApp',
      content: '+51 956 567 391',
      link: 'https://wa.me/51956567391',
      linkText: 'Enviar WhatsApp',
      color: 'text-green-500'
    },
    {
      icon: Mail,
      title: 'Email',
      content: 'max@nazca360.com',
      link: 'mailto:max@nazca360.com',
      linkText: 'Enviar email',
      color: 'text-blue-500'
    },
    {
      icon: Clock,
      title: 'Horario de Atención',
      content: 'Lunes a Domingo',
      subContent: '8:00 AM - 10:00 PM',
      color: 'text-amber-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <Navbar />
      
      {/* Hero Section */}
      <section 
        id="hero"
        className={`pt-24 pb-16 px-4 transition-all duration-1000 ${
          visibleSections.hero ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}
      >
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <MessageCircle className="w-4 h-4" />
            Estamos aquí para ti
          </div>
          <h1 
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-amber-900 mb-6"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Contáctanos
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            Estamos listos para ayudarte a vivir la experiencia Nasca360
          </p>
          
          {/* Decorative line */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-amber-400"></div>
            <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-amber-400"></div>
          </div>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section 
        id="info"
        className={`py-12 px-4 transition-all duration-1000 delay-200 ${
          visibleSections.info ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {contactInfo.map((item, index) => (
              <div 
                key={index}
                className="glass rounded-2xl p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <item.icon className={`w-7 h-7 ${item.color}`} />
                </div>
                <h3 className="font-bold text-amber-900 mb-2">{item.title}</h3>
                <p className="text-gray-700 font-medium">{item.content}</p>
                {item.subContent && (
                  <p className="text-gray-500 text-sm">{item.subContent}</p>
                )}
                {item.link && (
                  <a 
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 text-sm font-medium mt-2 transition-colors"
                  >
                    {item.linkText}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Map & Form Section */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8">
            
            {/* Map */}
            <div 
              id="map"
              className={`transition-all duration-1000 delay-300 ${
                visibleSections.map ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
              }`}
            >
              <div className="glass rounded-2xl p-6 h-full">
                <h2 className="text-2xl font-bold text-amber-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Nuestra Ubicación
                </h2>
                <p className="text-gray-600 mb-4">
                  Visítanos en el centro de Nasca, en el famoso Restobar Nazka.
                </p>
                <div className="rounded-xl overflow-hidden shadow-lg">
                  <iframe
                    title="Ubicación Nazca360"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3869.1234567890123!2d-74.9385!3d-14.8270!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sCalle%20Lima%20160%2C%20Nasca!5e0!3m2!1ses!2spe!4v1234567890123"
                    width="100%"
                    height="350"
                    style={{ border: 0 }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="w-full"
                  ></iframe>
                </div>
                
                {/* Quick contact buttons */}
                <div className="flex flex-wrap gap-3 mt-6">
                  <a
                    href="https://wa.me/51956567391?text=Hola%2C%20me%20interesa%20la%20experiencia%20Nazca360"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </a>
                  <a
                    href="https://www.google.com/maps/dir//Calle+Lima+160,+Nasca,+Peru"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
                  >
                    <MapPin className="w-4 h-4" />
                    Cómo llegar
                  </a>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div 
              id="form"
              className={`transition-all duration-1000 delay-400 ${
                visibleSections.form ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
              }`}
            >
              <div className="glass rounded-2xl p-6 h-full">
                <h2 className="text-2xl font-bold text-amber-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Envíanos un Mensaje
                </h2>
                <p className="text-gray-600 mb-6">
                  ¿Tienes preguntas o necesitas información? Escríbenos y te responderemos a la brevedad.
                </p>

                {sent ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
                      <CheckCircle className="w-10 h-10 text-green-500" />
                    </div>
                    <h3 className="text-xl font-bold text-green-700 mb-2">¡Mensaje Enviado!</h3>
                    <p className="text-gray-600">Te responderemos pronto a tu email.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre Completo *
                      </label>
                      <Input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Tu nombre"
                        className="w-full border-2 border-amber-200 focus:border-amber-500 rounded-xl"
                        required
                        data-testid="contact-name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email *
                      </label>
                      <Input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="tu@email.com"
                        className="w-full border-2 border-amber-200 focus:border-amber-500 rounded-xl"
                        required
                        data-testid="contact-email"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Teléfono (Opcional)
                      </label>
                      <Input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+51 999 999 999"
                        className="w-full border-2 border-amber-200 focus:border-amber-500 rounded-xl"
                        data-testid="contact-phone"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mensaje *
                      </label>
                      <Textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        placeholder="¿En qué podemos ayudarte?"
                        rows={4}
                        className="w-full border-2 border-amber-200 focus:border-amber-500 rounded-xl resize-none"
                        required
                        data-testid="contact-message"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={sending}
                      className="w-full btn-peru py-6 text-lg font-semibold rounded-xl flex items-center justify-center gap-2"
                      data-testid="contact-submit"
                    >
                      {sending ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Enviar Mensaje
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="glass rounded-3xl p-8 md:p-12 bg-gradient-to-br from-amber-500/10 to-orange-500/10">
            <h2 className="text-2xl md:text-3xl font-bold text-amber-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
              ¿Listo para explorar las Líneas de Nasca?
            </h2>
            <p className="text-gray-600 mb-6">
              Descubre los misterios de una de las maravillas arqueológicas más fascinantes del mundo.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="/subscription"
                className="btn-peru px-8 py-3 rounded-full font-semibold inline-flex items-center gap-2"
              >
                Ver Suscripciones
              </a>
              <a
                href="/reservations"
                className="bg-white border-2 border-amber-600 text-amber-700 hover:bg-amber-50 px-8 py-3 rounded-full font-semibold inline-flex items-center gap-2 transition-colors"
              >
                Reservar Experiencia VR
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
