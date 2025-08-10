// Process each item and convert images to WebP using Firebase function
// UPDATED: Maintains same number of items, processes images one by one
const results = [];

for (const item of $input.all()) {
  const data = item.json;
  
  // Get the document ID - this is CRITICAL!
  const docId = data.id || data.docId || data.documentId;
  
  if (!docId) {
    console.log(`❌ ERROR: No document ID found for item: ${data.title || 'Unknown'}`);
    console.log(`   Available fields:`, Object.keys(data));
    // Still add the item even if no docId, but mark it as error
    data.hasError = true;
    data.errorMessage = 'No document ID found';
    results.push({ json: data });
    continue;
  }
  
  console.log(`🔄 Processing item: ${data.title || data.id || 'Unknown'} (DocID: ${docId})`);
  
  // Define image fields to process
  const imageFields = ['Displayurl', 'Image0', 'Image1', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6'];
  
  // Add metadata fields to the original item (don't create new items)
  data.docId = docId; // Add docId for easy access
  data.imageFieldsToProcess = []; // Track which fields need conversion
  
  // Check which images need conversion and prepare the data
  for (const field of imageFields) {
    const imageUrl = data[field];
    
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '' && !imageUrl.includes('.webp')) {
      // Mark this field for conversion
      data.imageFieldsToProcess.push({
        field: field,
        imageUrl: imageUrl,
        needsConversion: true
      });
      
      console.log(`✅ Marked ${field} for conversion in document ${docId}`);
    } else if (imageUrl && imageUrl.includes('.webp')) {
      console.log(`⏭️  ${field} already WebP, skipping`);
    } else {
      console.log(`⏭️  ${field} is empty or null, skipping`);
    }
  }
  
  // Add the processed item (same item, just with added metadata)
  results.push({ json: data });
}

console.log(`🎯 Processed ${results.length} items (same as input)`);
console.log(`📊 Total images marked for conversion: ${results.reduce((sum, item) => sum + item.json.imageFieldsToProcess.length, 0)}`);
return results; 