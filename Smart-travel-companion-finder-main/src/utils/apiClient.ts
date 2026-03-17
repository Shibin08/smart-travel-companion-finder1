const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000';

import { devLog, devError } from './devLogger';

export interface BackendLoginResponse {
  access_token: string;
  token_type: string;
}

export interface BackendRegisterResponse {
  user_id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface BackendScoreBreakdown {
  destination: number;
  dates: number;
  budget: number;
  interests: number;
  travel_style: number;
  age: number;
}

export interface BackendRecommendMatch {
  user_id: string;
  name: string;
  compatibility_score: number;
  score_breakdown?: BackendScoreBreakdown;
  photo_url?: string;
  gender?: string;
  age?: number;
  travel_style?: string;
  interests?: string;
  budget_range?: number;
  home_country?: string;
  current_city?: string;
  bio?: string;
  review_avg_rating?: number;
  review_count?: number;
}

export interface BackendRecommendResponse {
  total_matches: number;
  matches: BackendRecommendMatch[];
}

export interface BackendMatchedUser {
  user_id: string;
  name: string;
  photo_url?: string;
  gender?: string;
  age?: number;
  travel_style?: string;
  interests?: string;
  budget_range?: number;
  home_country?: string;
  current_city?: string;
  bio?: string;
  review_avg_rating?: number;
  review_count?: number;
}

export interface BackendMatchRecord {
  match_id: number;
  compatibility_score: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  requested_by_current_user?: boolean;
  can_current_user_accept?: boolean;
  trip_completed?: boolean;
  can_current_user_end_chat?: boolean;
  end_chat_available_on?: string | null;
  other_user: BackendMatchedUser;
}

export interface BackendAcceptMatchResponse {
  match_id: number;
  user1_id: string;
  user2_id: string;
  compatibility_score: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
}

export interface BackendMatchesResponse {
  total: number;
  matches: BackendMatchRecord[];
}

export interface BackendConversationSummary {
  user_id: string;
  name: string;
  last_message: string;
  last_message_timestamp: string;
}

export interface BackendChatMessage {
  message_id: number;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  timestamp: string;
}

export interface BackendChatSocketConversation {
  user_id: string;
  name: string;
  last_message: string;
  last_message_timestamp: string;
}

export interface BackendChatSocketConnectedEvent {
  type: 'connected';
  user_id: string;
}

export interface BackendChatSocketMessageEvent {
  type: 'chat_message';
  message: BackendChatMessage;
  conversation: BackendChatSocketConversation;
  client_message_id?: string;
}

export interface BackendChatSocketErrorEvent {
  type: 'error';
  detail: string;
  client_message_id?: string;
}

export interface BackendChatSocketTypingEvent {
  type: 'typing';
  sender_id: string;
  receiver_id: string;
  is_typing: boolean;
}

export interface BackendChatSocketPongEvent {
  type: 'pong';
}

export type BackendChatSocketEvent =
  | BackendChatSocketConnectedEvent
  | BackendChatSocketMessageEvent
  | BackendChatSocketErrorEvent
  | BackendChatSocketTypingEvent
  | BackendChatSocketPongEvent;

export interface BackendPlaceRequest {
  request_id: number;
  user_id: string;
  user_name: string;
  destination: string;
  place_image: string;
  pin_lat: number;
  pin_lng: number;
  pin_label: string;
  start_date: string;
  end_date: string;
  companions_needed: number;
  budget: string;
  travel_type: string;
  notes: string;
  status: string;
  applicants: string[];
  created_at: string;
}

export interface BackendPlaceRequestList {
  total: number;
  requests: BackendPlaceRequest[];
}

export interface BackendEmergencyLocation {
  latitude: number;
  longitude: number;
  address: string;
}

export interface BackendEmergencyAlert {
  alert_id: number;
  user_id: string;
  alert_type: string;
  message: string;
  severity: string;
  status: string;
  location: BackendEmergencyLocation;
  responders: string[];
  created_at: string;
  resolved_at?: string;
}

export interface BackendEmergencyAlertList {
  total: number;
  alerts: BackendEmergencyAlert[];
}

export interface BackendReviewCategories {
  communication: number;
  reliability: number;
  compatibility: number;
  overall: number;
}

export interface BackendReview {
  review_id: number;
  reviewer_id: string;
  reviewee_id: string;
  match_id?: number;
  rating: number;
  comment: string;
  categories: BackendReviewCategories;
  is_public: boolean;
  helpful_votes: number;
  created_at: string;
  updated_at: string;
}

export interface BackendReviewList {
  total: number;
  reviews: BackendReview[];
}

const buildUrl = (path: string) => `${API_BASE_URL}${path}`;

export const buildChatWebSocketUrl = (token: string) => {
  const url = new URL(API_BASE_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/chat/ws';
  url.search = '';
  url.hash = '';
  url.searchParams.set('token', token);
  return url.toString();
};

/**
 * Wrapper around fetch that auto-detects 401 responses
 * and clears the session, redirecting the user to /login.
 */
async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401) {
    localStorage.removeItem('tcf_token');
    localStorage.removeItem('tcf_user');
    // Only redirect if we aren't already on the login page
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }
  return response;
}

