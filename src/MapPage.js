import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import { filterOutDeletedEvents } from './utils/eventFilters';
import BottomNav from './BottomNav';
import { useNavigate } from 'react-router-dom';

// Function to get WebP images with fallback (improved version)
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

function MapPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [showThreeDotsMenu, setShowThreeDotsMenu] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('All');

  // Load events from Firestore
  useEffect(() => {
    async function fetchEvents() {
      try {
        console.log('Fetching events from Firestore...');
        const snap = await getDocs(collection(db, "Instagram_posts"));
        let allEvents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        console.log('Total events fetched:', allEvents.length);

        // Filter out deleted events
        allEvents = await filterOutDeletedEvents(allEvents);
        console.log('Events after filtering deleted:', allEvents.length);

        // Show all events (including past events)
        console.log('Events after filtering deleted:', allEvents.length);
        setEvents(allEvents);
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
        },
        (error) => {
          console.error('Error getting location:', error);
          // Default to Copenhagen if location access denied
          setUserLocation({ lat: 55.6761, lng: 12.5683 });
        }
      );
    } else {
      // Default to Copenhagen if geolocation not supported
      setUserLocation({ lat: 55.6761, lng: 12.5683 });
    }
  }, []);

  // Monitor map element rendering
  useEffect(() => {
    if (loading) return;
    
    const checkMapElement = () => {
      const mapElement = document.getElementById('map');
      console.log('Map element check - loading:', loading, 'element exists:', !!mapElement);
      if (mapElement) {
        console.log('Map element dimensions:', mapElement.offsetWidth, 'x', mapElement.offsetHeight);
      }
    };

    // Check immediately
    checkMapElement();
    
    // Check again after a short delay
    const timer = setTimeout(checkMapElement, 500);
    
    return () => clearTimeout(timer);
  }, [loading]);

  // Close three dots menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showThreeDotsMenu && !event.target.closest('[data-three-dots-menu]')) {
        setShowThreeDotsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showThreeDotsMenu]);

  // Initialize Google Maps
  useEffect(() => {
    if (!userLocation) return;

    // Check if Google Maps is loaded
    if (window.google && window.google.maps) {
      console.log('Google Maps already loaded, initializing map...');
      initializeMap();
    } else {
      console.log('Loading Google Maps script...');
      // Load Google Maps script
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBlQaboaqL4N1e2_ZrHphHySRtpOkksm30&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('Google Maps script loaded successfully');
        initializeMap();
      };
      script.onerror = (error) => {
        console.error('Error loading Google Maps script:', error);
      };
      document.head.appendChild(script);
    }
  }, [userLocation]);

  // Re-add event markers when events change
  useEffect(() => {
    if (map && events.length > 0) {
      console.log('Events updated, re-adding markers. Events count:', events.length);
      addEventMarkers(map);
    }
  }, [events, map]);

  // Add global navigation function for info window buttons
  useEffect(() => {
    window.navigateToEvent = (eventId) => {
      navigate(`/event/${eventId}`);
    };

    return () => {
      delete window.navigateToEvent;
    };
  }, [navigate]);

  const initializeMap = () => {
    console.log('initializeMap called, userLocation:', userLocation);
    if (!userLocation) {
      console.log('No user location, cannot initialize map');
      return;
    }

    const mapElement = document.getElementById('map');
    console.log('Map element found:', mapElement);
    if (!mapElement) {
      console.log('Map element not found, retrying in 100ms...');
      setTimeout(initializeMap, 100);
      return;
    }

    try {
      console.log('Creating Google Map...');
      const newMap = new window.google.maps.Map(mapElement, {
        center: userLocation,
        zoom: 12,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      console.log('Map created successfully:', newMap);
      setMap(newMap);

      // Add user location marker
      new window.google.maps.Marker({
        position: userLocation,
        map: newMap,
        title: 'Your Location',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      // Add event markers
      addEventMarkers(newMap);
    } catch (error) {
      console.error('Error creating map:', error);
    }
  };

  const addEventMarkers = (mapInstance) => {
    console.log('Adding event markers, events count:', events.length);
    const newMarkers = [];
    
    // Create a single info window instance that will be reused
    const infoWindow = new window.google.maps.InfoWindow();

    events.forEach((event, index) => {
      console.log(`Processing event ${index + 1}:`, event.title || event.caption || 'No title');
      
      const eventLocation = getEventLocation(event);
      console.log(`Event ${index + 1} location:`, eventLocation);
      
      if (!eventLocation) {
        console.log(`Event ${index + 1} has no valid location, skipping`);
        return;
      }

             try {
         const marker = new window.google.maps.Marker({
           position: eventLocation,
           map: mapInstance,
           title: event.title || event.caption || 'Event',
           icon: {
             url: getWebPImageUrl(event),
             scaledSize: new window.google.maps.Size(40, 40),
             origin: new window.google.maps.Point(0, 0),
             anchor: new window.google.maps.Point(20, 20)
           }
         });

        console.log(`Marker created for event ${index + 1} at:`, eventLocation);

                 marker.addListener('click', () => {
           // Close any existing info window first
           infoWindow.close();
           
           // Create a container div for the info window content
           const infoContent = document.createElement('div');
           infoContent.style.padding = '16px';
           infoContent.style.maxWidth = '250px';
           
           // Create the image
           const img = document.createElement('img');
           img.src = getWebPImageUrl(event);
           img.style.cssText = 'width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;';
           
           // Create the title
           const title = document.createElement('h3');
           title.textContent = event.title || event.caption || 'Event Title';
           title.style.cssText = 'margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1f2937;';
           
           // Create the company name
           const companyName = document.createElement('p');
           companyName.textContent = `@${event.companyName || event.fullname || event.venue || event.club || event.username || 'Unknown'}`;
           companyName.style.cssText = 'margin: 0 0 8px 0; font-size: 14px; color: #6b7280;';
           
           // Create the date
           const date = document.createElement('p');
           date.textContent = getEventDate(event) ? getEventDate(event).toLocaleDateString('en-GB', { 
             weekday: 'long', 
             year: 'numeric', 
             month: 'long', 
             day: 'numeric' 
           }) : 'Date TBA';
           date.style.cssText = 'margin: 0; font-size: 12px; color: #9ca3af;';
           
           // Create the button
           const button = document.createElement('button');
           button.textContent = 'View Event Details';
           button.style.cssText = `
             width: 100%;
             padding: 12px 16px;
             background: linear-gradient(90deg, #F941F9 0%, #3E29F0 100%);
             color: white;
             border: none;
             border-radius: 8px;
             cursor: pointer;
             font-size: 14px;
             font-weight: 600;
             margin-top: 16px;
             box-shadow: 0 4px 12px rgba(249, 65, 249, 0.3);
             transition: all 0.2s ease;
           `;
           
           // Add hover effect
           button.addEventListener('mouseenter', () => {
             button.style.transform = 'translateY(-2px)';
             button.style.boxShadow = '0 6px 16px rgba(249, 65, 249, 0.4)';
           });
           
           button.addEventListener('mouseleave', () => {
             button.style.transform = 'translateY(0)';
             button.style.boxShadow = '0 4px 12px rgba(249, 65, 249, 0.3)';
           });
           
           // Add click handler to navigate to event
           button.addEventListener('click', () => {
             navigate(`/event/${event.id}?from=map`);
           });
           
           // Append all elements to the container
           infoContent.appendChild(img);
           infoContent.appendChild(title);
           infoContent.appendChild(companyName);
           infoContent.appendChild(date);
           infoContent.appendChild(button);
           
           // Set the content and open the info window
           infoWindow.setContent(infoContent);
           infoWindow.open(mapInstance, marker);
         });

        newMarkers.push(marker);
      } catch (error) {
        console.error(`Error creating marker for event ${index + 1}:`, error);
      }
    });

    console.log(`Total markers created: ${newMarkers.length}`);
    setMarkers(newMarkers);
  };

  // Helper function to get event date
  const getEventDate = (event) => {
    if (event.eventDate) {
      return new Date(event.eventDate.seconds * 1000);
    }
    if (event.eventDateEnd) {
      return new Date(event.eventDateEnd.seconds * 1000);
    }
    if (event.timestamp) {
      return new Date(event.timestamp.seconds * 1000);
    }
    if (event.createdAt) {
      return new Date(event.createdAt.seconds * 1000);
    }
    return null;
  };

  // Helper function to get event location (simplified - you can enhance this)
  const getEventLocation = (event) => {
    // For now, return a default location near Copenhagen
    // In a real app, you'd store actual coordinates for each event
    const lat = 55.6761 + (Math.random() - 0.5) * 0.1;
    const lng = 12.5683 + (Math.random() - 0.5) * 0.1;
    
    // Ensure coordinates are valid
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      console.error('Invalid coordinates generated:', { lat, lng });
      return null;
    }
    
    return { lat, lng };
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(180deg, hsl(230, 45%, 9%), hsl(280, 50%, 20%))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>Loading Map...</div>
          <div style={{ fontSize: 16, opacity: 0.7 }}>Please wait while we load your events</div>
        </div>
      </div>
    );
  }

  return (
    <>
             <div style={{ 
         minHeight: '100vh', 
         background: 'linear-gradient(180deg, hsl(230, 45%, 9%), hsl(280, 50%, 20%))',
         display: 'flex',
         flexDirection: 'column'
       }}>
                          {/* Header */}
                                       <div style={{ 
             padding: '18px', 
             width: '100vw',
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'space-between',
             background: '#1f2937',
             margin: '0 -18px',
             paddingLeft: '36px',
             paddingRight: '18px',
             position: 'relative',
             left: '50%',
             right: '50%',
             marginLeft: '-50vw',
             marginRight: '-50vw'
           }}>
                                                 {/* Search Bar */}
                                                                                                                                                                                                                  <div style={{ 
                    width: '1000px',
                    position: 'relative',
                    marginLeft: '-20px'
                  }}>
                                                               <div style={{
                   position: 'relative',
                   width: '100%'
                 }}>
                   <input
                     type="text"
                     placeholder="Search here..."
                     style={{
                       width: '100%',
                       padding: '12px 16px 12px 40px',
                       borderRadius: '8px',
                       border: '1px solid #d1d5db',
                       background: '#ffffff',
                       color: '#374151',
                       fontSize: '16px',
                       outline: 'none',
                       boxShadow: 'none'
                     }}
                   />
                   <div style={{
                     position: 'absolute',
                     left: '12px',
                     top: '50%',
                     transform: 'translateY(-50%)',
                     color: '#6b7280',
                     fontSize: '16px',
                     fontWeight: '300'
                   }}>
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                       <circle cx="11" cy="11" r="8"/>
                       <path d="m21 21-4.35-4.35"/>
                     </svg>
                   </div>
                 </div>
             </div>
             
                                                     {/* Three Dots Menu */}
               <div style={{ position: 'relative', marginLeft: '20px' }} data-three-dots-menu>
              <button
                onClick={() => setShowThreeDotsMenu(!showThreeDotsMenu)}
                style={{
                  background: '#374151',
                  border: '2px solid #4B5563',
                  color: '#F9FAFB',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                ⋯
              </button>
             
             {/* Dropdown Menu */}
             {showThreeDotsMenu && (
               <div style={{
                 position: 'absolute',
                 top: '100%',
                 right: 0,
                 background: '#374151',
                 borderRadius: '8px',
                 padding: '8px 0',
                 minWidth: '120px',
                 boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                 zIndex: 1000
               }}>
                 {['All', 'Clubs', 'Bars'].map((option) => (
                   <button
                     key={option}
                     onClick={() => {
                       setSelectedFilter(option);
                       setShowThreeDotsMenu(false);
                     }}
                     style={{
                       width: '100%',
                       padding: '12px 16px',
                       background: 'none',
                       border: 'none',
                       color: selectedFilter === option ? '#60A5FA' : '#F9FAFB',
                       textAlign: 'left',
                       cursor: 'pointer',
                       fontSize: '14px',
                       fontWeight: selectedFilter === option ? '600' : '400'
                     }}
                   >
                     {option}
                   </button>
                 ))}
               </div>
             )}
           </div>
         </div>

                                                                                                                                               {/* Map Container */}
            <div style={{ 
              width: '100%',
              flex: 1,
              display: 'flex',
              flexDirection: 'column'
            }}>
                                                 <div 
                id="map" 
                style={{ 
                  width: '100%', 
                  height: '100%',
                  flex: 1,
                  overflow: 'hidden',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                }}
              />
          </div>
      </div>
      <BottomNav />
    </>
  );
}

export default MapPage;
