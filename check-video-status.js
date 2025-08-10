// Check if the optimized video is accessible and manually update Firestore
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

async function checkVideoStatus() {
  try {
    const eventId = '3695990466059590433';
    const optimizedVideoUrl = 'https://storage.googleapis.com/nocta_bucket/optimized_video_1754841015187_0_rvvy8ey1z.mp4';
    
    console.log('🔍 Checking video status...');
    console.log('Event ID:', eventId);
    console.log('Optimized Video URL:', optimizedVideoUrl);
    
    // 1. Check if the optimized video is accessible
    console.log('\n🎬 Testing optimized video accessibility...');
    try {
      const videoResponse = await axios.head(optimizedVideoUrl, { timeout: 10000 });
      console.log('✅ Optimized video is accessible!');
      console.log('   Status:', videoResponse.status);
      console.log('   Content-Type:', videoResponse.headers['content-type']);
      console.log('   Content-Length:', videoResponse.headers['content-length']);
    } catch (error) {
      console.log('❌ Optimized video is NOT accessible:', error.message);
      return;
    }
    
    // 2. Get current event data
    console.log('\n📋 Getting current event data...');
    const eventRef = doc(db, 'Instagram_posts', eventId);
    const eventSnap = await getDoc(eventRef);
    
    if (!eventSnap.exists()) {
      console.log('❌ Event not found');
      return;
    }
    
    const eventData = eventSnap.data();
    console.log('Current video fields:', {
      videourl: eventData.videourl,
      optimizedVideourl: eventData.optimizedVideourl,
      videoUrl: eventData.videoUrl,
      VideoURL: eventData.VideoURL
    });
    
    // 3. Try to manually update the document
    console.log('\n🔄 Attempting to update Firestore document...');
    
    const updateData = {
      optimizedVideourl: optimizedVideoUrl,
      videoOptimizationDate: new Date().toISOString(),
      videoOptimizationStatus: 'completed',
      originalVideourl: eventData.videourl // Keep original for reference
    };
    
    try {
      await updateDoc(eventRef, updateData);
      console.log('✅ Successfully updated Firestore document!');
      
      // 4. Verify the update
      console.log('\n🔍 Verifying the update...');
      const updatedSnap = await getDoc(eventRef);
      const updatedData = updatedSnap.data();
      
      console.log('Updated video fields:', {
        originalVideourl: updatedData.originalVideourl,
        newOptimizedVideourl: updatedData.optimizedVideourl,
        optimizationDate: updatedData.videoOptimizationDate,
        optimizationStatus: updatedData.videoOptimizationStatus
      });
      
      // 5. Test the priority system
      const videoUrl = updatedData.optimizedVideourl || updatedData.webMVideourl || updatedData.videourl || updatedData.videoUrl || updatedData.VideoURL;
      console.log('\n🎯 Testing video URL priority system...');
      console.log('Final selected video URL:', videoUrl);
      
      if (videoUrl && videoUrl.includes('storage.googleapis.com')) {
        console.log('🎉 SUCCESS: App will now use optimized video from Firebase Storage!');
        console.log('   This means faster loading, no expiration, and better performance.');
      } else if (videoUrl && (videoUrl.includes('instagram.com') || videoUrl.includes('cdninstagram.com'))) {
        console.log('⚠️  WARNING: App is still using Instagram URL');
      } else {
        console.log('❌ No video URL found');
      }
      
    } catch (updateError) {
      console.log('❌ Failed to update Firestore document:', updateError.message);
      console.log('   This might be due to security rules or permissions.');
      console.log('   However, the video WAS successfully optimized and is accessible.');
    }
    
  } catch (error) {
    console.error('❌ Error checking video status:', error);
  }
}

// Run the check
checkVideoStatus(); 