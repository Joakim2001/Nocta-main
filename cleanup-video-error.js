const axios = require('axios');

async function cleanupVideoError() {
  try {
    console.log('🧹 Cleaning up video error status...');
    
    // Update the document to remove the error and mark as "blocked by Instagram"
    const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/convertVideoToWebM', {
      docId: '3684507675094660240', // Replace with your document ID
      videoField: 'videourl',
      cleanup: true // We'll add this parameter to handle cleanup
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Cleanup complete!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

cleanupVideoError(); 