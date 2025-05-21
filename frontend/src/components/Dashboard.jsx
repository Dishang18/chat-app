import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';

// Dummy users for sidebar (replace with API data as needed)
const dummyUsers = [
  { id: 1, username: 'Alice', online: true },
  { id: 2, username: 'Bob', online: false },
  { id: 3, username: 'Charlie', online: true },
  { id: 4, username: 'Diana', online: false },
];

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState(dummyUsers);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
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
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-xl text-gray-300">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Hamburger for mobile */}
      <button
        className="absolute top-4 left-4 z-50 md:hidden bg-gray-900 p-2 rounded-full border border-gray-700"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
          <rect y="5" width="24" height="2" rx="1" fill="#fff"/>
          <rect y="11" width="24" height="2" rx="1" fill="#fff"/>
          <rect y="17" width="24" height="2" rx="1" fill="#fff"/>
        </svg>
      </button>
      {/* Sidebar */}
      <Sidebar
        users={users}
        user={user}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-2">
        <div className="bg-gray-900 rounded-xl shadow-lg p-8 sm:p-10 w-full max-w-xl border border-gray-800 flex flex-col items-center mt-16 md:mt-0">
          {/* Chat Illustration */}
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" className="mb-6">
            <rect width="24" height="24" rx="12" fill="#22d3ee" />
            <path d="M7 10h10M7 14h6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h1 className="text-3xl font-bold text-white mb-2 text-center">
            Hello, <span className="text-green-400">{user.username}</span> 👋
          </h1>
          <p className="text-gray-300 text-lg mb-4 text-center">
            Welcome to ChatApp!<br />
            Select a user from the sidebar to start chatting.
          </p>
          <div className="mt-6 text-gray-500 text-sm text-center">
            Your conversations will appear here.<br />
            Enjoy secure and fast messaging!
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;