import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Remove this import if you haven't set up the api service yet
// import api from '../services/api';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Load user data from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {user.username}!</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Logout
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="bg-gray-50 rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">Your Profile</h2>
              <div className="space-y-3">
                <div className="flex">
                  <span className="font-medium text-gray-600 w-40">Username:</span>
                  <span className="text-gray-900">{user.username}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-600 w-40">Email:</span>
                  <span className="text-gray-900">{user.email}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-600 w-40">Preferred Language:</span>
                  <span className="text-gray-900">{user.preferredLanguage}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;