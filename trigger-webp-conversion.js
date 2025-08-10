const axios = require('axios');

console.log('🚀 Triggering WebP conversion for all existing images...');

// Your Cloud Function URL (replace with your actual URL)
const CLOUD_FUNCTION_URL = 'https://us-central1-nocta-d1113.cloudfunctions.net/batchConvertExistingToWebP';

async function triggerWebPConversion() {
  try {
    console.log('📞 Calling Cloud Function:', CLOUD_FUNCTION_URL);
    
    // First, let's see what documents are available
    console.log('\n📋 Checking available documents...');
    const listResponse = await axios.post(CLOUD_FUNCTION_URL, {
      limit: 10,
      listOnly: true
    });
    
    if (listResponse.data.success) {
      console.log('✅ Found documents:', listResponse.data.documentIds);
      console.log(`📊 Total documents: ${listResponse.data.total}`);
    }
    
    // Now trigger the actual conversion (start with 1 document to test)
    console.log('\n🔄 Starting WebP conversion (1 document at a time)...');
    const conversionResponse = await axios.post(CLOUD_FUNCTION_URL, {
      limit: 1
    });
    
    if (conversionResponse.data.success) {
      console.log('✅ WebP conversion started successfully!');
      console.log(`📊 Converted: ${conversionResponse.data.converted} documents`);
      console.log(`📊 Total processed: ${conversionResponse.data.totalProcessed}`);
      
      if (conversionResponse.data.converted > 0) {
        console.log('\n🎉 Success! Your images are being converted to WebP format.');
        console.log('⏳ This process may take a few minutes.');
        console.log('🔄 Run this script again to convert more documents.');
      } else {
        console.log('\nℹ️ No documents needed conversion (they may already be converted).');
      }
    }
    
  } catch (error) {
    console.error('❌ Error triggering WebP conversion:', error.message);
    
    if (error.response) {
      console.error('   Response data:', error.response.data);
      console.error('   Status:', error.response.status);
    }
    
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Make sure your Cloud Functions are deployed');
    console.log('   2. Check if the function URL is correct');
    console.log('   3. Verify your Firebase project ID');
  }
}

triggerWebPConversion().then(() => {
  console.log('\n✅ Script completed!');
}).catch(error => {
  console.error('❌ Fatal error:', error);
});
