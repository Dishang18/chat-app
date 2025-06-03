import React, { useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";
import UserProfile from "./UserProfile";
// Make sure you have this or replace with your avatar component

const Sidebar = ({
  user,
  onLogout,
  sidebarOpen,
  setSidebarOpen,
  onUserClick,
  setUser,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [photoModalUrl, setPhotoModalUrl] = useState(null);
  const [photoModalIsSvg, setPhotoModalIsSvg] = useState(false);
  const [userStatus, setUserStatus] = useState({});
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [chatUsers, setChatUsers] = useState([]);

  const dropdownRef = useRef();

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  // Socket.io setup for online/offline status
  useEffect(() => {
    if (!user || (!user.id && !user._id)) {
      return;
    }
    const socket = io(import.meta.env.VITE_BACKEND_URL, {
      query: { userId: user.id || user._id },
    });

    socket.emit("user_connected", user.id || user._id);

    socket.on("online_users", (onlineUserIds) => {
      const onlineIds = onlineUserIds.map(String);
      setUserStatus(
        chatUsers.reduce((acc, u) => {
          const idStr = String(u._id);
          acc[idStr] = onlineIds.includes(idStr);
          return acc;
        }, {})
      );
    });

    socket.on("user_online", (userId) => {
      setUserStatus((prev) => ({ ...prev, [String(userId)]: true }));
    });

    socket.on("user_offline", (userId) => {
      setUserStatus((prev) => ({ ...prev, [String(userId)]: false }));
    });

    // Listen for new message event
    socket.on("new_message", (msg) => {
      // Only increment unseen if the message is for the current user and not in the currently open chat
      if (msg.receiver === (user._id || user.id)) {
        setChatUsers((prev) => {
          return prev.map((u) =>
            u._id === msg.sender
              ? { ...u, unseen: (u.unseen || 0) + 1 }
              : u
          );
        });
      }
    });

    // Listen for messages seen event
    socket.on("messages_seen", ({ conversationId, userId }) => {
      // If current user is the receiver, reset unseen count for that user
      if (userId === (user._id || user.id)) {
        setChatUsers((prev) =>
          prev.map((u) =>
            u._id === msg.sender ? { ...u, unseen: 0 } : u
          )
        );
      }
    });

    return () => socket.disconnect();
  }, [user, chatUsers]);

  // Fetch chat users with unseen count
  useEffect(() => {
    if (!user || (!user.id && !user._id)) return;
    fetch(
      `${import.meta.env.VITE_BACKEND_URL}/api/chat-users/${
        user._id || user.id
      }`
    )
      .then((res) => res.json())
      .then((data) => setChatUsers(data || []));
  }, [user]);

  // Sort: unseen users first, then others
  const sortedUsers = [...chatUsers].sort((a, b) => {
    if (a.unseen > 0 && b.unseen === 0) return -1;
    if (b.unseen > 0 && a.unseen === 0) return 1;
    return 0;
  });

  const filteredUsers = sortedUsers.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-40 z-30 md:hidden transition-opacity duration-200 ${
          sidebarOpen ? "block" : "hidden"
        }`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        className={`fixed z-40 top-0 left-0 h-screen w-72 bg-gray-950 border-r border-gray-800 flex flex-col justify-between transform transition-transform duration-200
        ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:static md:flex`}
        style={{ minWidth: "18rem" }}
      >
        <div>
          {/* Logo and App Name */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="12" fill="#22d3ee" />
              <path
                d="M7 10h10M7 14h6"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-2xl font-bold text-white tracking-wide">
              ChatSphere
            </span>
          </div>
          {/* Search Bar */}
          <div className="px-6 py-4 border-b border-gray-800">
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-800 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>
          {/* User List */}
          <ul className="flex-1 overflow-y-auto">
            {filteredUsers.length === 0 && (
              <li className="px-6 py-4 text-gray-500 text-center">
                No users found
              </li>
            )}
            {filteredUsers.map((u) => (
              <li
                key={u._id}
                className="flex items-center px-6 py-3 hover:bg-gray-800 cursor-pointer transition"
                onClick={() => {
                  if (onUserClick) onUserClick(u);
                  setSidebarOpen(false);
                }}
              >
                {/* User avatar */}
                <span className="relative w-8 h-8 mr-3 flex items-center justify-center">
                  {u.profilepic ? (
                    <img
                      src={u.profilepic}
                      alt="Profile"
                      className="w-8 h-8 rounded-full border-2 border-cyan-400 object-cover cursor-pointer bg-gray-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoModalUrl(u.profilepic);
                        setPhotoModalIsSvg(false);
                      }}
                      title="Click to view full photo"
                    />
                  ) : (
                    <span
                      className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-cyan-400 bg-gray-800 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoModalUrl(null);
                        setPhotoModalIsSvg(true);
                      }}
                      title="No profile photo"
                    >
                      <ManAvatar size={28} />
                    </span>
                  )}
                  {/* Online/offline dot at bottom right */}
                  <span
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-950 ${
                      userStatus[String(u._id)] ? "bg-green-400" : "bg-gray-400"
                    }`}
                    title={userStatus[String(u._id)] ? "Online" : "Offline"}
                  />
                </span>
                <span className="text-gray-200 font-medium flex-1">
                  {u.username}
                  {u.id === user.id || u._id === user.id ? " (You)" : ""}
                </span>
                {/* Unseen badge on the right side of the row */}
                {u.unseen > 0 && (
                  <span className="ml-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {u.unseen}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
        {/* Sidebar Footer: Avatar, Dropdown, Logout */}
        <div className="relative px-6 py-5 border-t border-gray-800 flex items-center justify-between">
          <div className="relative flex items-center gap-3">
            <img
              src={
                user.profilepic ||
                `https://ui-avatars.com/api/?name=${user.username}&background=22d3ee&color=fff`
              }
              alt="Profile"
              className="w-12 h-12 rounded-full border-2 border-cyan-400 cursor-pointer transition hover:ring-2 hover:ring-cyan-400"
              onClick={() => setDropdownOpen((open) => !open)}
              title="Open menu"
            />
            {/* Always visible logout button with icon */}
            <button
              className="pl-30 p-2 rounded-full hover:bg-grey-800 transition"
              onClick={() => setShowLogoutConfirm(true)}
              title="Logout"
            >
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 16l4-4m0 0l-4-4m4 4H7"></path>
                <path d="M9 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"></path>
              </svg>
            </button>
            {/* Dropdown */}
            {dropdownOpen && (
              <div
                ref={dropdownRef}
                className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 z-50 w-52 bg-gray-900 border border-gray-700 rounded-2xl shadow-lg flex flex-col items-center py-4"
              >
                <span className="text-gray-200 font-semibold mb-4">
                  {user.username}
                </span>
                <button
                  className="w-36 mb-2 px-4 py-2 rounded-full bg-cyan-600 text-white font-semibold shadow hover:bg-cyan-700 transition"
                  onClick={() => {
                    setDropdownOpen(false);
                    setShowProfile(true);
                  }}
                >
                  Profile
                </button>
                <button
                  className="w-36 px-4 py-2 rounded-full bg-gray-700 text-red-400 font-semibold shadow hover:bg-gray-600 transition flex items-center justify-center gap-2"
                  onClick={() => setShowLogoutConfirm(true)}
                >
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 16l4-4m0 0l-4-4m4 4H7"></path>
                    <path d="M9 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"></path>
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
      {/* Full Photo Modal */}
      {(photoModalUrl || photoModalIsSvg) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80"
          onClick={() => {
            setPhotoModalUrl(null);
            setPhotoModalIsSvg(false);
          }}
        >
          <div className="relative">
            {photoModalIsSvg ? (
              <div className="flex items-center justify-center bg-gray-900 rounded-2xl border-4 border-cyan-400 shadow-2xl w-[320px] h-[320px]">
                <ManAvatar size={180} />
              </div>
            ) : (
              <img
                src={photoModalUrl}
                alt="Full Profile"
                className="max-w-[90vw] max-h-[90vh] rounded-2xl border-4 border-cyan-400 shadow-2xl bg-gray-900"
              />
            )}
            <button
              className="absolute top-2 right-2 bg-gray-900 bg-opacity-70 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl"
              onClick={(e) => {
                e.stopPropagation();
                setPhotoModalUrl(null);
                setPhotoModalIsSvg(false);
              }}
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-80 max-w-full border border-cyan-700">
            <h2 className="text-lg font-semibold text-white mb-3">Logout</h2>
            <p className="text-gray-200 mb-5">Are you sure you want to logout?</p>
            <div className="flex justify-end space-x-3">
              <button
                className="px-4 py-2 rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
      {/* User Profile Modal */}
      {showProfile && (
        <UserProfile
          user={user}
          onClose={() => setShowProfile(false)}
          apiUrl={import.meta.env.VITE_BACKEND_URL}
          onUpdate={(updatedUser) => {
            setShowProfile(false);
            setUser(updatedUser);
          }}
        />
      )}
    </>
  );
};

export default Sidebar;