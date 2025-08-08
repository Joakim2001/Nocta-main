const axios = require('axios');

async function testWebPConversion() {
  try {
    console.log('🧪 Testing WebP conversion...');
    
    const testImageUrl = 'https://instagram.fadb7-1.fna.fbcdn.net/v/t51.2885-15/514699670_18389765893189984_10492359876673935339_n.jpg';
    
    const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/convertToWebPHttp', {
      imageUrl: testImageUrl
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

testWebPConversion(); 