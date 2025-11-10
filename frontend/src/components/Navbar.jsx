import React, { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '@/App';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, LayoutDashboard, Crown, Menu } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav 
      data-testid="navbar"
      className={`navbar ${scrolled ? 'scrolled' : ''}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link 
            to="/" 
            data-testid="nav-logo"
            className="flex items-center space-x-3"
          >
            <img 
              src="/logo.jpg" 
              alt="Nazca360 Logo" 
              className="h-12 w-auto object-contain"
            />
            <span className="text-xl font-bold text-amber-900" style={{ fontFamily: 'Playfair Display, serif' }}>
              Nazca360
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              to="/gallery" 
              data-testid="nav-gallery"
              className="text-gray-700 hover:text-amber-900 font-medium"
            >
              Galería
            </Link>
            <Link 
              to="/subscription" 
              data-testid="nav-subscription"
              className="text-gray-700 hover:text-amber-900 font-medium"
            >
              Suscripciones
            </Link>
            <Link 
              to="/reservations" 
              data-testid="nav-reservations"
              className="text-gray-700 hover:text-amber-900 font-medium"
            >
              Reservas
            </Link>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    data-testid="user-menu-button"
                    variant="outline" 
                    className="rounded-full border-2 border-amber-700"
                  >
                    <User className="w-4 h-4 mr-2" />
                    {user.name}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem 
                    data-testid="menu-dashboard"
                    onClick={() => navigate('/dashboard')}
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Mi Dashboard
                  </DropdownMenuItem>
                  {user.role === 'admin' && (
                    <DropdownMenuItem 
                      data-testid="menu-admin"
                      onClick={() => navigate('/admin')}
                    >
                      <Crown className="mr-2 h-4 w-4" />
                      Panel Admin
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    data-testid="menu-logout"
                    onClick={logout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                data-testid="nav-login-button"
                onClick={() => navigate('/auth/login')}
                className="btn-peru rounded-full"
              >
                Iniciar Sesión
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              data-testid="mobile-menu-button"
              variant="ghost"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-2">
            <Link
              to="/gallery"
              className="block px-4 py-2 text-gray-700 hover:bg-amber-50 rounded"
              onClick={() => setMobileMenuOpen(false)}
            >
              Galería
            </Link>
            <Link
              to="/subscription"
              className="block px-4 py-2 text-gray-700 hover:bg-amber-50 rounded"
              onClick={() => setMobileMenuOpen(false)}
            >
              Suscripciones
            </Link>
            <Link
              to="/reservations"
              className="block px-4 py-2 text-gray-700 hover:bg-amber-50 rounded"
              onClick={() => setMobileMenuOpen(false)}
            >
              Reservas
            </Link>
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="block px-4 py-2 text-gray-700 hover:bg-amber-50 rounded"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Mi Dashboard
                </Link>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="block px-4 py-2 text-gray-700 hover:bg-amber-50 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Panel Admin
                  </Link>
                )}
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-amber-50 rounded"
                >
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  login();
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-700 text-white rounded font-medium"
              >
                Iniciar Sesión
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;