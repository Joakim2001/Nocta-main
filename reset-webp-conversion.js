const axios = require('axios');

async function resetWebPConversion() {
  try {
    console.log('🔄 Starting WebP conversion reset...');
    
    let totalReset = 0;
    let batchNumber = 1;
    
    while (true) {
      console.log(`\n📦 Resetting batch ${batchNumber}...`);
      
      const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/resetWebPConversion', {
        limit: 50 // Reset 50 documents at a time
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = response.data;
      console.log(`✅ Reset batch ${batchNumber} result:`, result);
      
      if (result.reset === 0) {
        console.log('🎉 All documents have been reset!');
        break;
      }
      
      totalReset += result.reset;
      batchNumber++;
      
      // Wait a bit between batches
      console.log('⏳ Waiting 1 second before next batch...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n🎊 WebP conversion reset complete!`);
    console.log(`📊 Total documents reset: ${totalReset}`);
    console.log(`📊 Total batches processed: ${batchNumber - 1}`);
    
  } catch (error) {
    console.error('❌ Error during reset:', error.response?.data || error.message);
  }
}

resetWebPConversion(); 