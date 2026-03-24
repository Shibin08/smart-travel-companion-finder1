/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { getUserIdFromToken, loginWithBackend, googleLoginWithBackend, registerWithBackend, updateUserProfile, isTokenExpired, fetchMyProfile } from '../utils/apiClient';
import { devLog, devWarn, devError } from '../utils/devLogger';

const TOKEN_STORAGE_KEY = 'tcf_token';

const normalizeTravelStyle = (value?: string | null): User['profile']['travelStyle'] => {
    if (value === 'Backpacking') {
        return 'Backpacker';
    }
    if (value === 'Standard') {
        return 'Leisure';
    }
    if (
        value === 'Backpacker'
        || value === 'Luxury'
        || value === 'Adventure'
        || value === 'Leisure'
        || value === 'Business'
    ) {
        return value;
    }
    return 'Adventure';
};

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<boolean>;
    googleLogin: (credential: string) => Promise<boolean>;
    register: (email: string, password: string, name: string, gender?: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    updateProfile: (profile: UserUpdatePayload) => Promise<boolean>;
    isAuthenticated: boolean;
}

type UserUpdatePayload = Omit<Partial<User>, 'profile'> & {
    profile?: Partial<User['profile']>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        const stored = localStorage.getItem('tcf_user');
        const token = localStorage.getItem('tcf_token');
        if (!stored || !token) return null;

        try {
            const parsed = JSON.parse(stored) as Partial<User>;
            // Ensure all required User fields exist (handles stale localStorage data)
            return {
                userId: parsed.userId ?? '',
                name: parsed.name ?? 'User',
                email: parsed.email ?? '',
                age: parsed.age ?? 0,
                gender: parsed.gender ?? 'Other',
                verificationStatus: parsed.verificationStatus ?? 'Pending',
                bio: parsed.bio ?? '',
                photoUrl: parsed.photoUrl,
                homeCountry: parsed.homeCountry ?? 'India',
                currentCity: parsed.currentCity ?? 'Unknown',
                profile: {
                    budget: parsed.profile?.budget ?? 'Medium',
                    travelStyle: parsed.profile?.travelStyle ?? 'Adventure',
                    interests: parsed.profile?.interests ?? [],
                    personality: parsed.profile?.personality,
                },
                preferences: {
                    notifications: parsed.preferences?.notifications ?? true,
                    locationSharing: parsed.preferences?.locationSharing ?? false,
                    publicProfile: parsed.preferences?.publicProfile ?? true,
                },
                stats: {
                    tripsCompleted: parsed.stats?.tripsCompleted ?? 0,
                    reviewsReceived: parsed.stats?.reviewsReceived ?? 0,
                    averageRating: parsed.stats?.averageRating ?? 0,
                    responseRate: parsed.stats?.responseRate ?? 0,
                },
            } as User;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        // Check token validity on mount — auto-logout if expired
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (token && isTokenExpired(token)) {
            devWarn('[Auth] Token expired on startup — logging out');
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            localStorage.removeItem('tcf_user');
            setUser(null);
        }
    }, []);

    useEffect(() => {
        if (user) {
            localStorage.setItem('tcf_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('tcf_user');
        }
    }, [user]);

    const login = async (email: string, password: string): Promise<boolean> => {
        if (!email || !password) {
            return false;
        }

        try {
            const response = await loginWithBackend(email, password);
            localStorage.setItem(TOKEN_STORAGE_KEY, response.access_token);
            const backendUserId = getUserIdFromToken(response.access_token);

            if (!backendUserId) {
                return false;
            }

            // Fetch the saved profile from the backend
            try {
                const profile = await fetchMyProfile(response.access_token);
                devLog('[Auth] Fetched profile from backend:', profile.name, profile.photo_url);
                const budgetLabel = profile.budget_range != null
                    ? profile.budget_range <= 6000 ? 'Low' : profile.budget_range <= 9000 ? 'Medium' : 'High'
                    : 'Medium';

                setUser({
                    userId: backendUserId,
                    email: profile.email || email,
                    name: profile.name || email.split('@')[0] || 'User',
                    age: profile.age ?? 0,
                    gender: (profile.gender as 'Male' | 'Female' | 'Non-Binary' | 'Other') || 'Other',
                    verificationStatus: 'Pending',
                    bio: profile.bio || '',
                    photoUrl: profile.photo_url || undefined,
                    homeCountry: profile.home_country || 'India',
                    currentCity: profile.current_city || 'Unknown',
                    destination: profile.destination || undefined,
                    matchingStartDate: profile.start_date || undefined,
                    matchingEndDate: profile.end_date || undefined,
                    profile: {
                        budget: budgetLabel as 'Low' | 'Medium' | 'High',
                        travelStyle: normalizeTravelStyle(profile.travel_style),
                        interests: profile.interests ? profile.interests.split(/[|,]/).map((s: string) => s.trim()).filter(Boolean) : [],
                        languagePreference: profile.language_preference || undefined,
                    },
                    preferences: {
                        notifications: true,
                        locationSharing: false,
                        publicProfile: profile.discoverable,
                    },
                    stats: {
                        tripsCompleted: 0,
                        reviewsReceived: 0,
                        averageRating: 0,
                        responseRate: 0,
                    },
                });
            } catch (profileErr) {
                devError('[Auth] Failed to fetch profile from backend, using defaults:', profileErr);
                // Fallback to defaults if profile fetch fails
                setUser({
                    userId: backendUserId,
                    email,
                    name: email.split('@')[0] || 'User',
                    age: 0,
                    gender: 'Other',
                    verificationStatus: 'Pending',
                    bio: '',
                    photoUrl: undefined,
                    homeCountry: 'India',
                    currentCity: 'Unknown',
                    profile: {
                        budget: 'Medium',
                        travelStyle: 'Adventure',
                        interests: [],
                    },
                    preferences: {
                        notifications: true,
                        locationSharing: false,
                        publicProfile: true,
                    },
                    stats: {
                        tripsCompleted: 0,
                        reviewsReceived: 0,
                        averageRating: 0,
                        responseRate: 0,
                    },
                });
            }

            return true;
        } catch {
            return false;
        }
    };

    const googleLogin = async (credential: string): Promise<boolean> => {
        try {
            const response = await googleLoginWithBackend(credential);
            localStorage.setItem(TOKEN_STORAGE_KEY, response.access_token);
            const backendUserId = getUserIdFromToken(response.access_token);

            if (!backendUserId) return false;

            try {
                const profile = await fetchMyProfile(response.access_token);
                devLog('[Auth] Google login — fetched profile:', profile.name);
                const budgetLabel = profile.budget_range != null
                    ? profile.budget_range <= 6000 ? 'Low' : profile.budget_range <= 9000 ? 'Medium' : 'High'
                    : 'Medium';

                setUser({
                    userId: backendUserId,
                    email: profile.email || '',
                    name: profile.name || 'User',
                    age: profile.age ?? 0,
                    gender: (profile.gender as 'Male' | 'Female' | 'Non-Binary' | 'Other') || 'Other',
                    verificationStatus: 'Pending',
                    bio: profile.bio || '',
                    photoUrl: profile.photo_url || undefined,
                    homeCountry: profile.home_country || 'India',
                    currentCity: profile.current_city || 'Unknown',
                    destination: profile.destination || undefined,
                    matchingStartDate: profile.start_date || undefined,
                    matchingEndDate: profile.end_date || undefined,
                    profile: {
                        budget: budgetLabel as 'Low' | 'Medium' | 'High',
                        travelStyle: normalizeTravelStyle(profile.travel_style),
                        interests: profile.interests ? profile.interests.split(/[|,]/).map((s: string) => s.trim()).filter(Boolean) : [],
                        languagePreference: profile.language_preference || undefined,
                    },
                    preferences: {
                        notifications: true,
                        locationSharing: false,
                        publicProfile: profile.discoverable,
                    },
                    stats: {
                        tripsCompleted: 0,
                        reviewsReceived: 0,
                        averageRating: 0,
                        responseRate: 0,
                    },
                });
            } catch (profileErr) {
                devError('[Auth] Google login — profile fetch failed, using defaults:', profileErr);
                setUser({
                    userId: backendUserId,
                    email: '',
                    name: 'User',
                    age: 0,
                    gender: 'Other',
                    verificationStatus: 'Pending',
                    bio: '',
                    photoUrl: undefined,
                    homeCountry: 'India',
                    currentCity: 'Unknown',
                    profile: { budget: 'Medium', travelStyle: 'Adventure', interests: [] },
                    preferences: { notifications: true, locationSharing: false, publicProfile: true },
                    stats: { tripsCompleted: 0, reviewsReceived: 0, averageRating: 0, responseRate: 0 },
                });
            }

            return true;
        } catch (err) {
            devError('[Auth] Google login failed:', err);
            return false;
        }
    };

    const register = async (email: string, password: string, name: string, gender: string = 'Other'): Promise<{ success: boolean; error?: string }> => {
        if (!email || !password || !name) {
            return { success: false, error: 'All fields are required' };
        }

        try {
            devLog('Registering user:', email);
            await registerWithBackend(email, password, name, gender);
            devLog('Registration successful');
            return { success: true };
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : 'Registration failed';
            devError('Registration error:', errorMsg);
            return { success: false, error: errorMsg };
        }
    };

    const logout = () => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setUser(null);
    };

    const updateProfile = async (updates: UserUpdatePayload): Promise<boolean> => {
        if (!user) return false;

        const updatedUser: User = {
            ...user,
            ...updates,
            profile: {
                ...user.profile,
                ...updates.profile,
            },
        };
        setUser(updatedUser);

        // Also update on backend
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (token) {
            try {
                await updateUserProfile(token, {
                    name: updates.name,
                    gender: updates.gender,
                    age: updates.age,
                    bio: updates.bio,
                    home_country: updates.homeCountry,
                    current_city: updates.currentCity,
                    photo_url: updates.photoUrl !== undefined ? (updates.photoUrl || '') : undefined,
                    destination: updates.destination,
                    start_date: updates.matchingStartDate,
                    end_date: updates.matchingEndDate,
                    budget_range: updates.profile?.budget ? {
                        'Low': 5000,
                        'Medium': 8000,
                        'High': 10000,
                    }[updates.profile.budget] : undefined,
                    interests: updates.profile?.interests?.join('|'),
                    travel_style: updates.profile?.travelStyle,
                    language_preference: updates.profile?.languagePreference,
                    discoverable: true,
                });
                devLog('Profile updated on backend');
                return true;
            } catch (error) {
                devError('Failed to update profile on backend:', error);
                return false;
            }
        }
        return true;
    };

    return (
        <AuthContext.Provider value={{ user, login, googleLogin, register, logout, updateProfile, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

