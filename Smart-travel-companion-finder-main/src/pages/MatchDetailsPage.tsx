import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, MapPin, Shield, Star, Wallet, Plane, Globe } from 'lucide-react';
import ChatInterface from '../components/ChatInterface';
import UserAvatar from '../components/UserAvatar';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { fetchUserPublicProfile } from '../utils/apiClient';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://127.0.0.1:8000';

export default function MatchDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => { document.title = 'Match Details — TravelMatch'; }, []);
  const {
    getMatchById,
    updateMatchStatus,
    getMessagesForMatch,
    loadMessagesForMatch,
    sendMessage,
    addReview,
    getReviewByMatch,
  } = useApp();

  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isUpdatingMatch, setIsUpdatingMatch] = useState(false);
  const [matchUpdateError, setMatchUpdateError] = useState('');
  const [liveProfile, setLiveProfile] = useState<Awaited<ReturnType<typeof fetchUserPublicProfile>> | null>(null);

  const match = id ? getMatchById(id) : undefined;

  // Fetch the latest profile data from backend so we always show up-to-date info
  useEffect(() => {
    if (!match) return;
    const userId = match.user.userId;
    void fetchUserPublicProfile(userId)
      .then((profile) => setLiveProfile(profile))
      .catch(() => { /* keep existing data */ });
  }, [match]);

  const review = useMemo(() => (id ? getReviewByMatch(id) : undefined), [id, getReviewByMatch]);
  const messages = id ? getMessagesForMatch(id) : [];

  useEffect(() => {
    if (!id || !match || match.matchStatus !== 'Matched') {
      return;
    }

    void loadMessagesForMatch(id);
  }, [id, match, loadMessagesForMatch]);

  if (!match || !user || !id) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-800">Match not found</h2>
        <button onClick={() => navigate('/find-companion')} className="text-violet-600 mt-4">
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
  const isMatched = match.matchStatus === 'Matched';

  const handleConnect = async () => {
    setIsUpdatingMatch(true);
    setMatchUpdateError('');
    const updated = await updateMatchStatus(match.matchId, 'Matched');
    if (!updated) {
      setMatchUpdateError('Unable to confirm match right now. Please try again.');
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

  const handleSendMessage = (text: string) => {
    sendMessage(match.matchId, user.userId, text);
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
        <div className="h-40 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <Plane className="absolute top-3 right-[15%] h-6 w-6 text-white/10 animate-float rotate-[-15deg]" />
            <Globe className="absolute bottom-3 left-[10%] h-7 w-7 text-white/10 animate-float-delayed" />
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-4">
            <UserAvatar
              src={displayPhotoUrl}
              name={displayName}
              className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg text-3xl"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                {displayName}
                {match.user.verificationStatus === 'Verified' && <Shield className="h-5 w-5 text-violet-500 ml-2" />}
              </h1>
              <p className="text-gray-600 text-sm">
                {displayAge} • {displayGender} • {displayStyle}
              </p>
              <p className="text-xs text-gray-500 inline-flex items-center mt-1">
                <MapPin size={12} className="mr-1" /> {displayCity}, {displayCountry}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs uppercase tracking-wide text-gray-500">Compatibility</p>
              <p className="text-3xl font-bold text-violet-700">{match.score}%</p>
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
            <div className="rounded-2xl p-4 bg-purple-50/80 border border-purple-200/60">
              <p className="text-xs text-purple-700 font-medium">Trip Filter Status</p>
              <p className="font-semibold text-purple-900 mt-0.5">
                Destination: {match.matchDetails.destinationMatch ? 'Yes' : 'No'} • Date overlap: {match.matchDetails.dateOverlap ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {isMatched ? (
              <div className="inline-flex items-center px-4 py-2.5 rounded-xl bg-fuchsia-100 text-fuchsia-700 text-sm font-semibold">
                <CheckCircle size={16} className="mr-2" /> Match Confirmed
              </div>
            ) : (
              <>
                <button
                  onClick={handleConnect}
                  disabled={isUpdatingMatch}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold hover:shadow-lg shadow-violet-500/25 transition-all"
                >
                  {isUpdatingMatch ? 'Confirming...' : 'Confirm Match & Enable Chat'}
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
        <ChatInterface match={match} currentUser={user} messages={messages} onSendMessage={handleSendMessage} onClearChat={() => {}} />
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
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-colors"
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
    </div>
  );
}
