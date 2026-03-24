import { useMemo, useState, useEffect } from 'react';
import { Globe, MapPin, Save, User as UserIcon, Upload, Trash2, Loader2, Lock, Plane, Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uploadProfilePhoto, changePassword } from '../utils/apiClient';
import type { TravelProfile, User } from '../types';

import { resolvePhoto } from '../utils/photoUtils';
import { devLog, devWarn, devError } from '../utils/devLogger';

const INTEREST_OPTIONS = [
  'Adventure',
  'Food',
  'Culture',
  'Nature',
  'History',
  'Photography',
  'Nightlife',
  'Relaxation',
  'Shopping',
  'Hiking',
  'Art',
  'Music',
];

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();

  useEffect(() => { document.title = 'My Profile - TravelMatch'; }, []);
  const [activeTab, setActiveTab] = useState<'basic' | 'travel' | 'interests'>('basic');
  const [savedMessage, setSavedMessage] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(resolvePhoto(user?.photoUrl));
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState('');
  const [imageLoadError, setImageLoadError] = useState(false);

  const [formData, setFormData] = useState<Partial<User>>({
    name: user?.name,
    age: user?.age,
    bio: user?.bio,
    gender: user?.gender,
    homeCountry: user?.homeCountry,
    currentCity: user?.currentCity,
    profile: {
      ...(user?.profile as TravelProfile),
    },
  });

  const selectedInterests = formData.profile?.interests ?? [];
  const formatMatchingDate = (value?: string) => {
    if (!value) return 'Not set';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const matchingDestination = user?.destination?.trim() ? user.destination : 'Not set';
  const matchingDateRange = `${formatMatchingDate(user?.matchingStartDate)} - ${formatMatchingDate(user?.matchingEndDate)}`;

  const completion = useMemo(() => {
    const points = [
      Boolean(formData.name),
      Boolean(formData.age),
      Boolean(formData.currentCity),
      Boolean(formData.homeCountry),
      Boolean(formData.profile?.budget),
      Boolean(formData.profile?.travelStyle),
      selectedInterests.length >= 3,
      Boolean(formData.bio && formData.bio.length >= 20),
    ].filter(Boolean).length;

    return Math.round((points / 8) * 100);
  }, [formData, selectedInterests.length]);

  if (!user) return <div className="text-center py-20">Please login to edit profile.</div>;

  const handleBasicChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'age') {
      const nextAge = value.trim() === '' ? undefined : Number(value);
      setFormData((prev) => ({ ...prev, age: nextAge }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileChange = <K extends keyof TravelProfile>(field: K, value: TravelProfile[K]) => {
    setFormData((prev) => ({
      ...prev,
      profile: {
        ...(prev.profile as TravelProfile),
        [field]: value,
      },
    }));
  };

  const toggleInterest = (interest: string) => {
    const nextInterests = selectedInterests.includes(interest)
      ? selectedInterests.filter((item) => item !== interest)
      : [...selectedInterests, interest];

    handleProfileChange('interests', nextInterests);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setPhotoUploadError('');

    try {
      const token = localStorage.getItem('tcf_token');
      if (!token) {
        throw new Error('Not authenticated - please log in again');
      }

      devLog('[handlePhotoUpload] Starting upload for token:', token.substring(0, 20) + '...');
      
      const response = await uploadProfilePhoto(token, file);
      devLog('[handlePhotoUpload] Upload successful:', response);
      
      const resolved = resolvePhoto(response.photo_url) || response.photo_url;
      setPhotoUrl(resolved);
      setImageLoadError(false);
      setSavedMessage('Photo uploaded successfully');
      window.setTimeout(() => setSavedMessage(''), 2500);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to upload photo';
      setPhotoUploadError(errorMsg);
      devError('[handlePhotoUpload] Error:', errorMsg, error);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const toDateInputValue = (value?: string) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().split('T')[0];
  };
  const [isEditingMatchingTrip, setIsEditingMatchingTrip] = useState(false);
  const [matchingTripDraft, setMatchingTripDraft] = useState({
    destination: user?.destination ?? '',
    startDate: toDateInputValue(user?.matchingStartDate),
    endDate: toDateInputValue(user?.matchingEndDate),
  });

  useEffect(() => {
    setMatchingTripDraft({
      destination: user?.destination ?? '',
      startDate: toDateInputValue(user?.matchingStartDate),
      endDate: toDateInputValue(user?.matchingEndDate),
    });
  }, [user?.destination, user?.matchingStartDate, user?.matchingEndDate]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await updateProfile({ ...formData, photoUrl });
      if (success) {
        setSavedMessage('Profile updated successfully');
      } else {
        setSavedMessage('Failed to save profile — please try again');
      }
      window.setTimeout(() => setSavedMessage(''), 2500);
    } catch {
      setSavedMessage('Failed to save profile — please try again');
      window.setTimeout(() => setSavedMessage(''), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMsg(null);
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordMsg({ type: 'error', text: 'Password needs uppercase, lowercase, and a number.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    const token = localStorage.getItem('tcf_token');
    if (!token) return;
    setIsChangingPassword(true);
    try {
      await changePassword(token, currentPassword, newPassword);
      setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to change password' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveMatchingTrip = async () => {
    const destination = matchingTripDraft.destination.trim();
    const startDate = matchingTripDraft.startDate;
    const endDate = matchingTripDraft.endDate;

    if (!destination) {
      setSavedMessage('Destination is required for current matching trip.');
      window.setTimeout(() => setSavedMessage(''), 2500);
      return;
    }
    if (!startDate || !endDate) {
      setSavedMessage('Start and end dates are required for current matching trip.');
      window.setTimeout(() => setSavedMessage(''), 2500);
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setSavedMessage('Start date cannot be after end date.');
      window.setTimeout(() => setSavedMessage(''), 2500);
      return;
    }

    const success = await updateProfile({
      destination,
      matchingStartDate: startDate,
      matchingEndDate: endDate,
    });

    if (success) {
      setIsEditingMatchingTrip(false);
      setSavedMessage('Current matching trip updated.');
    } else {
      setSavedMessage('Could not update matching trip. Please try again.');
    }
    window.setTimeout(() => setSavedMessage(''), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/40 overflow-hidden animate-slide-up">
      <div className="relative bg-gradient-to-r from-cyan-700 via-sky-700 to-teal-700 px-6 py-7 text-white overflow-hidden">
        {/* Floating decorative icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <Plane className="absolute top-3 right-[12%] h-6 w-6 text-white/10 animate-float rotate-[-15deg]" />
          <Compass className="absolute bottom-3 left-[15%] h-7 w-7 text-white/10 animate-float-delayed" />
          <Globe className="absolute top-5 left-[60%] h-5 w-5 text-white/10 animate-float-slow" />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <h1 className="text-xl font-bold inline-flex items-center">
            <div className="p-2 bg-white/15 rounded-xl mr-2.5 backdrop-blur-sm"><UserIcon className="h-5 w-5" /></div>
            Profile Setup
          </h1>
          <div className="text-right">
            <p className="text-xs text-cyan-100 font-medium">Profile completeness</p>
            <p className="text-2xl font-bold">{completion}%</p>
          </div>
        </div>
      </div>

      <div className="px-6 pt-5">
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan-500 via-sky-500 to-teal-400 transition-all duration-700 ease-out shadow-sm" style={{ width: `${completion}%` }} />
        </div>
      </div>

      <div className="border-b border-gray-200/60 mt-5 flex px-6">
        {[
          { id: 'basic', label: 'Basic Info' },
          { id: 'travel', label: 'Travel Preferences' },
          { id: 'interests', label: 'Interests' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'basic' | 'travel' | 'interests')}
            className={`flex-1 py-3.5 text-sm font-medium transition-all duration-200 ${activeTab === tab.id ? 'text-cyan-600 border-b-2 border-cyan-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-6">
        {activeTab === 'basic' && (
          <div className="space-y-4">
            {/* Photo Upload Section */}
            <div className="flex flex-col items-center gap-4 pb-4 border-b border-gray-200">
              <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-4 border-cyan-100 shadow-lg shadow-cyan-500/10">
                {photoUrl && !imageLoadError ? (
                  <img 
                    src={photoUrl} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                    onError={() => {
                      devWarn('[ProfilePage] Image failed to load:', photoUrl);
                      setImageLoadError(true);
                    }}
                    onLoad={() => {
                      devLog('[ProfilePage] Image loaded successfully:', photoUrl);
                      setImageLoadError(false);
                    }}
                  />
                ) : (
                  <img 
                    src="/default-avatar.svg" 
                    alt="Default Profile" 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex flex-col gap-2 items-center">
                <div className="flex gap-2">
                  <label htmlFor="photo-upload" className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-700 text-white rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 cursor-pointer text-sm font-semibold transition-all">
                    <Upload className="h-4 w-4" />
                    {isUploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                  </label>
                  {photoUrl && !imageLoadError && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoUrl('');
                        setImageLoadError(false);
                        setPhotoUploadError('');
                        setSavedMessage('Photo removed — click Save Profile to apply');
                        window.setTimeout(() => setSavedMessage(''), 3000);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 text-sm font-semibold border border-red-200 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  )}
                </div>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  disabled={isUploadingPhoto}
                  className="hidden"
                />
                <p className="text-xs text-gray-500">JPG, PNG, or WebP • Max 10MB</p>
                {photoUploadError && <p className="text-xs text-red-600">❌ {photoUploadError}</p>}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Display Name</label>
                <input name="name" value={formData.name ?? ''} onChange={handleBasicChange} className="mt-1 w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Age</label>
                <input
                  name="age"
                  type="number"
                  min={18}
                  value={typeof formData.age === 'number' && formData.age > 0 ? formData.age : ''}
                  onChange={handleBasicChange}
                  placeholder="Enter age"
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Gender</label>
                <select name="gender" value={formData.gender ?? 'Other'} onChange={handleBasicChange} className="mt-1 w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-Binary">Non-Binary</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Personality</label>
                <select
                  value={formData.profile?.personality ?? ''}
                  onChange={(e) =>
                    handleProfileChange(
                      'personality',
                      (e.target.value || undefined) as TravelProfile['personality'],
                    )
                  }
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                >
                  <option value="">Select personality</option>
                  <option value="Introvert">Introvert</option>
                  <option value="Extrovert">Extrovert</option>
                  <option value="Ambivert">Ambivert</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 inline-flex items-center"><Globe className="h-4 w-4 mr-1" /> Home Country</label>
                <input name="homeCountry" value={formData.homeCountry ?? ''} onChange={handleBasicChange} className="mt-1 w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 inline-flex items-center"><MapPin className="h-4 w-4 mr-1" /> Current City</label>
                <input name="currentCity" value={formData.currentCity ?? ''} onChange={handleBasicChange} className="mt-1 w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Bio</label>
              <textarea name="bio" rows={4} value={formData.bio ?? ''} onChange={handleBasicChange} className="mt-1 w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors" />
            </div>

            {/* Change Password Section (Basic Info only) */}
            <div className="pt-4 border-t border-gray-200">
              <div className="inline-flex items-center text-sm font-medium text-gray-700 mb-3">
                <Lock className="h-4 w-4 mr-1" /> Change Password
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                />
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                />
              </div>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !currentPassword || !newPassword}
                  className="px-5 py-2.5 text-sm font-semibold bg-gray-800 text-white rounded-xl hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isChangingPassword ? 'Changing...' : 'Update Password'}
                </button>
                {passwordMsg && (
                  <span className={`text-sm ${passwordMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {passwordMsg.text}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'travel' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-cyan-900">Current Trip for Matching</p>
                  <p className="text-xs text-cyan-700 mt-0.5">Edit manually here. Find Companions also auto-syncs this trip.</p>
                </div>
                {!isEditingMatchingTrip ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingMatchingTrip(true)}
                    className="shrink-0 rounded-lg border border-cyan-300 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition-colors"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingMatchingTrip(false);
                        setMatchingTripDraft({
                          destination: user?.destination ?? '',
                          startDate: toDateInputValue(user?.matchingStartDate),
                          endDate: toDateInputValue(user?.matchingEndDate),
                        });
                      }}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => { void handleSaveMatchingTrip(); }}
                      className="rounded-lg border border-cyan-600 bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
              {!isEditingMatchingTrip ? (
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-700/80">Destination</p>
                    <p className="text-sm font-semibold text-gray-900">{matchingDestination}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-700/80">Dates</p>
                    <p className="text-sm font-semibold text-gray-900">{matchingDateRange}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-700/80">Budget</p>
                    <p className="text-sm font-semibold text-gray-900">{user.profile.budget}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-700/80">Trip Type</p>
                    <p className="text-sm font-semibold text-gray-900">{user.profile.travelStyle}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-700/80">Destination</p>
                    <input
                      type="text"
                      value={matchingTripDraft.destination}
                      onChange={(e) => setMatchingTripDraft((prev) => ({ ...prev, destination: e.target.value }))}
                      className="mt-1 w-full border border-cyan-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-700/80">Start Date</p>
                    <input
                      type="date"
                      value={matchingTripDraft.startDate}
                      onChange={(e) => setMatchingTripDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                      className="mt-1 w-full border border-cyan-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-700/80">End Date</p>
                    <input
                      type="date"
                      min={matchingTripDraft.startDate || undefined}
                      value={matchingTripDraft.endDate}
                      onChange={(e) => setMatchingTripDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                      className="mt-1 w-full border border-cyan-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Budget Range</label>
              <div className="grid grid-cols-3 gap-3">
                {(['Low', 'Medium', 'High'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => handleProfileChange('budget', option)}
                    className={`rounded-xl px-4 py-2.5 text-sm border font-medium transition-all duration-200 ${formData.profile?.budget === option ? 'bg-cyan-50 border-cyan-400 text-cyan-700 shadow-sm' : 'border-gray-200 hover:border-cyan-300 hover:text-cyan-600'}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Travel Style</label>
              <div className="grid grid-cols-2 gap-3">
                {(['Backpacker', 'Leisure', 'Luxury', 'Adventure'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => handleProfileChange('travelStyle', option)}
                    className={`rounded-xl px-4 py-2.5 text-sm border font-medium transition-all duration-200 ${formData.profile?.travelStyle === option ? 'bg-cyan-50 border-cyan-400 text-cyan-700 shadow-sm' : 'border-gray-200 hover:border-cyan-300 hover:text-cyan-600'}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Language Preference</label>
              <input
                value={formData.profile?.languagePreference ?? ''}
                onChange={(e) => handleProfileChange('languagePreference', e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors"
                placeholder="English, Hindi, Spanish..."
              />
            </div>
          </div>
        )}

        {activeTab === 'interests' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Choose at least 3 interests for better matching</label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((interest) => {
                const selected = selectedInterests.includes(interest);
                return (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-3.5 py-2 rounded-full text-sm border font-medium transition-all duration-200 ${selected ? 'bg-cyan-50 text-cyan-700 border-cyan-300 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-cyan-300 hover:text-cyan-600'}`}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-green-600">{savedMessage}</span>
          <button onClick={handleSave} disabled={isSaving} className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 to-sky-700 hover:from-cyan-700 hover:to-sky-800 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}


