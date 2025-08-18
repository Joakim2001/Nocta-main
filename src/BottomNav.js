import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function BottomNav({ unreadCount }) {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const from = searchParams.get('from');

  const isActive = (path) => {
    if (location.pathname.startsWith('/event/')) {
      if (from === 'home' && path === '/home') return true;
      if (from === 'bars' && path === '/bars') return true;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 w-full z-40">
              <div className="mx-auto max-w-md bg-slate-900 border-t border-slate-800 px-4 py-3 rounded-b-2xl">
        <div className="flex items-center justify-around">
          {/* Events (Calendar icon) */}
          <button
            className={`flex flex-col items-center gap-3 p-2 ${isActive('/home') ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => navigate('/home')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            <span className="text-xs">Clubs</span>
          </button>
          {/* Bars (Cocktail glass icon) */}
          <button
            className={`flex flex-col items-center gap-3 p-2 ${isActive('/bars') ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => navigate('/bars')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M2 3h20l-10 13L2 3z" />
              <path d="M12 16v5" />
              <path d="M8 21h8" />
            </svg>
            <span className="text-xs">Bars</span>
          </button>
          {/* Chats (Chat bubble icon) */}
          <button
            className={`flex flex-col items-center gap-3 p-2 relative ${isActive('/chats') ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => navigate('/chats')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-slate-900" style={{ fontSize: 11 }}>{unreadCount}</span>
            )}
            <span className="text-xs">Chats</span>
          </button>
          {/* Tickets */}
          <button
            className={`flex flex-col items-center gap-3 p-2 ${isActive('/my-tickets') ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => navigate('/my-tickets')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
            <span className="text-xs">Tickets</span>
          </button>
          {/* Profile */}
          <button
            className={`flex flex-col items-center gap-3 p-2 ${isActive('/profile') ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => navigate('/profile')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default BottomNav; 