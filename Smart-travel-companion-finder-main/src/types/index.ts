export interface EmergencyAlert {
    alertId: string;
    userId: string;
    tripId?: string;
    location: {
        latitude: number;
        longitude: number;
        address: string;
    };
    alertType: 'SOS' | 'Medical' | 'Lost' | 'Theft' | 'Other';
    message: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    status: 'Active' | 'Acknowledged' | 'Resolved';
    createdAt: string;
    resolvedAt?: string;
    responders: string[]; // User IDs who responded
}

export interface Chat {
    chatId: string;
    participants: string[]; // User IDs
    matchId?: string;
    type: 'match';
    createdAt: string;
    lastMessage?: ChatMessage;
    isActive: boolean;
}

export interface ChatMessage {
    messageId: string;
    chatId: string;
    senderId: string;
    text: string;
    timestamp: string;
    messageType: 'text' | 'image' | 'location' | 'file';
    deliveryStatus?: 'sending' | 'sent' | 'failed';
    isEdited: boolean;
    editedAt?: string;
    readBy: string[]; // User IDs who read the message
    reactions: {
        emoji: string;
        userId: string;
    }[];
    replyTo?: {
        messageId: string;
        senderId: string;
        text: string;
    };
}

export interface Review {
    reviewId: string;
    matchId?: string;
    reviewerId: string;
    revieweeId: string;
    tripId?: string;
    rating: number; // 1-5
    comment: string;
    categories: {
        communication: number;
        reliability: number;
        compatibility: number;
        overall: number;
    };
    isPublic: boolean;
    createdAt: string;
    helpfulVotes: number;
}

export interface CompatibilityScore {
    overall: number; // 0-100
    components: {
        interestSimilarity: number;
        budgetCompatibility: number;
        travelStyleMatch: number;
        personalityMatch: number;
        scheduleOverlap: number;
        locationProximity: number;
        verificationBonus: number;
    };
    strengths: string[];
    concerns: string[];
    recommendations: string[];
}

export interface MatchingEngineResult {
    matches: Match[];
    summary: MatchSummary;
    processingTime: number;
    algorithmVersion: string;
}

export interface PlaceRequest {
    requestId: string;
    userId: string;
    userName: string;
    destination: string;
    placeImage: string;
    pinLat: number;
    pinLng: number;
    pinLabel: string;
    startDate: string;
    endDate: string;
    companionsNeeded: number;
    budget: Trip['budget'];
    travelType: Trip['travelType'];
    notes: string;
    createdAt: string;
    status: 'Open' | 'In Progress' | 'Closed';
    applicants: string[]; // User IDs who applied
}

export interface User {
    userId: string;
    name: string;
    email: string;
    phone?: string;
    age: number;
    gender: 'Male' | 'Female' | 'Non-Binary' | 'Other';
    destination?: string;
    matchingStartDate?: string;
    matchingEndDate?: string;
    verificationStatus: 'Verified' | 'Unverified' | 'Pending';
    bio: string;
    photoUrl?: string;
    homeCountry: string;
    currentCity: string;
    profile: TravelProfile;
    emergencyContacts?: {
        name: string;
        phone: string;
        relationship: string;
    }[];
    preferences: {
        notifications: boolean;
        locationSharing: boolean;
        publicProfile: boolean;
    };
    stats: {
        tripsCompleted: number;
        reviewsReceived: number;
        averageRating: number;
        responseRate: number;
    };
}

export interface TravelProfile {
    budget: 'Low' | 'Medium' | 'High';
    travelStyle: 'Backpacker' | 'Luxury' | 'Adventure' | 'Leisure' | 'Business';
    interests: string[]; // e.g., 'Nature', 'Food', 'History', 'Nightlife'
    personality?: 'Introvert' | 'Extrovert' | 'Ambivert';
    languagePreference?: string;
    dietaryRestrictions?: string[];
    accommodationPreference?: 'Hostel' | 'Hotel' | 'Airbnb' | 'Guesthouse';
    transportPreference?: 'Public' | 'Rental' | 'Walking' | 'Mixed';
    tripFrequency?: 'Rarely' | 'Occasionally' | 'Frequently';
}

export interface Trip {
    tripId: string;
    userId: string;
    destination: string;
    startDate: string; // ISO Date string
    endDate: string;   // ISO Date string
    travelType: 'Leisure' | 'Business' | 'Backpacker' | 'Adventure' | 'Luxury';
    budget: 'Low' | 'Medium' | 'High';
    status: 'Planning' | 'Active' | 'Completed' | 'Cancelled';
    description?: string;
    itinerary?: {
        day: number;
        activities: string[];
        location: string;
    }[];
}

export interface Match {
    matchId: string;
    tripId: string;
    user: User;
    score: number; // 0-100
    matchStatus: 'Recommended' | 'Pending' | 'Matched' | 'Rejected';
    pendingRole?: 'sent' | 'received';
    compatibilityScore: CompatibilityScore;
    matchDetails: {
        interestMatch: string[];
        budgetCompatibility: 'High' | 'Medium' | 'Low';
        dateOverlap: boolean;
        destinationMatch: boolean;
        styleMatch: boolean;
        personalityCompatibility: 'High' | 'Medium' | 'Low';
        languageMatch: boolean;
        locationProximity: 'Same City' | 'Nearby' | 'Different';
    };
    chatEnabled: boolean;
    canEndChat?: boolean;
    tripCompleted?: boolean;
    endChatAvailableOn?: string;
    createdAt: string;
    lastInteraction?: string;
}

export interface MatchSummary {
    totalCandidates: number;
    eligibleAfterFiltering: number;
    recommended: number;
    matched: number;
    averageScore: number;
    generatedAt: string;
    filters: {
        destination: string;
        dateRange: { start: string; end: string };
        budget: Trip['budget'];
        travelType: Trip['travelType'];
    };
}

