import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Shield, AlertTriangle, Phone } from 'lucide-react';
import EmergencySOS from '../components/EmergencySOS';
import { useAuth } from '../context/AuthContext';

export default function EmergencyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { document.title = 'Emergency SOS — TravelMatch'; }, []);

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
          className="px-4 py-2 bg-violet-600 text-white rounded-md text-sm font-medium hover:bg-violet-700"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden bg-gradient-to-r from-red-600 via-rose-600 to-red-700 rounded-3xl p-6 sm:p-8 shadow-xl shadow-red-500/15 text-white animate-slide-up">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <Shield className="absolute top-4 right-[10%] h-8 w-8 text-white/10 animate-float" />
          <Phone className="absolute bottom-4 left-[12%] h-6 w-6 text-white/10 animate-float-delayed" />
          <AlertTriangle className="absolute top-5 left-[55%] h-5 w-5 text-white/10 animate-float-slow" />
        </div>
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3">
            <span className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm">
              <Shield className="h-6 w-6" />
            </span>
            Emergency Safety Center
          </h1>
          <p className="text-red-100 mt-2">
            Your safety is our priority. Access emergency assistance and safety features here.
          </p>
        </div>
      </div>
      
      <EmergencySOS userId={user.userId} />
    </div>
  );
}
