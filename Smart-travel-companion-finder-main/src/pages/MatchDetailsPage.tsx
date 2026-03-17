import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, MapPin, Shield, Star, Wallet, Plane, Globe } from 'lucide-react';
import ChatInterface from '../components/ChatInterface';
import UserAvatar from '../components/UserAvatar';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { fetchReviews, fetchUserPublicProfile, type BackendReview } from '../utils/apiClient';
import { useRealtimeConversation } from '../hooks/useRealtimeConversation';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://127.0.0.1:8000';
const CITY_TO_COUNTRY: Record<string, string> = {
  bengaluru: 'India',
  bangalore: 'India',
  mumbai: 'India',
  pune: 'India',
  delhi: 'India',
  hyderabad: 'India',
  chennai: 'India',
  kochi: 'India',
  goa: 'India',
  rishikesh: 'India',
  chandigarh: 'India',
  lucknow: 'India',
  pondicherry: 'India',
  kolkata: 'India',
  jaipur: 'India',
  manali: 'India',
};

const LOCATION_PLACEHOLDERS = new Set(['', 'unknown', 'abroad', 'not set', 'none', 'null', 'n/a']);

const cleanLocationValue = (value?: string | null): string => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  if (LOCATION_PLACEHOLDERS.has(trimmed.toLowerCase())) return '';
  return trimmed;
};

