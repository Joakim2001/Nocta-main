import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { db } from "./firebase";
import { doc, getDoc, collection, getDocs, deleteDoc, setDoc } from "firebase/firestore";
import { storage } from './firebase';
import { ref, getDownloadURL } from "firebase/storage";
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import BottomNav from './BottomNav';
import BottomNavCompany from './BottomNavCompany';
import { logger } from './utils/logger';

// Helper function to clean URLs by removing quotes
const cleanImageUrl = (url) => {
  if (!url) return null;
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
  if (url.includes('instagram.com') || 
      url.includes('cdninstagram.com') || 
      url.includes('instagram.fmqy1-1.fna.fbcdn.net') ||
      (url.includes('instagram') && url.includes('fbcdn.net'))) {
    try {
      const functions = getFunctions();
      const proxyImage = httpsCallable(functions, 'proxyImage');

      logger.debug('EventDetail - Calling proxyImage function for:', url);
      const result = await proxyImage({ imageUrl: url });
      const data = result.data;

      if (data.success && data.dataUrl) {
        logger.success('EventDetail - Successfully proxied image');
        return data.dataUrl;
      } else {
        logger.error('EventDetail - Proxy function failed:', data.error);
        return url; // Return original URL as fallback
      }
    } catch (error) {
      logger.error('EventDetail - Error calling proxy function:', error);
      return url; // Return original URL as fallback
    }
  }

  return url;
};

// Helper function to proxy Instagram video URLs using Firebase Function
const proxyVideoUrl = async (url) => {
  if (!url) return null;

  // Check if it's an Instagram URL
  if (url.includes('instagram.com') || 
      url.includes('cdninstagram.com') || 
      url.includes('instagram.fmqy1-1.fna.fbcdn.net') ||
      (url.includes('instagram') && url.includes('fbcdn.net'))) {
    try {
      const functions = getFunctions();
      const proxyVideo = httpsCallable(functions, 'proxyVideo');

      logger.debug('EventDetail - Calling proxyVideo function for:', url);
      const result = await proxyVideo({ videoUrl: url });
      const data = result.data;

      if (data.success && data.proxyUrl) {
        logger.success('EventDetail - Successfully proxied video');
        return data.proxyUrl;
      } else {
        logger.error('EventDetail - Video proxy function failed:', data.error);
        return url; // Return original URL as fallback
      }
    } catch (error) {
      logger.error('EventDetail - Error calling video proxy function:', error);
      return url; // Return original URL as fallback
    }
  }

  return url;
};


