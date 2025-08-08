// Process each item and convert images to WebP using Firebase function
const results = [];

for (const item of $input.all()) {
  // Updated to include all the fields you mentioned
  const imageFields = ['Displayurl', 'Image1', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6'];
  const updatedItem = { ...item.json };
  
  console.log(`🔄 Processing item: ${item.json.title || item.json.id || 'Unknown'}`);
  
  for (const field of imageFields) {
    const imageUrl = item.json[field];
    
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '') {
      // Skip if already WebP
      if (imageUrl.includes('.webp')) {
        console.log(`⏭️  ${field} already WebP, skipping`);
        continue;
      }
      
      console.log(`🔄 Converting ${field}: ${imageUrl.substring(0, 50)}...`);
      
      try {
        // Call Firebase function to convert to WebP
        const response = await fetch('https://us-central1-nocta-d1113.cloudfunctions.net/convertToWebP', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: {
              imageUrl: imageUrl
            }
          })
        });
        
        const result = await response.json();
        
        if (result.result && result.result.success) {
          // Replace the original field with WebP URL
          updatedItem[field] = result.result.webpUrl;
          
          // Also keep the original URL in a backup field
          updatedItem[`${field}_original`] = imageUrl;
          
          console.log(`✅ Converted ${field} to WebP: ${result.result.compressionRatio} smaller`);
          console.log(`   Original: ${(result.result.originalSize / 1024).toFixed(1)} KB`);
          console.log(`   WebP: ${(result.result.webpSize / 1024).toFixed(1)} KB`);
          console.log(`   New URL: ${result.result.webpUrl}`);
        } else {
          console.log(`❌ Failed to convert ${field}: ${result.result?.error || 'Unknown error'}`);
        }
        
      } catch (error) {
        console.log(`❌ Error converting ${field}:`, error.message);
      }
    } else {
      console.log(`⏭️  ${field} is empty or null, skipping`);
    }
  }
  
  results.push(updatedItem);
}

console.log(`🎉 Processed ${results.length} items`);
return results; 