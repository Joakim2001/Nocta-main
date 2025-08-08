const axios = require('axios');

async function convertAllToWebP() {
  try {
    console.log('🚀 Starting WebP conversion for all documents...');
    
    let totalConverted = 0;
    let batchNumber = 1;
    
    while (true) {
      console.log(`\n📦 Processing batch ${batchNumber}...`);
      
      const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/batchConvertExistingToWebP', {
        limit: 10 // Convert 10 documents at a time
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = response.data;
      console.log(`✅ Batch ${batchNumber} result:`, result);
      
      if (result.converted === 0) {
        console.log('🎉 All documents have been converted!');
        break;
      }
      
      totalConverted += result.converted;
      batchNumber++;
      
      // Wait a bit between batches to avoid overwhelming the system
      console.log('⏳ Waiting 2 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\n🎊 WebP conversion complete!`);
    console.log(`📊 Total documents converted: ${totalConverted}`);
    console.log(`📊 Total batches processed: ${batchNumber - 1}`);
    
  } catch (error) {
    console.error('❌ Error during conversion:', error.response?.data || error.message);
  }
}

convertAllToWebP(); 