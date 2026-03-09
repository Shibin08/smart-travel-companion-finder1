import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SOSButton() {
    const navigate = useNavigate();

    return (
        <button
            onClick={() => navigate('/emergency')}
            aria-label="Emergency SOS"
            className="fixed bottom-6 right-6 bg-gradient-to-r from-red-600 to-rose-600 text-white p-4 rounded-2xl shadow-lg shadow-red-500/30 hover:shadow-red-500/50 hover:scale-105 transition-all duration-200 z-50 flex items-center justify-center"
            title="Emergency SOS"
        >
            <AlertTriangle size={24} />
            <span className="ml-2 font-bold">SOS</span>
        </button>
    );
}