export async function loginWithBackend(email: string, password: string): Promise<BackendLoginResponse> {
  devLog('[loginWithBackend] Attempting login for:', email);
  
  const payload = new URLSearchParams();
  payload.set('username', email);
  payload.set('password', password);

  const response = await fetch(buildUrl('/login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload,
  });

  devLog('[loginWithBackend] Response status:', response.status);

  if (!response.ok) {
    let errorMsg = 'Login failed';
    try {
      const error = await response.json();
      errorMsg = error.detail || error.message || 'Login failed';
      devError('[loginWithBackend] Backend error:', error);
    } catch {
      devError('[loginWithBackend] Could not parse error response');
    }
    throw new Error(errorMsg);
  }

  const result = await response.json() as BackendLoginResponse;
  devLog('[loginWithBackend] Success');
  return result;
}

export async function googleLoginWithBackend(credential: string): Promise<BackendLoginResponse> {
  devLog('[googleLoginWithBackend] Sending Google credential to backend');

  const response = await fetch(buildUrl('/auth/google'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });

  devLog('[googleLoginWithBackend] Response status:', response.status);

  if (!response.ok) {
    let errorMsg = 'Google sign-in failed';
    try {
      const error = await response.json();
      errorMsg = error.detail || error.message || 'Google sign-in failed';
      devError('[googleLoginWithBackend] Backend error:', error);
    } catch {
      devError('[googleLoginWithBackend] Could not parse error response');
    }
    throw new Error(errorMsg);
  }

  const result = await response.json() as BackendLoginResponse;
  devLog('[googleLoginWithBackend] Success');
  return result;
}

export async function registerWithBackend(email: string, password: string, name: string, gender: string = 'Other'): Promise<BackendRegisterResponse> {
  devLog('[registerWithBackend] Registering:', email);
  
  const payload = {
    user_id: email.split('@')[0] + '_' + Date.now(),
    email,
    name,
    password,
    gender,
    destination: 'Not set',
    budget_range: 1500,
    travel_style: 'Adventure',
    discoverable: true,
  };
  
  devLog('[registerWithBackend] Payload:', JSON.stringify(payload, null, 2));
  
  const response = await fetch(buildUrl('/register'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  devLog('[registerWithBackend] Response status:', response.status);
  
  if (!response.ok) {
    let errorMsg = 'Registration failed';
    try {
      const error = await response.json();
      errorMsg = error.detail || error.message || 'Registration failed';
      devError('[registerWithBackend] Backend error:', error);
    } catch {
      devError('[registerWithBackend] Could not parse error response');
    }
    throw new Error(errorMsg);
  }

  const result = await response.json() as BackendRegisterResponse;
  devLog('[registerWithBackend] Success:', result);
  return result;
}

export interface TripSearchParams {
  destination?: string;
  start_date?: string;
  end_date?: string;
  budget?: string;
  travel_style?: string;
}

export async function fetchRecommendations(token: string, tripParams?: TripSearchParams): Promise<BackendRecommendResponse> {
  const response = await authFetch(buildUrl('/recommend'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: tripParams ? JSON.stringify(tripParams) : JSON.stringify({}),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = await response.json();
      detail = errBody.detail || '';
    } catch { /* ignore */ }
    throw new Error(`${response.status} ${detail || response.statusText || 'Recommendation request failed'}`);
  }

  return (await response.json()) as BackendRecommendResponse;
}

export async function acceptMatch(token: string, matchedUserId: string, compatibilityScore: number): Promise<BackendAcceptMatchResponse> {
  const response = await authFetch(buildUrl('/matches/accept'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      matched_user_id: matchedUserId,
      compatibility_score: compatibilityScore,
    }),
  });

  if (!response.ok) {
    throw new Error('Accept match request failed');
  }

  return (await response.json()) as BackendAcceptMatchResponse;
}

