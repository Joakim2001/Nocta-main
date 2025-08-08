const axios = require('axios');

async function downloadVideoForPost(docId) {
  try {
    console.log(`🎬 Downloading and permanently storing video for document: ${docId}`);
    
    const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/downloadAndStoreInstagramVideo', {
      docId: docId
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Result:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n🎉 Video successfully downloaded and permanently stored!');
      console.log(`📹 Original size: ${response.data.originalSize} bytes`);
      console.log(`🔗 Permanent URL: ${response.data.permanentUrl}`);
      console.log('✅ Video will never expire now!');
    } else if (response.data.message.includes('No unconverted video field found')) {
      console.log('\n📋 No video found or already processed');
    } else if (response.data.message.includes('Not an Instagram video URL')) {
      console.log('\n📋 Not an Instagram video');
    } else if (response.data.message.includes('Instagram access blocked')) {
      console.log('\n❌ Instagram access blocked - URL may have expired');
      console.log('ℹ️  Try downloading the video manually or wait for a fresh URL');
    } else {
      console.log('\n⚠️  Video processing failed:');
      console.log(`❌ Error: ${response.data.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Usage: node download-video-for-post.js <document-id>
const docId = process.argv[2];

if (!docId) {
  console.log('Usage: node download-video-for-post.js <document-id>');
  console.log('Example: node download-video-for-post.js 3524973568157937537');
  process.exit(1);
}

downloadVideoForPost(docId); 