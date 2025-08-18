import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, query, getDocs, getDoc, doc, setDoc, deleteDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import BottomNavCompany from "./BottomNavCompany";
import { logger } from './utils/logger';

// Helper functions
function getEventDate(event) {
  // Handle Firestore Timestamp objects
  if (event.eventDate && event.eventDate.seconds) {
    return new Date(event.eventDate.seconds * 1000);
  }
  if (event.eventDate) {
    return new Date(event.eventDate);
  }
  if (event.eventDates && event.eventDates.length > 0) {
    const firstDate = event.eventDates[0];
    if (firstDate && firstDate.seconds) {
      return new Date(firstDate.seconds * 1000);
    }
    return new Date(firstDate);
  }
  if (event.timestamp && event.timestamp.seconds) {
    return new Date(event.timestamp.seconds * 1000);
  }
  if (event.timestamp) {
    return new Date(event.timestamp);
  }
  // Fallback: try to parse startTime if available
  if (event.startTime) {
    const today = new Date();
    const [hours, minutes] = event.startTime.split(':');
    today.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return today;
  }
  return null;
}

function getEventDateEnd(event) {
  // Handle Firestore Timestamp objects
  if (event.eventDateEnd && event.eventDateEnd.seconds) {
    return new Date(event.eventDateEnd.seconds * 1000);
  }
  if (event.eventDateEnd) {
    return new Date(event.eventDateEnd);
  }
  if (event.eventDates && event.eventDates.length > 1) {
    const lastDate = event.eventDates[event.eventDates.length - 1];
    if (lastDate && lastDate.seconds) {
      return new Date(lastDate.seconds * 1000);
    }
    return new Date(lastDate);
  }
  // Fallback: try to parse endTime if available
  if (event.endTime) {
    const today = new Date();
    const [hours, minutes] = event.endTime.split(':');
    today.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return today;
  }
  return null;
}

function formatDateLabel(start, end) {
  if (!start || isNaN(start.getTime())) return 'Date TBA';
  try {
    const startStr = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    if (!end || isNaN(end.getTime()) || start.getTime() === end.getTime()) return startStr;
    const endStr = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${startStr} - ${endStr}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Date TBA';
  }
}

