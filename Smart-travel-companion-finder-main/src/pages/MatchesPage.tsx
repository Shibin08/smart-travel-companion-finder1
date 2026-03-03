import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle, Clock, XCircle, MessageCircle, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/UserAvatar';

type TabFilter = 'all' | 'Matched' | 'Pending' | 'Rejected';

export default function MatchesPage() {
  const { user } = useAuth();
  const { matches, generateMatches, isMatching } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { document.title = 'My Matches — Travel Companion Finder'; }, []);

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
        return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle size={10} /> Connected</span>;
      case 'Pending':
        return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock size={10} /> Pending</span>;
      case 'Rejected':
        return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700"><XCircle size={10} /> Rejected</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-6 w-6 text-teal-600" /> My Matches
        </h1>
        <p className="text-gray-600 mt-1">View and manage all your travel companion matches.</p>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, city, or travel style..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-teal-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t.icon}
            {t.label}
            <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {isMatching && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto" />
          <p className="text-gray-500 mt-3 text-sm">Loading matches...</p>
        </div>
      )}

      {/* Empty state */}
      {!isMatching && filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Users className="h-12 w-12 text-gray-300 mx-auto" />
          <h3 className="text-lg font-medium text-gray-800 mt-4">No matches found</h3>
          <p className="text-gray-500 text-sm mt-1">
            {tab === 'all'
              ? 'Start by searching for companions on the Find Companion page.'
              : `No ${tab.toLowerCase()} matches yet.`}
          </p>
          {tab === 'all' && (
            <button
              onClick={() => navigate('/find-companion')}
              className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700"
            >
              Find Companions
            </button>
          )}
        </div>
      )}

      {/* Match list */}
      {!isMatching && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((match) => (
            <div
              key={match.matchId}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-teal-200 transition-colors"
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
                    {match.user.age} • {match.user.gender} • {match.user.currentCity}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="font-medium text-teal-700">{match.score}% compatible</span>
                    <span>{match.user.profile.travelStyle}</span>
                    <span>{match.user.profile.budget} budget</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {match.matchStatus === 'Matched' && (
                    <button
                      onClick={() => navigate(`/chat/${match.matchId}`)}
                      className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                      title="Chat"
                    >
                      <MessageCircle size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/match/${match.matchId}`)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
