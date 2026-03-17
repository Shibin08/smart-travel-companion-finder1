import type { User } from '../types';

const defaultPreferences = {
    notifications: true,
    locationSharing: true,
    publicProfile: true,
};

const defaultStats = {
    tripsCompleted: 0,
    reviewsReceived: 0,
    averageRating: 0,
    responseRate: 0,
};

type RawUser = Omit<User, 'preferences' | 'stats'> & Partial<Pick<User, 'preferences' | 'stats'>>;

const rawUsers: RawUser[] = [
    {
        userId: 'u1',
        name: 'Sarah Chen',
        email: 'sarah@example.com',
        phone: '+91-9876543210',
        age: 28,
        gender: 'Female',
        verificationStatus: 'Verified',
        bio: 'Love exploring local food and hidden gems.',
        photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
        homeCountry: 'India',
        currentCity: 'Bengaluru',
        emergencyContacts: [
            { name: 'Michael Chen', phone: '+91-9876543211', relationship: 'Spouse' },
            { name: 'Emily Chen', phone: '+91-9876543212', relationship: 'Sister' }
        ],
        preferences: {
            notifications: true,
            locationSharing: true,
            publicProfile: true,
        },
        stats: {
            tripsCompleted: 12,
            reviewsReceived: 8,
            averageRating: 4.6,
            responseRate: 95,
        },
        profile: {
            budget: 'Medium',
            travelStyle: 'Leisure',
            interests: ['Food', 'Culture', 'Photography'],
            personality: 'Extrovert',
            languagePreference: 'English',
            dietaryRestrictions: ['Vegetarian'],
            accommodationPreference: 'Hotel',
            transportPreference: 'Mixed',
            tripFrequency: 'Frequently',
        }
    },
    {
        userId: 'u2',
        name: 'Mike Ross',
        email: 'mike@example.com',
        phone: '+91-9876543213',
        age: 32,
        gender: 'Male',
        verificationStatus: 'Verified',
        bio: 'Adventure seeker. Always up for a hike.',
        photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
        homeCountry: 'India',
        currentCity: 'Pune',
        emergencyContacts: [
            { name: 'Jennifer Ross', phone: '+91-9876543214', relationship: 'Sister' }
        ],
        preferences: {
            notifications: true,
            locationSharing: true,
            publicProfile: true,
        },
        stats: {
            tripsCompleted: 18,
            reviewsReceived: 15,
            averageRating: 4.8,
            responseRate: 88,
        },
        profile: {
            budget: 'Medium',
            travelStyle: 'Adventure',
            interests: ['Nature', 'Hiking', 'Adventure'],
            personality: 'Extrovert',
            languagePreference: 'English',
            dietaryRestrictions: [],
            accommodationPreference: 'Hostel',
            transportPreference: 'Public',
            tripFrequency: 'Frequently',
        }
    },
    {
        userId: 'u3',
        name: 'Elena Rodriguez',
        email: 'elena@example.com',
        age: 26,
        gender: 'Female',
        verificationStatus: 'Verified',
        bio: 'Backpacker on a budget.',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
        homeCountry: 'India',
        currentCity: 'Mumbai',
        profile: {
            budget: 'Low',
            travelStyle: 'Backpacker',
            interests: ['Nature', 'History', 'Meeting People'],
            personality: 'Ambivert',
            languagePreference: 'Hindi',
        }
    },
    {
        userId: 'u4',
        name: 'David Kim',
        email: 'david@example.com',
        age: 30,
        gender: 'Male',
        verificationStatus: 'Unverified',
        bio: 'Luxury traveler looking for comfort.',
        photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
        homeCountry: 'India',
        currentCity: 'Delhi',
        profile: {
            budget: 'High',
            travelStyle: 'Luxury',
            interests: ['Food', 'Shopping', 'Relaxation'],
            personality: 'Introvert',
            languagePreference: 'English',
        }
    },
    {
        userId: 'u5',
        name: 'Priya Patel',
        email: 'priya@example.com',
        age: 29,
        gender: 'Female',
        verificationStatus: 'Verified',
        bio: 'Digital nomad exploring the world.',
        photoUrl: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&q=80&w=200',
        homeCountry: 'India',
        currentCity: 'Hyderabad',
        profile: {
            budget: 'Medium',
            travelStyle: 'Leisure',
            interests: ['Technology', 'Cafes', 'Culture'],
            personality: 'Ambivert',
            languagePreference: 'English',
        }
    },
    {
        userId: 'u6',
        name: 'James Wilson',
        email: 'james@example.com',
        age: 35,
        gender: 'Male',
        verificationStatus: 'Verified',
        bio: 'History buff and museum lover.',
        photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200',
        homeCountry: 'India',
        currentCity: 'Chennai',
        profile: {
            budget: 'Medium',
            travelStyle: 'Leisure',
            interests: ['History', 'Museums', 'Art'],
            personality: 'Introvert',
            languagePreference: 'English',
        }
    },
    {
        userId: 'u7',
        name: 'Lisa Wang',
        email: 'lisa@example.com',
        age: 24,
        gender: 'Female',
        verificationStatus: 'Verified',
        bio: 'Party animal and beach lover.',
        photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200',
        homeCountry: 'India',
        currentCity: 'Kochi',
        profile: {
            budget: 'Low',
            travelStyle: 'Backpacker',
            interests: ['Nightlife', 'Beaches', 'Music'],
            personality: 'Extrovert',
            languagePreference: 'English',
        }
    },
    {
        userId: 'u8',
        name: 'Tom Baker',
        email: 'tom@example.com',
        age: 40,
        gender: 'Male',
        verificationStatus: 'Verified',
        bio: 'Foodie and wine connoisseur.',
        photoUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&q=80&w=200',
        homeCountry: 'India',
        currentCity: 'Goa',
        profile: {
            budget: 'High',
            travelStyle: 'Luxury',
            interests: ['Food', 'Wine', 'Fine Dining'],
            personality: 'Ambivert',
            languagePreference: 'English',
        }
    },
    {
        userId: 'u9',
        name: 'Anna Schmidt',
        email: 'anna@example.com',
        age: 27,
        gender: 'Female',
        verificationStatus: 'Verified',
        bio: 'Nature enthusiast and photographer.',
        photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
        homeCountry: 'Germany',
        currentCity: 'Bengaluru',
        profile: {
            budget: 'Medium',
            travelStyle: 'Adventure',
            interests: ['Photography', 'Nature', 'Wilderness'],
            personality: 'Introvert',
            languagePreference: 'German',
        }
    },
    {
        userId: 'u10',
        name: 'Carlos Mendez',
        email: 'carlos@example.com',
        age: 31,
        gender: 'Male',
        verificationStatus: 'Verified',
        bio: 'Surfer and beach bum.',
        photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200',
        homeCountry: 'Spain',
        currentCity: 'Goa',
        profile: {
            budget: 'Low',
            travelStyle: 'Backpacker',
            interests: ['Surfing', 'Beaches', 'Sports'],
            personality: 'Extrovert',
            languagePreference: 'Spanish',
        }
    },
    {
        userId: 'u11',
        name: 'Nina Kapoor',
        email: 'nina@example.com',
        age: 27,
        gender: 'Female',
        verificationStatus: 'Verified',
        bio: 'Yoga lover and sunrise chaser. Prefer calm itineraries.',
        photoUrl: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&q=80&w=200',
        homeCountry: 'India',
        currentCity: 'Rishikesh',
        profile: {
            budget: 'Medium',
            travelStyle: 'Leisure',
            interests: ['Yoga', 'Nature', 'Wellness'],
            personality: 'Introvert',
            languagePreference: 'English',
        }
    },
    {
        userId: 'u12',
        name: 'Arjun Singh',
        email: 'arjun@example.com',
        age: 33,
        gender: 'Male',
        verificationStatus: 'Verified',
        bio: 'Weekend biker and mountain explorer.',
        photoUrl: 'https://images.unsplash.com/photo-1504257432389-52343af06ae3?auto=format&fit=crop&q=80&w=200',
        homeCountry: 'India',
        currentCity: 'Chandigarh',
        profile: {
            budget: 'Medium',
            travelStyle: 'Adventure',
            interests: ['Roadtrip', 'Mountains', 'Photography'],
            personality: 'Extrovert',
            languagePreference: 'Hindi',
        }
    },
    {
        userId: 'u13',
        name: 'Meera Iyer',
        email: 'meera@example.com',
        age: 31,
        gender: 'Female',
        verificationStatus: 'Verified',
        bio: 'Culture walks, food markets and local art are my thing.',
        photoUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=200',
        homeCountry: 'India',
        currentCity: 'Chennai',
        profile: {
            budget: 'High',
            travelStyle: 'Luxury',
            interests: ['Food', 'Art', 'Culture'],
            personality: 'Ambivert',
            languagePreference: 'English',
        }
    },
    {
        userId: 'u14',
        name: 'Ibrahim Khan',
        email: 'ibrahim@example.com',
        age: 36,
        gender: 'Male',
        verificationStatus: 'Pending',
        bio: 'Budget traveler, hostel fan, and train-route planner.',
        photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
        homeCountry: 'India',
        currentCity: 'Lucknow',
        profile: {
            budget: 'Low',
            travelStyle: 'Backpacker',
            interests: ['History', 'Street Food', 'Backpacker'],
            personality: 'Ambivert',
            languagePreference: 'Hindi',
        }
    },
    {
        userId: 'u15',
        name: 'Sophie Martin',
        email: 'sophie@example.com',
        age: 30,
        gender: 'Female',
        verificationStatus: 'Verified',
        bio: 'Remote worker balancing cafes and coastal sunsets.',
        photoUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=200',
        homeCountry: 'France',
        currentCity: 'Pondicherry',
        profile: {
            budget: 'Medium',
            travelStyle: 'Leisure',
            interests: ['Cafes', 'Beaches', 'Photography'],
            personality: 'Extrovert',
            languagePreference: 'French',
        }
    }
];

