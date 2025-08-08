const axios = require('axios');

async function downloadAllVideosAutomated() {
  try {
    console.log('🎬 Starting automated video download and storage process...');
    console.log('⏰ This will process all videos in your database...\n');
    
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
    
    let totalVideosFound = 0;
    let totalVideosDownloaded = 0;
    let totalVideosFailed = 0;
    let totalVideosExpired = 0;
    let totalVideosAlreadyProcessed = 0;
    let totalNoVideos = 0;
    
    const results = {
      successful: [],
      failed: [],
      expired: [],
      alreadyProcessed: [],
      noVideos: []
    };
    
    for (let i = 0; i < allDocumentIds.length; i++) {
      const docId = allDocumentIds[i];
      const progress = `${i + 1}/${allDocumentIds.length}`;
      
      console.log(`📄 [${progress}] Processing: ${docId}`);
      
      try {
        const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/downloadAndStoreInstagramVideo', {
          docId: docId
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.data.success) {
          console.log(`  ✅ SUCCESS: Downloaded and stored (${response.data.originalSize} bytes)`);
          totalVideosDownloaded++;
          results.successful.push({
            docId: docId,
            size: response.data.originalSize,
            url: response.data.permanentUrl
          });
        } else if (response.data.message.includes('No unconverted video field found')) {
          console.log(`  ⚠️  NO VIDEO: No video found in this document`);
          totalNoVideos++;
          results.noVideos.push(docId);
        } else if (response.data.message.includes('Not an Instagram video URL')) {
          console.log(`  ✅ ALREADY PROCESSED: Video already permanently stored`);
          totalVideosAlreadyProcessed++;
          results.alreadyProcessed.push(docId);
        } else if (response.data.message.includes('Instagram access blocked')) {
          console.log(`  ❌ EXPIRED: Instagram URL expired (>24 hours old)`);
          totalVideosExpired++;
          results.expired.push({
            docId: docId,
            error: 'Instagram URL expired'
          });
        } else {
          console.log(`  ❌ FAILED: ${response.data.message}`);
          totalVideosFailed++;
          results.failed.push({
            docId: docId,
            error: response.data.message
          });
        }
        
        totalVideosFound++;
        
      } catch (error) {
        console.log(`  ❌ ERROR: ${error.response?.data?.error || error.message}`);
        totalVideosFailed++;
        results.failed.push({
          docId: docId,
          error: error.response?.data?.error || error.message
        });
      }
      
      // Wait 1 second between requests to avoid rate limiting
      if (i < allDocumentIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Print comprehensive summary
    console.log('\n' + '='.repeat(60));
    console.log('🎊 AUTOMATED VIDEO PROCESSING COMPLETE!');
    console.log('='.repeat(60));
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   📋 Total documents checked: ${allDocumentIds.length}`);
    console.log(`   🎬 Total videos found: ${totalVideosFound}`);
    console.log(`   ✅ Successfully downloaded: ${totalVideosDownloaded}`);
    console.log(`   ✅ Already processed: ${totalVideosAlreadyProcessed}`);
    console.log(`   ❌ Failed to download: ${totalVideosFailed}`);
    console.log(`   ⏰ Expired URLs: ${totalVideosExpired}`);
    console.log(`   📷 No videos found: ${totalNoVideos}`);
    
    if (totalVideosDownloaded > 0) {
      console.log(`\n🎉 SUCCESS: ${totalVideosDownloaded} videos are now permanently stored!`);
      console.log('   These videos will never expire and are optimized for your app.');
    }
    
    if (totalVideosExpired > 0) {
      console.log(`\n⚠️  EXPIRED: ${totalVideosExpired} videos had expired URLs.`);
      console.log('   For future posts, download videos within 24 hours of posting.');
    }
    
    if (totalVideosFailed > 0) {
      console.log(`\n❌ FAILED: ${totalVideosFailed} videos failed to process.`);
      console.log('   Check the detailed results below for specific errors.');
    }
    
    // Detailed results
    if (results.successful.length > 0) {
      console.log(`\n✅ SUCCESSFULLY DOWNLOADED (${results.successful.length}):`);
      results.successful.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.docId} (${item.size} bytes)`);
      });
    }
    
    if (results.expired.length > 0) {
      console.log(`\n⏰ EXPIRED URLs (${results.expired.length}):`);
      results.expired.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.docId} - ${item.error}`);
      });
    }
    
    if (results.failed.length > 0) {
      console.log(`\n❌ FAILED (${results.failed.length}):`);
      results.failed.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.docId} - ${item.error}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('💡 TIP: Run this script after each n8n workflow to automatically');
    console.log('    download and store all new videos before they expire!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Fatal error:', error.response?.data || error.message);
  }
}

// Run the automated process
downloadAllVideosAutomated(); 