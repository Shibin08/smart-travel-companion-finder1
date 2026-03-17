import { differenceInCalendarDays, isAfter, isBefore, parseISO } from 'date-fns';
import type { Match, MatchSummary, Trip, User, CompatibilityScore, MatchingEngineResult } from '../types';

const ADVANCED_WEIGHTS = {
  interestSimilarity: 0.25,
  budgetCompatibility: 0.15,
  travelStyleMatch: 0.15,
  personalityMatch: 0.10,
  scheduleOverlap: 0.15,
  locationProximity: 0.10,
  verificationBonus: 0.05,
  experienceBonus: 0.05,
} as const;

const ALGORITHM_VERSION = '2.0.0';

export interface MatchPipelineResult {
  matches: Match[];
  summary: MatchSummary;
  processingTime: number;
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isBefore(start, today)) {
    errors.push('Start date cannot be in the past. Please select today or a future date.');
  }

  if (isBefore(end, today)) {
    errors.push('End date cannot be in the past. Please select today or a future date.');
  }

  if (isAfter(start, end)) {
    errors.push('Start date cannot be after end date.');
  }

  return errors;
};

const normalize = (value: string | undefined | null) => (value ?? '').trim().toLowerCase();

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

const calculateDateOverlapScore = (
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): number => {
  const aStart = parseISO(startA);
  const aEnd = parseISO(endA);
  const bStart = parseISO(startB);
  const bEnd = parseISO(endB);

  const overlapStart = isAfter(aStart, bStart) ? aStart : bStart;
  const overlapEnd = isBefore(aEnd, bEnd) ? aEnd : bEnd;

  if (isAfter(overlapStart, overlapEnd)) return 0;

  const aDuration = differenceInCalendarDays(aEnd, aStart) + 1;
  const bDuration = differenceInCalendarDays(bEnd, bStart) + 1;
  const overlapDuration = differenceInCalendarDays(overlapEnd, overlapStart) + 1;

  const avgDuration = (aDuration + bDuration) / 2;
  return overlapDuration / avgDuration;
};

const calculateBudgetCompatibility = (
  userBudget: Trip['budget'],
  candidateBudget: Trip['budget'],
): number => {
  const scale: Trip['budget'][] = ['Low', 'Medium', 'High'];
  const diff = Math.abs(scale.indexOf(userBudget) - scale.indexOf(candidateBudget));
  
  if (diff === 0) return 1.0;
  if (diff === 1) return 0.7;
  return 0.3;
};

const calculateInterestSimilarity = (currentUser: User, candidate: User): {
  score: number;
  commonInterests: string[];
  totalInterests: number;
} => {
  const source = new Set(currentUser.profile.interests.map((v) => normalize(v)));
  const target = new Set(candidate.profile.interests.map((v) => normalize(v)));

  const common = [...target].filter((item) => source.has(item));
  const unionSize = new Set([...source, ...target]).size;
  const jaccard = unionSize === 0 ? 0 : common.length / unionSize;

  return {
    score: jaccard,
    commonInterests: common.map((item) => item.charAt(0).toUpperCase() + item.slice(1)),
    totalInterests: unionSize,
  };
};

const calculatePersonalityCompatibility = (
  currentUser: User,
  candidate: User,
): number => {
  const current = currentUser.profile.personality;
  const candidatePersonality = candidate.profile.personality;

  if (!current || !candidatePersonality) return 0.5;

  const compatibilityMatrix: Record<string, Record<string, number>> = {
    'Extrovert': { 'Extrovert': 1.0, 'Ambivert': 0.8, 'Introvert': 0.4 },
    'Ambivert': { 'Extrovert': 0.8, 'Ambivert': 1.0, 'Introvert': 0.8 },
    'Introvert': { 'Extrovert': 0.4, 'Ambivert': 0.8, 'Introvert': 1.0 },
  };

  return compatibilityMatrix[current]?.[candidatePersonality] || 0.5;
};

const calculateLocationProximity = (currentUser: User, candidate: User): {
  score: number;
  proximity: 'Same City' | 'Nearby' | 'Different';
} => {
  const currentCity = normalize(currentUser.currentCity);
  const candidateCity = normalize(candidate.currentCity);

  if (currentCity === candidateCity) {
    return { score: 1.0, proximity: 'Same City' };
  }

  // Simple proximity check - could be enhanced with actual distance calculation
  const sameCountry = currentUser.homeCountry === candidate.homeCountry;
  if (sameCountry) {
    return { score: 0.7, proximity: 'Nearby' };
  }

  return { score: 0.3, proximity: 'Different' };
};

const calculateTravelStyleMatch = (currentUser: User, candidate: User): number => {
  return currentUser.profile.travelStyle === candidate.profile.travelStyle ? 1.0 : 0.5;
};

const calculateVerificationBonus = (status: User['verificationStatus']): number => {
  if (status === 'Verified') return 1.0;
  if (status === 'Pending') return 0.5;
  return 0.0;
};

const calculateExperienceBonus = (user: User): number => {
  const stats = user.stats || { tripsCompleted: 0, averageRating: 0 };
  const tripBonus = Math.min(stats.tripsCompleted / 10, 1) * 0.5;
  const ratingBonus = (stats.averageRating / 5) * 0.5;
  return tripBonus + ratingBonus;
};

