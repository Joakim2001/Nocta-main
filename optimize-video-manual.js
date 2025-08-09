// Simple script to optimize a specific video
// Run this in your browser console on the Firebase Console or use curl

const eventId = '3524973568157937700';
const videoUrl = 'https://instagram.fbrs5-1.fna.fbcdn.net/o1/v/t16/f2/m86/AQN9M9T0HpdJrPdz5t9UD2DgNb_JC2mkH4YB-eUT5U7rEUahF1qgVE-vtURYwECn-DEWwjgOW7gbo2HZa5FKF-pE62BupxaDSEOyzkM.mp4?stp=dst-mp4&efg=eyJxZV9ncm91cHMiOiJbXCJpZ193ZWJfZGVsaXZlcnlfdnRzX290ZlwiXSIsInZlbmNvZGVfdGFnIjoidnRzX3ZvZF91cmxnZW4uY2xpcHMuYzIuMzYwLmJhc2VsaW5lIn0&_nc_cat=111&vs=1041525144329174_70722787&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wRTQwN0Y4MzlCMjE4REM0MkVGOTY4QjExQUE2NEZBMF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYOnBhc3N0aHJvdWdoX2V2ZXJzdG9yZS9HUEdmQ0J4ZXdLOElBUElGQU8tYTBISmFzTEloYnFfRUFBQUYVAgLIARIAKAAYABsAFQAAJsi22tHN%2BpBAFQIoAkMzLBdAVvMzMzMzMxgSZGFzaF9iYXNlbGluZV8zX3YxEQB1%2Fgdl5p0BAA%3D%3D&_nc_rid=52045bb94b&ccb=9-4&oh=00_AfXo88yHB-dXwiJKCsgLQnmbVAQ9XpspWtXro-TV9PZHaQ&oe=6896E3A9&_nc_sid=10d13b';

// Method 1: Using fetch (run in browser console)
async function optimizeVideo() {
  try {
    console.log('🚀 Calling optimizeVideos function...');
    
    const response = await fetch('https://us-central1-nocta-d1113.cloudfunctions.net/optimizeVideos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videos: [videoUrl]
      })
    });
    
    const result = await response.json();
    console.log('✅ Optimization result:', result);
    
    if (result.success && result.optimizedVideos && result.optimizedVideos.length > 0) {
      const optimizedVideoUrl = result.optimizedVideos[0];
      console.log('✅ Optimized video URL:', optimizedVideoUrl);
      console.log('📝 Update your Firestore document with:');
      console.log(`optimizedVideourl: "${optimizedVideoUrl}"`);
      console.log(`videoOptimizationComplete: true`);
      console.log(`videoOptimizationDate: new Date().toISOString()`);
      console.log(`optimizedInN8n: true`);
    } else {
      console.log('❌ Video optimization failed:', result);
    }
    
  } catch (error) {
    console.error('❌ Error optimizing video:', error);
  }
}

// Method 2: Using curl (run in terminal)
console.log('📋 Or use this curl command:');
console.log(`curl -X POST https://us-central1-nocta-d1113.cloudfunctions.net/optimizeVideos \\
  -H "Content-Type: application/json" \\
  -d '{"videos": ["${videoUrl}"]}'`);

// Run the optimization
optimizeVideo(); 