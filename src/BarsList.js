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
  // Check all possible name fields including companyName for company-created events
  const names = [
    event.companyName,
    event.fullname, 
    event.username,
    event.venue,
    event.club
  ].filter(Boolean).map(name => name.toLowerCase());
  
  // Debug: Log events that might be clubs but are showing as bars
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
  
  // Bar events are those NOT in the club/festival list
  // Use flexible matching - check if any club name is contained in the event names
  const clubNames = CLUB_FESTIVAL_NAMES.map(n => n.toLowerCase());
  const isClub = names.some(eventName => 
    clubNames.some(clubName => 
      eventName.includes(clubName) || clubName.includes(eventName)
    )
  );
  
  return !isClub;
}

function getEventDate(event) {
  // Debug logging for company-created events
  if (event.source === 'company-created') {
    console.log('📅 BarsList getEventDate - Company event:', {
      eventId: event.id,
      title: event.title,
      eventDate: event.eventDate,
      eventDateType: typeof event.eventDate,
      timestamp: event.timestamp,
      timestampType: typeof event.timestamp,
      createdAt: event.createdAt
    });
  }
  
  if (event.eventDate) {
    if (typeof event.eventDate.toDate === 'function') {
      const date = event.eventDate.toDate();
      if (event.source === 'company-created') {
        console.log('📅 BarsList Company event date (Firestore Timestamp):', date);
      }
      return date;
    }
    const d = new Date(event.eventDate);
    if (!isNaN(d.getTime())) {
      if (event.source === 'company-created') {
        console.log('📅 BarsList Company event date (Date object):', d);
      }
      return d;
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
    console.log('📅 BarsList Company event - NO VALID DATE FOUND');
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
        // Check for WebP images in order of preference
        const webPFields = [
          event.webPImage1, event.webPImage0, event.webPImage2, event.webPImage3, 
          event.webPImage4, event.webPImage5, event.webPImage6, event.webPDisplayurl
        ];
        
        for (const webPField of webPFields) {
          if (webPField && webPField.startsWith('data:image/webp;base64,')) {
            logger.debug('EventCard - Found WebP image, using directly');
            finalImageUrl = webPField;
            logger.success('EventCard - Using WebP image');
            break;
          }
        }
        
        // If no WebP images found, try original images with proxy
        if (!finalImageUrl) {
          const originalFields = [
            event.Image1, event.Image0, event.Image2, event.Image3, 
            event.Image4, event.Image5, event.Image6, event.Displayurl
          ];
          
          for (const originalField of originalFields) {
            if (originalField && originalField !== null) {
              logger.debug('EventCard - Processing original image:', originalField);
              const cleanedUrl = cleanImageUrl(originalField);
              if (cleanedUrl) {
                const proxiedUrl = await proxyImageUrl(cleanedUrl);
                if (proxiedUrl) {
                  finalImageUrl = proxiedUrl;
                  logger.success('EventCard - Using proxied original image');
                  break;
                }
              }
            }
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
          {event.videoviewcount > 0 && (
            <div className="inline-block border border-blue-400 text-white text-xs px-3 py-1 rounded-full bg-blue-900/60 font-medium">
              {event.videoviewcount} views
            </div>
          )}
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
  const [showSearchModal, setShowSearchModal] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
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
      // Search filter function - define at the top to avoid hoisting issues
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

      const now = new Date();
      // Fetch all events from Instagram_posts (includes both scraped and company-created)
      const snap = await getDocs(query(collection(db, "Instagram_posts")));
      let allEvents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter out events that companies have deleted
      allEvents = await filterOutDeletedEvents(allEvents);

      console.log('📊 BarsList - Total events fetched:', allEvents.length);
      console.log('📊 BarsList - Company-created events:', allEvents.filter(e => e.source === 'company-created').length);
      console.log('📊 BarsList - Instagram-scraped events:', allEvents.filter(e => e.source !== 'company-created').length);

      // Filter for current/future events
      allEvents = allEvents
        .filter(event => {
          const start = getEventDate(event);
          const end = getEventDateEnd(event);
          
          // Debug company events in date filter
          if (event.source === 'company-created') {
            console.log('📅 BarsList Date filter check for company event:', {
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
        const filteredTrendingEvents = applySearchFilter(topTrendingEvents);
        setEvents(filteredTrendingEvents);
        return; // Exit early for trending tab
      }

      // Apply favorites filter if active tab is 'favourites'
      if (activeTab === 'favourites' && userFavorites.length > 0) {
        const favoriteNames = userFavorites.map(fav => fav.name.toLowerCase());
        console.log('🔍 BarsList - Favorites filter:', {
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
            console.log('🔍 BarsList - Company event check:', {
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
        
        const filteredFavoriteEvents = applySearchFilter(favoriteEventsWithTrending);
        setEvents(filteredFavoriteEvents);
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
            console.log('🔄 BarsList Sorting comparison:', {
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
      setEvents(filteredExploreEvents);
    }
    fetchEvents();
  }, [activeTab, userFavorites, searchQuery]);

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
            <button 
              onClick={() => setShowSearchModal(true)}
              style={{ background: '#2a0845', border: '2px solid #fff', color: '#ffffff', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 12px #0004' }}
            >
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

        {/* Search Modal */}
        {showSearchModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '20vh'
          }}>
            <div style={{
              background: '#1f2937',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '600', margin: 0 }}>Search Events</h3>
                <button
                  onClick={() => setShowSearchModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9ca3af',
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: '0',
                    width: '30px',
                    height: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              </div>
              
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <svg 
                  style={{ 
                    position: 'absolute', 
                    left: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    width: '18px', 
                    height: '18px', 
                    color: '#9ca3af' 
                  }} 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by event title or company name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 40px',
                    borderRadius: '8px',
                    border: '1px solid #374151',
                    background: '#374151',
                    color: '#fff',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                  autoFocus
                />
              </div>
              
              <div style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center' }}>
                {searchQuery.length > 0 ? `Searching for "${searchQuery}"...` : 'Type to search events and companies'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BarsList; 