export async function fetchMatches(token: string): Promise<BackendMatchesResponse> {
  const response = await authFetch(buildUrl('/matches'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Fetch matches request failed');
  }

  return (await response.json()) as BackendMatchesResponse;
}

export async function updateMatchStatusBackend(
  token: string,
  matchId: number,
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled',
): Promise<void> {
  const response = await authFetch(buildUrl(`/matches/${matchId}/status`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    let detail = 'Update match status request failed';
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload?.detail) {
        detail = payload.detail;
      }
    } catch {
      // Keep default message when backend error payload is not JSON.
    }
    throw new Error(detail);
  }
}

export async function fetchConversation(token: string, otherUserId: string): Promise<BackendChatMessage[]> {
  const response = await authFetch(buildUrl(`/chat/${encodeURIComponent(otherUserId)}`), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Fetch conversation request failed');
  }

  return (await response.json()) as BackendChatMessage[];
}

export async function fetchConversations(token: string): Promise<BackendConversationSummary[]> {
  const response = await authFetch(buildUrl('/chat/conversations'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Fetch conversations request failed');
  }

  return (await response.json()) as BackendConversationSummary[];
}

export interface BackendUserPublicProfile {
  user_id: string;
  name: string;
  photo_url: string | null;
  gender: string;
  age?: number;
  travel_style?: string;
  interests?: string;
  budget_range?: number;
  home_country?: string;
  current_city?: string;
  bio?: string;
}

export async function fetchUserPublicProfile(userId: string): Promise<BackendUserPublicProfile> {
  const response = await fetch(buildUrl(`/users/${userId}/public`), {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user profile');
  }

  return (await response.json()) as BackendUserPublicProfile;
}

export async function sendChatMessage(token: string, receiverId: string, messageText: string): Promise<BackendChatMessage> {
  const response = await authFetch(buildUrl('/chat/send'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      receiver_id: receiverId,
      message_text: messageText,
    }),
  });

  if (!response.ok) {
    throw new Error('Send chat message request failed');
  }

  return (await response.json()) as BackendChatMessage;
}

