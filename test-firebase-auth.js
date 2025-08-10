const admin = require('firebase-admin');

console.log('🔍 Testing Firebase Admin SDK authentication...');

try {
  const serviceAccount = require('./serviceAccountKey.json');
  console.log('✅ Service account key loaded');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'nocta-d1113'
  });
  
  console.log('✅ Firebase Admin SDK initialized');
  
  const db = admin.firestore();
  console.log('✅ Firestore instance created');
  
  // Try to read a simple document to test permissions
  console.log('🔍 Testing Firestore read access...');
  
  db.collection('Instagram_posts').limit(1).get()
    .then(snapshot => {
      console.log('✅ Firestore read successful!');
      console.log(`📊 Found ${snapshot.docs.length} documents`);
      if (snapshot.docs.length > 0) {
        const doc = snapshot.docs[0];
        console.log(`📄 Document ID: ${doc.id}`);
        console.log(`📄 Document data keys: ${Object.keys(doc.data())}`);
      }
    })
    .catch(error => {
      console.error('❌ Firestore read failed:', error.message);
      console.error('Error code:', error.code);
      console.error('Error details:', error);
    });
    
} catch (error) {
  console.error('❌ Setup failed:', error.message);
}
