const admin = require('firebase-admin');

// Initialize Firebase Admin (you'll need to set up your service account)
// const serviceAccount = require('./path-to-your-service-account.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: 'your-database-url'
// });

const db = admin.firestore();

async function debugEventVideoMismatch() {
  try {
    console.log('🔍 Debugging Event Video Mismatch...\n');
    
    // The event ID from your console log
    const eventId = '3694540404527611000';
    console.log(`🎯 Checking event ID: ${eventId}\n`);
    
    // Check in Instagram_posts collection
    console.log('📱 Checking Instagram_posts collection...');
    let docSnap = await db.collection('Instagram_posts').doc(eventId).get();
    
    if (docSnap.exists()) {
      const eventData = docSnap.data();
      console.log('✅ Found in Instagram_posts');
      console.log('📊 Event data:', {
        id: docSnap.id,
        title: eventData.title || eventData.caption?.substring(0, 50),
        // Video fields
        optimizedVideourl: eventData.optimizedVideourl,
        webMVideourl: eventData.webMVideourl,
        videourl: eventData.videourl,
        videoUrl: eventData.videoUrl,
        VideoURL: eventData.VideoURL,
        // Image fields
        Image0: eventData.Image0,
        Image1: eventData.Image1,
        Image2: eventData.Image2,
        Image3: eventData.Image3,
        Image4: eventData.Image4,
        Image5: eventData.Image5,
        Image6: eventData.Image6,
        Displayurl: eventData.Displayurl,
        // WebP fields
        webPImage0: eventData.webPImage0,
        webPImage1: eventData.webPImage1,
        webPImage2: eventData.webPImage2,
        webPImage3: eventData.webPImage3,
        webPImage4: eventData.webPImage4,
        webPImage5: eventData.webPImage5,
        webPImage6: eventData.webPImage6,
        webPDisplayurl: eventData.webPDisplayurl
      });
      
      // Check if any video fields contain the URL from console
      const consoleVideoUrl = 'https://storage.googleapis.com/nocta_bucket/optimized_video_1754851298160_0_1cvv62pxu.mp4';
      console.log('\n🔍 Looking for console video URL:', consoleVideoUrl);
      
      const videoFields = [
        'optimizedVideourl', 'webMVideourl', 'videourl', 'videoUrl', 'VideoURL'
      ];
      
      let foundInField = null;
      videoFields.forEach(field => {
        if (eventData[field] === consoleVideoUrl) {
          foundInField = field;
        }
      });
      
      if (foundInField) {
        console.log(`✅ Found console video URL in field: ${foundInField}`);
      } else {
        console.log('❌ Console video URL NOT found in any video fields');
        console.log('🔍 Checking if it exists in any field...');
        
        const allFields = Object.keys(eventData);
        const matchingFields = allFields.filter(field => 
          eventData[field] && eventData[field].includes('optimized_video_1754851298160_0_1cvv62pxu.mp4')
        );
        
        if (matchingFields.length > 0) {
          console.log(`🔍 Found in other fields: ${matchingFields.join(', ')}`);
          matchingFields.forEach(field => {
            console.log(`  ${field}: ${eventData[field]}`);
          });
        } else {
          console.log('❌ Video URL not found anywhere in the event data');
        }
      }
      
    } else {
      console.log('❌ Not found in Instagram_posts');
    }
    
    // Also check company-events collection
    console.log('\n🏢 Checking company-events collection...');
    docSnap = await db.collection('company-events').doc(eventId).get();
    
    if (docSnap.exists()) {
      const eventData = docSnap.data();
      console.log('✅ Found in company-events');
      console.log('📊 Event data:', {
        id: docSnap.id,
        title: eventData.title || eventData.caption?.substring(0, 50),
        // Video fields
        optimizedVideourl: eventData.optimizedVideourl,
        webMVideourl: eventData.webMVideourl,
        videourl: eventData.videourl,
        videoUrl: eventData.videoUrl,
        VideoURL: eventData.VideoURL,
        // Image fields
        imageUrls: eventData.imageUrls,
        Image0: eventData.Image0,
        Image1: eventData.Image1,
        Image2: eventData.Image2,
        Image3: eventData.Image3,
        Image4: eventData.Image4,
        Image5: eventData.Image5,
        Image6: eventData.Image6,
        Displayurl: eventData.Displayurl
      });
    } else {
      console.log('❌ Not found in company-events');
    }
    
    console.log('\n🎯 Summary:');
    console.log('The EventCard found a video URL but EventDetailPage shows undefined.');
    console.log('This suggests either:');
    console.log('1. The video URL exists in the database but EventDetailPage is not reading it correctly');
    console.log('2. The EventCard is reading from cached/stale data');
    console.log('3. There\'s a data inconsistency between collections');
    
  } catch (error) {
    console.error('❌ Error debugging event video mismatch:', error);
  }
}

// Run the debug function
debugEventVideoMismatch();
