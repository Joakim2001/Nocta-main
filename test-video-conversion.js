const axios = require('axios');

async function testVideoConversion() {
  try {
    console.log('🎬 Testing video conversion...');
    
    // Test with a document that might have a video
    const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/convertVideoToWebM', {
      docId: '3659979351587326354', // Use the same document we tested images with
      videoField: 'Videourl' // Common video field name
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testVideoConversion(); 