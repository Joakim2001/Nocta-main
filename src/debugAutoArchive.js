import { db } from './firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

// Debug function to check a specific event
export const debugSpecificEvent = async (eventId) => {
  try {
    console.log('🔍 Debug: Checking specific event:', eventId);
    
    // Get the specific event
    const docRef = doc(db, 'Instagram_posts', eventId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      console.log('❌ Debug: Event not found in Instagram_posts');
      return;
    }
    
    const event = { id: docSnap.id, ...docSnap.data() };
    console.log('🔍 Debug: Event data:', event);
    
    // Check dates
    const eventDate = getEventDate(event);
    const eventDateEnd = getEventDateEnd(event);
    const now = new Date();
    
    console.log('🔍 Debug: Date analysis:', {
      eventDate: eventDate,
      eventDateEnd: eventDateEnd,
      now: now,
      eventDateString: eventDate ? eventDate.toISOString() : 'null',
      eventDateEndString: eventDateEnd ? eventDateEnd.toISOString() : 'null',
      nowString: now.toISOString()
    });
    
    // Check if it should be archived
    const dateToCheck = eventDateEnd || eventDate;
    const shouldBeArchived = dateToCheck && dateToCheck < now;
    
    console.log('🔍 Debug: Archive decision:', {
      dateToCheck: dateToCheck,
      shouldBeArchived: shouldBeArchived,
      isOutdated: shouldBeArchived
    });
    
    return {
      event,
      shouldBeArchived,
      eventDate,
      eventDateEnd,
      now
    };
  } catch (error) {
    console.error('❌ Debug: Error checking event:', error);
    return null;
  }
};

// Helper function to get event date
const getEventDate = (event) => {
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
};

// Helper function to get event end date
const getEventDateEnd = (event) => {
  if (event.eventDateEnd) {
    if (typeof event.eventDateEnd.toDate === 'function') {
      return event.eventDateEnd.toDate();
    }
    const d = new Date(event.eventDateEnd);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

// Debug function to check all events
export const debugAllEvents = async () => {
  try {
    console.log('🔍 Debug: Checking all events for auto-archive issues...');
    
    // Fetch all events from Instagram_posts
    const instagramSnapshot = await getDocs(collection(db, 'Instagram_posts'));
    const instagramEvents = instagramSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('🔍 Debug: Found', instagramEvents.length, 'events in Instagram_posts');
    
    const now = new Date();
    let outdatedCount = 0;
    
    for (const event of instagramEvents) {
      const eventDate = getEventDate(event);
      const eventDateEnd = getEventDateEnd(event);
      const dateToCheck = eventDateEnd || eventDate;
      const isOutdated = dateToCheck && dateToCheck < now;
      
      if (isOutdated) {
        outdatedCount++;
        console.log('🔍 Debug: OUTDATED EVENT FOUND:', {
          id: event.id,
          title: event.title,
          username: event.username,
          eventDate: eventDate,
          eventDateEnd: eventDateEnd,
          dateToCheck: dateToCheck,
          now: now,
          likescount: event.likescount
        });
      }
    }
    
    console.log('🔍 Debug: Found', outdatedCount, 'outdated events out of', instagramEvents.length, 'total events');
    
    return {
      totalEvents: instagramEvents.length,
      outdatedCount: outdatedCount
    };
  } catch (error) {
    console.error('❌ Debug: Error checking all events:', error);
    return null;
  }
}; 