export default function MatchDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => { document.title = 'Match Details - TravelMatch'; }, []);
  const {
    getMatchById,
    updateMatchStatus,
    addReview,
    getReviewByMatch,
  } = useApp();

  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isUpdatingMatch, setIsUpdatingMatch] = useState(false);
  const [matchUpdateError, setMatchUpdateError] = useState('');
  const [liveProfile, setLiveProfile] = useState<Awaited<ReturnType<typeof fetchUserPublicProfile>> | null>(null);
  const [publicReviews, setPublicReviews] = useState<BackendReview[]>([]);
  const [isLoadingPublicReviews, setIsLoadingPublicReviews] = useState(false);
  const [publicReviewsError, setPublicReviewsError] = useState('');
  const [reviewerNames, setReviewerNames] = useState<Record<string, string>>({});
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false);

  const match = id ? getMatchById(id) : undefined;

  // Fetch the latest profile data from backend so we always show up-to-date info
  useEffect(() => {
    if (!match) return;
    const userId = match.user.userId;
    void fetchUserPublicProfile(userId)
      .then((profile) => setLiveProfile(profile))
      .catch(() => { /* keep existing data */ });
  }, [match]);

  useEffect(() => {
    if (!match) return;

    const token = localStorage.getItem('tcf_token');
    if (!token) return;

    let cancelled = false;
    setIsLoadingPublicReviews(true);
    setPublicReviewsError('');

    void (async () => {
      try {
        const result = await fetchReviews(token, match.user.userId);
        if (cancelled) return;
        setPublicReviews(result.reviews);

        const missingReviewerIds = [...new Set(result.reviews.map((item) => item.reviewer_id))].filter(
          (reviewerId) => !reviewerNames[reviewerId],
        );
        if (missingReviewerIds.length > 0) {
          const entries = await Promise.all(
            missingReviewerIds.map(async (reviewerId) => {
              try {
                const profile = await fetchUserPublicProfile(reviewerId);
                return [reviewerId, profile.name || reviewerId] as const;
              } catch {
                return [reviewerId, reviewerId] as const;
              }
            }),
          );
          if (!cancelled) {
            setReviewerNames((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
          }
        }
      } catch {
        if (!cancelled) {
          setPublicReviewsError('Unable to load public reviews right now.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPublicReviews(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [match?.user.userId]);

  const review = useMemo(() => (id ? getReviewByMatch(id) : undefined), [id, getReviewByMatch]);
  const averagePublicRating = useMemo(() => {
    if (publicReviews.length === 0) return 0;
    return publicReviews.reduce((sum, item) => sum + item.rating, 0) / publicReviews.length;
  }, [publicReviews]);
  const reviewSummaryCount = publicReviews.length > 0 ? publicReviews.length : match?.user.stats.reviewsReceived ?? 0;
  const reviewSummaryRating = publicReviews.length > 0 ? averagePublicRating : match?.user.stats.averageRating ?? 0;
  const {
    messages,
    sendMessage: sendRealtimeMessage,
    setTypingState,
    connectionStatus,
    isOtherUserTyping,
    chatError,
    clearChatError,
  } = useRealtimeConversation({
    chatId: id ?? '',
    otherUserId: match?.user.userId ?? '',
    currentUserId: user?.userId,
    enabled: Boolean(id && match && user && match.matchStatus === 'Matched'),
  });

  if (!match || !user || !id) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-800">Match not found</h2>
        <button onClick={() => navigate('/find-companion')} className="text-cyan-700 mt-4">
          Back to companion search
        </button>
      </div>
    );
  }

  const displayPhotoUrl = (() => {
    if (liveProfile?.photo_url) {
      return liveProfile.photo_url.startsWith('http')
        ? liveProfile.photo_url
        : `${API_BASE}${liveProfile.photo_url}`;
    }
    return match.user.photoUrl;
  })();
  const displayName = liveProfile?.name || match.user.name;
  const displayAge = liveProfile?.age ?? match.user.age;
  const displayGender = liveProfile?.gender || match.user.gender;
  const displayStyle = liveProfile?.travel_style || match.user.profile.travelStyle;
  const displayCity = liveProfile?.current_city || match.user.currentCity;
  const displayCountry = liveProfile?.home_country || match.user.homeCountry;
  const locationLabel = (() => {
    const city = cleanLocationValue(displayCity);
    const country = cleanLocationValue(displayCountry);
    const hasCity = city.length > 0;
    const hasCountry = country.length > 0;
    const inferredCountry = CITY_TO_COUNTRY[city.toLowerCase()];
    const sameValue = hasCity && hasCountry && city.toLowerCase() === country.toLowerCase();

    if (sameValue) {
      return country;
    }

    // For known cities, always show their real geographic country.
    if (hasCity && inferredCountry) {
      return `${city}, ${inferredCountry}`;
    }
    if (hasCity && hasCountry) {
      return `${city}, ${country}`;
    }
    if (hasCity) {
      return city;
    }
    if (hasCountry) {
      return country;
    }
    return 'Location not set';
  })();
  const isMatched = match.matchStatus === 'Matched';
  const isPending = match.matchStatus === 'Pending';
  const isPendingReceivedByMe = isPending && match.pendingRole === 'received';
  const isPendingSentByMe = isPending && !isPendingReceivedByMe;

  useEffect(() => {
    if (!isPhotoPreviewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPhotoPreviewOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPhotoPreviewOpen]);

  const handleConnect = async () => {
    if (isPendingSentByMe) return;
    setIsUpdatingMatch(true);
    setMatchUpdateError('');
    const targetStatus = isPendingReceivedByMe ? 'Matched' : 'Pending';
    const updated = await updateMatchStatus(match.matchId, targetStatus);
    if (!updated) {
      setMatchUpdateError(
        isPendingReceivedByMe
          ? 'Unable to accept this request right now. Please try again.'
          : 'Unable to send request right now. Please try again.',
      );
    }
    setIsUpdatingMatch(false);
  };

  const handleReject = async () => {
    setIsUpdatingMatch(true);
    const updated = await updateMatchStatus(match.matchId, 'Rejected');
    setIsUpdatingMatch(false);
    if (!updated) {
      setMatchUpdateError('Unable to reject match right now. Please try again.');
      return;
    }
    navigate('/find-companion');
  };

  const handleSendMessage = (text: string, replyTo?: { messageId: string; senderId: string; text: string }) => {
    sendRealtimeMessage(text, replyTo);
  };

  const submitReview = () => {
    if (!reviewComment.trim()) return;
    addReview(match.matchId, user.userId, rating, reviewComment.trim());
    setReviewComment('');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={16} className="mr-1" /> Back
      </button>

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/40 overflow-hidden animate-slide-up">
        <div className="h-40 bg-gradient-to-r from-cyan-700 via-sky-700 to-teal-700 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <Plane className="absolute top-3 right-[15%] h-6 w-6 text-white/10 animate-float rotate-[-15deg]" />
            <Globe className="absolute bottom-3 left-[10%] h-7 w-7 text-white/10 animate-float-delayed" />
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setIsPhotoPreviewOpen(true)}
              className="group relative rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
              aria-label={`Open ${displayName}'s profile photo`}
            >
              <UserAvatar
                src={displayPhotoUrl}
                name={displayName}
                className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg text-3xl transition-all group-hover:brightness-95 group-hover:shadow-xl"
              />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                {displayName}
                {match.user.verificationStatus === 'Verified' && <Shield className="h-5 w-5 text-cyan-600 ml-2" />}
              </h1>
              <p className="text-gray-600 text-sm">
                {displayAge} {'\u2022'} {displayGender} {'\u2022'} {displayStyle}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                <p className="inline-flex items-center">
                  <MapPin size={12} className="mr-1" /> {locationLabel}
                </p>
                <p className="inline-flex items-center">
                  <Star size={12} className="mr-1 text-amber-500 fill-current" />
                  {reviewSummaryCount > 0
                    ? `${reviewSummaryRating.toFixed(1)} (${reviewSummaryCount} reviews)`
                    : 'No public reviews yet'}
                </p>
              </div>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs uppercase tracking-wide text-gray-500">Compatibility</p>
              <p className="text-3xl font-bold text-cyan-700">{match.score}%</p>
            </div>
          </div>

          <div className="mt-6 grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl p-4 bg-green-50/80 border border-green-200/60">
              <p className="text-xs text-green-700 font-medium">Common Interests</p>
              <p className="font-semibold text-green-900 mt-0.5">{match.matchDetails.interestMatch.join(', ') || 'N/A'}</p>
            </div>
            <div className="rounded-2xl p-4 bg-blue-50/80 border border-blue-200/60">
              <p className="text-xs text-blue-700 inline-flex items-center font-medium"><Wallet size={12} className="mr-1" /> Budget Compatibility</p>
              <p className="font-semibold text-blue-900 mt-0.5">{match.matchDetails.budgetCompatibility}</p>
            </div>
            <div className="rounded-2xl p-4 bg-cyan-50/80 border border-cyan-200/60">
              <p className="text-xs text-cyan-700 font-medium">Trip Filter Status</p>
              <p className="font-semibold text-cyan-900 mt-0.5">
                Destination: {match.matchDetails.destinationMatch ? 'Yes' : 'No'} {'\u2022'} Date overlap: {match.matchDetails.dateOverlap ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {isMatched ? (
              <div className="inline-flex items-center px-4 py-2.5 rounded-xl bg-cyan-100 text-cyan-700 text-sm font-semibold">
                <CheckCircle size={16} className="mr-2" /> Match Confirmed
              </div>
            ) : isPendingSentByMe ? (
              <div className="inline-flex items-center px-4 py-2.5 rounded-xl bg-amber-100 text-amber-800 text-sm font-semibold border border-amber-200">
                Waiting for {displayName} to accept your match request
              </div>
            ) : (
              <>
                <button
                  onClick={handleConnect}
                  disabled={isUpdatingMatch}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 text-white text-sm font-semibold hover:shadow-lg shadow-cyan-500/25 transition-all"
                >
                  {isUpdatingMatch
                    ? isPendingReceivedByMe
                      ? 'Accepting...'
                      : 'Sending...'
                    : isPendingReceivedByMe
                      ? 'Accept Match & Enable Chat'
                      : 'Send Request'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={isUpdatingMatch}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Reject
                </button>
              </>
            )}
          </div>

          {matchUpdateError && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200/60 rounded-xl px-4 py-2.5">{matchUpdateError}</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Chat Box</h2>
        <ChatInterface
          match={match}
          currentUser={user}
          messages={messages}
          onSendMessage={handleSendMessage}
          onTypingChange={setTypingState}
          onClearChat={() => {}}
          connectionStatus={connectionStatus}
          isOtherUserTyping={isOtherUserTyping}
          networkError={chatError}
          onDismissNetworkError={clearChatError}
        />
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Traveler Reviews</h3>
          <p className="text-sm text-gray-500">
            {publicReviews.length > 0 ? `${averagePublicRating.toFixed(1)} ★ (${publicReviews.length})` : 'No ratings yet'}
          </p>
        </div>

        {isLoadingPublicReviews ? (
          <p className="text-sm text-gray-500">Loading reviews...</p>
        ) : publicReviewsError ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200/60 rounded-xl px-4 py-2.5">{publicReviewsError}</p>
        ) : publicReviews.length === 0 ? (
          <p className="text-sm text-gray-500">No public reviews yet for {displayName}.</p>
        ) : (
          <div className="space-y-3">
            {publicReviews.map((item) => (
              <div key={item.review_id} className="rounded-xl border border-gray-200/60 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900">{reviewerNames[item.reviewer_id] || item.reviewer_id}</p>
                  <p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</p>
                </div>
                <p className="text-sm text-gray-700 mt-2">{item.comment}</p>
                <p className="text-sm text-amber-600 mt-2 inline-flex items-center">
                  <Star size={14} className="mr-1 fill-current" /> {item.rating.toFixed(1)} / 5
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {isMatched && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4 text-lg">Rate & Review</h3>

          {review ? (
            <div className="rounded-xl border border-gray-200/60 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-800 inline-flex items-center">
                <Star size={14} className="mr-1 text-amber-500" /> {review.rating}/5
              </p>
              <p className="text-sm text-gray-600 mt-1">{review.comment}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => setRating(value)}
                    className={`p-1 ${value <= rating ? 'text-amber-500' : 'text-gray-300'}`}
                  >
                    <Star className="h-5 w-5" fill="currentColor" />
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your coordination experience"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
              />
              <button
                onClick={submitReview}
                className="px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors"
              >
                Submit Review
              </button>
            </div>
          )}
        </div>
      )}

      {isPhotoPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setIsPhotoPreviewOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${displayName} profile photo preview`}
        >
          <div
            className="relative"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsPhotoPreviewOpen(false)}
              className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white text-gray-700 shadow-md hover:bg-gray-100"
              aria-label="Close photo preview"
            >
              ×
            </button>
            <UserAvatar
              src={displayPhotoUrl}
              name={displayName}
              className="h-72 w-72 sm:h-96 sm:w-96 rounded-2xl border border-white/30 object-cover shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
