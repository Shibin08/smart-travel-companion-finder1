import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { Compass, ShieldCheck, Users, MessageCircle, MapPin, Plane, Mountain, Globe, Star } from 'lucide-react';
import { useState, useEffect } from 'react';

const HERO_IMAGES = [
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=1200', // road trip
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&q=80&w=1200', // lake mountains
    'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&q=80&w=1200', // tropical beach
];

export default function LoginPage() {
    const { login, googleLogin, register } = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [successMessage, setSuccessMessage] = useState('');
    const [heroIndex, setHeroIndex] = useState(0);

    useEffect(() => { document.title = 'Login - TravelMatch'; }, []);
    
    // Cycle hero images
    useEffect(() => {
        const timer = setInterval(() => setHeroIndex((i) => (i + 1) % HERO_IMAGES.length), 5000);
        return () => clearInterval(timer);
    }, []);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [gender, setGender] = useState('Other');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const passwordStrength = (() => {
        if (password.length === 0) return { label: '', color: '', width: '0%' };
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: '20%' };
        if (score <= 2) return { label: 'Fair', color: 'bg-orange-500', width: '40%' };
        if (score <= 3) return { label: 'Good', color: 'bg-yellow-500', width: '60%' };
        if (score <= 4) return { label: 'Strong', color: 'bg-cyan-500', width: '80%' };
        return { label: 'Very Strong', color: 'bg-green-500', width: '100%' };
    })();

    const passwordErrors = (() => {
        if (mode !== 'register' || password.length === 0) return [];
        const errs: string[] = [];
        if (password.length < 8) errs.push('At least 8 characters');
        if (!/[A-Z]/.test(password)) errs.push('One uppercase letter');
        if (!/[a-z]/.test(password)) errs.push('One lowercase letter');
        if (!/\d/.test(password)) errs.push('One number');
        return errs;
    })();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const success = await login(email, password);
            if (!success) {
                setError('Invalid email or password. Please check your credentials.');
                return;
            }
            navigate('/find-companion');
        } catch (err) {
            setError('Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
            setError('Password must contain both uppercase and lowercase letters.');
            return;
        }
        if (!/\d/.test(password)) {
            setError('Password must contain at least one number.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);

        try {
            const result = await register(email, password, name, gender);
            if (!result.success) {
                setError(result.error || 'Registration failed. Please try again.');
                return;
            }
            setError('');
            setSuccessMessage('Registration successful! Please log in.');
            setMode('login');
            setPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError('Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Background - cycling hero images with overlay */}
            {HERO_IMAGES.map((src, i) => (
                <div
                    key={src}
                    className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
                    style={{
                        backgroundImage: `url(${src})`,
                        opacity: heroIndex === i ? 1 : 0,
                    }}
                />
            ))}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-900/65 to-cyan-950/70 backdrop-blur-[2px]" />

            {/* Decorative floating travel icons */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                <Plane className="absolute top-[12%] left-[8%] h-8 w-8 text-white/10 rotate-[-20deg] animate-float" />
                <Mountain className="absolute top-[25%] right-[12%] h-10 w-10 text-white/10 animate-float-delayed" />
                <Globe className="absolute bottom-[20%] left-[15%] h-12 w-12 text-white/10 animate-float-slow" />
                <MapPin className="absolute bottom-[30%] right-[8%] h-7 w-7 text-white/10 animate-float" />
                <Star className="absolute top-[60%] left-[5%] h-6 w-6 text-white/10 animate-float-delayed" />
                <Compass className="absolute top-[8%] right-[25%] h-9 w-9 text-white/10 rotate-12 animate-float-slow" />
            </div>

            {/* Content */}
            <div className="relative z-10 min-h-screen flex items-center py-8 px-4">
                <div className="max-w-5xl w-full mx-auto grid lg:grid-cols-2 gap-0 lg:gap-0 items-stretch">

                    {/* Left panel - travel branding */}
                    <div className="hidden lg:flex flex-col justify-between rounded-l-3xl bg-gradient-to-br from-cyan-700/90 via-sky-700/90 to-teal-700/90 backdrop-blur-md p-10 text-white shadow-2xl border border-white/10 animate-slide-up">
                        <div>
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm">
                                    <Compass className="h-8 w-8" />
                                </div>
                                <div>
                                    <h1 className="text-lg xl:text-xl font-bold tracking-tight whitespace-nowrap">Smart Travel Companion Finder</h1>
                                    <p className="text-cyan-100 text-sm font-medium">Smart matching for safer journeys</p>
                                </div>
                            </div>
                            <h2 className="text-3xl font-bold leading-tight mb-4">
                                Find Your Perfect<br />Travel Partner
                            </h2>
                            <p className="text-cyan-100/90 leading-relaxed max-w-sm">
                                Discover compatible companions based on where you're going, when you travel, your budget, and shared interests.
                            </p>
                        </div>

                        <div className="space-y-5 mt-10">
                            <div className="flex items-start gap-4 bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                                <div className="p-2 bg-white/15 rounded-lg shrink-0">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">Smart Matching</p>
                                    <p className="text-cyan-100/85 text-xs mt-0.5">Weighted algorithm scores destination, dates, budget & interests</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                                <div className="p-2 bg-white/15 rounded-lg shrink-0">
                                    <MessageCircle className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">Secure Chat</p>
                                    <p className="text-cyan-100/85 text-xs mt-0.5">Messaging unlocks only after both users confirm the match</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                                <div className="p-2 bg-white/15 rounded-lg shrink-0">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">Safety First</p>
                                    <p className="text-cyan-100/85 text-xs mt-0.5">Emergency SOS, reviews & verified profiles for safer travel</p>
                                </div>
                            </div>
                        </div>

                        {/* Image dots */}
                        <div className="flex items-center gap-2 mt-8">
                            {HERO_IMAGES.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setHeroIndex(i)}
                                    aria-pressed={heroIndex === i}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${
                                        heroIndex === i ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
                                    }`}
                                    aria-label={`Show image ${i + 1}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Right panel - form */}
                    <div className="glass-panel elevated-card py-8 px-6 sm:px-8 rounded-3xl lg:rounded-l-none lg:rounded-r-3xl border border-white/40 animate-slide-up-delay">
                        {/* Mobile branding */}
                        <div className="text-center mb-6 lg:hidden">
                            <div className="flex justify-center mb-3">
                                <div className="p-3 bg-cyan-50 rounded-2xl">
                                    <Compass className="h-8 w-8 text-cyan-700" />
                                </div>
                            </div>
                            <h1 className="text-lg font-bold text-gray-900">TravelMatch</h1>
                        </div>

                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">
                                {mode === 'login' ? 'Welcome back' : 'Start your journey'}
                            </h2>
                            <p className="mt-1.5 text-sm text-gray-500">
                                {mode === 'login' 
                                    ? 'Sign in to plan your next adventure' 
                                    : 'Create an account and find your travel partner'}
                            </p>
                        </div>

                        {/* Tab switcher */}
                        <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
                            <button
                                onClick={() => { setMode('login'); setError(''); setSuccessMessage(''); }}
                                aria-pressed={mode === 'login'}
                                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                                    mode === 'login'
                                        ? 'bg-white text-cyan-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Sign In
                            </button>
                            <button
                                onClick={() => { setMode('register'); setError(''); setSuccessMessage(''); }}
                                aria-pressed={mode === 'register'}
                                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                                    mode === 'register'
                                        ? 'bg-white text-cyan-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Sign Up
                            </button>
                        </div>

                        {successMessage && (
                            <div className="mb-5 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">
                                <ShieldCheck className="h-4 w-4 shrink-0" />
                                {successMessage}
                            </div>
                        )}

                        <form className="space-y-4" onSubmit={mode === 'login' ? handleLogin : handleRegister}>
                            {mode === 'register' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                            Full name
                                        </label>
                                        <input
                                            id="name"
                                            name="name"
                                            type="text"
                                            required
                                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                                            placeholder="John Doe"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                                            Gender
                                        </label>
                                        <select
                                            id="gender"
                                            name="gender"
                                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                                            value={gender}
                                            onChange={(e) => setGender(e.target.value)}
                                        >
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Non-Binary">Non-Binary</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                    Password
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                    required
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                                    placeholder="Enter a secure password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                {mode === 'login' && (
                                    <div className="text-right mt-1.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSuccessMessage('A password-reset link would be sent to your email. This feature is coming soon.');
                                                setError('');
                                            }}
                                            className="text-xs text-cyan-700 hover:text-cyan-800 hover:underline font-medium"
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                )}
                                {mode === 'register' && password.length > 0 && (
                                    <div className="mt-2.5">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-gray-500">Password strength</span>
                                            <span className={`text-xs font-semibold ${
                                                passwordStrength.label === 'Weak' ? 'text-red-600' :
                                                passwordStrength.label === 'Fair' ? 'text-orange-600' :
                                                passwordStrength.label === 'Good' ? 'text-yellow-600' :
                                                'text-emerald-600'
                                            }`}>{passwordStrength.label}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                            <div className={`h-1.5 rounded-full transition-all duration-300 ${passwordStrength.color}`} style={{ width: passwordStrength.width }} />
                                        </div>
                                        {passwordErrors.length > 0 && (
                                            <ul className="mt-2 space-y-0.5">
                                                {passwordErrors.map((err) => (
                                                    <li key={err} className="text-xs text-red-500 flex items-center gap-1">
                                                        <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                                                        {err}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>

                            {mode === 'register' && (
                                <div>
                                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                        Confirm password
                                    </label>
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        className={`w-full px-3.5 py-2.5 border rounded-xl text-sm bg-gray-50/50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors ${
                                            confirmPassword.length > 0 && password !== confirmPassword
                                                ? 'border-red-300 bg-red-50/50'
                                                : confirmPassword.length > 0 && password === confirmPassword
                                                ? 'border-emerald-300 bg-emerald-50/50'
                                                : 'border-gray-200'
                                        }`}
                                        placeholder="Re-enter password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                    {confirmPassword.length > 0 && password !== confirmPassword && (
                                        <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                                    )}
                                </div>
                            )}

                            {error && (
                                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || (mode === 'register' && (password.length < 8 || password !== confirmPassword || passwordErrors.length > 0))}
                                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 to-sky-700 hover:from-cyan-700 hover:to-sky-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        {mode === 'login' ? <Compass className="h-4 w-4" /> : <Plane className="h-4 w-4" />}
                                        {mode === 'login' ? 'Sign in' : 'Create account'}
                                    </span>
                                )}
                            </button>

                            <p className="text-center text-xs text-gray-400 mt-2">
                                {mode === 'login' 
                                    ? 'Enter your registered email and password' 
                                    : 'Create a new account to get started'}
                            </p>

                            {/* Google Sign-In divider + button */}
                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    <span className="bg-white/95 px-3 text-gray-400">or continue with</span>
                                </div>
                            </div>

                            <div className="flex justify-center">
                                <GoogleLogin
                                    onSuccess={async (credentialResponse) => {
                                        if (!credentialResponse.credential) {
                                            setError('Google sign-in failed - no credential received.');
                                            return;
                                        }
                                        setError('');
                                        setLoading(true);
                                        try {
                                            const success = await googleLogin(credentialResponse.credential);
                                            if (success) {
                                                navigate('/find-companion');
                                            } else {
                                                setError('Google sign-in failed. Please try again.');
                                            }
                                        } catch {
                                            setError('Google sign-in failed. Please try again.');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    onError={() => setError('Google sign-in was cancelled or failed.')}
                                    shape="pill"
                                    size="large"
                                    width={280}
                                    text={mode === 'login' ? 'signin_with' : 'signup_with'}
                                    theme="outline"
                                />
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
