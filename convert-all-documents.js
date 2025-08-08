const axios = require('axios');

async function convertAllDocuments() {
  try {
    console.log('🚀 Starting WebP conversion for all documents...');
    
    let totalConverted = 0;
    let batchNumber = 1;
    
    while (true) {
      console.log(`\n📦 Processing batch ${batchNumber}...`);
      
      try {
        const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/batchConvertExistingToWebP', {
          limit: 5 // Convert 5 documents at a time
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
        
        console.log('⏳ Waiting 3 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.error(`❌ Error in batch ${batchNumber}:`, error.response?.data || error.message);
        
        // If we get an error, wait longer and try again
        console.log('⏳ Waiting 10 seconds before retry...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    console.log(`\n🎊 WebP conversion complete!`);
    console.log(`📊 Total documents converted: ${totalConverted}`);
    console.log(`📊 Total batches processed: ${batchNumber - 1}`);
    
  } catch (error) {
    console.error('❌ Error during conversion:', error.response?.data || error.message);
  }
}

convertAllDocuments(); 