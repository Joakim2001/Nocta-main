const admin = require('firebase-admin');
const axios = require('axios');
const path = require('path');

// Initialize Firebase Admin SDK (using default credentials from Firebase CLI)
try {
  // Clear any existing apps to avoid conflicts
  if (admin.apps.length > 0) {
    admin.apps.forEach(app => app.delete());
  }
  
  admin.initializeApp({
    projectId: 'nocta-d1113'
  });
  
  console.log('✅ Firebase Admin SDK initialized successfully using CLI credentials');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  process.exit(1);
}

const db = admin.firestore();

// CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyDH5VmKvzsnX8CemnNxKIvHrnMSE6o_JiY",
  authDomain: "nocta-d1113.firebaseapp.com",
  projectId: "nocta-d1113",
  storageBucket: "nocta_bucket.appspot.com",
  messagingSenderId: "292774630791",
  appId: "1:292774630791:web:fd99e5bb63f7fb8e196f22"
};

// Configuration
const BATCH_SIZE = 5; // Process videos in batches to avoid overwhelming the function
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches
const DELAY_BETWEEN_VIDEOS = 1000; // 1 second between individual videos

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

// Helper function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function to find all events with unoptimized videos
async function findUnoptimizedVideos() {
  console.log('🔍 Scanning for events with unoptimized videos...');
  
  const collections = ['Instagram_posts', 'company-events'];
  const unoptimizedEvents = [];
  
  for (const collectionName of collections) {
    console.log(`\n📊 Scanning collection: ${collectionName}`);
    
    try {
      const snapshot = await db.collection(collectionName).get();
      console.log(`   Found ${snapshot.docs.length} documents`);
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const eventId = docSnapshot.id;
        
        // Check all video fields
        for (const field of VIDEO_FIELDS) {
          const videoUrl = data[field];
          
          if (videoUrl && typeof videoUrl === 'string' && videoUrl.trim() !== '') {
            if (isInstagramUrl(videoUrl) && !isOptimized(videoUrl)) {
              unoptimizedEvents.push({
                collection: collectionName,
                eventId: eventId,
                field: field,
                videoUrl: videoUrl,
                title: data.title || data.caption || data.name || 'Unknown Event',
                hasOptimizedField: !!(data.optimizedVideourl || data.webMVideourl)
              });
              break; // Only count each event once
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning ${collectionName}:`, error.message);
    }
  }
  
  console.log(`\n📋 Found ${unoptimizedEvents.length} events with unoptimized videos`);
  return unoptimizedEvents;
}

// Function to optimize a single video
async function optimizeVideo(event, batchIndex, totalInBatch) {
  const { collection: collectionName, eventId, field, videoUrl, title } = event;
  
  console.log(`\n🎬 [${batchIndex + 1}/${totalInBatch}] Optimizing video for event: ${title}`);
  console.log(`   Event ID: ${eventId}`);
  console.log(`   Collection: ${collectionName}`);
  console.log(`   Field: ${field}`);
  console.log(`   Video URL: ${videoUrl.substring(0, 80)}...`);
  
  try {
    // Call the optimizeVideos function
    const functionUrl = `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/optimizeVideos`;
    
    console.log(`   📡 Calling optimizeVideos function...`);
    const response = await axios.post(functionUrl, {
      videos: [videoUrl]
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 300000 // 5 minutes timeout
    });
    
    if (response.data && response.data.optimizedVideos && response.data.optimizedVideos.length > 0) {
      const optimizedUrl = response.data.optimizedVideos[0];
      console.log(`   ✅ Video optimized successfully!`);
      console.log(`   🔗 Optimized URL: ${optimizedUrl.substring(0, 80)}...`);
      
      // Update Firestore with the optimized URL
      try {
        const updateData = {
          optimizedVideourl: optimizedUrl,
          videoOptimizationDate: admin.firestore.FieldValue.serverTimestamp(),
          videoOptimizationStatus: 'completed',
          [`${field}_original`]: videoUrl // Keep original as backup
        };
        
        await db.collection(collectionName).doc(eventId).update(updateData);
        console.log(`   💾 Firestore updated successfully!`);
        
        return {
          success: true,
          eventId,
          optimizedUrl,
          originalUrl: videoUrl
        };
        
      } catch (updateError) {
        console.log(`   ⚠️  Video optimized but Firestore update failed:`, updateError.message);
        console.log(`   💡 You can manually update the document later with optimizedVideourl: ${optimizedUrl}`);
        
        return {
          success: true,
          eventId,
          optimizedUrl,
          originalUrl: videoUrl,
          firestoreUpdateFailed: true
        };
      }
      
    } else {
      console.log(`   ❌ No optimized URLs returned from function`);
      return {
        success: false,
        eventId,
        error: 'No optimized URLs returned'
      };
    }
    
  } catch (error) {
    console.log(`   ❌ Error optimizing video:`, error.message);
    return {
      success: false,
      eventId,
      error: error.message
    };
  }
}

// Main function to process all unoptimized videos
async function processAllVideos() {
  try {
    // Find all unoptimized videos
    const unoptimizedEvents = await findUnoptimizedVideos();
    
    if (unoptimizedEvents.length === 0) {
      console.log('\n✅ No unoptimized videos found! All videos are already optimized.');
      return;
    }
    
    console.log('\n🚀 Starting bulk video optimization process...');
    console.log(`📊 Total videos to process: ${unoptimizedEvents.length}`);
    console.log(`⚙️  Batch size: ${BATCH_SIZE}`);
    console.log(`⏱️  Delay between batches: ${DELAY_BETWEEN_BATCHES}ms`);
    console.log(`⏱️  Delay between videos: ${DELAY_BETWEEN_VIDEOS}ms`);
    
    // Process videos in batches
    const results = {
      total: unoptimizedEvents.length,
      successful: 0,
      failed: 0,
      firestoreUpdateFailed: 0,
      details: []
    };
    
    for (let i = 0; i < unoptimizedEvents.length; i += BATCH_SIZE) {
      const batch = unoptimizedEvents.slice(i, i + BATCH_SIZE);
      const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(unoptimizedEvents.length / BATCH_SIZE);
      
      console.log(`\n📦 Processing batch ${batchIndex}/${totalBatches} (${batch.length} videos)`);
      
      // Process each video in the batch
      for (let j = 0; j < batch.length; j++) {
        const event = batch[j];
        const result = await optimizeVideo(event, j, batch.length);
        
        results.details.push(result);
        
        if (result.success) {
          results.successful++;
          if (result.firestoreUpdateFailed) {
            results.firestoreUpdateFailed++;
          }
        } else {
          results.failed++;
        }
        
        // Delay between videos (except for the last one in the batch)
        if (j < batch.length - 1) {
          await delay(DELAY_BETWEEN_VIDEOS);
        }
      }
      
      // Delay between batches (except for the last batch)
      if (i + BATCH_SIZE < unoptimizedEvents.length) {
        console.log(`\n⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }
    
    // Print final results
    console.log('\n' + '='.repeat(60));
    console.log('📊 BULK VIDEO OPTIMIZATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Successfully optimized: ${results.successful}/${results.total}`);
    console.log(`❌ Failed to optimize: ${results.failed}/${results.total}`);
    console.log(`⚠️  Firestore update failed: ${results.firestoreUpdateFailed}/${results.total}`);
    
    if (results.firestoreUpdateFailed > 0) {
      console.log('\n💡 For events where Firestore update failed, you can manually update them:');
      results.details
        .filter(r => r.success && r.firestoreUpdateFailed)
        .forEach(r => {
          console.log(`   Event ${r.eventId}: Set optimizedVideourl to "${r.optimizedUrl}"`);
        });
    }
    
    console.log('\n🎉 Process complete! Check your app to see the optimized videos.');
    
  } catch (error) {
    console.error('\n❌ Fatal error in bulk video optimization:', error);
  }
}

// Function to just check status without processing
async function checkStatus() {
  console.log('🔍 Checking video optimization status...\n');
  
  const unoptimizedEvents = await findUnoptimizedVideos();
  
  if (unoptimizedEvents.length === 0) {
    console.log('✅ All videos are already optimized!');
    return;
  }
  
  console.log('📋 Events with unoptimized videos:');
  unoptimizedEvents.forEach((event, index) => {
    console.log(`\n${index + 1}. ${event.title}`);
    console.log(`   ID: ${event.eventId}`);
    console.log(`   Collection: ${event.collection}`);
    console.log(`   Field: ${event.field}`);
    console.log(`   Video: ${event.videoUrl.substring(0, 80)}...`);
    console.log(`   Has optimized field: ${event.hasOptimizedField ? 'Yes' : 'No'}`);
  });
  
  console.log(`\n📊 Total: ${unoptimizedEvents.length} events need optimization`);
  console.log('\n💡 Run this script without --check to start optimization');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--check') || args.includes('-c')) {
    await checkStatus();
  } else {
    await processAllVideos();
  }
  
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  findUnoptimizedVideos,
  processAllVideos,
  checkStatus
};
