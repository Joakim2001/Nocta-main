const axios = require('axios');

async function convertVideoForNewPost(docId) {
  try {
    console.log(`🎬 Converting video in document: ${docId}`);
    
    const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/convertNewVideo', {
      docId: docId
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Result:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n🎉 Video successfully converted and optimized!');
      console.log(`📹 Original size: ${response.data.originalSize} bytes`);
      console.log(`🚀 Optimized URL: ${response.data.compressedUrl}`);
    } else if (response.data.message.includes('Instagram video detected')) {
      console.log('\n📋 Instagram video detected:');
      console.log('✅ Video was processed and marked appropriately');
      console.log('✅ Original URL preserved');
      console.log('✅ Document updated with metadata');
      console.log('ℹ️  Instagram videos cannot be converted due to access restrictions');
    } else {
      console.log('\n⚠️  Video processing failed:');
      console.log(`❌ Error: ${response.data.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Usage: node convert-video-for-new-post.js <document-id>
const docId = process.argv[2];

if (!docId) {
  console.log('Usage: node convert-video-for-new-post.js <document-id>');
  console.log('Example: node convert-video-for-new-post.js 3524973568157937537');
  process.exit(1);
}

convertVideoForNewPost(docId); 