import { useState, useEffect, useCallback } from 'react';

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
  stage?: string;
}

export const useLoading = (key?: string) => {
  const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: false });
  const [globalLoading, setGlobalLoading] = useState(false);

  useEffect(() => {
    if (key) {
      setLoadingState({ isLoading: true, message: 'Loading...' });
      setTimeout(() => {
        setLoadingState({ isLoading: false });
      }, 1000);
    } else {
      setGlobalLoading(false);
    }
  }, [key]);

  const startLoading = useCallback(() => {
    if (key) {
      setLoadingState({ isLoading: true, message: 'Loading...' });
    }
  }, [key]);

  const stopLoading = useCallback(() => {
    if (key) {
      setLoadingState({ isLoading: false });
    }
  }, [key]);

  return {
    isLoading: loadingState.isLoading,
    message: loadingState.message,
    progress: loadingState.progress,
    stage: loadingState.stage,
    globalLoading,
    startLoading,
    stopLoading,
  };
};
