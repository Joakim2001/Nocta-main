const axios = require('axios');

async function downloadNewVideosOnly() {
  try {
    console.log('🎬 Downloading only NEW videos (not already processed)...');
    console.log('⏰ Perfect for running after n8n workflows...\n');
    
    // First, get all documents
    console.log('📋 Fetching all documents...');
    const listResponse = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/batchConvertExistingToWebP', {
      limit: 1000,
      listOnly: true
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const allDocumentIds = listResponse.data.documentIds;
    console.log(`✅ Found ${allDocumentIds.length} documents to check\n`);
    
    let totalNewVideos = 0;
    let totalDownloaded = 0;
    let totalExpired = 0;
    let totalFailed = 0;
    
    const newVideos = [];
    const expiredVideos = [];
    const failedVideos = [];
    
    for (let i = 0; i < allDocumentIds.length; i++) {
      const docId = allDocumentIds[i];
      const progress = `${i + 1}/${allDocumentIds.length}`;
      
      try {
        const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/downloadAndStoreInstagramVideo', {
          docId: docId
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.data.success) {
          console.log(`📄 [${progress}] ${docId}: ✅ DOWNLOADED (${response.data.originalSize} bytes)`);
          totalDownloaded++;
          newVideos.push({
            docId: docId,
            size: response.data.originalSize,
            url: response.data.permanentUrl
          });
        } else if (response.data.message.includes('No unconverted video field found')) {
          // No video in this document, skip silently
        } else if (response.data.message.includes('Not an Instagram video URL')) {
          // Already processed, skip silently
        } else if (response.data.message.includes('Instagram access blocked')) {
          console.log(`📄 [${progress}] ${docId}: ⏰ EXPIRED (>24 hours old)`);
          totalExpired++;
          expiredVideos.push(docId);
        } else {
          console.log(`📄 [${progress}] ${docId}: ❌ FAILED - ${response.data.message}`);
          totalFailed++;
          failedVideos.push({
            docId: docId,
            error: response.data.message
          });
        }
        
        totalNewVideos++;
        
      } catch (error) {
        console.log(`📄 [${progress}] ${docId}: ❌ ERROR - ${error.response?.data?.error || error.message}`);
        totalFailed++;
        failedVideos.push({
          docId: docId,
          error: error.response?.data?.error || error.message
        });
      }
      
      // Wait 1 second between requests
      if (i < allDocumentIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('🎊 NEW VIDEO PROCESSING COMPLETE!');
    console.log('='.repeat(50));
    
    console.log(`\n📊 RESULTS:`);
    console.log(`   ✅ Successfully downloaded: ${totalDownloaded}`);
    console.log(`   ⏰ Expired URLs: ${totalExpired}`);
    console.log(`   ❌ Failed: ${totalFailed}`);
    
    if (totalDownloaded > 0) {
      console.log(`\n🎉 SUCCESS: ${totalDownloaded} new videos are now permanently stored!`);
      console.log('   These videos will never expire.');
    }
    
    if (totalExpired > 0) {
      console.log(`\n⚠️  WARNING: ${totalExpired} videos had expired URLs.`);
      console.log('   Run this script more frequently to avoid expiration.');
    }
    
    if (newVideos.length > 0) {
      console.log(`\n✅ NEW VIDEOS DOWNLOADED:`);
      newVideos.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.docId} (${item.size} bytes)`);
      });
    }
    
    console.log('\n💡 TIP: Run this script after each n8n workflow!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Fatal error:', error.response?.data || error.message);
  }
}

// Run the new videos only process
downloadNewVideosOnly(); 