import { db } from './firebase';
import { collection, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';

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

// Function to move event to deleted_posts
const moveEventToDeleted = async (event, deletedBy = 'auto-archive') => {
  try {
    console.log('🗑️ Auto-archiving event:', event.title, 'by', deletedBy);
    
    // Check if event already exists in deleted_posts to prevent duplicates
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
    const deletedEventData = {
      ...event,
      originalId: event.id, // Keep track of original ID
      deletedAt: new Date(),
      deletedBy: deletedBy
    };
    
    await setDoc(doc(db, 'deleted_posts', event.id), deletedEventData);
    console.log('✅ Successfully added to deleted_posts');
    
    // Remove from Instagram_posts
    await deleteDoc(doc(db, 'Instagram_posts', event.id));
    console.log('✅ Successfully removed from Instagram_posts');
    
    console.log('✅ Event auto-archived successfully');
    return true;
  } catch (error) {
    console.error('❌ Error auto-archiving event:', error);
    return false;
  }
};

// Global auto-archive function for all events
export const autoArchiveAllOutdatedEvents = async () => {
  try {
    console.log('🔄 Starting global auto-archive process...');
    
    // Fetch all events from Instagram_posts
    const instagramSnapshot = await getDocs(collection(db, 'Instagram_posts'));
    const instagramEvents = instagramSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Fetch all events from company-events
    const companySnapshot = await getDocs(collection(db, 'company-events'));
    const companyEvents = companySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Combine all events
    const allEvents = [...instagramEvents, ...companyEvents];
    
    console.log('🔄 Checking', allEvents.length, 'total events for outdated ones...');
    
    const now = new Date();
    const outdatedEvents = allEvents.filter(event => {
      const eventDate = getEventDate(event);
      const eventDateEnd = getEventDateEnd(event);
      const dateToCheck = eventDateEnd || eventDate;
      return dateToCheck && dateToCheck < now;
    });

    console.log('🔄 Found', outdatedEvents.length, 'outdated events to archive');
    
    let archivedCount = 0;
    for (const event of outdatedEvents) {
      const success = await moveEventToDeleted(event, 'global-auto-archive');
      if (success) {
        archivedCount++;
      }
    }
    
    console.log('✅ Global auto-archive completed. Archived', archivedCount, 'out of', outdatedEvents.length, 'events');
    return archivedCount;
  } catch (error) {
    console.error('❌ Error in global auto-archive:', error);
    return 0;
  }
};

// Function to check and archive a single event
export const checkAndArchiveEvent = async (event) => {
  const now = new Date();
  const eventDate = getEventDate(event);
  const eventDateEnd = getEventDateEnd(event);
  const dateToCheck = eventDateEnd || eventDate;
  
  if (dateToCheck && dateToCheck < now) {
    console.log('🔄 Event is outdated, archiving:', event.title);
    return await moveEventToDeleted(event, 'single-check-archive');
  }
  
  return false;
}; 

// Function to clean up duplicates (remove from Instagram_posts if they exist in deleted_posts)
export const cleanupDuplicates = async () => {
  try {
    console.log('🧹 Starting duplicate cleanup process...');
    
    // Get all events from deleted_posts
    const deletedSnapshot = await getDocs(collection(db, 'deleted_posts'));
    const deletedEvents = deletedSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('🧹 Found', deletedEvents.length, 'events in deleted_posts');
    
    // Get all events from Instagram_posts
    const instagramSnapshot = await getDocs(collection(db, 'Instagram_posts'));
    const instagramEvents = instagramSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('🧹 Found', instagramEvents.length, 'events in Instagram_posts');
    
    let removedCount = 0;
    
    // Check each Instagram_posts event
    for (const instagramEvent of instagramEvents) {
      // Check if this event exists in deleted_posts
      const existsInDeleted = deletedEvents.find(deletedEvent => 
        deletedEvent.id === instagramEvent.id || 
        (deletedEvent.title === instagramEvent.title && deletedEvent.username === instagramEvent.username)
      );
      
      if (existsInDeleted) {
        console.log('🧹 Found duplicate:', instagramEvent.title, '- removing from Instagram_posts');
        try {
          await deleteDoc(doc(db, 'Instagram_posts', instagramEvent.id));
          removedCount++;
          console.log('✅ Removed duplicate:', instagramEvent.title);
        } catch (error) {
          console.error('❌ Error removing duplicate:', instagramEvent.title, error);
        }
      }
    }
    
    console.log('✅ Cleanup completed. Removed', removedCount, 'duplicates from Instagram_posts');
    return removedCount;
  } catch (error) {
    console.error('❌ Error in cleanup process:', error);
    return 0;
  }
}; 