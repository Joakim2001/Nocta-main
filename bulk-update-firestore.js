const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, Timestamp } = require('firebase/firestore');

// CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyDH5VmKvzsnX8CemnNxKIvHrnMSE6o_JiY",
  authDomain: "nocta-d1113.firebaseapp.com",
  projectId: "nocta-d1113",
  storageBucket: "nocta_bucket.appspot.com",
  messagingSenderId: "292774630791",
  appId: "1:292774630791:web:fd99e5bb63f7fb8e196f22"
};

// Initialize Firebase Client
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Video URL fields to check
const VIDEO_FIELDS = ['videourl', 'videoUrl', 'VideoURL'];

// Helper function to check if a URL is already optimized
function isOptimized(url) {
  return url && url.includes('storage.googleapis.com');
}

// Helper function to check if a URL is from Instagram
function isInstagramUrl(url) {
  return url && (url.includes('instagram.com') || url.includes('cdninstagram.com'));
}

// Helper function to find optimized video in Storage
async function findOptimizedVideoInStorage(eventId, originalVideoUrl) {
  try {
    // Since we can't directly access Storage with client SDK, we'll check if the event
    // already has an optimizedVideourl field that might have been set previously
    // This is a fallback approach - the main optimization should happen through the Firebase Function
    
    // For now, return null and let the user know they need to run optimization first
    console.log(`   ⚠️  Cannot directly check Storage with client SDK`);
    console.log(`   💡 Run the video optimization process first to create optimized videos`);
    return null;
  } catch (error) {
    console.log(`   ⚠️  Could not search Storage for ${eventId}:`, error.message);
    return null;
  }
}

