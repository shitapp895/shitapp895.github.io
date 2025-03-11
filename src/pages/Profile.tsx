import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { FaUser, FaEdit, FaCheck } from 'react-icons/fa';

import { useAuth } from '../contexts/AuthContext';
import { firestore } from '../firebase/config';

const Profile = () => {
  const { currentUser, userData } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(userData?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) return;

    try {
      setError('');
      setSuccess('');
      setLoading(true);

      // Update profile in Firebase Auth
      await updateProfile(currentUser, { displayName });

      // Update profile in Firestore
      await updateDoc(doc(firestore, 'users', currentUser.uid), {
        displayName,
      });

      setSuccess('Profile updated successfully!');
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Your Profile</h1>

          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="btn btn-secondary flex items-center space-x-1"
            >
              <FaEdit />
              <span>Edit Profile</span>
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
          <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white text-3xl">
            {userData?.displayName?.charAt(0).toUpperCase() || <FaUser />}
          </div>

          <div className="flex-1">
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium mb-1">
                    Display Name
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="input"
                    required
                  />
                </div>

                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="btn btn-primary flex items-center space-x-1"
                    disabled={loading}
                  >
                    <FaCheck />
                    <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setDisplayName(userData?.displayName || '');
                    }}
                    className="btn bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm text-gray-500 dark:text-gray-400">Display Name</h2>
                  <p className="text-lg font-medium">{userData?.displayName}</p>
                </div>

                <div>
                  <h2 className="text-sm text-gray-500 dark:text-gray-400">Email</h2>
                  <p className="text-lg font-medium">{userData?.email}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Shit Stats</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-100 dark:bg-slate-700 p-4 rounded-lg text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Total Shits</p>
            <p className="text-2xl font-bold">{userData?.totalShits || 0}</p>
          </div>

          <div className="bg-gray-100 dark:bg-slate-700 p-4 rounded-lg text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Average Duration</p>
            <p className="text-2xl font-bold">
              {userData?.averageShitDuration 
                ? `${Math.round(userData.averageShitDuration)}s`
                : '0s'}
            </p>
          </div>

          <div className="bg-gray-100 dark:bg-slate-700 p-4 rounded-lg text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Friends</p>
            <p className="text-2xl font-bold">{userData?.friends?.length || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
