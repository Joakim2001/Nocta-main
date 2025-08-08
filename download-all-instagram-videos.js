const axios = require('axios');

async function downloadAllInstagramVideos() {
  try {
    console.log('🎬 Downloading and permanently storing all Instagram videos...');
    
    // First, get all documents
    const listResponse = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/batchConvertExistingToWebP', {
      limit: 1000,
      listOnly: true
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const allDocumentIds = listResponse.data.documentIds;
    console.log(`📋 Found ${allDocumentIds.length} documents to check for videos`);
    
    let totalVideosFound = 0;
    let totalVideosDownloaded = 0;
    let totalVideosFailed = 0;
    
    for (let i = 0; i < allDocumentIds.length; i++) {
      const docId = allDocumentIds[i];
      console.log(`\n📄 Processing document ${i + 1}/${allDocumentIds.length}: ${docId}`);
      
      try {
        const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/downloadAndStoreInstagramVideo', {
          docId: docId
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.data.success) {
          console.log(`  ✅ Successfully downloaded and stored video`);
          console.log(`     📹 Size: ${response.data.originalSize} bytes`);
          console.log(`     🔗 URL: ${response.data.permanentUrl.substring(0, 80)}...`);
          totalVideosDownloaded++;
        } else if (response.data.message.includes('No unconverted video field found')) {
          console.log(`  ⚠️  No video found or already processed`);
        } else if (response.data.message.includes('Not an Instagram video URL')) {
          console.log(`  ⚠️  Not an Instagram video`);
        } else if (response.data.message.includes('Instagram access blocked')) {
          console.log(`  ❌ Instagram access blocked (URL may have expired)`);
          totalVideosFailed++;
        } else {
          console.log(`  ❌ Failed: ${response.data.message}`);
          totalVideosFailed++;
        }
        
        totalVideosFound++;
        
      } catch (error) {
        console.log(`  ❌ Error processing document: ${error.response?.data?.error || error.message}`);
        totalVideosFailed++;
      }
      
      // Wait 2 seconds between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n🎊 Processing complete!');
    console.log(`📊 Total documents checked: ${allDocumentIds.length}`);
    console.log(`📊 Total videos found: ${totalVideosFound}`);
    console.log(`✅ Successfully downloaded: ${totalVideosDownloaded}`);
    console.log(`❌ Failed to download: ${totalVideosFailed}`);
    
    if (totalVideosDownloaded > 0) {
      console.log('\n🎉 Your videos are now permanently stored and will never expire!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

downloadAllInstagramVideos(); 