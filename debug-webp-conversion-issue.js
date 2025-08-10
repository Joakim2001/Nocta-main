const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nocta-d1113-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

async function debugWebPConversionIssue() {
  try {
    console.log('🔍 Debugging WebP Conversion Issue...\n');
    
    // Get all documents from Instagram_posts
    const snapshot = await db.collection('Instagram_posts').get();
    
    if (snapshot.empty) {
      console.log('❌ No events found in Instagram_posts');
      return;
    }
    
    console.log(`📊 Found ${snapshot.docs.length} total events\n`);
    
    snapshot.docs.forEach((doc, index) => {
      const eventData = doc.data();
      const eventId = doc.id;
      const title = eventData.title || eventData.caption?.substring(0, 50) || 'No title';
      
      console.log(`\n📋 Event ${index + 1}: ${title}`);
      console.log(`  ID: ${eventId}`);
      
      // Check if it has the webpConversionComplete field
      const hasWebPComplete = eventData.webpConversionComplete;
      console.log(`  webpConversionComplete: ${hasWebPComplete}`);
      
      // Check if it has any WebP images
      const webPFields = [
        'webPImage0', 'webPImage1', 'webPImage2', 'webPImage3', 
        'webPImage4', 'webPImage5', 'webPImage6', 'webPDisplayurl'
      ];
      
      const hasWebP = webPFields.some(field => eventData[field]);
      console.log(`  Has WebP images: ${hasWebP}`);
      
      if (hasWebP) {
        const webPFieldsWithData = webPFields.filter(field => eventData[field]);
        console.log(`    WebP fields found: ${webPFieldsWithData.join(', ')}`);
      }
      
      // Check if it has original images that could be converted
      const originalFields = [
        'Image0', 'Image1', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6', 'Displayurl'
      ];
      
      const hasOriginalImages = originalFields.some(field => eventData[field]);
      console.log(`  Has original images: ${hasOriginalImages}`);
      
      if (hasOriginalImages) {
        const originalFieldsWithData = originalFields.filter(field => eventData[field]);
        console.log(`    Original fields found: ${originalFieldsWithData.join(', ')}`);
      }
      
      // Check if this event should be converted
      const shouldBeConverted = hasOriginalImages && !hasWebP;
      console.log(`  Should be converted: ${shouldBeConverted}`);
      
      if (shouldBeConverted && hasWebPComplete) {
        console.log(`  ⚠️  ISSUE: This event has webpConversionComplete=true but no WebP images!`);
        console.log(`     This explains why conversion is being skipped.`);
      }
    });
    
    console.log('\n💡 ANALYSIS:');
    console.log('If you see events with webpConversionComplete=true but no WebP images,');
    console.log('this means the conversion function is incorrectly marking them as complete.');
    console.log('You may need to reset the webpConversionComplete field for these events.');
    
  } catch (error) {
    console.error('❌ Error debugging WebP conversion:', error);
  }
}

debugWebPConversionIssue().then(() => {
  console.log('\n✅ Debug script completed!');
}).catch(error => {
  console.error('❌ Fatal error:', error);
});
