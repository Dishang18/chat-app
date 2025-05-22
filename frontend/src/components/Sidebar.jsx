import React, { useState } from 'react';
import UserProfile from './UserProfile';

const Sidebar = ({ users, user, onLogout, sidebarOpen, setSidebarOpen, onUserClick, setUser }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showProfile, setShowProfile] = useState(false);

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-40 z-30 md:hidden transition-opacity duration-200 ${sidebarOpen ? 'block' : 'hidden'}`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        className={`fixed z-40 top-0 left-0 h-screen w-72 bg-gray-950 border-r border-gray-800 flex flex-col justify-between transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:flex`}
        style={{ minWidth: '18rem' }}
      >
        <div>
          {/* Logo and App Name */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="12" fill="#22d3ee" />
              <path d="M7 10h10M7 14h6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="text-2xl font-bold text-white tracking-wide">ChatApp</span>
          </div>
          {/* Search Bar */}
          <div className="px-6 py-4 border-b border-gray-800">
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-800 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>
          {/* User List */}
          <ul className="flex-1 overflow-y-auto">
            {filteredUsers.length === 0 && (
              <li className="px-6 py-4 text-gray-500 text-center">No users found</li>
            )}
            {filteredUsers.map((u) => (
              <li
                key={u._id || u.id}
                className="flex items-center px-6 py-3 hover:bg-gray-800 cursor-pointer transition"
                onClick={() => {
                  if (onUserClick) onUserClick(u);
                  setSidebarOpen(false);
                }}
              >
                <span
                  className={`h-3 w-3 rounded-full mr-3 ${
                    u.online ? 'bg-green-400' : 'bg-gray-500'
                  }`}
                ></span>
                <span className="text-gray-200 font-medium">{u.username}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* Profile Avatar & Dropdown */}
        <div className="relative px-6 py-5 border-t border-gray-800 flex items-center justify-between">
          <div className="relative">
          {console.log('Sidebar user:', user)}
            <img
              src={user.profilepic || `https://ui-avatars.com/api/?name=${user.username}&background=22d3ee&color=fff`}
              alt="Profile"
              className="w-12 h-12 rounded-full border-2 border-cyan-400 cursor-pointer transition hover:ring-2 hover:ring-cyan-400"
              onClick={() => setDropdownOpen(open => !open)}
            />
            {dropdownOpen && (
              <div className="absolute left-1/2-translate-x-1/2 bottom-full mt-3 z-50 w-52 bg-gray-900 border border-gray-700 rounded-2xl shadow-lg flex flex-col items-center py-4">
                <img
                  src={user.profilepic || `https://ui-avatars.com/api/?name=${user.username}&background=22d3ee&color=fff`}
                  alt="Profile"
                  className="w-16 h-16 rounded-full border-2 border-cyan-400 mb-2"
                />
                <span className="text-gray-200 font-semibold mb-2">{user.username}</span>
                <button
                  className="w-36 px-4 py-2 rounded-full bg-cyan-600 text-white font-semibold shadow hover:bg-cyan-700 transition"
                  onClick={() => {
                    setDropdownOpen(false);
                    setShowProfile(true);
                  }}
                >
                Profile
                </button>/
                <button
                  className="w-36 px-4 py-2 rounded-full bg-gray-700 text-red-400 font-semibold shadow hover:bg-gray-600 transition"
                  onClick={onLogout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
      {/* User Profile Modal */}
      {showProfile && (
        <UserProfile
          user={user}
          onClose={() => setShowProfile(false)}
          apiUrl={import.meta.env.VITE_BACKEND_URL}
          onUpdate={updatedUser => {
            console.log('Updated user:', updatedUser);
            setShowProfile(false);
            setUser(updatedUser); // Make sure setUser updates the parent user state!
          }}
        />
      )}
    </>
  );
};

export default Sidebar;