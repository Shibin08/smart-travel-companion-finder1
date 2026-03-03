import * as React from 'react';
import { devLog, devError } from './devLogger';

export class AppError extends Error {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userFriendly?: string;
  details?: unknown;

  constructor(
    message: string,
    code: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    userFriendly?: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.severity = severity;
    this.userFriendly = userFriendly;
    this.details = details;
  }
}

export interface ErrorReport {
  errorId: string;
  timestamp: string;
  error: AppError;
  userId?: string;
  context: {
    url: string;
    userAgent: string;
    component?: string;
    action?: string;
  };
  resolved: boolean;
  resolution?: string;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorReports: ErrorReport[] = [];
  private errorCallbacks: ((error: AppError) => void)[] = [];

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  handleError(error: Error | AppError, context?: Partial<ErrorReport['context']>): ErrorReport {
    const appError = error instanceof AppError ? error : this.convertToAppError(error);
    
    const errorReport: ErrorReport = {
      errorId: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      error: appError,
      userId: this.getCurrentUserId(),
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...context,
      },
      resolved: false,
    };

    this.errorReports.push(errorReport);
    this.logError(errorReport);
    this.notifyErrorCallbacks(appError);

    if (import.meta.env.PROD) {
      this.sendToErrorService(errorReport);
    }

    return errorReport;
  }

  handleAsyncError(error: Error, context?: Partial<ErrorReport['context']>): void {
    this.handleError(error, { ...context, action: 'async_operation' });
  }

  handleApiError(
    error: { message?: string; status?: number; response?: unknown },
    endpoint: string,
    method: string,
    context?: Partial<ErrorReport['context']>
  ): ErrorReport {
    const apiError = new AppError(
      error.message || 'API request failed',
      'API_ERROR',
      'high',
      'Failed to connect to the server. Please try again.',
      { endpoint, method, status: error.status, response: error.response }
    );

    return this.handleError(apiError, {
      ...context,
      component: 'api_client',
      action: `${method} ${endpoint}`,
    });
  }

  handleValidationErrors(
    errors: { message?: string; code?: string; field?: string; value?: unknown }[],
    context?: Partial<ErrorReport['context']>
  ): ErrorReport[] {
    const reports: ErrorReport[] = [];
    
    errors.forEach((error, index) => {
      const validationError = new AppError(
        error.message || 'Validation failed',
        error.code || 'VALIDATION_ERROR',
        'medium',
        error.message || 'Please check your input and try again.',
        { field: error.field, value: error.value }
      );

      const report = this.handleError(validationError, {
        ...context,
        component: 'validation',
        action: `validate_field_${index}`,
      });
      
      reports.push(report);
    });

    return reports;
  }

  onError(callback: (error: AppError) => void): void {
    this.errorCallbacks.push(callback);
  }

  removeErrorCallback(callback: (error: AppError) => void): void {
    const index = this.errorCallbacks.indexOf(callback);
    if (index > -1) {
      this.errorCallbacks.splice(index, 1);
    }
  }

  getErrorReports(limit?: number): ErrorReport[] {
    if (limit) {
      return this.errorReports.slice(-limit);
    }
    return [...this.errorReports];
  }

  getUnresolvedErrors(): ErrorReport[] {
    return this.errorReports.filter(report => !report.resolved);
  }

  resolveError(errorId: string, resolution?: string): boolean {
    const report = this.errorReports.find(r => r.errorId === errorId);
    if (report) {
      report.resolved = true;
      report.resolution = resolution;
      return true;
    }
    return false;
  }

  clearErrors(): void {
    this.errorReports = [];
  }

  getErrorStats(): {
    total: number;
    unresolved: number;
    bySeverity: Record<string, number>;
    byCode: Record<string, number>;
    recent: ErrorReport[];
  } {
    const total = this.errorReports.length;
    const unresolved = this.getUnresolvedErrors().length;
    
    const bySeverity: Record<string, number> = {};
    const byCode: Record<string, number> = {};
    
    this.errorReports.forEach(report => {
      bySeverity[report.error.severity] = (bySeverity[report.error.severity] || 0) + 1;
      byCode[report.error.code] = (byCode[report.error.code] || 0) + 1;
    });

    const recent = this.errorReports.slice(-10);

    return {
      total,
      unresolved,
      bySeverity,
      byCode,
      recent,
    };
  }

  private convertToAppError(error: Error): AppError {
    return new AppError(
      error.message,
      'UNKNOWN_ERROR',
      'medium',
      'An unexpected error occurred. Please try again.',
      { stack: error.stack }
    );
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentUserId(): string | undefined {
    try {
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.userId;
      }
    } catch (e) {
      // Ignore errors getting user ID
    }
    return undefined;
  }

  private logError(report: ErrorReport): void {
    const logLevel = this.getLogLevel(report.error.severity);
    const logMessage = `[${report.errorId}] ${report.error.code}: ${report.error.message}`;
    
    console[logLevel](logMessage, report);
  }

  private getLogLevel(severity: AppError['severity']): 'error' | 'warn' | 'info' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
      default:
        return 'info';
    }
  }

  private async sendToErrorService(report: ErrorReport): Promise<void> {
    try {
      devLog('Error report sent to service:', report);
    } catch (e) {
      devError('Failed to send error report:', e);
    }
  }

  private notifyErrorCallbacks(error: AppError): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (e) {
        devError('Error in error callback:', e);
      }
    });
  }
}

export const useErrorHandler = () => {
  const errorHandler = ErrorHandler.getInstance();

  const handleError = (error: Error | AppError, context?: Partial<ErrorReport['context']>) => {
    return errorHandler.handleError(error, context);
  };

  const handleAsyncError = (error: Error, context?: Partial<ErrorReport['context']>) => {
    errorHandler.handleAsyncError(error, context);
  };

  const handleApiError = (
    error: { message?: string; status?: number; response?: unknown },
    endpoint: string,
    method: string,
    context?: Partial<ErrorReport['context']>
  ) => {
    return errorHandler.handleApiError(error, endpoint, method, context);
  };

  const handleValidationErrors = (
    errors: { message?: string; code?: string; field?: string; value?: unknown }[],
    context?: Partial<ErrorReport['context']>
  ) => {
    return errorHandler.handleValidationErrors(errors, context);
  };

  const getErrorStats = () => {
    return errorHandler.getErrorStats();
  };

  const getUnresolvedErrors = () => {
    return errorHandler.getUnresolvedErrors();
  };

  const resolveError = (errorId: string, resolution?: string) => {
    return errorHandler.resolveError(errorId, resolution);
  };

  return {
    handleError,
    handleAsyncError,
    handleApiError,
    handleValidationErrors,
    getErrorStats,
    getUnresolvedErrors,
    resolveError,
  };
};

export const withErrorHandling = <P extends object>(
  Component: React.ComponentType<P>,
  errorHandler?: ErrorHandler
) => {
  const WrappedComponent = (props: P) => {
    const handler = errorHandler || ErrorHandler.getInstance();
    
    React.useEffect(() => {
      const handleUnhandledError = (event: ErrorEvent) => {
        handler.handleError(event.error || new Error(event.message), {
          component: 'global_error_boundary',
          action: 'unhandled_error',
        });
      };

      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        handler.handleError(
          new Error(event.reason),
          {
            component: 'global_error_boundary',
            action: 'unhandled_promise_rejection',
          }
        );
      };

      window.addEventListener('error', handleUnhandledError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      return () => {
        window.removeEventListener('error', handleUnhandledError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }, [handler]);

    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withErrorHandling(${Component.displayName || Component.name})`;
  return WrappedComponent;
};