const generateCompatibilityScore = (
  currentUser: User,
  candidate: User,
  currentTrip: Trip,
  candidateTrip: Trip,
): CompatibilityScore => {
  const { score: interestScore } = calculateInterestSimilarity(currentUser, candidate);
  const budgetScore = calculateBudgetCompatibility(currentTrip.budget, candidateTrip.budget);
  const personalityScore = calculatePersonalityCompatibility(currentUser, candidate);
  const { score: locationScore } = calculateLocationProximity(currentUser, candidate);
  const styleScore = calculateTravelStyleMatch(currentUser, candidate);
  const dateScore = calculateDateOverlapScore(currentTrip.startDate, currentTrip.endDate, candidateTrip.startDate, candidateTrip.endDate);
  const verificationScore = calculateVerificationBonus(candidate.verificationStatus);
  const experienceScore = calculateExperienceBonus(candidate);

  const components = {
    interestSimilarity: interestScore,
    budgetCompatibility: budgetScore,
    travelStyleMatch: styleScore,
    personalityMatch: personalityScore,
    scheduleOverlap: dateScore,
    locationProximity: locationScore,
    verificationBonus: verificationScore,
    experienceBonus: experienceScore,
  };

  const overall = Math.round(
    Object.entries(components).reduce((sum, [key, value]) => {
      return sum + value * ADVANCED_WEIGHTS[key as keyof typeof ADVANCED_WEIGHTS];
    }, 0) * 100
  );

  const strengths: string[] = [];
  const concerns: string[] = [];
  const recommendations: string[] = [];

  // Generate insights
  if (interestScore > 0.7) strengths.push('Strong interest alignment');
  if (budgetScore === 1.0) strengths.push('Perfect budget match');
  if (personalityScore > 0.8) strengths.push('Compatible personalities');
  if (locationScore === 1.0) strengths.push('Same location');
  if (dateScore > 0.8) strengths.push('Great schedule overlap');

  if (interestScore < 0.3) concerns.push('Limited shared interests');
  if (budgetScore < 0.5) concerns.push('Budget mismatch');
  if (dateScore < 0.3) concerns.push('Limited schedule overlap');

  if (personalityScore < 0.5) recommendations.push('Consider communication styles');
  if (locationScore < 0.5) recommendations.push('Plan meeting logistics');
  if (verificationScore < 1.0) recommendations.push('Verify profile authenticity');

  return {
    overall,
    components,
    strengths,
    concerns,
    recommendations,
  };
};

const getMatchStatus = (score: number): Match['matchStatus'] => {
  if (score >= 80) return 'Recommended';
  if (score >= 60) return 'Pending';
  return 'Rejected';
};

export const runAdvancedMatchingPipeline = (
  currentUser: User,
  currentTrip: Trip,
  users: User[],
  userTrips: Trip[],
): MatchingEngineResult => {
  const startTime = performance.now();
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
      const compatibilityScore = generateCompatibilityScore(currentUser, candidate, currentTrip, trip);
      const { commonInterests } = calculateInterestSimilarity(currentUser, candidate);
      const budgetCompatibility = calculateBudgetCompatibility(currentTrip.budget, trip.budget);
      const { proximity } = calculateLocationProximity(currentUser, candidate);

      return {
        matchId: `m-${currentTrip.tripId}-${candidate.userId}`,
        tripId: currentTrip.tripId,
        user: candidate,
        score: compatibilityScore.overall,
        matchStatus: getMatchStatus(compatibilityScore.overall),
        compatibilityScore,
        matchDetails: {
          interestMatch: commonInterests,
          budgetCompatibility: budgetCompatibility >= 0.8 ? 'High' : budgetCompatibility >= 0.5 ? 'Medium' : 'Low',
          dateOverlap: true,
          destinationMatch: true,
          styleMatch: currentUser.profile.travelStyle === candidate.profile.travelStyle,
          personalityCompatibility: compatibilityScore.components.personalityMatch >= 0.8 ? 'High' : 
                                  compatibilityScore.components.personalityMatch >= 0.5 ? 'Medium' : 'Low',
          languageMatch: currentUser.profile.languagePreference === candidate.profile.languagePreference,
          locationProximity: proximity,
        },
        chatEnabled: compatibilityScore.overall >= 40,
        createdAt: new Date().toISOString(),
      } satisfies Match;
    })
    .filter((match) => match.matchStatus !== 'Rejected')
    .sort((a, b) => b.score - a.score);

  const processingTime = performance.now() - startTime;

  const summary: MatchSummary = {
    totalCandidates: candidates.length,
    eligibleAfterFiltering: filteredCandidates.length,
    recommended: matches.filter(m => m.matchStatus === 'Recommended').length,
    matched: matches.filter(m => m.matchStatus === 'Matched').length,
    averageScore: Math.round(matches.reduce((sum, m) => sum + m.score, 0) / matches.length || 0),
    generatedAt: new Date().toISOString(),
    filters: {
      destination: currentTrip.destination,
      dateRange: { start: currentTrip.startDate, end: currentTrip.endDate },
      budget: currentTrip.budget,
      travelType: currentTrip.travelType,
    },
  };

  return {
    matches,
    summary,
    processingTime,
    algorithmVersion: ALGORITHM_VERSION,
  };
};
