const axios = require('axios');

async function convertNewVideo() {
  try {
    console.log('🎬 Converting video in the new Karrusel post...');
    
    // The correct document ID from the list
    const docId = '3524973568157937537';
    
    console.log(`🔍 Attempting to convert video in document: ${docId}`);
    
    const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/convertNewVideo', {
      docId: docId
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

convertNewVideo(); 