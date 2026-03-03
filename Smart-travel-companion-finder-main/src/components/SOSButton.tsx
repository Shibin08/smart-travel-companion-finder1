import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SOSButton() {
    const navigate = useNavigate();

    return (
        <button
            onClick={() => navigate('/emergency')}
            aria-label="Emergency SOS"
            className="fixed bottom-6 right-6 bg-red-600 text-white p-4 rounded-full shadow-lg hover:bg-red-700 hover:scale-105 transition-all z-50 flex items-center justify-center"
            title="Emergency SOS"
        >
            <AlertTriangle size={24} />
            <span className="ml-2 font-bold">SOS</span>
        </button>
    );
}
