import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React, { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';

// ── Error Boundary ────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
          <h1 className="text-2xl font-bold text-gray-800">Something went wrong</h1>
          <p className="text-gray-500 mt-2">An unexpected error occurred.</p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.href = '/';
            }}
            className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700"
          >
            Return Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy-loaded page components for bundle splitting
const LoginPage = lazy(() => import('./pages/LoginPage'));
const FindCompanionPage = lazy(() => import('./pages/FindCompanionPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const MatchDetailsPage = lazy(() => import('./pages/MatchDetailsPage'));
const EmergencyPage = lazy(() => import('./pages/EmergencyPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ConversationsPage = lazy(() => import('./pages/ConversationsPage'));
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'));
const MatchesPage = lazy(() => import('./pages/MatchesPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Suspense fallback spinner
const PageLoader = () => (
  <div className="flex items-center justify-center py-24">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
  </div>
);

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Redirect logged-in users away from login page
const LoginRedirect = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/find-companion" replace />;
  }
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginRedirect><LoginPage /></LoginRedirect>} />

            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Navigate to="/find-companion" replace />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/find-companion" element={
              <ProtectedRoute>
                <Layout>
                  <FindCompanionPage />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/profile" element={
              <ProtectedRoute>
                <Layout>
                  <ProfilePage />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/match/:id" element={
              <ProtectedRoute>
                <Layout>
                  <MatchDetailsPage />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/emergency" element={
              <ProtectedRoute>
                <Layout>
                  <EmergencyPage />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/chat/:chatId" element={
              <ProtectedRoute>
                <Layout>
                  <ChatPage />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/chat" element={
              <ProtectedRoute>
                <Layout>
                  <ConversationsPage />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/reviews" element={
              <ProtectedRoute>
                <Layout>
                  <ReviewsPage />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/matches" element={
              <ProtectedRoute>
                <Layout>
                  <MatchesPage />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
