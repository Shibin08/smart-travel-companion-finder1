import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle, Clock, XCircle, MessageCircle, Search, Plane, Globe, MapPin } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/UserAvatar';

type TabFilter = 'all' | 'Matched' | 'Pending' | 'Rejected';

export default function MatchesPage() {
  const { user } = useAuth();
  const { matches, generateMatches, isMatching, updateMatchStatus } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingMatchId, setUpdatingMatchId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<Record<string, string>>({});

  useEffect(() => { document.title = 'My Matches - TravelMatch'; }, []);

  useEffect(() => {
    if (user && matches.length === 0) {
      void generateMatches();
    }
  }, [user]);

  const filtered = useMemo(() => {
    let result = tab === 'all' ? matches : matches.filter((m) => m.matchStatus === tab);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.user.name.toLowerCase().includes(q) ||
          (m.user.currentCity && m.user.currentCity.toLowerCase().includes(q)) ||
          m.user.profile.travelStyle.toLowerCase().includes(q),
      );
    }
    return result;
  }, [matches, tab, searchQuery]);

  const counts = {
    all: matches.length,
    Matched: matches.filter((m) => m.matchStatus === 'Matched').length,
    Pending: matches.filter((m) => m.matchStatus === 'Pending').length,
    Rejected: matches.filter((m) => m.matchStatus === 'Rejected').length,
  };

  const tabs: { key: TabFilter; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'all', label: 'All', icon: <Users size={14} />, count: counts.all },
    { key: 'Matched', label: 'Connected', icon: <CheckCircle size={14} />, count: counts.Matched },
    { key: 'Pending', label: 'Pending', icon: <Clock size={14} />, count: counts.Pending },
    { key: 'Rejected', label: 'Rejected', icon: <XCircle size={14} />, count: counts.Rejected },
  ];

  const statusBadge = (status: string) => {
    switch (status) {
      case 'Matched':
        return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700"><CheckCircle size={10} /> Connected</span>;
      case 'Pending':
        return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock size={10} /> Pending</span>;
      case 'Rejected':
        return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700"><XCircle size={10} /> Rejected</span>;
      default:
        return null;
    }
  };

  const handleInlineAccept = async (matchId: string) => {
    setUpdatingMatchId(matchId);
    setInlineError((prev) => ({ ...prev, [matchId]: '' }));
    const updated = await updateMatchStatus(matchId, 'Matched');
    if (!updated) {
      setInlineError((prev) => ({ ...prev, [matchId]: 'Could not accept right now. Please try again.' }));
    }
    setUpdatingMatchId(null);
  };

  const handleInlineReject = async (matchId: string) => {
    setUpdatingMatchId(matchId);
    setInlineError((prev) => ({ ...prev, [matchId]: '' }));
    const updated = await updateMatchStatus(matchId, 'Rejected');
    if (!updated) {
      setInlineError((prev) => ({ ...prev, [matchId]: 'Could not reject right now. Please try again.' }));
    }
    setUpdatingMatchId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-cyan-700 via-sky-700 to-teal-700 rounded-3xl p-6 sm:p-8 shadow-xl shadow-cyan-500/20 text-white animate-slide-up">
        {/* Floating decorative icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <Plane className="absolute top-4 right-[12%] h-7 w-7 text-white/10 animate-float rotate-[-15deg]" />
          <Globe className="absolute bottom-4 left-[8%] h-8 w-8 text-white/10 animate-float-delayed" />
          <MapPin className="absolute top-6 left-[55%] h-5 w-5 text-white/10 animate-float-slow" />
        </div>
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3">
            <span className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm">
              <Users className="h-6 w-6" />
            </span>
            My Matches
          </h1>
          <p className="text-cyan-100 mt-2 max-w-lg">View and manage all your travel companion matches.</p>

          {/* Search */}
          <div className="relative mt-5 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, city, or travel style..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all duration-200"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              tab === t.key
                ? 'bg-gradient-to-r from-cyan-600 to-sky-700 text-white shadow-md shadow-cyan-500/25'
                : 'bg-white/80 backdrop-blur-sm text-gray-600 border border-gray-200/60 hover:bg-white hover:shadow-sm'
            }`}
          >
            {t.icon}
            {t.label}
            <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {isMatching && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-200 border-t-cyan-600 mx-auto" />
          <p className="text-gray-500 mt-3 text-sm">Loading matches...</p>
        </div>
      )}

      {/* Empty state */}
      {!isMatching && filtered.length === 0 && (
        <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-sm">
          <div className="inline-flex items-center justify-center p-4 bg-gray-100/80 rounded-2xl mx-auto">
            <Users className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-800 mt-4">No matches found</h3>
          <p className="text-gray-500 text-sm mt-1">
            {tab === 'all'
              ? 'Start by searching for companions on the Find Companion page.'
              : `No ${tab.toLowerCase()} matches yet.`}
          </p>
          {tab === 'all' && (
            <button
              onClick={() => navigate('/find-companion')}
              className="mt-4 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-700 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-cyan-500/25 hover:-translate-y-0.5 transition-all duration-200"
            >
              Find Companions
            </button>
          )}
        </div>
      )}

      {/* Match list */}
      {!isMatching && filtered.length > 0 && (
        <div className="space-y-3 stagger-children">
          {filtered.map((match) => (
            <div
              key={match.matchId}
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-4 shadow-sm hover:border-cyan-300 hover:shadow-md transition-all duration-200 group card-hover-glow"
            >
              <div className="flex items-center gap-4">
                <UserAvatar
                  src={match.user.photoUrl}
                  name={match.user.name}
                  className="h-14 w-14 rounded-full shrink-0 text-lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{match.user.name}</h3>
                    {statusBadge(match.matchStatus)}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {match.user.age} - {match.user.gender} - {match.user.currentCity}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="font-medium text-cyan-700">{match.score}% compatible</span>
                    <span>{match.user.profile.travelStyle}</span>
                    <span>{match.user.profile.budget} budget</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {match.matchStatus === 'Matched' && (
                    <button
                      onClick={() => navigate(`/chat/${match.matchId}`)}
                      className="p-2 bg-gradient-to-r from-cyan-600 to-sky-700 text-white rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200"
                      title="Chat"
                    >
                      <MessageCircle size={18} />
                    </button>
                  )}
                  {match.matchStatus === 'Pending' && match.pendingRole === 'received' && (
                    <>
                      <button
                        onClick={() => { void handleInlineAccept(match.matchId); }}
                        disabled={updatingMatchId === match.matchId}
                        className="px-3 py-2 text-xs font-semibold rounded-xl text-white bg-gradient-to-r from-cyan-600 to-sky-700 hover:shadow-lg hover:shadow-cyan-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        {updatingMatchId === match.matchId ? 'Accepting...' : 'Accept'}
                      </button>
                      <button
                        onClick={() => { void handleInlineReject(match.matchId); }}
                        disabled={updatingMatchId === match.matchId}
                        className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => navigate(`/match/${match.matchId}`)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white/80 border border-gray-200/60 rounded-xl hover:bg-white hover:shadow-sm transition-all duration-200"
                  >
                    View
                  </button>
                </div>
              </div>
              {inlineError[match.matchId] && (
                <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {inlineError[match.matchId]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
