const axios = require('axios');

async function checkConversionStatus() {
  try {
    console.log('🔍 Checking WebP conversion status...');
    
    // Test with a few specific documents
    const testDocuments = [
      '3659979351587326354', // The one we just converted
      '3627138361957926421', // Another document ID
      '3627138361957926422'  // Another document ID
    ];
    
    for (const docId of testDocuments) {
      console.log(`\n📄 Checking document ${docId}...`);
      
      try {
        // Try to convert Displayurl to see if it's already converted
        const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/convertSingleImageToWebP', {
          docId: docId,
          imageField: 'Displayurl'
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.data.success) {
          console.log(`✅ ${docId}: ${response.data.compressionRatio} compression`);
        }
        
      } catch (error) {
        if (error.response?.data?.error?.includes('not found')) {
          console.log(`❌ ${docId}: Document not found`);
        } else if (error.response?.data?.error?.includes('not found in document')) {
          console.log(`⚠️ ${docId}: Displayurl field not found`);
        } else {
          console.log(`❌ ${docId}: ${error.response?.data?.error || error.message}`);
        }
      }
      
      // Wait 1 second between checks
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🔍 Checking batch conversion status...');
    
    // Check what the batch function finds
    const batchResponse = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/batchConvertExistingToWebP', {
      limit: 1 // Just check 1 document
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Batch function response:', batchResponse.data);
    
  } catch (error) {
    console.error('❌ Error checking status:', error.response?.data || error.message);
  }
}

checkConversionStatus(); 