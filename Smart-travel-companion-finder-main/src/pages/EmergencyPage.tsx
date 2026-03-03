import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import EmergencySOS from '../components/EmergencySOS';
import { useAuth } from '../context/AuthContext';

export default function EmergencyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { document.title = 'Emergency SOS — Travel Companion Finder'; }, []);

  if (!user) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="inline-flex items-center justify-center p-4 bg-red-100 rounded-full">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Authentication Required</h2>
        <p className="text-gray-500">You need to be logged in to access emergency features.</p>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-100 rounded-lg">
            <Shield className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Emergency Safety Center</h1>
        </div>
        <p className="text-gray-600">
          Your safety is our priority. Access emergency assistance and safety features here.
        </p>
      </div>
      
      <EmergencySOS userId={user.userId} />
    </div>
  );
}