export const mockUsers: User[] = rawUsers.map((user) => ({
    ...user,
    // Use one neutral avatar for all mock profiles to avoid real-person photos.
    photoUrl: '/default-avatar.svg',
    preferences: user.preferences ?? { ...defaultPreferences },
    stats: user.stats ?? { ...defaultStats },
}));

// Current user mock (you)
export const currentUserMock: User = {
    userId: 'me',
    name: 'Alex Johnson',
    email: 'alex@example.com',
    phone: '+91-9876543299',
    age: 29,
    gender: 'Male',
    verificationStatus: 'Verified',
    bio: 'Starting a new journey. Looking for a buddy.',
    photoUrl: '/default-avatar.svg',
    homeCountry: 'India',
    currentCity: 'Bengaluru',
    emergencyContacts: [
        { name: 'Sarah Johnson', phone: '+91-9876543300', relationship: 'Spouse' },
        { name: 'Dr. Smith', phone: '+91-9876543301', relationship: 'Emergency Contact' }
    ],
    preferences: {
        notifications: true,
        locationSharing: true,
        publicProfile: true,
    },
    stats: {
        tripsCompleted: 5,
        reviewsReceived: 3,
        averageRating: 4.2,
        responseRate: 92,
    },
    profile: {
        budget: 'Medium',
        travelStyle: 'Adventure',
        interests: ['Adventure', 'Food', 'Culture'],
        personality: 'Ambivert',
        languagePreference: 'English',
        dietaryRestrictions: [],
        accommodationPreference: 'Airbnb',
        transportPreference: 'Mixed',
        tripFrequency: 'Occasionally',
    }
};


