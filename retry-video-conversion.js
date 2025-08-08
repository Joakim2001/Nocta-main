const axios = require('axios');

async function retryVideoConversion() {
  try {
    console.log('🎬 Retrying video conversion for the failed document...');
    
    // Test with the document that had the bucket error
    // You can replace this with the specific document ID from your Firestore
    const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/convertVideoToWebM', {
      docId: '3684507675094660240', // This was one of the documents that had a video
      videoField: 'videourl'
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

retryVideoConversion(); 