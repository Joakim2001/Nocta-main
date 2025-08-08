const axios = require('axios');

async function testSingleImageConversion() {
  try {
    console.log('🧪 Testing single image WebP conversion...');
    
    const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/convertSingleImageToWebP', {
      docId: '3659979351587326354',
      imageField: 'Displayurl'
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

testSingleImageConversion(); 