import { Link } from 'react-router-dom';
import { MapPin, Compass, Globe } from 'lucide-react';
import { useEffect } from 'react';

export default function NotFoundPage() {
  useEffect(() => { document.title = '404 — TravelMatch'; }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-violet-50/30 px-4 travel-pattern">
      <div className="text-center space-y-5 bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-3xl shadow-xl p-10 sm:p-14 max-w-md relative overflow-hidden animate-slide-up">
        {/* Floating decorative icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <Compass className="absolute top-4 right-6 h-6 w-6 text-violet-300/30 animate-float" />
          <Globe className="absolute bottom-6 left-6 h-8 w-8 text-violet-300/20 animate-float-delayed" />
        </div>
        <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-2xl shadow-lg shadow-violet-500/25">
          <MapPin className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-7xl font-extrabold bg-gradient-to-r from-gray-900 via-gray-800 to-violet-700 bg-clip-text text-transparent">404</h1>
        <p className="text-xl font-medium text-gray-700">Oops — this page doesn't exist.</p>
        <p className="text-sm text-gray-500">Looks like you took a wrong turn on your journey!</p>
        <Link
          to="/find-companion"
          className="inline-block mt-4 px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-violet-500/25 hover:-translate-y-0.5 transition-all duration-200"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
