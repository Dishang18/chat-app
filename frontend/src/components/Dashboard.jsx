import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatScreen from './ChatScreen';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_BACKEND_URL;

  // Check screen size
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // On mobile, hide sidebar when chat is active
      if (mobile && selectedUser) {
        setSidebarOpen(false);
      } else if (!mobile) {
        // On desktop, always show sidebar  
        setSidebarOpen(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedUser]);

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
  
  useEffect(() => {
    fetch(`${apiUrl}/user`)
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  useEffect(() => {
  if (users.length === 0) return;
  const savedUserId = localStorage.getItem('selectedUser');
  if (savedUserId) {
    const found = users.find(u => (u._id || u.id) === savedUserId);
    if (found) setSelectedUser(found);
  }
}, [users]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedUser');
    navigate('/login');
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    // On mobile, hide sidebar when selecting a user
    if (isMobile) {
      setSidebarOpen(false);
    }
    localStorage.setItem('selectedUser', user._id || user.id);
  };

  // Handle back action from ChatScreen
  const handleBack = () => {
    setSelectedUser(null);
    // Show sidebar when going back to user list
    setSidebarOpen(true);
    localStorage.removeItem('selectedUser');
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
      {/* Sidebar - Conditionally shown on mobile */}
      <div className={`${sidebarOpen ? 'block' : 'hidden'} ${isMobile ? 'absolute inset-0 z-10 w-full' : 'w-80'} md:block md:relative`}>
        <Sidebar
          users={users}
          user={user}
          setUser={setUser}
          onLogout={handleLogout}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onUserClick={handleUserSelect}
          selectedUser={selectedUser}
        />
      </div>

      {/* Main Content - Full screen on mobile when chat is active */}
      <main className={`flex-1 flex flex-col items-center justify-center px-2 h-screen ${isMobile && sidebarOpen ? 'hidden' : 'flex'}`}>
        {selectedUser ? (
          <ChatScreen
            currentUser={user}
            selectedUser={selectedUser}
            onBack={handleBack}
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
            
            {/* Mobile: Show sidebar button */}
            {isMobile && !sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="mt-6 px-6 py-2 bg-gradient-to-r from-cyan-500 to-cyan-700 text-white rounded-full font-medium hover:from-cyan-400 hover:to-cyan-600 transition-all duration-200"
              >
                Show Contacts
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;