import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Info,
  MapPin,
  Route,
  Search,
  Sparkles,
  Users,
  Wallet,
  Globe,
  Plane,
  Mountain,
  Compass,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { Trip } from '../types';
import { destinations } from '../data/destinations';
import CompanionCard from '../components/CompanionCard';
import MatchCardSkeleton from '../components/MatchCardSkeleton';

export default function FindCompanionPage() {
  const { user } = useAuth();
  const {
    currentTrip,
    createTrip,
    matches,
    generateMatches,
    matchSummary,
    matchError,
    validationErrors,
    isMatching,
  } = useApp();

  const [destination, setDestination] = useState(currentTrip?.destination ?? 'Goa');
  const defaultStart = new Date();
  const defaultEnd = new Date(defaultStart); defaultEnd.setDate(defaultEnd.getDate() + 5);
  const [startDate, setStartDate] = useState(currentTrip?.startDate ?? defaultStart.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(currentTrip?.endDate ?? defaultEnd.toISOString().split('T')[0]);
  const [budget, setBudget] = useState<Trip['budget']>(currentTrip?.budget ?? 'Medium');
  const [travelType, setTravelType] = useState<Trip['travelType']>(currentTrip?.travelType ?? 'Leisure');

  const [formError, setFormError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => { document.title = 'Find Companion - TravelMatch'; }, []);

  // Only show new recommendations on this page (exclude already connected/pending)
  const recommendedMatches = useMemo(() =>
    matches.filter((m) => m.matchStatus === 'Recommended'),
  [matches]);

  const stats = useMemo(() => {
    const recommended = recommendedMatches.length;
    return { recommended };
  }, [recommendedMatches]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    if (currentTrip && matches.length === 0 && user) {
      setHasSearched(true);
      generateMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrip, matches.length, user]);

  const todayStr = new Date().toISOString().split('T')[0];

  const validatePageInputs = () => {
    if (!destination.trim()) return 'Destination is required.';
    if (!startDate || !endDate) return 'Select start and end dates.';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(startDate) < today) return 'Start date cannot be in the past. Please select today or a future date.';
    if (new Date(endDate) < today) return 'End date cannot be in the past. Please select today or a future date.';
    if (new Date(startDate) > new Date(endDate)) return 'Start date cannot be after end date.';
    return '';
  };

  const handleFindCompanions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const inputError = validatePageInputs();
    if (inputError) {
      setFormError(inputError);
      showToast('error', inputError);
      return;
    }

    setFormError('');
    const trip: Trip = {
      tripId: Date.now().toString(),
      userId: user.userId,
      destination,
      startDate,
      endDate,
      budget,
      travelType,
      status: 'Planning',
    };

    if (createTrip(trip)) {
      setHasSearched(true);
      generateMatches(trip);
    }
  };

  return (
    <div className="space-y-8">
      {toast && (
        <div className="fixed top-20 right-5 z-[70]">
          <div
            className={`px-4 py-2 rounded-lg shadow-lg text-sm text-white mode-fade-in ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Travel Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-700 via-sky-700 to-teal-700 p-8 sm:p-10 text-white shadow-xl shadow-cyan-500/20 animate-slide-up">
        {/* Floating decorative icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <Plane className="absolute top-4 right-[15%] h-8 w-8 text-white/10 animate-float rotate-[-15deg]" />
          <Globe className="absolute bottom-6 left-[10%] h-10 w-10 text-white/10 animate-float-delayed" />
          <Mountain className="absolute top-8 left-[60%] h-7 w-7 text-white/10 animate-float-slow" />
          <Compass className="absolute bottom-4 right-[8%] h-6 w-6 text-white/10 animate-float" />
          <MapPin className="absolute top-[50%] left-[30%] h-5 w-5 text-white/10 animate-float-delayed" />
        </div>

        <div className="relative z-10">
          <h1 className="section-title text-3xl sm:text-4xl font-extrabold tracking-tight">Discover Companions</h1>
          <p className="mt-2 text-cyan-100 text-sm sm:text-base max-w-lg">Smart matching powered by shared interests, budget, travel style, and schedule overlap.</p>
        </div>
      </div>

      <div className="glass-panel elevated-card rounded-2xl border border-white/50 p-6 sm:p-8 animate-slide-up-delay">
        <form onSubmit={handleFindCompanions} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {destinations.slice(0, 8).map((dest) => (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => setDestination(dest.name)}
                  aria-pressed={destination === dest.name}
                  className={`relative rounded-xl overflow-hidden border-2 ${destination === dest.name ? 'border-cyan-500 shadow-md shadow-cyan-400/25' : 'border-transparent'} group`}
                >
                  <div className="aspect-[4/3] relative">
                    <img src={dest.image} alt={dest.name} className="h-full w-full object-cover group-hover:scale-105 transition" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <span className="absolute bottom-2 left-2 text-xs font-semibold text-white">{dest.name}</span>
                    {destination === dest.name && (
                      <span className="absolute top-2 right-2 bg-cyan-600 rounded-full p-1">
                        <MapPin className="h-3 w-3 text-white" />
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-3 relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Custom destination"
                className="w-full border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm bg-gray-50/50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500">Start</label>
              <div className="relative">
                <Calendar className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                <input type="date" min={todayStr} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">End</label>
              <div className="relative">
                <Calendar className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                <input type="date" min={startDate || todayStr} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Budget</label>
              <div className="relative">
                <Wallet className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                <select value={budget} onChange={(e) => setBudget(e.target.value as Trip['budget'])} className="w-full border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors">
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Trip Type</label>
              <div className="relative">
                <Route className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                <select value={travelType} onChange={(e) => setTravelType(e.target.value as Trip['travelType'])} className="w-full border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors">
                  <option>Leisure</option>
                  <option>Adventure</option>
                  <option>Backpacking</option>
                  <option>Business</option>
                  <option>Standard</option>
                  <option>Luxury</option>
                </select>
              </div>
            </div>
          </div>

          {(formError || validationErrors.length > 0) && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
              {formError || validationErrors[0]}
            </div>
          )}

          <button
            disabled={isMatching}
            className="inline-flex items-center px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-600 to-sky-700 hover:from-cyan-700 hover:to-sky-800 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
          >
            <Search className="h-4 w-4 mr-2" />
            {isMatching ? 'Finding...' : 'Find Companions'}
          </button>
        </form>
      </div>

      {matchSummary && (
        <div className="grid grid-cols-3 gap-4 stagger-children">
          <StatCard title="Candidates" value={matchSummary.totalCandidates.toString()} icon="users" />
          <StatCard title="Eligible" value={matchSummary.eligibleAfterFiltering.toString()} icon="check" />
          <StatCard title="Recommended" value={stats.recommended.toString()} accent="text-cyan-700" icon="sparkle" />
        </div>
      )}

      <div className="space-y-5">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <div className="p-1.5 bg-gradient-to-br from-cyan-600 to-sky-700 rounded-lg mr-2">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          Ranked Matches
        </h2>

        {isMatching ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <MatchCardSkeleton key={i} />
            ))}
          </div>
        ) : recommendedMatches.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {recommendedMatches.map((match) => (
              <CompanionCard key={match.matchId} match={match} />
            ))}
          </div>
        ) : !hasSearched ? (
          <div className="text-center py-12 glass-panel elevated-card rounded-2xl border border-white/40">
            <div className="p-3 bg-cyan-50 rounded-2xl inline-block mb-3"><Search className="h-6 w-6 text-cyan-600" /></div>
            <p className="text-gray-700 font-semibold">Ready to discover companions</p>
            <p className="text-gray-500 text-sm mt-1">Fill trip details and click Find Companions.</p>
          </div>
        ) : matchError ? (
          <div className="text-center py-12 bg-red-50/80 backdrop-blur-sm rounded-2xl border border-red-200/60">
            <p className="text-red-700 font-semibold">Something went wrong</p>
            <p className="text-red-600 text-sm mt-1">{matchError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-5 py-2.5 text-sm bg-gradient-to-r from-cyan-600 to-sky-700 text-white rounded-xl hover:shadow-lg shadow-cyan-500/25 transition-all font-medium"
            >
              Refresh &amp; Retry
            </button>
          </div>
        ) : (
          <div className="text-center py-12 glass-panel elevated-card rounded-2xl border border-white/40">
            <div className="p-3 bg-gray-100 rounded-2xl inline-block mb-3"><Users className="h-6 w-6 text-gray-400" /></div>
            <p className="text-gray-700 font-semibold">No recommendations yet</p>
            <p className="text-gray-500 text-sm mt-1">Set trip details and run matching to get results.</p>
            <p className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-4 py-1.5 rounded-full mt-3">
              <Info size={13} /> Destination + Date overlap + Interests + Budget + Style
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, accent, icon }: { title: string; value: string; accent?: string; icon?: string }) {
  const iconBg = icon === 'heart' ? 'from-pink-500 to-rose-500' : icon === 'sparkle' ? 'from-cyan-500 to-sky-700' : icon === 'check' ? 'from-blue-500 to-indigo-600' : 'from-gray-500 to-gray-600';
  return (
    <div className="glass-panel elevated-card border border-white/40 rounded-2xl p-4 hover:shadow-md transition-all duration-300 card-hover-glow">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${iconBg} shadow-sm`} />
        <p className="text-xs text-gray-500 font-medium">{title}</p>
      </div>
      <p className={`text-2xl font-bold text-gray-900 ${accent ?? ''} animate-count-up`}>{value}</p>
    </div>
  );
}
