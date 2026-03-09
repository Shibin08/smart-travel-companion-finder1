import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Phone,
  MapPin,
  Users,
  Clock,
  CheckCircle,
  Navigation,
  Shield,
  Bell,
} from 'lucide-react';
import type { EmergencyAlert } from '../types';
import {
  createEmergencyAlert,
  fetchActiveEmergencyAlerts,
  fetchMyEmergencyAlerts,
  type BackendEmergencyAlert,
} from '../utils/apiClient';
import { devError } from '../utils/devLogger';

interface EmergencySOSProps {
  userId: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
}

export default function EmergencySOS({ userId, currentLocation }: EmergencySOSProps) {
  const [activeAlerts, setActiveAlerts] = useState<EmergencyAlert[]>([]);
  const [userAlerts, setUserAlerts] = useState<EmergencyAlert[]>([]);
  const [isTriggering, setIsTriggering] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedAlertType, setSelectedAlertType] = useState<EmergencyAlert['alertType']>('SOS');
  const [customMessage, setCustomMessage] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [browserLocation, setBrowserLocation] = useState<{ latitude: number; longitude: number; address: string } | null>(null);

  const TOKEN_STORAGE_KEY = 'tcf_token';

  // Request browser geolocation on mount
  useEffect(() => {
    if (!currentLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setBrowserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            address: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
          });
        },
        () => { /* permission denied or unavailable — keep null */ },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  }, [currentLocation]);

  const mapBackendAlert = (alert: BackendEmergencyAlert): EmergencyAlert => ({
    alertId: String(alert.alert_id),
    userId: alert.user_id,
    location: {
      latitude: alert.location.latitude,
      longitude: alert.location.longitude,
      address: alert.location.address,
    },
    alertType: alert.alert_type as EmergencyAlert['alertType'],
    message: alert.message,
    severity: alert.severity as EmergencyAlert['severity'],
    status: alert.status as EmergencyAlert['status'],
    createdAt: alert.created_at,
    resolvedAt: alert.resolved_at,
    responders: alert.responders,
  });

  const getInstructions = (type: EmergencyAlert['alertType']) => {
    switch (type) {
      case 'Medical':
        return [
          'Stay calm and keep breathing steadily.',
          'Share known medical conditions in the message.',
          'Move to a visible/safe place if possible.',
        ];
      case 'Lost':
        return [
          'Stay in a crowded or safe public area.',
          'Share landmarks around you.',
          'Keep your phone charged and accessible.',
        ];
      case 'Theft':
        return [
          'Move to a safe location first.',
          'Document what was stolen clearly.',
          'Contact local police if required.',
        ];
      default:
        return [
          'Stay calm and prioritize immediate safety.',
          'Share precise location and situation details.',
          'Keep your phone line available for responders.',
        ];
    }
  };

  const loadAlerts = async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      return;
    }

    try {
      const [active, mine] = await Promise.all([
        fetchActiveEmergencyAlerts(token),
        fetchMyEmergencyAlerts(token),
      ]);

      setActiveAlerts(active.alerts.map(mapBackendAlert));
      setUserAlerts(mine.alerts.map(mapBackendAlert));
    } catch {
      // keep current view when backend is unavailable
    }
  };

  useEffect(() => {
    void loadAlerts();
    
    const interval = setInterval(() => {
      void loadAlerts();
    }, 5000);

    return () => clearInterval(interval);
  }, [userId]);

  const handleTriggerEmergency = async () => {
    if (!userId) return;
    
    setIsTriggering(true);
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        throw new Error('Login token missing');
      }

      await createEmergencyAlert(token, {
        alert_type: selectedAlertType,
        message: customMessage.trim() || `${selectedAlertType} emergency reported by ${userId}`,
        severity: selectedAlertType === 'SOS' ? 'Critical' : selectedAlertType === 'Medical' ? 'High' : 'Medium',
        location: currentLocation ?? browserLocation ?? {
          latitude: 0,
          longitude: 0,
          address: 'Location unavailable',
        },
      });

      await loadAlerts();
      setShowConfirmDialog(false);
      setCustomMessage('');
      setSelectedAlertType('SOS');
    } catch (error) {
      devError('Failed to trigger emergency:', error);
    } finally {
      setIsTriggering(false);
    }
  };

  const getAlertIcon = (alertType: EmergencyAlert['alertType']) => {
    switch (alertType) {
      case 'SOS':
        return <AlertTriangle className="h-5 w-5" />;
      case 'Medical':
        return <Phone className="h-5 w-5" />;
      case 'Lost':
        return <MapPin className="h-5 w-5" />;
      case 'Theft':
        return <Shield className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getSeverityColor = (severity: EmergencyAlert['severity']) => {
    switch (severity) {
      case 'Critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'High':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusIcon = (status: EmergencyAlert['status']) => {
    switch (status) {
      case 'Active':
        return <Bell className="h-4 w-4 text-red-600 animate-pulse" />;
      case 'Acknowledged':
        return <Clock className="h-4 w-4 text-orange-600" />;
      case 'Resolved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
  };

  const instructions = getInstructions(selectedAlertType);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Emergency SOS Button */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-6 shadow-sm card-hover-glow">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <div className="p-1.5 bg-red-100 rounded-lg mr-2">
                <Shield className="h-5 w-5 text-red-600" />
              </div>
              Emergency SOS
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Get immediate help in emergency situations
            </p>
          </div>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-sm text-cyan-600 hover:text-cyan-700"
          >
            {showInstructions ? 'Hide' : 'Show'} Instructions
          </button>
        </div>

        {showInstructions && (
          <div className="mb-4 p-4 bg-blue-50/80 rounded-xl border border-blue-200/60">
            <h3 className="font-semibold text-blue-900 mb-2">Emergency Instructions:</h3>
            <ul className="space-y-1 text-sm text-blue-800">
              {instructions.map((instruction, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(['SOS', 'Medical', 'Lost', 'Theft', 'Other'] as EmergencyAlert['alertType'][]).map((type) => (
            <button
              key={type}
              onClick={() => {
                setSelectedAlertType(type);
                setShowConfirmDialog(true);
              }}
              className={`p-4 rounded-xl border-2 transition-all duration-200 hover:-translate-y-0.5 ${
                type === 'SOS'
                  ? 'border-red-300 bg-red-50/80 hover:bg-red-100 hover:shadow-md hover:shadow-red-200/40'
                  : 'border-gray-200/60 bg-white hover:bg-gray-50 hover:shadow-md hover:shadow-gray-200/40'
              }`}
            >
              <div className="flex flex-col items-center space-y-2">
                <div className={`p-2.5 rounded-xl ${
                  type === 'SOS' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {getAlertIcon(type)}
                </div>
                <span className="text-sm font-medium">{type}</span>
              </div>
            </button>
          ))}
        </div>

        {currentLocation && (
          <div className="mt-4 p-3 bg-gray-50/80 rounded-xl">
            <div className="flex items-center text-sm text-gray-600">
              <Navigation className="h-4 w-4 mr-2" />
              Current: {currentLocation.address}
            </div>
          </div>
        )}
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-6 shadow-sm card-hover-glow animate-slide-up-delay">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Bell className="h-5 w-5 text-red-600 mr-2 animate-pulse" />
            Active Emergency Alerts ({activeAlerts.length})
          </h3>
          
          <div className="space-y-3">
            {activeAlerts.map((alert) => (
              <div
                key={alert.alertId}
                className={`p-4 rounded-xl border ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {getAlertIcon(alert.alertType)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold">{alert.alertType}</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-white/50">
                          {alert.severity}
                        </span>
                        {getStatusIcon(alert.status)}
                      </div>
                      <p className="text-sm mt-1">{alert.message}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs">
                        <span className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {alert.location.address}
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {new Date(alert.createdAt).toLocaleTimeString()}
                        </span>
                        {alert.responders.length > 0 && (
                          <span className="flex items-center">
                            <Users className="h-3 w-3 mr-1" />
                            {alert.responders.length} responders
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Alert History */}
      {userAlerts.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-6 shadow-sm card-hover-glow animate-slide-up-delay-2">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Your Emergency History</h3>
          
          <div className="space-y-3">
            {userAlerts.slice(0, 5).map((alert) => (
              <div key={alert.alertId} className="p-3.5 bg-gray-50/80 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getAlertIcon(alert.alertType)}
                    <div>
                      <span className="font-medium text-sm">{alert.alertType}</span>
                      <p className="text-xs text-gray-500">
                        {new Date(alert.createdAt).toLocaleDateString()} at {new Date(alert.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(alert.severity)}`}>
                      {alert.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-100">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-red-100 rounded-xl mr-3">
                {getAlertIcon(selectedAlertType)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Trigger {selectedAlertType} Alert?
                </h3>
                <p className="text-sm text-gray-500">
                  This will notify emergency services and your contacts
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Message (Optional)
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Provide more details about your emergency..."
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                rows={3}
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerEmergency}
                disabled={isTriggering}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-all ${
                  selectedAlertType === 'SOS'
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-500/25 hover:shadow-red-500/40'
                    : 'bg-gradient-to-r from-orange-600 to-amber-600 shadow-orange-500/25 hover:shadow-orange-500/40'
                } disabled:opacity-50`}
              >
                {isTriggering ? 'Triggering...' : `Trigger ${selectedAlertType}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
