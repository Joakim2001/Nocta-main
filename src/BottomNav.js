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
      if (from === 'map' && path === '/map') return true;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 w-full z-40">
              <div className="mx-auto max-w-md bg-slate-900 border-t border-slate-800 px-4 py-2 rounded-b-2xl">
        <div className="flex items-center justify-around">
          {/* Home (House icon) */}
          <button
            className={`flex flex-col items-center gap-1 p-2 ${isActive('/home') ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => navigate('/home')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path d="M9 22V12h6v10" />
            </svg>
            <span className="text-xs">Home</span>
          </button>
          {/* Map (Map icon) */}
          <button
            className={`flex flex-col items-center gap-1 p-2 ${isActive('/map') ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => navigate('/map')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="text-xs">Map</span>
          </button>
          {/* Chats (Simple speech bubble icon) */}
          <button
            className={`flex flex-col items-center gap-1 p-2 relative ${isActive('/chats') ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => navigate('/chats')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-slate-900" style={{ fontSize: 11 }}>{unreadCount}</span>
            )}
            <span className="text-xs">Chats</span>
          </button>
          {/* Liked */}
          <button
            className={`flex flex-col items-center gap-1 p-2 ${isActive('/profile') ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => navigate('/profile')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="text-xs">Liked</span>
          </button>
          {/* Tickets */}
          <button
            className={`flex flex-col items-center gap-1 p-2 ${isActive('/my-tickets') ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => navigate('/my-tickets')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
            <span className="text-xs">Tickets</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default BottomNav; 