function formatTimeLabel(start, end) {
  if (!start) return '';
  const startStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (!end) return startStr;
  const endStr = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${startStr} - ${endStr}`;
}

// EventCard component
function EventCard({ event, navigate, showPreviousEvents }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [imageProcessed, setImageProcessed] = useState(false);

  const cleanImageUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    return url.trim();
  };

  const proxyImageUrl = async (url) => {
    try {
      console.log('🏢 Attempting to proxy image:', url);
      const functions = getFunctions();
      const proxyImage = httpsCallable(functions, 'proxyImage');
      const result = await proxyImage({ imageUrl: url });
      console.log('🏢 Proxy result:', result.data);
      
      // The proxy returns either proxyUrl or dataUrl
      if (result.data.dataUrl) {
        console.log('🏢 Using dataUrl from proxy');
        return result.data.dataUrl;
      } else if (result.data.proxyUrl) {
        console.log('🏢 Using proxyUrl from proxy');
        return result.data.proxyUrl;
      } else {
        console.log('🏢 No valid URL in proxy response');
        return null;
      }
    } catch (error) {
      console.error('🏢 Error proxying image:', error);
      // Try to use the original URL directly as fallback
      console.log('🏢 Trying original URL directly:', url);
      return url;
    }
  };

  useEffect(() => {
    if (!event || !event.id) {
      return;
    }
    console.log('🏢 EventCard - Event object keys:', Object.keys(event));
    console.log('🏢 EventCard - All image fields:', {
      Image0: event.Image0,
      Image1: event.Image1,
      Image2: event.Image2,
      Image3: event.Image3,
      Image4: event.Image4,
      Image5: event.Image5,
      Displayurl: event.Displayurl,
      displayurl: event.displayurl,
      imageUrl: event.imageUrl,
      url: event.url,
      inputurl: event.inputurl
    });
    
    (async () => {
      // Check for video first (prioritize optimized)
      const videoUrl = event.optimizedVideourl || event.webMVideourl || event.videourl || event.videoUrl || event.VideoURL;
      if (videoUrl && videoUrl !== null && videoUrl.trim() !== '') {
        console.log('🏢 EventCard - Video found:', videoUrl);
        setVideoUrl(videoUrl);
        setMediaType('video');
        setImageProcessed(true);
        return;
      }
      
      let finalImageUrl = null;
      
      // Try all possible image fields in order of preference (prioritize WebP)
      const imageFields = [
        // WebP images first (highest priority)
        event.WebPImage1, event.WebPImage0, event.WebPImage2, event.WebPImage3, event.WebPImage4, event.WebPImage5, event.WebPImage6,
        event.WebPDisplayurl,
        // Original images as fallback
        event.Image1, event.Image0, event.Image2, event.Image3, event.Image4, event.Image5, event.Image6,
        event.Displayurl, event.displayurl, event.imageUrl, event.url, event.inputurl
      ];
      
      for (const imageField of imageFields) {
        if (imageField && imageField !== null && imageField.trim() !== '') {
          console.log('🏢 EventCard - Trying image field:', imageField);
          const cleanedUrl = cleanImageUrl(imageField);
          if (cleanedUrl) {
            try {
              // For WebP data URLs or Firebase Storage WebP URLs, use directly (no proxy needed)
              const isWebPDataUrl = cleanedUrl.startsWith('data:image/webp;base64,');
              const isWebPStorageUrl = cleanedUrl.includes('webp_') && (cleanedUrl.includes('firebasestorage.googleapis.com') || cleanedUrl.includes('nocta_bucket'));
              
              if (isWebPDataUrl || isWebPStorageUrl) {
                console.log('🏢 EventCard - Using WebP URL directly:', cleanedUrl.substring(0, 50) + '...');
                finalImageUrl = cleanedUrl;
                console.log('🏢 EventCard - Using WebP URL:', imageField);
                break;
              }
              
              // Skip Instagram profile URLs as they're not image URLs
              if (cleanedUrl.includes('instagram.com') && !cleanedUrl.includes('/p/') && !cleanedUrl.includes('.jpg') && !cleanedUrl.includes('.png')) {
                console.log('🏢 EventCard - Skipping Instagram profile URL:', cleanedUrl);
                continue;
              }
              
              // For Instagram CDN URLs or any external URLs, always use proxy to avoid CORS
              if (cleanedUrl.includes('instagram.com') || cleanedUrl.includes('fbcdn.net') || cleanedUrl.includes('scontent')) {
                console.log('🏢 EventCard - Using proxy for Instagram/CDN URL:', cleanedUrl);
                const proxiedUrl = await proxyImageUrl(cleanedUrl);
                if (proxiedUrl) {
                  finalImageUrl = proxiedUrl;
                  console.log('🏢 EventCard - Successfully loaded proxied image from:', imageField);
                  break;
                }
              }
              // For local or same-origin URLs, try direct
              else if (cleanedUrl.startsWith('/') || cleanedUrl.includes(window.location.origin)) {
                console.log('🏢 EventCard - Trying direct local URL:', cleanedUrl);
                finalImageUrl = cleanedUrl;
                console.log('🏢 EventCard - Using direct local URL:', cleanedUrl);
                break;
              }
              // For other external URLs, try proxy
              else {
                console.log('🏢 EventCard - Using proxy for external URL:', cleanedUrl);
                const proxiedUrl = await proxyImageUrl(cleanedUrl);
                if (proxiedUrl) {
                  finalImageUrl = proxiedUrl;
                  console.log('🏢 EventCard - Successfully loaded proxied image from:', imageField);
                  break;
                }
              }
            } catch (error) {
              console.log('🏢 EventCard - Failed to load image from:', imageField, error);
            }
          }
        }
      }
      
      if (finalImageUrl) {
        setImageUrl(finalImageUrl);
        setMediaType('image');
        console.log('🏢 EventCard - Final image URL set:', finalImageUrl);
      } else {
        console.log('🏢 EventCard - No media found, using default image');
        // Try one more fallback - use a working image URL for testing
        setImageUrl('/default-tyrolia.jpg');
        setMediaType('image');
      }
      setImageProcessed(true);
    })();
  }, [event.id]);

  const handleClick = () => {
    console.log('🔍 EventCard Click - Event ID:', event.id);
    console.log('🔍 EventCard Click - Event title:', event.title || event.name);
    console.log('🔍 EventCard Click - Event collection:', event.collection);
    
    // Navigate to the regular event detail page with company context
    navigate(`/event/${event.id}?from=company`);
  };

  const eventDate = getEventDate(event);
  const eventDateEnd = getEventDateEnd(event);
  const dateLabel = formatDateLabel(eventDate, eventDateEnd);
  const timeLabel = formatTimeLabel(eventDate, eventDateEnd);

    const clubName = event.companyName || event.fullname || event.venue || event.club || event.username || "Unknown";

  return (
    <div
      key={event.id}
      onClick={handleClick}
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
        cursor: 'pointer'
      }}
    >
            <div style={{ position: 'relative', background: '#3b1a5c' }}>
        {mediaType === 'video' && videoUrl && (
          <video
            src={videoUrl}
            style={{
              width: '100%',
              height: '12rem',
              objectFit: 'cover',
              backgroundColor: '#000'
            }}
            controls
            preload="metadata"
          />
        )}
        {mediaType === 'image' && imageUrl && (
          <img
            src={imageUrl}
            alt={event.title || event.name}
            style={{
              width: '100%',
              height: '12rem',
              objectFit: 'cover',
              backgroundColor: '#f0f0f0'
            }}
            onError={() => setImageUrl('/default-tyrolia.jpg')}
          />
        )}

        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
          pointerEvents: 'none'
        }}></div>

        <div style={{ position: 'absolute', top: 0, right: -1, display: 'flex', gap: 8 }}>
          <span
            style={{
              background: '#6B46C1',
              color: 'white',
              fontSize: 14,
              fontWeight: 'bold',
              padding: '4px 20px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              borderTopRightRadius: '16px',
              borderBottomRightRadius: 0,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: '16px',
              textShadow: '0 2px 8px #3E29F099, 0 1px 3px rgba(255, 255, 255, 0.3)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            {dateLabel}
          </span>
        </div>

        {event.trending && (
          <div style={{ position: 'absolute', top: 0, left: -1, display: 'flex', gap: 8 }}>
            <span
              style={{
                background: '#FF0080',
                color: 'white',
                fontSize: 14,
                fontWeight: 'bold',
                padding: '4px 20px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderTopLeftRadius: '16px',
                borderBottomLeftRadius: 0,
                borderTopRightRadius: 0,
                borderBottomRightRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
            >
              TRENDING
            </span>
      </div>
        )}

        <div style={{ position: 'absolute', bottom: 16, right: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, zIndex: 10 }}>
          <div style={{
            display: 'inline-block',
            border: '1px solid #4ade80',
            color: '#bbf7d0',
            fontSize: 12,
            padding: '4px 12px',
            borderRadius: 9999,
            background: 'rgba(0,0,0,0.4)',
            fontWeight: 500
          }}>
            {event.likescount > 0 ? `${event.likescount} likes` : "New Event"}
          </div>
          {event.videoviewcount > 0 && (
            <div style={{
              display: 'inline-block',
              border: '1px solid #60a5fa',
              color: 'white',
              fontSize: 12,
              padding: '4px 12px',
              borderRadius: 9999,
              background: 'rgba(30, 58, 138, 0.6)',
              fontWeight: 500
            }}>
              {event.videoviewcount} views
            </div>
          )}
        </div>

        {showPreviousEvents && (
          <div style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(255, 0, 0, 0.8)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 'bold'
          }}>
            DELETED
          </div>
        )}
      </div>

      <div
        style={{ 
          background: '#6B46C1', 
          margin: '0', 
          border: 'none', 
          borderRadius: 0, 
          boxSizing: 'border-box',
          padding: '20px'
        }}
      >
        <h3 style={{ 
          fontSize: 18, 
          fontWeight: 800, 
          marginBottom: 4, 
          lineHeight: 1.3,
          color: '#ffffff', 
          textShadow: '0 2px 8px #3E29F099, 0 1px 3px rgba(255, 255, 255, 0.3)', 
          letterSpacing: '0.3px'
        }}>
          {event.title && event.title.length > 0
            ? event.title
            : event.caption && event.caption.length > 50 
              ? event.caption.substring(0, 50) + "..." 
              : event.caption || "Instagram Event"}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ 
            color: '#93c5fd', 
            fontSize: 16, 
            fontWeight: 'bold',
            textShadow: '0 2px 8px #3E29F099, 0 1px 2px rgba(147, 197, 253, 0.4)'
          }}>
            @{clubName}
          </span>
        </div>
      </div>
    </div>
  );
}

// Deleted Event Card component
function DeletedEventCard({ event, navigate, onRepublish, onUseAsTemplate }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [imageProcessed, setImageProcessed] = useState(false);

  // Check if event is outdated (past end date)
  const isOutdated = () => {
    const eventEndDate = getEventDateEnd(event);
    const eventStartDate = getEventDate(event);
    const now = new Date();
    
    if (eventEndDate) {
      return now > eventEndDate;
    } else if (eventStartDate) {
      return now > eventStartDate;
    }
    return false;
  };

  const eventDate = getEventDate(event);
  const eventDateEnd = getEventDateEnd(event);
  const dateLabel = formatDateLabel(eventDate, eventDateEnd);
  const deletedDate = event.deletedAt ? new Date(event.deletedAt.seconds ? event.deletedAt.seconds * 1000 : event.deletedAt).toLocaleDateString() : 'Unknown';
  const outdated = isOutdated();

  // Load media (simplified version of EventCard logic)
  useEffect(() => {
    if (!event || !event.id) return;

    (async () => {
      // Check for video first
      const videoUrl = event.videourl || event.videoUrl || event.VideoURL;
      if (videoUrl && videoUrl !== null && videoUrl.trim() !== '') {
        setVideoUrl(videoUrl);
        setMediaType('video');
        setImageProcessed(true);
        return;
      }
      
      // Try to find an image - prioritize company event images
      if (event.imageUrls && Array.isArray(event.imageUrls) && event.imageUrls.length > 0) {
        // Use the first company image
        setImageUrl(event.imageUrls[0]);
        setMediaType('image');
      } else {
        // Fallback to other image fields
        const imageFields = ['Image1', 'Displayurl', 'displayurl', 'imageUrl', 'url', 'inputurl'];
        for (const field of imageFields) {
          if (event[field]) {
            setImageUrl(event[field]);
            setMediaType('image');
            break;
          }
        }
      }
      
      if (!imageUrl) {
        setImageUrl('/default-tyrolia.jpg');
        setMediaType('image');
      }
      setImageProcessed(true);
    })();
  }, [event.id]);

  return (
    <div style={{
      background: '#2a1a3e',
      borderRadius: 32,
      boxSizing: 'border-box',
      margin: '0 0 24px 0',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 4px 16px 1px rgba(0, 0, 0, 0.5)',
      border: '2px solid #666',
      opacity: 0.8
    }}>
      <div style={{ position: 'relative', background: '#2a1a3e' }}>
        {mediaType === 'video' && videoUrl && (
          <video
            src={videoUrl}
            style={{
              width: '100%',
              height: '8rem',
              objectFit: 'cover',
              backgroundColor: '#000'
            }}
            controls
            preload="metadata"
          />
        )}
        {mediaType === 'image' && imageUrl && (
          <img
            src={imageUrl}
            alt={event.title || event.name}
            style={{
              width: '100%',
              height: '8rem',
              objectFit: 'cover',
              backgroundColor: '#f0f0f0'
            }}
            onError={() => setImageUrl('/default-tyrolia.jpg')}
          />
        )}

        {/* Deleted overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.3) 100%)',
          pointerEvents: 'none'
        }}></div>

        {/* Deleted badge */}
        <div style={{ position: 'absolute', top: 8, left: 8 }}>
          <span style={{
            background: '#dc2626',
            color: 'white',
            fontSize: 12,
            fontWeight: 'bold',
            padding: '4px 12px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}>
            DELETED
          </span>
        </div>

        {outdated && (
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <span style={{
              background: '#f59e0b',
              color: 'white',
              fontSize: 12,
              fontWeight: 'bold',
              padding: '4px 12px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
              OUTDATED
            </span>
          </div>
        )}
      </div>

      <div style={{
        background: '#2a1a3e',
        padding: '16px',
        color: 'white'
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: 600,
          margin: '0 0 8px 0',
          color: '#d1d5db'
        }}>
          {event.title || event.name || 'Untitled Event'}
        </h3>
        
        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>
          <div>Event Date: {dateLabel}</div>
          <div>Deleted: {deletedDate}</div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {!outdated && (
            <button
              onClick={() => {
                console.log('🔄 Republish button clicked for event:', event.id);
                onRepublish(event.id);
              }}
              style={{
                flex: 1,
                background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'transform 0.1s ease'
              }}
              onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              ↗️ Republish
            </button>
          )}
          <button
            onClick={() => {
              console.log('📋 Template button clicked for event:', event.id);
              onUseAsTemplate(event.id);
            }}
            style={{
              flex: 1,
              background: 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.1s ease'
            }}
            onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            📋 Use as Template
          </button>
        </div>
      </div>
    </div>
  );
}

// Main component
function EventsListCompany() {
  const [events, setEvents] = useState([]);
  const [deletedEvents, setDeletedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeletedEvents, setShowDeletedEvents] = useState(false);
  const navigate = useNavigate();

  // Republish a deleted event (move back to original collection)
  const handleRepublish = async (eventId) => {
    try {
      console.log('🔄 Starting republish process for event ID:', eventId);
      
      const eventToRepublish = deletedEvents.find(e => e.id === eventId);
      if (!eventToRepublish) {
        console.error('❌ Event not found in deleted events list');
        alert('Event not found');
        return;
      }

      console.log('🔄 Found event to republish:', eventToRepublish.title || eventToRepublish.name);

      const auth = getAuth();
      const user = auth.currentUser;
      
      // Determine target collection based on original collection
      const targetCollection = eventToRepublish.originalCollection || 'Instagram_posts';
      console.log('🔄 Target collection:', targetCollection);
      
      // Remove deletion metadata and ensure proper ID
      const { deletedAt, deletedBy, originalCollection, originalDataId, ...eventData } = eventToRepublish;
      
      // Use the proper event ID (not the timestamp)
      const actualEventId = String(eventId);
      console.log('🔄 Using event ID for republish:', actualEventId);
      
      // Add back to original collection
      console.log('🔄 Adding event back to', targetCollection);
      await setDoc(doc(db, targetCollection, actualEventId), eventData);
      console.log('✅ Event added back to', targetCollection);
      
      // Remove from deleted_posts
      console.log('🔄 Removing from deleted_posts');
      await deleteDoc(doc(db, 'deleted_posts', actualEventId));
      console.log('✅ Event removed from deleted_posts');
      
      console.log('✅ Event republished successfully');
      alert('Event republished successfully! It will now be visible to private users.');
      
      // Refresh the events list
      window.location.reload();
      
    } catch (error) {
      console.error('❌ Error republishing event:', error);
      console.error('❌ Error details:', error.message);
      alert(`Failed to republish event: ${error.message}`);
    }
  };

  // Use deleted event as template for new event
  const handleUseAsTemplate = (eventId) => {
    const eventToTemplate = deletedEvents.find(e => e.id === eventId);
    if (!eventToTemplate) {
      alert('Event not found');
      return;
    }

    // Store the template data in sessionStorage
    const templateData = {
      title: eventToTemplate.title || eventToTemplate.name,
      description: eventToTemplate.description || eventToTemplate.caption,
      location: eventToTemplate.location || eventToTemplate.venue,
      ticketConfiguration: eventToTemplate.ticketConfiguration,
      Image1: eventToTemplate.Image1,
      videourl: eventToTemplate.videourl,
      // Don't copy dates - let user set new dates
      isTemplate: true,
      templateSource: eventId
    };
    
    sessionStorage.setItem('eventTemplate', JSON.stringify(templateData));
    
    // Navigate to create event page
    navigate('/company-create-event/new');
  };

  // Helper functions for filtering
  function isClubOrFestival(event) {
    const clubFestivalNames = [
      'aveant', 'karruselfest', 'culture box', 'pumpehuset', 'vEGA', 'rust', 'bakken', 'tivoli',
      'parken', 'royal arena', 'forum', 'falkoner', 'amager bio', 'cinemateket', 'imperial',
      'lille vega', 'store vega', 'loppen', 'mojo', 'jazzhouse', 'la fontaine', 'huset',
      'christiania', 'freetown', 'festival', 'roskilde', 'northside', 'smukfest', 'tinderbox'
    ];
    
    const eventName = (event.title || event.name || '').toLowerCase();
    const venue = (event.location || event.venue || '').toLowerCase();
    const username = (event.username || '').toLowerCase();
    
    return clubFestivalNames.some(name => 
      eventName.includes(name) || venue.includes(name) || username.includes(name)
    );
  }

  function isBar(event) {
    const barNames = [
      'bar', 'pub', 'cocktail', 'whisky', 'gin', 'vodka', 'rum', 'tequila', 'beer',
      'øl', 'bodega', 'kro', 'værtshus', 'brasserie', 'bistro', 'tavern', 'lounge'
    ];
    
    const eventName = (event.title || event.name || '').toLowerCase();
    const venue = (event.location || event.venue || '').toLowerCase();
    const username = (event.username || '').toLowerCase();
    
    return barNames.some(name => 
      eventName.includes(name) || venue.includes(name) || username.includes(name)
    );
  }

  useEffect(() => {
      const auth = getAuth();
    
    // Keep checking for user until found or timeout
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkForUser = async () => {
      attempts++;
      console.log(`🏢 === ATTEMPT ${attempts} - CHECKING FOR USER ===`);
      
      const user = auth.currentUser;
      console.log('🏢 Current user:', user ? user.email : 'No user');
      console.log('🏢 User UID:', user ? user.uid : 'No UID');
      
      if (!user && attempts < maxAttempts) {
        console.log(`🏢 No user found, retrying in 500ms... (attempt ${attempts}/${maxAttempts})`);
        setTimeout(checkForUser, 500);
        return;
      }
      
      if (!user) {
        console.log('🏢 No user logged in after all attempts');
        console.log('🏢 === TEMPORARY: SHOWING KARRUSEL EVENTS FOR TESTING ===');
        // Temporary fallback for testing - will show Karrusel events
      } else {
        console.log('🏢 === USER FOUND, FETCHING EVENTS ===');
      }

      try {
      // 1. Fetch the company's profile to get their official name/username
        let companyProfileNames = [];
        
                if (user) {
      try {
        const profileSnap = await getDoc(doc(db, 'Club_Bar_Festival_profiles', user.uid));
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
              console.log('🏢 Company profile data:', profileData);
              
              // Add company name and Instagram username from profile
              if (profileData.name) {
                companyProfileNames.push(profileData.name.trim().toLowerCase());
              }
              if (profileData.instagramusername) {
                companyProfileNames.push(profileData.instagramusername.trim().toLowerCase());
              }
            } else {
              console.warn('🏢 Company profile not found for user:', user.uid);
        }
      } catch (e) {
        console.error("Could not fetch company profile", e);
      }
          
          // Also add user's display name and email as fallbacks
          if (user.displayName) {
            companyProfileNames.push(user.displayName.trim().toLowerCase());
          }
          if (user.email) {
            companyProfileNames.push(user.email.trim().toLowerCase());
          }
        } else {
          // Temporary fallback for testing - search for Karrusel events
          console.log('🏢 Using temporary fallback: searching for Karrusel events');
          companyProfileNames = ['karruselfest'];
        }
        
        companyProfileNames = [...new Set(companyProfileNames)]; // Remove duplicates
        console.log('🏢 Company profile names for filtering:', companyProfileNames);

        // 2. Fetch all events from Instagram_posts (includes both scraped and company-created)
        // and deleted events separately
        const [instagramSnap, deletedSnap] = await Promise.all([
          getDocs(collection(db, "Instagram_posts")),
          getDocs(collection(db, "deleted_posts"))
        ]);
        
        console.log('🏢 Instagram posts found:', instagramSnap.docs.length);
        console.log('🏢 Deleted posts found:', deletedSnap.docs.length);
        
        // 3. Merge active and deleted events
        let allEvents = [
          ...instagramSnap.docs.map(doc => {
            const docData = doc.data();
            
            // Check if document data contains an ID field that might override doc.id
            if (docData.id && docData.id !== doc.id) {
              console.log('⚠️ Document data contains ID field that differs from doc.id:', {
                docId: doc.id,
                dataId: docData.id,
                title: docData.title || docData.name
              });
              // Store the original data ID as a backup
              docData.originalDataId = docData.id;
            }
            
            // Ensure the proper Firestore document ID is used, not any ID from the data
            const eventData = { ...docData, id: doc.id, collection: 'Instagram_posts' };
            
            console.log('🏢 Instagram event added:', doc.id, eventData.title || eventData.name, 
                       docData.source === 'company-created' ? '(Company-created)' : '(Scraped)');
            return eventData;
          }),
          ...deletedSnap.docs.map(doc => {
            const docData = doc.data();
            
            // Check for ID conflicts in deleted events too
            if (docData.id && docData.id !== doc.id) {
              console.log('⚠️ Deleted event data contains conflicting ID:', {
                docId: doc.id,
                dataId: docData.id,
                title: docData.title || docData.name
              });
              docData.originalDataId = docData.id;
            }
            
            const eventData = { ...docData, id: doc.id, collection: 'deleted_posts' };
            console.log('🏢 Deleted event added:', doc.id, eventData.title || eventData.name);
            return eventData;
          })
        ];

        console.log('🏢 === FILTERING EVENTS ===');
        console.log('🏢 Total events before filtering:', allEvents.length);
        
        // First, let's see all events and their details
        allEvents.forEach((event, index) => {
          console.log(`🏢 Event ${index + 1}:`, {
            title: event.title || event.name,
            username: event.username,
            fullname: event.fullname,
            userId: event.userId,
            collection: event.collection
          });
        });

        // Filter by company ownership for ACTIVE events only (exclude deleted_posts)
        const companyFilteredEvents = allEvents.filter(event => {
          // Skip events from deleted_posts collection for active events
          if (event.collection === 'deleted_posts') {
            return false;
          }

          // Check if the event belongs to this company by matching username/fullname
          const eventUsernames = [
            event.username,
            event.fullname,
            event.companyName,
            event.instagramusername
          ].filter(Boolean).map(s => s.trim().toLowerCase());

          // Check if any of the event's usernames match any of the company's profile names
          const isMyEvent = (user && event.userId === user.uid) || 
                           eventUsernames.some(eventName => 
                             companyProfileNames.some(companyName => 
                               eventName.includes(companyName) || companyName.includes(eventName)
                             )
                           );
          
          console.log('🏢 Active events ownership check:', event.title || event.name, {
            eventUserId: event.userId,
            currentUserId: user ? user.uid : 'No user',
            eventUsernames: eventUsernames,
            companyProfileNames: companyProfileNames,
            isMyEvent: isMyEvent,
            collection: event.collection,
            eventType: event.companyName ? 'company-created' : 'instagram-post'
          });
          
          return isMyEvent;
        });

        // Also filter deleted events for this company
        const companyDeletedEvents = allEvents.filter(event => {
          if (event.collection !== 'deleted_posts') return false;
          
            const eventUsernames = [
              event.username,
              event.fullname,
            event.companyName,
            event.instagramusername
            ].filter(Boolean).map(s => s.trim().toLowerCase());
            
          const isMyDeletedEvent = (user && event.userId === user.uid) || 
                                  (user && event.deletedBy === user.uid) ||
                                  eventUsernames.some(eventName => 
                                    companyProfileNames.some(companyName => 
                                      eventName.includes(companyName) || companyName.includes(eventName)
                                    )
                                  );
          
          return isMyDeletedEvent;
        });

        console.log('🏢 ===== FILTERING RESULTS =====');
        console.log('🏢 Active events (for My Posts tab):', companyFilteredEvents.length);
        console.log('🏢 Active events by collection:');
        const activeByCollection = {};
        companyFilteredEvents.forEach(event => {
          activeByCollection[event.collection] = (activeByCollection[event.collection] || 0) + 1;
          console.log('🏢 - Active Event:', event.title || event.name, 'Collection:', event.collection);
        });
        console.log('🏢 Active events summary:', activeByCollection);
        
        console.log('🗑️ Deleted events (for Deleted tab):', companyDeletedEvents.length);
        companyDeletedEvents.forEach(event => {
          console.log('🗑️ - Deleted Event:', event.title || event.name, 'Collection:', event.collection, 'Deleted:', event.deletedAt ? new Date(event.deletedAt.seconds ? event.deletedAt.seconds * 1000 : event.deletedAt).toLocaleDateString() : 'Unknown');
        });

        // Sort by date and show all company events
        companyFilteredEvents.sort((a, b) => getEventDate(a) - getEventDate(b));
        companyDeletedEvents.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt)); // Sort deleted by most recent

        console.log('🗑️ Company deleted events:', companyDeletedEvents.length);

        setEvents(companyFilteredEvents);
        setDeletedEvents(companyDeletedEvents);
        setLoading(false);
        
      } catch (error) {
        console.error('🏢 Error fetching company events:', error);
        setEvents([]);
        setLoading(false);
      }
    };

    // Start checking for user
    checkForUser();
    
    // Cleanup function (no timer to clear in this approach)
    return () => {};
  }, []);

  if (loading) {
    return (
      <div style={{ 
        padding: '20px', 
        color: 'white', 
        background: '#3b1a5c', 
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ fontSize: 18, marginBottom: 20 }}>Loading your events...</div>
        <BottomNavCompany />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: '#3b1a5c', display: 'flex', flexDirection: 'column' }}>
      {/* Original Top Bar */}
      <div style={{ 
        width: '100vw', 
        background: '#0f172a', 
        padding: '22px 0 18px 0', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
        borderBottom: '1px solid #334155', 
        margin: 0, 
        position: 'relative', 
        zIndex: 2 
      }}>
                                <div style={{
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          width: '100%', 
          maxWidth: '448px', 
          padding: '0 18px' 
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
              onClick={() => setShowDeletedEvents(false)}
                                        style={{
                background: !showDeletedEvents ? '#2a0845' : 'transparent',
                color: !showDeletedEvents ? '#fff' : '#2a0845',
                border: !showDeletedEvents ? '2px solid #fff' : '2px solid #2a0845',
                fontWeight: 700, 
                fontSize: 16, 
                borderRadius: 24, 
                                    padding: '8px 16px',
                boxShadow: !showDeletedEvents ? '0 2px 12px #0004' : 'none', 
                letterSpacing: 0.5, 
                textShadow: !showDeletedEvents ? '0 2px 8px #3E29F099' : 'none',
                cursor: 'pointer'
              }}
            >
              My Posts ({events.length})
                                    </button>
              <button
              onClick={() => setShowDeletedEvents(true)}
                style={{
                background: showDeletedEvents ? '#2a0845' : 'transparent',
                color: showDeletedEvents ? '#fff' : '#2a0845',
                border: showDeletedEvents ? '2px solid #fff' : '2px solid #2a0845',
                fontWeight: 700, 
                fontSize: 16, 
                borderRadius: 24, 
                                    padding: '8px 16px',
                boxShadow: showDeletedEvents ? '0 2px 12px #0004' : 'none', 
                letterSpacing: 0.5, 
                textShadow: showDeletedEvents ? '0 2px 8px #3E29F099' : 'none',
                cursor: 'pointer'
              }}
            >
              Deleted ({deletedEvents.length})
              </button>
        </div>
      </div>
        </div>

        <div style={{ width: '100%', background: '#3b1a5c', flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: 448, width: '100%', paddingTop: '18px' }}>

                

                    {/* Events List */}
                <div style={{ padding: '0 16px 80px 16px' }}>
            {showDeletedEvents ? (
              // Show deleted events
              deletedEvents.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 20px',
                  color: 'rgba(255,255,255,0.7)'
                }}>
                  <div style={{ fontSize: 18, marginBottom: 10 }}>
                    No deleted events found
                  </div>
                  <div style={{ fontSize: 14 }}>
                    Deleted events will appear here
                  </div>
                </div>
              ) : (
                deletedEvents.map((event) => (
                  <DeletedEventCard 
                    key={event.id} 
                    event={event} 
                    navigate={navigate}
                    onRepublish={handleRepublish}
                    onUseAsTemplate={handleUseAsTemplate}
                  />
                ))
              )
            ) : (
              // Show active events
              events.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 20px',
                  color: 'rgba(255,255,255,0.7)'
                }}>
                  <div style={{ fontSize: 18, marginBottom: 10 }}>
                    No events found for your company
                  </div>
                  <div style={{ fontSize: 14 }}>
                    Create your first event to get started!
                  </div>
                </div>
              ) : (
                events.map((event) => (
                        <EventCard 
                            key={event.id} 
                            event={event} 
                            navigate={navigate}
                    showPreviousEvents={false}
                        />
                ))
              )
            )}
            </div>
            </div>
        </div>
        <BottomNavCompany />
      </div>
  );
}

export default EventsListCompany; 
 