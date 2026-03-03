import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Info,
  MapPin,
  PlusCircle,
  Route,
  Search,
  Sparkles,
  Users,
  Wallet,
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
    placeRequests,
    addPlaceRequest,
  } = useApp();

  const [mode, setMode] = useState<'discover' | 'post'>('discover');

  const [destination, setDestination] = useState(currentTrip?.destination ?? 'Goa');
  const [startDate, setStartDate] = useState(currentTrip?.startDate ?? '2026-03-10');
  const [endDate, setEndDate] = useState(currentTrip?.endDate ?? '2026-03-15');
  const [budget, setBudget] = useState<Trip['budget']>(currentTrip?.budget ?? 'Medium');
  const [travelType, setTravelType] = useState<Trip['travelType']>(currentTrip?.travelType ?? 'Leisure');

  const [companionsNeeded, setCompanionsNeeded] = useState(1);
  const [notes, setNotes] = useState('');
  const [postError, setPostError] = useState('');
  const [postSuccess, setPostSuccess] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [requestFilter, setRequestFilter] = useState<'All' | Trip['travelType']>('All');
  const [requestPage, setRequestPage] = useState(1);

  useEffect(() => { document.title = 'Find Companion — Travel Companion Finder'; }, []);

  const REQUEST_PAGE_SIZE = 4;

  const destinationMeta = useMemo(
    () => destinations.find((d) => d.name.toLowerCase() === destination.trim().toLowerCase()),
    [destination],
  );

  const mapEmbedUrl = useMemo(
    () => `https://maps.google.com/maps?q=${encodeURIComponent(destination || 'India')}&t=&z=10&ie=UTF8&iwloc=&output=embed`,
    [destination],
  );

  const placeImage = useMemo(() => {
    if (destinationMeta?.image) return destinationMeta.image;
    return `https://source.unsplash.com/900x500/?${encodeURIComponent(destination || 'travel destination')}`;
  }, [destination, destinationMeta]);

  const stats = useMemo(() => {
    const matched = matches.filter((m) => m.matchStatus === 'Matched').length;
    const recommended = matches.filter((m) => m.matchStatus === 'Recommended').length;
    return { matched, recommended };
  }, [matches]);

  const filteredRequests = useMemo(() => {
    if (requestFilter === 'All') return placeRequests;
    return placeRequests.filter((request) => request.travelType === requestFilter);
  }, [placeRequests, requestFilter]);

  const totalRequestPages = Math.max(1, Math.ceil(filteredRequests.length / REQUEST_PAGE_SIZE));

  const pagedRequests = useMemo(() => {
    const start = (requestPage - 1) * REQUEST_PAGE_SIZE;
    return filteredRequests.slice(start, start + REQUEST_PAGE_SIZE);
  }, [filteredRequests, requestPage]);

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

  const validatePageInputs = () => {
    if (!destination.trim()) return 'Destination is required.';
    if (!startDate || !endDate) return 'Select start and end dates.';
    if (new Date(startDate) > new Date(endDate)) return 'Start date cannot be after end date.';
    return '';
  };

  const handleFindCompanions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const inputError = validatePageInputs();
    if (inputError) {
      setPostError(inputError);
      showToast('error', inputError);
      return;
    }

    setPostError('');
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
      setMode('discover');
    }
  };

  const handlePostRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const inputError = validatePageInputs();
    if (inputError) {
      setPostError(inputError);
      showToast('error', inputError);
      return;
    }

    if (notes.trim().length < 15) {
      setPostError('Please add at least 15 characters in notes.');
      showToast('error', 'Please add at least 15 characters in notes.');
      return;
    }

    const posted = addPlaceRequest({
      userId: user.userId,
      userName: user.name,
      destination,
      placeImage,
      pinLat: 0,
      pinLng: 0,
      pinLabel: destination,
      startDate,
      endDate,
      companionsNeeded,
      budget,
      travelType,
      notes,
      status: 'Open',
      applicants: [],
    });

    if (!posted) {
      setPostError('Unable to post request. Please verify all fields.');
      showToast('error', 'Unable to post request. Please verify all fields.');
      return;
    }

    setPostError('');
    setPostSuccess('Your place request is now live.');
    setNotes('');
    setCompanionsNeeded(1);
    setMode('discover');
    setRequestFilter('All');
    setRequestPage(1);
    showToast('success', 'Place request posted successfully.');
    window.setTimeout(() => setPostSuccess(''), 2500);
  };

  const handleFilterChange = (nextFilter: 'All' | Trip['travelType']) => {
    setRequestFilter(nextFilter);
    setRequestPage(1);
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

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Travel Companion Hub</h1>
            <p className="text-sm text-gray-500">Find companions or post where you need travel buddies.</p>
          </div>
          <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
            <button
              onClick={() => setMode('discover')}
              className={`px-3 py-1.5 rounded-md text-sm ${mode === 'discover' ? 'bg-white shadow text-teal-700' : 'text-gray-600'}`}
            >
              Discover Matches
            </button>
            <button
              onClick={() => setMode('post')}
              className={`px-3 py-1.5 rounded-md text-sm ${mode === 'post' ? 'bg-white shadow text-teal-700' : 'text-gray-600'}`}
            >
              Post Place Request
            </button>
          </div>
        </div>

        <form onSubmit={mode === 'discover' ? handleFindCompanions : handlePostRequest} className="space-y-5">
          <div className="mode-fade-in" key={mode}>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>

            {mode === 'discover' ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {destinations.slice(0, 8).map((dest) => (
                    <button
                      key={dest.id}
                      type="button"
                      onClick={() => setDestination(dest.name)}
                      className={`relative rounded-xl overflow-hidden border-2 ${destination === dest.name ? 'border-teal-500 shadow-md' : 'border-transparent'} group`}
                    >
                      <div className="aspect-[4/3] relative">
                        <img src={dest.image} alt={dest.name} className="h-full w-full object-cover group-hover:scale-105 transition" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <span className="absolute bottom-2 left-2 text-xs font-semibold text-white">{dest.name}</span>
                        {destination === dest.name && (
                          <span className="absolute top-2 right-2 bg-teal-500 rounded-full p-1">
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
                    className="w-full border border-gray-300 rounded-md py-2 pl-9 pr-3 text-sm"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Search place for posting request (e.g., Goa, Jaipur)"
                    className="w-full border border-gray-300 rounded-md py-2 pl-9 pr-3 text-sm"
                  />
                </div>

                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <iframe
                    title="Place map preview"
                    src={mapEmbedUrl}
                    className="w-full h-64"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>

                <p className="text-xs text-gray-500 inline-flex items-center">
                  <MapPin className="h-3 w-3 mr-1" /> Searched place will be used for your post and shown in discover cards.
                </p>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-gray-500">Start</label>
              <div className="relative">
                <Calendar className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-md py-2 pl-9 pr-3 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">End</label>
              <div className="relative">
                <Calendar className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                <input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded-md py-2 pl-9 pr-3 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Budget</label>
              <div className="relative">
                <Wallet className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                <select value={budget} onChange={(e) => setBudget(e.target.value as Trip['budget'])} className="w-full border rounded-md py-2 pl-9 pr-3 text-sm bg-white">
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
                <select value={travelType} onChange={(e) => setTravelType(e.target.value as Trip['travelType'])} className="w-full border rounded-md py-2 pl-9 pr-3 text-sm bg-white">
                  <option>Leisure</option>
                  <option>Adventure</option>
                  <option>Backpacking</option>
                  <option>Business</option>
                </select>
              </div>
            </div>
            {mode === 'post' && (
              <div>
                <label className="text-xs text-gray-500">Companions</label>
                <div className="relative">
                  <Users className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={companionsNeeded}
                    onChange={(e) => setCompanionsNeeded(Number(e.target.value))}
                    className="w-full border rounded-md py-2 pl-9 pr-3 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {mode === 'post' && (
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes: preferences, stay style, plan highlights..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          )}

          {(postError || validationErrors.length > 0) && (
            <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm text-red-700">
              {postError || validationErrors[0]}
            </div>
          )}
          {postSuccess && <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm text-green-700">{postSuccess}</div>}

          <button className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-teal-600 hover:bg-teal-700">
            {mode === 'discover' ? <Search className="h-4 w-4 mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
            {mode === 'discover' ? 'Find Companions' : 'Post Request'}
          </button>
        </form>
      </div>

      {mode === 'discover' && matchSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Candidates" value={matchSummary.totalCandidates.toString()} />
          <StatCard title="Eligible" value={matchSummary.eligibleAfterFiltering.toString()} />
          <StatCard title="Recommended" value={stats.recommended.toString()} accent="text-emerald-600" />
          <StatCard title="Matched" value={stats.matched.toString()} accent="text-teal-600" />
        </div>
      )}

      {mode === 'discover' && <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <Sparkles className="h-5 w-5 text-teal-600 mr-2" /> Ranked Matches
        </h2>

        {isMatching ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <MatchCardSkeleton key={i} />
            ))}
          </div>
        ) : matches.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map((match) => (
              <CompanionCard key={match.matchId} match={match} />
            ))}
          </div>
        ) : !hasSearched ? (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-700 font-medium">Ready to discover companions.</p>
            <p className="text-gray-500 text-sm mt-1">Fill trip details and click Find Companions.</p>
          </div>
        ) : matchError ? (
          <div className="text-center py-10 bg-red-50 rounded-xl border border-red-200">
            <p className="text-red-700 font-medium">Something went wrong</p>
            <p className="text-red-600 text-sm mt-1">{matchError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
            >
              Refresh &amp; Retry
            </button>
          </div>
        ) : (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-700 font-medium">No recommendations yet.</p>
            <p className="text-gray-500 text-sm mt-1">Set trip details and run matching to get results.</p>
            <p className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full mt-3">
              <Info size={13} /> Destination + Date overlap + Interests + Budget + Style
            </p>
          </div>
        )}
      </div>}

      {mode === 'discover' && <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 inline-flex items-center">
          <MapPin className="h-5 w-5 text-teal-600 mr-2" /> Community Place Requests
        </h2>

        <div className="flex flex-wrap gap-2">
          {(['All', 'Leisure', 'Adventure', 'Backpacking', 'Business'] as const).map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleFilterChange(chip)}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                requestFilter === chip
                  ? 'bg-teal-100 text-teal-800 border-teal-200'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {pagedRequests.map((request) => (
            <div key={request.requestId} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="h-40 relative">
                <img src={request.placeImage} alt={request.destination} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <p className="absolute bottom-2 left-3 font-semibold text-white">{request.destination}</p>
              </div>

              <div className="p-4">
                <div className="flex justify-between items-start">
                  <p className="text-xs text-gray-500">by {request.userName}</p>
                  <span className="text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded-full">{request.travelType}</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">{request.startDate} to {request.endDate}</p>
                <p className="text-sm text-gray-600">Budget: {request.budget} • Need: {request.companionsNeeded} people</p>
                <p className="text-sm text-gray-700 mt-2">{request.notes}</p>
              </div>
            </div>
          ))}
        </div>

        {filteredRequests.length === 0 && (
          <div className="text-sm text-gray-500 bg-white border border-gray-200 rounded-lg p-4">
            No requests found for the selected filter.
          </div>
        )}

        {filteredRequests.length > REQUEST_PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Page {requestPage} of {totalRequestPages}
            </p>
            <div className="inline-flex gap-2">
              <button
                type="button"
                onClick={() => setRequestPage((prev) => Math.max(1, prev - 1))}
                disabled={requestPage === 1}
                className="px-3 py-1.5 text-xs border rounded-md bg-white disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setRequestPage((prev) => Math.min(totalRequestPages, prev + 1))}
                disabled={requestPage === totalRequestPages}
                className="px-3 py-1.5 text-xs border rounded-md bg-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>}
    </div>
  );
}

function StatCard({ title, value, accent }: { title: string; value: string; accent?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-500">{title}</p>
      <p className={`text-2xl font-bold text-gray-900 ${accent ?? ''}`}>{value}</p>
    </div>
  );
}
