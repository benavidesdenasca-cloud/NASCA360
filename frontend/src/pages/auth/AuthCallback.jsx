import React, { useEffect, useRef, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '@/App';
import axios from 'axios';
import { Loader } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, setToken } = useContext(AuthContext);
  const hasProcessed = useRef(false);
  
  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    
    const processSession = async () => {
      try {
        // Extract session_id from URL fragment
        const hash = location.hash;
        const params = new URLSearchParams(hash.slice(1)); // Remove '#' from hash
        const sessionId = params.get('session_id');
        
        if (!sessionId) {
          console.error('No session_id found in URL');
          navigate('/auth/login');
          return;
        }
        
        // Exchange session_id for user data
        const response = await axios.post(`${API}/auth/session`, {
          session_id: sessionId
        }, {
          withCredentials: true // Important for cookie handling
        });
        
        const { session_token, user } = response.data;
        
        // Store token and user
        localStorage.setItem('access_token', session_token);
        setToken(session_token);
        setUser(user);
        
        // Redirect to gallery with user data
        navigate('/gallery', { state: { user }, replace: true });
        
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/auth/login');
      }
    };
    
    processSession();
  }, [location, navigate, setUser, setToken]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center px-4">
      <div className="text-center">
        <Loader className="w-16 h-16 text-amber-600 mx-auto mb-4 animate-spin" />
        <h2 className="text-2xl font-bold text-amber-900" style={{ fontFamily: 'Playfair Display, serif' }}>
          Autenticando...
        </h2>
        <p className="text-gray-600 mt-2">Procesando tu inicio de sesión</p>
      </div>
    </div>
  );
};

export default AuthCallback;
