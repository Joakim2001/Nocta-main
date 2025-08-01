import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, query, getDocs, orderBy, limit, where, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { CLUB_FESTIVAL_NAMES } from './club_festival_names';
import BottomNav from './BottomNav';
import { EventsHeader } from './EventsHeader';
import { checkAndArchiveEvent } from './autoArchiveUtils';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { logger } from './utils/logger';

// Helper: parse date from alt text
function extractDateFromAlt(alt) {
  if (!alt) return null;
  // Match 'on June 29, 2025' (month day, year)
  const match = alt.match(/on ([A-Za-z]+ \d{1,2}, \d{4})/);
  if (match && match[1]) {
    const date = new Date(match[1]);
    if (!isNaN(date)) return date;
  }
  return null;
}

// Club-specific default images
const CLUB_DEFAULT_IMAGES = {
  "Tyrolia Bier Klub": "/default-tyrolia.jpg",
  // Add more clubs as needed
};

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

const getImageUrl = (img, username) => {
  const normalized = (username || '').trim().toLowerCase();
  const clubDefaults = {
    "tyrolia bier klub": "/default-tyrolia.jpg",
    // Add more clubs as needed
  };
  if (!img || img.trim() === '' || img === 'null' || img === 'undefined') {
    return clubDefaults[normalized] || '/default-tyrolia.jpg';
  }
  return img;
};

function isFirebaseStorageUrl(url) {
  return url && url.includes('firebasestorage.googleapis.com');
}
function isInstagramUrl(url) {
  return url && url.includes('instagram.com');
}
function isStoragePath(val) {
  return val && !val.startsWith('http');
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
    // Show range, e.g. 29 Jun – 1 Jul
    return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  }
  return start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatTimeLabel(date) {
  if (!date) return '';
  return date.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }); // e.g. Sun, 21:00
}

function EventDetailModal({ event, onClose }) {
  if (!event) return null;
  const eventDate = getEventDate(event);
  const eventDateEnd = getEventDateEnd(event);
  const dateLabel = formatDateLabel(eventDate, eventDateEnd);
  const timeLabel = formatTimeLabel(eventDate);
  const resolvedImage = getImageUrl(event.Image1, event.username);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white text-2xl">&times;</button>
        <div
          className="h-48 w-full rounded-xl bg-cover bg-center mb-4"
          style={{ backgroundImage: `url(${resolvedImage})` }}
        />
        <h2 className="text-2xl font-bold text-white mb-2">{event.title || event.caption || "Instagram Event"}</h2>
        <div className="text-blue-200 font-medium mb-2">@{event.username}</div>
        <div className="text-white mb-2">{dateLabel} {timeLabel}</div>
        <div className="mb-2">
          <span className="font-semibold text-white">Event description:</span>
          <span className="text-gray-200"> {event.description || event.caption}</span>
        </div>
        {/* Add more fields as needed */}
      </div>
    </div>
  );
}

function EventCard({ event, imgError, setImgError, navigate }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [mediaType, setMediaType] = useState('image'); // 'image' or 'video'
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
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
  const timeLabel = formatTimeLabel(eventDate);
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
      onClick={() => {
        console.log('🔍 EventCard Click - Event ID:', event.id);
        console.log('🔍 EventCard Click - Event ID type:', typeof event.id);
        console.log('🔍 EventCard Click - Event title:', event.title);
        console.log('🔍 EventCard Click - Event object keys:', Object.keys(event));
        navigate(`/event/${event.id}?from=home`);
      }}
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
            style={{ borderRadius: 0 }}
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
                    setImageUrl(getImageUrl('', event.username));
                  }
                } else {
                  console.log('🔄 EventCard - No Displayurl available, using default image');
                  setImageUrl(getImageUrl('', event.username));
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
      <div
        className="px-5 pt-4 pb-5"
        style={{ background: '#6B46C1', margin: '0', border: 'none', borderRadius: 0, boxSizing: 'border-box' }}
      >
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

function isClubOrFestival(event) {
  const name = (event.fullname || event.username || '').toLowerCase();
  
  // Debug: Log events that might be clubs
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
  
  return CLUB_FESTIVAL_NAMES.map(n => n.toLowerCase()).includes(name);
}

function EventsList({ filterFavorites, showOnlyTrending, excludeFavorites }) {
  const [events, setEvents] = useState([]);
  const [imgError, setImgError] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      try {
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
          const end = getEventDateEnd ? getEventDateEnd(event) : null;
          if (!start) return false;
          // Show if event is ongoing or in the future
          if (end) {
            return now <= end;
          }
          return start >= now;
        })
        .filter(isClubOrFestival); // Only show club/festival events

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

      // Apply trending filter if requested
      if (showOnlyTrending) {
        // Show only the top 3 events by engagement
        setEvents(topTrendingEvents);
        return; // Exit early for trending tab
      }

      // Apply favorites filter if provided (for favorites tab)
      if (filterFavorites && filterFavorites.length > 0) {
        const favoriteNames = filterFavorites.map(fav => fav.name.toLowerCase());
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
      } else if (filterFavorites) {
        // If filterFavorites is provided but empty, show no events
        setEvents([]);
        return; // Exit early for favorites tab with no favorites
      }

      // For explore tab: Show all events except trending ones and favorites
      const trendingIds = topTrendingEvents.map(e => e.id);
      
      // Get favorite venue names for exclusion (from excludeFavorites prop)
      const favoriteNames = excludeFavorites && excludeFavorites.length > 0 
        ? excludeFavorites.map(fav => fav.name.toLowerCase()) 
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
      } catch (error) {
        logger.error('Error fetching events:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [filterFavorites, showOnlyTrending, excludeFavorites]);

  return (
    <>
      <div className="relative max-w-2xl mx-auto px-4" style={{ background: '#3b1a5c', paddingTop: 0, marginTop: 0, paddingBottom: '80px', marginBottom: 0 }}>
        <div className="w-full max-w-md mx-auto" style={{ background: '#3b1a5c' }}>
          <div className="w-full max-w-md" style={{ background: '#3b1a5c', marginTop: 0 }}>
            {loading ? (
              <div style={{ color: '#fff', textAlign: 'center', marginTop: 40, fontSize: 18 }}>
                Loading events...
              </div>
            ) : events.length === 0 ? (
              <div style={{ color: '#fff', textAlign: 'center', marginTop: 40, fontSize: 18 }}>
                {showOnlyTrending ? 'No trending events found.' : 
                 filterFavorites && filterFavorites.length > 0 ? 'No events from your favorites found.' : 
                 'No events found.'}
              </div>
            ) : (
              events.map((event, index) => (
                <EventCard key={event.id} event={event} imgError={imgError} setImgError={setImgError} navigate={navigate} isFirst={index === 0} />
              ))
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}

export default EventsList;
