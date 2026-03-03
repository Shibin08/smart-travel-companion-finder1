/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { getUserIdFromToken, loginWithBackend, registerWithBackend, updateUserProfile, isTokenExpired, fetchMyProfile } from '../utils/apiClient';
import { devLog, devWarn, devError } from '../utils/devLogger';

const TOKEN_STORAGE_KEY = 'tcf_token';

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<boolean>;
    register: (email: string, password: string, name: string, gender?: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    updateProfile: (profile: Partial<User>) => Promise<boolean>;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        const stored = localStorage.getItem('tcf_user');
        if (!stored) return null;

        try {
            const parsed = JSON.parse(stored) as Partial<User>;
            // Ensure all required User fields exist (handles stale localStorage data)
            return {
                userId: parsed.userId ?? '',
                name: parsed.name ?? 'User',
                email: parsed.email ?? '',
                age: parsed.age ?? 25,
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
                    ? profile.budget_range <= 500 ? 'Low' : profile.budget_range <= 2000 ? 'Medium' : 'High'
                    : 'Medium';

                setUser({
                    userId: backendUserId,
                    email: profile.email || email,
                    name: profile.name || email.split('@')[0] || 'User',
                    age: profile.age ?? 25,
                    gender: (profile.gender as 'Male' | 'Female' | 'Non-Binary' | 'Other') || 'Other',
                    verificationStatus: 'Pending',
                    bio: profile.bio || '',
                    photoUrl: profile.photo_url || undefined,
                    homeCountry: profile.home_country || 'India',
                    currentCity: profile.current_city || 'Unknown',
                    destination: profile.destination || undefined,
                    profile: {
                        budget: budgetLabel as 'Low' | 'Medium' | 'High',
                        travelStyle: profile.travel_style || 'Adventure',
                        interests: profile.interests ? profile.interests.split(',').map((s) => s.trim()) : [],
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
                    age: 25,
                    gender: 'Other',
                    verificationStatus: 'Pending',
                    bio: '',
                    photoUrl: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?auto=format&fit=crop&q=80&w=250&h=250',
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

    const register = async (email: string, password: string, name: string, gender: string = 'Other'): Promise<{ success: boolean; error?: string }> => {
        if (!email || !password || !name) {
            return { success: false, error: 'All fields are required' };
        }

        try {
            devLog('Registering user:', email);
            await registerWithBackend(email, password, name, gender);
            devLog('Registration successful, attempting login...');
            
            // After successful registration, automatically log the user in
            const response = await loginWithBackend(email, password);
            localStorage.setItem(TOKEN_STORAGE_KEY, response.access_token);
            const backendUserId = getUserIdFromToken(response.access_token);

            if (!backendUserId) {
                return { success: false, error: 'Failed to get user ID from token' };
            }

            // Get default photo based on gender
            const defaultPhotoUrl = gender === 'Male'
                ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250&h=250'
                : gender === 'Female'
                ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250&h=250'
                : 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?auto=format&fit=crop&q=80&w=250&h=250';

            setUser({
                userId: backendUserId,
                email,
                name,
                age: 25,
                gender: (gender as 'Male' | 'Female' | 'Non-Binary' | 'Other') || 'Other',
                verificationStatus: 'Pending',
                bio: '',
                photoUrl: defaultPhotoUrl,
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

    const updateProfile = async (updates: Partial<User>): Promise<boolean> => {
        if (!user) return false;

        const updatedUser = {
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
                    budget_range: updates.profile?.budget ? {
                        'Low': 500,
                        'Medium': 2000,
                        'High': 5000,
                    }[updates.profile.budget] : undefined,
                    interests: updates.profile?.interests?.join(','),
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
        <AuthContext.Provider value={{ user, login, register, logout, updateProfile, isAuthenticated: !!user }}>
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
