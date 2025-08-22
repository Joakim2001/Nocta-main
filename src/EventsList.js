import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, query, getDocs, orderBy, limit, where, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { CLUB_FESTIVAL_NAMES, BAR_NAMES } from './club_festival_names';
import BottomNav from './BottomNav';
import { EventsHeader } from './EventsHeader';
import { checkAndArchiveEvent } from './autoArchiveUtils';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { logger } from './utils/logger';
import { filterOutDeletedEvents } from './utils/eventFilters';

// Add CSS for hiding scrollbars
const scrollbarStyles = `
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

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

// Check if an image URL is likely expired (Instagram CDN URLs)
const isLikelyExpiredUrl = (url) => {
  if (!url) return false;
  
  // Instagram CDN URLs that are likely expired
  if (url.includes('cdninstagram.com') || url.includes('fbcdn.net')) {
    // Check if URL contains timestamp patterns that suggest expiration
    const timestampPatterns = [
      /\d{10,}/, // Unix timestamps
      /\d{4}-\d{2}-\d{2}/, // Date patterns
      /t\d{6}/, // Time patterns
    ];
    
    return timestampPatterns.some(pattern => pattern.test(url));
  }
  
  return false;
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

// Function to get WebP images with fallback
const getWebPImageUrl = (event) => {
  // Priority 1: Check for company event images first
  if (event.imageUrls && Array.isArray(event.imageUrls) && event.imageUrls.length > 0) {
    // Check if any of the imageUrls are WebP
    const webPImage = event.imageUrls.find(url =>
      url && (url.includes('.webp') || url.includes('data:image/webp'))
    );
    if (webPImage) return webPImage;
    
    // If no WebP found, return the first image
    return event.imageUrls[0];
  }
  
  // Priority 2: Check for WebP images in order of preference
  const webPFields = [
    event.WebPImage1, event.WebPImage0, event.WebPImage2, event.WebPImage3,
    event.WebPImage4, event.WebPImage5, event.WebPImage6, event.WebPDisplayurl
  ];
  
  for (const webPField of webPFields) {
    if (webPField && webPField !== null) {
      const isWebPDataUrl = webPField.startsWith('data:image/webp;base64,');
      const isWebPStorageUrl = webPField.includes('webp_') && (webPField.includes('firebasestorage.googleapis.com') || webPField.includes('nocta_bucket'));
      
      if (isWebPDataUrl || isWebPStorageUrl) {
        return webPField;
      }
    }
  }
  
  // Priority 3: Check for original images
  const originalFields = [
    event.Image1, event.Image0, event.Image2, event.Image3,
    event.Image4, event.Image5, event.Image6, event.Displayurl
  ];
  
  for (const originalField of originalFields) {
    if (originalField && originalField !== null && originalField.trim() !== '') {
      return originalField;
    }
  }
  
  // Fallback to default image
  return '/default-tyrolia.jpg';
};

// Function to get the best media (video or image) for an event
const getBestMedia = (event) => {
  const videoUrl = event.optimizedVideourl || event.webMVideourl || event.videourl || event.videoUrl || event.VideoURL;
  if (videoUrl && videoUrl.trim() !== '') {
    return { type: 'video', url: videoUrl };
  }
  return { type: 'image', url: getWebPImageUrl(event) };
};

// Component to display media (video or image) with proper styling
const MediaDisplay = ({ event, height = '160px', showVideoIndicator = false }) => {
  const media = getBestMedia(event);
  
  if (media.type === 'video') {
    return (
      <>
        <video
          src={media.url}
          style={{
            width: '100%',
            height: height,
            objectFit: 'cover',
            borderRadius: '24px 24px 0 0'
          }}
          autoPlay
          muted
          loop
          playsInline
          onError={() => {
            console.log('❌ Video failed to load, falling back to image');
            const img = document.querySelector(`[data-event-id="${event.id}"] img`);
            if (img) img.style.display = 'block';
          }}
        />
      </>
    );
  }
  
  return (
    <img
      src={media.url}
      alt={event.title || event.caption}
      style={{
        width: '100%',
        height: height,
        objectFit: 'cover',
        borderRadius: '24px 24px 0 0'
      }}
      onError={() => {
        console.log('❌ Image failed to load, using default');
        const img = document.querySelector(`[data-event-id="${event.id}"] img`);
        if (img) img.src = '/default-tyrolia.jpg';
      }}
    />
  );
};

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
    
    // Video field processing (debug logging removed for production)
    
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
          event.WebPImage1, event.WebPImage0, event.WebPImage2, event.WebPImage3,
          event.WebPImage4, event.WebPImage5, event.WebPImage6, event.WebPDisplayurl
        ];
        
        // Debug: Log available WebP fields
        logger.debug('EventCard - Checking WebP fields for event:', event.id);
        webPFields.forEach((field, index) => {
          if (field) {
            logger.debug(`EventCard - WebP field ${index}: ${field.substring(0, 50)}...`);
          }
        });
        
        for (const webPField of webPFields) {
          if (webPField && webPField !== null) {
            const isWebPDataUrl = webPField.startsWith('data:image/webp;base64,');
            const isWebPStorageUrl = webPField.includes('webp_') && (webPField.includes('firebasestorage.googleapis.com') || webPField.includes('nocta_bucket'));
            
            if (isWebPDataUrl || isWebPStorageUrl) {
              logger.debug('EventCard - Found WebP image, using directly');
              finalImageUrl = webPField;
              logger.success('EventCard - Using WebP image');
              break;
            }
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
              
              // Skip likely expired Instagram URLs to avoid proxy failures
              if (isLikelyExpiredUrl(originalField)) {
                logger.debug('EventCard - Skipping likely expired URL:', originalField);
                continue;
              }
              
              const cleanedUrl = cleanImageUrl(originalField);
              if (cleanedUrl) {
                try {
                  const proxiedUrl = await proxyImageUrl(cleanedUrl);
                  if (proxiedUrl) {
                    finalImageUrl = proxiedUrl;
                    logger.success('EventCard - Using proxied original image');
                    break;
                  }
                } catch (error) {
                  logger.error('EventCard - Proxy failed for URL:', cleanedUrl, error);
                  continue; // Try next image
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
  const [allEvents, setAllEvents] = useState([]); // Store all events separately
  const [imgError, setImgError] = useState({});
  const [loading, setLoading] = useState(true);
  const [showThreeDotsMenu, setShowThreeDotsMenu] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const navigate = useNavigate();

  // Add CSS to document head for hiding scrollbars
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = scrollbarStyles;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Close three dots menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showThreeDotsMenu && !event.target.closest('[data-three-dots-menu]')) {
        setShowThreeDotsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showThreeDotsMenu]);

  // Function to filter events by type (clubs, bars, or all)
  const applyTypeFilter = (eventsList, filterType) => {
    if (filterType === 'all') {
      return eventsList;
    }
    
    return eventsList.filter(event => {
      const companyName = (event.companyName || '').toLowerCase();
      const fullname = (event.fullname || '').toLowerCase();
      const username = (event.username || '').toLowerCase();
      const venue = (event.venue || '').toLowerCase();
      const club = (event.club || '').toLowerCase();
      
      const allNames = [companyName, fullname, username, venue, club].filter(Boolean);
      
      if (filterType === 'clubs') {
        // Check if any of the event names match the club list
        return allNames.some(name => 
          CLUB_FESTIVAL_NAMES.some(clubName => 
            name.includes(clubName.toLowerCase()) || clubName.toLowerCase().includes(name)
          )
        );
      } else if (filterType === 'bars') {
        // Check if any of the event names match the bar list
        return allNames.some(name => 
          BAR_NAMES.some(barName => 
            name.includes(barName.toLowerCase()) || barName.toLowerCase().includes(name)
          )
        );
      }
      
      return true;
    });
  };

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
        
        // Debug: Log some sample events to see their structure
        if (allEvents.length > 0) {
          console.log('🔍 Sample event structure:', {
            id: allEvents[0].id,
            title: allEvents[0].title,
            caption: allEvents[0].caption,
            eventDate: allEvents[0].eventDate,
            timestamp: allEvents[0].timestamp,
            companyName: allEvents[0].companyName,
            fullname: allEvents[0].fullname,
            username: allEvents[0].username,
            source: allEvents[0].source
          });
        }

        // Filter for current/future events (more inclusive)
        allEvents = allEvents
          .filter(event => {
            const start = getEventDate(event);
            const end = getEventDateEnd ? getEventDateEnd(event) : null;
            
            // If no start date, still show the event (don't exclude it)
            if (!start) {
              console.log('⚠️ Event with no date, showing anyway:', event.id, event.title);
              return true;
            }
            
            // Show if event is ongoing or in the future
            if (end) {
              return now <= end;
            }
            return start >= now;
          });
        
        // Log how many events pass the date filter
        console.log('📅 EventsList - Events after date filter:', allEvents.length);
        
        // Optional: Only show club/festival events (comment out to show ALL events)
        // allEvents = allEvents.filter(isClubOrFestival);
        
        // Log final count
        console.log('🎯 EventsList - Final events count:', allEvents.length);

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

        // Apply search filter to all events
        const filteredEvents = applySearchFilter(allEvents);
        
        // Store all events for filtering
        setAllEvents(filteredEvents);
        
        // Apply current filter
        const filteredByType = applyTypeFilter(filteredEvents, selectedFilter);
        
        // Sort events by date (earliest first)
        filteredByType.sort((a, b) => {
          const dateA = getEventDate(a);
          const dateB = getEventDate(b);
          
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateA.getTime() - dateB.getTime();
        });

        setEvents(filteredByType);
      } catch (error) {
        logger.error('Error fetching events:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [searchQuery]);

  // Re-filter events when filter type changes
  useEffect(() => {
    if (allEvents.length > 0) {
      const filteredByType = applyTypeFilter(allEvents, selectedFilter);
      
      // Sort events by date (earliest first)
      filteredByType.sort((a, b) => {
        const dateA = getEventDate(a);
        const dateB = getEventDate(b);
        
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.getTime() - dateB.getTime();
      });

      setEvents(filteredByType);
    }
  }, [selectedFilter, allEvents]);

  return (
    <>
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(180deg, hsl(230, 45%, 9%), hsl(280, 50%, 20%))',
        paddingBottom: '80px'
      }}>

        {/* Main Content */}
        <div style={{ 
          padding: '18px', 
          maxWidth: '448px', 
          margin: '0 auto',
          background: '#2a0845',
          minHeight: 'calc(100vh - 200px)',
          borderRadius: '24px 24px 0 0',
          marginTop: '0'
        }}>

          {/* Top Navigation Bar (Header + Search) */}
          <div style={{ 
            background: '#111827',
            padding: '20px',
            margin: '-18px -18px 24px -18px',
            borderRadius: '0'
          }}>
            {/* Header Section */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              marginBottom: 24
            }}>
                             {/* Location Button */}
               <div style={{ 
                 display: 'flex', 
                 alignItems: 'center', 
                 background: '#2a0845', 
                 color: '#fff', 
                 fontWeight: 600, 
                 fontSize: 14, 
                 borderRadius: 24, 
                 padding: '12px 20px', 
                 boxShadow: '0 2px 12px rgba(42, 8, 69, 0.3)', 
                 border: '2px solid #fff'
               }}>
                <svg style={{ width: 16, height: 16, marginRight: 8 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>København, Denmark</div>
                </div>
              </div>
              
              {/* Right Action Buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                {/* Three Dots Menu Button */}
                <div style={{ position: 'relative' }} data-three-dots-menu>
                                     <div 
                     onClick={() => setShowThreeDotsMenu(!showThreeDotsMenu)}
                     style={{ 
                       width: 40, 
                       height: 40, 
                       background: '#2a0845', 
                       borderRadius: '50%', 
                       display: 'flex', 
                       alignItems: 'center', 
                       justifyContent: 'center',
                       cursor: 'pointer',
                       boxShadow: '0 2px 12px rgba(42, 8, 69, 0.3)',
                       border: '2px solid #fff'
                     }}
                   >
                    <svg style={{ width: 20, height: 20, color: '#fff' }} fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="4" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="20" cy="12" r="2" />
                    </svg>
                  </div>
                  
                  {/* Dropdown Menu */}
                  {showThreeDotsMenu && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: 8,
                      background: '#1f2937',
                      borderRadius: 12,
                      padding: '8px 0',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                      border: '1px solid #374151',
                      zIndex: 1000,
                      minWidth: 120
                    }}>
                                             <div 
                         onClick={() => {
                           setSelectedFilter('all');
                           setShowThreeDotsMenu(false);
                         }}
                         style={{
                           padding: '12px 16px',
                           color: selectedFilter === 'all' ? '#F941F9' : '#fff',
                           fontSize: 14,
                           fontWeight: 600,
                           cursor: 'pointer',
                           borderBottom: '1px solid #374151',
                           backgroundColor: selectedFilter === 'all' ? 'rgba(249, 65, 249, 0.1)' : 'transparent'
                         }}
                       >
                         All ({allEvents.length})
                       </div>
                       <div 
                         onClick={() => {
                           setSelectedFilter('clubs');
                           setShowThreeDotsMenu(false);
                         }}
                         style={{
                           padding: '12px 16px',
                           color: selectedFilter === 'clubs' ? '#F941F9' : '#fff',
                           fontSize: 14,
                           fontWeight: 600,
                           cursor: 'pointer',
                           borderBottom: '1px solid #374151',
                           backgroundColor: selectedFilter === 'clubs' ? 'rgba(249, 65, 249, 0.1)' : 'transparent'
                         }}
                       >
                         Clubs ({applyTypeFilter(allEvents, 'clubs').length})
                       </div>
                       <div 
                         onClick={() => {
                           setSelectedFilter('bars');
                           setShowThreeDotsMenu(false);
                         }}
                         style={{
                           padding: '12px 16px',
                           color: selectedFilter === 'bars' ? '#F941F9' : '#fff',
                           fontSize: 14,
                           fontWeight: 600,
                           cursor: 'pointer',
                           backgroundColor: selectedFilter === 'bars' ? 'rgba(249, 65, 249, 0.1)' : 'transparent'
                         }}
                       >
                         Bars ({applyTypeFilter(allEvents, 'bars').length})
                       </div>
                    </div>
                  )}
                </div>
                
                                 {/* Bell Notification Button */}
                 <div style={{ 
                   width: 40, 
                   height: 40, 
                   background: '#2a0845', 
                   borderRadius: '50%', 
                   display: 'flex', 
                   alignItems: 'center', 
                   justifyContent: 'center',
                   cursor: 'pointer',
                   boxShadow: '0 2px 12px rgba(42, 8, 69, 0.3)',
                   border: '2px solid #fff'
                 }}>
                  <svg style={{ width: 20, height: 20, color: '#fff' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Search Section */}
            <div style={{ 
              marginBottom: 0
            }}>
              {/* Search Bar */}
              <div style={{ 
                position: 'relative',
                background: '#fff',
                borderRadius: 20,
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <svg style={{ width: 20, height: 20, color: '#666' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input 
                  type="text" 
                  placeholder="Search here..." 
                  style={{ 
                    flex: 1, 
                    border: 'none', 
                    outline: 'none', 
                    fontSize: 16,
                    background: 'transparent'
                  }}
                />
                <svg style={{ width: 20, height: 20, color: '#666', cursor: 'pointer' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </div>
            </div>
          </div>

          {/* Trending Section */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              marginBottom: 16 
            }}>
              <h2 style={{ 
                color: '#F2F2F2', 
                fontSize: 24, 
                fontWeight: 600, 
                margin: 0 
              }}>
                Trending
              </h2>
              <span style={{ 
                color: '#7B1FA2', 
                fontSize: 14, 
                cursor: 'pointer',
                textDecoration: 'underline'
              }}>
                See all
              </span>
            </div>
            
            <div className="hide-scrollbar" style={{ 
              display: 'flex', 
              gap: 16, 
              overflowX: 'auto', 
              paddingBottom: 8
            }}>
              {events
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
                .slice(0, 3)
                .map((event, index) => (
                  <div 
                    key={`trending-${event.id}`} 
                    data-section="trending"
                    style={{ 
                      minWidth: 280,
                      background: '#1f2937', 
                      borderRadius: 24, 
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.6)',
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate(`/event/${event.id}?from=home`)}
                  >
                    <div style={{ position: 'relative' }}>
                      <MediaDisplay event={event} height="160px" showVideoIndicator={false} />
                      <div style={{ 
                        position: 'absolute', 
                        top: 12, 
                        right: 12, 
                        background: '#F941F9', 
                        color: '#fff', 
                        padding: '6px 12px', 
                        borderRadius: 12, 
                        fontSize: 12, 
                        fontWeight: 600 
                      }}>
                        {(() => {
                          const startDate = getEventDate(event);
                          const endDate = getEventDateEnd ? getEventDateEnd(event) : null;
                          if (!startDate) return 'TBA';
                          if (endDate && endDate.getTime() !== startDate.getTime()) {
                            return `${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
                          }
                          return startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                        })()}
                      </div>
                      {/* Unified gradient background for title and company name */}
                      <div style={{ 
                        position: 'absolute', 
                        bottom: 0, 
                        left: 0, 
                        right: 0, 
                        background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.6))',
                        padding: '32px 12px 12px 12px',
                        color: '#fff'
                      }}>
                        {/* Event title */}
                        <div style={{ 
                          fontSize: 14,
                          fontWeight: 700,
                          textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
                          lineHeight: 1.2,
                          marginBottom: 8
                        }}>
                          {event.title || event.caption || 'Event Title'}
                        </div>
                        {/* Company name and likes count */}
                        <div style={{ 
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div style={{ 
                            fontSize: 12,
                            fontWeight: 600,
                            textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
                            color: '#87CEEB'
                          }}>
                            {event.companyName || event.fullname || event.venue || event.club || event.username || 'Unknown'}
                          </div>
                          <div style={{ 
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#fff',
                            background: '#10B981',
                            borderRadius: 12,
                            padding: '4px 8px',
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)'
                          }}>
                            {event.likescount > 0 ? `${event.likescount} likes` : 'New Event'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Favourites Section */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              marginBottom: 16 
            }}>
              <h2 style={{ 
                color: '#F2F2F2', 
                fontSize: 24, 
                fontWeight: 600, 
                margin: 0 
              }}>
                Favourites
              </h2>
              <span style={{ 
                color: '#7B1FA2', 
                fontSize: 14, 
                cursor: 'pointer',
                textDecoration: 'underline'
              }}>
                See all
              </span>
            </div>
            
            <div className="hide-scrollbar" style={{ 
              display: 'flex', 
              gap: 16, 
              overflowX: 'auto', 
              paddingBottom: 8
            }}>
              {events
                .filter(event => {
                  // Show events that are not in trending (different selection criteria)
                  const eventDate = getEventDate(event);
                  if (!eventDate) return false;
                  
                  // Prefer events with good engagement or recent events
                  const hasGoodEngagement = (event.likescount || 0) > 5 || (event.viewscount || 0) > 10;
                  const isRecent = eventDate.getTime() > Date.now() - (7 * 24 * 60 * 60 * 1000); // Within 7 days
                  
                  return hasGoodEngagement || isRecent;
                })
                .slice(0, 3)
                .map((event, index) => (
                  <div 
                    key={`favourites-${event.id}`} 
                    data-section="favourites"
                    style={{ 
                      minWidth: 280,
                      background: '#1f2937', 
                      borderRadius: 24, 
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.6)',
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate(`/event/${event.id}?from=home`)}
                  >
                    <div style={{ position: 'relative' }}>
                      <MediaDisplay event={event} height="160px" showVideoIndicator={false} />
                      <div style={{ 
                        position: 'absolute', 
                        top: 12, 
                        right: 12, 
                        background: '#F941F9', 
                        color: '#fff', 
                        padding: '6px 12px', 
                        borderRadius: 12, 
                        fontSize: 12, 
                        fontWeight: 600 
                      }}>
                        {(() => {
                          const startDate = getEventDate(event);
                          const endDate = getEventDateEnd ? getEventDateEnd(event) : null;
                          if (!startDate) return 'TBA';
                          if (endDate && endDate.getTime() !== startDate.getTime()) {
                            return `${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
                          }
                          return startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                        })()}
                      </div>
                      {/* Unified gradient background for title and company name */}
                      <div style={{ 
                        position: 'absolute', 
                        bottom: 0, 
                        left: 0, 
                        right: 0, 
                        background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.6))',
                        padding: '32px 12px 12px 12px',
                        color: '#fff'
                      }}>
                        {/* Event title */}
                        <div style={{ 
                          fontSize: 14,
                          fontWeight: 700,
                          textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
                          lineHeight: 1.2,
                          marginBottom: 8
                        }}>
                          {event.title || event.caption || 'Event Title'}
                        </div>
                        {/* Company name and likes count */}
                        <div style={{ 
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div style={{ 
                            fontSize: 12,
                            fontWeight: 600,
                            textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
                            color: '#87CEEB'
                          }}>
                            {event.companyName || event.fullname || event.venue || event.club || event.username || 'Unknown'}
                          </div>
                          <div style={{ 
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#fff',
                            background: '#10B981',
                            borderRadius: 12,
                            padding: '4px 8px',
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)'
                          }}>
                            {event.likescount > 0 ? `${event.likescount} likes` : 'New Event'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Explore Section */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ 
              color: '#F2F2F2', 
              fontSize: 24, 
              fontWeight: 600, 
              margin: '0 0 16px 0' 
            }}>
              Explore events
            </h2>
            
            {loading ? (
              <div style={{ color: '#fff', textAlign: 'center', marginTop: 40, fontSize: 18 }}>
                Loading events...
              </div>
            ) : (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: 16 
              }}>
                {events
                  .filter(event => {
                    // Exclude events that are already shown in trending and favourites
                    const trendingEvents = events
                      .sort((a, b) => {
                        const viewsA = a.viewscount || 0;
                        const viewsB = b.viewscount || 0;
                        const likesA = a.likescount || 0;
                        const likesB = b.likescount || 0;
                        if (viewsA !== viewsB) return viewsB - viewsA;
                        return likesB - likesA;
                      })
                      .slice(0, 3)
                      .map(e => e.id);
                    
                    const favouriteEvents = events
                      .filter(e => {
                        const eventDate = getEventDate(e);
                        if (!eventDate) return false;
                        const hasGoodEngagement = (e.likescount || 0) > 5 || (e.viewscount || 0) > 10;
                        const isRecent = eventDate.getTime() > Date.now() - (7 * 24 * 60 * 60 * 1000);
                        return hasGoodEngagement || isRecent;
                      })
                      .slice(0, 3)
                      .map(e => e.id);
                    
                    const excludedIds = [...trendingEvents, ...favouriteEvents];
                    return !excludedIds.includes(event.id);
                  })
                  .sort((a, b) => {
                    // Sort by date, earliest first
                    const dateA = getEventDate(a);
                    const dateB = getEventDate(b);
                    if (!dateA && !dateB) return 0;
                    if (!dateA) return 1;
                    if (!dateB) return -1;
                    return dateA.getTime() - dateB.getTime();
                  })
                  .map((event, index) => (
                    <div 
                      key={`explore-${event.id}`} 
                      data-section="explore"
                      style={{ 
                        background: '#1f2937', 
                        borderRadius: 24, 
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.6)',
                        cursor: 'pointer'
                      }}
                      onClick={() => navigate(`/event/${event.id}?from=home`)}
                    >
                      <div style={{ position: 'relative' }}>
                        <MediaDisplay event={event} height="120px" showVideoIndicator={false} />
                        <div style={{ 
                          position: 'absolute', 
                          top: 8, 
                          right: 8, 
                          background: '#F941F9', 
                          color: '#fff', 
                          padding: '3px 8px', 
                          borderRadius: 8, 
                          fontSize: 10, 
                          fontWeight: 600 
                        }}>
                          {(() => {
                            const startDate = getEventDate(event);
                            const endDate = getEventDateEnd ? getEventDateEnd(event) : null;
                            if (!startDate) return 'TBA';
                            if (endDate && endDate.getTime() !== startDate.getTime()) {
                              return `${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
                            }
                            return startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                          })()}
                        </div>
                        {/* Unified gradient background for title and company name */}
                        <div style={{ 
                          position: 'absolute', 
                          bottom: 0, 
                          left: 0, 
                          right: 0, 
                          background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.6))',
                          padding: '24px 8px 8px 8px',
                          color: '#fff'
                        }}>
                          {/* Event title */}
                          <div style={{ 
                            fontSize: 12,
                            fontWeight: 700,
                            textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
                            lineHeight: 1.2,
                            marginBottom: 6
                          }}>
                            {event.title || event.caption || 'Event Title'}
                          </div>
                          {/* Company name and likes count */}
                          <div style={{ 
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div style={{ 
                              fontSize: 10,
                              fontWeight: 600,
                              textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
                              color: '#87CEEB'
                            }}>
                              {event.companyName || event.fullname || event.venue || event.club || event.username || 'Unknown'}
                            </div>
                            <div style={{ 
                              fontSize: 9,
                              fontWeight: 600,
                              color: '#fff',
                              background: '#10B981',
                              borderRadius: 8,
                              padding: '3px 6px',
                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)'
                            }}>
                              {event.likescount > 0 ? `${event.likescount} likes` : 'New Event'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}

export default EventsList;
