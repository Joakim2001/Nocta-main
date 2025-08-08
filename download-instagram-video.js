const axios = require('axios');

async function downloadInstagramVideo() {
  try {
    console.log('🎬 Downloading and permanently storing Instagram video...');
    
    const docId = '3524973568157937537';
    
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
    } else {
      console.log('\n⚠️  Download failed:');
      console.log(`❌ Error: ${response.data.message}`);
      console.log(`ℹ️  Note: ${response.data.note}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

downloadInstagramVideo(); 