// Main function to find and update all events with unoptimized videos
async function updateAllFirestoreDocuments() {
  console.log('🔍 Scanning for events that need Firestore updates...');
  
  const collections = ['Instagram_posts', 'company-events'];
  const eventsToUpdate = [];
  
  for (const collectionName of collections) {
    console.log(`\n📊 Scanning collection: ${collectionName}`);
    
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      console.log(`   Found ${snapshot.docs.length} documents`);
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const eventId = docSnapshot.id;
        
        // Check if this event has unoptimized videos but no optimizedVideourl field
        let hasUnoptimizedVideo = false;
        let hasOptimizedField = !!(data.optimizedVideourl || data.webMVideourl);
        
        for (const field of VIDEO_FIELDS) {
          const videoUrl = data[field];
          if (videoUrl && typeof videoUrl === 'string' && videoUrl.trim() !== '') {
            if (isInstagramUrl(videoUrl)) {
              hasUnoptimizedVideo = true;
              break;
            }
          }
        }
        
        if (hasUnoptimizedVideo && !hasOptimizedField) {
          eventsToUpdate.push({
            collection: collectionName,
            eventId: eventId,
            title: data.title || data.caption || data.name || 'Unknown Event',
            data: data
          });
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning ${collectionName}:`, error.message);
    }
  }
  
  console.log(`\n📋 Found ${eventsToUpdate.length} events that need Firestore updates`);
  
  if (eventsToUpdate.length === 0) {
    console.log('✅ All events are already properly updated!');
    return;
  }
  
  console.log('\n💡 NOTE: This script can only update Firestore documents.');
  console.log('   To create optimized videos, you must run the video optimization process first.');
  console.log('   Use: node bulk-video-optimization.js');
  
  // Process each event
  let updatedCount = 0;
  let failedCount = 0;
  
  for (let i = 0; i < eventsToUpdate.length; i++) {
    const event = eventsToUpdate[i];
    console.log(`\n🔄 [${i + 1}/${eventsToUpdate.length}] Processing: ${event.title}`);
    console.log(`   Event ID: ${event.eventId}`);
    console.log(`   Collection: ${event.collection}`);
    
    try {
      // Find the original video URL
      let originalVideoUrl = null;
      for (const field of VIDEO_FIELDS) {
        const videoUrl = event.data[field];
        if (videoUrl && typeof videoUrl === 'string' && videoUrl.trim() !== '') {
          if (isInstagramUrl(videoUrl)) {
            originalVideoUrl = videoUrl;
            console.log(`   📹 Original video: ${videoUrl.substring(0, 80)}...`);
            break;
          }
        }
      }
      
      if (!originalVideoUrl) {
        console.log(`   ⚠️  No Instagram video URL found, skipping...`);
        continue;
      }
      
      // Look for optimized video in Storage
      const optimizedUrl = await findOptimizedVideoInStorage(event.eventId, originalVideoUrl);
      
      if (optimizedUrl) {
        // Update Firestore with the optimized URL
        const updateData = {
          optimizedVideourl: optimizedUrl,
          videoOptimizationDate: Timestamp.now(),
          videoOptimizationStatus: 'completed',
          originalVideourl: originalVideoUrl // Keep original as backup
        };
        
        await updateDoc(doc(db, event.collection, event.eventId), updateData);
        console.log(`   ✅ Firestore updated successfully!`);
        console.log(`   🔗 Optimized URL: ${optimizedUrl.substring(0, 80)}...`);
        
        updatedCount++;
      } else {
        console.log(`   ❌ No optimized video found in Storage for this event`);
        console.log(`   💡 This event needs to go through the video optimization process first`);
        failedCount++;
      }
      
    } catch (error) {
      console.log(`   ❌ Error updating event:`, error.message);
      failedCount++;
    }
    
    // Small delay to avoid overwhelming Firestore
    if (i < eventsToUpdate.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Print final results
  console.log('\n' + '='.repeat(60));
  console.log('📊 FIRESTORE UPDATE COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Successfully updated: ${updatedCount}/${eventsToUpdate.length}`);
  console.log(`❌ Failed to update: ${failedCount}/${eventsToUpdate.length}`);
  
  if (failedCount > 0) {
    console.log('\n💡 For failed updates, you need to:');
    console.log('   1. Run the video optimization process first: node bulk-video-optimization.js');
    console.log('   2. This will create optimized videos in Firebase Storage');
    console.log('   3. Then run this script again to update Firestore documents');
  }
  
  console.log('\n🎉 Process complete! Check your app to see the updated video URLs.');
}

// Function to just check status without updating
async function checkStatus() {
  console.log('🔍 Checking Firestore update status...\n');
  
  const collections = ['Instagram_posts', 'company-events'];
  let totalEvents = 0;
  let eventsWithOptimizedVideos = 0;
  let eventsNeedingUpdates = 0;
  
  for (const collectionName of collections) {
    console.log(`📊 Collection: ${collectionName}`);
    
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      const collectionTotal = snapshot.docs.length;
      totalEvents += collectionTotal;
      
      let collectionOptimized = 0;
      let collectionNeedingUpdates = 0;
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        
        // Check if event has optimized videos
        const hasOptimizedField = !!(data.optimizedVideourl || data.webMVideourl);
        if (hasOptimizedField) {
          collectionOptimized++;
          eventsWithOptimizedVideos++;
        }
        
        // Check if event needs updates
        let hasUnoptimizedVideo = false;
        for (const field of VIDEO_FIELDS) {
          const videoUrl = data[field];
          if (videoUrl && typeof videoUrl === 'string' && videoUrl.trim() !== '') {
            if (isInstagramUrl(videoUrl)) {
              hasUnoptimizedVideo = true;
              break;
            }
          }
        }
        
        if (hasUnoptimizedVideo && !hasOptimizedField) {
          collectionNeedingUpdates++;
          eventsNeedingUpdates++;
        }
      }
      
      console.log(`   Total events: ${collectionTotal}`);
      console.log(`   Events with optimized videos: ${collectionOptimized}`);
      console.log(`   Events needing updates: ${collectionNeedingUpdates}`);
      
    } catch (error) {
      console.error(`   ❌ Error scanning ${collectionName}:`, error.message);
    }
  }
  
  console.log(`\n📊 OVERALL STATUS:`);
  console.log(`   Total events: ${totalEvents}`);
  console.log(`   Events with optimized videos: ${eventsWithOptimizedVideos}`);
  console.log(`   Events needing updates: ${eventsNeedingUpdates}`);
  console.log(`   Optimization rate: ${totalEvents > 0 ? Math.round((eventsWithOptimizedVideos / totalEvents) * 100) : 0}%`);
  
  if (eventsNeedingUpdates > 0) {
    console.log(`\n💡 To optimize videos, run: node bulk-video-optimization.js`);
    console.log(`   To update Firestore only: node bulk-update-firestore.js`);
  } else {
    console.log(`\n✅ All events are properly configured!`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--check') || args.includes('-c')) {
    await checkStatus();
  } else {
    await updateAllFirestoreDocuments();
  }
  
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  updateAllFirestoreDocuments,
  checkStatus
};
