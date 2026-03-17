import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  ChevronDown,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  PlusCircle,
  Route,
  Search,
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
import type { Destination } from '../data/destinations';
import { joinPlaceRequest, fetchCommunityDestinations } from '../utils/apiClient';
import DestinationMap from '../components/DestinationMap';

const REQUEST_PAGE_SIZE = 6;
const TOKEN_STORAGE_KEY = 'tcf_token';
const DEFAULT_TRIP_IMAGE = '/images/destinations/default-trip.svg';

export default function OpenTripsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { placeRequests, addPlaceRequest, refreshPlaceRequests } = useApp();

  const [mode, setMode] = useState<'browse' | 'post'>('browse');
  const [destination, setDestination] = useState('Goa');
  const defaultStart = new Date();
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setDate(defaultEnd.getDate() + 5);
  const [startDate, setStartDate] = useState(defaultStart.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(defaultEnd.toISOString().split('T')[0]);
  const [budget, setBudget] = useState<Trip['budget']>('Medium');
  const [travelType, setTravelType] = useState<Trip['travelType']>('Leisure');
  const [companionsNeeded, setCompanionsNeeded] = useState(1);
  const [notes, setNotes] = useState('');
  const [postError, setPostError] = useState('');
  const [postSuccess, setPostSuccess] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [requestFilter, setRequestFilter] = useState<'All' | Trip['travelType']>('All');
  const [requestPage, setRequestPage] = useState(1);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const destRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Open Trip Plans - TravelMatch';
  }, []);

  // Fetch community-added destinations from posted trip plans
  const [communityDests, setCommunityDests] = useState<Destination[]>([]);
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return;
    fetchCommunityDestinations(token).then((list) => {
      const builtinNames = new Set(destinations.map((d) => d.name.toLowerCase()));
      setCommunityDests(
        list
          .filter((d) => !builtinNames.has(d.name.toLowerCase()))
          .map((d) => ({
            id: `community-${d.name.toLowerCase().replace(/\s+/g, '-')}`,
            name: d.name,
            image: d.image || DEFAULT_TRIP_IMAGE,
            description: 'Added by travelers',
            properties: d.properties,
          })),
      );
    });
  }, [placeRequests]); // re-fetch when a new trip is posted

  const allDestinations = useMemo(
    () => [...destinations, ...communityDests],
    [communityDests],
  );

  const filteredDestinations = useMemo(() => {
    const q = destination.trim().toLowerCase();
    if (!q) return allDestinations;
    return allDestinations.filter((d) => d.name.toLowerCase().includes(q));
  }, [destination, allDestinations]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (destRef.current && !destRef.current.contains(e.target as Node)) {
        setShowDestDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const destinationMeta = useMemo(
    () => allDestinations.find((d) => d.name.toLowerCase() === destination.trim().toLowerCase()),
    [destination, allDestinations],
  );

  const placeImage = useMemo(() => {
    if (destinationMeta?.image) return destinationMeta.image;
    return DEFAULT_TRIP_IMAGE;
  }, [destinationMeta]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isExpired = (endDate: string) => new Date(endDate) < today;

  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Expired'>('Active');

  const filteredRequests = useMemo(() => {
    let list = placeRequests;
    if (requestFilter !== 'All') {
      list = list.filter((r) => r.travelType === requestFilter);
    }
    if (statusFilter === 'Active') {
      list = list.filter((r) => !isExpired(r.endDate));
    } else if (statusFilter === 'Expired') {
      list = list.filter((r) => isExpired(r.endDate));
    }
    // Active plans first, then expired
    return [...list].sort((a, b) => {
      const aExp = isExpired(a.endDate) ? 1 : 0;
      const bExp = isExpired(b.endDate) ? 1 : 0;
      return aExp - bExp;
    });
  }, [placeRequests, requestFilter, statusFilter, today]);

  const totalRequestPages = Math.max(1, Math.ceil(filteredRequests.length / REQUEST_PAGE_SIZE));

  const pagedRequests = useMemo(() => {
    const start = (requestPage - 1) * REQUEST_PAGE_SIZE;
    return filteredRequests.slice(start, start + REQUEST_PAGE_SIZE);
  }, [filteredRequests, requestPage]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 2200);
  };

  const [joiningId, setJoiningId] = useState<string | null>(null);

  const handleJoinTrip = async (requestId: string) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token || !user) return;

    setJoiningId(requestId);
    try {
      const result = await joinPlaceRequest(token, Number(requestId));
      await refreshPlaceRequests();
      showToast('success', 'You joined the trip! Opening chat...');
      // Navigate to chat with the poster after a brief moment
      setTimeout(() => navigate(`/chat/${result.poster_user_id}`), 600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join trip';
      showToast('error', msg);
    } finally {
      setJoiningId(null);
    }
  };

  const validateInputs = () => {
    if (!destination.trim()) return 'Destination is required.';
    if (!startDate || !endDate) return 'Select start and end dates.';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(startDate) < today) return 'Start date cannot be in the past.';
    if (new Date(endDate) < today) return 'End date cannot be in the past.';
    if (new Date(startDate) > new Date(endDate)) return 'Start date cannot be after end date.';
    return '';
  };

  const handlePostRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const inputError = validateInputs();
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
      showToast('error', 'Unable to post request.');
      return;
    }

    setPostError('');
    setPostSuccess('Your trip plan is now live!');
    setNotes('');
    setCompanionsNeeded(1);
    setMode('browse');
    setStatusFilter('Active');
    setRequestFilter('All');
    setRequestPage(1);
    showToast('success', 'Trip plan posted successfully.');
    window.setTimeout(() => setPostSuccess(''), 2500);
  };

  const handleFilterChange = (f: 'All' | Trip['travelType']) => {
    setRequestFilter(f);
    setRequestPage(1);
  };

  return (
    <div className="space-y-8">
      {toast && (
        <div className="fixed top-20 right-5 z-[70]">
          <div className={`px-4 py-2 rounded-lg shadow-lg text-sm text-white mode-fade-in ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {toast.message}
          </div>
        </div>
      )}

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-700 via-sky-700 to-teal-700 p-8 sm:p-10 text-white shadow-xl shadow-cyan-500/20 animate-slide-up">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <Plane className="absolute top-4 right-[15%] h-8 w-8 text-white/10 animate-float rotate-[-15deg]" />
          <Globe className="absolute bottom-6 left-[10%] h-10 w-10 text-white/10 animate-float-delayed" />
          <Mountain className="absolute top-8 left-[60%] h-7 w-7 text-white/10 animate-float-slow" />
          <Compass className="absolute bottom-4 right-[8%] h-6 w-6 text-white/10 animate-float" />
          <MapPin className="absolute top-[50%] left-[30%] h-5 w-5 text-white/10 animate-float-delayed" />
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Open Trip Plans</h1>
            <p className="mt-2 text-cyan-100 text-sm sm:text-base max-w-lg">Browse trips posted by fellow travelers or post your own plan to find companions.</p>
          </div>
          <div className="inline-flex rounded-xl border border-white/20 p-1 bg-white/10 backdrop-blur-sm">
            <button
              onClick={() => setMode('browse')}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${mode === 'browse' ? 'bg-white text-cyan-700 shadow-lg' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
            >
              Browse Plans
            </button>
            <button
              onClick={() => setMode('post')}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${mode === 'post' ? 'bg-white text-cyan-700 shadow-lg' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
            >
              Post a Plan
            </button>
          </div>
        </div>
      </div>

      {/* Post Form */}
      {mode === 'post' && (
        <div className="glass-panel elevated-card rounded-2xl border border-gray-200/60 p-6 sm:p-8 shadow-lg shadow-gray-200/40 animate-slide-up-delay">
          <div className="grid lg:grid-cols-[1fr_320px] gap-8">
            {/* Left — Form */}
            <form onSubmit={handlePostRequest} className="space-y-5">
              {/* Destination with autocomplete */}
              <div className="mode-fade-in">
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
                <div ref={destRef} className="relative">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-2.5 z-10" />
                  <input
                    value={destination}
                    onChange={(e) => { setDestination(e.target.value); setShowDestDropdown(true); }}
                    onFocus={() => setShowDestDropdown(true)}
                    placeholder="Search place (e.g., Goa, Jaipur)"
                    className="w-full border border-gray-200 rounded-xl py-2.5 pl-9 pr-9 text-sm bg-gray-50/50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                  />
                  <ChevronDown className={`h-4 w-4 text-gray-400 absolute right-3 top-2.5 transition-transform ${showDestDropdown ? 'rotate-180' : ''}`} />
                  {showDestDropdown && filteredDestinations.length > 0 && (
                    <div className="absolute z-30 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                      {filteredDestinations.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => { setDestination(d.name); setShowDestDropdown(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-cyan-50 transition-colors ${destination.toLowerCase() === d.name.toLowerCase() ? 'bg-cyan-50 text-cyan-700 font-medium' : 'text-gray-700'}`}
                        >
                          <img src={d.image} alt={d.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="block font-medium truncate">{d.name}</span>
                            <span className="block text-xs text-gray-400 truncate">{d.properties.join(' • ')}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {!destinationMeta && destination.trim() && (
                  <p className="text-xs text-amber-600 mt-1.5 inline-flex items-center">
                    <MapPin className="h-3 w-3 mr-1" /> Custom destination — a generic image will be used.
                  </p>
                )}
                <div className="mt-2">
                  <DestinationMap destination={destination} className="h-48 w-full" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Start Date</label>
                  <div className="relative">
                    <Calendar className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                    <input type="date" min={todayStr} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">End Date</label>
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
                      <option>Backpacker</option>
                      <option>Luxury</option>
                    </select>
                  </div>
                </div>
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
                      className="w-full border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Notes with character count */}
              <div>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe your trip — accommodation preference, must-see spots, travel vibe, group expectations..."
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                />
                <div className="flex justify-between mt-1">
                  <p className={`text-xs ${notes.trim().length < 15 ? 'text-amber-500' : 'text-gray-400'}`}>
                    {notes.trim().length < 15 ? `${15 - notes.trim().length} more characters needed` : 'Looks good!'}
                  </p>
                  <p className={`text-xs ${notes.length > 1800 ? 'text-amber-500' : 'text-gray-400'}`}>
                    {notes.length}/2000
                  </p>
                </div>
              </div>

              {postError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">{postError}</div>
              )}
              {postSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm text-emerald-700">{postSuccess}</div>
              )}

              <button className="inline-flex items-center px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-600 to-sky-700 hover:from-cyan-700 hover:to-sky-800 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5 transition-all duration-200">
                <PlusCircle className="h-4 w-4 mr-2" />
                Post Trip Plan
              </button>
            </form>

            {/* Right — Live Card Preview */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Live Preview</p>
              <div className="glass-panel elevated-card border border-gray-200/60 rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-lg hover:border-cyan-200/50 group">
                <div className="h-40 relative overflow-hidden">
                  <img
                    src={placeImage}
                    alt={destination || 'Destination'}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.dataset.fallback) {
                        target.dataset.fallback = '1';
                        target.src = DEFAULT_TRIP_IMAGE;
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <p className="absolute bottom-2 left-3 font-semibold text-white">
                    {destination.trim() || 'Your Destination'}
                  </p>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <p className="text-xs text-gray-500">by {user?.name || 'You'}</p>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-cyan-50 text-cyan-700">{travelType}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{startDate} to {endDate}</p>
                  <p className="text-sm text-gray-600">Budget: {budget} • Need: {companionsNeeded} {companionsNeeded === 1 ? 'person' : 'people'}</p>
                  <p className="text-sm text-gray-700 mt-2 line-clamp-3">
                    {notes.trim() || <span className="text-gray-400 italic">Your notes will appear here...</span>}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 text-center">This is how your trip card will look to others.</p>
            </div>
          </div>
        </div>
      )}

      {/* Browse Section */}
      {mode === 'browse' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {(['All', 'Active', 'Expired'] as const).map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => { setStatusFilter(chip); setRequestPage(1); }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                  statusFilter === chip
                    ? chip === 'Expired' ? 'bg-gray-100 text-gray-700 border-gray-400 shadow-sm' : 'bg-cyan-50 text-cyan-700 border-cyan-300 shadow-sm'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-cyan-300 hover:text-cyan-600'
                }`}
              >
                {chip}
              </button>
            ))}
            <div className="w-px h-6 bg-gray-200 self-center mx-1" />
            {(['All', 'Leisure', 'Adventure', 'Backpacker', 'Luxury'] as const).map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleFilterChange(chip)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                  requestFilter === chip
                    ? 'bg-cyan-50 text-cyan-700 border-cyan-300 shadow-sm'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-cyan-300 hover:text-cyan-600'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pagedRequests.map((request) => {
              const expired = isExpired(request.endDate);
              return (
                <div key={request.requestId} className={`glass-panel elevated-card border border-gray-200/60 rounded-2xl overflow-hidden shadow-sm transition-all duration-300 group ${expired ? 'opacity-60 grayscale-[40%]' : 'hover:shadow-lg hover:border-cyan-200/50'}`}>
                  <div className="h-40 relative overflow-hidden">
                    <img
                      src={request.placeImage}
                      alt={request.destination}
                      className={`w-full h-full object-cover transition-transform duration-500 ${expired ? '' : 'group-hover:scale-105'}`}
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.dataset.fallback) {
                          target.dataset.fallback = '1';
                          const match = destinations.find((d) => d.name.toLowerCase() === request.destination.trim().toLowerCase());
                          target.src = match?.image ?? DEFAULT_TRIP_IMAGE;
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <p className="absolute bottom-2 left-3 font-semibold text-white">{request.destination}</p>
                    {expired && (
                      <span className="absolute top-2 right-2 text-xs bg-gray-800/80 text-gray-200 px-2.5 py-1 rounded-full font-medium backdrop-blur-sm">
                        Expired
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <p className="text-xs text-gray-500">by {request.userName}</p>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${expired ? 'bg-gray-100 text-gray-500' : 'bg-cyan-50 text-cyan-700'}`}>{request.travelType}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{request.startDate} to {request.endDate}</p>
                    <p className="text-sm text-gray-600">Budget: {request.budget} • Need: {request.companionsNeeded} people</p>
                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">{request.notes}</p>
                    {expired && (
                      <p className="text-xs text-gray-500 mt-2 font-medium">This plan is expired.</p>
                    )}
                    {request.applicants.length > 0 && (
                      <p className="text-xs text-cyan-600 mt-1.5">{request.applicants.length} interested</p>
                    )}

                    {/* Join / Already Joined / Own trip / Chat button */}
                    {!expired && user && (() => {
                      const isOwn = request.userId === user.userId;
                      const alreadyJoined = request.applicants.includes(user.userId);
                      const isJoining = joiningId === request.requestId;

                      if (isOwn) {
                        return request.applicants.length > 0 ? (
                          <p className="mt-3 text-xs text-gray-500 italic">
                            {request.applicants.length} traveler{request.applicants.length > 1 ? 's' : ''} interested in your trip
                          </p>
                        ) : null;
                      }

                      if (alreadyJoined) {
                        return (
                          <button
                            type="button"
                            onClick={() => navigate(`/chat/${request.userId}`)}
                            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-cyan-700 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 transition-all duration-200"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Chat with {request.userName}
                          </button>
                        );
                      }

                      return (
                        <button
                          type="button"
                          disabled={isJoining}
                          onClick={() => handleJoinTrip(request.requestId)}
                          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-sky-700 hover:from-cyan-700 hover:to-sky-800 shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          {isJoining ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Heart className="h-3.5 w-3.5" />
                          )}
                          {isJoining ? 'Joining...' : "I'm Interested"}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredRequests.length === 0 && (
            <div className="text-sm text-gray-500 bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl p-6 text-center">
              No trip plans found for the selected filter.
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
                  className="px-3.5 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setRequestPage((prev) => Math.min(totalRequestPages, prev + 1))}
                  disabled={requestPage === totalRequestPages}
                  className="px-3.5 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

