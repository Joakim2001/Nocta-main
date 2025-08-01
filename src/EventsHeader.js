import React from "react";

const EventsHeader = () => (
  <div className="sticky top-0 z-30 bg-slate-900 px-4 py-3 border-b border-slate-800">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        <span className="text-white font-medium">København</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <div className="flex-1 relative">
        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        <input
          placeholder="Search here..."
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 text-white placeholder-gray-400 rounded-full focus:outline-none focus:border-slate-600"
        />
      </div>
      <button className="bg-slate-800 border border-slate-700 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-slate-700">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      </button>
    </div>
  </div>
);

export default EventsHeader; 