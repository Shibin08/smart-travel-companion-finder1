import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Compass, LogOut, Menu, X, ChevronDown, Star, Shield, MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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
            className={`${className} ${isActive ? 'text-teal-600 font-semibold' : ''}`}
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
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <nav className="bg-white shadow-sm sticky top-0 z-50" role="navigation" aria-label="Main navigation">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
                            <Compass className="h-8 w-8 text-teal-600" />
                            <span className="ml-2 text-xl font-bold text-gray-900">TravelBuddy</span>
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center space-x-6">
                            {user ? (
                                <>
                                    <NavLink to="/find-companion" className="text-gray-600 hover:text-teal-600 font-medium">Find Companion</NavLink>
                                    <NavLink to="/matches" className="text-gray-600 hover:text-teal-600 font-medium">Matches</NavLink>
                                    <NavLink to="/chat" className="text-gray-600 hover:text-teal-600 font-medium flex items-center">
                                        <MessageCircle className="h-4 w-4 mr-1" />
                                        Chat
                                    </NavLink>
                                    <NavLink to="/reviews" className="text-gray-600 hover:text-teal-600 font-medium flex items-center">
                                        <Star className="h-4 w-4 mr-1" />
                                        Reviews
                                    </NavLink>
                                    <NavLink to="/emergency" className="text-red-600 hover:text-red-700 font-medium flex items-center">
                                        <Shield className="h-4 w-4 mr-1" />
                                        Emergency
                                    </NavLink>
                                    <div className="relative" ref={profileMenuRef}>
                                        <button
                                            onClick={() => setIsProfileOpen((prev) => !prev)}
                                            className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100"
                                            aria-label="Profile menu"
                                            aria-haspopup="true"
                                            aria-expanded={isProfileOpen}
                                        >
                                            <UserAvatar src={resolvePhoto(user.photoUrl)} name={user.name} className="h-8 w-8 rounded-full border border-gray-200" />
                                            <ChevronDown size={16} className="text-gray-500" />
                                        </button>

                                        {isProfileOpen && (
                                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50 animate-fade-in">
                                                <div className="px-3 py-2 border-b border-gray-100">
                                                    <p className="text-sm font-medium text-gray-800">{user.name}</p>
                                                    <p className="text-xs text-gray-500">{user.email}</p>
                                                </div>
                                                <Link to="/profile" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setIsProfileOpen(false)}>
                                                    Profile
                                                </Link>
                                                <Link to="/reviews" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setIsProfileOpen(false)}>
                                                    My Reviews
                                                </Link>
                                                <Link to="/emergency" className="block px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={() => setIsProfileOpen(false)}>
                                                    Emergency SOS
                                                </Link>
                                                <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 inline-flex items-center">
                                                    <LogOut size={14} className="mr-2" /> Logout
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <Link to="/login" className="text-teal-600 font-medium hover:text-teal-700">Login</Link>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="flex items-center md:hidden">
                            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-600 hover:text-gray-900 p-2" aria-label="Toggle menu" aria-expanded={isMenuOpen}>
                                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu — animated slide */}
                <div
                    className={`md:hidden bg-white border-t border-gray-100 overflow-hidden transition-all duration-300 ease-in-out ${
                        isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                >
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        {user ? (
                            <>
                                <NavLink to="/find-companion" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50">Find Companion</NavLink>
                                <NavLink to="/matches" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50">Matches</NavLink>
                                <NavLink to="/chat" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 flex items-center">
                                    <MessageCircle className="h-4 w-4 mr-2" />
                                    Chat
                                </NavLink>
                                <NavLink to="/reviews" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 flex items-center">
                                    <Star className="h-4 w-4 mr-2" />
                                    Reviews
                                </NavLink>
                                <NavLink to="/emergency" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50 flex items-center">
                                    <Shield className="h-4 w-4 mr-2" />
                                    Emergency SOS
                                </NavLink>
                                <NavLink to="/profile" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50">Profile</NavLink>
                                <button onClick={handleLogout} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50">Logout</button>
                            </>
                        ) : (
                            <Link to="/login" className="block px-3 py-2 rounded-md text-base font-medium text-teal-600 hover:bg-teal-50">Login</Link>
                        )}
                    </div>
                </div>
            </nav>

            <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
                {children}
            </main>

            <footer className="bg-white border-t border-gray-200 mt-auto">
                <div className="max-w-7xl mx-auto py-6 px-4 overflow-hidden sm:px-6 lg:px-8">
                    <p className="mt-1 text-center text-sm text-gray-400">&copy; 2026 Smart Travel Companion Finder. All rights reserved.</p>
                </div>
            </footer>
            <SOSButton />
        </div>
    );
}
