import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { useEffect } from 'react';

export default function NotFoundPage() {
  useEffect(() => { document.title = '404 — Travel Companion Finder'; }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50 px-4">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-4 bg-teal-100 rounded-full">
          <MapPin className="h-10 w-10 text-teal-600" />
        </div>
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="text-xl text-gray-600">Oops — this page doesn't exist.</p>
        <p className="text-sm text-gray-500">Looks like you took a wrong turn on your journey!</p>
        <Link
          to="/find-companion"
          className="inline-block mt-4 px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
