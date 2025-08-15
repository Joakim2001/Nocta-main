// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDH5VmKvzsnX8CemnNxKIvHrnMSE6o_JiY",
  authDomain: "nocta-d1113.firebaseapp.com",
  projectId: "nocta-d1113",
  storageBucket: "nocta_bucket.appspot.com",
  messagingSenderId: "292774630791",
  appId: "1:292774630791:web:fd99e5bb63f7fb8e196f22"
};

// Production optimizations
if (process.env.NODE_ENV === 'production') {
  // Enable offline persistence for better mobile performance
  // This will be handled automatically by Firebase in production
  console.log('🔍 Firebase: Production mode enabled');
} else {
  console.log('🔍 Firebase: Development mode');
}

console.log('🔍 Firebase: Initializing app...');
const app = initializeApp(firebaseConfig);
console.log('🔍 Firebase: App initialized successfully');

console.log('🔍 Firebase: Getting Firestore instance...');
const db = getFirestore(app);
console.log('🔍 Firebase: Firestore instance created');

console.log('🔍 Firebase: Getting Auth instance...');
const auth = getAuth(app);
console.log('🔍 Firebase: Auth instance created');

console.log('🔍 Firebase: Getting Storage instance...');
const storage = getStorage(app);
console.log('🔍 Firebase: Storage instance created');

console.log('🔍 Firebase: All services initialized successfully');

export { db, auth, storage };