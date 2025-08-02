import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Filters out events that have been deleted by companies (exist in deleted_posts collection)
 * This ensures private users don't see events that companies have deleted
 * @param {Array} events - Array of events to filter
 * @returns {Array} - Filtered events excluding deleted ones
 */
export const filterOutDeletedEvents = async (events) => {
  try {
    // Fetch all deleted event IDs
    const deletedSnap = await getDocs(collection(db, "deleted_posts"));
    const deletedEventIds = new Set(deletedSnap.docs.map(doc => doc.id));
    
    console.log('🚫 Found', deletedEventIds.size, 'deleted events to exclude from private user view');
    
    // Filter out events that exist in deleted_posts
    const filteredEvents = events.filter(event => {
      const isDeleted = deletedEventIds.has(event.id);
      if (isDeleted) {
        console.log('🚫 Excluding deleted event from private view:', event.title || event.name);
      }
      return !isDeleted;
    });
    
    console.log('✅ Filtered events:', events.length, '→', filteredEvents.length, '(excluded', events.length - filteredEvents.length, 'deleted events)');
    
    return filteredEvents;
  } catch (error) {
    console.error('❌ Error filtering deleted events:', error);
    // Return original events if filtering fails
    return events;
  }
};

/**
 * Enhanced event fetching for private users that excludes deleted events
 * @param {Array} collections - Array of collection names to fetch from
 * @returns {Array} - Events excluding deleted ones
 */
export const fetchEventsForPrivateUsers = async (collections = ["Instagram_posts", "company-events"]) => {
  try {
    // Fetch events from specified collections
    const snapshots = await Promise.all(
      collections.map(collectionName => getDocs(collection(db, collectionName)))
    );
    
    // Merge all events
    let allEvents = [];
    snapshots.forEach((snap, index) => {
      const collectionEvents = snap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        sourceCollection: collections[index]
      }));
      allEvents = [...allEvents, ...collectionEvents];
    });
    
    // Filter out deleted events
    const filteredEvents = await filterOutDeletedEvents(allEvents);
    
    return filteredEvents;
  } catch (error) {
    console.error('❌ Error fetching events for private users:', error);
    return [];
  }
};