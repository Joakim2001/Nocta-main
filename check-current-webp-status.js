const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nocta-d1113-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

async function checkCurrentWebPStatus() {
  try {
    console.log('🔍 Checking Current WebP Status...\n');
    
    // Check Instagram_posts collection
    console.log('📱 Checking Instagram_posts collection...');
    const snapshot = await db.collection('Instagram_posts').limit(10).get();
    
    if (snapshot.empty) {
      console.log('❌ No events found in Instagram_posts');
      return;
    }
    
    console.log(`📊 Found ${snapshot.docs.length} events to analyze\n`);
    
    let eventsWithWebP = 0;
    let eventsWithOriginalImages = 0;
    let eventsWithNoImages = 0;
    
    snapshot.docs.forEach((doc, index) => {
      const eventData = doc.data();
      const eventId = doc.id;
      const title = eventData.title || eventData.caption?.substring(0, 50) || 'No title';
      
      console.log(`\n📋 Event ${index + 1}: ${title}`);
      console.log(`  ID: ${eventId}`);
      
      // Check WebP fields
      const webPFields = [
        'webPImage0', 'webPImage1', 'webPImage2', 'webPImage3', 
        'webPImage4', 'webPImage5', 'webPImage6', 'webPDisplayurl'
      ];
      
      const hasWebP = webPFields.some(field => eventData[field]);
      const webPFieldsWithData = webPFields.filter(field => eventData[field]);
      
      if (hasWebP) {
        eventsWithWebP++;
        console.log(`  ✅ Has WebP images: ${webPFieldsWithData.length} fields`);
        webPFieldsWithData.forEach(field => {
          const value = eventData[field];
          if (value && value.startsWith('data:image/webp;base64,')) {
            console.log(`    ${field}: WebP data URL (${value.length} chars)`);
          } else {
            console.log(`    ${field}: ${value}`);
          }
        });
      } else {
        console.log(`  ❌ No WebP images found`);
      }
      
      // Check original image fields
      const originalFields = [
        'Image0', 'Image1', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6', 'Displayurl'
      ];
      
      const hasOriginalImages = originalFields.some(field => eventData[field]);
      const originalFieldsWithData = originalFields.filter(field => eventData[field]);
      
      if (hasOriginalImages) {
        eventsWithOriginalImages++;
        console.log(`  📸 Has original images: ${originalFieldsWithData.length} fields`);
        originalFieldsWithData.forEach(field => {
          const value = eventData[field];
          if (value && value.includes('instagram.com')) {
            console.log(`    ${field}: Instagram URL`);
          } else if (value && value.startsWith('http')) {
            console.log(`    ${field}: External URL`);
          } else if (value) {
            console.log(`    ${field}: ${value.substring(0, 50)}...`);
          }
        });
      } else {
        console.log(`  ❌ No original images found`);
        eventsWithNoImages++;
      }
      
      // Check if this event has the video URL from your console log
      const consoleVideoUrl = 'https://storage.googleapis.com/nocta_bucket/optimized_video_1754851298160_0_1cvv62pxu.mp4';
      const hasConsoleVideo = Object.values(eventData).some(value => 
        value === consoleVideoUrl
      );
      
      if (hasConsoleVideo) {
        console.log(`  🎬 Has console video URL: ${consoleVideoUrl}`);
      }
    });
    
    console.log('\n📊 SUMMARY:');
    console.log(`Total events analyzed: ${snapshot.docs.length}`);
    console.log(`Events with WebP images: ${eventsWithWebP}`);
    console.log(`Events with original images only: ${eventsWithOriginalImages}`);
    console.log(`Events with no images: ${eventsWithNoImages}`);
    
    if (eventsWithWebP === 0) {
      console.log('\n❌ CRITICAL ISSUE: No events have WebP images!');
      console.log('This explains why your images are loading slowly.');
      console.log('You need to run the WebP conversion script with the fixed field names.');
    } else if (eventsWithWebP < snapshot.docs.length) {
      console.log('\n⚠️  PARTIAL ISSUE: Some events have WebP images, others don\'t.');
      console.log('You need to run the WebP conversion for all events.');
    } else {
      console.log('\n✅ GOOD: All events have WebP images.');
      console.log('If loading is still slow, check the WebP image sizes.');
    }
    
    console.log('\n🎯 Next steps:');
    if (eventsWithWebP === 0) {
      console.log('1. Run the WebP conversion script with the fixed field names');
      console.log('2. Verify the script creates webPImage1, webPImage2, etc. fields');
      console.log('3. Test image loading performance');
    } else {
      console.log('1. Check why some events are missing WebP images');
      console.log('2. Verify WebP image sizes are smaller than originals');
      console.log('3. Test loading performance with WebP vs original');
    }
    
  } catch (error) {
    console.error('❌ Error checking WebP status:', error);
  }
}

// Run the check
checkCurrentWebPStatus();
