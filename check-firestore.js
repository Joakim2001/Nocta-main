const admin = require('firebase-admin');

console.log('🔍 Checking Firestore collections...');

// Initialize Firebase Admin SDK with service account
try {
  const serviceAccount = require('./serviceAccountKey.json');
  console.log('✅ Service account key loaded successfully');
  console.log(`🔑 Service account email: ${serviceAccount.client_email}`);
  console.log(`🏗️ Project ID: ${serviceAccount.project_id}`);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'nocta-d1113'
  });
  
  console.log('✅ Firebase Admin SDK initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  process.exit(1);
}

const db = admin.firestore();

async function checkCollections() {
  try {
    console.log('\n🔍 Testing basic Firestore access...');
    
    // Try to list all collections first
    console.log('📊 Listing all collections...');
    const collections = await db.listCollections();
    console.log(`   Found ${collections.length} collections:`);
    collections.forEach(col => {
      console.log(`   - ${col.id}`);
    });
    
    if (collections.length === 0) {
      console.log('   ⚠️ No collections found - database might be empty');
      return;
    }
    
    console.log('\n📊 Checking Instagram_posts collection...');
    const instagramSnapshot = await db.collection('Instagram_posts').get();
    console.log(`   Found ${instagramSnapshot.docs.length} documents`);
    
    if (instagramSnapshot.docs.length > 0) {
      console.log('   All documents with their fields:');
      instagramSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`   ${index + 1}. ID: ${doc.id}`);
        console.log(`      All fields:`, Object.keys(data));
        console.log(`      Title: ${data.title || data.caption || 'No title'}`);
        console.log(`      Video URL: ${data.videourl || data.videoUrl || 'No video'}`);
        console.log(`      Optimized: ${data.optimizedVideourl || 'Not optimized'}`);
        console.log('');
      });
    }
    
    console.log('\n📊 Checking company-events collection...');
    const eventsSnapshot = await db.collection('company-events').get();
    console.log(`   Found ${eventsSnapshot.docs.length} documents`);
    
    if (eventsSnapshot.docs.length > 0) {
      console.log('   Sample documents:');
      eventsSnapshot.docs.slice(0, 3).forEach((doc, index) => {
        const data = doc.data();
        console.log(`   ${index + 1}. ID: ${doc.id}`);
        console.log(`      Name: ${data.name || 'No name'}`);
        console.log(`      Video URL: ${data.videourl || data.videoUrl || 'No video'}`);
        console.log(`      Optimized: ${data.optimizedVideourl || 'Not optimized'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking collections:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error details:', error.details);
  }
}

checkCollections().then(() => {
  console.log('✅ Check complete!');
  process.exit(0);
}).catch(console.error);
