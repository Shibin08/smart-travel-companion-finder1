import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Compass, LogOut, Menu, X, ChevronDown, Star, Shield, MessageCircle, MapPin, Plane, Users, Route } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SOSButton from './SOSButton';
import UserAvatar from './UserAvatar';
import { resolvePhoto } from '../utils/photoUtils';

function NavLink({ to, children, className = '', onClick }: { to: string; children: ReactNode; className?: string; onClick?: () => void }) {
  const { pathname } = useLocation();
  const isActive = pathname === to || (to !== '/' && pathname.startsWith(to));

  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`${className} transition-all duration-200 ${
        isActive ? 'text-cyan-700 font-semibold bg-cyan-50/90 ring-1 ring-cyan-200 shadow-sm' : ''
      }`}
    >
      {children}
    </Link>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!profileMenuRef.current) return;
      const target = event.target as Node;
      if (!profileMenuRef.current.contains(target)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 travel-pattern flex flex-col text-slate-900">
      <nav className="glass-panel sticky top-0 z-50 border-b border-gray-200/60 shadow-sm wave-divider" role="navigation" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <button type="button" className="flex items-center group text-left" onClick={() => navigate('/')}>
              <div className="p-1.5 bg-gradient-to-br from-cyan-600 to-sky-700 rounded-xl shadow-md shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-shadow">
                <Compass className="h-6 w-6 text-white" />
              </div>
              <span className="ml-2.5 text-xl font-bold section-title bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                TravelMatch
              </span>
            </button>

            <div className="hidden md:flex items-center space-x-1">
              {user ? (
                <>
                  <NavLink to="/find-companion" className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-cyan-600 hover:bg-cyan-50/70 font-medium flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    Discover
                  </NavLink>
                  <NavLink to="/matches" className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-cyan-600 hover:bg-cyan-50/70 font-medium flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    Matches
                  </NavLink>
                  <NavLink to="/chat" className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-cyan-600 hover:bg-cyan-50/70 font-medium flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4" />
                    Chat
                  </NavLink>
                  <NavLink to="/open-trips" className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-cyan-600 hover:bg-cyan-50/70 font-medium flex items-center gap-1.5">
                    <Route className="h-4 w-4" />
                    Open Trips
                  </NavLink>
                  <NavLink to="/reviews" className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-cyan-600 hover:bg-cyan-50/70 font-medium flex items-center gap-1.5">
                    <Star className="h-4 w-4" />
                    Reviews
                  </NavLink>
                  <NavLink to="/emergency" className="px-3 py-2 rounded-lg text-sm text-red-500 hover:text-red-600 hover:bg-red-50/70 font-medium flex items-center gap-1.5">
                    <Shield className="h-4 w-4" />
                    SOS
                  </NavLink>

                  <div className="w-px h-8 bg-gray-200 mx-2" />

                  <div className="relative" ref={profileMenuRef}>
                    <button
                      onClick={() => setIsProfileOpen((prev) => !prev)}
                      className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100/80"
                      aria-label="Profile menu"
                      aria-haspopup="true"
                      aria-expanded={isProfileOpen}
                    >
                      <UserAvatar src={resolvePhoto(user.photoUrl)} name={user.name} className="h-8 w-8 rounded-full ring-2 ring-cyan-100" />
                      <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isProfileOpen && (
                      <div className="absolute right-0 mt-2 w-56 glass-panel rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 py-1.5 z-50 animate-fade-in">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                        </div>
                        <div className="py-1">
                          <Link to="/profile" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-cyan-50/70 hover:text-cyan-700" onClick={() => setIsProfileOpen(false)}>
                            <Plane className="h-4 w-4" /> My Profile
                          </Link>
                          <Link to="/matches" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-cyan-50/70 hover:text-cyan-700" onClick={() => setIsProfileOpen(false)}>
                            <Users className="h-4 w-4" /> My Matches
                          </Link>
                          <Link to="/reviews" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-cyan-50/70 hover:text-cyan-700" onClick={() => setIsProfileOpen(false)}>
                            <Star className="h-4 w-4" /> My Reviews
                          </Link>
                          <Link to="/emergency" className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50/70" onClick={() => setIsProfileOpen(false)}>
                            <Shield className="h-4 w-4" /> Emergency SOS
                          </Link>
                        </div>
                        <div className="border-t border-gray-100 pt-1">
                          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50/70">
                            <LogOut size={14} /> Sign Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <Link to="/login" className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-sky-700 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 hover:-translate-y-0.5">
                  Login
                </Link>
              )}
            </div>

            <div className="flex items-center md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100"
                aria-label="Toggle menu"
                aria-expanded={isMenuOpen}
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        <div
          className={`md:hidden glass-panel border-t border-gray-100 overflow-hidden transition-all duration-300 ease-in-out ${
            isMenuOpen ? 'max-h-[28rem] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-3 pt-3 pb-4 space-y-1">
            {user ? (
              <>
                <NavLink to="/find-companion" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-base font-medium text-gray-700 hover:bg-cyan-50">
                  <MapPin className="h-4 w-4" /> Discover
                </NavLink>
                <NavLink to="/matches" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-base font-medium text-gray-700 hover:bg-cyan-50">
                  <Users className="h-4 w-4" /> Matches
                </NavLink>
                <NavLink to="/chat" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-base font-medium text-gray-700 hover:bg-cyan-50">
                  <MessageCircle className="h-4 w-4" /> Chat
                </NavLink>
                <NavLink to="/open-trips" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-base font-medium text-gray-700 hover:bg-cyan-50">
                  <Route className="h-4 w-4" /> Open Trips
                </NavLink>
                <NavLink to="/reviews" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-base font-medium text-gray-700 hover:bg-cyan-50">
                  <Star className="h-4 w-4" /> Reviews
                </NavLink>
                <NavLink to="/emergency" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-base font-medium text-red-600 hover:bg-red-50">
                  <Shield className="h-4 w-4" /> Emergency SOS
                </NavLink>
                <NavLink to="/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-base font-medium text-gray-700 hover:bg-cyan-50">
                  <Plane className="h-4 w-4" /> Profile
                </NavLink>
                <div className="border-t border-gray-100 mt-2 pt-2">
                  <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-base font-medium text-red-600 hover:bg-red-50">
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                </div>
              </>
            ) : (
              <Link to="/login" className="block px-3 py-2.5 rounded-xl text-base font-semibold text-cyan-600 hover:bg-cyan-50">
                Login
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      <footer className="glass-panel border-t border-gray-200/50 mt-auto">
        <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-gradient-to-br from-cyan-600 to-sky-700 rounded-xl shadow-md shadow-cyan-500/20">
                  <Compass className="h-5 w-5 text-white" />
                </div>
                <span className="text-base font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">TravelMatch</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">Find your perfect travel companion with smart matching, secure chat, and safety-first features.</p>
            </div>
            {user && (
              <>
                <div>
                  <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wider mb-3">Explore</h4>
                  <ul className="space-y-2">
                    <li><Link to="/find-companion" className="text-sm text-gray-500 visited:text-gray-500 hover:text-cyan-600">Discover Companions</Link></li>
                    <li><Link to="/matches" className="text-sm text-gray-500 visited:text-gray-500 hover:text-cyan-600">My Matches</Link></li>
                    <li><Link to="/chat" className="text-sm text-gray-500 visited:text-gray-500 hover:text-cyan-600">Messages</Link></li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wider mb-3">Account</h4>
                  <ul className="space-y-2">
                    <li><Link to="/profile" className="text-sm text-gray-500 visited:text-gray-500 hover:text-cyan-600">My Profile</Link></li>
                    <li><Link to="/reviews" className="text-sm text-gray-500 visited:text-gray-500 hover:text-cyan-600">Reviews</Link></li>
                    <li><Link to="/emergency" className="text-sm text-gray-500 hover:text-red-500">Emergency SOS</Link></li>
                  </ul>
                </div>
              </>
            )}
          </div>
          <div className="border-t border-gray-200/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-400">&copy; 2026 TravelMatch. All rights reserved.</p>
            <p className="text-xs text-gray-400">Built with ❤️ for travelers.</p>
          </div>
        </div>
      </footer>

      <SOSButton />
    </div>
  );
}
