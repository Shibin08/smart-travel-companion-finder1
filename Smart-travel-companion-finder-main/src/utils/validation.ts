import type { User, Trip, TravelProfile, Review, EmergencyAlert } from '../types';

export class ValidationError extends Error {
  field?: string;
  code?: string;
  details?: unknown;

  constructor(
    message: string,
    field?: string,
    code?: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
    this.details = details;
  }
}

export class DataValidator {
  // User Validation
  static validateUser(user: Partial<User>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!user.name || user.name.trim().length < 2) {
      errors.push(new ValidationError('Name must be at least 2 characters long', 'name', 'INVALID_NAME'));
    }

    if (!user.email || !this.isValidEmail(user.email)) {
      errors.push(new ValidationError('Valid email is required', 'email', 'INVALID_EMAIL'));
    }

    if (!user.age || user.age < 18 || user.age > 100) {
      errors.push(new ValidationError('Age must be between 18 and 100', 'age', 'INVALID_AGE'));
    }

    if (!user.gender || !['Male', 'Female', 'Non-Binary', 'Other'].includes(user.gender)) {
      errors.push(new ValidationError('Valid gender is required', 'gender', 'INVALID_GENDER'));
    }

    if (!user.phone || !this.isValidPhone(user.phone)) {
      errors.push(new ValidationError('Valid phone number is required', 'phone', 'INVALID_PHONE'));
    }

    if (user.bio && user.bio.length > 500) {
      errors.push(new ValidationError('Bio must be less than 500 characters', 'bio', 'INVALID_BIO'));
    }

    if (user.profile) {
      const profileErrors = this.validateTravelProfile(user.profile);
      errors.push(...profileErrors.map(e => new ValidationError(e.message, `profile.${e.field}`, e.code)));
    }

