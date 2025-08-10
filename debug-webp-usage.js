const admin = require('firebase-admin');

// Initialize Firebase Admin (you'll need to set up your service account)
// const serviceAccount = require('./path-to-your-service-account.json');
// admin.initializeApp({
//   credential: admin.initializeApp(serviceAccount),
//   databaseURL: 'your-database-url'
// });

const db = admin.firestore();

async function debugWebPUsage() {
  try {
    console.log('🔍 Debugging WebP image usage...\n');
    
    // Get a few sample events
    const snapshot = await db.collection('Instagram_posts').limit(5).get();
    
    if (snapshot.empty) {
      console.log('❌ No events found');
      return;
    }
    
    console.log(`📊 Found ${snapshot.docs.length} events to analyze\n`);
    
    snapshot.docs.forEach((doc, index) => {
      const event = doc.data();
      console.log(`\n--- Event ${index + 1}: ${event.id || 'No ID'} ---`);
      console.log(`Title: ${event.title || event.caption || 'No title'}`);
      
      // Check what WebP fields exist
      const webPFields = [
        'webPImage0', 'webPImage1', 'webPImage2', 'webPImage3', 
        'webPImage4', 'webPImage5', 'webPImage6', 'webPDisplayurl'
      ];
      
      console.log('\n🔍 WebP Fields Status:');
      webPFields.forEach(field => {
        const value = event[field];
        if (value) {
          const isDataUrl = value.startsWith('data:image/webp;base64,');
          const isStorageUrl = value.includes('storage.googleapis.com');
          const isWebP = value.includes('.webp');
          
          console.log(`  ${field}: ${isDataUrl ? '✅ Data URL' : isStorageUrl ? '✅ Storage URL' : isWebP ? '✅ WebP URL' : '❓ Unknown format'} (${value.substring(0, 50)}...)`);
        } else {
          console.log(`  ${field}: ❌ Not available`);
        }
      });
      
      // Check original image fields
      console.log('\n🖼️ Original Image Fields:');
      const originalFields = [
        'Image0', 'Image1', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6', 'Displayurl'
      ];
      
      originalFields.forEach(field => {
        const value = event[field];
        if (value) {
          const isInstagram = value.includes('instagram.com') || value.includes('cdninstagram.com');
          const isDataUrl = value.startsWith('data:');
          const isStorageUrl = value.includes('storage.googleapis.com');
          
          let status = '❓ Unknown';
          if (isInstagram) status = '📱 Instagram';
          else if (isDataUrl) status = '💾 Data URL';
          else if (isStorageUrl) status = '☁️ Storage';
          
          console.log(`  ${field}: ${status} (${value.substring(0, 50)}...)`);
        } else {
          console.log(`  ${field}: ❌ Not available`);
        }
      });
      
      // Check conversion status
      console.log('\n⚙️ Conversion Status:');
      console.log(`  webpConversionComplete: ${event.webpConversionComplete ? '✅ Yes' : '❌ No'}`);
      if (event.webpConversionDate) {
        console.log(`  webpConversionDate: ${event.webpConversionDate.toDate()}`);
      }
      
      // Check if app would use WebP vs original
      console.log('\n🎯 App Image Selection Logic:');
      
      // Simulate the app's logic
      let finalImageUrl = null;
      let imageSource = 'None';
      
      // Priority 1: Company event images
      if (event.imageUrls && Array.isArray(event.imageUrls) && event.imageUrls.length > 0) {
        finalImageUrl = event.imageUrls[0];
        imageSource = 'Company Event Images (imageUrls)';
      }
      // Priority 2: WebP images
      else {
        for (const webPField of webPFields) {
          if (event[webPField] && event[webPField].startsWith('data:image/webp;base64,')) {
            finalImageUrl = event[webPField];
            imageSource = `WebP Image (${webPField})`;
            break;
          }
        }
        
        // Priority 3: Original images (would use proxy)
        if (!finalImageUrl) {
          for (const originalField of originalFields) {
            if (event[originalField]) {
              finalImageUrl = event[originalField];
              imageSource = `Original Image (${originalField}) - Would use proxy`;
              break;
            }
          }
        }
      }
      
      if (finalImageUrl) {
        console.log(`  ✅ App would use: ${imageSource}`);
        console.log(`  📍 URL: ${finalImageUrl.substring(0, 100)}...`);
      } else {
        console.log(`  ❌ App would use: Default image (/default-tyrolia.jpg)`);
      }
      
      console.log('\n' + '='.repeat(60));
    });
    
  } catch (error) {
    console.error('❌ Error debugging WebP usage:', error);
  }
}

// Run the debug function
debugWebPUsage();
