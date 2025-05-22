import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatScreen from './ChatScreen';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_BACKEND_URL;

useEffect(() => {
  const token = localStorage.getItem('token');
  if (!token) {
    navigate('/login');
    return;
  }
  // Fetch the latest user data from backend
  fetch(`${apiUrl}/user/me`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => {
      if (!res.ok) throw new Error('Unauthorized');
      return res.json();
    })
    .then(userData => setUser(userData))
    .catch(() => {
      localStorage.removeItem('token');
      navigate('/login');
    });
}, [apiUrl, navigate]);

console.log("user", user);  

  useEffect(() => {
    fetch(`${apiUrl}/user`)
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-xl text-gray-300">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Sidebar */}
      <Sidebar
        users={users}
        user={user}
        setUser={setUser}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onUserClick={setSelectedUser}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-2 h-screen">
        {selectedUser ? (
          <ChatScreen
            currentUser={user}
            selectedUser={selectedUser}
            onBack={() => setSelectedUser(null)}
            apiUrl={apiUrl}
          />
        ) : (
          <div className="bg-gray-900 rounded-xl shadow-lg p-8 sm:p-10 w-full max-w-xl border border-gray-800 flex flex-col items-center mt-16 md:mt-0">
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
        )}
      </main>
    </div>
  );
};

export default Dashboard;