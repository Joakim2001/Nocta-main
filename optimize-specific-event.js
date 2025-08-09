const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function optimizeSpecificEvent(eventId) {
  try {
    console.log(`🔍 Optimizing video for event: ${eventId}`);
    
    // Get the event document
    const eventDoc = await db.collection('Instagram_posts').doc(eventId).get();
    
    if (!eventDoc.exists) {
      console.log('❌ Event not found');
      return;
    }
    
    const eventData = eventDoc.data();
    console.log('📄 Event data:', {
      id: eventData.id,
      title: eventData.title,
      videourl: eventData.videourl
    });
    
    // Check if video exists
    if (!eventData.videourl) {
      console.log('❌ No video URL found in event');
      return;
    }
    
    // Call the optimizeVideos function
    const functions = admin.functions();
    const optimizeVideos = functions.httpsCallable('optimizeVideos');
    
    console.log('🚀 Calling optimizeVideos function...');
    const result = await optimizeVideos({
      videos: [eventData.videourl]
    });
    
    console.log('✅ Optimization result:', result.data);
    
    if (result.data.success && result.data.optimizedVideos && result.data.optimizedVideos.length > 0) {
      const optimizedVideoUrl = result.data.optimizedVideos[0];
      
      // Update the event document with the optimized video URL
      await eventDoc.ref.update({
        optimizedVideourl: optimizedVideoUrl,
        videoOptimizationComplete: true,
        videoOptimizationDate: admin.firestore.Timestamp.now(),
        optimizedInN8n: true
      });
      
      console.log('✅ Event updated with optimized video URL:', optimizedVideoUrl);
    } else {
      console.log('❌ Video optimization failed:', result.data);
    }
    
  } catch (error) {
    console.error('❌ Error optimizing event:', error);
  }
}

// Optimize the specific event
const eventId = '3524973568157937700';
optimizeSpecificEvent(eventId); 