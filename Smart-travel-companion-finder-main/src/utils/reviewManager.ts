import type { Review } from '../types';

export class ReviewManager {
  private static instance: ReviewManager;
  private reviews: Review[] = [];
  private userReviews: Map<string, Review[]> = new Map();

  static getInstance(): ReviewManager {
    if (!ReviewManager.instance) {
      ReviewManager.instance = new ReviewManager();
    }
    return ReviewManager.instance;
  }

  async createReview(
    reviewerId: string,
    revieweeId: string,
    rating: number,
    comment: string,
    categories: Review['categories'],
    matchId?: string,
    tripId?: string,
    isPublic = true
  ): Promise<Review> {
    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Check if user already reviewed this person for this match/group
    const existingReview = this.reviews.find(review => 
      review.reviewerId === reviewerId &&
      review.revieweeId === revieweeId &&
      review.matchId === matchId
    );

    if (existingReview) {
      throw new Error('You have already reviewed this user for this match');
    }

    const review: Review = {
      reviewId: `review-${Date.now()}-${reviewerId}-${revieweeId}`,
      matchId,
      reviewerId,
      revieweeId,
      tripId,
      rating,
      comment,
      categories,
      isPublic,
      createdAt: new Date().toISOString(),
      helpfulVotes: 0,
    };

    this.reviews.push(review);

    // Update user reviews mapping
    const revieweeReviews = this.userReviews.get(revieweeId) || [];
    revieweeReviews.push(review);
    this.userReviews.set(revieweeId, revieweeReviews);

    return review;
  }

  async updateReview(
    reviewId: string,
    reviewerId: string,
    updates: Partial<Pick<Review, 'rating' | 'comment' | 'categories' | 'isPublic'>>
  ): Promise<Review | null> {
    const review = this.reviews.find(r => r.reviewId === reviewId);
    if (!review || review.reviewerId !== reviewerId) {
      return null;
    }

    Object.assign(review, updates);
    return review;
  }

  async deleteReview(reviewId: string, reviewerId: string): Promise<boolean> {
    const reviewIndex = this.reviews.findIndex(r => r.reviewId === reviewId);
    if (reviewIndex === -1) return false;

    const review = this.reviews[reviewIndex];
    if (review.reviewerId !== reviewerId) return false;

    // Remove from reviews array
    this.reviews.splice(reviewIndex, 1);

    // Remove from user reviews mapping
    const revieweeReviews = this.userReviews.get(review.revieweeId) || [];
    const userReviewIndex = revieweeReviews.findIndex(r => r.reviewId === reviewId);
    if (userReviewIndex !== -1) {
      revieweeReviews.splice(userReviewIndex, 1);
    }

    return true;
  }

  async voteHelpful(reviewId: string, userId: string): Promise<Review | null> {
    void userId;
    const review = this.reviews.find(r => r.reviewId === reviewId);
    if (!review) return null;

    // In production, you'd track who voted to prevent duplicate votes
    review.helpfulVotes += 1;

    return review;
  }

  getReviewById(reviewId: string): Review | null {
    return this.reviews.find(r => r.reviewId === reviewId) || null;
  }

  getUserReviews(
    userId: string,
    options: {
      asReviewer?: boolean;
      asReviewee?: boolean;
      publicOnly?: boolean;
      limit?: number;
    } = {}
  ): Review[] {
    let filteredReviews = this.reviews;

    if (options.asReviewer) {
      filteredReviews = filteredReviews.filter(r => r.reviewerId === userId);
    }

    if (options.asReviewee) {
      filteredReviews = filteredReviews.filter(r => r.revieweeId === userId);
    }

    if (options.publicOnly) {
      filteredReviews = filteredReviews.filter(r => r.isPublic);
    }

    // Sort by creation date (newest first)
    filteredReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (options.limit) {
      filteredReviews = filteredReviews.slice(0, options.limit);
    }

    return filteredReviews;
  }

  getMatchReviews(matchId: string): Review[] {
    return this.reviews
      .filter(r => r.matchId === matchId && r.isPublic)
      .sort((a, b) => b.helpfulVotes - a.helpfulVotes);
  }

  getUserAverageRating(userId: string): {
    overall: number;
    communication: number;
    reliability: number;
    compatibility: number;
    totalReviews: number;
  } {
    const userReviews = this.getUserReviews(userId, { asReviewee: true, publicOnly: true });
    
    if (userReviews.length === 0) {
      return {
        overall: 0,
        communication: 0,
        reliability: 0,
        compatibility: 0,
        totalReviews: 0,
      };
    }

    const totals = userReviews.reduce(
      (acc, review) => ({
        overall: acc.overall + review.rating,
        communication: acc.communication + review.categories.communication,
        reliability: acc.reliability + review.categories.reliability,
        compatibility: acc.compatibility + review.categories.compatibility,
      }),
      { overall: 0, communication: 0, reliability: 0, compatibility: 0 }
    );

    const count = userReviews.length;

    return {
      overall: Math.round((totals.overall / count) * 10) / 10,
      communication: Math.round((totals.communication / count) * 10) / 10,
      reliability: Math.round((totals.reliability / count) * 10) / 10,
      compatibility: Math.round((totals.compatibility / count) * 10) / 10,
      totalReviews: count,
    };
  }