export default function EventDetailPage() {
  // console.log('🚨 EVENT DETAIL PAGE LOADED!');
  // console.log('🚨 Component mount timestamp:', new Date().toISOString());
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Delete event function for companies
  const handleDeleteEvent = async () => {
    if (!event || deleting) return;
    
    setDeleting(true);
    const auth = getAuth();
    const user = auth.currentUser;
    
    try {
      console.log('🗑️ Full event object:', event);
      console.log('🗑️ Event object keys:', Object.keys(event));
      
      let actualEventId = String(event.id); // Ensure ID is a string
      console.log('🗑️ Attempting to delete event:', actualEventId);
      console.log('🗑️ Event ID type:', typeof actualEventId);
      console.log('🗑️ Original event ID:', event.id, 'Type:', typeof event.id);
      
      // Check if this looks like a timestamp (very long number)
      if (actualEventId.length > 15 && !isNaN(actualEventId)) {
        console.log('⚠️ Event ID looks like a timestamp, not a Firestore document ID');
        console.log('⚠️ This may indicate an issue with how events are being stored/retrieved');
        
        // Try to find alternative ID fields
        if (event.documentId) {
          console.log('🔧 Found documentId field:', event.documentId);
          actualEventId = String(event.documentId);
        } else if (event.originalId) {
          console.log('🔧 Found originalId field:', event.originalId);
          actualEventId = String(event.originalId);
        } else {
          console.log('❌ No alternative ID found - searching by event content');
          
          // Try to find the event by matching its content across collections
          const searchCollections = ['Instagram_posts', 'company-events'];
          let foundDocId = null;
          
          for (const collectionName of searchCollections) {
            console.log(`🔍 Searching ${collectionName} for matching event...`);
            const snapshot = await getDocs(collection(db, collectionName));
            
            for (const doc of snapshot.docs) {
              const data = doc.data();
              // Match by title/name and other unique properties
              if ((data.title && data.title === event.title) ||
                  (data.name && data.name === event.name) ||
                  (data.caption && data.caption === event.caption) ||
                  (data.Image1 && data.Image1 === event.Image1)) {
                console.log('✅ Found matching event by content:', doc.id);
                foundDocId = doc.id;
                break;
              }
            }
            if (foundDocId) break;
          }
          
          if (foundDocId) {
            console.log('🔧 Using found document ID:', foundDocId);
            actualEventId = foundDocId;
          } else {
            console.log('❌ Could not find event in any collection');
            throw new Error('Event not found - cannot delete');
          }
        }
      }
      
      // Try to find and delete from the correct collection
      let deletedFrom = null;
      
      // Try Instagram_posts first
      try {
        console.log('🗑️ Attempting to delete from Instagram_posts with ID:', actualEventId);
        await deleteDoc(doc(db, 'Instagram_posts', actualEventId));
        deletedFrom = 'Instagram_posts';
        console.log('✅ Successfully deleted from Instagram_posts');
      } catch (error) {
        console.log('❌ Failed to delete from Instagram_posts:', error.message);
        console.log('🗑️ Attempting to delete from company-events with ID:', actualEventId);
        // Try company-events
        try {
          await deleteDoc(doc(db, 'company-events', actualEventId));
          deletedFrom = 'company-events';
          console.log('✅ Successfully deleted from company-events');
        } catch (error) {
          console.log('❌ Failed to delete from company-events:', error.message);
          console.log('❌ Event not found in any collection for deletion');
          throw new Error(`Event not found in any collection. ID: ${actualEventId}`);
        }
      }
      
      // Move to deleted_posts for record keeping
      if (deletedFrom) {
        // Verify the deletion worked by trying to fetch the document
        try {
          const verifyDoc = await getDoc(doc(db, deletedFrom, actualEventId));
          if (verifyDoc.exists()) {
            console.log('⚠️ WARNING: Document still exists after deletion attempt!');
            throw new Error('Document still exists after deletion - permission issue?');
          } else {
            console.log('✅ Verified: Document successfully deleted from', deletedFrom);
          }
        } catch (verifyError) {
          if (verifyError.message.includes('still exists')) {
            throw verifyError;
          }
          // If it's a "not found" error, that's actually good - it means deletion worked
          console.log('✅ Verified: Document not found (deletion successful)');
        }

        const deletedEventData = {
          ...event,
          deletedAt: new Date(),
          deletedBy: user?.uid,
          originalCollection: deletedFrom
        };
        
        await setDoc(doc(db, 'deleted_posts', actualEventId), deletedEventData);
        console.log('✅ Successfully moved to deleted_posts');
      }
      
      alert('Event deleted successfully!');
      
      // Clear any cached event data
      sessionStorage.removeItem(`event_${actualEventId}`);
      sessionStorage.removeItem(`event_${event.id}`);
      
      navigate('/company-events');
      
    } catch (error) {
      console.error('❌ Error deleting event:', error);
      alert('Failed to delete event. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };
  
  // Prevent locale module errors
  if (typeof window !== 'undefined') {
    window.__localeData__ = window.__localeData__ || {};
    window.__localeData__['en'] = window.__localeData__['en'] || {};
  }
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isCompanyView = searchParams.get('from') === 'company';
  
  // Try to get cached event data first
  const cachedEventData = sessionStorage.getItem(`event_${id}`);
  const beforePaymentData = sessionStorage.getItem(`event_${id}_before_payment`);
  
  // Clear cache for debugging - remove this line after testing
  if (cachedEventData) {
    logger.debug('EventDetail - Clearing cached event data for debugging');
    sessionStorage.removeItem(`event_${id}`);
  }
  
  const initialEvent = beforePaymentData ? JSON.parse(beforePaymentData) : null;
  
  const [event, setEvent] = useState(initialEvent);
  const [loading, setLoading] = useState(!initialEvent);
  const [imageUrls, setImageUrls] = useState([]);
  const [mediaItems, setMediaItems] = useState([]); // Array of {type: 'image'|'video', url: string}
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [purchasingTicket, setPurchasingTicket] = useState(false);
  const [user, setUser] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [fullscreenViewer, setFullscreenViewer] = useState(false);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(0);

  
  // Use ref to track event data that persists across re-renders
  const eventRef = useRef(initialEvent);

  // Keyboard support for full-screen viewer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!fullscreenViewer) return;
      
      switch (e.key) {
        case 'Escape':
          closeFullscreenViewer();
          break;
        case 'ArrowLeft':
          prevImage();
          break;
        case 'ArrowRight':
          nextImage();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenViewer]);

  useEffect(() => {
    logger.debug('useEffect triggered with ID:', id);
    logger.debug('Current event state:', event);
    logger.debug('Current loading state:', loading);
    logger.debug('URL pathname:', window.location.pathname);
    logger.debug('URL search params:', window.location.search);
    
    async function fetchEvent() {
      try {
        logger.debug('Fetching event with ID:', id);
        logger.debug('ID type:', typeof id);
        logger.debug('ID length:', id ? id.length : 'null');
        
        // Check if any documents exist in these collections for ID matching
        const instagramSnap = await getDocs(collection(db, "Instagram_posts"));
        const companySnap = await getDocs(collection(db, "company-events"));
        
        // Check if the requested ID is similar to any existing ID
        const allIds = [
          ...instagramSnap.docs.map(d => d.id),
          ...companySnap.docs.map(d => d.id)
        ];
        const similarIds = allIds.filter(existingId => {
          // Check for similar IDs (might differ by a few characters)
          if (existingId.toString().substring(0, 15) === id.toString().substring(0, 15)) {
            return true;
          }
          return false;
        });
        if (similarIds.length > 0) {
          logger.debug('Found similar IDs for', id, ':', similarIds);
        }
        
        // Try to fetch the document as string first
        let docRef = doc(db, "Instagram_posts", String(id));
        let docSnap = await getDoc(docRef);
                  logger.debug('Instagram_posts result (as string):', docSnap.exists());
        
        if (!docSnap.exists()) {
          logger.debug('Trying company-events collection...');
          docRef = doc(db, "company-events", String(id));
          docSnap = await getDoc(docRef);
          logger.debug('company-events result (as string):', docSnap.exists());
        }
        
        // If still not found, try as number (converted to string)
        if (!docSnap.exists()) {
          logger.debug('Trying as number conversion...');
          const numericId = parseInt(id);
                      logger.debug('Numeric ID:', numericId);
          docRef = doc(db, "Instagram_posts", String(numericId));
          docSnap = await getDoc(docRef);
          logger.debug('Instagram_posts result (numeric):', docSnap.exists());
          
          if (!docSnap.exists()) {
            docRef = doc(db, "company-events", String(numericId));
            docSnap = await getDoc(docRef);
            logger.debug('company-events result (numeric):', docSnap.exists());
          }
        }
        
        // If still not found, try similar IDs we found earlier
        if (!docSnap.exists() && similarIds.length > 0) {
          logger.debug('Trying similar IDs as fallback...');
          for (const similarId of similarIds) {
                          logger.debug('Trying similar ID:', similarId);
            docRef = doc(db, "Instagram_posts", String(similarId));
            docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                              logger.debug('Found event with similar ID in Instagram_posts:', similarId);
              break;
            }
            
            docRef = doc(db, "company-events", String(similarId));
            docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                              logger.debug('Found event with similar ID in company-events:', similarId);
              break;
            }
          }
        }
        if (docSnap.exists()) {
          const eventData = { id: docSnap.id, ...docSnap.data() };
          logger.debug('Raw event data from initial fetch:', eventData);
          logger.debug('Event data fetched:', {
            id: eventData.id,
            title: eventData.title,
            ticketType: eventData.ticketType,
            hasTicketConfig: !!eventData.ticketConfiguration,
            pricingTiers: eventData.ticketConfiguration?.pricingTiers,
            companyName: eventData.companyName,
            username: eventData.username,
            fullname: eventData.fullname
          });
          logger.debug('About to set event data...');
          setEvent(eventData);
          eventRef.current = eventData; // Update ref
          // Cache the event data
          sessionStorage.setItem(`event_${id}`, JSON.stringify(eventData));
          logger.debug('Event data cached in sessionStorage');

          // Load media for carousel (Video + Image1-Image9 + Displayurl fallback)
          logger.debug('EventDetail - Loading media for carousel...');
          
          const mediaItems = [];
          const urls = []; // Keep for backward compatibility
          
          // Priority 1: Check for video first
          const videoUrl = eventData.videourl || eventData.videoUrl || eventData.VideoURL;
          logger.debug('EventDetail - Checking video fields:', {
            videourl: eventData.videourl,
            videoUrl: eventData.videoUrl,
            VideoURL: eventData.VideoURL,
            finalVideoUrl: videoUrl
          });
          
          // Also check for any other video-related fields
          const allVideoFields = Object.keys(eventData).filter(key => 
            key.toLowerCase().includes('video') || key.toLowerCase().includes('videourl')
          );
          logger.debug('EventDetail - All video-related fields found:', allVideoFields);
          logger.debug('EventDetail - Values of video-related fields:', 
            allVideoFields.reduce((acc, key) => ({ ...acc, [key]: eventData[key] }), {})
          );
          
          if (videoUrl && videoUrl !== null && videoUrl.trim() !== '') {
            logger.debug('EventDetail - Video found:', videoUrl);
            const cleanedVideoUrl = cleanImageUrl(videoUrl);
            logger.debug('EventDetail - Cleaned video URL:', cleanedVideoUrl);
            
            if (cleanedVideoUrl) {
              // Check if it's an Instagram URL
              const isInstagramUrl = cleanedVideoUrl.includes('instagram.com') || 
                                   cleanedVideoUrl.includes('cdninstagram.com') || 
                                   cleanedVideoUrl.includes('instagram.fmqy1-1.fna.fbcdn.net') ||
                                   cleanedVideoUrl.includes('instagram') && cleanedVideoUrl.includes('fbcdn.net');
              logger.debug('EventDetail - Is Instagram URL?', isInstagramUrl);
              
              // Check if event has displayurl - if so, allow Instagram videos
              const hasDisplayUrl = eventData.Displayurl || eventData.displayurl;
              logger.debug('EventDetail - Has displayurl?', !!hasDisplayUrl);
              
              if (isInstagramUrl && !hasDisplayUrl) {
                logger.warn('EventDetail - Skipping Instagram video URL (no displayurl):', cleanedVideoUrl);
                // Skip Instagram videos only if there's no displayurl
              } else {
                // Add video if it's not Instagram, or if it's Instagram but event has displayurl
                if (isInstagramUrl && hasDisplayUrl) {
                  logger.success('EventDetail - Processing Instagram video (event has displayurl):', cleanedVideoUrl);
                  // Try to proxy the Instagram video
                  try {
                    const proxiedVideoUrl = await proxyVideoUrl(cleanedVideoUrl);
                    if (proxiedVideoUrl && proxiedVideoUrl !== cleanedVideoUrl) {
                      logger.success('EventDetail - Successfully proxied Instagram video');
                      mediaItems.push({ type: 'video', url: proxiedVideoUrl });
                      urls.push(proxiedVideoUrl);
                    } else {
                      logger.warn('EventDetail - Video proxy failed, skipping video');
                    }
                  } catch (error) {
                    logger.error('EventDetail - Error proxying video:', error);
                  }
                } else {
                  logger.success('EventDetail - Added non-Instagram video to carousel');
                  mediaItems.push({ type: 'video', url: cleanedVideoUrl });
                  urls.push(cleanedVideoUrl); // For backward compatibility
                }
              }
            }
          } else {
            logger.debug('EventDetail - No video URL found');
          }
          
          // Priority 2: Process image fields
          const imageFields = [
            { field: eventData.Image1, name: 'Image1' },
            { field: eventData.Image2, name: 'Image2' },
            { field: eventData.Image3, name: 'Image3' },
            { field: eventData.Image4, name: 'Image4' },
            { field: eventData.Image5, name: 'Image5' },
            { field: eventData.Image6, name: 'Image6' },
            { field: eventData.Image7, name: 'Image7' },
            { field: eventData.Image8, name: 'Image8' },
            { field: eventData.Image9, name: 'Image9' }
          ];
          
          // Process each image field
          for (const { field, name } of imageFields) {
            if (field && field !== null) {
              logger.debug(`EventDetail - Processing ${name}:`, field);
              const cleanedUrl = cleanImageUrl(field);
              if (cleanedUrl) {
                const proxiedUrl = await proxyImageUrl(cleanedUrl);
                if (proxiedUrl) {
                  mediaItems.push({ type: 'image', url: proxiedUrl });
                  urls.push(proxiedUrl); // For backward compatibility
                  logger.success(`EventDetail - Added ${name} to carousel`);
                }
              }
            } else {
              logger.debug(`EventDetail - ${name} is null, skipping`);
            }
          }
          
          // Priority 3: If no media found, try Displayurl as fallback
          if (mediaItems.length === 0 && (eventData.Displayurl || eventData.displayurl)) {
            logger.debug('EventDetail - No media found, trying Displayurl as fallback');
            const displayUrl = eventData.Displayurl || eventData.displayurl;
            const cleanedUrl = cleanImageUrl(displayUrl);
            if (cleanedUrl) {
              const proxiedUrl = await proxyImageUrl(cleanedUrl);
              if (proxiedUrl) {
                mediaItems.push({ type: 'image', url: proxiedUrl });
                urls.push(proxiedUrl); // For backward compatibility
                logger.success('EventDetail - Added Displayurl to carousel');
              }
            }
          }
          
          // Set final media items or default
          logger.debug('EventDetail - Final media items before setting state:', mediaItems);
          logger.debug('EventDetail - Final URLs before setting state:', urls);
          
          if (mediaItems.length > 0) {
            setMediaItems(mediaItems);
            setImageUrls(urls); // Keep for backward compatibility
            logger.success(`EventDetail - Carousel loaded with ${mediaItems.length} media items`);
          } else {
            logger.debug('EventDetail - No media found, using default');
            setMediaItems([{ type: 'image', url: '/default-tyrolia.jpg' }]);
            setImageUrls(['/default-tyrolia.jpg']);
          }
        } else {
          logger.debug('Document does not exist in either collection');
          setEvent(null);
        }
      } catch (err) {
        logger.error("Error fetching event:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchEvent();
  }, [id]);

  // Function to refresh event data
  const refreshEvent = async () => {
    try {
      console.log('🎫 Refreshing event with ID:', id);
      console.log('🎫 Cache-busting timestamp:', Date.now());
      let docRef = doc(db, "Instagram_posts", id);
      let docSnap = await getDoc(docRef);
      console.log('🎫 Instagram_posts refresh result:', docSnap.exists());
      if (!docSnap.exists()) {
        docRef = doc(db, "company-events", id);
        docSnap = await getDoc(docRef);
        console.log('🎫 company-events refresh result:', docSnap.exists());
      }
      if (docSnap.exists()) {
        const eventData = { id: docSnap.id, ...docSnap.data() };
        console.log('🎫 Raw event data from Firestore:', eventData);
        console.log('🎫 Event data refreshed:', {
          id: eventData.id,
          title: eventData.title,
          ticketType: eventData.ticketType,
          hasTicketConfig: !!eventData.ticketConfiguration,
          pricingTiers: eventData.ticketConfiguration?.pricingTiers,
          companyName: eventData.companyName,
          username: eventData.username,
          fullname: eventData.fullname
        });
        console.log('🚨 Setting new event data...');
        setEvent(eventData);
        eventRef.current = eventData; // Update ref
        // Cache the refreshed event data
        sessionStorage.setItem(`event_${id}`, JSON.stringify(eventData));
        console.log('🚨 Event data cached in sessionStorage');
        console.log('🚨 Event data set successfully');
      } else {
        console.log('🚨 No event data found during refresh!');
      }
    } catch (err) {
      console.error("Error refreshing event:", err);
    }
  };

  // Get current user
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Auto-refresh when returning from payment
  useEffect(() => {
    // Check if this is a page reload
    if (performance.navigation.type === 1) {
      console.log('🚨 PAGE RELOAD DETECTED!');
    }
    
    const handleFocus = () => {
      // SMART REFRESH - Only refresh if we have valid ticket configuration
      if (user && !loading) {
        // console.log('🚨 Page focused - checking if refresh is needed');
        // console.log('🚨 Current event has ticket config:', !!event?.ticketConfiguration);
        
        // Only refresh if current event has proper ticket configuration
        // This prevents overwriting good data with bad data
        if (event?.ticketConfiguration?.pricingTiers?.length > 0) {
          // console.log('🚨 Event has good ticket config - safe to refresh');
          refreshEvent();
        } else {
          // console.log('🚨 Event lacks ticket config - keeping current data to prevent downgrade');
        }
      }
    };
    
    // RE-ENABLED with smart refresh logic
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
    };
  }, [user, loading, id]);

  // Track component unmount
  useEffect(() => {
    return () => {
      console.log('🚨 EVENT DETAIL PAGE UNMOUNTING!');
      console.log('🚨 Component unmount timestamp:', new Date().toISOString());
      // Don't clear the cache on unmount - keep it for when component remounts
      console.log('🚨 Keeping event data in sessionStorage for remount');
    };
  }, []);

  // Effect to restore event data if state gets lost
  useEffect(() => {
    if (!event && eventRef.current) {
      console.log('🚨 Event state lost, restoring from ref...');
      setEvent(eventRef.current);
    }
    
    // Clean up before-payment data if we have current event data
    if (event && sessionStorage.getItem(`event_${id}_before_payment`)) {
      console.log('🎫 Cleaning up before-payment data');
      sessionStorage.removeItem(`event_${id}_before_payment`);
    }
  }, [event, id]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen text-white bg-slate-900">Loading...</div>;
  }
  if (!event) {
    return <div className="flex justify-center items-center min-h-screen text-white bg-slate-900">Event not found.</div>;
  }

  const { title, caption, location, url, username, fullname, companyName, description, eventDate, eventDateEnd, venue, club } = event;
  const eventTitle = title || caption?.substring(0, 50) + (caption?.length > 50 ? '...' : '') || 'Event';
  const instagramHandle = companyName || username || fullname || 'Unknown';
  const locationText = location || venue || club || fullname;
  
  const getEventDate = (dateField) => {
    if (!dateField) return null;
    return typeof dateField.toDate === 'function' ? dateField.toDate() : new Date(dateField);
  };

  const startDate = getEventDate(eventDate);
  const endDate = getEventDate(eventDateEnd);
  
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Swipe functions
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && imageUrls.length > 1) {
      setCurrentImageIndex(prev => prev === imageUrls.length - 1 ? 0 : prev + 1);
    }
    if (isRightSwipe && imageUrls.length > 1) {
      setCurrentImageIndex(prev => prev === 0 ? imageUrls.length - 1 : prev - 1);
    }
  };

  const dateText = startDate && endDate && startDate.getTime() !== endDate.getTime()
    ? `${formatDate(startDate)} to ${formatDate(endDate)}`
    : startDate ? formatDate(startDate) : '';

  const handleBuyTicket = async (ticketPrice, tierIndex = 0) => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      navigate('/login');
      return;
  }

    // Check if ticket is still available
    const tier = event?.ticketConfiguration?.pricingTiers?.[tierIndex];
    if (tier && tier.quantity && parseInt(tier.quantity) <= 0) {
      alert('Sorry, this ticket type is no longer available.');
      return;
    }

    setPurchasingTicket(true);
    
    try {
      console.log('🎫 Creating simple checkout session');
      const response = await fetch('https://europe-west1-nocta-d1113.cloudfunctions.net/createCheckoutSessionSimple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          price: ticketPrice,
          eventName: eventTitle,
          userEmail: user.email,
          userId: user.uid,
          eventId: event.id,
          tierIndex: tierIndex
        })
      });

      if (response.ok) {
        const { url } = await response.json();
        console.log('🎫 Redirecting to Stripe Checkout');
        window.location.href = url;
      } else {
        console.error('Failed to create checkout session');
        alert('Failed to create checkout session. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setPurchasingTicket(false);
    }
  };

  // Full-screen media viewer functions
  const openFullscreenViewer = (index) => {
    setFullscreenImageIndex(index);
    setFullscreenViewer(true);
  };

  const closeFullscreenViewer = () => {
    setFullscreenViewer(false);
  };

  const nextImage = () => {
    setFullscreenImageIndex((prev) => 
      prev === mediaItems.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setFullscreenImageIndex((prev) => 
      prev === 0 ? mediaItems.length - 1 : prev - 1
    );
  };

  const handleFullscreenTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleFullscreenTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleFullscreenTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      nextImage();
    } else if (isRightSwipe) {
      prevImage();
    }

    setTouchEnd(null);
    setTouchStart(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#3b1a5c', color: '#fff', paddingBottom: 100 }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: '#0f172a',
        borderBottom: '1px solid #334155',
        maxWidth: 448,
        margin: '0 auto'
      }}>
        <span
          onClick={() => {
            logger.debug('Navigating back - clearing event cache');
            sessionStorage.removeItem(`event_${id}`);
            
            // Check if we came from company events page
            const fromCompany = searchParams.get('from') === 'company';
            if (fromCompany) {
              logger.debug('EventDetail - Returning to company events page');
              navigate('/company-events');
            }
            // Check if we came from bars page
            else if (searchParams.get('from') === 'bars') {
              logger.debug('EventDetail - Returning to bars page');
              navigate('/bars');
            } else {
              // Check if we came from the main events page (with tabs)
              const activeTab = sessionStorage.getItem('activeTab');
              if (activeTab) {
                logger.debug('EventDetail - Returning to tab:', activeTab);
                // Navigate back to the main page, the tab will be restored automatically
                navigate('/home');
              } else {
                // Fallback to normal back navigation
                navigate(-1);
              }
            }
          }}
          style={{ position: 'absolute', left: 28, top: 20, color: '#2046A6', fontSize: 32, fontWeight: 700, cursor: 'pointer', userSelect: 'none', lineHeight: 1 }}
        >
          {'‹'}
        </span>

                <a
          href={`https://instagram.com/${instagramHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
          style={{
            background: '#2a0845',
            color: '#fff',
            padding: '8px 22px',
            borderRadius: 24,
            border: '2px solid #fff',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: instagramHandle.length > 15 ? '14px' : '18px',
            boxShadow: '0 2px 12px #0004',
            letterSpacing: 0.5,
            textShadow: '0 2px 8px #3E29F099',
            whiteSpace: 'nowrap',
            display: 'inline-block',
            textAlign: 'center',
            minWidth: 'fit-content',
            maxWidth: '250px'
          }}
        >
          @{instagramHandle}
        </a>
      </div>

      <div style={{ maxWidth: 448, margin: '0 auto', padding: '0 16px' }}>
        {/* Media Carousel */}
        <div 
          style={{ position: 'relative', height: '12rem', margin: '16px 0', borderRadius: 18, overflow: 'hidden', boxShadow: '0 6px 20px 2px rgba(0, 0, 0, 0.7), 0 3px 12px 1px rgba(0, 0, 0, 0.5)', border: '2px solid #888888' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {mediaItems && mediaItems.length > 0 && (
            <>
              {mediaItems[currentImageIndex]?.type === 'video' ? (
                <div className="relative w-full h-full">
                  <video
                    src={mediaItems[currentImageIndex].url}
                    onClick={() => openFullscreenViewer(currentImageIndex)}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover', 
                      display: 'block', 
                      borderRadius: '18px',
                      cursor: 'pointer'
                    }}
                    autoPlay
                    muted
                    loop
                    playsInline
                    onError={(e) => {
                      console.log('❌ Video failed to load in carousel');
                      logger.error('EventDetail - Video error details:', e);
                      
                      // Simple approach: just remove the failed video and show next item
                      setMediaItems(prevItems => {
                        const newItems = prevItems.filter((_, index) => index !== currentImageIndex);
                        if (newItems.length === 0) {
                          // If no items left, add a default image
                          return [{ type: 'image', url: '/default-tyrolia.jpg' }];
                        }
                        // Reset to first item if current index is out of bounds
                        if (currentImageIndex >= newItems.length) {
                          setCurrentImageIndex(0);
                        }
                        return newItems;
                      });
                    }}
                  />
                  {/* Video indicator */}
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-1">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
              ) : (
                <img 
                  src={mediaItems[currentImageIndex]?.url || imageUrls[currentImageIndex]} 
                  alt={eventTitle} 
                  onClick={() => openFullscreenViewer(currentImageIndex)}
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover', 
                    display: 'block', 
                    borderRadius: '18px',
                    transition: 'opacity 0.3s ease-in-out',
                    cursor: 'pointer'
                  }} 
                />
              )}
              
              {/* Navigation arrows - only show if multiple media items */}
              {mediaItems.length > 1 && (
                <>
                  {/* Left arrow */}
                  <button
                    onClick={() => setCurrentImageIndex(prev => prev === 0 ? mediaItems.length - 1 : prev - 1)}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(0, 0, 0, 0.6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      fontSize: '20px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10
                    }}
                  >
                    ‹
                  </button>
                  
                  {/* Right arrow */}
                  <button
                    onClick={() => setCurrentImageIndex(prev => prev === mediaItems.length - 1 ? 0 : prev + 1)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(0, 0, 0, 0.6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      fontSize: '20px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10
                    }}
                  >
                    ›
                  </button>
                </>
              )}
              
              {/* Media indicators - always show if multiple media items */}
              {mediaItems.length > 1 && (
                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '8px',
                  zIndex: 10
                }}>
                  {mediaItems.map((mediaItem, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        border: 'none',
                        background: index === currentImageIndex ? 'white' : 'rgba(255, 255, 255, 0.5)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Title */}
        <h1 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 600, margin: '24px auto', maxWidth: '320px' }}>
          {eventTitle}
        </h1>

        
        {/* Description Card */}
        {(description || (caption && caption.length > 50)) && (
          <div style={{ background: '#fff', color: '#1f2937', borderRadius: 12, padding: '16px', margin: '16px 0', boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#6b21a8', marginBottom: '8px' }}>DESCRIPTION</h2>
            <p style={{ fontWeight: 400, color: '#000000', whiteSpace: 'pre-wrap' }}>{description || caption}</p>
          </div>
        )}
        
        {/* Date Card */}
        {dateText && (
          <div style={{ background: '#fff', color: '#1f2937', borderRadius: 12, padding: '16px', margin: '16px 0', boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#6b21a8', marginBottom: '8px' }}>DATE</h2>
            <p style={{ fontWeight: 400, color: '#000000' }}>{dateText}</p>
          </div>
        )}
        
        {/* Location Card */}
        {locationText && (
          <div style={{ background: '#fff', color: '#1f2937', borderRadius: 12, padding: '16px', margin: '16px 0', boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#6b21a8', marginBottom: '8px' }}>LOCATION</h2>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationText)}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 400, textDecoration: 'underline', color: '#1d4ed8', cursor: 'pointer' }}>
              {locationText}
            </a>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
          {isCompanyView ? (
            // Company-specific buttons
            <>
              <button 
                onClick={() => setShowDeleteModal(true)}
                style={{
                  flex: 1,
                  background: 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)',
                  color: 'white',
                  padding: '14px',
                  borderRadius: 999,
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '1rem',
                  boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004',
                  cursor: 'pointer'
                }}
              >
                Delete Event
              </button>
              {url && (
                <a href={url} target="_blank" rel="noopener noreferrer" style={{
                  flex: 1,
                  background: 'linear-gradient(90deg, #3E29F0 0%, #a445ff 100%)',
                  color: 'white',
                  padding: '14px',
                  borderRadius: 999,
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '1rem',
                  boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  See post
                </a>
              )}
            </>
          ) : (
            // Private user buttons (original functionality)
            <>
              {url && (
                <a href={url} target="_blank" rel="noopener noreferrer" style={{
                  flex: 1,
                  background: 'linear-gradient(90deg, #3E29F0 0%, #a445ff 100%)',
                  color: 'white',
                  padding: '14px',
                  borderRadius: 999,
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '1rem',
                  boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  See post
                </a>
              )}
              {/* Only show Tickets button if event has proper ticket configuration */}
              {((event?.ticketConfiguration?.pricingTiers?.length > 0 && event?.ticketConfiguration?.pricingTiers?.some(tier => parseInt(tier.quantity) > 0)) || event?.ticketType === 'Free ticket') && event?.ticketConfiguration && (
              <button 
                      onClick={() => {
                        console.log('🎫 Opening ticket modal for event:', event);
                        console.log('🎫 Event ticket configuration:', event?.ticketConfiguration);
                        console.log('🎫 Event pricing tiers:', event?.ticketConfiguration?.pricingTiers);
                        console.log('🎫 Current cached event data:', sessionStorage.getItem(`event_${id}`));
                        if (!event?.ticketConfiguration) {
                          alert('This event does not have ticket information available.');
                          return;
                        }
                        setShowTicketModal(true);
                      }}
                  style={{
                      flex: 1,
                      background: 'linear-gradient(90deg, #3E29F0 0%, #a445ff 100%)',
                      color: '#fff',
                      padding: '14px',
                      borderRadius: 999,
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '1rem',
                      boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004',
                      cursor: 'pointer'
                  }}
              >
                  Tickets
              </button>
              )}
            </>
          )}
        </div>
            </div>

      {/* Ticket Purchase Modal */}
      {showTicketModal && event && (
        <>
          {console.log('🚨 TICKET MODAL IS OPEN!')}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#1e293b',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '400px',
            width: '100%',
            color: '#fff'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Buy Tickets</h3>
              <button 
                onClick={() => {
                  console.log('🎫 Closing ticket modal');
                  console.log('🎫 Event state before closing modal:', event);
                  console.log('🎫 Cached event data before closing modal:', sessionStorage.getItem(`event_${id}`));
                  setShowTicketModal(false);
                  console.log('🎫 Modal closed, checking event state after...');
                  // Force a check of the event state after modal closes
                  setTimeout(() => {
                    console.log('🎫 Event state after modal close:', event);
                    console.log('🎫 Cached event data after modal close:', sessionStorage.getItem(`event_${id}`));
                  }, 100);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#a445ff', marginBottom: '8px' }}>Event: {eventTitle}</h4>
              <p style={{ color: '#cbd5e1', fontSize: '14px' }}>{dateText}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {console.log('🎫 New ticket system rendering:', {
                eventId: event?.id,
                hasTicketConfig: !!event?.ticketConfiguration,
                pricingTiersCount: event?.ticketConfiguration?.pricingTiers?.length || 0
              })}
              
              {/* ALWAYS use new ticket system - never fall back to old */}
              {event?.ticketConfiguration?.pricingTiers ? (
                // Show dynamic pricing tiers from ticket configuration
                event.ticketConfiguration.pricingTiers.map((tier, index) => {
                  const availableQuantity = parseInt(tier.quantity) || 0;
                  const maxPerPerson = parseInt(event.ticketConfiguration.maxTicketsPerPerson) || 1;
                  const isSoldOut = availableQuantity <= 0;
                  
                  return (
              <button
                      key={index}
                      onClick={() => handleBuyTicket(parseFloat(tier.price), index)}
                      disabled={purchasingTicket || !tier.price || parseFloat(tier.price) <= 0 || isSoldOut}
                style={{
                        background: index === 0 
                          ? 'linear-gradient(90deg, #3E29F0 0%, #a445ff 100%)'
                          : 'linear-gradient(90deg, #F941F9 0%, #a445ff 100%)',
                  color: '#fff',
                  padding: '16px',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '16px',
                        cursor: (purchasingTicket || !tier.price || parseFloat(tier.price) <= 0 || isSoldOut) ? 'not-allowed' : 'pointer',
                        opacity: (purchasingTicket || !tier.price || parseFloat(tier.price) <= 0 || isSoldOut) ? 0.7 : 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                      <div style={{ textAlign: 'left' }}>
                        <div>{tier.name}</div>
                        {tier.description && (
                          <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>
                            {tier.description}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div>{tier.price ? `${tier.price} DKK` : 'Free'}</div>
                        <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>
                          {isSoldOut ? 'Sold Out' : `${availableQuantity} available`}
                          {maxPerPerson > 1 && ` (max ${maxPerPerson} per person)`}
                        </div>
                      </div>
              </button>
                  );
                })
              ) : event?.ticketType === 'Free ticket' ? (
                // Show free ticket option
              <button
                  onClick={() => handleBuyTicket(0)}
                disabled={purchasingTicket}
                style={{
                    background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  padding: '16px',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '16px',
                  cursor: purchasingTicket ? 'not-allowed' : 'pointer',
                  opacity: purchasingTicket ? 0.7 : 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                  <span>Free Ticket</span>
                  <span>Free</span>
              </button>
              ) : event?.ticketType === 'No ticket' ? (
                // Show no ticket available message
                <div style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#cbd5e1',
                  padding: '16px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  fontSize: '16px'
                }}>
                  No tickets required for this event
                </div>
              ) : (
                // FORCE: Never show old ticket system - always require new ticket configuration
                <div style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#fecaca',
                  border: '1px solid #ef4444',
                  padding: '16px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  fontSize: '16px'
                }}>
                  ⚠️ This event uses the OLD ticket system. Please recreate the event with the NEW ticket configuration system.
                  <br/><br/>
                  Event ID: {event?.id}
                  <br/>
                  Has Config: {!!event?.ticketConfiguration ? 'Yes' : 'No'}
                  <br/>
                  Ticket Type: {event?.ticketType}
                </div>
              )}
            </div>

            {purchasingTicket && (
              <div style={{ textAlign: 'center', marginTop: '16px', color: '#a445ff' }}>
                Creating checkout session...
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {/* Full-screen Media Viewer */}
      {fullscreenViewer && mediaItems.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.95)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column'
          }}
          onTouchStart={handleFullscreenTouchStart}
          onTouchMove={handleFullscreenTouchMove}
          onTouchEnd={handleFullscreenTouchEnd}
        >
          {/* Close button */}
          <button
            onClick={closeFullscreenViewer}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000
            }}
          >
            ✕
          </button>

          {/* Main media content */}
          {mediaItems[fullscreenImageIndex]?.type === 'video' ? (
            <div className="relative">
              <video
                src={mediaItems[fullscreenImageIndex]?.url}
                controls
                autoPlay
                loop
                playsInline
                muted={false}
                style={{
                  maxWidth: '90vw',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                  borderRadius: '8px'
                }}
                onError={() => {
                  console.log('❌ Full-screen video failed to load');
                }}
                onLoadedMetadata={(e) => {
                  console.log('✅ Full-screen video loaded with sound enabled');
                  // Try to play with sound, fallback to muted if blocked
                  const video = e.target;
                  video.play().catch(() => {
                    console.log('🔇 Autoplay blocked, starting muted');
                    video.muted = true;
                    video.play();
                  });
                }}
                onClick={(e) => {
                  // Allow user to unmute by clicking
                  const video = e.target;
                  if (video.muted) {
                    video.muted = false;
                    console.log('🔊 Video unmuted by user click');
                  }
                }}
              />
              {/* Video indicator in fullscreen */}
              <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                VIDEO
              </div>
              
              {/* Sound indicator */}
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              onClick={(e) => {
                e.stopPropagation();
                const video = e.target.closest('.relative').querySelector('video');
                if (video) {
                  video.muted = !video.muted;
                  console.log(video.muted ? '🔇 Video muted' : '🔊 Video unmuted');
                }
              }}>
                🔊 Click for sound
              </div>
            </div>
          ) : (
            <img
              src={mediaItems[fullscreenImageIndex]?.url || imageUrls[fullscreenImageIndex]}
              alt={`Event media ${fullscreenImageIndex + 1}`}
              style={{
                maxWidth: '90vw',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: '8px'
              }}
            />
          )}

          {/* Media counter */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'white',
            fontSize: '16px',
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '8px 16px',
            borderRadius: '20px'
          }}>
            {fullscreenImageIndex + 1} / {mediaItems.length}
          </div>

          {/* Navigation arrows - only show if multiple media items */}
          {mediaItems.length > 1 && (
            <>
              {/* Left arrow */}
              <button
                onClick={prevImage}
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '60px',
                  height: '60px',
                  fontSize: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10000
                }}
              >
                ‹
              </button>

              {/* Right arrow */}
              <button
                onClick={nextImage}
                style={{
                  position: 'absolute',
                  right: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '60px',
                  height: '60px',
                  fontSize: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10000
                }}
              >
                ›
              </button>
            </>
          )}

          {/* Media indicators */}
          {mediaItems.length > 1 && (
            <div style={{
              position: 'absolute',
              bottom: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '12px',
              zIndex: 10000
            }}>
              {mediaItems.map((mediaItem, index) => (
                <button
                  key={index}
                  onClick={() => setFullscreenImageIndex(index)}
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: mediaItem.type === 'video' ? '20%' : '50%',
                    border: 'none',
                    background: index === fullscreenImageIndex ? 'white' : 'rgba(255, 255, 255, 0.4)',
                    cursor: 'pointer',
                    transition: 'background 0.3s ease'
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1f2937',
            borderRadius: '16px',
            padding: '24px',
            margin: '16px',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h3 style={{ color: 'white', marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>
              Delete Event
            </h3>
            <p style={{ color: '#d1d5db', marginBottom: '24px', lineHeight: '1.5' }}>
              Are you sure you want to delete this event? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #6b7280',
                  backgroundColor: 'transparent',
                  color: '#d1d5db',
                  fontWeight: 500,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEvent}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  fontWeight: 500,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.5 : 1
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conditional Bottom Navigation */}
      {isCompanyView ? <BottomNavCompany /> : <BottomNav />}
      

    </div>
  );
} 