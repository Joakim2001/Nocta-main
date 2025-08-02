const admin = require('firebase-admin');
const path = require('path');
const { URL } = require('url');

// CONFIGURATION
const serviceAccount = require('./serviceAccountKey.json');
const COLLECTION = 'Instagram_posts'; // Updated Firestore collection name
const BUCKET = 'nocta_bucket.appspot.com'; // Updated bucket name for Firebase Storage
const DELAY_MS = 1000; // Delay between uploads (ms) to avoid rate limits

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: BUCKET
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

function isExternalImage(url) {
  return url && url.startsWith('http') && (url.includes('instagram') || url.includes('fbcdn'));
}

async function downloadAndUploadImage(eventId, imageUrl, imageField) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${imageUrl}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use eventId and imageField as filename
    const fileName = `${eventId}_${imageField}_${path.basename(new URL(imageUrl).pathname)}`;
    const file = bucket.file(fileName);

    await file.save(buffer, {
      metadata: { contentType: 'image/jpeg' }
    });

    // Make the file public (optional)
    await file.makePublic();

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    return publicUrl;
  } catch (err) {
    console.error(`Error downloading/uploading ${imageField} for event ${eventId}:`, err.message);
    return null;
  }
}

async function migrateImages() {
  const snapshot = await db.collection(COLLECTION).get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const eventId = doc.id;
    let updatedFields = {};
    let migrated = false;

    for (const imageField of ['Image1', 'Image2', 'Image3']) {
      const imageUrl = data[imageField];
      if (isExternalImage(imageUrl)) {
        console.log(`Processing ${imageField} for event ${eventId}...`);
        const newUrl = await downloadAndUploadImage(eventId, imageUrl, imageField);
        if (newUrl) {
          updatedFields[imageField] = newUrl;
          migrated = true;
          console.log(`Updated ${imageField} for event ${eventId}.`);
        }
        await new Promise(res => setTimeout(res, DELAY_MS)); // Rate limit
      }
    }

    if (migrated) {
      await db.collection(COLLECTION).doc(eventId).update(updatedFields);
      console.log(`Firestore updated for event ${eventId}.`);
    } else {
      console.log(`No images migrated for event ${eventId}.`);
    }
  }
  console.log('Migration complete!');
}

migrateImages(); 