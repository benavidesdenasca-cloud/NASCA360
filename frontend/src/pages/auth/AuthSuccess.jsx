import React, { useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '@/App';
import { Loader } from 'lucide-react';

const AuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setToken, fetchCurrentUser } = useContext(AuthContext);
  
  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      localStorage.setItem('access_token', token);
      setToken(token);
      fetchCurrentUser(token);
      
      // Redirect to gallery after a brief moment
      setTimeout(() => {
        navigate('/gallery');
      }, 1000);
    } else {
      navigate('/auth/login');
    }
  }, [searchParams, navigate, setToken, fetchCurrentUser]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center px-4">
      <div className="text-center">
        <Loader className="w-16 h-16 text-amber-600 mx-auto mb-4 animate-spin" />
        <h2 className="text-2xl font-bold text-amber-900" style={{ fontFamily: 'Playfair Display, serif' }}>
          Autenticando...
        </h2>
        <p className="text-gray-600 mt-2">Redirigiendo a Nazca360</p>
      </div>
    </div>
  );
};

export default AuthSuccess;