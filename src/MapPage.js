import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import { filterOutDeletedEvents } from './utils/eventFilters';
import BottomNav from './BottomNav';
import { useNavigate } from 'react-router-dom';
import { CLUB_FESTIVAL_NAMES } from './club_festival_names';

/*
  MAP LOCATION SETUP - UPDATED v2:
  
  To display events at their correct locations on the map, each event needs coordinates.
  You can add coordinates to events in two ways:
  
  1. Add latitude/longitude fields directly to events in Firestore:
     - latitude: 55.6761 (number)
     - longitude: 12.5683 (number)
  
  2. Use Google Geocoding API to convert addresses to coordinates:
     - Add address, venue, or club fields to events
     - Use Google Geocoding service to convert to lat/lng
     - Store the coordinates in the event document
  
  Currently, events without coordinates will not appear on the map.
  Check the browser console for events with location data.
  
  UPDATED: Now uses same location logic as detailed event page: location || venue || club || fullname
*/

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

// Helper function to get event date
const getEventDate = (event) => {
  if (event.eventDate && typeof event.eventDate.toDate === 'function') {
    return event.eventDate.toDate();
  } else if (event.eventDate) {
    return new Date(event.eventDate);
  }
  return null;
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
  const [viewMode, setViewMode] = useState('events');
  const [isDarkMode, setIsDarkMode] = useState(false);

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

        // Log events with location data for debugging (using same logic as detailed event page)
        const eventsWithLocation = allEvents.filter(event => 
          event.latitude && event.longitude || event.location || event.venue || event.club || event.fullname || event.companyName || event.username
        );
        console.log(`Events with location data: ${eventsWithLocation.length}`);
        if (eventsWithLocation.length > 0) {
          console.log('Sample event with location:', eventsWithLocation[0]);
        }
        
        // Debug: Log the location fields for first few events
        console.log('=== LOCATION DEBUG INFO ===');
        allEvents.slice(0, 3).forEach((event, index) => {
          const locationText = event.location || event.venue || event.club || event.fullname || event.companyName || event.username;
          console.log(`Event ${index + 1}:`, {
            title: event.title || event.caption,
            location: event.location,
            venue: event.venue,
            club: event.club,
            fullname: event.fullname,
            companyName: event.companyName,
            username: event.username,
            locationText: locationText,
            hasCoordinates: !!(event.latitude && event.longitude)
          });
        });
        
        // All events will now appear on the map (with generated locations if needed)
        console.log(`Total events that will appear on map: ${allEvents.length}`);

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

  // Update map styles when dark mode changes
  useEffect(() => {
    if (map) {
      const newStyles = isDarkMode ? [
        // Dark mode styles
        { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
        {
          featureType: 'administrative.locality',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#d59563' }]
        },
        {
          featureType: 'poi',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#d59563' }]
        },
        {
          featureType: 'poi.park',
          elementType: 'geometry',
          stylers: [{ color: '#263c3f' }]
        },
        {
          featureType: 'poi.park',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#6b9a76' }]
        },
        {
          featureType: 'road',
          elementType: 'geometry',
          stylers: [{ color: '#38414e' }]
        },
        {
          featureType: 'road',
          elementType: 'geometry.stroke',
          stylers: [{ color: '#212a37' }]
        },
        {
          featureType: 'road',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#9ca5b3' }]
        },
        {
          featureType: 'road.highway',
          elementType: 'geometry',
          stylers: [{ color: '#746855' }]
        },
        {
          featureType: 'road.highway',
          elementType: 'geometry.stroke',
          stylers: [{ color: '#1f2835' }]
        },
        {
          featureType: 'road.highway',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#f3d19c' }]
        },
        {
          featureType: 'transit',
          elementType: 'geometry',
          stylers: [{ color: '#2f3948' }]
        },
        {
          featureType: 'transit.station',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#d59563' }]
        },
        {
          featureType: 'water',
          elementType: 'geometry',
          stylers: [{ color: '#17263c' }]
        },
        {
          featureType: 'water',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#515c6d' }]
        },
        {
          featureType: 'water',
          elementType: 'labels.text.stroke',
          stylers: [{ color: '#17263c' }]
        }
      ] : [
        // Light mode styles (default)
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ];
      
      map.setOptions({ styles: newStyles });
    }
  }, [isDarkMode, map]);

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
        styles: isDarkMode ? [
          // Dark mode styles
          { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
          {
            featureType: 'administrative.locality',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#d59563' }]
          },
          {
            featureType: 'poi',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#d59563' }]
          },
          {
            featureType: 'poi.park',
            elementType: 'geometry',
            stylers: [{ color: '#263c3f' }]
          },
          {
            featureType: 'poi.park',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#6b9a76' }]
          },
          {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ color: '#38414e' }]
          },
          {
            featureType: 'road',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#212a37' }]
          },
          {
            featureType: 'road',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#9ca5b3' }]
          },
          {
            featureType: 'road.highway',
            elementType: 'geometry',
            stylers: [{ color: '#746855' }]
          },
          {
            featureType: 'road.highway',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#1f2835' }]
          },
          {
            featureType: 'road.highway',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#f3d19c' }]
          },
          {
            featureType: 'transit',
            elementType: 'geometry',
            stylers: [{ color: '#2f3948' }]
          },
          {
            featureType: 'transit.station',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#d59563' }]
          },
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#17263c' }]
          },
          {
            featureType: 'water',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#515c6d' }]
          },
          {
            featureType: 'water',
            elementType: 'labels.text.stroke',
            stylers: [{ color: '#17263c' }]
          }
        ] : [
          // Light mode styles (default)
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

    // Group events by location to handle clustering
    const locationGroups = new Map();
    
    events.forEach((event, index) => {
      console.log(`Processing event ${index + 1}:`, event.title || event.caption || 'No title');
      
      const eventLocation = getEventLocation(event);
      console.log(`Event ${index + 1} location:`, eventLocation);
      
      if (!eventLocation) {
        console.log(`Event ${index + 1} has no valid location, skipping`);
        return;
      }

      // Create a location key for grouping (round to 4 decimal places for clustering)
      const locationKey = `${Math.round(eventLocation.lat * 10000) / 10000},${Math.round(eventLocation.lng * 10000) / 10000}`;
      
      if (!locationGroups.has(locationKey)) {
        locationGroups.set(locationKey, {
          position: eventLocation,
          events: [],
          count: 0
        });
      }
      
      locationGroups.get(locationKey).events.push(event);
      locationGroups.get(locationKey).count++;
    });

    console.log(`Location groups created: ${locationGroups.size}`);

    // Create markers for each location group
    locationGroups.forEach((group, locationKey) => {
      try {
        const { position, events: eventsAtLocation, count } = group;
        
        // Create custom marker icon
        const markerIcon = {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: count === 1 ? 8 : 12, // Larger dot for multiple events
          fillColor: '#F941F9', // Same pink/purple color as home page date boxes
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2
        };

        const marker = new window.google.maps.Marker({
          position: position,
          map: mapInstance,
          title: count === 1 ? eventsAtLocation[0].title || eventsAtLocation[0].caption || 'Event' : `${count} events at this location`,
          icon: markerIcon,
          label: count > 1 ? {
            text: count.toString(),
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 'bold'
          } : null
        });

        console.log(`Marker created for location ${locationKey} with ${count} events`);

        marker.addListener('click', () => {
          // Close any existing info window first
          infoWindow.close();
          
          if (count === 1) {
            // Single event - show detailed info window
            const event = eventsAtLocation[0];
            showSingleEventInfoWindow(event, infoWindow, mapInstance, marker);
          } else {
            // Multiple events - show summary info window
            showMultipleEventsInfoWindow(eventsAtLocation, infoWindow, mapInstance, marker);
          }
        });

        newMarkers.push(marker);
      } catch (error) {
        console.error(`Error creating marker for location ${locationKey}:`, error);
      }
    });

    console.log(`Total markers created: ${newMarkers.length}`);
    setMarkers(newMarkers);
  };

  // Helper function to show info window for single event
  const showSingleEventInfoWindow = (event, infoWindow, mapInstance, marker) => {
    const infoContent = document.createElement('div');
    infoContent.style.padding = '16px';
    infoContent.style.maxWidth = '250px';
    
    // Create the image
    const img = document.createElement('img');
    img.src = getWebPImageUrl(event);
    img.style.cssText = 'width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;';
    
    // Create the description box
    const descriptionBox = document.createElement('div');
    descriptionBox.style.cssText = `
      background: white;
      border: 2px solid #8B5CF6;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(139, 92, 246, 0.1);
    `;
    
    // Create the title (now inside description box)
    const title = document.createElement('h3');
    title.textContent = event.title || event.caption || 'Event Title';
    title.style.cssText = 'margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1f2937; text-align: center;';
    
    // Create the "DESCRIPTION" label
    const descriptionLabel = document.createElement('div');
    descriptionLabel.textContent = 'DESCRIPTION';
    descriptionLabel.style.cssText = 'margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #8B5CF6; text-align: center;';
    
    // Create the company name
    const companyName = document.createElement('p');
    companyName.textContent = `@${event.companyName || event.fullname || event.venue || event.club || event.username || 'Unknown'}`;
    companyName.style.cssText = 'margin: 0 0 8px 0; font-size: 14px; color: #6b7280; text-align: center;';
    
    // Create the date
    const date = document.createElement('p');
    date.textContent = getEventDate(event) ? getEventDate(event).toLocaleDateString('en-GB', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }) : 'Date TBA';
    date.style.cssText = 'margin: 0; font-size: 12px; color: #9ca3af; text-align: center;';
    
    // Add location note if coordinates are approximate
    if (!event.latitude || !event.longitude) {
      const locationNote = document.createElement('p');
      locationNote.textContent = '📍 Location is approximate';
      locationNote.style.cssText = 'margin: 0 0 12px 0; font-size: 11px; color: #f59e0b; font-style: italic;';
      infoContent.appendChild(locationNote);
    }
    
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
    
    // Build the description box structure
    descriptionBox.appendChild(title);
    descriptionBox.appendChild(descriptionLabel);
    descriptionBox.appendChild(companyName);
    descriptionBox.appendChild(date);
    
    // Append all elements to the container
    infoContent.appendChild(img);
    infoContent.appendChild(descriptionBox);
    infoContent.appendChild(button);
    
    // Set the content and open the info window
    infoWindow.setContent(infoContent);
    infoWindow.open(mapInstance, marker);
  };

  // Helper function to show info window for multiple events at same location
  const showMultipleEventsInfoWindow = (events, infoWindow, mapInstance, marker) => {
    const infoContent = document.createElement('div');
    infoContent.style.padding = '16px';
    infoContent.style.maxWidth = '300px';
    
    // Create header
    const header = document.createElement('h3');
    header.textContent = `${events.length} Events at This Location`;
    header.style.cssText = 'margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #1f2937; text-align: center;';
    
    // Add location note if any events have approximate locations
    const hasApproximateLocation = events.some(event => !event.latitude || !event.longitude);
    if (hasApproximateLocation) {
      const locationNote = document.createElement('p');
      locationNote.textContent = '📍 Locations are approximate until real coordinates are added';
      locationNote.style.cssText = 'margin: 0 0 16px 0; font-size: 11px; color: #f59e0b; font-style: italic; text-align: center;';
      infoContent.appendChild(locationNote);
    }
    
    // Create events list
    const eventsList = document.createElement('div');
    eventsList.style.cssText = 'max-height: 200px; overflow-y: auto;';
    
    events.forEach((event, index) => {
      const eventItem = document.createElement('div');
      eventItem.style.cssText = `
        padding: 12px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        margin-bottom: 8px;
        background: #f9fafb;
        cursor: pointer;
        transition: all 0.2s ease;
      `;
      
      // Add hover effect
      eventItem.addEventListener('mouseenter', () => {
        eventItem.style.background = '#f3f4f6';
        eventItem.style.borderColor = '#8B5CF6';
      });
      
      eventItem.addEventListener('mouseleave', () => {
        eventItem.style.background = '#f9fafb';
        eventItem.style.borderColor = '#e5e7eb';
      });
      
      // Event title
      const title = document.createElement('div');
      title.textContent = event.title || event.caption || 'Event Title';
      title.style.cssText = 'font-weight: 600; color: #1f2937; margin-bottom: 4px; font-size: 14px;';
      
      // Company name
      const companyName = document.createElement('div');
      companyName.textContent = `@${event.companyName || event.fullname || event.venue || event.club || event.username || 'Unknown'}`;
      companyName.style.cssText = 'color: #6b7280; font-size: 12px; margin-bottom: 4px;';
      
      // Date
      const date = document.createElement('div');
      date.textContent = getEventDate(event) ? getEventDate(event).toLocaleDateString('en-GB', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      }) : 'Date TBA';
      date.style.cssText = 'color: #9ca3af; font-size: 11px;';
      
      // Add click handler to navigate to event
      eventItem.addEventListener('click', () => {
        navigate(`/event/${event.id}?from=map`);
      });
      
      eventItem.appendChild(title);
      eventItem.appendChild(companyName);
      eventItem.appendChild(date);
      eventsList.appendChild(eventItem);
    });
    
    infoContent.appendChild(header);
    infoContent.appendChild(eventsList);
    
    // Set the content and open the info window
    infoWindow.setContent(infoContent);
    infoWindow.open(mapInstance, marker);
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

  // EXACT MAPPING using the actual Firebase values from console logs
  const VENUE_MAPPING = {
    // Exact fullname values from Firebase (case-sensitive)
    'Karrusel': { lat: 55.6702, lng: 12.5560 }, // Flæsketorvet area, Vesterbro
    'Karruselfest': { lat: 55.6702, lng: 12.5560 }, // Same as Karrusel
    'RUST': { lat: 55.6850, lng: 12.5550 }, // Guldbergsgade 8, Nørrebro
    'VEGA': { lat: 55.6689, lng: 12.5455 }, // Enghavevej 40, Vesterbro
    'KLUB WERKSTATT': { lat: 55.6720, lng: 12.5600 }, // Vesterbrogade area
    'Den Anden Side': { lat: 55.6860, lng: 12.5620 }, // Ravnsborggade, Nørrebro
    'MODULE': { lat: 55.6900, lng: 12.5700 }, // Østerbro area
    'Hangaren': { lat: 55.6929, lng: 12.6175 }, // Refshalevej, Refshaleøen
    'Sigurd CPH': { lat: 55.6780, lng: 12.5794 }, // City center
    'Jolene': { lat: 55.6720, lng: 12.5580 }, // Flæsketorvet area, Vesterbro
    'Baggen': { lat: 55.6702, lng: 12.5560 }, // Halmtorvet area, Vesterbro
    'The Old Irish Pub Copenhagen': { lat: 55.6780, lng: 12.5700 }, // City center
    'The Fluffy Duck': { lat: 55.6900, lng: 12.5800 }, // Østerbro
    'Aie Afroindies': { lat: 55.6720, lng: 12.5620 }, // Vesterbro
    'Culture Box': { lat: 55.6793, lng: 12.5800 }, // Kronprinsessegade 54A, Copenhagen city center
    
    // Exact username values from Firebase
    'karruselfest': { lat: 55.6702, lng: 12.5560 }, // Same as Karrusel
    'rustkbh': { lat: 55.6850, lng: 12.5550 }, // Same as RUST
    'vegacph': { lat: 55.6689, lng: 12.5455 }, // Same as VEGA
    'klub_werkstatt': { lat: 55.6720, lng: 12.5600 }, // Same as KLUB WERKSTATT
    'den_anden_side_cph': { lat: 55.6860, lng: 12.5620 }, // Same as Den Anden Side
    'modulecph': { lat: 55.6900, lng: 12.5700 }, // Same as MODULE
    'hangaren_copenhagen': { lat: 55.6929, lng: 12.6175 }, // Same as Hangaren
    'sigurd.klubben': { lat: 55.6780, lng: 12.5794 }, // Same as Sigurd CPH
    'jolenebar': { lat: 55.6720, lng: 12.5580 }, // Same as Jolene
    'baggenkbh': { lat: 55.6702, lng: 12.5560 }, // Same as Baggen
    'oldirishpub_copenhagen': { lat: 55.6780, lng: 12.5700 }, // Same as The Old Irish Pub
    'thefluffyduck.cph': { lat: 55.6900, lng: 12.5800 }, // Same as The Fluffy Duck
    'afroindies': { lat: 55.6720, lng: 12.5620 }, // Same as Aie Afroindies
    'cultureboxdk': { lat: 55.6793, lng: 12.5800 }, // Same as Culture Box
    'farfarsbodega': { lat: 55.6840, lng: 12.5500 }, // Nørrebro (this one was working!)
    
    // Districts
    'vesterbro': { lat: 55.6731, lng: 12.5501 }, // Vesterbro center
    'nørrebro': { lat: 55.6831, lng: 12.5623 }, // Nørrebro center
    'østerbro': { lat: 55.6931, lng: 12.5723 }, // Østerbro center
    'amager': { lat: 55.6531, lng: 12.5823 }, // Amager center
    'christiania': { lat: 55.6631, lng: 12.5923 }, // Freetown Christiania
    'nyhavn': { lat: 55.6761, lng: 12.5923 }, // Nyhavn waterfront
    'strøget': { lat: 55.6761, lng: 12.5683 }, // Strøget shopping street
    'tivoli': { lat: 55.6731, lng: 12.5683 } // Tivoli gardens
  };

  // SIMPLE DIRECT MAPPING using exact Firebase values
  const getEventLocation = (event) => {
    // Get the exact values from Firebase
    const fullname = event.fullname || '';
    const username = event.username || '';
    const companyName = event.companyName || '';
    
    console.log('=== getEventLocation called ===', {
      title: event.title || event.caption,
      fullname: fullname,
      username: username,
      companyName: companyName
    });
    
    // Try fullname first (most specific)
    if (fullname && VENUE_MAPPING[fullname]) {
      const coords = VENUE_MAPPING[fullname];
      console.log(`✅ Found fullname "${fullname}" at: ${coords.lat}, ${coords.lng}`);
      return coords;
    }
    
    // Then try username
    if (username && VENUE_MAPPING[username]) {
      const coords = VENUE_MAPPING[username];
      console.log(`✅ Found username "${username}" at: ${coords.lat}, ${coords.lng}`);
      return coords;
    }
    
    // Then try company name
    if (companyName && VENUE_MAPPING[companyName]) {
      const coords = VENUE_MAPPING[companyName];
      console.log(`✅ Found company "${companyName}" at: ${coords.lat}, ${coords.lng}`);
      return coords;
    }
    
    // If no match found, place in Copenhagen center
    console.log(`❌ No match found for: fullname="${fullname}", username="${username}", companyName="${companyName}" - placing in Copenhagen center`);
    return { lat: 55.6761, lng: 12.5683 };
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
      {/* Google Maps Controls Removal */}
      <style>
        {`
          #map .gmnoprint {
            display: none !important;
          }
          #map .gm-style-moc {
            display: none !important;
          }
          #map .gm-style-mtc {
            display: none !important;
          }
          #map .gm-fullscreen-control {
            display: none !important;
          }
          #map .gm-style-mtc button {
            display: none !important;
          }
        `}
      </style>
      
             <div style={{ 
         minHeight: '100vh', 
         background: '#2a0845',
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
             background: '#0f172a',
             margin: '0 -18px',
             paddingLeft: '36px',
             paddingRight: '18px',
             position: 'relative',
             left: '50%',
             right: '50%',
             marginLeft: '-50vw',
             marginRight: '-50vw',
             zIndex: 1002
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
             
             {/* Moon Toggle Button */}
             <div style={{ 
               position: 'fixed',
               bottom: '100px',
               right: '20px',
               cursor: 'pointer',
               zIndex: 1003
             }}
             onClick={() => setIsDarkMode(!isDarkMode)}
             >
               <div style={{
                 background: '#0f172a',
                 border: '2px solid #FFFFFF',
                 color: '#F9FAFB',
                 fontSize: '16px',
                 padding: '6px',
                 borderRadius: '50%',
                 width: '32px',
                 height: '32px',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 transition: 'all 0.2s ease',
                 cursor: 'pointer',
                 boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
               }}>
                 {isDarkMode ? (
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <circle cx="12" cy="12" r="5"/>
                     <line x1="12" y1="1" x2="12" y2="3"/>
                     <line x1="12" y1="21" x2="12" y2="23"/>
                     <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                     <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                     <line x1="1" y1="12" x2="3" y2="12"/>
                     <line x1="21" y1="12" x2="23" y2="12"/>
                     <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                     <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                   </svg>
                 ) : (
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                   </svg>
                 )}
               </div>
             </div>
             
             {/* Three Dots Menu */}
               <div style={{ position: 'relative', marginLeft: '20px' }} data-three-dots-menu>
              <button
                onClick={() => setShowThreeDotsMenu(!showThreeDotsMenu)}
                style={{
                  background: '#0f172a',
                  border: '2px solid #FFFFFF',
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
         
         {/* Two Fields Under Header */}
         <div style={{
           display: 'flex',
           gap: '0px',
           marginTop: '12px',
           padding: '3px',
           justifyContent: 'center',
           position: 'relative',
           zIndex: 1000,
           background: viewMode === 'events' ? '#2a0845' : '#0f172a',
           borderRadius: '24px',
           border: '2px solid #E9D5FF',
           width: 'fit-content',
           margin: '12px auto 0',
           transition: 'background 0.2s ease'
         }}>
           {/* Explore Events Field */}
           <div 
             onClick={() => setViewMode('events')}
             style={{
               background: viewMode === 'events' ? '#F941F9' : 'transparent',
               color: '#FFFFFF',
               padding: '8px 2px',
               borderRadius: viewMode === 'events' ? '22px' : '0',
               cursor: 'pointer',
               fontSize: 14,
               fontWeight: '600',
               transition: 'all 0.2s ease',
               width: '160px',
               textAlign: 'center'
             }}
             onMouseEnter={(e) => {
               if (viewMode !== 'events') {
                 e.target.style.background = '#374151';
               }
             }}
             onMouseLeave={(e) => {
               if (viewMode !== 'events') {
                 e.target.style.background = 'transparent';
               }
             }}
           >
             Explore events
           </div>
           
           {/* See Map Field */}
           <div 
             onClick={() => setViewMode('map')}
             style={{
               background: viewMode === 'map' ? '#F941F9' : 'transparent',
               color: '#FFFFFF',
               padding: '8px 2px',
               borderRadius: viewMode === 'events' ? '0' : '22px',
               cursor: 'pointer',
               fontSize: 14,
               fontWeight: '600',
               transition: 'all 0.2s ease',
               width: '160px',
               textAlign: 'center'
           }}
             onMouseEnter={(e) => {
               if (viewMode !== 'map') {
                 e.target.style.background = '#374151';
               }
             }}
             onMouseLeave={(e) => {
               if (viewMode !== 'events') {
                 e.target.style.background = 'transparent';
               }
             }}
           >
             See map
           </div>
         </div>

                                                                                                                                               {/* Conditional Content Based on View Mode */}
            {viewMode === 'map' ? (
              // Map View
              <div style={{ 
                width: '100%',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                marginTop: '-80px'
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
            ) : (
              // Events View
              <div style={{ 
                flex: 1, 
                padding: '20px', 
                background: '#2a0845',
                overflowY: 'auto'
              }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                  gap: 16 
                }}>
                  {events
                    .filter(event => {
                      // Apply filter based on selectedFilter
                      if (selectedFilter === 'Clubs') {
                        return CLUB_FESTIVAL_NAMES.some(name => 
                          (event.venue || event.club || event.companyName || event.fullname || '').toLowerCase().includes(name.toLowerCase())
                        );
                      } else if (selectedFilter === 'Bars') {
                        return !CLUB_FESTIVAL_NAMES.some(name => 
                          (event.venue || event.club || event.companyName || event.fullname || '').toLowerCase().includes(name.toLowerCase())
                        );
                      }
                      return true; // 'All' filter
                    })
                    .sort((a, b) => {
                      const dateA = getEventDate(a);
                      const dateB = getEventDate(b);
                      if (!dateA && !dateB) return 0;
                      if (!dateA) return 1;
                      if (!dateB) return -1;
                      return dateA.getTime() - dateB.getTime();
                    })
                    .map((event, index) => (
                      <div 
                        key={`map-events-${event.id}`} 
                        style={{ 
                          background: '#1f2937', 
                          borderRadius: 24, 
                          overflow: 'hidden',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.6)',
                          cursor: 'pointer'
                        }}
                        onClick={() => navigate(`/event/${event.id}?from=map`)}
                      >
                        <div style={{ position: 'relative' }}>
                          <img
                            src={getWebPImageUrl(event)}
                            alt={event.title || event.caption || 'Event'}
                            style={{
                              width: '100%',
                              height: '160px',
                              objectFit: 'cover'
                            }}
                          />
                          {/* Date badge */}
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
                              const endDate = event.eventDateEnd ? 
                                (typeof event.eventDateEnd.toDate === 'function' ? event.eventDateEnd.toDate() : new Date(event.eventDateEnd)) : null;
                              
                              if (!startDate) return 'TBA';
                              
                              if (endDate && !isNaN(endDate.getTime()) && endDate.getTime() !== startDate.getTime()) {
                                return `${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
                              }
                              return startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                            })()}
                          </div>
                          
                          {/* Likes count overlay on image */}
                          {event.likescount > 0 && (
                            <div style={{
                              position: 'absolute',
                              bottom: '12px',
                              right: '12px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#fff',
                              background: '#10B981',
                              borderRadius: '12px',
                              padding: '4px 8px',
                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)'
                            }}>
                              {event.likescount} likes
                            </div>
                          )}
                        </div>
                        
                        {/* Event details */}
                        <div style={{ 
                          padding: '16px',
                          background: '#0f172a',
                          borderRadius: '0 0 24px 24px'
                        }}>
                          <h3 style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: '#fff',
                            margin: '0 0 8px 0',
                            lineHeight: 1.3
                          }}>
                            {event.title || event.caption || 'Event Title'}
                          </h3>
                          <div style={{
                            fontSize: 14,
                            color: '#87CEEB',
                            marginBottom: 0
                          }}>
                            {event.companyName || event.fullname || event.venue || event.club || event.username || 'Unknown'}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
      </div>
      <BottomNav />
    </>
  );
}

export default MapPage;
