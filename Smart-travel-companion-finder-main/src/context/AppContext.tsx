/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import type { ChatMessage, Match, MatchSummary, PlaceRequest, Review, Trip } from '../types';
import { useAuth } from './AuthContext';
import { mockUsers } from '../data/mockUsers';
import { mockTrips } from '../data/mockTrips';
import { runAdvancedMatchingPipeline, validateTripInput } from '../utils/advancedMatchingAlgorithm';
import {
    acceptMatch,
    createPlaceRequest,
    fetchConversation,
    fetchMatches,
    fetchPlaceRequests,
    fetchRecommendations,
    sendChatMessage,
    updateMatchStatusBackend,
    type BackendMatchRecord,
    type TripSearchParams,
} from '../utils/apiClient';

interface AppContextType {
    currentTrip: Trip | null;
    createTrip: (trip: Trip) => boolean;
    matches: Match[];
    generateMatches: (tripOverride?: Trip) => void;
    isMatching: boolean;
    matchError: string | null;
    matchSummary: MatchSummary | null;
    validationErrors: string[];
    updateMatchStatus: (matchId: string, status: Match['matchStatus']) => Promise<boolean>;
    getMatchById: (matchId: string) => Match | undefined;
    getMessagesForMatch: (matchId: string) => ChatMessage[];
    loadMessagesForMatch: (matchId: string) => Promise<void>;
    sendMessage: (matchId: string, senderId: string, text: string) => void;
    addReview: (matchId: string, reviewerId: string, rating: number, comment: string) => void;
    getReviewByMatch: (matchId: string) => Review | undefined;
    placeRequests: PlaceRequest[];
    addPlaceRequest: (request: Omit<PlaceRequest, 'requestId' | 'createdAt'>) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'tcf_token';

const normalizeBudget = (score: number): Trip['budget'] => {
    if (score >= 80) return 'High';
    if (score >= 60) return 'Medium';
    return 'Low';
};

const scoreToMatchStatus = (score: number): Match['matchStatus'] => {
    if (score >= 80) return 'Matched';
    if (score >= 55) return 'Recommended';
    return 'Pending';
};

const buildFallbackUser = (id: string, name: string, score: number, photoUrl?: string, gender?: string): Match['user'] => ({
    userId: id,
    name,
    email: `${id.toLowerCase()}@example.com`,
    age: 27,
    gender: gender || 'Other',
    photoUrl: photoUrl || undefined,
    verificationStatus: 'Pending',
    bio: 'Companion profile from backend recommendation.',
    homeCountry: 'India',
    currentCity: 'Unknown',
    profile: {
        budget: normalizeBudget(score),
        travelStyle: 'Standard',
        interests: ['Travel'],
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

const mapBackendScore = (rawScore: number): number => {
    if (Number.isNaN(rawScore) || rawScore < 0) return 0;
    if (rawScore <= 1) return Math.round(rawScore * 100);
    return Math.round(Math.min(rawScore, 100));
};

const mapBackendStatusToUi = (status: BackendMatchRecord['status']): Match['matchStatus'] => {
    if (status === 'accepted') return 'Matched';
    if (status === 'rejected' || status === 'cancelled') return 'Rejected';
    return 'Pending';
};

const mapUiStatusToBackend = (status: Match['matchStatus']): BackendMatchRecord['status'] => {
    if (status === 'Matched') return 'accepted';
    if (status === 'Rejected') return 'rejected';
    if (status === 'Pending') return 'pending';
    return 'pending';
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://127.0.0.1:8000';

import { resolvePhoto as resolvePhotoUrl } from '../utils/photoUtils';
import { devLog, devError } from '../utils/devLogger';

const resolveUserFromBackend = (backendUserId: string, backendName: string, score: number, photoUrl?: string, gender?: string): Match['user'] => {
    const fullPhotoUrl = resolvePhotoUrl(photoUrl);
    const existingUser = mockUsers.find((candidate) => candidate.userId.toLowerCase() === backendUserId.toLowerCase())
        ?? mockUsers.find((candidate) => candidate.name.toLowerCase() === backendName.toLowerCase());

    if (existingUser) {
        // Override photoUrl from backend if available
        if (fullPhotoUrl) {
            return { ...existingUser, photoUrl: fullPhotoUrl };
        }
        return existingUser;
    }

    return buildFallbackUser(backendUserId, backendName, score, fullPhotoUrl, gender);
};

const mapBackendMessage = (matchId: string, raw: { message_id: number; sender_id: string; message_text: string; timestamp: string }): ChatMessage => ({
    messageId: `api-${raw.message_id}`,
    chatId: matchId,
    senderId: raw.sender_id,
    text: raw.message_text,
    timestamp: raw.timestamp,
    messageType: 'text',
    isEdited: false,
    readBy: [raw.sender_id],
    reactions: [],
});

export function AppProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [isMatching, setIsMatching] = useState(false);
    const [matchError, setMatchError] = useState<string | null>(null);
    const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [messagesByMatch, setMessagesByMatch] = useState<Record<string, ChatMessage[]>>({});
    const [backendMatchIdByLocalId, setBackendMatchIdByLocalId] = useState<Record<string, number>>({});
    const [reviews, setReviews] = useState<Review[]>([]);
    const [placeRequests, setPlaceRequests] = useState<PlaceRequest[]>([
        {
            requestId: 'pr-1',
            userId: 'u5',
            userName: 'Priya Patel',
            destination: 'Kerala',
            placeImage: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&q=80&w=900',
            pinLat: 10.1632,
            pinLng: 76.6413,
            pinLabel: 'Kerala',
            startDate: '2026-03-10',
            endDate: '2026-03-15',
            companionsNeeded: 2,
            budget: 'Medium',
            travelType: 'Leisure',
            notes: 'Looking for easy-going travelers for nature and café hopping.',
            createdAt: new Date().toISOString(),
            status: 'Open',
            applicants: [],
        },
        {
            requestId: 'pr-2',
            userId: 'u2',
            userName: 'Mike Ross',
            destination: 'Ladakh',
            placeImage: 'https://images.unsplash.com/photo-1482164565953-04b62dc3dfdf?auto=format&fit=crop&q=80&w=900',
            pinLat: 34.1526,
            pinLng: 77.5771,
            pinLabel: 'Ladakh',
            startDate: '2026-04-02',
            endDate: '2026-04-08',
            companionsNeeded: 3,
            budget: 'Medium',
            travelType: 'Adventure',
            notes: 'Road trip + trekking. Need active buddies comfortable with altitude.',
            createdAt: new Date().toISOString(),
            status: 'Open',
            applicants: [],
        },
    ]);

    const createTrip = (trip: Trip): boolean => {
        const errors = validateTripInput(trip);
        setValidationErrors(errors);

        if (errors.length > 0) {
            return false;
        }

        setCurrentTrip(trip);
        return true;
    };

    const mapBackendRecordToMatch = (record: BackendMatchRecord, tripId: string): Match => {
        const score = mapBackendScore(record.compatibility_score);
        const resolvedUser = resolveUserFromBackend(record.other_user.user_id, record.other_user.name, score);
        const status = mapBackendStatusToUi(record.status);

        return {
            matchId: `api-${record.other_user.user_id}`,
            tripId,
            user: resolvedUser,
            score,
            matchStatus: status,
            compatibilityScore: {
                overall: score,
                components: {
                    interestSimilarity: score / 100,
                    budgetCompatibility: score / 100,
                    travelStyleMatch: score / 100,
                    personalityMatch: score / 100,
                    scheduleOverlap: score / 100,
                    locationProximity: score / 100,
                    verificationBonus: resolvedUser.verificationStatus === 'Verified' ? 0.1 : 0,
                },
                strengths: status === 'Matched' ? ['Confirmed match from backend'] : [],
                concerns: [],
                recommendations: ['Open match details to coordinate your trip plan'],
            },
            matchDetails: {
                interestMatch: resolvedUser.profile.interests.slice(0, 3),
                budgetCompatibility: score >= 75 ? 'High' : score >= 55 ? 'Medium' : 'Low',
                dateOverlap: true,
                destinationMatch: true,
                styleMatch: true,
                personalityCompatibility: score >= 75 ? 'High' : score >= 55 ? 'Medium' : 'Low',
                languageMatch: true,
                locationProximity: resolvedUser.currentCity === user?.currentCity ? 'Same City' : 'Different',
            },
            chatEnabled: score >= 40,
            createdAt: record.created_at,
        };
    };

    const hydrateBackendMatches = async () => {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (!token || !user) {
            return;
        }

        try {
            const backendMatchState = await fetchMatches(token);
            const tripId = currentTrip?.tripId ?? `persisted-${Date.now()}`;
            const hydratedMatches = backendMatchState.matches.map((item) => mapBackendRecordToMatch(item, tripId));

            setMatches((prev) => {
                const nonBackend = prev.filter((match) => !match.matchId.startsWith('api-'));
                const mergedById = new Map<string, Match>();
                [...nonBackend, ...hydratedMatches].forEach((match) => {
                    mergedById.set(match.matchId, match);
                });
                return Array.from(mergedById.values());
            });

            setBackendMatchIdByLocalId((prev) => {
                const next = { ...prev };
                backendMatchState.matches.forEach((item) => {
                    next[`api-${item.other_user.user_id}`] = item.match_id;
                });
                return next;
            });
        } catch {
            // keep current local state when backend hydration is unavailable
        }
    };

    useEffect(() => {
        void hydrateBackendMatches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.userId]);

    useEffect(() => {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (!token || !user) {
            return;
        }

        void (async () => {
            try {
                const response = await fetchPlaceRequests(token);
                setPlaceRequests(
                    response.requests.map((item) => ({
                        requestId: String(item.request_id),
                        userId: item.user_id,
                        userName: item.user_name,
                        destination: item.destination,
                        placeImage: item.place_image,
                        pinLat: item.pin_lat,
                        pinLng: item.pin_lng,
                        pinLabel: item.pin_label,
                        startDate: item.start_date,
                        endDate: item.end_date,
                        companionsNeeded: item.companions_needed,
                        budget: item.budget as Trip['budget'],
                        travelType: item.travel_type as Trip['travelType'],
                        notes: item.notes,
                        createdAt: item.created_at,
                        status: item.status as PlaceRequest['status'],
                        applicants: item.applicants,
                    })),
                );
            } catch {
                // keep existing local seed data if backend fetch fails
            }
        })();
    }, [user]);

    const generateMatches = (tripOverride?: Trip) => {
        const tripToMatch = tripOverride ?? currentTrip;

        if (user && tripToMatch) {
            setIsMatching(true);
            setMatchError(null);
            const previousStatusMap = new Map(matches.map((m) => [m.matchId, m.matchStatus]));

            const runLocalMatching = () => {
                const result = runAdvancedMatchingPipeline(user, tripToMatch, mockUsers, mockTrips);

                setMatches(
                    result.matches.map((match) => ({
                        ...match,
                        matchStatus:
                            previousStatusMap.get(match.matchId) === 'Matched'
                                ? 'Matched'
                                : previousStatusMap.get(match.matchId) === 'Rejected'
                                    ? 'Rejected'
                                    : match.matchStatus,
                    })),
                );
                setMatchSummary(result.summary);
                setTimeout(() => setIsMatching(false), 500);
            };

            const token = localStorage.getItem(TOKEN_STORAGE_KEY);
            if (!token) {
                setMatchError('You are not logged in. Please log out and log back in to search for companions.');
                setMatches([]);
                setMatchSummary(null);
                setIsMatching(false);
                return;
            }

            void (async () => {
                try {
                    // Build trip search params from the form trip
                    const tripSearchParams: TripSearchParams = {
                        destination: tripToMatch.destination,
                        start_date: tripToMatch.startDate,
                        end_date: tripToMatch.endDate,
                        budget: tripToMatch.budget,
                        travel_style: tripToMatch.travelType,
                    };

                    devLog('[generateMatches] Fetching recommendations with trip params:', tripSearchParams);

                    const [backend, backendMatchState] = await Promise.all([
                        fetchRecommendations(token, tripSearchParams),
                        fetchMatches(token),
                    ]);

                    devLog('[generateMatches] Backend returned', backend.matches.length, 'recommendations and', backendMatchState.matches.length, 'existing matches');

                    const backendByOtherUserId = new Map(
                        backendMatchState.matches.map((item) => [item.other_user.user_id.toLowerCase(), item]),
                    );
                    const nextBackendIdByLocalId: Record<string, number> = {};

                    const mappedMatches: Match[] = backend.matches.map((item) => {
                        const score = mapBackendScore(item.compatibility_score);
                        const existingBackendMatch = backendByOtherUserId.get(item.user_id.toLowerCase());
                        const resolvedUser = resolveUserFromBackend(item.user_id, item.name, score, item.photo_url, item.gender);
                        const matchId = `api-${item.user_id}`;
                        const resolvedStatus = existingBackendMatch
                            ? mapBackendStatusToUi(existingBackendMatch.status)
                            : scoreToMatchStatus(score);
                        if (existingBackendMatch) {
                            nextBackendIdByLocalId[matchId] = existingBackendMatch.match_id;
                        }

                        return {
                            matchId,
                            tripId: tripToMatch.tripId,
                            user: resolvedUser,
                            score,
                            matchStatus: previousStatusMap.get(matchId) ?? resolvedStatus,
                            compatibilityScore: {
                                overall: score,
                                components: {
                                    interestSimilarity: score / 100,
                                    budgetCompatibility: score / 100,
                                    travelStyleMatch: score / 100,
                                    personalityMatch: score / 100,
                                    scheduleOverlap: score / 100,
                                    locationProximity: score / 100,
                                    verificationBonus: resolvedUser.verificationStatus === 'Verified' ? 0.1 : 0,
                                },
                                strengths: score >= 75 ? ['High backend compatibility score'] : [],
                                concerns: score < 55 ? ['Low compatibility score from backend'] : [],
                                recommendations: ['Check itinerary details before confirming match'],
                            },
                            matchDetails: {
                                interestMatch: resolvedUser.profile.interests.slice(0, 3),
                                budgetCompatibility: score >= 75 ? 'High' : score >= 55 ? 'Medium' : 'Low',
                                dateOverlap: true,
                                destinationMatch: true,
                                styleMatch: true,
                                personalityCompatibility: score >= 75 ? 'High' : score >= 55 ? 'Medium' : 'Low',
                                languageMatch: true,
                                locationProximity: resolvedUser.currentCity === user.currentCity ? 'Same City' : 'Different',
                            },
                            chatEnabled: score >= 40,
                            createdAt: existingBackendMatch?.created_at ?? new Date().toISOString(),
                        };
                    });

                    const existingMap = new Map(mappedMatches.map((item) => [item.matchId, item]));
                    backendMatchState.matches.forEach((record) => {
                        const localId = `api-${record.other_user.user_id}`;
                        if (!existingMap.has(localId)) {
                            existingMap.set(localId, mapBackendRecordToMatch(record, tripToMatch.tripId));
                        }
                        nextBackendIdByLocalId[localId] = record.match_id;
                    });

                    const mergedMatches = Array.from(existingMap.values());

                    setMatches(mergedMatches);
                    setBackendMatchIdByLocalId((prev) => ({ ...prev, ...nextBackendIdByLocalId }));
                    setMatchSummary({
                        totalCandidates: mergedMatches.length,
                        eligibleAfterFiltering: mergedMatches.length,
                        recommended: mergedMatches.filter((match) => match.matchStatus === 'Recommended').length,
                        matched: mergedMatches.filter((match) => match.matchStatus === 'Matched').length,
                        averageScore: mergedMatches.length > 0
                            ? Math.round(mergedMatches.reduce((sum, match) => sum + match.score, 0) / mergedMatches.length)
                            : 0,
                        generatedAt: new Date().toISOString(),
                        filters: {
                            destination: tripToMatch.destination,
                            dateRange: { start: tripToMatch.startDate, end: tripToMatch.endDate },
                            budget: tripToMatch.budget,
                            travelType: tripToMatch.travelType,
                        },
                    });
                    setTimeout(() => setIsMatching(false), 400);
                } catch (err: unknown) {
                    devError('[generateMatches] Backend call failed:', err);
                    const errMsg = err instanceof Error ? err.message : String(err);

                    if (errMsg.includes('401') || errMsg.toLowerCase().includes('unauthorized') || errMsg.toLowerCase().includes('expired') || errMsg.toLowerCase().includes('token')) {
                        // Session expired — force full logout and redirect to login
                        localStorage.removeItem(TOKEN_STORAGE_KEY);
                        localStorage.removeItem('tcf_user');
                        window.location.reload();
                        return;
                    } else {
                        setMatchError(`Could not fetch companions from server: ${errMsg}. Please check if the backend is running and try again.`);
                    }
                    setMatches([]);
                    setMatchSummary(null);
                    setIsMatching(false);
                }
            })();
        }
    };

    const updateMatchStatus = async (matchId: string, status: Match['matchStatus']): Promise<boolean> => {
        const selected = matches.find((item) => item.matchId === matchId);
        if (!selected) {
            return false;
        }

        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        const targetBackendStatus = mapUiStatusToBackend(status);
        let resolvedBackendMatchId = backendMatchIdByLocalId[matchId];

        try {
            if (token) {
                if (status === 'Matched') {
                    if (!resolvedBackendMatchId) {
                        const created = await acceptMatch(token, selected.user.userId, selected.score);
                        resolvedBackendMatchId = created.match_id;
                    }

                    if (resolvedBackendMatchId) {
                        await updateMatchStatusBackend(token, resolvedBackendMatchId, 'accepted');
                    }
                } else if (resolvedBackendMatchId) {
                    await updateMatchStatusBackend(token, resolvedBackendMatchId, targetBackendStatus);
                }
            }
        } catch {
            return false;
        }

        if (resolvedBackendMatchId) {
            setBackendMatchIdByLocalId((prev) => ({
                ...prev,
                [matchId]: resolvedBackendMatchId!,
            }));
        }

        setMatches((prev) =>
            prev.map((item) => {
                if (item.matchId !== matchId) return item;
                return {
                    ...item,
                    matchStatus: status,
                    chatEnabled: item.score >= 40,
                };
            }),
        );

        if (status === 'Matched') {
            setMessagesByMatch((prev) => {
                const existing = prev[matchId] ?? [];
                if (existing.length > 0) return prev;

                return {
                    ...prev,
                    [matchId]: [
                        {
                            messageId: `${matchId}-msg-1`,
                            chatId: matchId,
                            senderId: selected.user.userId,
                            text: `Hi! Glad we matched. Want to align a plan for ${currentTrip?.destination ?? 'the trip'}?`,
                            timestamp: new Date().toISOString(),
                            messageType: 'text',
                            isEdited: false,
                            readBy: [selected.user.userId],
                            reactions: [],
                        },
                    ],
                };
            });
        }

        return true;
    };

    const getMatchById = (matchId: string) => matches.find((m) => m.matchId === matchId);

    const getMessagesForMatch = (matchId: string) => messagesByMatch[matchId] ?? [];

    const loadMessagesForMatch = async (matchId: string) => {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        const matchedUserId = matches.find((match) => match.matchId === matchId)?.user.userId;

        if (!token || !matchedUserId) {
            return;
        }

        try {
            const backendMessages = await fetchConversation(token, matchedUserId);
            setMessagesByMatch((prev) => ({
                ...prev,
                [matchId]: backendMessages.map((message) => mapBackendMessage(matchId, message)),
            }));
        } catch {
            // keep existing local messages if backend conversation fetch fails
        }
    };

    const sendMessage = (matchId: string, senderId: string, text: string) => {
        const message: ChatMessage = {
            messageId: `${matchId}-${Date.now()}`,
            chatId: matchId,
            senderId,
            text,
            timestamp: new Date().toISOString(),
            messageType: 'text',
            isEdited: false,
            readBy: [senderId],
            reactions: [],
        };

        setMessagesByMatch((prev) => ({
            ...prev,
            [matchId]: [...(prev[matchId] ?? []), message],
        }));

        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        const matchedUserId = matches.find((match) => match.matchId === matchId)?.user.userId;

        if (token && matchedUserId && senderId === user?.userId) {
            void sendChatMessage(token, matchedUserId, text).catch(() => {
                // local optimistic message remains when backend call fails
            });
        }
    };

    const addReview = (matchId: string, reviewerId: string, rating: number, comment: string) => {
        const existing = reviews.find((review) => review.matchId === matchId && review.reviewerId === reviewerId);
        const match = matches.find((item) => item.matchId === matchId);
        const revieweeId = match?.user.userId ?? reviewerId;

        if (existing) {
            setReviews((prev) =>
                prev.map((review) =>
                    review.reviewId === existing.reviewId
                        ? { ...review, rating, comment, createdAt: new Date().toISOString() }
                        : review,
                ),
            );
            return;
        }

        setReviews((prev) => [
            ...prev,
            {
                reviewId: `r-${matchId}-${reviewerId}`,
                matchId,
                reviewerId,
                revieweeId,
                categories: {
                    communication: rating,
                    reliability: rating,
                    compatibility: rating,
                    overall: rating,
                },
                isPublic: true,
                rating,
                comment,
                createdAt: new Date().toISOString(),
                helpfulVotes: 0,
            },
        ]);
    };

    const getReviewByMatch = (matchId: string) => reviews.find((review) => review.matchId === matchId);

    const addPlaceRequest = (request: Omit<PlaceRequest, 'requestId' | 'createdAt'>): boolean => {
        if (!request.destination.trim() || !request.notes.trim() || request.companionsNeeded < 1) {
            return false;
        }

        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (token && user) {
            void (async () => {
                try {
                    const created = await createPlaceRequest(token, {
                        destination: request.destination,
                        place_image: request.placeImage,
                        pin_lat: request.pinLat,
                        pin_lng: request.pinLng,
                        pin_label: request.pinLabel,
                        start_date: request.startDate,
                        end_date: request.endDate,
                        companions_needed: request.companionsNeeded,
                        budget: request.budget,
                        travel_type: request.travelType,
                        notes: request.notes,
                        status: request.status,
                    });

                    setPlaceRequests((prev) => [
                        {
                            requestId: String(created.request_id),
                            userId: created.user_id,
                            userName: created.user_name,
                            destination: created.destination,
                            placeImage: created.place_image,
                            pinLat: created.pin_lat,
                            pinLng: created.pin_lng,
                            pinLabel: created.pin_label,
                            startDate: created.start_date,
                            endDate: created.end_date,
                            companionsNeeded: created.companions_needed,
                            budget: created.budget as Trip['budget'],
                            travelType: created.travel_type as Trip['travelType'],
                            notes: created.notes,
                            createdAt: created.created_at,
                            status: created.status as PlaceRequest['status'],
                            applicants: created.applicants,
                        },
                        ...prev.filter((item) => item.requestId !== `local-${request.userId}-${request.destination}-${request.startDate}`),
                    ]);
                } catch {
                    // keep optimistic local item when backend write fails
                }
            })();
        }

        setPlaceRequests((prev) => [
            {
                ...request,
                requestId: `local-${request.userId}-${request.destination}-${request.startDate}`,
                createdAt: new Date().toISOString(),
            },
            ...prev,
        ]);

        return true;
    };

    const value = useMemo(() => ({
        currentTrip,
        createTrip,
        matches,
        generateMatches,
        isMatching,
        matchError,
        matchSummary,
        validationErrors,
        updateMatchStatus,
        getMatchById,
        getMessagesForMatch,
        loadMessagesForMatch,
        sendMessage,
        addReview,
        getReviewByMatch,
        placeRequests,
        addPlaceRequest,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [currentTrip, matches, isMatching, matchError, matchSummary, validationErrors, placeRequests, messagesByMatch, reviews, backendMatchIdByLocalId, user]);

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
