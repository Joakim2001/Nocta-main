import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "./firebase";
import { doc, getDoc, deleteDoc, collection, addDoc, getDocs, setDoc } from "firebase/firestore";
import { storage } from './firebase';
import { ref, getDownloadURL } from "firebase/storage";
import { getAuth } from 'firebase/auth';
import BottomNavCompany from './BottomNavCompany';

export default function EventDetailPageDeletedCompany() {
  const [republishing, setRepublishing] = useState(false);
  const [showRepublishModal, setShowRepublishModal] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Debug: Monitor imageUrls state changes
  useEffect(() => {
    console.log('🖼️ EventDetailPageDeletedCompany - imageUrls state changed:', imageUrls);
  }, [imageUrls]);
  
  // Debug logging
  console.log('🔍 EventDetailPageDeletedCompany - Component loaded');
  console.log('🔍 EventDetailPageDeletedCompany - ID from params:', id);
  console.log('🔍 EventDetailPageDeletedCompany - Current URL:', window.location.href);
  console.log('🔍 EventDetailPageDeletedCompany - Event state:', event);
  console.log('🔍 EventDetailPageDeletedCompany - Loading state:', loading);

  useEffect(() => {
    async function fetchEvent() {
      try {
        console.log('🔍 Fetching deleted event with ID:', id);
        
        // Check if user is authenticated
        const auth = getAuth();
        const user = auth.currentUser;
        console.log('🔍 Current user:', user);
        
        if (!user) {
          console.log('🔍 No user authenticated, redirecting to login');
          navigate('/company-login');
          return;
        }
        
        // First try to find by document ID (in case it was stored with original ID)
        const docRef = doc(db, "deleted_posts", id);
        const docSnap = await getDoc(docRef);
        
        console.log('🔍 Document exists by direct ID:', docSnap.exists());
        
        if (docSnap.exists()) {
          const eventData = { id: docSnap.id, ...docSnap.data() };
          console.log('🔍 Found event data by direct ID:', eventData);
          setEvent(eventData);

          // Load all available images (Image0 to Image9) - filter and sort
          const imageFields = [
            eventData.Image0, eventData.Image1, eventData.Image2, eventData.Image3, eventData.Image4,
            eventData.Image5, eventData.Image6, eventData.Image7, eventData.Image8, eventData.Image9
          ];
          
          // Filter images: match event ID (without "A") with file ID (without "_imageX")
          const eventIdWithoutA = eventData.id.replace(/^A/, '');
          const validImageFields = imageFields
            .map((field, index) => ({ field, index }))
            .filter(({ field }) => field && 
              (field.startsWith('http') || field))
            .filter(({ field }) => {
              // For Firebase Storage paths, check if they match the event ID
              if (field && !field.startsWith('http')) {
                // Remove "events/" prefix and "_ImageX" suffix to get the file ID
                const fileId = field
                  .replace(/^events\//, '') // Remove "events/" prefix
                  .replace(/_Image\d+\.jpg$/, ''); // Remove "_ImageX.jpg" suffix (uppercase I)
                
                const matchesEventId = fileId === eventIdWithoutA;
                return matchesEventId;
              }
              return true; // Keep HTTP URLs
            })
            .map(({ field, index }) => {
              // Convert paths to match actual file structure
              if (field && !field.startsWith('http')) {
                // Remove "events/" prefix and convert Image to image (lowercase)
                const correctedPath = field
                  .replace(/^events\//, '') // Remove "events/" prefix
                  .replace(/_Image(\d+)\.jpg$/, '_image$1.jpg'); // Convert Image to image
                return { field: correctedPath, index };
              }
              return { field, index };
            })
            .sort((a, b) => a.index - b.index); // Sort by index (lowest number first)
          
          if (validImageFields.length > 0) {
            const urls = [];
            for (const { field: imagePath } of validImageFields) {
              if (imagePath.startsWith('http')) {
                // Filter out expired Instagram CDN URLs
                const isExpiredInstagram = imagePath.includes('instagram.fjdo1-1.fna.fbcdn.net') || 
                                         imagePath.includes('instagram.fjdo1-2.fna.fbcdn.net') ||
                                         imagePath.includes('cdninstagram.com');
                
                if (isExpiredInstagram) {
                  console.log('⚠️ EventDetailPageDeletedCompany - Skipping expired Instagram CDN URL in Path 1:', imagePath.substring(0, 50) + '...');
                  continue; // Skip this URL
                }
                
                console.log('✅ EventDetailPageDeletedCompany - Valid HTTP URL in Path 1:', imagePath.substring(0, 50) + '...');
                urls.push(imagePath);
              } else {
                try {
                  const url = await getDownloadURL(ref(storage, imagePath));
                  urls.push(url);
                } catch (e) {
                  console.error("Error getting download URL:", e);
                  // Skip this image if it fails to load
                }
              }
            }
            
            console.log('🖼️ EventDetailPageDeletedCompany - Path 1: Final URLs after filtering:', urls);
            
            if (urls.length > 0) {
              console.log('✅ EventDetailPageDeletedCompany - Path 1: Found valid URLs, using them');
              setImageUrls(urls);
            } else {
              console.log('⚠️ EventDetailPageDeletedCompany - Path 1: No valid URLs, proceeding to loadEventImage for WebP fallback');
              // Don't set default image yet - let loadEventImage check for WebP images first
            }
          } else {
            console.log('⚠️ EventDetailPageDeletedCompany - Path 1: No valid image fields, proceeding to loadEventImage for WebP fallback');
            // Don't set default image yet - let loadEventImage check for WebP images first
          }
          
          // After Path 1 completes, always call loadEventImage to check for WebP images
          console.log('🔄 EventDetailPageDeletedCompany - Path 1 completed, calling loadEventImage for WebP fallback');
          await loadEventImage(eventData);
        } else {
          console.log('🔍 No document found with direct ID, searching by originalId...');
          
          // If not found, search by originalId field
          const allDeletedSnapshot = await getDocs(collection(db, 'deleted_posts'));
          console.log('🔍 Searching through', allDeletedSnapshot.docs.length, 'deleted events...');
          
          let foundEvent = null;
          allDeletedSnapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log('🔍 Checking event:', {
              docId: doc.id,
              originalId: data.originalId,
              id: data.id,
              title: data.title,
              lookingFor: id
            });
            
            // Check if originalId matches OR if the stored id field matches
            if (data.originalId === id || data.id === id) {
              foundEvent = { id: doc.id, ...data };
              console.log('🔍 FOUND MATCH:', foundEvent);
            }
          });
          
          if (foundEvent) {
            setEvent(foundEvent);
            await loadEventImage(foundEvent);
          } else {
            console.log('🔍 No event found with originalId or id matching:', id);
            setEvent(null);
          }
        }
      } catch (err) {
        console.error("Error fetching event:", err);
        setEvent(null);
      } finally {
        setLoading(false);
      }
    }

    // Helper function to load event image
    async function loadEventImage(eventData) {
      console.log('🖼️ EventDetailPageDeletedCompany - === LOAD EVENT IMAGE CALLED ===');
      console.log('🖼️ EventDetailPageDeletedCompany - Loading images for event:', eventData.id);
      console.log('🖼️ EventDetailPageDeletedCompany - Event data keys:', Object.keys(eventData));
      
      // Log ALL image-related fields to find the working images
      console.log('🔍 EventDetailPageDeletedCompany - === COMPREHENSIVE IMAGE FIELD ANALYSIS ===');
      const allImageFields = Object.keys(eventData).filter(key => 
        key.toLowerCase().includes('image') || 
        key.toLowerCase().includes('display') || 
        key.toLowerCase().includes('url') ||
        key.toLowerCase().includes('webp')
      );
      
      console.log('🔍 EventDetailPageDeletedCompany - All image-related fields:', allImageFields);
      
      // Log the actual content of each image field
      allImageFields.forEach(field => {
        const value = eventData[field];
        if (value) {
          // Only call string methods if the value is actually a string
          const isString = typeof value === 'string';
          console.log(`🔍 EventDetailPageDeletedCompany - ${field}:`, {
            type: typeof value,
            length: isString ? value.length : 'N/A',
            preview: isString ? value.substring(0, 100) + '...' : String(value),
            isHttp: isString && value.startsWith('http'),
            isDataUrl: isString && value.startsWith('data:'),
            isInstagram: isString && (value.includes('instagram.com') || value.includes('fbcdn.net')),
            isFirebase: isString && (value.includes('firebasestorage.googleapis.com') || value.includes('nocta_bucket'))
          });
        } else {
          console.log(`🔍 EventDetailPageDeletedCompany - ${field}: null/undefined`);
        }
      });
      
      // NEW APPROACH: Try to find ANY working image from ALL available fields
      console.log('🔄 EventDetailPageDeletedCompany - === TRYING TO FIND ANY WORKING IMAGE ===');
      
      // Create a comprehensive list of ALL possible image sources, prioritized by likelihood of working
      const allPossibleImages = [
        // Priority 1: Direct image URLs that might still work
        eventData.imageUrls,
        eventData.images_original,
        eventData.images_storedInStorage,
        
        // Priority 2: Individual image fields
        eventData.Image1, eventData.Image0, eventData.Image2, eventData.Image3, 
        eventData.Image4, eventData.Image5, eventData.Image6, eventData.Image7,
        eventData.Displayurl,
        
        // Priority 3: WebP versions (but skip if they're just defaults)
        eventData.WebPImage1, eventData.WebPImage0, eventData.WebPImage2, eventData.WebPImage3,
        eventData.WebPImage4, eventData.WebPImage5, eventData.WebPImage6, eventData.WebPDisplayurl,
        
        // Priority 4: Any other image-related fields
        eventData.url, eventData.inputurl
      ].filter(Boolean); // Remove null/undefined values
      
      console.log('🔄 EventDetailPageDeletedCompany - All possible image sources:', allPossibleImages.length);
      
      // Try to find ALL working images by testing each source
      const workingImages = [];
      
      for (const imageSource of allPossibleImages) {
        if (!imageSource) continue;
        
        // Handle arrays (like imageUrls)
        const imagesToTest = Array.isArray(imageSource) ? imageSource : [imageSource];
        
        for (const image of imagesToTest) {
          if (!image || typeof image !== 'string') continue;
          
          console.log('🔄 EventDetailPageDeletedCompany - Testing image source:', {
            source: imageSource === eventData.imageUrls ? 'imageUrls' : 
                   imageSource === eventData.images_original ? 'images_original' :
                   imageSource === eventData.images_storedInStorage ? 'images_storedInStorage' :
                   typeof imageSource === 'string' ? 'individual_field' : 'unknown',
            image: image.substring(0, 100) + '...',
            type: image.startsWith('data:') ? 'data_url' : 
                  image.startsWith('http') ? 'http_url' : 'storage_path'
          });
          
          // Test if this image is accessible
          try {
            if (image.startsWith('data:')) {
              // Data URLs are always accessible
              console.log('✅ EventDetailPageDeletedCompany - Data URL found and accessible');
              workingImages.push(image);
            } else if (image.startsWith('http')) {
              // Test HTTP URLs
              const response = await fetch(image, { method: 'HEAD' });
              if (response.ok) {
                console.log('✅ EventDetailPageDeletedCompany - HTTP URL is accessible:', response.status);
                workingImages.push(image);
              } else {
                console.log('⚠️ EventDetailPageDeletedCompany - HTTP URL failed:', response.status);
              }
            } else {
              // Try storage paths
              try {
                const url = await getDownloadURL(ref(storage, image));
                console.log('✅ EventDetailPageDeletedCompany - Storage path is accessible');
                workingImages.push(url);
              } catch (e) {
                console.log('⚠️ EventDetailPageDeletedCompany - Storage path failed:', e.message);
              }
            }
          } catch (error) {
            console.log('⚠️ EventDetailPageDeletedCompany - Error testing image:', error.message);
          }
        }
      }
      
      if (workingImages.length > 0) {
        console.log('✅ EventDetailPageDeletedCompany - Found', workingImages.length, 'working images:', workingImages);
        setImageUrls(workingImages);
        return;
      }
      
      console.log('❌ EventDetailPageDeletedCompany - No working images found, will use default');
      
      // Check company-created event images first, but filter out expired Instagram CDN URLs
      if (eventData.imageUrls && Array.isArray(eventData.imageUrls) && eventData.imageUrls.length > 0) {
        console.log('🖼️ EventDetailPageDeletedCompany - Found company event imageUrls:', eventData.imageUrls);
        
        // Filter out expired Instagram CDN URLs
        console.log('🖼️ EventDetailPageDeletedCompany - Starting filter process for', eventData.imageUrls.length, 'URLs');
        
        const validImageUrls = eventData.imageUrls.filter(url => {
          const isExpiredInstagram = url.includes('instagram.fjdo1-1.fna.fbcdn.net') || 
                                   url.includes('instagram.fjdo1-2.fna.fbcdn.net') ||
                                   url.includes('cdninstagram.com');
          
          console.log('🖼️ EventDetailPageDeletedCompany - Processing URL:', url.substring(0, 50) + '...', 'isExpiredInstagram:', isExpiredInstagram);
          
          if (isExpiredInstagram) {
            console.log('⚠️ EventDetailPageDeletedCompany - Skipping expired Instagram CDN URL:', url.substring(0, 50) + '...');
            return false;
          }
          
          console.log('✅ EventDetailPageDeletedCompany - Valid image URL found:', url.substring(0, 50) + '...');
          return true;
        });
        
        console.log('🖼️ EventDetailPageDeletedCompany - After filtering, validImageUrls length:', validImageUrls.length);
        console.log('🖼️ EventDetailPageDeletedCompany - After filtering, validImageUrls:', validImageUrls);
        
        if (validImageUrls.length > 0) {
          console.log('✅ EventDetailPageDeletedCompany - Using valid company event imageUrls:', validImageUrls);
          setImageUrls(validImageUrls);
          return;
        } else {
          console.log('⚠️ EventDetailPageDeletedCompany - All company imageUrls are expired, falling back to WebP images');
        }
      } else {
        console.log('🖼️ EventDetailPageDeletedCompany - No company event imageUrls found, proceeding to WebP images');
      }
    
      // Prioritize WebP images first
      let imagePath = null;
      
      // Check for WebP images in order of preference
      console.log('🖼️ EventDetailPageDeletedCompany - Raw eventData keys for WebP:', Object.keys(eventData).filter(key => key.toLowerCase().includes('webp')));
      
      const webPFields = [
        eventData.WebPImage1, eventData.WebPImage0, eventData.WebPImage2, eventData.WebPImage3, 
        eventData.WebPImage4, eventData.WebPImage5, eventData.WebPImage6, eventData.WebPDisplayurl
      ];
      
      console.log('🖼️ EventDetailPageDeletedCompany - Checking WebP fields:', webPFields.map(field => field ? field.substring(0, 50) + '...' : 'null'));
      
      for (const webPField of webPFields) {
        if (webPField && webPField !== null) {
          const isWebPDataUrl = webPField.startsWith('data:image/webp;base64,');
          const isWebPStorageUrl = webPField.includes('webp_') && (webPField.includes('firebasestorage.googleapis.com') || webPField.includes('nocta_bucket'));
          
          console.log('🖼️ EventDetailPageDeletedCompany - WebP field check:', {
            field: webPField ? webPField.substring(0, 50) + '...' : 'null',
            isWebPDataUrl,
            isWebPStorageUrl
          });
          
          if (isWebPDataUrl || isWebPStorageUrl) {
            // Check if this WebP image is actually a default placeholder
            const isDefaultWebP = webPField && webPField.includes('default-tyrolia') || 
                                 (webPField && webPField.length < 1000); // Very short base64 likely means default image
            
            if (isDefaultWebP) {
              console.log('⚠️ EventDetailPageDeletedCompany - WebP image appears to be default placeholder, skipping');
              continue; // Try next WebP field
            }
            
            console.log('✅ EventDetailPageDeletedCompany - Using valid WebP image');
            imagePath = webPField;
            break;
          }
        }
      }
      
      // If no WebP images found, try original images
      if (!imagePath) {
        console.log('🖼️ EventDetailPageDeletedCompany - No valid WebP images found, trying original images');
        const originalFields = [
          eventData.Image1, eventData.Image0, eventData.Image2, eventData.Image3, 
          eventData.Image4, eventData.Image5, eventData.Image6, eventData.Displayurl
        ];
        
        console.log('🖼️ EventDetailPageDeletedCompany - Original image fields:', originalFields.map(field => field ? field.substring(0, 50) + '...' : 'null'));
        
        for (const originalField of originalFields) {
          if (originalField) {
            // Check if this is an Instagram URL that might still work
            const isInstagramUrl = originalField.includes('instagram.com') || 
                                  originalField.includes('fbcdn.net') || 
                                  originalField.includes('cdninstagram.com');
            
            if (isInstagramUrl) {
              console.log('🖼️ EventDetailPageDeletedCompany - Found Instagram URL, will try to use it:', originalField.substring(0, 50) + '...');
              imagePath = originalField;
              break;
            } else if (originalField.startsWith('http')) {
              console.log('🖼️ EventDetailPageDeletedCompany - Found other HTTP URL:', originalField.substring(0, 50) + '...');
              imagePath = originalField;
              break;
            } else {
              console.log('🖼️ EventDetailPageDeletedCompany - Found storage path:', originalField);
              imagePath = originalField;
              break;
            }
          }
        }
      }
      
      if (imagePath) {
        console.log('🖼️ EventDetailPageDeletedCompany - Final image path:', imagePath.substring(0, 100) + '...');
        
        // If it's an Instagram URL, test if it's accessible before using it
        if (imagePath.includes('instagram.com') || imagePath.includes('fbcdn.net') || imagePath.includes('cdninstagram.com')) {
          console.log('🖼️ EventDetailPageDeletedCompany - Testing Instagram URL accessibility...');
          try {
            // Test the URL with a simple fetch to see if it's accessible
            const response = await fetch(imagePath, { method: 'HEAD' });
            if (response.ok) {
              console.log('✅ EventDetailPageDeletedCompany - Instagram URL is accessible, using it');
              setImageUrls([imagePath]);
            } else {
              console.log('⚠️ EventDetailPageDeletedCompany - Instagram URL returned status:', response.status, 'falling back to default');
              setImageUrls(['/default-tyrolia.jpg']);
            }
          } catch (error) {
            console.log('⚠️ EventDetailPageDeletedCompany - Instagram URL failed to load:', error.message, 'falling back to default');
            setImageUrls(['/default-tyrolia.jpg']);
          }
        } else if (imagePath.startsWith('data:') || imagePath.startsWith('http')) {
          console.log('✅ EventDetailPageDeletedCompany - Setting imageUrls to:', [imagePath]);
          setImageUrls([imagePath]); // Store as an array for carousel
        } else {
          try {
            const url = await getDownloadURL(ref(storage, imagePath));
            console.log('✅ EventDetailPageDeletedCompany - Setting imageUrls to:', [url]);
            setImageUrls([url]); // Store as an array for carousel
          } catch (e) {
            console.error("❌ EventDetailPageDeletedCompany - Error getting download URL:", e);
            console.log('✅ EventDetailPageDeletedCompany - Setting imageUrls to default');
            setImageUrls(['/default-tyrolia.jpg']); // Store as an array for carousel
          }
        }
      } else {
        console.log('❌ EventDetailPageDeletedCompany - No images found, using default');
        console.log('✅ EventDetailPageDeletedCompany - Setting imageUrls to default');
        setImageUrls(['/default-tyrolia.jpg']); // Store as an array for carousel
      }
    }
    
    fetchEvent();
  }, [id]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen text-white bg-slate-900">Loading...</div>;
  }
  if (!event) {
    return <div className="flex justify-center items-center min-h-screen text-white bg-slate-900">Event not found.</div>;
  }

  const { title, caption, location, url, username, fullname, description, eventDate, eventDateEnd, venue, club } = event;
  const eventTitle = title || caption?.substring(0, 50) + (caption?.length > 50 ? '...' : '') || 'Event';
  const instagramHandle = username || fullname || 'Unknown';
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

  // Check if event is outdated (in the past)
  const isOutdated = () => {
    const now = new Date();
    const dateToCheck = endDate || startDate;
    return dateToCheck && dateToCheck < now;
  };

  const handleRepublish = async () => {
    if (isOutdated()) {
      alert('Cannot republish outdated events. This event has already passed.');
      return;
    }

    setRepublishing(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      console.log('🔄 Republishing event with current user:', user.uid);
      console.log('🔄 Original event data:', event);
      
      // Create a copy of the event data without the deleted metadata
      const republishData = { 
        ...event,
        userId: user.uid, // Ensure current user's ID is set
        republishedAt: new Date(),
        republishedBy: user.uid
      };
      delete republishData.deletedAt;
      delete republishData.deletedBy;
      delete republishData.isDeleted;
      
      console.log('🔄 Republish data to be saved:', republishData);
      
      // Get the original event ID to preserve it
      const originalEventId = event.originalId || event.id;
      console.log('🔄 Using original event ID for republish:', originalEventId);
      
      // Add back to Instagram_posts collection with SAME ID
      await setDoc(doc(db, 'Instagram_posts', originalEventId), republishData);
      
      // Remove from deleted_posts collection
      await deleteDoc(doc(db, 'deleted_posts', event.id));
      
      alert('Event republished successfully!');
      navigate('/company-events');
    } catch (err) {
      alert('Failed to republish event: ' + err.message);
    } finally {
      setRepublishing(false);
      setShowRepublishModal(false);
    }
  };

  const handleUseTemplate = () => {
    try {
      console.log('📋 handleUseTemplate function started');
      
      if (!event) {
        console.log('📋 No event data available');
        return;
      }
      
      console.log('📋 handleUseTemplate called with event:', event);
      console.log('📋 Event fields available:', {
        title: event.title,
        caption: event.caption,
        description: event.description,
        location: event.location,
        venue: event.venue,
        ticketType: event.ticketType,
        ticketConfiguration: event.ticketConfiguration
      });
    
    // Prepare template data from the deleted event
    const templateData = {
      title: event.title || event.caption || '',
      description: event.description || event.caption || '',
      eventLocation: event.location || event.venue || '',
      // Copy all image fields
      imageUrls: imageUrls || [],
      // Copy ticket configuration if available
      ticketType: event.ticketType || 'No ticket',
      ticketConfiguration: event.ticketConfiguration || null,
      // Copy any other relevant fields
      originalEventId: event.id,
      isFromTemplate: true,
      // Copy additional event details
      eventDetails: {
        hasImages: imageUrls && imageUrls.length > 0,
        imageCount: imageUrls ? imageUrls.length : 0,
        originalEventTitle: event.title || event.caption || 'Previous Event'
      }
    };
    
    console.log('📋 Using event as template:', templateData);
    
    // Store in localStorage as backup
    localStorage.setItem('eventTemplateData', JSON.stringify(templateData));
    console.log('📋 Stored template data in localStorage');
    
    // Navigate to create event page with template data
    const navigationState = { 
      templateData,
      ticketOption: event.ticketType || 'No ticket',
      ticketConfiguration: event.ticketConfiguration || null
    };
    
    console.log('📋 Navigating with state:', navigationState);
    
    navigate('/company-create-event/new', { 
      state: navigationState
    });
    
    console.log('📋 Navigation called');
    } catch (error) {
      console.error('📋 ERROR in handleUseTemplate:', error);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#3b1a5c', color: '#fff', paddingBottom: 100 }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: '#3b1a5c',
        borderBottom: '1px solid #1e293b',
        maxWidth: 448,
        margin: '0 auto'
      }}>
        <span
          onClick={() => {
            // Check if we came from the main events page (with tabs)
            const activeTab = sessionStorage.getItem('activeTab');
            if (activeTab) {
              console.log('🔍 EventDetailDeletedCompany - Returning to tab:', activeTab);
              // Navigate back to the main page, the tab will be restored automatically
              navigate('/');
            } else {
              // Fallback to normal back navigation
              navigate(-1);
            }
          }}
          style={{ position: 'absolute', left: 28, top: 20, color: '#2046A6', fontSize: 32, fontWeight: 700, cursor: 'pointer', userSelect: 'none', lineHeight: 1 }}
        >
          {'‹'}
        </span>
        <div style={{
          background: 'rgba(220, 38, 38, 0.2)',
          color: '#fca5a5',
          padding: '8px 16px',
          borderRadius: 999,
          border: '1px solid rgba(220, 38, 38, 0.3)',
          fontWeight: 500,
          fontSize: '14px'
        }}>
          📚 Previous Event
        </div>
      </div>

      <div style={{ maxWidth: 448, margin: '0 auto', padding: '0 16px' }}>
        {/* Image Carousel */}
        <div 
          style={{ position: 'relative', height: '12rem', margin: '16px 0', borderRadius: 18, overflow: 'hidden', boxShadow: '0 6px 18px 2px #0008' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {console.log('🖼️ EventDetailPageDeletedCompany - Rendering imageUrls:', imageUrls, 'Length:', imageUrls?.length)}
          {imageUrls && imageUrls.length > 0 && (
            <>
              <img 
                src={imageUrls[currentImageIndex]} 
                alt={eventTitle} 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover', 
                  display: 'block',
                  transition: 'opacity 0.3s ease-in-out'
                }} 
              />
              
              {/* Navigation arrows - only show if multiple images */}
              {imageUrls.length > 1 && (
                <>
                  {/* Left arrow */}
                  <button
                    onClick={() => setCurrentImageIndex(prev => prev === 0 ? imageUrls.length - 1 : prev - 1)}
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
                    onClick={() => setCurrentImageIndex(prev => prev === imageUrls.length - 1 ? 0 : prev + 1)}
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
              
              {/* Image indicators - always show if multiple images */}
              {imageUrls.length > 1 && (
                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '8px',
                  zIndex: 10
                }}>
                  {imageUrls.map((_, index) => (
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
        <h1 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 600, margin: '24px 0' }}>
          {eventTitle}
        </h1>

        {/* Outdated Warning */}
        {isOutdated() && (
          <div style={{ 
            background: 'rgba(245, 101, 101, 0.1)', 
            border: '1px solid rgba(245, 101, 101, 0.3)', 
            borderRadius: 12, 
            padding: '12px 16px', 
            margin: '16px 0',
            textAlign: 'center'
          }}>
            <p style={{ color: '#fca5a5', fontSize: '14px', margin: 0 }}>
              ⚠️ This event has already passed and cannot be republished
            </p>
          </div>
        )}

        
        {/* Description Card */}
        {(description || (caption && caption.length > 50)) && (
                  <div style={{ background: '#fff', color: '#1f2937', borderRadius: 12, padding: '16px', margin: '16px 0', boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#6b21a8', marginBottom: '8px' }}>DESCRIPTION</h2>
          <p style={{ fontWeight: 600, color: '#1f2937', whiteSpace: 'pre-wrap' }}>{description || caption}</p>
          </div>
        )}
        
        {/* Date Card */}
        {dateText && (
                  <div style={{ background: '#fff', color: '#1f2937', borderRadius: 12, padding: '16px', margin: '16px 0', boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#6b21a8', marginBottom: '8px' }}>DATE</h2>
          <p style={{ fontWeight: 600, color: '#1f2937' }}>{dateText}</p>
          </div>
        )}
        
        {/* Location Card */}
        {locationText && (
                  <div style={{ background: '#fff', color: '#1f2937', borderRadius: 12, padding: '16px', margin: '16px 0', boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#6b21a8', marginBottom: '8px' }}>LOCATION</h2>
          {location ? (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationText)}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, textDecoration: 'underline', color: '#1d4ed8' }}>
              {locationText}
            </a>
          ) : (
            <p style={{ fontWeight: 600, color: '#1f2937' }}>{locationText}</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
            <button 
                onClick={() => setShowRepublishModal(true)}
                disabled={republishing || isOutdated()}
                style={{
                    flex: 1,
                    background: isOutdated() ? '#6b7280' : '#16a34a',
                    color: '#fff',
                    padding: '14px',
                    borderRadius: 999,
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '1rem',
                    boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004',
                    cursor: (republishing || isOutdated()) ? 'not-allowed' : 'pointer',
                    opacity: (republishing || isOutdated()) ? 0.6 : 1
                }}
            >
                {republishing ? 'Republishing...' : '🔄 Republish'}
            </button>
            
            <button 
                onClick={() => {
                    try {
                        console.log('📋 Use as Template button clicked!');
                        console.log('📋 Current event object:', event);
                        console.log('📋 Event ID:', event?.id);
                        console.log('📋 Event title:', event?.title);
                        console.log('📋 Event caption:', event?.caption);
                        console.log('📋 Image URLs available:', imageUrls);
                        
                        if (!event) {
                            console.error('📋 ERROR: Event object is null/undefined!');
                            return;
                        }
                        
                        console.log('📋 About to call handleUseTemplate...');
                        handleUseTemplate();
                        console.log('📋 handleUseTemplate called successfully');
                    } catch (error) {
                        console.error('📋 ERROR in button click handler:', error);
                    }
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
                📋 Use as Template
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
        </div>
      </div>

      {/* Republish Confirmation Modal */}
      {showRepublishModal && (
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
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Republish Event</h3>
              <button 
                onClick={() => setShowRepublishModal(false)}
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
              <p style={{ color: '#cbd5e1', fontSize: '16px' }}>Are you sure you want to republish this event?</p>
              <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '8px' }}>This will move the event back to active events and make it visible to users again.</p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowRepublishModal(false)}
                disabled={republishing}
                style={{
                  flex: 1,
                  background: '#64748b',
                  color: '#fff',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '16px',
                  cursor: republishing ? 'not-allowed' : 'pointer',
                  opacity: republishing ? 0.7 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRepublish}
                disabled={republishing}
                style={{
                  flex: 1,
                  background: '#16a34a',
                  color: '#fff',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '16px',
                  cursor: republishing ? 'not-allowed' : 'pointer',
                  opacity: republishing ? 0.7 : 1
                }}
              >
                {republishing ? 'Republishing...' : 'Republish'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNavCompany />
    </div>
  );
} 