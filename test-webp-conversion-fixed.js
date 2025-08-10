const admin = require('firebase-admin');

// Initialize Firebase Admin (you'll need to set up your service account)
// const serviceAccount = require('./path-to-your-service-account.json');
// admin.initializeApp({
//   credential: admin.initializeApp(serviceAccount),
//   databaseURL: 'your-database-url'
// });

const db = admin.firestore();

async function testWebPConversion() {
  try {
    console.log('🧪 Testing WebP conversion with fixed field names...\n');
    
    // Get a single event to test
    const snapshot = await db.collection('Instagram_posts').limit(1).get();
    
    if (snapshot.empty) {
      console.log('❌ No events found to test');
      return;
    }
    
    const doc = snapshot.docs[0];
    const event = doc.data();
    
    console.log(`📊 Testing with event: ${event.id || 'No ID'}`);
    console.log(`Title: ${event.title || event.caption || 'No title'}\n`);
    
    // Check current state
    console.log('🔍 Current Image Fields:');
    const imageFields = [
      'Displayurl', 'Image0', 'Image1', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6'
    ];
    
    imageFields.forEach(field => {
      const value = event[field];
      if (value) {
        console.log(`  ${field}: ${value.substring(0, 50)}...`);
      } else {
        console.log(`  ${field}: ❌ Not available`);
      }
    });
    
    console.log('\n🔍 Current WebP Fields:');
    const webPFields = [
      'webPDisplayurl', 'webPImage0', 'webPImage1', 'webPImage2', 
      'webPImage3', 'webPImage4', 'webPImage5', 'webPImage6'
    ];
    
    webPFields.forEach(field => {
      const value = event[field];
      if (value) {
        console.log(`  ${field}: ${value.substring(0, 50)}...`);
      } else {
        console.log(`  ${field}: ❌ Not available`);
      }
    });
    
    console.log('\n🎯 Expected Result After Conversion:');
    console.log('  After running the fixed conversion script:');
    console.log('  - Original fields (Image1, Image2, etc.) should remain unchanged');
    console.log('  - New WebP fields (webPImage1, webPImage2, etc.) should be created');
    console.log('  - webpConversionComplete should be set to true');
    console.log('  - webpConversionDate should be set');
    
    console.log('\n📝 To test the conversion:');
    console.log('  1. Deploy the updated Firebase function');
    console.log('  2. Call the batchConvertExistingToWebP function');
    console.log('  3. Check that the WebP fields are created correctly');
    console.log('  4. Verify your app now uses the WebP images');
    
  } catch (error) {
    console.error('❌ Error testing WebP conversion:', error);
  }
}

// Run the test function
testWebPConversion();
