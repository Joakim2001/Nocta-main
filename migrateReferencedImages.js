const { Storage } = require('@google-cloud/storage');
const path = require('path');
const admin = require('firebase-admin');

// CONFIGURATION
const OLD_BUCKET = 'nocta-d1113.appspot.com'; // Old bucket name
const NEW_BUCKET = 'nocta_bucket.appspot.com'; // New bucket name
const KEY_FILE = path.join(__dirname, 'serviceAccountKey.json'); // Service account key
const COLLECTION = 'Instagram_posts';

admin.initializeApp({
  credential: admin.credential.cert(require(KEY_FILE)),
});
const db = admin.firestore();
const storage = new Storage({ keyFilename: KEY_FILE });

async function copyImageIfExists(imagePath) {
  if (!imagePath) return;
  const srcFile = storage.bucket(OLD_BUCKET).file(imagePath);
  const destFile = storage.bucket(NEW_BUCKET).file(imagePath);
  try {
    // Check if file exists in old bucket
    const [exists] = await srcFile.exists();
    if (!exists) {
      console.warn(`File not found in old bucket: ${imagePath}`);
      return;
    }
    await srcFile.copy(destFile);
    console.log(`Copied: ${imagePath}`);
  } catch (err) {
    console.error(`Failed to copy ${imagePath}:`, err.message);
  }
}

async function migrateReferencedImages() {
  const snapshot = await db.collection(COLLECTION).get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    for (const imageField of ['Image1', 'Image2', 'Image3']) {
      const imagePath = data[imageField];
      await copyImageIfExists(imagePath);
    }
  }
  console.log('Migration complete!');
}

migrateReferencedImages();