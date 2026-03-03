import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Compass, ShieldCheck, Users, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function LoginPage() {
    const { login, register } = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState<'login' | 'register'>('login');

    useEffect(() => { document.title = 'Login — Travel Companion Finder'; }, []);
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
        if (score <= 4) return { label: 'Strong', color: 'bg-teal-500', width: '80%' };
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
            navigate('/find-companion');
        } catch (err) {
            setError('Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-sky-50 flex items-center py-10 px-4">
            <div className="max-w-5xl w-full mx-auto grid md:grid-cols-2 gap-8 items-stretch">
                <div className="hidden md:flex rounded-2xl bg-teal-700 p-8 text-white flex-col justify-between shadow-xl">
                    <div>
                        <div className="flex items-center mb-6">
                            <Compass className="h-10 w-10" />
                            <h1 className="ml-3 text-2xl font-bold">Smart Travel Companion Finder</h1>
                        </div>
                        <p className="text-teal-100 leading-relaxed">
                            Match with the right travel partner using destination, date overlap, interests, and budget compatibility.
                        </p>
                    </div>

                    <ul className="space-y-4 mt-8 text-sm">
                        <li className="flex items-start"><Users className="h-4 w-4 mr-2 mt-0.5" /> Intelligent companion matching workflow</li>
                        <li className="flex items-start"><MessageCircle className="h-4 w-4 mr-2 mt-0.5" /> Chat unlocks only after confirmed match</li>
                        <li className="flex items-start"><ShieldCheck className="h-4 w-4 mr-2 mt-0.5" /> Verified user trust and safer connections</li>
                    </ul>
                </div>

                <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100">
                    <div className="text-center mb-6">
                        <div className="flex justify-center md:hidden">
                            <Compass className="h-10 w-10 text-teal-600" />
                        </div>
                        <h2 className="mt-2 text-2xl font-bold text-gray-900">
                            {mode === 'login' ? 'Welcome back' : 'Create account'}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            {mode === 'login' 
                                ? 'Sign in to continue planning your next trip' 
                                : 'Join to start finding travel companions'}
                        </p>
                    </div>

                    {/* Tab switcher */}
                    <div className="flex gap-4 mb-6 border-b border-gray-200">
                        <button
                            onClick={() => { setMode('login'); setError(''); }}
                            className={`pb-3 px-2 font-medium text-sm transition-colors ${
                                mode === 'login'
                                    ? 'text-teal-600 border-b-2 border-teal-600'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => { setMode('register'); setError(''); }}
                            className={`pb-3 px-2 font-medium text-sm transition-colors ${
                                mode === 'register'
                                    ? 'text-teal-600 border-b-2 border-teal-600'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    <form className="space-y-6" onSubmit={mode === 'login' ? handleLogin : handleRegister}>
                        {mode === 'register' && (
                            <>
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                        Full name
                                    </label>
                                    <div className="mt-1">
                                        <input
                                            id="name"
                                            name="name"
                                            type="text"
                                            required
                                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                                            placeholder="John Doe"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
                                        Gender
                                    </label>
                                    <div className="mt-1">
                                        <select
                                            id="gender"
                                            name="gender"
                                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm bg-white"
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
                            </>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Email address
                            </label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Password
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                    required
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                                    placeholder="Enter a secure password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            {mode === 'login' && (
                                <div className="text-right mt-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setError('A password-reset link would be sent to your email. This feature requires email service integration.');
                                        }}
                                        className="text-xs text-teal-600 hover:text-teal-800 hover:underline"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                            )}
                            {mode === 'register' && password.length > 0 && (
                                <div className="mt-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-gray-500">Password strength</span>
                                        <span className={`text-xs font-medium ${
                                            passwordStrength.label === 'Weak' ? 'text-red-600' :
                                            passwordStrength.label === 'Fair' ? 'text-orange-600' :
                                            passwordStrength.label === 'Good' ? 'text-yellow-600' :
                                            'text-green-600'
                                        }`}>{passwordStrength.label}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div className={`h-1.5 rounded-full transition-all ${passwordStrength.color}`} style={{ width: passwordStrength.width }} />
                                    </div>
                                    {passwordErrors.length > 0 && (
                                        <ul className="mt-1.5 space-y-0.5">
                                            {passwordErrors.map((err) => (
                                                <li key={err} className="text-xs text-red-500">• {err}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>

                        {mode === 'register' && (
                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                                    Confirm password
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm ${
                                            confirmPassword.length > 0 && password !== confirmPassword
                                                ? 'border-red-300 bg-red-50'
                                                : confirmPassword.length > 0 && password === confirmPassword
                                                ? 'border-green-300 bg-green-50'
                                                : 'border-gray-300'
                                        }`}
                                        placeholder="Re-enter password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                                {confirmPassword.length > 0 && password !== confirmPassword && (
                                    <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                                )}
                            </div>
                        )}

                        {error && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading || (mode === 'register' && (password.length < 8 || password !== confirmPassword || passwordErrors.length > 0))}
                                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Processing...' : (mode === 'login' ? 'Sign in' : 'Create account')}
                            </button>
                        </div>

                        <div className="text-center text-xs text-gray-400 bg-gray-50 rounded-md py-2">
                            {mode === 'login' 
                                ? 'Enter your registered email and password' 
                                : 'Create a new account to get started'}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
