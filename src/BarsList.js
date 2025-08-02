import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { collection, onSnapshot, query, getDocs, doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { CLUB_FESTIVAL_NAMES } from './club_festival_names';
import EventsHeader from './EventsHeader';
import BottomNav from './BottomNav';
import CalendarModal from './CalendarModal';
import { checkAndArchiveEvent } from './autoArchiveUtils';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { logger } from './utils/logger';
import { filterOutDeletedEvents } from './utils/eventFilters';

// Helper function to clean URLs by removing quotes
const cleanImageUrl = (url) => {
  if (!url) return null;
  // Remove quotes from the beginning and end if they exist
  let cleanedUrl = url.trim();
  if (cleanedUrl.startsWith('"') && cleanedUrl.endsWith('"')) {
    cleanedUrl = cleanedUrl.slice(1, -1);
  }
  if (cleanedUrl.startsWith("'") && cleanedUrl.endsWith("'")) {
    cleanedUrl = cleanedUrl.slice(1, -1);
  }
  return cleanedUrl;
};

// Helper function to proxy Instagram URLs using Firebase Function
const proxyImageUrl = async (url) => {
  if (!url) return null;
  
  // Check if it's an Instagram URL
  if (url.includes('instagram.com') || url.includes('cdninstagram.com') || url.includes('fbcdn.net')) {
    try {
      const functions = getFunctions();
      const proxyImage = httpsCallable(functions, 'proxyImage');
      
      logger.debug('EventCard - Calling proxyImage function for:', url);
      const result = await proxyImage({ imageUrl: url });
      const data = result.data;
      
      if (data.success && data.dataUrl) {
        logger.success('EventCard - Successfully proxied image');
        return data.dataUrl;
      } else {
        logger.error('EventCard - Proxy function failed:', data.error);
        return null;
      }
    } catch (error) {
      logger.error('EventCard - Error calling proxy function:', error);
      return null;
    }
  }
  
  return url;
};

function isBar(event) {
  const name = (event.fullname || event.username || '').toLowerCase();
  
  // Debug: Log events that might be clubs but are showing as bars
  if (name.includes('karrusel') || name.includes('karrussel')) {
    console.log('🔍 Debug - Event that might be a club:', {
      eventId: event.id,
      fullname: event.fullname,
      username: event.username,
      name: name,
      isInClubList: CLUB_FESTIVAL_NAMES.map(n => n.toLowerCase()).includes(name),
      clubList: CLUB_FESTIVAL_NAMES.map(n => n.toLowerCase())
    });
  }
  
  return !CLUB_FESTIVAL_NAMES.map(n => n.toLowerCase()).includes(name);
}

function getEventDate(event) {
  if (event.eventDate) {
    if (typeof event.eventDate.toDate === 'function') {
      return event.eventDate.toDate();
    }
    const d = new Date(event.eventDate);
    if (!isNaN(d.getTime())) return d;
  }
  if (event.timestamp) {
    if (typeof event.timestamp === 'string') {
      const d = new Date(event.timestamp);
      if (!isNaN(d.getTime())) return d;
    }
    if (event.timestamp.seconds) {
      const d = new Date(event.timestamp.seconds * 1000);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function getEventDateEnd(event) {
  if (event.eventDateEnd) {
    if (typeof event.eventDateEnd.toDate === 'function') {
      return event.eventDateEnd.toDate();
    }
    const d = new Date(event.eventDateEnd);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function formatDateLabel(start, end) {
  if (!start) return 'Unknown date';
  if (end && end.getTime() !== start.getTime()) {
    return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  }
  return start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function EventCard({ event, imgError, setImgError, navigate }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [mediaType, setMediaType] = useState('image'); // 'image' or 'video'
  const [isLoading, setIsLoading] = useState(false);
  const [imageProcessed, setImageProcessed] = useState(false);
  
  useEffect(() => {
    if (!event || !event.id) {
      return;
    }
  
    logger.debug('EventCard - Event object:', event);
    logger.debug('EventCard - Image1 field:', event.Image1);
    logger.debug('EventCard - VideoURL field:', event.videourl || event.videoUrl || event.VideoURL);
    
    // Check for video first, then images
    (async () => {
      // Priority 1: Check for video
      const videoUrl = event.videourl || event.videoUrl || event.VideoURL;
      if (videoUrl && videoUrl !== null && videoUrl.trim() !== '') {
        logger.debug('EventCard - Video found:', videoUrl);
        setVideoUrl(videoUrl);
        setMediaType('video');
        setImageProcessed(true);
        logger.success('EventCard - Using video');
        return;
      }
      
      // Priority 2: Try Image1
      let finalImageUrl = null;
      if (event.Image1 && event.Image1 !== null) {
        logger.debug('EventCard - Processing Image1:', event.Image1);
        const cleanedUrl = cleanImageUrl(event.Image1);
        if (cleanedUrl) {
          const proxiedUrl = await proxyImageUrl(cleanedUrl);
          if (proxiedUrl) {
            finalImageUrl = proxiedUrl;
            logger.success('EventCard - Using Image1');
          }
        }
      }
      
      // Priority 3: Try Displayurl as fallback
      if (!finalImageUrl && (event.Displayurl || event.displayurl)) {
        logger.debug('EventCard - No Image1, trying Displayurl as fallback');
        const displayUrl = event.Displayurl || event.displayurl;
        const cleanedUrl = cleanImageUrl(displayUrl);
        if (cleanedUrl) {
          const proxiedUrl = await proxyImageUrl(cleanedUrl);
          if (proxiedUrl) {
            finalImageUrl = proxiedUrl;
            logger.success('EventCard - Using Displayurl');
          }
        }
      }
      
      // Set final image URL or default
      if (finalImageUrl) {
        setImageUrl(finalImageUrl);
        setMediaType('image');
        logger.success('EventCard - Image loaded successfully');
      } else {
        logger.debug('EventCard - No media found, using default image');
        setImageUrl('/default-tyrolia.jpg');
        setMediaType('image');
      }
      setImageProcessed(true);
    })();
  }, [event.id]);

  const eventDate = getEventDate(event);
  const eventDateEnd = getEventDateEnd(event);
  const dateLabel = formatDateLabel(eventDate, eventDateEnd);
  const clubName = event.fullname || event.venue || event.club || event.username || "Unknown";
  return (
    <div
      key={event.id}
      className="mb-12 cursor-pointer"
      style={{
        background: '#3b1a5c',
        borderRadius: 32,
        boxSizing: 'border-box',
        margin: '0 0 48px 0',
        zIndex: 10,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 6px 20px 2px rgba(0, 0, 0, 0.7), 0 3px 12px 1px rgba(0, 0, 0, 0.5)',
        border: '2px solid #888888',
      }}
      onClick={() => navigate(`/event/${event.id}?from=bars`)}
    >
              <div className="relative" style={{ background: '#3b1a5c' }}>
        {!imageProcessed ? (
          <div className="w-full h-48 bg-gray-700 flex items-center justify-center">
            <div className="text-white">Loading...</div>
          </div>
        ) : mediaType === 'video' ? (
          <div className="relative w-full h-48">
            <video
              src={videoUrl}
              className="w-full h-48 object-cover"
              style={{ borderRadius: 0 }}
              autoPlay
              muted
              loop
              playsInline
              onLoadedData={() => {
                console.log('✅ Video loaded successfully:', videoUrl ? videoUrl.substring(0, 50) + '...' : 'default');
              }}
              onError={() => {
                console.log('❌ Video failed to load:', videoUrl ? videoUrl.substring(0, 100) + '...' : 'null');
                // Fallback to image if video fails
                setMediaType('image');
                setImageUrl('/default-tyrolia.jpg');
              }}
            />
            {/* Video indicator */}
            <div className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt="event background"
            className="w-full h-48 object-cover"
            onLoad={() => {
              console.log('✅ Image loaded successfully:', imageUrl ? imageUrl.substring(0, 50) + '...' : 'default');
              console.log('🔍 Image src being used:', imageUrl);
            }}
            onError={() => {
              console.log('❌ Image failed to load:', imageUrl ? imageUrl.substring(0, 100) + '...' : 'null');
              console.log('❌ Image src type:', typeof imageUrl);
              console.log('❌ Image src length:', imageUrl ? imageUrl.length : 'null');
              setImgError(prev => ({ ...prev, [event.id]: true }));
              
              // Try Displayurl as fallback if the current image failed
              (async () => {
                const displayUrl = event.Displayurl || event.displayurl;
                if (displayUrl) {
                  console.log('🔄 EventCard - Image1 failed, trying Displayurl as fallback');
                  const fallbackUrl = await proxyImageUrl(cleanImageUrl(displayUrl));
                  console.log('🔗 EventCard - Proxied fallback URL:', fallbackUrl);
                  if (fallbackUrl) {
                    setImageUrl(fallbackUrl);
                  } else {
                    console.log('🔄 EventCard - Displayurl proxy failed, using default');
                    setImageUrl('/default-tyrolia.jpg');
                  }
                } else {
                  console.log('🔄 EventCard - No Displayurl available, using default image');
                  setImageUrl('/default-tyrolia.jpg');
                }
              })();
            }}
          />
        )}
        {/* overlays, badges, etc. as absolutely positioned children */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none"></div>
        <div className="absolute top-0 -right-1 flex gap-2">
          <span
            className="text-white text-sm font-bold px-5 py-1 uppercase tracking-wide shadow"
            style={{
              background: '#6B46C1',
              letterSpacing: '0.04em',
              borderTopRightRadius: '16px',
              borderBottomRightRadius: 0,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: '16px',
              textShadow: '0 2px 8px #3E29F099, 0 1px 3px rgba(255, 255, 255, 0.3)'
            }}
          >
            {dateLabel}
          </span>
        </div>
        {event.trending && (
          <div className="absolute top-0 -left-1 flex gap-2">
            <span
              className="bg-[#FF0080] text-white text-sm font-bold px-5 py-1 uppercase tracking-wide shadow"
              style={{
                letterSpacing: '0.04em',
                borderTopLeftRadius: '16px',
                borderBottomLeftRadius: 0,
                borderTopRightRadius: 0,
                borderBottomRightRadius: '16px'
              }}
            >
              TRENDING
            </span>
          </div>
        )}
        <div className="absolute bottom-4 right-2 flex flex-col items-end gap-1 z-10">
          <div className="inline-block border border-green-400 text-green-200 text-xs px-3 py-1 rounded-full bg-black/40 font-medium">
            {event.likescount > 0 ? `${event.likescount} likes` : "New Event"}
          </div>
          <div className="inline-block border border-blue-400 text-white text-xs px-3 py-1 rounded-full bg-blue-900/60 font-medium">
            {event.commentsCount > 0 ? `${event.commentsCount} comments` : "Be first to comment"}
          </div>
        </div>
      </div>
      <div className="px-5 pt-4 pb-5" style={{ background: '#6B46C1', margin: '0', border: 'none', borderRadius: 0, boxSizing: 'border-box' }}>
        <h3 className="text-lg font-bold mb-1 leading-tight" style={{ color: '#ffffff', textShadow: '0 2px 8px #3E29F099, 0 1px 3px rgba(255, 255, 255, 0.3)', fontWeight: '800', letterSpacing: '0.3px' }}>{event.title && event.title.length > 0
          ? event.title
          : event.caption && event.caption.length > 50 
            ? event.caption.substring(0, 50) + "..." 
            : event.caption || "Instagram Event"}</h3>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-blue-300 text-base font-bold" style={{ textShadow: '0 2px 8px #3E29F099, 0 1px 2px rgba(147, 197, 253, 0.4)' }}>@{clubName}</span>
        </div>
      </div>
    </div>
  );
}

function BarsList() {
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const [events, setEvents] = useState([]);
  const [imgError, setImgError] = useState({});
  const [activeTab, setActiveTab] = useState(() => {
    // Try to restore active tab from sessionStorage, default to 'explore'
    const savedTab = sessionStorage.getItem('activeTab');
    console.log('🔍 BarsList - Initializing with savedTab:', savedTab);
    return savedTab || 'explore';
  });
  const [userFavorites, setUserFavorites] = useState([]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const navigate = useNavigate();

  // Load user favorites
  useEffect(() => {
    const loadUserFavorites = async () => {
      try {
        if (auth.currentUser) {
          console.log('🔍 BarsList: Loading favorites for user:', auth.currentUser.uid);
          const userDoc = await getDoc(doc(db, 'profiles', auth.currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('🔍 BarsList: User data loaded:', userData);
            const favorites = userData.favorites || [];
            console.log('🔍 BarsList: Setting user favorites:', favorites);
            setUserFavorites(favorites);
          } else {
            console.log('🔍 BarsList: No user document found');
          }
        } else {
          console.log('🔍 BarsList: No authenticated user found');
        }
      } catch (error) {
        console.log('Error loading user favorites:', error);
      }
    };
    loadUserFavorites();
  }, []);

  // Save active tab to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab);
    logger.debug('BarsList - Saved activeTab to sessionStorage:', activeTab);
  }, [activeTab]);

  // Debug: Log component mount and current state
  useEffect(() => {
    logger.debug('BarsList - Component mounted');
    logger.debug('BarsList - Current activeTab:', activeTab);
    logger.debug('BarsList - sessionStorage activeTab:', sessionStorage.getItem('activeTab'));
  }, []);

  useEffect(() => {
    async function fetchEvents() {
      const now = new Date();
      // Fetch Instagram_posts
      const snap1 = await getDocs(query(collection(db, "Instagram_posts")));
      // Fetch company-events
      const snap2 = await getDocs(query(collection(db, "company-events")));
      // Merge and filter
      let allEvents = [
        ...snap1.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...snap2.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      ];

      // Filter out events that companies have deleted
      allEvents = await filterOutDeletedEvents(allEvents);

      // TEMPORARILY DISABLED: Check for outdated events and archive them
      // The auto-archiving was too aggressive and moving current events
      // console.log('🔄 Checking for outdated events to archive...');
      // let archivedCount = 0;
      // for (const event of allEvents) {
      //   const wasArchived = await checkAndArchiveEvent(event);
      //   if (wasArchived) {
      //     archivedCount++;
      //   }
      // }
      // if (archivedCount > 0) {
      //   console.log('✅ Archived', archivedCount, 'outdated events, re-fetching...');
      //   // Re-fetch events after archiving
      //   const updatedSnap1 = await getDocs(query(collection(db, "Instagram_posts")));
      //   const updatedSnap2 = await getDocs(query(collection(db, "company-events")));
      //   allEvents = [
      //     ...updatedSnap1.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      //     ...updatedSnap2.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      //   ];
      // }

      // Filter for current/future events
      allEvents = allEvents
        .filter(event => {
          const start = getEventDate(event);
          const end = getEventDateEnd(event);
          if (!start) return false;
          if (end) {
            return now <= end;
          }
          return start >= now;
        });

      // Apply bar filter for all tabs (this is the bar page, so show only bar events)
      allEvents = allEvents.filter(isBar);

      // Calculate top 3 events by engagement (for trending tab) - do this BEFORE any filtering
      const topTrendingEvents = allEvents
        .sort((a, b) => {
          const viewsA = a.viewscount || 0;
          const viewsB = b.viewscount || 0;
          const likesA = a.likescount || 0;
          const likesB = b.likescount || 0;
          
          // First compare by views
          if (viewsA !== viewsB) return viewsB - viewsA; // Higher views first
          
          // If same views, compare by likes
          return likesB - likesA; // Higher likes first
        })
        .slice(0, 3) // Take top 3
        .map(event => ({ ...event, trending: true })); // Mark as trending

      // Apply trending filter if active tab is 'trending'
      if (activeTab === 'trending') {
        // Show only the top 3 events by engagement
        setEvents(topTrendingEvents);
        return; // Exit early for trending tab
      }

      // Apply favorites filter if active tab is 'favourites'
      if (activeTab === 'favourites' && userFavorites.length > 0) {
        const favoriteNames = userFavorites.map(fav => fav.name.toLowerCase());
        const favoriteEvents = allEvents.filter(event => {
          const eventFullname = (event.fullname || '').toLowerCase();
          const eventUsername = (event.username || '').toLowerCase();
          return favoriteNames.includes(eventFullname) || favoriteNames.includes(eventUsername);
        });
        
        // Mark favorite events as trending if they're also in the top trending events
        const trendingIds = topTrendingEvents.map(e => e.id);
        const favoriteEventsWithTrending = favoriteEvents.map(event => {
          if (trendingIds.includes(event.id)) {
            return { ...event, trending: true };
          }
          return event;
        });
        
        setEvents(favoriteEventsWithTrending);
        return; // Exit early for favorites tab
      } else if (activeTab === 'favourites') {
        setEvents([]);
        return; // Exit early for favorites tab with no favorites
      }

      // For explore tab: Show all events except trending ones and favorites
      const trendingIds = topTrendingEvents.map(e => e.id);
      
      // Get favorite venue names for exclusion
      const favoriteNames = userFavorites && userFavorites.length > 0 
        ? userFavorites.map(fav => fav.name.toLowerCase()) 
        : [];
      
      const exploreEvents = allEvents
        .filter(event => {
          // Exclude trending events
          if (trendingIds.includes(event.id)) return false;
          
          // Exclude favorite events
          if (favoriteNames.length > 0) {
            const eventFullname = (event.fullname || '').toLowerCase();
            const eventUsername = (event.username || '').toLowerCase();
            if (favoriteNames.includes(eventFullname) || favoriteNames.includes(eventUsername)) {
              return false;
            }
          }
          
          return true; // Include this event in explore
        })
        .sort((a, b) => {
          const dateA = getEventDate(a);
          const dateB = getEventDate(b);
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateA.getTime() - dateB.getTime(); // Sort by earliest date first
        });
      
      // For explore tab, show events that are neither trending nor favorites
      setEvents(exploreEvents);
    }
    fetchEvents();
  }, [activeTab, userFavorites]);

  return (
    <div style={{ minHeight: '100vh', background: '#3b1a5c' }}>
      {/* Full-width Header Bar with København and search elements - Updated 2025-01-26 */}
      <div style={{ width: '100vw', background: '#0f172a', padding: '22px 0 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #334155', margin: 0, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '448px', padding: '0 18px' }}>
          <span style={{ display: 'flex', alignItems: 'center', background: '#2a0845', color: '#fff', fontWeight: 700, fontSize: 18, borderRadius: 24, padding: '8px 22px', boxShadow: '0 2px 12px #0004', letterSpacing: 0.5, border: '2px solid #fff', textShadow: '0 2px 8px #3E29F099' }}>
            <svg style={{ width: 18, height: 18, color: '#b3e0ff', marginRight: 8 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            København
            <svg style={{ width: 18, height: 18, color: '#b3e0ff', marginLeft: 6 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={{ background: '#2a0845', border: '2px solid #fff', color: '#ffffff', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 12px #0004' }}>
              <svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </button>
            <button 
              onClick={() => setIsCalendarOpen(true)}
              style={{ background: '#2a0845', border: '2px solid #fff', color: '#ffffff', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 12px #0004' }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Bar */}
      <div style={{ 
        width: '100vw', 
        background: '#3b1a5c', 
        padding: '16px 0', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        margin: 0, 
        position: 'relative', 
        zIndex: 1 
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: '100%', 
          maxWidth: '448px', 
          padding: '0 18px' 
        }}>
          {/* Circular container around the three buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#3b1a5c',
            borderRadius: 30,
            padding: '8px',
            width: '100%',
            maxWidth: '320px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
          }}>
            <button
              onClick={() => setActiveTab('favourites')}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: 22,
                background: activeTab === 'favourites' ? '#F941F9' : 'transparent',
                color: activeTab === 'favourites' ? 'white' : '#94a3b8',
                fontWeight: activeTab === 'favourites' ? 700 : 500,
                fontSize: 16,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                margin: '0 2px'
              }}
            >
              Favourites
            </button>
            <button
              onClick={() => setActiveTab('trending')}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: 22,
                background: activeTab === 'trending' ? '#F941F9' : 'transparent',
                color: activeTab === 'trending' ? 'white' : '#94a3b8',
                fontWeight: activeTab === 'trending' ? 700 : 500,
                fontSize: 16,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                margin: '0 2px'
              }}
            >
              Trending
            </button>
            <button
              onClick={() => setActiveTab('explore')}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: 22,
                background: activeTab === 'explore' ? '#F941F9' : 'transparent',
                color: activeTab === 'explore' ? 'white' : '#94a3b8',
                fontWeight: activeTab === 'explore' ? 700 : 500,
                fontSize: 16,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                margin: '0 2px'
              }}
            >
              Explore
            </button>
          </div>
        </div>
      </div>

      {/* Main content container with cards */}
      <div className="relative max-w-2xl mx-auto px-4" style={{ background: '#3b1a5c', paddingTop: 0, marginTop: 0, paddingBottom: '80px', marginBottom: 0 }}>
        <div className="w-full max-w-md mx-auto" style={{ background: '#3b1a5c' }}>
          <div className="w-full max-w-md" style={{ background: '#3b1a5c', marginTop: 0 }}>
            {/* Event cards */}
            {events.length === 0 ? (
              <div style={{ color: '#fff', textAlign: 'center', marginTop: 40, fontSize: 18 }}>No bar events found.</div>
            ) : (
              events.map(event => (
                <EventCard key={event.id} event={event} imgError={imgError} setImgError={setImgError} navigate={navigate} />
              ))
            )}
          </div>
        </div>
        <BottomNav />
        <CalendarModal 
          isOpen={isCalendarOpen} 
          onClose={() => setIsCalendarOpen(false)}
          eventType="bar"
        />
      </div>
    </div>
  );
}

export default BarsList; 