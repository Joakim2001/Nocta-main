// Process images one by one using the prepared data from the previous Code node
// This maintains the same structure while converting images individually
const results = [];

for (const item of $input.all()) {
  const data = item.json;
  
  // Skip items with errors
  if (data.hasError) {
    console.log(`⚠️ Skipping item with error: ${data.errorMessage}`);
    results.push({ json: data });
    continue;
  }
  
  // Check if this item has images to process
  if (!data.imageFieldsToProcess || data.imageFieldsToProcess.length === 0) {
    console.log(`⏭️ No images to convert for item ${data.id || 'Unknown'}`);
    results.push({ json: data });
    continue;
  }
  
  console.log(`🔄 Processing ${data.imageFieldsToProcess.length} images for item ${data.id || 'Unknown'}`);
  
  // Process each image field that needs conversion
  for (const imageData of data.imageFieldsToProcess) {
    const { field, imageUrl } = imageData;
    
    try {
      console.log(`🔄 Converting ${field}: ${imageUrl.substring(0, 50)}...`);
      
      // Call Firebase function to convert to WebP
      const response = await fetch('https://us-central1-nocta-d1113.cloudfunctions.net/convertToWebPHttp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imageUrl,
          docId: data.docId,
          imageField: field
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Replace the original field with WebP data URL
        data[field] = result.webpUrl;
        
        // Keep the original URL in a backup field
        data[`${field}_original`] = imageUrl;
        
        // Add conversion metadata
        data[`${field}_webpConverted`] = true;
        data[`${field}_webpUrl`] = result.webpUrl;
        data[`${field}_conversionDate`] = new Date().toISOString();
        data[`${field}_storedInFirestore`] = true;
        data[`${field}_webpSizeBytes`] = result.webpSize;
        data[`${field}_compressionRatio`] = result.compressionRatio;
        
        console.log(`✅ Converted ${field} to WebP: ${result.compressionRatio} smaller`);
        console.log(`   Original: ${(result.originalSize / 1024).toFixed(1)} KB`);
        console.log(`   WebP: ${(result.webpSize / 1024).toFixed(1)} KB`);
        console.log(`   Data URL size: ${(result.webpUrl.length / 1024).toFixed(1)} KB`);
        
        // Mark this image as processed
        imageData.processed = true;
        imageData.result = result;
        
      } else {
        console.log(`❌ Failed to convert ${field}: ${result.error || 'Unknown error'}`);
        if (result.note) {
          console.log(`   Note: ${result.note}`);
        }
        
        // Mark this image as failed
        imageData.processed = false;
        imageData.error = result.error || 'Unknown error';
      }
      
    } catch (error) {
      console.log(`❌ Error converting ${field}:`, error.message);
      
      // Mark this image as failed
      imageData.processed = false;
      imageData.error = error.message;
    }
  }
  
  // Add conversion summary
  const successfulConversions = data.imageFieldsToProcess.filter(img => img.processed === true).length;
  const failedConversions = data.imageFieldsToProcess.filter(img => img.processed === false).length;
  
  data.conversionSummary = {
    totalImages: data.imageFieldsToProcess.length,
    successful: successfulConversions,
    failed: failedConversions,
    completedAt: new Date().toISOString()
  };
  
  console.log(`✅ Item ${data.id || 'Unknown'} completed: ${successfulConversions}/${data.imageFieldsToProcess.length} images converted`);
  
  // Add the processed item (same item, just with converted images)
  results.push({ json: data });
}

console.log(`🎉 Processed ${results.length} items (same as input)`);
console.log(`💾 WebP images stored directly in Firestore database as data URLs`);
console.log(`🎥 Only optimized videos will be stored in Firebase Storage`);

return results;