    return errors;
  }

  // Travel Profile Validation
  static validateTravelProfile(profile: Partial<TravelProfile>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!profile.budget || !['Low', 'Medium', 'High'].includes(profile.budget)) {
      errors.push(new ValidationError('Valid budget range is required', 'budget', 'INVALID_BUDGET'));
    }

    if (!profile.travelStyle || !['Backpacker', 'Luxury', 'Adventure', 'Leisure'].includes(profile.travelStyle)) {
      errors.push(new ValidationError('Valid travel style is required', 'travelStyle', 'INVALID_TRAVEL_STYLE'));
    }

    if (!profile.interests || profile.interests.length === 0) {
      errors.push(new ValidationError('At least one interest is required', 'interests', 'NO_INTERESTS'));
    } else if (profile.interests.length > 10) {
      errors.push(new ValidationError('Maximum 10 interests allowed', 'interests', 'TOO_MANY_INTERESTS'));
    }

    if (profile.personality && !['Introvert', 'Extrovert', 'Ambivert'].includes(profile.personality)) {
      errors.push(new ValidationError('Valid personality type is required', 'personality', 'INVALID_PERSONALITY'));
    }

    if (profile.dietaryRestrictions && profile.dietaryRestrictions.length > 5) {
      errors.push(new ValidationError('Maximum 5 dietary restrictions allowed', 'dietaryRestrictions', 'TOO_MANY_DIETARY'));
    }

    if (profile.accommodationPreference && !['Hostel', 'Hotel', 'Airbnb', 'Guesthouse'].includes(profile.accommodationPreference)) {
      errors.push(new ValidationError('Valid accommodation preference is required', 'accommodationPreference', 'INVALID_ACCOMMODATION'));
    }

    if (profile.transportPreference && !['Public', 'Rental', 'Walking', 'Mixed'].includes(profile.transportPreference)) {
      errors.push(new ValidationError('Valid transport preference is required', 'transportPreference', 'INVALID_TRANSPORT'));
    }

    return errors;
  }

  // Trip Validation
  static validateTrip(trip: Partial<Trip>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!trip.destination || trip.destination.trim().length < 2) {
      errors.push(new ValidationError('Destination must be at least 2 characters long', 'destination', 'INVALID_DESTINATION'));
    }

    if (!trip.startDate || !this.isValidDate(trip.startDate)) {
      errors.push(new ValidationError('Valid start date is required', 'startDate', 'INVALID_START_DATE'));
    }

    if (!trip.endDate || !this.isValidDate(trip.endDate)) {
      errors.push(new ValidationError('Valid end date is required', 'endDate', 'INVALID_END_DATE'));
    }

    if (trip.startDate && trip.endDate && new Date(trip.startDate) >= new Date(trip.endDate)) {
      errors.push(new ValidationError('End date must be after start date', 'endDate', 'INVALID_DATE_RANGE'));
    }

    if (trip.startDate && trip.endDate) {
      const duration = this.calculateDaysBetween(trip.startDate, trip.endDate);
      if (duration < 1) {
        errors.push(new ValidationError('Trip duration must be at least 1 day', 'endDate', 'TRIP_TOO_SHORT'));
      }
    }

    if (trip.startDate && new Date(trip.startDate) < new Date()) {
      errors.push(new ValidationError('Start date cannot be in the past', 'startDate', 'PAST_START_DATE'));
    }

    if (!trip.travelType || !['Leisure', 'Adventure', 'Backpacker', 'Luxury'].includes(trip.travelType)) {
      errors.push(new ValidationError('Valid travel type is required', 'travelType', 'INVALID_TRAVEL_TYPE'));
    }

    if (!trip.budget || !['Low', 'Medium', 'High'].includes(trip.budget)) {
      errors.push(new ValidationError('Valid budget range is required', 'budget', 'INVALID_BUDGET'));
    }

    if (trip.description && trip.description.length > 1000) {
      errors.push(new ValidationError('Description must be less than 1000 characters', 'description', 'INVALID_DESCRIPTION'));
    }

    return errors;
  }

  // Review Validation
  static validateReview(review: Partial<Review>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!review.rating || review.rating < 1 || review.rating > 5) {
      errors.push(new ValidationError('Rating must be between 1 and 5', 'rating', 'INVALID_RATING'));
    }

    if (!review.comment || review.comment.trim().length < 10) {
      errors.push(new ValidationError('Comment must be at least 10 characters long', 'comment', 'COMMENT_TOO_SHORT'));
    }

    if (review.comment && review.comment.length > 1000) {
      errors.push(new ValidationError('Comment must be less than 1000 characters', 'comment', 'COMMENT_TOO_LONG'));
    }

    if (review.categories) {
      const { communication, reliability, compatibility, overall } = review.categories;
      
      if (communication < 1 || communication > 5) {
        errors.push(new ValidationError('Communication rating must be between 1 and 5', 'categories.communication', 'INVALID_COMMUNICATION_RATING'));
      }
      
      if (reliability < 1 || reliability > 5) {
        errors.push(new ValidationError('Reliability rating must be between 1 and 5', 'categories.reliability', 'INVALID_RELIABILITY_RATING'));
      }
      
      if (compatibility < 1 || compatibility > 5) {
        errors.push(new ValidationError('Compatibility rating must be between 1 and 5', 'categories.compatibility', 'INVALID_COMPATIBILITY_RATING'));
      }
      
      if (overall < 1 || overall > 5) {
        errors.push(new ValidationError('Overall rating must be between 1 and 5', 'categories.overall', 'INVALID_OVERALL_RATING'));
      }
    }

    return errors;
  }

  // Emergency Alert Validation
  static validateEmergencyAlert(alert: Partial<EmergencyAlert>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!alert.alertType || !['SOS', 'Medical', 'Lost', 'Theft', 'Other'].includes(alert.alertType)) {
      errors.push(new ValidationError('Valid alert type is required', 'alertType', 'INVALID_ALERT_TYPE'));
    }

    if (!alert.message || alert.message.trim().length < 5) {
      errors.push(new ValidationError('Message must be at least 5 characters long', 'message', 'MESSAGE_TOO_SHORT'));
    }

    if (alert.message && alert.message.length > 500) {
      errors.push(new ValidationError('Message must be less than 500 characters', 'message', 'MESSAGE_TOO_LONG'));
    }

    if (!alert.severity || !['Low', 'Medium', 'High', 'Critical'].includes(alert.severity)) {
      errors.push(new ValidationError('Valid severity level is required', 'severity', 'INVALID_SEVERITY'));
    }

    if (alert.location) {
      if (!alert.location.latitude || alert.location.latitude < -90 || alert.location.latitude > 90) {
        errors.push(new ValidationError('Valid latitude is required', 'location.latitude', 'INVALID_LATITUDE'));
      }
      
      if (!alert.location.longitude || alert.location.longitude < -180 || alert.location.longitude > 180) {
        errors.push(new ValidationError('Valid longitude is required', 'location.longitude', 'INVALID_LONGITUDE'));
      }
      
      if (!alert.location.address || alert.location.address.trim().length < 5) {
        errors.push(new ValidationError('Valid address is required', 'location.address', 'INVALID_ADDRESS'));
      }
    }

    return errors;
  }

  // Helper Methods
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private static isValidPhone(phone: string): boolean {
    const phoneRegex = /^[+]?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  private static isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  private static calculateDaysBetween(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  // Sanitization Methods
  static sanitizeString(input: string, maxLength?: number): string {
    if (!input) return '';
    
    let sanitized = input.trim();
    
    // Remove potentially harmful characters
    sanitized = sanitized.replace(/[<>]/g, '');
    
    // Apply length limit if specified
    if (maxLength && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    return sanitized;
  }

  static sanitizeEmail(email: string): string {
    return this.sanitizeString(email.toLowerCase(), 254);
  }

  static sanitizePhone(phone: string): string {
    // Remove all non-digit characters except +
    return phone.replace(/[^\d+]/g, '');
  }

  static sanitizeBio(bio: string): string {
    return this.sanitizeString(bio, 500);
  }

  static sanitizeComment(comment: string): string {
    return this.sanitizeString(comment, 1000);
  }
}

// React Hook for Validation
export const useValidation = () => {
  const validateUser = (user: Partial<User>) => {
    return DataValidator.validateUser(user);
  };

  const validateTrip = (trip: Partial<Trip>) => {
    return DataValidator.validateTrip(trip);
  };

  const validateReview = (review: Partial<Review>) => {
    return DataValidator.validateReview(review);
  };

  const validateEmergencyAlert = (alert: Partial<EmergencyAlert>) => {
    return DataValidator.validateEmergencyAlert(alert);
  };

  const sanitize = {
    string: DataValidator.sanitizeString,
    email: DataValidator.sanitizeEmail,
    phone: DataValidator.sanitizePhone,
    bio: DataValidator.sanitizeBio,
    comment: DataValidator.sanitizeComment,
  };

  return {
    validateUser,
    validateTrip,
    validateReview,
    validateEmergencyAlert,
    sanitize,
  };
};