  getRatingDistribution(userId: string): { [rating: number]: number } {
    const userReviews = this.getUserReviews(userId, { asReviewee: true, publicOnly: true });
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    userReviews.forEach(review => {
      distribution[review.rating as keyof typeof distribution] += 1;
    });

    return distribution;
  }

  canReview(
    reviewerId: string,
    revieweeId: string,
    matchId?: string
  ): boolean {
    if (reviewerId === revieweeId) return false;

    const existingReview = this.reviews.find(review => 
      review.reviewerId === reviewerId &&
      review.revieweeId === revieweeId &&
      review.matchId === matchId
    );

    return !existingReview;
  }

  getRecentReviews(limit = 10): Review[] {
    return this.reviews
      .filter(r => r.isPublic)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  searchReviews(query: string, limit = 20): Review[] {
    const normalizedQuery = query.toLowerCase();
    
    return this.reviews
      .filter(r => 
        r.isPublic && (
          r.comment.toLowerCase().includes(normalizedQuery) ||
          r.revieweeId.toLowerCase().includes(normalizedQuery)
        )
      )
      .sort((a, b) => b.helpfulVotes - a.helpfulVotes)
      .slice(0, limit);
  }

  getReviewStats(): {
    totalReviews: number;
    averageRating: number;
    reviewsByRating: { [rating: number]: number };
  } {
    const publicReviews = this.reviews.filter(r => r.isPublic);
    
    if (publicReviews.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        reviewsByRating: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const totalRating = publicReviews.reduce((sum, review) => sum + review.rating, 0);
    const reviewsByRating = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    publicReviews.forEach(review => {
      reviewsByRating[review.rating as keyof typeof reviewsByRating] += 1;
    });

    return {
      totalReviews: publicReviews.length,
      averageRating: Math.round((totalRating / publicReviews.length) * 10) / 10,
      reviewsByRating,
    };
  }

  generateReviewSummary(userId: string): {
    strengths: string[];
    improvements: string[];
    commonFeedback: string[];
  } {
    const userReviews = this.getUserReviews(userId, { asReviewee: true, publicOnly: true });
    
    if (userReviews.length === 0) {
      return {
        strengths: [],
        improvements: [],
        commonFeedback: [],
      };
    }

    const avgCategories = this.getUserAverageRating(userId);
    const strengths: string[] = [];
    const improvements: string[] = [];

    if (avgCategories.communication >= 4.0) strengths.push('Excellent communication');
    if (avgCategories.reliability >= 4.0) strengths.push('Very reliable');
    if (avgCategories.compatibility >= 4.0) strengths.push('Great travel compatibility');

    if (avgCategories.communication < 3.0) improvements.push('Communication could be improved');
    if (avgCategories.reliability < 3.0) improvements.push('More reliability needed');
    if (avgCategories.compatibility < 3.0) improvements.push('Better compatibility matching');

    // Extract common themes from comments
    const commonFeedback: string[] = [];
    const comments = userReviews.map(r => r.comment.toLowerCase());
    
    // Simple keyword analysis
    if (comments.some(c => c.includes('punctual') || c.includes('on time'))) {
      commonFeedback.push('Often praised for punctuality');
    }
    if (comments.some(c => c.includes('friendly') || c.includes('easy to talk'))) {
      commonFeedback.push('Noted for being friendly and approachable');
    }
    if (comments.some(c => c.includes('organized') || c.includes('planned'))) {
      commonFeedback.push('Recognized for good planning skills');
    }

    return { strengths, improvements, commonFeedback };
  }
}

// React hook for review functionality
export const useReview = () => {
  const reviewManager = ReviewManager.getInstance();

  const createReview = async (
    reviewerId: string,
    revieweeId: string,
    rating: number,
    comment: string,
    categories: Review['categories'],
    matchId?: string,
    tripId?: string,
    isPublic?: boolean
  ) => {
    return await reviewManager.createReview(
      reviewerId,
      revieweeId,
      rating,
      comment,
      categories,
      matchId,
      tripId,
      isPublic
    );
  };

  const updateReview = async (
    reviewId: string,
    reviewerId: string,
    updates: Partial<Pick<Review, 'rating' | 'comment' | 'categories' | 'isPublic'>>
  ) => {
    return await reviewManager.updateReview(reviewId, reviewerId, updates);
  };

  const deleteReview = async (reviewId: string, reviewerId: string) => {
    return await reviewManager.deleteReview(reviewId, reviewerId);
  };

  const voteHelpful = async (reviewId: string, userId: string) => {
    return await reviewManager.voteHelpful(reviewId, userId);
  };

  const getUserReviews = (userId: string, options?: Parameters<typeof reviewManager.getUserReviews>[1]) => {
    return reviewManager.getUserReviews(userId, options);
  };

  const getUserAverageRating = (userId: string) => {
    return reviewManager.getUserAverageRating(userId);
  };

  const canReview = (
    reviewerId: string,
    revieweeId: string,
    matchId?: string
  ) => {
    return reviewManager.canReview(reviewerId, revieweeId, matchId);
  };

  const getReviewSummary = (userId: string) => {
    return reviewManager.generateReviewSummary(userId);
  };

  return {
    createReview,
    updateReview,
    deleteReview,
    voteHelpful,
    getUserReviews,
    getUserAverageRating,
    canReview,
    getReviewSummary,
  };
};
