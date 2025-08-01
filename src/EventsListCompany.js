import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, query, getDocs, addDoc, deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { storage } from './firebase';
import { getAuth } from 'firebase/auth';
import { getDownloadURL, ref } from 'firebase/storage';
import BottomNavCompany from './BottomNavCompany';


function getEventDate(event) {
  if (event.eventDate?.toDate) return event.eventDate.toDate();
  if (event.eventDate) return new Date(event.eventDate);
  if (event.timestamp?.seconds) return new Date(event.timestamp.seconds * 1000);
  if (event.timestamp) return new Date(event.timestamp);
  
  // For events with only startTime/endTime but no eventDate, create a date from today
  if (event.startTime && !event.eventDate) {
    const today = new Date();
    const [hours, minutes] = event.startTime.split(':').map(Number);
    today.setHours(hours, minutes, 0, 0);
    return today;
  }
  
  return null;
}

function getEventDateEnd(event) {
  if (event.eventDateEnd) {
    if (typeof event.eventDateEnd.toDate === 'function') {
      return event.eventDateEnd.toDate();
    }
    const d = new Date(event.eventDateEnd);
    if (!isNaN(d)) return d;
  }
  // Also check for other possible end date fields
  if (event.endDate) {
    if (typeof event.endDate.toDate === 'function') {
      return event.endDate.toDate();
    }
    const d = new Date(event.endDate);
    if (!isNaN(d)) return d;
  }
  
  // For events with only endTime but no eventDateEnd, create a date from today
  if (event.endTime && !event.eventDateEnd) {
    const today = new Date();
    const [hours, minutes] = event.endTime.split(':').map(Number);
    today.setHours(hours, minutes, 0, 0);
    return today;
  }
  
  return null;
}

function formatDateLabel(start, end) {
  if (!start) return 'Unknown date';
  if (end && end.getTime() !== start.getTime()) {
    // Show range, e.g. 5 Jul – 26 Jul
    return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  }
  return start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function EventCard({ event, navigate, showPreviousEvents }) {
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchImage = async () => {
      // Try multiple image fields (Image0 to Image9) - filter and sort
      const imageFields = [
        event.Image0, event.Image1, event.Image2, event.Image3, event.Image4,
        event.Image5, event.Image6, event.Image7, event.Image8, event.Image9
      ];
      
      // Filter images: match event ID (without "A") with file ID (without "_imageX")
      const eventIdWithoutA = event.id.replace(/^A/, '');
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
      
      // For event cards, only use the first (lowest numbered) matching image
      if (validImageFields.length > 0) {
        const { field: imagePath } = validImageFields[0];
        if (imagePath.startsWith('http')) {
          if (isMounted) setImageUrl(imagePath);
          return; // Found a valid image, stop searching
        } else {
          try {
            const url = await getDownloadURL(ref(storage, imagePath));
            if (isMounted) setImageUrl(url);
            return; // Found a valid image, stop searching
          } catch (e) {
            // Image failed to load, will fall back to default
          }
        }
      }
      
      // If no images found, use default
      if (isMounted) setImageUrl('/default-tyrolia.jpg');
    };
    fetchImage();
    return () => { isMounted = false; };
  }, [event]);

  const eventDate = getEventDate(event);
  const eventDateEnd = getEventDateEnd(event);
  const dateLabel = formatDateLabel(eventDate, eventDateEnd);
  const clubName = event.fullname || event.username || "Unknown";
  const eventTitle = event.title || event.caption?.substring(0, 50) + (event.caption?.length > 50 ? '...' : '') || "Event";

  return (
    <div
      key={event.id}
            style={{
        background: '#4b1fa2',
        borderRadius: 24,
        margin: '0 auto 48px',
        overflow: 'hidden',
        boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004',
        maxWidth: 390,
        cursor: 'pointer'
      }}
      onClick={() => {
        if (showPreviousEvents) {
          navigate(`/company-deleted-event/${event.id}`);
        } else {
          navigate(`/company-event/${event.id}`);
        }
      }}
    >
      <div style={{ position: 'relative', background: '#22043a' }}>
        <img src={imageUrl} alt={eventTitle} style={{ width: '100%', height: '12rem', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, background: '#2046A6', color: 'white', fontSize: '0.875rem', fontWeight: 700, padding: '4px 12px', borderTopRightRadius: '16px', borderBottomLeftRadius: '16px' }}>
            {dateLabel}
        </div>
      </div>
      <div style={{ padding: '16px' }}>
        <h3 style={{ color: 'white', fontSize: '1.125rem', fontWeight: 700, marginBottom: '8px' }}>{eventTitle}</h3>
        <span style={{ color: '#60a5fa', fontSize: '1rem', fontWeight: 700 }}>@{clubName}</span>
      </div>
    </div>
  );
}

