// This script tests whether your events have WebP images and if they're being used
console.log('🧪 Testing WebP Image Usage...\n');

// Simulate what your app sees for a typical event
const mockEventData = {
  id: 'test-event-123',
  title: 'Test Event',
  
  // WebP fields (these should be prioritized)
  webPImage1: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAADsAD+JaQAA3AAAAAA',
  webPImage0: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAADsAD+JaQAA3AAAAAA',
  webPImage2: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAADsAD+JaQAA3AAAAAA',
  webPDisplayurl: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAADsAD+JaQAA3AAAAAA',
  
  // Original image fields (these should be fallbacks)
  Image1: 'https://instagram.com/image1.jpg',
  Image0: 'https://instagram.com/image0.jpg',
  Image2: 'https://instagram.com/image2.jpg',
  Displayurl: 'https://instagram.com/display.jpg'
};

console.log('📱 Event data structure:');
console.log('  ID:', mockEventData.id);
console.log('  Title:', mockEventData.title);
console.log('  WebP fields available:', Object.keys(mockEventData).filter(key => key.startsWith('webP')));
console.log('  Original fields available:', Object.keys(mockEventData).filter(key => !key.startsWith('webP') && key.match(/^Image\d+$|^Displayurl$/)));

// Simulate EventCard's image selection logic
console.log('\n🎯 EventCard Image Selection Logic:');
console.log('1. Check for company event images (imageUrls array)');
console.log('2. Try WebP images first (highest priority)');
console.log('3. Fallback to original images with proxy');

// Check WebP images
const webPFields = [
  mockEventData.webPImage1, mockEventData.webPImage0, mockEventData.webPImage2, 
  mockEventData.webPImage3, mockEventData.webPImage4, mockEventData.webPImage5, 
  mockEventData.webPImage6, mockEventData.webPDisplayurl
];

console.log('\n🔍 Checking WebP images...');
let webPImageFound = false;
let selectedWebPField = null;

for (const webPField of webPFields) {
  if (webPField && webPField.startsWith('data:image/webp;base64,')) {
    webPImageFound = true;
    selectedWebPField = webPField;
    console.log('✅ Found WebP image:', webPField.substring(0, 50) + '...');
    break;
  }
}

if (webPImageFound) {
  console.log('🎉 WebP image selected! This will load faster than original images.');
  console.log('  Selected field:', selectedWebPField ? 'WebP image found' : 'None');
} else {
  console.log('❌ No WebP images found, will fallback to original images');
  
  // Check original images
  const originalFields = [
    mockEventData.Image1, mockEventData.Image0, mockEventData.Image2, 
    mockEventData.Image3, mockEventData.Image4, mockEventData.Image5, 
    mockEventData.Image6, mockEventData.Displayurl
  ];
  
  let originalImageFound = false;
  for (const originalField of originalFields) {
    if (originalField && originalField !== null) {
      originalImageFound = true;
      console.log('📸 Found original image:', originalField);
      break;
    }
  }
  
  if (originalImageFound) {
    console.log('⚠️  Using original image (slower loading)');
  } else {
    console.log('❌ No images found at all');
  }
}

console.log('\n💡 ANALYSIS:');
if (webPImageFound) {
  console.log('✅ Your app IS correctly prioritizing WebP images');
  console.log('✅ If loading is still slow, the issue might be:');
  console.log('   - WebP images are very large (base64 encoded)');
  console.log('   - Network issues');
  console.log('   - Browser caching');
} else {
  console.log('❌ Your app is NOT using WebP images');
  console.log('❌ This explains why loading is slow');
  console.log('❌ You need to run the WebP conversion with the fixed field names');
}

console.log('\n🎯 Next steps:');
console.log('1. Run the WebP conversion script with the fixed field names');
console.log('2. Check if events actually have webPImage1, webPImage2, etc. fields');
console.log('3. Verify the WebP images are smaller than the originals');
console.log('4. Test loading performance with WebP vs original images');
