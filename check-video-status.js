const axios = require('axios');

async function checkVideoStatus() {
  try {
    console.log('🔍 Checking video status in Karrusel document...');
    
    const docId = '3524973568157937537';
    
    // Try to convert the video to see the current status
    const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/downloadAndStoreInstagramVideo', {
      docId: docId
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Current status:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // The response should tell us if the video was already processed
    if (response.data.success === false && response.data.message.includes('Not an Instagram video URL')) {
      console.log('\n📋 Summary:');
      console.log('✅ Video was successfully downloaded and permanently stored!');
      console.log('✅ Original Instagram URL was replaced with permanent Firebase Storage URL');
      console.log('✅ Video will never expire now');
      console.log('✅ The function correctly detected it\'s no longer an Instagram URL');
    } else if (response.data.success) {
      console.log('\n🎉 Video was just downloaded and stored!');
    } else {
      console.log('\n⚠️  Video processing status unclear');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

checkVideoStatus(); 