function EventsListCompany() {
  const [allEvents, setAllEvents] = useState([]);
  const [events, setEvents] = useState([]);
  const [showPreviousEvents, setShowPreviousEvents] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = useNavigate();

  // Function to clean up duplicate events in deleted_posts
  const cleanupDuplicateEvents = async () => {
    try {
      console.log('🧹 Cleaning up duplicate events in deleted_posts...');
      
      const deletedEventsSnapshot = await getDocs(collection(db, 'deleted_posts'));
      const allDeletedEvents = deletedEventsSnapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
      }));
      
      // Group events by title and username to find duplicates
      const eventGroups = allDeletedEvents.reduce((groups, event) => {
        const key = `${event.title}-${event.username}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(event);
        return groups;
      }, {});
      
      // Remove duplicates (keep the most recent one)
      for (const [key, events] of Object.entries(eventGroups)) {
        if (events.length > 1) {
          console.log(`🧹 Found ${events.length} duplicates for: ${key}`);
          
          // Sort by deletedAt date (newest first)
          events.sort((a, b) => {
            const dateA = a.deletedAt ? new Date(a.deletedAt.seconds * 1000) : new Date(0);
            const dateB = b.deletedAt ? new Date(b.deletedAt.seconds * 1000) : new Date(0);
            return dateB - dateA;
          });
          
          // Keep the first (newest) and delete the rest
          for (let i = 1; i < events.length; i++) {
            await deleteDoc(doc(db, 'deleted_posts', events[i].docId));
            console.log(`🗑️ Removed duplicate: ${events[i].docId}`);
          }
        }
      }
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  };

  // Function to move event to deleted_posts
  const moveEventToDeleted = async (event, deletedBy = 'manual') => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      console.log('🗑️ Moving event to deleted_posts:', event.title);
      console.log('🗑️ Event data:', event);
      console.log('🗑️ User UID:', user?.uid);
      
      // Check if event already exists in deleted_posts to prevent duplicates
      console.log('🗑️ Step 0: Checking for existing deleted event...');
      const deletedEventsSnapshot = await getDocs(collection(db, 'deleted_posts'));
      const existingDeleted = deletedEventsSnapshot.docs.find(doc => {
        const data = doc.data();
        return data.id === event.id || 
               (data.title === event.title && data.username === event.username);
      });
      
      if (existingDeleted) {
        console.log('⚠️ Event already exists in deleted_posts, skipping...');
        // Still remove from Instagram_posts if it exists there
        try {
          await deleteDoc(doc(db, 'Instagram_posts', event.id));
          console.log('✅ Removed duplicate from Instagram_posts');
        } catch (e) {
          console.log('ℹ️ Event already removed from Instagram_posts');
        }
        return true;
      }
      
      // Add event to deleted_posts collection first
      console.log('🗑️ Step 1: Adding to deleted_posts...');
      const deletedEventData = {
        ...event,
        originalId: event.id, // Keep track of original ID
        deletedAt: new Date(),
        deletedBy: deletedBy
      };
      
      await setDoc(doc(db, 'deleted_posts', event.id), deletedEventData);
      console.log('✅ Successfully added to deleted_posts');
      
      // Remove from Instagram_posts
      console.log('🗑️ Step 2: Removing from Instagram_posts...');
      await deleteDoc(doc(db, 'Instagram_posts', event.id));
      console.log('✅ Successfully removed from Instagram_posts');
      
      console.log('✅ Event moved to deleted_posts successfully');
      return true;
    } catch (error) {
      console.error('❌ Error moving event to deleted_posts:', error);
      console.error('❌ Error details:', error.code, error.message);
      return false;
    }
  };

  // Auto-archive outdated events
  const autoArchiveOutdatedEvents = async (events) => {
    const now = new Date();
    const outdatedEvents = events.filter(event => {
      const eventDate = getEventDate(event);
      const eventDateEnd = getEventDateEnd(event);
      const dateToCheck = eventDateEnd || eventDate;
      return dateToCheck && dateToCheck < now;
    });

    console.log('🔄 Auto-archiving', outdatedEvents.length, 'outdated events');
    
    for (const event of outdatedEvents) {
      await moveEventToDeleted(event, 'auto-archive');
    }
    
    return outdatedEvents.length;
  };



  useEffect(() => {
    const fetchCompanyEvents = async () => {
      console.log('🏢 === COMPANY EVENTS PAGE LOADING ===');
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
      console.log('🏢 Current user in company events:', user.uid);

      // 1. Fetch the company's profile to get their official name/username
      let companyProfileNames = [user.displayName, user.email].filter(Boolean).map(s => s.trim().toLowerCase());
      try {
        const profileSnap = await getDoc(doc(db, 'Club_Bar_Festival_profiles', user.uid));
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          companyProfileNames.push(profileData.name?.trim().toLowerCase());
          companyProfileNames.push(profileData.username?.trim().toLowerCase());
        }
      } catch (e) {
        console.error("Could not fetch company profile", e);
      }
      companyProfileNames = [...new Set(companyProfileNames)]; // Remove duplicates
      console.log('🏢 Company profile names loaded:', companyProfileNames);

      // 2. Fetch all future events
      const companyEventsRef = collection(db, 'company-events');
      const instagramPostsRef = collection(db, 'Instagram_posts');

      const [companyEventsSnap, instagramPostsSnap] = await Promise.all([
        getDocs(query(companyEventsRef)),
        getDocs(query(instagramPostsRef))
      ]);
      
      console.log('🏢 Raw company events found:', companyEventsSnap.docs.length);
      console.log('🏢 Raw Instagram posts found:', instagramPostsSnap.docs.length);
      
      // Log all company events to see what's in the collection
      companyEventsSnap.docs.forEach(doc => {
        const data = doc.data();
        console.log('🏢 Company event in collection:', {
          id: doc.id,
          title: data.title,
          userId: data.userId,
          companyName: data.companyName,
          username: data.username,
          startTime: data.startTime,
          endTime: data.endTime,
          eventDate: data.eventDate,
          eventDates: data.eventDates
        });
      });

      const allEvents = [];
      const now = new Date();

      // 3. Filter events based on company names or userId
      const processSnapshot = (snapshot) => {
        snapshot.forEach(doc => {
          const eventData = { id: doc.id, ...doc.data() };
          const eventDate = getEventDate(eventData);

          // Debug: Log event details
          console.log('🏢 Event:', eventData.title || eventData.name, {
            id: eventData.id,
            eventDate: eventDate,
            userId: eventData.userId,
            currentUserId: user.uid,
            userIdMatch: eventData.userId === user.uid,
            isFuture: eventDate && eventDate >= now,
            rawDate: eventData.eventDate || eventData.timestamp,
            companyName: eventData.companyName,
            username: eventData.username
          });

          const eventUsernames = [
            eventData.username,
            eventData.fullname,
            eventData.email,
            eventData.companyName
      ].filter(Boolean).map(s => s.trim().toLowerCase());

          const isMatch = eventData.userId === user.uid || eventUsernames.some(name => companyProfileNames.includes(name));
          
          // Debug logging for company name matching
          if (eventData.companyName) {
            console.log('🏢 Company name matching check:', {
              eventCompanyName: eventData.companyName,
              eventCompanyNameLower: eventData.companyName.toLowerCase(),
              companyProfileNames: companyProfileNames,
              isMatch: isMatch,
              userIdMatch: eventData.userId === user.uid
            });
          }

          if (isMatch) {
            // Add all matching events to the list (we'll filter by date later)
            allEvents.push(eventData);
          }
        });
      };

      processSnapshot(companyEventsSnap);
      processSnapshot(instagramPostsSnap);
      
      const uniqueEvents = Array.from(new Set(allEvents.map(e => e.id))).map(id => allEvents.find(e => e.id === id));

      uniqueEvents.sort((a, b) => getEventDate(a) - getEventDate(b));
      
      console.log('🏢 === FINAL EVENTS TO DISPLAY ===');
      console.log('🏢 Total events found:', uniqueEvents.length);
      
      // Auto-archive outdated events before setting state
      const archivedCount = await autoArchiveOutdatedEvents(uniqueEvents);
      if (archivedCount > 0) {
        console.log('🔄 Re-fetching events after auto-archiving', archivedCount, 'events');
        // Re-fetch events after archiving
        const updatedSnapshot = await getDocs(collection(db, 'Instagram_posts'));
        const updatedEvents = updatedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).filter(event => {
          const eventUsernames = [
            event.username,
            event.fullname,
            event.email,
            event.companyName
          ].filter(Boolean).map(s => s.trim().toLowerCase());
          return event.userId === user.uid || eventUsernames.some(name => companyProfileNames.includes(name));
          });
        
        updatedEvents.sort((a, b) => getEventDate(a) - getEventDate(b));
        setAllEvents(updatedEvents);
      } else {
        setAllEvents(uniqueEvents);
      }
    };

    fetchCompanyEvents();
  }, []);

  // Filter events based on showPreviousEvents toggle
  useEffect(() => {
    const filterEvents = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

        const now = new Date();
      let filteredEvents;
      
      // Get company profile names (same logic as main fetch) - moved outside conditional blocks
      let companyProfileNames = [user.displayName, user.email].filter(Boolean).map(s => s.trim().toLowerCase());
      try {
        const profileSnap = await getDoc(doc(db, 'Club_Bar_Festival_profiles', user.uid));
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          companyProfileNames.push(profileData.name?.trim().toLowerCase());
          companyProfileNames.push(profileData.username?.trim().toLowerCase());
        }
      } catch (e) {
        console.error("Could not fetch company profile", e);
      }
      companyProfileNames = [...new Set(companyProfileNames)]; // Remove duplicates
      
      console.log('🏢 Company profile names for filtering:', companyProfileNames);
      
      if (showPreviousEvents) {
        // Show previous events from deleted_posts collection
        console.log('🏢 Fetching previous events from deleted_posts collection');
        
        try {
          // Clean up duplicates before showing previous events
          await cleanupDuplicateEvents();
          
          const deletedEventsSnapshot = await getDocs(collection(db, 'deleted_posts'));
          const deletedEvents = deletedEventsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            isDeleted: true
          }));
          
          // Filter deleted events for this user
          filteredEvents = deletedEvents.filter(event => {
            const eventUsernames = [
              event.username,
              event.fullname,
              event.email
            ].filter(Boolean).map(s => s.trim().toLowerCase());
            
            console.log('🏢 Checking deleted event:', event.title, {
              eventUsernames,
              userId: event.userId,
              currentUserId: user.uid,
              userIdMatch: event.userId === user.uid,
              usernameMatch: eventUsernames.some(name => companyProfileNames.includes(name))
            });
            
            return event.userId === user.uid || eventUsernames.some(name => companyProfileNames.includes(name));
          });
          
          // Sort by deletion date (newest first) or event date
          filteredEvents.sort((a, b) => {
            const dateA = a.deletedAt ? new Date(a.deletedAt.seconds * 1000) : getEventDate(a);
            const dateB = b.deletedAt ? new Date(b.deletedAt.seconds * 1000) : getEventDate(b);
            return dateB - dateA;
          });
          
          console.log('🏢 Previous events from deleted_posts:', filteredEvents.length);
        } catch (error) {
          console.error('Error fetching deleted events:', error);
          filteredEvents = [];
        }
      } else {
        // Show only upcoming events (events that haven't completely ended yet)
        filteredEvents = allEvents.filter(event => {
          const eventDate = getEventDate(event);
          const eventDateEnd = getEventDateEnd(event);
          
          // If event has an end date, check if end date is in the future
          // If no end date, check if start date is in the future
          const dateToCheck = eventDateEnd || eventDate;
          
          // Check if this event belongs to the current company
          const isCompanyEvent = event.userId === user.uid || 
            (event.companyName && companyProfileNames.some(name => 
              name && event.companyName.toLowerCase().includes(name.toLowerCase())
            ));
          
          console.log('🏢 Event filter check (Upcoming):', event.title, {
            startDate: eventDate,
            endDate: eventDateEnd,
            dateToCheck: dateToCheck,
            isUpcoming: dateToCheck && dateToCheck >= now,
            hasNoDate: !dateToCheck,
            isCompanyEvent: isCompanyEvent,
            companyName: event.companyName,
            userId: event.userId,
            currentUserId: user.uid,
            willBeIncluded: (dateToCheck && dateToCheck >= now) || (!dateToCheck && isCompanyEvent)
          });
          
          // Include events that are either:
          // 1. Upcoming (have a future date)
          // 2. Belong to this company but have no date set (new events)
          return (dateToCheck && dateToCheck >= now) || (!dateToCheck && isCompanyEvent);
          });
          
          // Sort upcoming events by date (earliest first), then by engagement
          filteredEvents.sort((a, b) => {
            const dateA = getEventDate(a);
            const dateB = getEventDate(b);
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            
            // First sort by date
            const dateComparison = dateA.getTime() - dateB.getTime();
            if (dateComparison !== 0) return dateComparison;
            
            // If same date, sort by engagement (likes first, then views)
            const likesA = a.likescount || 0;
            const likesB = b.likescount || 0;
            const viewsA = a.viewscount || 0;
            const viewsB = b.viewscount || 0;
            
            // Compare likes first
            if (likesA !== likesB) return likesB - likesA; // Higher likes first
            
            // If same likes, compare views
            return viewsB - viewsA; // Higher views first
          });
      }
      
      console.log('🏢 Filtering events. Show previous:', showPreviousEvents, 'Total available:', showPreviousEvents ? 'from deleted_posts' : allEvents.length, 'Filtered:', filteredEvents.length);
      setEvents(filteredEvents);
    };

    filterEvents();
  }, [allEvents, showPreviousEvents]);

  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: '#3b1a5c', display: 'flex', flexDirection: 'column' }}>
        {/* Top Bar */}
        <div style={{ width: '100vw', background: '#0f172a', padding: '22px 0 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #334155', margin: 0, position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '448px', padding: '0 18px' }}>
                <span style={{ display: 'flex', alignItems: 'center', background: '#2a0845', color: '#fff', fontWeight: 700, fontSize: 18, borderRadius: 24, padding: '8px 22px', boxShadow: '0 2px 12px #0004', letterSpacing: 0.5, border: '2px solid #fff', textShadow: '0 2px 8px #3E29F099' }}>
                    My Posts
                </span>
        <div style={{ position: 'relative' }}>
          <button
                            onClick={() => setMenuOpen(!menuOpen)}
                        style={{ 
                            background: '#2a0845', 
                            border: '2px solid #fff', 
                            color: '#ffffff', 
                            borderRadius: '50%', 
                            width: 40, 
                            height: 40, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            cursor: 'pointer', 
                            boxShadow: '0 2px 12px #0004' 
                        }}
                    >
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="19" cy="12" r="1" />
                            <circle cx="5" cy="12" r="1" />
            </svg>
          </button>
          {menuOpen && (
                                <div style={{
                position: 'absolute',
                                    top: '100%',
                right: 0,
                            background: '#2a0845',
                            border: '2px solid #fff',
                            borderRadius: 12,
                            padding: '8px 0',
                                    marginTop: 8,
                            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                            zIndex: 1000,
                            minWidth: 160
                                }}>
                                    <button
                                        onClick={() => {
                                            setShowPreviousEvents(false);
                                            setMenuOpen(false);
                                        }}
                                        style={{
                                            width: '100%',
                                    padding: '8px 16px',
                                    background: 'transparent',
                                            border: 'none',
                                            color: '#fff',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                    fontSize: 14,
                                    fontWeight: 600
              }}
            >
                                Upcoming Events
                                    </button>
              <button
                                        onClick={() => {
                                            setShowPreviousEvents(true);
                                            setMenuOpen(false);
                                        }}
                style={{
                  width: '100%',
                                    padding: '8px 16px',
                                    background: 'transparent',
                  border: 'none',
                                            color: '#fff',
                  textAlign: 'left',
                  cursor: 'pointer',
                                    fontSize: 14,
                                    fontWeight: 600
                                        }}
              >
                                Previous Events
              </button>
            </div>
          )}
        </div>
      </div>
        </div>

        <div style={{ width: '100%', background: '#3b1a5c', flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: 448, width: '100%', paddingTop: '18px' }}>

                {/* Event Cards */}
                <div style={{ padding: '0 16px 80px 16px' }}>
                    {events.map(event => (
                        <EventCard 
                            key={event.id} 
                            event={event} 
                            navigate={navigate}
                            showPreviousEvents={showPreviousEvents}
                        />
                    ))}
            </div>
            </div>
        </div>
        <BottomNavCompany />
      </div>
  );
}

export default EventsListCompany; 
 