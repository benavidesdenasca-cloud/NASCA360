import { useState, useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from '@/components/ui/sonner';
import LandingPage from '@/pages/LandingPage';
import Gallery from '@/pages/Gallery';
import VideoPlayer from '@/pages/VideoPlayer';
import Subscription from '@/pages/Subscription';
import SubscriptionSuccess from '@/pages/SubscriptionSuccess';
import Reservations from '@/pages/Reservations';
import Dashboard from '@/pages/Dashboard';
import AdminPanel from '@/pages/AdminPanel';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AuthContext = React.createContext();

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState(null);

  useEffect(() => {
    // Check for session_id in URL hash (from Emergent Auth)
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    const sessionId = params.get('session_id');

    if (sessionId) {
      // Exchange session_id for session_token
      exchangeSession(sessionId);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Check for existing session token in localStorage
      const token = localStorage.getItem('session_token');
      if (token) {
        setSessionToken(token);
        fetchCurrentUser(token);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const exchangeSession = async (sessionId) => {
    try {
      const response = await axios.get(`${API}/auth/session`, {
        headers: {
          'X-Session-ID': sessionId
        }
      });
      
      const { user: userData, session_token } = response.data;
      setUser(userData);
      setSessionToken(session_token);
      localStorage.setItem('session_token', session_token);
      setLoading(false);
    } catch (error) {
      console.error('Session exchange failed:', error);
      setLoading(false);
    }
  };

  const fetchCurrentUser = async (token) => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setUser(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('session_token');
      setSessionToken(null);
      setLoading(false);
    }
  };

  const login = () => {
    window.location.href = `${API}/auth/login`;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    localStorage.removeItem('session_token');
    setUser(null);
    setSessionToken(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-800 mx-auto mb-4"></div>
          <p className="text-amber-800">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, sessionToken, login, logout }}>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/video/:id" element={<VideoPlayer />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/subscription/success" element={<SubscriptionSuccess />} />
            <Route path="/reservations" element={<Reservations />} />
            <Route 
              path="/dashboard" 
              element={user ? <Dashboard /> : <Navigate to="/" />} 
            />
            <Route 
              path="/admin" 
              element={user?.role === 'admin' ? <AdminPanel /> : <Navigate to="/" />} 
            />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
      </div>
    </AuthContext.Provider>
  );
}

import React from 'react';
export default App;