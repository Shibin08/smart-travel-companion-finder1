import { useState } from 'react';
import type { Match } from '../types';
import { Heart, MessageCircle, MapPin, CalendarDays, Wallet, TrendingUp, AlertCircle, CheckCircle, Star, Users, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

import UserAvatar from './UserAvatar';

interface CompanionCardProps {
  match: Match;
}

export default function CompanionCard({ match }: CompanionCardProps) {
  const navigate = useNavigate();
  const { updateMatchStatus } = useApp();
  const { user, score, matchDetails, compatibilityScore } = match;
  const [isConnecting, setIsConnecting] = useState(false);

  // Color coding based on score
  const scoreColor = score >= 80 ? 'bg-green-100 text-green-800 border-green-200' :
    score >= 60 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
      'bg-red-100 text-red-800 border-red-200';

  const budgetPill =
    matchDetails.budgetCompatibility === 'High'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : matchDetails.budgetCompatibility === 'Medium'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';

  const getCompatibilityIcon = (component: keyof typeof compatibilityScore.components) => {
    const value = compatibilityScore.components[component];
    if (value >= 0.8) return <CheckCircle className="h-3 w-3 text-green-600" />;
    if (value >= 0.5) return <TrendingUp className="h-3 w-3 text-yellow-600" />;
    return <AlertCircle className="h-3 w-3 text-red-600" />;
  };

  const formatCompatibilityValue = (value: number) => {
    return Math.round(value * 100);
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full border border-gray-100 hover:border-teal-200">
      {/* Header with Image and Score */}
      <div className="relative h-48">
        <UserAvatar
          src={user.photoUrl}
          name={user.name}
          className="w-full h-full text-5xl"
          aria-label={`Photo of ${user.name}`}
        />
        <div className="absolute top-2 right-2">
          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${scoreColor}`}>
            <Star className="h-3 w-3 mr-1 fill-current" />
            {score}% Match
          </div>
        </div>
        
        {/* Common Interests Badge */}
        {(matchDetails.interestMatch.length > 0) && (
          <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-md">
            <p className="text-white text-xs font-medium flex items-center gap-1">
              <Heart size={12} className="text-pink-400 fill-pink-400" />
              {matchDetails.interestMatch.length} Common Interests
            </p>
          </div>
        )}
        
        {/* Verification Badge */}
        {user.verificationStatus === 'Verified' && (
          <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded-full flex items-center">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium">Verified</span>
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              {user.name}
              {user.stats.averageRating > 0 && (
                <div className="flex items-center ml-2">
                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                  <span className="text-sm text-gray-600 ml-1">{user.stats.averageRating.toFixed(1)}</span>
                </div>
              )}
            </h3>
            <p className="text-sm text-gray-500">{user.age} • {user.gender} • {user.currentCity}</p>
          </div>
        </div>

        <p className="mt-3 text-sm text-gray-600 line-clamp-2">{user.bio}</p>

        {/* Travel Preferences */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            {user.profile.travelStyle}
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            {user.profile.budget} Budget
          </span>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${budgetPill}`}>
            <Wallet size={12} className="mr-1" />
            Budget {matchDetails.budgetCompatibility}
          </span>
        </div>

        {/* Compatibility Breakdown */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
            <TrendingUp className="h-3 w-3 mr-1" />
            Compatibility Breakdown
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Interests</span>
              <div className="flex items-center">
                {getCompatibilityIcon('interestSimilarity')}
                <span className="ml-1 font-medium">{formatCompatibilityValue(compatibilityScore.components.interestSimilarity)}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Budget</span>
              <div className="flex items-center">
                {getCompatibilityIcon('budgetCompatibility')}
                <span className="ml-1 font-medium">{formatCompatibilityValue(compatibilityScore.components.budgetCompatibility)}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Schedule</span>
              <div className="flex items-center">
                {getCompatibilityIcon('scheduleOverlap')}
                <span className="ml-1 font-medium">{formatCompatibilityValue(compatibilityScore.components.scheduleOverlap)}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Location</span>
              <div className="flex items-center">
                {matchDetails.locationProximity === 'Same City' ? (
                  <><Navigation className="h-3 w-3 text-green-600 mr-1" /><span className="font-medium">Same City</span></>
                ) : matchDetails.locationProximity === 'Nearby' ? (
                  <><Navigation className="h-3 w-3 text-yellow-600 mr-1" /><span className="font-medium">Nearby</span></>
                ) : (
                  <><Navigation className="h-3 w-3 text-gray-400 mr-1" /><span className="font-medium">Different</span></>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Strengths and Concerns */}
        {(compatibilityScore.strengths.length > 0 || compatibilityScore.concerns.length > 0) && (
          <div className="mt-3 space-y-1">
            {compatibilityScore.strengths.slice(0, 2).map((strength, index) => (
              <div key={index} className="flex items-center text-xs text-green-700">
                <CheckCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                <span className="truncate">{strength}</span>
              </div>
            ))}
            {compatibilityScore.concerns.slice(0, 1).map((concern, index) => (
              <div key={index} className="flex items-center text-xs text-orange-700">
                <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                <span className="truncate">{concern}</span>
              </div>
            ))}
          </div>
        )}

        {/* Trip Details */}
        <div className="mt-3 text-xs text-gray-500 space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center"><MapPin size={12} className="mr-1" />{user.currentCity}</span>
            <span className="flex items-center"><CalendarDays size={12} className="mr-1" />{matchDetails.dateOverlap ? 'Dates Match' : 'Limited Overlap'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center"><Users size={12} className="mr-1" />{user.stats.tripsCompleted} trips</span>
            <span className="flex items-center">{user.stats.responseRate}% response rate</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate(`/match/${match.matchId}`)}
          className="flex items-center justify-center px-4 py-2.5 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          View Profile
        </button>
        {match.matchStatus === 'Matched' ? (
          <button
            onClick={() => navigate(`/chat/${match.matchId}`)}
            className="flex items-center justify-center px-4 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 transition-colors"
          >
            <MessageCircle size={16} className="mr-2" />
            Chat
          </button>
        ) : (
          <button
            onClick={async () => {
              if (!match.chatEnabled) return;
              setIsConnecting(true);
              await updateMatchStatus(match.matchId, 'Matched');
              setIsConnecting(false);
            }}
            disabled={!match.chatEnabled || isConnecting}
            className={`flex items-center justify-center px-4 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-lg transition-colors ${
              match.chatEnabled
                ? 'text-white bg-teal-600 hover:bg-teal-700'
                : 'text-gray-400 bg-gray-300 cursor-not-allowed'
            }`}
          >
            <MessageCircle size={16} className="mr-2" />
            {isConnecting ? 'Connecting...' : match.chatEnabled ? 'Connect' : 'Score Too Low'}
          </button>
        )}
      </div>
    </div>
  );
}
