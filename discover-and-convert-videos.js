const axios = require('axios');

async function discoverAndConvertVideos() {
  try {
    console.log('🎬 Discovering and converting videos...');
    
    // First, let's get all document IDs
    const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/batchConvertExistingToWebP', {
      limit: 1000,
      listOnly: true
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const allDocumentIds = response.data.documentIds;
    console.log(`📋 Found ${allDocumentIds.length} documents to check for videos`);
    
    // Common video field names
    const videoFields = ['Videourl', 'Video', 'video', 'videoUrl', 'VideoUrl', 'videourl'];
    
    let totalVideosFound = 0;
    let totalVideosConverted = 0;
    
    for (let i = 0; i < allDocumentIds.length; i++) {
      const docId = allDocumentIds[i];
      console.log(`\n📄 Checking document ${i + 1}/${allDocumentIds.length}: ${docId}`);
      
      // Check each video field
      for (const videoField of videoFields) {
        try {
          const convertResponse = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/convertVideoToWebM', {
            docId: docId,
            videoField: videoField
          }, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (convertResponse.data.success) {
            console.log(`  ✅ ${videoField}: Successfully converted!`);
            totalVideosFound++;
            totalVideosConverted++;
          }
          
        } catch (error) {
          if (error.response?.data?.error?.includes('not found in document')) {
            // Field doesn't exist, continue to next field
            continue;
          } else if (error.response?.data?.error?.includes('Document not found')) {
            console.log(`  ❌ Document not found, skipping...`);
            break;
          } else {
            console.log(`  ⚠️ ${videoField}: ${error.response?.data?.error || error.message}`);
            totalVideosFound++;
          }
        }
        
        // Wait 1 second between video field checks
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Wait 2 seconds between documents
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n🎊 Video conversion complete!');
    console.log(`📊 Total videos found: ${totalVideosFound}`);
    console.log(`📊 Total videos converted: ${totalVideosConverted}`);
    
  } catch (error) {
    console.error('❌ Error during video discovery and conversion:', error.response?.data || error.message);
  }
}

discoverAndConvertVideos(); 