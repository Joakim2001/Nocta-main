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
import { filterOutDeletedEvents } from './utils/eventFilters';

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
  // Debug logging for company-created events
  if (event.source === 'company-created') {
    console.log('📅 getEventDate - Company event:', {
      eventId: event.id,
      title: event.title,
      eventDate: event.eventDate,
      eventDateType: typeof event.eventDate,
      eventDateConstructor: event.eventDate?.constructor?.name,
      eventDateToString: event.eventDate?.toString(),
      hasToDateMethod: typeof event.eventDate?.toDate === 'function',
      toDateResult: typeof event.eventDate?.toDate === 'function' ? 'attempting...' : 'no method',
      timestamp: event.timestamp,
      timestampType: typeof event.timestamp,
      createdAt: event.createdAt
    });
  }
  
  if (event.eventDate) {
    if (event.source === 'company-created') {
      console.log('📅 Company event - eventDate exists, checking toDate method:', typeof event.eventDate.toDate);
    }
    
    if (typeof event.eventDate.toDate === 'function') {
      try {
        const date = event.eventDate.toDate();
        if (event.source === 'company-created') {
          console.log('📅 Company event date (Firestore Timestamp):', date, 'Valid:', !isNaN(date.getTime()));
        }
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch (error) {
        if (event.source === 'company-created') {
          console.log('📅 Company event - Error calling toDate():', error);
        }
      }
    }
    
    // Fallback to direct Date parsing
    const d = new Date(event.eventDate);
    if (!isNaN(d.getTime())) {
      if (event.source === 'company-created') {
        console.log('📅 Company event date (Date object fallback):', d);
      }
      return d;
    } else if (event.source === 'company-created') {
      console.log('📅 Company event - Invalid Date object from eventDate');
    }
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
  
  if (event.source === 'company-created') {
    console.log('📅 Company event - NO VALID DATE FOUND');
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
      // Priority 1: Check for video (prioritize optimized)
      const videoUrl = event.optimizedVideourl || event.webMVideourl || event.videourl || event.videoUrl || event.VideoURL;
      if (videoUrl && videoUrl !== null && videoUrl.trim() !== '') {
        logger.debug('EventCard - Video found:', videoUrl);
        setVideoUrl(videoUrl);
        setMediaType('video');
        setImageProcessed(true);
        logger.success('EventCard - Using video');
        return;
      }
      
      // Priority 1: Check for company event images first
      let finalImageUrl = null;
      
      if (event.imageUrls && Array.isArray(event.imageUrls) && event.imageUrls.length > 0) {
        logger.debug('EventCard - Found company event images, using first image');
        finalImageUrl = event.imageUrls[0];
        logger.success('EventCard - Using company event image');
      }
      // Priority 2: Try WebP images first, then fallback to original fields
      else {
        // Check for WebP Image1 first
        if (event.webPImage1 && event.webPImage1.startsWith('data:image/webp;base64,')) {
          logger.debug('EventCard - Found WebP Image1, using directly');
          finalImageUrl = event.webPImage1;
          logger.success('EventCard - Using WebP Image1');
        }
        // Check for WebP Displayurl if no WebP Image1
        else if (event.webPDisplayurl && event.webPDisplayurl.startsWith('data:image/webp;base64,')) {
          logger.debug('EventCard - Found WebP Displayurl, using directly');
          finalImageUrl = event.webPDisplayurl;
          logger.success('EventCard - Using WebP Displayurl');
        }
        // Fallback to original Image1 with proxy
        else if (event.Image1 && event.Image1 !== null) {
          logger.debug('EventCard - Processing original Image1:', event.Image1);
          const cleanedUrl = cleanImageUrl(event.Image1);
          if (cleanedUrl) {
            const proxiedUrl = await proxyImageUrl(cleanedUrl);
            if (proxiedUrl) {
              finalImageUrl = proxiedUrl;
              logger.success('EventCard - Using proxied Image1');
            }
          }
        }
      }
      
      // Priority 3: Try original Displayurl as final fallback
      if (!finalImageUrl && (event.Displayurl || event.displayurl)) {
        logger.debug('EventCard - No WebP images, trying original Displayurl as fallback');
        const displayUrl = event.Displayurl || event.displayurl;
        const cleanedUrl = cleanImageUrl(displayUrl);
        if (cleanedUrl) {
          const proxiedUrl = await proxyImageUrl(cleanedUrl);
          if (proxiedUrl) {
            finalImageUrl = proxiedUrl;
            logger.success('EventCard - Using proxied Displayurl');
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
  const clubName = event.companyName || event.fullname || event.venue || event.club || event.username || "Unknown";
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
          {event.videoviewcount > 0 && (
            <div className="inline-block border border-blue-400 text-white text-xs px-3 py-1 rounded-full bg-blue-900/60 font-medium">
              {event.videoviewcount} views
            </div>
          )}
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
  // Check all possible name fields including companyName for company-created events
  const names = [
    event.companyName,
    event.fullname, 
    event.username,
    event.venue,
    event.club
  ].filter(Boolean).map(name => name.toLowerCase());
  
  // Debug: Log events that might be clubs
  if (names.some(name => name.includes('karrusel') || name.includes('karrussel'))) {
    console.log('🔍 Debug - Event that might be a club:', {
      eventId: event.id,
      companyName: event.companyName,
      fullname: event.fullname,
      username: event.username,
      venue: event.venue,
      club: event.club,
      names: names,
      isInClubList: names.some(eventName => 
        CLUB_FESTIVAL_NAMES.map(n => n.toLowerCase()).some(clubName => 
          eventName.includes(clubName) || clubName.includes(eventName)
        )
      ),
      clubList: CLUB_FESTIVAL_NAMES.map(n => n.toLowerCase())
    });
  }
  
  // Check if any of the names match the club/festival list
  // Use flexible matching - check if any club name is contained in the event names
  const clubNames = CLUB_FESTIVAL_NAMES.map(n => n.toLowerCase());
  return names.some(eventName => 
    clubNames.some(clubName => 
      eventName.includes(clubName) || clubName.includes(eventName)
    )
  );
}

function EventsList({ filterFavorites, showOnlyTrending, excludeFavorites, searchQuery }) {
  const [events, setEvents] = useState([]);
  const [imgError, setImgError] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      try {
      const now = new Date();
      // Fetch all events from Instagram_posts (includes both scraped and company-created)
      const snap = await getDocs(query(collection(db, "Instagram_posts")));
      let allEvents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter out events that companies have deleted
      allEvents = await filterOutDeletedEvents(allEvents);

      console.log('📊 EventsList - Total events fetched:', allEvents.length);
      console.log('📊 EventsList - Company-created events:', allEvents.filter(e => e.source === 'company-created').length);
      console.log('📊 EventsList - Instagram-scraped events:', allEvents.filter(e => e.source !== 'company-created').length);

      // Filter for current/future events
      allEvents = allEvents
        .filter(event => {
          const start = getEventDate(event);
          const end = getEventDateEnd ? getEventDateEnd(event) : null;
          
                // Debug company events in date filter
      if (event.source === 'company-created') {
        console.log('📅 Date filter check for company event:', {
          title: event.title,
          start: start,
          startTime: start?.getTime(),
          end: end,
          now: now,
          nowTime: now.getTime(),
          comparison: start ? `${start.getTime()} >= ${now.getTime()} = ${start.getTime() >= now.getTime()}` : 'no start date',
          passes: start ? (end ? now <= end : start >= now) : false,
          eventDate: event.eventDate,
          eventDateEnd: event.eventDateEnd,
          createdAt: event.createdAt,
          timestamp: event.timestamp
        });
      }
          
          if (!start) return false;
          // Show if event is ongoing or in the future
          if (end) {
            return now <= end;
          }
          return start >= now;
        })
        .filter(isClubOrFestival); // Only show club/festival events

      // Debug: Check if company events pass the club filter
      const companyEventsAfterFilter = allEvents.filter(e => e.source === 'company-created');
      console.log('🏷️ Company events after club filter:', companyEventsAfterFilter.length, companyEventsAfterFilter.map(e => ({
        title: e.title,
        source: e.source,
        isClub: isClubOrFestival(e),
        companyName: e.companyName,
        fullname: e.fullname,
        username: e.username
      })));

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

      // Search filter function
      const applySearchFilter = (eventsList) => {
        if (!searchQuery || searchQuery.trim() === '') {
          return eventsList;
        }
        
        const query = searchQuery.toLowerCase().trim();
        return eventsList.filter(event => {
          // Search in event title/caption
          const title = (event.title || event.caption || '').toLowerCase();
          if (title.includes(query)) return true;
          
          // Search in company name/username/fullname
          const companyName = (event.companyName || '').toLowerCase();
          const username = (event.username || '').toLowerCase();
          const fullname = (event.fullname || '').toLowerCase();
          const venue = (event.venue || '').toLowerCase();
          const club = (event.club || '').toLowerCase();
          
          return companyName.includes(query) || 
                 username.includes(query) || 
                 fullname.includes(query) ||
                 venue.includes(query) ||
                 club.includes(query);
        });
      };

      // Apply trending filter if requested
      if (showOnlyTrending) {
        // Show only the top 3 events by engagement
        const filteredTrendingEvents = applySearchFilter(topTrendingEvents);
        setEvents(filteredTrendingEvents);
        return; // Exit early for trending tab
      }

      // Apply favorites filter if provided (for favorites tab)
      if (filterFavorites && filterFavorites.length > 0) {
        const favoriteNames = filterFavorites.map(fav => fav.name.toLowerCase());
        console.log('🔍 EventsList - Favorites filter:', {
          favoriteNames,
          totalEvents: allEvents.length
        });
        
        const favoriteEvents = allEvents.filter(event => {
          const eventFullname = (event.fullname || '').toLowerCase();
          const eventUsername = (event.username || '').toLowerCase();
          const eventCompanyName = (event.companyName || '').toLowerCase();
          const eventVenue = (event.venue || '').toLowerCase();
          const eventClub = (event.club || '').toLowerCase();
          
          // Debug company-created events specifically
          if (event.companyName) {
            console.log('🔍 EventsList - Company event check:', {
              eventId: event.id,
              eventTitle: event.title,
              companyName: event.companyName,
              companyNameLower: eventCompanyName,
              favoriteNames,
              matches: {
                companyName: favoriteNames.includes(eventCompanyName),
                fullname: favoriteNames.includes(eventFullname),
                username: favoriteNames.includes(eventUsername),
                venue: favoriteNames.includes(eventVenue),
                club: favoriteNames.includes(eventClub)
              }
            });
          }
          
          // Use flexible matching - check if favorite names are contained in event names or vice versa
          const eventNames = [eventFullname, eventUsername, eventCompanyName, eventVenue, eventClub].filter(Boolean);
          
          return favoriteNames.some(favName => 
            eventNames.some(eventName => 
              eventName.includes(favName) || favName.includes(eventName)
            )
          );
        });
        
        // Mark favorite events as trending if they're also in the top trending events
        const trendingIds = topTrendingEvents.map(e => e.id);
        const favoriteEventsWithTrending = favoriteEvents.map(event => {
          if (trendingIds.includes(event.id)) {
            return { ...event, trending: true };
          }
          return event;
        });
        
        // Sort favorites by date before displaying
        favoriteEventsWithTrending.sort((a, b) => {
          const dateA = getEventDate(a);
          const dateB = getEventDate(b);
          
          // Debug sorting for favorites (especially company events)
          if (a.source === 'company-created' || b.source === 'company-created') {
            console.log('🔄 Favorites sorting comparison:', {
              eventA: { title: a.title || a.caption?.substring(0, 20), source: a.source, date: dateA, dateTime: dateA?.getTime() },
              eventB: { title: b.title || b.caption?.substring(0, 20), source: b.source, date: dateB, dateTime: dateB?.getTime() },
              result: !dateA && !dateB ? 0 : !dateA ? 1 : !dateB ? -1 : dateA.getTime() - dateB.getTime()
            });
          }
          
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateA.getTime() - dateB.getTime(); // Sort by earliest date first
        });
        
        const filteredFavoriteEvents = applySearchFilter(favoriteEventsWithTrending);
        setEvents(filteredFavoriteEvents);
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
            const eventCompanyName = (event.companyName || '').toLowerCase();
            const eventVenue = (event.venue || '').toLowerCase();
            const eventClub = (event.club || '').toLowerCase();
            
            // Use flexible matching for exclusion too
            const eventNames = [eventFullname, eventUsername, eventCompanyName, eventVenue, eventClub].filter(Boolean);
            const isMatchingFavorite = favoriteNames.some(favName => 
              eventNames.some(eventName => 
                eventName.includes(favName) || favName.includes(eventName)
              )
            );
            
            if (isMatchingFavorite) {
              return false;
            }
          }
          
          return true; // Include this event in explore
        })
        .sort((a, b) => {
          const dateA = getEventDate(a);
          const dateB = getEventDate(b);
          
          // Debug sorting for company events
          if (a.source === 'company-created' || b.source === 'company-created') {
            console.log('🔄 Sorting comparison:', {
              eventA: { title: a.title, source: a.source, date: dateA },
              eventB: { title: b.title, source: b.source, date: dateB },
              result: !dateA && !dateB ? 0 : !dateA ? 1 : !dateB ? -1 : dateA.getTime() - dateB.getTime()
            });
          }
          
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateA.getTime() - dateB.getTime(); // Sort by earliest date first
        });
      
      // For explore tab, show events that are neither trending nor favorites
      const filteredExploreEvents = applySearchFilter(exploreEvents);
      
      // Debug: Log final events being set
      console.log('📋 Final events being displayed:', filteredExploreEvents.length);
      const companyEvents = filteredExploreEvents.filter(e => e.source === 'company-created');
      console.log('📋 Company events in final list:', companyEvents.length, companyEvents.map(e => ({
        title: e.title,
        date: getEventDate(e),
        source: e.source
      })));
      
      // Debug: Show first few and last few events to see ordering
      console.log('📋 First 3 events (chronological order):', filteredExploreEvents.slice(0, 3).map(e => ({
        title: e.title || e.caption?.substring(0, 30),
        date: getEventDate(e),
        source: e.source
      })));
      console.log('📋 Last 3 events (chronological order):', filteredExploreEvents.slice(-3).map(e => ({
        title: e.title || e.caption?.substring(0, 30),
        date: getEventDate(e),
        source: e.source
      })));
      
      setEvents(filteredExploreEvents);
      } catch (error) {
        logger.error('Error fetching events:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [filterFavorites, showOnlyTrending, excludeFavorites, searchQuery]);

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
