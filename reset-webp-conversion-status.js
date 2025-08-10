const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nocta-d1113-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

async function resetWebPConversionStatus() {
  try {
    console.log('🔄 Resetting WebP Conversion Status...\n');
    
    // Get all documents from Instagram_posts
    const snapshot = await db.collection('Instagram_posts').get();
    
    if (snapshot.empty) {
      console.log('❌ No events found in Instagram_posts');
      return;
    }
    
    console.log(`📊 Found ${snapshot.docs.length} total events\n`);
    
    let resetCount = 0;
    let skipCount = 0;
    
    for (const doc of snapshot.docs) {
      const eventData = doc.data();
      const eventId = doc.id;
      const title = eventData.title || eventData.caption?.substring(0, 50) || 'No title';
      
      console.log(`\n📋 Event: ${title}`);
      console.log(`  ID: ${eventId}`);
      
      // Check if it has the webpConversionComplete field
      const hasWebPComplete = eventData.webpConversionComplete;
      console.log(`  Current webpConversionComplete: ${hasWebPComplete}`);
      
      // Check if it has any WebP images
      const webPFields = [
        'webPImage0', 'webPImage1', 'webPImage2', 'webPImage3', 
        'webPImage4', 'webPImage5', 'webPImage6', 'webPDisplayurl'
      ];
      
      const hasWebP = webPFields.some(field => eventData[field]);
      console.log(`  Has WebP images: ${hasWebP}`);
      
      // If it's marked as complete but has no WebP images, reset it
      if (hasWebPComplete === true && !hasWebP) {
        console.log(`  🔄 Resetting webpConversionComplete for this event...`);
        
        try {
          await db.collection('Instagram_posts').doc(eventId).update({
            webpConversionComplete: false
          });
          console.log(`  ✅ Successfully reset webpConversionComplete to false`);
          resetCount++;
        } catch (error) {
          console.error(`  ❌ Error resetting: ${error.message}`);
        }
      } else if (hasWebPComplete === true && hasWebP) {
        console.log(`  ✅ Correctly marked as complete (has WebP images)`);
        skipCount++;
      } else {
        console.log(`  ℹ️  No conversion status to reset`);
        skipCount++;
      }
    }
    
    console.log('\n📊 SUMMARY:');
    console.log(`Total events processed: ${snapshot.docs.length}`);
    console.log(`Events reset: ${resetCount}`);
    console.log(`Events skipped: ${skipCount}`);
    
    if (resetCount > 0) {
      console.log('\n🎉 Successfully reset conversion status!');
      console.log('Now you can run the WebP conversion script again.');
      console.log('The events that were incorrectly marked as complete will be processed.');
    } else {
      console.log('\nℹ️  No events needed resetting.');
    }
    
  } catch (error) {
    console.error('❌ Error resetting WebP conversion status:', error);
  }
}

resetWebPConversionStatus().then(() => {
  console.log('\n✅ Reset script completed!');
}).catch(error => {
  console.error('❌ Fatal error:', error);
});
