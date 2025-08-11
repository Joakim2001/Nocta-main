const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nocta-d1113-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

async function debugWebPUsageOnPages() {
  console.log('🔍 Debugging WebP Usage on Specific Pages...\n');

  try {
    // Get all events
    const snapshot = await db.collection('Instagram_posts').get();
    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`📊 Total events found: ${events.length}\n`);

    // Check each page type
    const pageTypes = {
      'Home Page (EventsList)': events.filter(e => e.type === 'Image' || e.type === 'Video'),
      'Bars Page (BarsList)': events.filter(e => e.type === 'Image' || e.type === 'Video'),
      'Company Event Page': events.filter(e => e.imageUrls && Array.isArray(e.imageUrls) && e.imageUrls.length > 0)
    };

    for (const [pageName, pageEvents] of Object.entries(pageTypes)) {
      console.log(`📱 ${pageName}:`);
      console.log(`   Total events: ${pageEvents.length}`);
      
      if (pageEvents.length === 0) {
        console.log('   No events found for this page type\n');
        continue;
      }

      // Sample first 3 events for detailed analysis
      const sampleEvents = pageEvents.slice(0, 3);
      
      for (const event of sampleEvents) {
        console.log(`\n   🎯 Event: ${event.title || event.caption?.substring(0, 30) || 'No title'} (ID: ${event.id})`);
        
        // Check WebP images
        const webPFields = [
          'webPImage1', 'webPImage2', 'webPImage3', 'webPImage4', 'webPImage5', 'webPImage6', 'webPDisplayurl'
        ];
        
        const hasWebP = webPFields.some(field => 
          event[field] && event[field].startsWith('data:image/webp;base64,')
        );
        
        if (hasWebP) {
          const webPCount = webPFields.filter(field => 
            event[field] && event[field].startsWith('data:image/webp;base64,')
          ).length;
          
          console.log(`   ✅ Has ${webPCount} WebP images`);
          
          // Check WebP image sizes
          webPFields.forEach(field => {
            if (event[field] && event[field].startsWith('data:image/webp;base64,')) {
              const sizeKB = Math.round(event[field].length / 1024);
              console.log(`      ${field}: ${sizeKB}KB`);
            }
          });
        } else {
          console.log('   ❌ No WebP images found');
        }
        
        // Check original images
        const originalFields = ['Image1', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6', 'Displayurl'];
        const hasOriginal = originalFields.some(field => event[field]);
        
        if (hasOriginal) {
          const originalCount = originalFields.filter(field => event[field]).length;
          console.log(`   📸 Has ${originalCount} original images`);
        } else {
          console.log('   ❌ No original images found');
        }
        
        // Check company event images
        if (event.imageUrls && Array.isArray(event.imageUrls) && event.imageUrls.length > 0) {
          console.log(`   🏢 Has ${event.imageUrls.length} company event images`);
        }
        
        // Check video
        const hasVideo = event.optimizedVideourl || event.webMVideourl || event.videourl;
        if (hasVideo) {
          console.log(`   🎬 Has video: ${event.optimizedVideourl ? 'Optimized' : event.webMVideourl ? 'WebM' : 'Original'}`);
        }
      }
      
      console.log('');
    }

    // Performance analysis
    console.log('🚀 Performance Analysis:');
    console.log('   WebP images should load faster because:');
    console.log('   1. They are base64 data URLs (no network requests)');
    console.log('   2. They are compressed and optimized');
    console.log('   3. They are served directly from the database');
    console.log('');
    console.log('   If images are loading slowly, check:');
    console.log('   1. Are WebP images being used? (should see ✅ Has WebP images)');
    console.log('   2. Are original images being proxied? (this adds latency)');
    console.log('   3. Are company event images being used? (these are also base64)');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugWebPUsageOnPages();

