const axios = require('axios');

async function convertAllSystematic() {
  try {
    console.log('🚀 Starting systematic WebP conversion for all documents...');
    
    // First, let's get a list of all document IDs
    console.log('📋 Getting list of all documents...');
    
    const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/batchConvertExistingToWebP', {
      limit: 100, // Get a large batch to see all documents
      listOnly: true // We'll add this parameter to the function
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response:', response.data);
    
    // For now, let's manually convert a few more documents we know exist
    const knownDocuments = [
      '3659979351587326354', // Already converted
      '3627138361957926421', // Already converted
      // Add more document IDs here as we discover them
    ];
    
    const imageFields = ['Displayurl', 'Image1', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6'];
    
    for (const docId of knownDocuments) {
      console.log(`\n📄 Processing document ${docId}...`);
      
      for (const imageField of imageFields) {
        console.log(`  📸 Converting ${imageField}...`);
        
        try {
          const convertResponse = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/convertSingleImageToWebP', {
            docId: docId,
            imageField: imageField
          }, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (convertResponse.data.success) {
            console.log(`    ✅ ${imageField}: ${convertResponse.data.compressionRatio} compression`);
          }
          
        } catch (error) {
          if (error.response?.data?.error?.includes('not found in document')) {
            console.log(`    ⚠️ ${imageField}: Field not found`);
          } else {
            console.log(`    ❌ ${imageField}: ${error.response?.data?.error || error.message}`);
          }
        }
        
        // Wait 500ms between image conversions
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Wait 2 seconds between documents
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n🎉 Systematic conversion complete!');
    
  } catch (error) {
    console.error('❌ Error during systematic conversion:', error.response?.data || error.message);
  }
}

convertAllSystematic(); 