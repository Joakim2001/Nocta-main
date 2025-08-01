const { Storage } = require('@google-cloud/storage');
const storage = new Storage({ keyFilename: './serviceAccountKey.json' });

async function listBuckets() {
  const [buckets] = await storage.getBuckets();
  console.log('Buckets your service account can access:');
  buckets.forEach(b => console.log(b.name));
}

listBuckets();

const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'nocta_bucket', // e.g. nocta_bucket
});

const db = admin.firestore();
const bucket = getStorage().bucket('nocta_bucket');

console.log('Script started');

async function run() {
  try {
    // List all files in the bucket
    const [files] = await bucket.getFiles();
    // Map: eventId => { Image1: filename, Image2: filename, ... }
    const eventImages = {};

    files.forEach(file => {
      const name = file.name;
      console.log('Found file:', name);
      // Match pattern: <eventId>_ImageN_
      const match = name.match(/^([A-Za-z0-9]+)_Image([123])_/);
      if (match) {
        const eventId = match[1];
        const imageNum = match[2];
        if (!eventImages[eventId]) eventImages[eventId] = {};
        eventImages[eventId][`Image${imageNum}`] = name;
      }
    });

    // Update Firestore for each event
    for (const [eventId, images] of Object.entries(eventImages)) {
      console.log(`Updating Firestore doc: ${eventId} with`, images);
      const docRef = db.collection('Instagram posts').doc(eventId);
      await docRef.set(images, { merge: true });
      console.log(`Updated ${eventId}:`, images);
    }
  } catch (err) {
    console.error('Script error:', err);
  }
}

run().catch(console.error);