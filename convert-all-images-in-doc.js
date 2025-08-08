const axios = require('axios');

async function convertAllImagesInDocument() {
  try {
    console.log('🚀 Converting all images in document 3659979351587326354...');
    
    const docId = '3659979351587326354';
    const imageFields = ['Displayurl', 'Image1', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6'];
    
    for (const imageField of imageFields) {
      console.log(`\n📸 Converting ${imageField}...`);
      
      try {
        const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/convertSingleImageToWebP', {
          docId: docId,
          imageField: imageField
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`✅ ${imageField}: ${response.data.compressionRatio} compression`);
        
        // Wait 1 second between conversions to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`⚠️ ${imageField}: ${error.response?.data?.error || error.message}`);
      }
    }
    
    console.log('\n🎉 All images in document converted!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

convertAllImagesInDocument(); 