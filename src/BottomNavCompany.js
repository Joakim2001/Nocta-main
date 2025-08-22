import React from 'react';
import { useNavigate } from 'react-router-dom';

function BottomNavCompany({ unreadCount, onMyPostsClick }) {
  const navigate = useNavigate();
  return (
    <div className="fixed bottom-0 left-0 w-full z-40">
      <div className="mx-auto max-w-md bg-slate-900 border-t border-slate-800 px-4 py-2 rounded-b-2xl">
        <div className="flex items-center justify-around">
          {/* Home (House icon) */}
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white p-2" onClick={() => navigate('/home')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path d="M9 22V12h6v10" />
            </svg>
            <span className="text-xs">Home</span>
          </button>
          
          {/* Events (Calendar icon) */}
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white p-2" onClick={() => { navigate('/company-events'); if (onMyPostsClick) onMyPostsClick(); }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            <span className="text-xs">My posts</span>
          </button>
          
          {/* Create (Plus icon) */}
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white p-2" onClick={() => navigate('/company-create-event')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="text-xs">Create</span>
          </button>
          
          {/* Chats (Chat bubble icon) */}
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white p-2 relative" onClick={() => navigate('/chats')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-slate-900" style={{ fontSize: 11 }}>{unreadCount}</span>
            )}
            <span className="text-xs">Chats</span>
          </button>
          
          {/* Admin Dashboard */}
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white p-2" onClick={() => navigate('/admin-dashboard')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2zm0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span className="text-xs">Admin</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default BottomNavCompany;
