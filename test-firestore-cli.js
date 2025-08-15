const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDH5VmKvzsnX8CemnNxKIvHrnMSE6o_JiY",
  authDomain: "nocta-d1113.firebaseapp.com",
  projectId: "nocta-d1113",
  storageBucket: "nocta_bucket.appspot.com",
  messagingSenderId: "292774630791",
  appId: "1:292774630791:web:fd99e5bb63f7fb8e196f22"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testFirestore() {
  try {
    console.log('Testing Firestore connection...');
    
    // Test Club_Bar_Festival_profiles collection
    console.log('\n--- Testing Club_Bar_Festival_profiles collection ---');
    const clubsSnapshot = await getDocs(collection(db, 'Club_Bar_Festival_profiles'));
    console.log(`Found ${clubsSnapshot.docs.length} documents in Club_Bar_Festival_profiles`);
    
    if (clubsSnapshot.docs.length > 0) {
      console.log('First few documents:');
      clubsSnapshot.docs.slice(0, 3).forEach((doc, index) => {
        console.log(`Document ${index + 1}:`, doc.id, doc.data());
      });
    }
    
    // Test profiles collection
    console.log('\n--- Testing profiles collection ---');
    const profilesSnapshot = await getDocs(collection(db, 'profiles'));
    console.log(`Found ${profilesSnapshot.docs.length} documents in profiles`);
    
    if (profilesSnapshot.docs.length > 0) {
      console.log('First few documents:');
      profilesSnapshot.docs.slice(0, 3).forEach((doc, index) => {
        console.log(`Document ${index + 1}:`, doc.id, doc.data());
      });
    }
    
  } catch (error) {
    console.error('Error testing Firestore:', error);
  }
}

testFirestore();
