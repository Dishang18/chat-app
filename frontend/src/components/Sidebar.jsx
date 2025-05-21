import React, { useState } from 'react';

const Sidebar = ({ users, user, onLogout, sidebarOpen, setSidebarOpen }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');

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
                key={u.id}
                className="flex items-center px-6 py-3 hover:bg-gray-800 cursor-pointer transition"
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
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setDropdownOpen(open => !open)}>
            <img
              src={`https://ui-avatars.com/api/?name=${user.username}&background=22d3ee&color=fff`}
              alt="Profile"
              className="w-10 h-10 rounded-full border-2 border-cyan-400"
            />
            <span className="text-gray-200 font-medium">{user.username}</span>
          </div>
          {dropdownOpen && (
            <div className="absolute bottom-16 left-6 w-40 bg-gray-900 border border-gray-700 rounded shadow-lg z-50">
              <button
                className="w-full text-left px-4 py-2 text-gray-200 hover:bg-gray-800 transition"
                onClick={() => setDropdownOpen(false)}
              >
                Profile
              </button>
              <button
                className="w-full text-left px-4 py-2 text-red-400 hover:bg-gray-800 transition"
                onClick={onLogout}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;