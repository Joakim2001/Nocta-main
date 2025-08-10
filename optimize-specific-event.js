// Optimize videos for a specific event
// This script will call the Firebase HTTP function to optimize videos for a specific event

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, updateDoc } = require('firebase/firestore');
const axios = require('axios');

const firebaseConfig = {
  apiKey: "AIzaSyDH5VmKvzsnX8CemnNxKIvHrnMSE6o_JiY",
  authDomain: "nocta-d1113.firebaseapp.com",
  projectId: "nocta-d1113",
  storageBucket: "nocta_bucket.appspot.com",
  messagingSenderId: "292774630791",
  appId: "1:292774630791:web:fd99e5bb63f7fb8e196f22"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function optimizeSpecificEvent() {
  try {
    // SPECIFIC EVENT ID THAT HAS A VIDEO
    const eventId = '3695990466059590433'; // "Dar Key at Karrusel, August 30"
    
    console.log(`🎬 Optimizing videos for event: ${eventId}`);
    
    // Get the event document
    const eventRef = doc(db, 'Instagram_posts', eventId);
    const eventSnap = await getDoc(eventRef);
    
    if (!eventSnap.exists()) {
      console.log('❌ Event not found');
      return;
    }
    
    const eventData = eventSnap.data();
    console.log('📋 Event data:', {
      title: eventData.title || eventData.caption?.substring(0, 50),
      videourl: eventData.videourl,
      videoUrl: eventData.videoUrl,
      VideoURL: eventData.VideoURL
    });
    
    // Collect all video URLs from the event
    const videos = [];
    if (eventData.videourl) videos.push(eventData.videourl);
    if (eventData.videoUrl) videos.push(eventData.videoUrl);
    if (eventData.VideoURL) videos.push(eventData.VideoURL);
    
    if (videos.length === 0) {
      console.log('❌ No videos found in this event');
      return;
    }
    
    console.log(`🎬 Found ${videos.length} video(s) to optimize:`, videos);
    
    // Call the optimizeVideos HTTP function
    console.log('🚀 Calling optimizeVideos HTTP function...');
    
    const functionUrl = `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/optimizeVideos`;
    console.log('🌐 Function URL:', functionUrl);
    
    const response = await axios.post(functionUrl, {
      videos: videos
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutes timeout
    });
    
    console.log('✅ Optimization result:', response.data);
    
    if (response.data.success) {
      // Update the event with the optimized video URL
      const optimizedVideoUrl = response.data.optimizedVideos[0];
      
      const updateData = {
        optimizedVideourl: optimizedVideoUrl,
        videoOptimizationDate: new Date().toISOString(),
        videoOptimizationStatus: 'completed'
      };
      
      await updateDoc(eventRef, updateData);
      console.log('✅ Event updated with optimized video URL:', optimizedVideoUrl);
      
      // Verify the update
      const updatedSnap = await getDoc(eventRef);
      const updatedData = updatedSnap.data();
      console.log('🔍 Verification - Updated event data:', {
        originalVideourl: eventData.videourl,
        newOptimizedVideourl: updatedData.optimizedVideourl,
        optimizationDate: updatedData.videoOptimizationDate
      });
      
    } else {
      console.log('❌ Optimization failed:', response.data.error);
    }
    
  } catch (error) {
    console.error('❌ Error optimizing event:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

// Run the optimization
optimizeSpecificEvent(); 