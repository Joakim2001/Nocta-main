// This script tests the theory that EventCard is reading from stale/cached data
// that doesn't match what's actually in the database

console.log('🧪 Testing Video URL Consistency...\n');

// Simulate what EventCard sees in EventsList
const mockEventCardData = {
  id: '3694540404527611000',
  title: 'Karrusel Festival: Paul Kalkbrenner, DJ Boring Live',
  optimizedVideourl: 'https://storage.googleapis.com/nocta_bucket/optimized_video_1754851298160_0_1cvv62pxu.mp4',
  webMVideourl: undefined,
  videourl: null,
  videoUrl: null,
  VideoURL: null
};

console.log('📱 EventCard sees this data:');
console.log('  ID:', mockEventCardData.id);
console.log('  Title:', mockEventCardData.title);
console.log('  optimizedVideourl:', mockEventCardData.optimizedVideourl);
console.log('  webMVideourl:', mockEventCardData.webMVideourl);
console.log('  videourl:', mockEventCardData.videourl);
console.log('  videoUrl:', mockEventCardData.videoUrl);
console.log('  VideoURL:', mockEventCardData.VideoURL);

// Simulate EventCard's video detection logic
const videoUrl = mockEventCardData.optimizedVideourl || 
                 mockEventCardData.webMVideourl || 
                 mockEventCardData.videourl || 
                 mockEventCardData.videoUrl || 
                 mockEventCardData.VideoURL;

console.log('\n🎬 EventCard video detection result:');
console.log('  Final videoUrl:', videoUrl);
console.log('  Would set mediaType to video:', !!videoUrl);

// Simulate what EventDetailPage would see after fetching from database
const mockEventDetailPageData = {
  id: '3694540404527611000',
  title: 'Karrusel Festival: Paul Kalkbrenner, DJ Boring Live',
  optimizedVideourl: undefined,  // ← This is undefined in EventDetailPage!
  webMVideourl: undefined,
  videourl: null,
  videoUrl: null,
  VideoURL: null
};

console.log('\n📄 EventDetailPage sees this data (after database fetch):');
console.log('  ID:', mockEventDetailPageData.id);
console.log('  Title:', mockEventDetailPageData.title);
console.log('  optimizedVideourl:', mockEventDetailPageData.optimizedVideourl);
console.log('  webMVideourl:', mockEventDetailPageData.webMVideourl);
console.log('  videourl:', mockEventDetailPageData.videourl);
console.log('  videoUrl:', mockEventDetailPageData.videoUrl);
console.log('  VideoURL:', mockEventDetailPageData.VideoURL);

// Simulate EventDetailPage's video detection logic
const detailPageVideoUrl = mockEventDetailPageData.optimizedVideourl || 
                          mockEventDetailPageData.webMVideourl || 
                          mockEventDetailPageData.videourl || 
                          mockEventDetailPageData.videoUrl || 
                          mockEventDetailPageData.VideoURL;

console.log('\n🎬 EventDetailPage video detection result:');
console.log('  Final videoUrl:', detailPageVideoUrl);
console.log('  Would set mediaType to video:', !!detailPageVideoUrl);

console.log('\n🔍 ANALYSIS:');
console.log('  EventCard finds video URL:', !!videoUrl);
console.log('  EventDetailPage finds video URL:', !!detailPageVideoUrl);
console.log('  URLs match:', videoUrl === detailPageVideoUrl);

if (videoUrl !== detailPageVideoUrl) {
  console.log('\n❌ MISMATCH DETECTED!');
  console.log('  EventCard video URL:', videoUrl);
  console.log('  EventDetailPage video URL:', detailPageVideoUrl);
  console.log('\n🎯 Possible causes:');
  console.log('  1. EventCard is reading from stale/cached data in EventsList');
  console.log('  2. The video URL exists in EventsList but not in the database');
  console.log('  3. There\'s a data inconsistency between collections');
  console.log('  4. The video URL was added to EventsList after the database fetch');
} else {
  console.log('\n✅ URLs match - no consistency issue detected');
}

console.log('\n💡 Next steps:');
console.log('  1. Run the debug-event-video-mismatch.js script to check the database');
console.log('  2. Check if EventsList is caching stale data');
console.log('  3. Verify the video URL actually exists in the database document');
console.log('  4. Check if there are multiple collections with different data');
