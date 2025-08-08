const axios = require('axios');

async function testBatchWebPConversion() {
  try {
    console.log('🧪 Testing batch WebP conversion...');
    
    const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/batchConvertExistingToWebP', {
      limit: 2 // Convert 2 documents at a time
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

testBatchWebPConversion(); 