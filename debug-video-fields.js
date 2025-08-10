// Debug script to check video fields in events
// Run this to see what video fields exist and their values

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, limit } = require('firebase/firestore');

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

async function debugVideoFields() {
  try {
    console.log('🔍 Checking video fields in events...\n');
    
    // Check Instagram_posts collection first
    console.log('📸 Checking Instagram_posts collection...');
    const instagramSnapshot = await getDocs(collection(db, 'Instagram_posts'));
    
    let videoEventsFound = 0;
    let optimizedVideosFound = 0;
    let eventsWithActualVideos = 0;
    
    instagramSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      
      // Check for any video-related fields
      const videoFields = Object.keys(data).filter(key => 
        key.toLowerCase().includes('video') || key.toLowerCase().includes('videourl')
      );
      
      if (videoFields.length > 0) {
        videoEventsFound++;
        console.log(`\n🎬 Event ${index + 1} (ID: ${doc.id}):`);
        console.log(`   Title: ${data.title || data.caption?.substring(0, 50) || 'No title'}`);
        
        let hasActualVideo = false;
        
        videoFields.forEach(field => {
          const value = data[field];
          
          // Handle null/undefined values safely
          if (value && typeof value === 'string') {
            const isOptimized = value.includes('storage.googleapis.com');
            const isInstagram = value.includes('instagram.com') || value.includes('cdninstagram.com');
            
            console.log(`   ${field}: ${value.substring(0, 80)}...`);
            console.log(`     └─ Optimized (Storage): ${isOptimized ? '✅ YES' : '❌ NO'}`);
            console.log(`     └─ Instagram URL: ${isInstagram ? '✅ YES' : '❌ NO'}`);
            
            if (isOptimized) optimizedVideosFound++;
            if (value.trim() !== '') hasActualVideo = true;
          } else {
            console.log(`   ${field}: ${value === null ? 'null' : value === undefined ? 'undefined' : typeof value}`);
          }
        });
        
        // Check priority order
        const videoUrl = data.optimizedVideourl || data.webMVideourl || data.videourl || data.videoUrl || data.VideoURL;
        console.log(`   Final video URL: ${videoUrl ? (typeof videoUrl === 'string' ? videoUrl.substring(0, 80) + '...' : videoUrl) : 'null'}`);
        
        if (videoUrl && typeof videoUrl === 'string' && videoUrl.includes('storage.googleapis.com')) {
          console.log('   🎉 SUCCESS: Using optimized video from Firebase Storage!');
        } else if (videoUrl && typeof videoUrl === 'string' && (videoUrl.includes('instagram.com') || videoUrl.includes('cdninstagram.com'))) {
          console.log('   ⚠️  WARNING: Still using Instagram URL (not optimized)');
        } else if (videoUrl && typeof videoUrl === 'string' && videoUrl.trim() !== '') {
          console.log('   ℹ️  INFO: Using other video URL');
        } else {
          console.log('   ❌ No video URL found');
        }
        
        if (hasActualVideo) eventsWithActualVideos++;
      }
    });
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total events with video fields: ${videoEventsFound}`);
    console.log(`   Events with actual video URLs: ${eventsWithActualVideos}`);
    console.log(`   Events with optimized videos: ${optimizedVideosFound}`);
    console.log(`   Optimization rate: ${eventsWithActualVideos > 0 ? Math.round((optimizedVideosFound / eventsWithActualVideos) * 100) : 0}%`);
    
    // Also check company-events collection
    console.log('\n🏢 Checking company-events collection...');
    const companySnapshot = await getDocs(collection(db, 'company-events'));
    
    let companyVideoEvents = 0;
    let companyOptimizedVideos = 0;
    let companyEventsWithActualVideos = 0;
    
    companySnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      
      const videoFields = Object.keys(data).filter(key => 
        key.toLowerCase().includes('video') || key.toLowerCase().includes('videourl')
      );
      
      if (videoFields.length > 0) {
        companyVideoEvents++;
        console.log(`\n🎬 Company Event ${index + 1} (ID: ${doc.id}):`);
        console.log(`   Title: ${data.title || 'No title'}`);
        
        let hasActualVideo = false;
        
        videoFields.forEach(field => {
          const value = data[field];
          
          if (value && typeof value === 'string') {
            const isOptimized = value.includes('storage.googleapis.com');
            const isInstagram = value.includes('instagram.com') || value.includes('cdninstagram.com');
            
            console.log(`   ${field}: ${value.substring(0, 80)}...`);
            console.log(`     └─ Optimized (Storage): ${isOptimized ? '✅ YES' : '❌ NO'}`);
            console.log(`     └─ Instagram URL: ${isInstagram ? '✅ YES' : '❌ NO'}`);
            
            if (isOptimized) companyOptimizedVideos++;
            if (value.trim() !== '') hasActualVideo = true;
          } else {
            console.log(`   ${field}: ${value === null ? 'null' : value === undefined ? 'undefined' : typeof value}`);
          }
        });
        
        if (hasActualVideo) companyEventsWithActualVideos++;
      }
    });
    
    console.log(`\n📊 COMPANY EVENTS SUMMARY:`);
    console.log(`   Total company events with video fields: ${companyVideoEvents}`);
    console.log(`   Company events with actual video URLs: ${companyEventsWithActualVideos}`);
    console.log(`   Company events with optimized videos: ${companyOptimizedVideos}`);
    console.log(`   Company optimization rate: ${companyEventsWithActualVideos > 0 ? Math.round((companyOptimizedVideos / companyEventsWithActualVideos) * 100) : 0}%`);
    
    // Check if there are any events with actual video content
    if (eventsWithActualVideos === 0 && companyEventsWithActualVideos === 0) {
      console.log('\n⚠️  WARNING: No events with actual video content found!');
      console.log('   This means either:');
      console.log('   1. All video fields are null/empty');
      console.log('   2. Videos are stored in different field names');
      console.log('   3. Videos need to be imported/created first');
    }
    
  } catch (error) {
    console.error('❌ Error debugging video fields:', error);
  }
}

// Run the debug function
debugVideoFields();
