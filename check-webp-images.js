const admin = require('firebase-admin');

console.log('🔍 Checking WebP image fields in Firestore...');

// Initialize Firebase Admin SDK
try {
  const serviceAccount = require('./serviceAccountKey.json');
  console.log('✅ Service account key loaded successfully');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'nocta-d1113'
  });
  
  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  process.exit(1);
}

const db = admin.firestore();

async function checkWebPImages() {
  try {
    console.log('\n📊 Checking Instagram_posts collection for WebP images...');
    
    const instagramSnapshot = await db.collection('Instagram_posts').limit(5).get();
    
    if (instagramSnapshot.docs.length === 0) {
      console.log('   ⚠️ No documents found in Instagram_posts');
      return;
    }
    
    console.log(`   Found ${instagramSnapshot.docs.length} documents`);
    
    instagramSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n   📄 Document ${index + 1}: ${doc.id}`);
      console.log(`      Title: ${data.title || data.caption || 'No title'}`);
      
      // Check WebP image fields
      const webpFields = [
        'webPImage1', 'webPImage0', 'webPImage2', 'webPImage3', 
        'webPImage4', 'webPImage5', 'webPImage6', 'webPImage7', 
        'webPImage8', 'webPImage9', 'webPDisplayurl'
      ];
      
      let hasWebP = false;
      webpFields.forEach(field => {
        if (data[field]) {
          hasWebP = true;
          const isDataUrl = data[field].startsWith('data:image/webp;base64,');
          console.log(`      ${field}: ${isDataUrl ? '✅ WebP Data URL' : '⚠️ Not WebP Data URL'} (${data[field].substring(0, 50)}...)`);
        }
      });
      
      if (!hasWebP) {
        console.log(`      ❌ No WebP image fields found`);
      }
      
      // Check original image fields for comparison
      const originalFields = ['Image1', 'Image0', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6', 'Displayurl'];
      let hasOriginal = false;
      originalFields.forEach(field => {
        if (data[field]) {
          hasOriginal = true;
        }
      });
      
      if (hasOriginal) {
        console.log(`      📸 Has original images: Yes`);
      }
    });
    
    console.log('\n📊 Checking company-events collection for WebP images...');
    
    const companySnapshot = await db.collection('company-events').limit(5).get();
    
    if (companySnapshot.docs.length === 0) {
      console.log('   ⚠️ No documents found in company-events');
      return;
    }
    
    console.log(`   Found ${companySnapshot.docs.length} documents`);
    
    companySnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n   📄 Document ${index + 1}: ${doc.id}`);
      console.log(`      Title: ${data.title || data.name || 'No title'}`);
      
      // Check WebP image fields
      const webpFields = [
        'webPImage1', 'webPImage0', 'webPImage2', 'webPImage3', 
        'webPImage4', 'webPImage5', 'webPImage6', 'webPImage7', 
        'webPImage8', 'webPImage9', 'webPDisplayurl'
      ];
      
      let hasWebP = false;
      webpFields.forEach(field => {
        if (data[field]) {
          hasWebP = true;
          const isDataUrl = data[field].startsWith('data:image/webp;base64,');
          console.log(`      ${field}: ${isDataUrl ? '✅ WebP Data URL' : '⚠️ Not WebP Data URL'} (${data[field].substring(0, 50)}...)`);
        }
      });
      
      if (!hasWebP) {
        console.log(`      ❌ No WebP image fields found`);
      }
      
      // Check original image fields for comparison
      const originalFields = ['Image1', 'Image0', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6', 'Displayurl'];
      let hasOriginal = false;
      originalFields.forEach(field => {
        if (data[field]) {
          hasOriginal = true;
        }
      });
      
      if (hasOriginal) {
        console.log(`      📸 Has original images: Yes`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking WebP images:', error.message);
  }
}

checkWebPImages().then(() => {
  console.log('\n✅ WebP image check complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
