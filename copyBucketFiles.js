const { Storage } = require('@google-cloud/storage');
const path = require('path');

// CONFIGURATION
const OLD_BUCKET = 'nocta-d1113.appspot.com'; // Your old bucket name
const NEW_BUCKET = 'nocta_bucket.appspot.com'; // Your new bucket name
const KEY_FILE = path.join(__dirname, 'serviceAccountKey.json'); // Path to your service account key

const storage = new Storage({ keyFilename: KEY_FILE });

async function copyAllFiles() {
  const [files] = await storage.bucket(OLD_BUCKET).getFiles();
  console.log(`Found ${files.length} files in old bucket.`);

  for (const file of files) {
    const destFile = storage.bucket(NEW_BUCKET).file(file.name);
    try {
      await file.copy(destFile);
      console.log(`Copied: ${file.name}`);
    } catch (err) {
      console.error(`Failed to copy ${file.name}:`, err.message);
    }
  }
  console.log('Copy complete!');
}

copyAllFiles(); 