const axios = require('axios');

async function findNewDocument() {
  try {
    console.log('🔍 Finding the new Karrusel document...');
    
    // Get a list of recent documents
    const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/batchConvertExistingToWebP', {
      limit: 10,
      listOnly: true
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Found documents:');
    if (response.data.documentIds) {
      response.data.documentIds.forEach((docId, index) => {
        console.log(`${index + 1}. ${docId}`);
      });
    }
    
    // Look for the Karrusel document specifically
    console.log('\n🔍 Looking for Karrusel document...');
    for (const docId of response.data.documentIds) {
      try {
        // Try to get document data to check if it's the Karrusel one
        const docResponse = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/convertNewVideo', {
          docId: docId,
          checkOnly: true
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (docResponse.data.fullname === 'Karrusel' || docResponse.data.title?.includes('Karrusel')) {
          console.log(`✅ Found Karrusel document: ${docId}`);
          console.log('Title:', docResponse.data.title);
          console.log('Fullname:', docResponse.data.fullname);
          console.log('Has video:', !!docResponse.data.videourl);
          break;
        }
      } catch (error) {
        // Document might not exist or other error
        continue;
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

findNewDocument(); 