export async function fetchPlaceRequests(token: string): Promise<BackendPlaceRequestList> {
  const response = await authFetch(buildUrl('/place-requests'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Fetch place requests request failed');
  }

  return (await response.json()) as BackendPlaceRequestList;
}

export interface CommunityDestination {
  name: string;
  image: string;
  properties: string[];
}

export async function fetchCommunityDestinations(token: string): Promise<CommunityDestination[]> {
  const response = await authFetch(buildUrl('/place-requests/destinations'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return [];
  }

  return (await response.json()) as CommunityDestination[];
}

export async function createPlaceRequest(
  token: string,
  payload: Omit<BackendPlaceRequest, 'request_id' | 'user_id' | 'user_name' | 'applicants' | 'created_at'>,
): Promise<BackendPlaceRequest> {
  const response = await authFetch(buildUrl('/place-requests'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Create place request failed');
  }

  return (await response.json()) as BackendPlaceRequest;
}

export interface JoinPlaceRequestResponse {
  message: string;
  poster_user_id: string;
  request_id: number;
}

export async function joinPlaceRequest(token: string, requestId: number): Promise<JoinPlaceRequestResponse> {
  const response = await authFetch(buildUrl(`/place-requests/${requestId}/join`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let detail = 'Failed to join trip';
    try {
      const errBody = await response.json();
      detail = errBody.detail || detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }

  return (await response.json()) as JoinPlaceRequestResponse;
}

export async function fetchMyEmergencyAlerts(token: string): Promise<BackendEmergencyAlertList> {
  const response = await authFetch(buildUrl('/emergency/alerts/me'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Fetch my emergency alerts failed');
  }

  return (await response.json()) as BackendEmergencyAlertList;
}

export async function fetchActiveEmergencyAlerts(token: string): Promise<BackendEmergencyAlertList> {
  const response = await authFetch(buildUrl('/emergency/alerts/active'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Fetch active emergency alerts failed');
  }

  return (await response.json()) as BackendEmergencyAlertList;
}

export async function createEmergencyAlert(
  token: string,
  payload: {
    alert_type: string;
    message: string;
    severity: string;
    location: BackendEmergencyLocation;
  },
): Promise<BackendEmergencyAlert> {
  const response = await authFetch(buildUrl('/emergency/alerts'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Create emergency alert failed');
  }

  return (await response.json()) as BackendEmergencyAlert;
}

export async function fetchReviews(token: string, revieweeId: string): Promise<BackendReviewList> {
  const response = await authFetch(buildUrl(`/reviews?reviewee_id=${encodeURIComponent(revieweeId)}`), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Fetch reviews failed');
  }

  return (await response.json()) as BackendReviewList;
}

export async function createReview(
  token: string,
  payload: {
    reviewee_id: string;
    match_id?: number;
    rating: number;
    comment: string;
    categories: BackendReviewCategories;
    is_public: boolean;
  },
): Promise<BackendReview> {
  const response = await authFetch(buildUrl('/reviews'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Create review failed');
  }

  return (await response.json()) as BackendReview;
}

export async function voteReviewHelpful(token: string, reviewId: number): Promise<BackendReview> {
  const response = await authFetch(buildUrl(`/reviews/${reviewId}/helpful`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Vote review helpful failed');
  }

  return (await response.json()) as BackendReview;
}

// ──────────────────────────────
// Profile & Photo Management
// ──────────────────────────────

export interface BackendMyProfile {
  user_id: string;
  name: string;
  email: string;
  gender: string | null;
  age: number | null;
  bio: string | null;
  home_country: string | null;
  current_city: string | null;
  photo_url: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_range: number | null;
  interests: string | null;
  travel_style: string | null;
  language_preference: string | null;
  discoverable: boolean;
  created_at: string | null;
}

export async function fetchMyProfile(token: string): Promise<BackendMyProfile> {
  const response = await authFetch(buildUrl('/profile/me'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch profile');
  }

  return (await response.json()) as BackendMyProfile;
}

export interface UpdateProfileRequest {
  name?: string;
  gender?: string;
  age?: number;
  bio?: string;
  home_country?: string;
  current_city?: string;
  photo_url?: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  budget_range?: number;
  interests?: string;
  travel_style?: string;
  language_preference?: string;
  discoverable?: boolean;
}

export interface PhotoUploadResponse {
  photo_url: string;
  message: string;
}

export async function updateUserProfile(
  token: string,
  profileData: UpdateProfileRequest,
): Promise<BackendRegisterResponse> {
  devLog(`[updateUserProfile] Sending profile update:`, profileData);

  const response = await authFetch(`${API_BASE_URL}/profile/update`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(profileData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Profile update failed');
  }

  return (await response.json()) as BackendRegisterResponse;
}

export async function uploadProfilePhoto(
  token: string,
  file: File,
): Promise<PhotoUploadResponse> {
  devLog(`[uploadProfilePhoto] Uploading photo:`, file.name, `Size: ${file.size} bytes`, `Type: ${file.type}`);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await authFetch(`${API_BASE_URL}/profile/upload-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    devLog(`[uploadProfilePhoto] Response status:`, response.status);

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const error = await response.json();
        errorMsg = error.detail || error.message || errorMsg;
        devError('[uploadProfilePhoto] Backend error:', error);
      } catch (e) {
        const text = await response.text();
        devError('[uploadProfilePhoto] Response text:', text);
      }
      throw new Error(errorMsg);
    }

    const result = await response.json() as PhotoUploadResponse;
    
    // If the photo_url is relative, make it absolute
    if (result.photo_url && result.photo_url.startsWith('/')) {
      result.photo_url = `${API_BASE_URL}${result.photo_url}`;
      devLog(`[uploadProfilePhoto] Fixed URL to:`, result.photo_url);
    }
    
    devLog(`[uploadProfilePhoto] Success:`, result);
    return result;
  } catch (error) {
    devError('[uploadProfilePhoto] Error:', error);
    throw error;
  }
}

export async function getDefaultPhoto(gender: string = 'Other'): Promise<{ photo_url: string }> {
  devLog(`[getDefaultPhoto] Getting default photo for gender:`, gender);

  const response = await authFetch(`${API_BASE_URL}/profile/default-photo?gender=${encodeURIComponent(gender)}`);

  if (!response.ok) {
    throw new Error('Failed to get default photo');
  }

  return (await response.json()) as { photo_url: string };
}

export function getUserIdFromToken(token: string): string | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = `${normalizedPayload}${'='.repeat((4 - (normalizedPayload.length % 4)) % 4)}`;
    const decoded = JSON.parse(atob(paddedPayload)) as { sub?: string };
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  try {
    const [, payload] = token.split('.');
    if (!payload) return true;

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = `${normalizedPayload}${'='.repeat((4 - (normalizedPayload.length % 4)) % 4)}`;
    const decoded = JSON.parse(atob(paddedPayload)) as { exp?: number };
    if (!decoded.exp) return true;

    // Token is expired if exp is in the past (with 10s buffer)
    return decoded.exp * 1000 < Date.now() - 10000;
  } catch {
    return true;
  }
}

// ----------------------------
// Change Password
// ----------------------------

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  const response = await authFetch(`${API_BASE_URL}/profile/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to change password');
  }

  return (await response.json()) as { message: string };
}
