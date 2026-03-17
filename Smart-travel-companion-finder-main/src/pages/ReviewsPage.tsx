import { useEffect, useMemo, useState } from 'react';
import { Star, ThumbsUp, Plane } from 'lucide-react';
import { ReviewSkeleton } from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';
import {
  createReview,
  fetchMatches,
  fetchReviews,
  fetchUserPublicProfile,
  voteReviewHelpful,
  type BackendMatchRecord,
  type BackendReview,
} from '../utils/apiClient';

const TOKEN_STORAGE_KEY = 'tcf_token';

export default function ReviewsPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<BackendMatchRecord[]>([]);

  useEffect(() => { document.title = 'Reviews — TravelMatch'; }, []);
  const [selectedMatch, setSelectedMatch] = useState<BackendMatchRecord | null>(null);
  const [reviews, setReviews] = useState<BackendReview[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reviewerNames, setReviewerNames] = useState<Record<string, string>>({});
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);

  const selectedRevieweeId = selectedMatch?.other_user.user_id ?? '';

  const loadMatches = async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return;

    try {
      const result = await fetchMatches(token);
      const acceptedMatches = result.matches.filter((item) => item.status === 'accepted');
      setMatches(acceptedMatches);
      setSelectedMatch((prev) => {
        if (prev && acceptedMatches.some((item) => item.match_id === prev.match_id)) {
          return prev;
        }
        return acceptedMatches[0] ?? null;
      });
    } catch {
      setError('Unable to load matched companions from backend.');
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const loadReviews = async (revieweeId: string) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token || !revieweeId) return;

    try {
      const result = await fetchReviews(token, revieweeId);
      setReviews(result.reviews);

      // Resolve reviewer names
      const uniqueIds = [...new Set(result.reviews.map((r) => r.reviewer_id))].filter(
        (id) => !reviewerNames[id]
      );
      const nameEntries: Record<string, string> = {};
      await Promise.all(
        uniqueIds.map(async (id) => {
          try {
            const profile = await fetchUserPublicProfile(id);
            nameEntries[id] = profile.name || id;
          } catch {
            nameEntries[id] = id;
          }
        })
      );
      if (Object.keys(nameEntries).length > 0) {
        setReviewerNames((prev) => ({ ...prev, ...nameEntries }));
      }
    } catch {
      setError('Unable to load reviews right now.');
    }
  };

  useEffect(() => {
    void loadMatches();
  }, []);

  useEffect(() => {
    if (selectedRevieweeId) {
      void loadReviews(selectedRevieweeId);
    }
  }, [selectedRevieweeId]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length;
  }, [reviews]);

  const submitReview = async () => {
    if (!selectedMatch || !comment.trim()) {
      return;
    }

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setError('Login token missing. Please sign in again.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await createReview(token, {
        reviewee_id: selectedMatch.other_user.user_id,
        match_id: selectedMatch.match_id,
        rating,
        comment: comment.trim(),
        categories: {
          communication: rating,
          reliability: rating,
          compatibility: rating,
          overall: rating,
        },
        is_public: true,
      });

      setComment('');
      setRating(5);
      await loadReviews(selectedMatch.other_user.user_id);
    } catch {
      setError('Unable to submit review. You may have already reviewed this match.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const voteHelpful = async (reviewId: number) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token || !selectedRevieweeId) return;

    try {
      await voteReviewHelpful(token, reviewId);
      await loadReviews(selectedRevieweeId);
    } catch {
      setError('Unable to register helpful vote.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-3xl p-6 sm:p-8 shadow-xl shadow-orange-500/15 text-white animate-slide-up">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <Star className="absolute top-4 right-[10%] h-7 w-7 text-white/15 animate-float fill-current" />
          <Star className="absolute bottom-4 left-[8%] h-5 w-5 text-white/10 animate-float-delayed fill-current" />
          <Plane className="absolute top-6 left-[50%] h-6 w-6 text-white/10 animate-float-slow" />
        </div>
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3">
            <span className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm">
              <Star className="h-6 w-6 fill-current" />
            </span>
            Reviews & Ratings
          </h1>
          <p className="text-orange-100 mt-2">Submit and view reviews synced with backend data.</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200/60 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

      {isLoadingMatches ? <ReviewSkeleton /> : <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Select matched traveler</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-gray-500">No connected travelers found yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {matches.map((match) => (
              <button
                key={match.match_id}
                onClick={() => setSelectedMatch(match)}
                className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                  selectedMatch?.match_id === match.match_id ? 'border-cyan-400 bg-cyan-50/70 shadow-sm' : 'border-gray-200/60 bg-white hover:border-cyan-300'
                }`}
              >
                <p className="font-medium text-gray-900">{match.other_user.name}</p>
                <p className="text-xs text-gray-500">Score: {Math.round(match.compatibility_score)} • Status: {match.status}</p>
              </button>
            ))}
          </div>
        )}
      </div>}

      {selectedMatch && user && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-gray-900">Write review for {selectedMatch.other_user.name}</h3>

          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} onClick={() => setRating(value)} className={value <= rating ? 'text-yellow-500' : 'text-gray-300'}>
                <Star className="h-6 w-6" fill="currentColor" />
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience..."
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
            rows={4}
          />

          <button
            onClick={() => void submitReview()}
            disabled={isSubmitting || comment.trim().length < 10}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-700 text-white text-sm font-semibold hover:shadow-lg shadow-cyan-500/25 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      )}

      {selectedMatch && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Reviews for {selectedMatch.other_user.name}</h3>
            <p className="text-sm text-gray-500">Average: {averageRating.toFixed(1)} ★</p>
          </div>

          {reviews.length === 0 ? (
            <p className="text-sm text-gray-500">No reviews available yet.</p>
          ) : (
            reviews.map((review) => (
              <div key={review.review_id} className="border border-gray-200/60 rounded-xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{reviewerNames[review.reviewer_id] || 'Anonymous'}</p>
                  <p className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString()}</p>
                </div>
                <p className="text-sm text-gray-700 mt-2">{review.comment}</p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm text-yellow-600">{review.rating.toFixed(1)} ★</p>
                  {review.reviewer_id !== user?.userId && (
                    <button
                      onClick={() => void voteHelpful(review.review_id)}
                      className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
                    >
                      <ThumbsUp className="h-4 w-4 mr-1" /> Helpful ({review.helpful_votes})
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
