import { differenceInCalendarDays, isAfter, isBefore, parseISO } from 'date-fns';
import type { Match, MatchSummary, Trip, User } from '../types';

const WEIGHTS = {
  interest: 0.35,
  budget: 0.2,
  travelStyle: 0.2,
  verification: 0.1,
  location: 0.05,
  dateOverlap: 0.1,
} as const;

export interface MatchPipelineResult {
  matches: Match[];
  summary: MatchSummary;
}

export const validateTripInput = (trip: Trip): string[] => {
  const errors: string[] = [];

  if (!trip.destination.trim()) {
    errors.push('Destination is required.');
  }

  if (!trip.startDate || !trip.endDate) {
    errors.push('Travel dates are required.');
    return errors;
  }

  const start = parseISO(trip.startDate);
  const end = parseISO(trip.endDate);

  if (isAfter(start, end)) {
    errors.push('Start date cannot be after end date.');
  }

  if (differenceInCalendarDays(end, start) > 30) {
    errors.push('Trip duration should be 30 days or less for companion matching.');
  }

  return errors;
};

const normalize = (value: string) => value.trim().toLowerCase();

const hasDateOverlap = (
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean => {
  const aStart = parseISO(startA);
  const aEnd = parseISO(endA);
  const bStart = parseISO(startB);
  const bEnd = parseISO(endB);

  return !isBefore(aEnd, bStart) && !isAfter(aStart, bEnd);
};

const getBudgetCompatibility = (
  userBudget: Trip['budget'],
  candidateBudget: Trip['budget'],
): Match['matchDetails']['budgetCompatibility'] => {
  const scale: Trip['budget'][] = ['Low', 'Medium', 'High'];
  const diff = Math.abs(scale.indexOf(userBudget) - scale.indexOf(candidateBudget));

  if (diff === 0) return 'High';
  if (diff === 1) return 'Medium';
  return 'Low';
};

const scoreBudgetCompatibility = (compatibility: Match['matchDetails']['budgetCompatibility']) => {
  if (compatibility === 'High') return 1;
  if (compatibility === 'Medium') return 0.6;
  return 0.2;
};

const scoreInterestSimilarity = (currentUser: User, candidate: User) => {
  const source = new Set(currentUser.profile.interests.map((v) => normalize(v)));
  const target = new Set(candidate.profile.interests.map((v) => normalize(v)));

  const common = [...target].filter((item) => source.has(item));
  const unionSize = new Set([...source, ...target]).size;
  const jaccard = unionSize === 0 ? 0 : common.length / unionSize;

  return {
    score: jaccard,
    commonInterests: common.map((item) => item.charAt(0).toUpperCase() + item.slice(1)),
  };
};

const scoreVerification = (status: User['verificationStatus']) => {
  if (status === 'Verified') return 1;
  if (status === 'Pending') return 0.5;
  return 0;
};

const scoreStyle = (currentUser: User, candidate: User) =>
  currentUser.profile.travelStyle === candidate.profile.travelStyle ? 1 : 0.4;

const scoreLocation = (currentUser: User, candidate: User) =>
  normalize(currentUser.currentCity) === normalize(candidate.currentCity) ? 1 : 0.5;

const getPersonalityCompatibility = (
  currentUser: User,
  candidate: User,
): Match['matchDetails']['personalityCompatibility'] => {
  const current = currentUser.profile.personality;
  const other = candidate.profile.personality;

  if (!current || !other) return 'Medium';
  if (current === other) return 'High';
  return 'Low';
};

const getLanguageMatch = (currentUser: User, candidate: User): boolean => {
  const current = currentUser.profile.languagePreference;
  const other = candidate.profile.languagePreference;
  if (!current || !other) return false;
  return normalize(current) === normalize(other);
};

const getLocationProximity = (
  currentUser: User,
  candidate: User,
): Match['matchDetails']['locationProximity'] => {
  if (normalize(currentUser.currentCity) === normalize(candidate.currentCity)) {
    return 'Same City';
  }
  if (normalize(currentUser.homeCountry) === normalize(candidate.homeCountry)) {
    return 'Nearby';
  }
  return 'Different';
};

const getMatchStatus = (score: number): Match['matchStatus'] => {
  if (score >= 75) return 'Recommended';
  if (score >= 55) return 'Pending';
  return 'Rejected';
};

export const runMatchingPipeline = (
  currentUser: User,
  currentTrip: Trip,
  users: User[],
  userTrips: Trip[],
): MatchPipelineResult => {
  const currentDestination = normalize(currentTrip.destination);

  const candidates = users
    .filter((candidate) => candidate.userId !== currentUser.userId)
    .map((candidate) => ({
      candidate,
      trip: userTrips.find((trip) => trip.userId === candidate.userId),
    }))
    .filter((entry): entry is { candidate: User; trip: Trip } => Boolean(entry.trip));

  const filteredCandidates = candidates.filter(({ trip }) => {
    const destinationMatch = normalize(trip.destination) === currentDestination;
    const dateOverlap = hasDateOverlap(currentTrip.startDate, currentTrip.endDate, trip.startDate, trip.endDate);
    return destinationMatch && dateOverlap;
  });

  const matches = filteredCandidates
    .map(({ candidate, trip }) => {
      const { score: interestScore, commonInterests } = scoreInterestSimilarity(currentUser, candidate);
      const budgetCompatibility = getBudgetCompatibility(currentTrip.budget, trip.budget);
      const budgetScore = scoreBudgetCompatibility(budgetCompatibility);
      const styleScore = scoreStyle(currentUser, candidate);
      const verificationScore = scoreVerification(candidate.verificationStatus);
      const locationScore = scoreLocation(currentUser, candidate);
      const personalityCompatibility = getPersonalityCompatibility(currentUser, candidate);
      const languageMatch = getLanguageMatch(currentUser, candidate);
      const locationProximity = getLocationProximity(currentUser, candidate);

      const weighted =
        interestScore * WEIGHTS.interest +
        budgetScore * WEIGHTS.budget +
        styleScore * WEIGHTS.travelStyle +
        verificationScore * WEIGHTS.verification +
        locationScore * WEIGHTS.location +
        1 * WEIGHTS.dateOverlap;

      const finalScore = Math.round(weighted * 100);
      const matchStatus = getMatchStatus(finalScore);

      const interestSimilarity = Math.round(interestScore * 100);
      const budgetCompatibilityScore = Math.round(budgetScore * 100);
      const travelStyleMatch = Math.round(styleScore * 100);
      const personalityMatch =
        personalityCompatibility === 'High' ? 100 : personalityCompatibility === 'Medium' ? 60 : 30;
      const scheduleOverlap = 100;
      const locationProximityScore =
        locationProximity === 'Same City' ? 100 : locationProximity === 'Nearby' ? 60 : 20;
      const verificationBonus = Math.round(verificationScore * 100);

      const strengths: string[] = [];
      const concerns: string[] = [];

      if (interestSimilarity >= 70) strengths.push('Shared interests');
      if (budgetCompatibility === 'High') strengths.push('Budget aligned');
      if (locationProximity === 'Same City') strengths.push('Local match');
      if (!languageMatch) concerns.push('Different language preferences');
      if (budgetCompatibility === 'Low') concerns.push('Budget expectations differ');
      if (personalityCompatibility === 'Low') concerns.push('Different personality styles');

      const recommendations =
        concerns.length > 0
          ? ['Discuss expectations early', 'Plan a short intro call']
          : ['Plan a quick intro call'];

      return {
        matchId: `m-${currentTrip.tripId}-${candidate.userId}`,
        tripId: currentTrip.tripId,
        user: candidate,
        score: finalScore,
        matchStatus,
        compatibilityScore: {
          overall: finalScore,
          components: {
            interestSimilarity,
            budgetCompatibility: budgetCompatibilityScore,
            travelStyleMatch,
            personalityMatch,
            scheduleOverlap,
            locationProximity: locationProximityScore,
            verificationBonus,
          },
          strengths,
          concerns,
          recommendations,
        },
        matchDetails: {
          interestMatch: commonInterests,
          budgetCompatibility,
          dateOverlap: true,
          destinationMatch: true,
          styleMatch: currentUser.profile.travelStyle === candidate.profile.travelStyle,
          personalityCompatibility,
          languageMatch,
          locationProximity,
        },
        chatEnabled: matchStatus !== 'Rejected',
        createdAt: new Date().toISOString(),
      } satisfies Match;
    })
    .filter((match) => match.matchStatus !== 'Rejected')
    .sort((a, b) => b.score - a.score);

  const averageScore = matches.length
    ? Math.round(matches.reduce((sum, match) => sum + match.score, 0) / matches.length)
    : 0;

  return {
    matches,
    summary: {
      totalCandidates: candidates.length,
      eligibleAfterFiltering: filteredCandidates.length,
      recommended: matches.filter((match) => match.matchStatus === 'Recommended').length,
      matched: matches.filter((match) => match.matchStatus === 'Matched').length,
      averageScore,
      generatedAt: new Date().toISOString(),
      filters: {
        destination: currentTrip.destination,
        dateRange: { start: currentTrip.startDate, end: currentTrip.endDate },
        budget: currentTrip.budget,
        travelType: currentTrip.travelType,
      },
    },
  };
};
