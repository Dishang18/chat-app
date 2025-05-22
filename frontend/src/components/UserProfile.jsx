import React, { useState, useEffect } from 'react';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'GUJ', name: 'Guajrati' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'zh', name: 'Chinese' },
  // Add more as needed
];

const UserProfile = ({ user, onClose, onUpdate, apiUrl }) => {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    name: user.name || '',
    bio: user.bio || '',
    profilepic: user.profilepic || '',
    email: user.email || '',
    phone: user.phone || '',
    preferredLanguage: user.preferredLanguage || '',
  });
  const [picFile, setPicFile] = useState(null);
  const [imgKey, setImgKey] = useState(Date.now()); // For cache busting

  // Sync form with user prop when modal opens or user changes
  useEffect(() => {
    setForm({
      name: user.name || '',
      bio: user.bio || '',
      profilepic: user.profilepic || '',
      email: user.email || '',
      phone: user.phone || '',
      preferredLanguage: user.preferredLanguage || '',
    });
    setImgKey(Date.now());
  }, [user]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePicChange = (e) => {
    setPicFile(e.target.files[0]);
  };

  const handleSave = async () => {
    let profilepic = form.profilepic;
    if (picFile) {
      const data = new FormData();
      data.append('file', picFile);
      const res = await fetch(`${apiUrl}/user/upload-profile-pic`, {
        method: 'POST',
        body: data,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      });
      if (!res.ok) {
        alert('Failed to upload profile picture');
        return;
      }
      const result = await res.json();
      profilepic = result.url;
    }

    const token = localStorage.getItem('token');
    const fetchOptions = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ ...form, profilepic }),
    };

    const response = await fetch(`${apiUrl}/user/update-profile`, fetchOptions);

    if (!response.ok) {
      alert('Failed to update profile');
      return;
    }

    // Update local state and parent
    setForm(prev => ({ ...prev, profilepic }));
    setImgKey(Date.now()); // Change key to force image reload
    onUpdate && onUpdate({ ...user, ...form, profilepic });
    setEditMode(false);
    setPicFile(null);
  };

  const handleCancel = () => {
    setEditMode(false);
    setForm({
      name: user.name || '',
      bio: user.bio || '',
      profilepic: user.profilepic || '',
      email: user.email || '',
      phone: user.phone || '',
      preferredLanguage: user.preferredLanguage || '',
    });
    setPicFile(null);
    setImgKey(Date.now());
  };

  // Always use form.profilepic (with cache busting) for the image
  const profileImgSrc =
    editMode && picFile
      ? URL.createObjectURL(picFile)
      : form.profilepic
        ? `${form.profilepic}?t=${imgKey}`
        : `https://ui-avatars.com/api/?name=${form.name || user.username || 'User'}&background=22d3ee&color=fff`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm animate-fade-in-fast">
      <div className="relative bg-gradient-to-br from-gray-900/90 via-gray-800/90 to-cyan-900/90 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-cyan-700 glassmorphism">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-cyan-400 text-2xl transition"
          onClick={onClose}
        >✕</button>
        <div className="flex flex-col items-center">
          <label className="relative mb-4 group flex flex-col items-center">
            <img
              src={profileImgSrc}
              alt="Profile"
              className="w-28 h-28 rounded-full border-4 border-cyan-400 object-cover mb-2 shadow-lg"
            />
            {editMode && (
              <>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="profile-pic-input"
                  onChange={handlePicChange}
                />
                <button
                  type="button"
                  className="absolute bottom-4 right-4 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full w-9 h-9 flex items-center justify-center shadow-lg border-2 border-white transition"
                  onClick={() => document.getElementById('profile-pic-input').click()}
                  title="Change profile picture"
                >
                  <span className="text-2xl leading-none">+</span>
                </button>
              </>
            )}
          </label>
          {editMode ? (
            <div className="w-full animate-fade-in">
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className="mb-3 px-4 py-2 rounded-lg bg-gray-800 text-gray-200 w-full border border-cyan-700 focus:ring-2 focus:ring-cyan-400 transition"
                placeholder="Name"
              />
              <input
                name="email"
                value={form.email}
                onChange={handleChange}
                className="mb-3 px-4 py-2 rounded-lg bg-gray-800 text-gray-400 w-full border border-gray-700"
                placeholder="Email"
                disabled
              />
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="mb-3 px-4 py-2 rounded-lg bg-gray-800 text-gray-200 w-full border border-cyan-700 focus:ring-2 focus:ring-cyan-400 transition"
                placeholder="Phone"
              />
              <select
                name="preferredLanguage"
                value={form.preferredLanguage}
                onChange={handleChange}
                className="mb-3 px-4 py-2 rounded-lg bg-gray-800 text-gray-200 w-full border border-cyan-700 focus:ring-2 focus:ring-cyan-400 transition"
              >
                <option value="">Select Language</option>
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
              <textarea
                name="bio"
                value={form.bio}
                onChange={handleChange}
                className="mb-3 px-4 py-2 rounded-lg bg-gray-800 text-gray-200 w-full border border-cyan-700 focus:ring-2 focus:ring-cyan-400 transition"
                placeholder="Bio"
                rows={3}
              />
              <div className="flex gap-3 mt-6">
                <button
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-lg font-semibold shadow hover:from-cyan-400 hover:to-blue-400 transition"
                  onClick={handleSave}
                >
                  Save
                </button>
                <button
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-gray-600 transition"
                  onClick={handleCancel}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full animate-fade-in">
              <h2 className="text-3xl font-bold text-white mb-1 text-center">{form.name}</h2>
              <div className="text-cyan-400 mb-2 text-center text-lg">@{user.username}</div>
              <div className="text-gray-300 mb-4 text-center">{form.bio}</div>
              <div className="mb-2 text-gray-400 flex items-center">
                <span className="font-semibold text-gray-300 w-36">Email:</span>
                <span className="ml-2">{form.email}</span>
              </div>
              <div className="mb-2 text-gray-400 flex items-center">
                <span className="font-semibold text-gray-300 w-36">Phone:</span>
                <span className="ml-2">{form.phone}</span>
              </div>
              <div className="mb-2 text-gray-400 flex items-center">
                <span className="font-semibold text-gray-300 w-36">Preferred Language:</span>
                <span className="ml-2">
                  {LANGUAGES.find(l => l.code === form.preferredLanguage)?.name || form.preferredLanguage}
                </span>
              </div>
              <button
                className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-lg font-semibold shadow hover:from-cyan-400 hover:to-blue-400 transition w-full mt-6"
                onClick={() => setEditMode(true)}
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .glassmorphism {
          background: rgba(30, 41, 59, 0.85);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .animate-fade-in-fast { animation: fadeIn 0.3s; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default UserProfile;