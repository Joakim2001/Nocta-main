const axios = require('axios');

async function discoverDocuments() {
  try {
    console.log('🔍 Discovering all documents in Instagram_posts collection...');
    
    const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/batchConvertExistingToWebP', {
      limit: 1000, // Get a large batch
      listOnly: true // Just list documents, don't convert
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Discovery complete!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.documentIds) {
      console.log(`\n📊 Found ${response.data.total} documents:`);
      response.data.documentIds.forEach((docId, index) => {
        console.log(`${index + 1}. ${docId}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error discovering documents:', error.response?.data || error.message);
  }
}

discoverDocuments(); 