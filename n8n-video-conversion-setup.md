# n8n Video Optimization Workflow Setup

## Overview
This guide shows how to add video optimization to your existing n8n workflow to download and store Instagram videos in Firebase Storage, preventing expiration and improving loading times.

## Step 1: Add "Filter Valid Videos" Code Node

**Add this node after your Google Sheets node and before the video conversion HTTP request:**

```javascript
// Filter out null/empty videos before conversion
const items = $input.all();
const processedItems = [];

for (const item of items) {
  const processedItem = { ...item.json };
  
  // Collect only valid video URLs
  const videoFields = ['videourl', 'videoUrl', 'VideoURL'];
  const validVideos = [];
  
  videoFields.forEach(field => {
    const videoUrl = processedItem[field];
    
    if (videoUrl && 
        typeof videoUrl === 'string' && 
        videoUrl.trim() !== '' &&
        videoUrl.startsWith('http')) {
      validVideos.push(videoUrl);
      console.log(`✅ Valid video found in ${field}: ${videoUrl.substring(0, 50)}...`);
    } else {
      console.log(`⏭️ Skipping ${field}: ${videoUrl ? 'invalid URL' : 'null/empty'}`);
    }
  });
  
  processedItem.validVideos = validVideos;
  processedItem.validVideoCount = validVideos.length;
  
  console.log(`Item ${processedItem.id}: Found ${processedItem.validVideoCount} valid videos`);
  
  processedItems.push({ json: processedItem });
}

return processedItems;
```

## Step 2: Add "Optimize Videos" HTTP Request Node

**Add this node after the "Filter Valid Videos" node:**

**Configuration:**
- **Method:** POST
- **URL:** `https://us-central1-nocta-d1113.cloudfunctions.net/optimizeVideos`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**
```json
{
  "videos": "={{ $json.validVideos }}"
}
```

## Step 3: Add "Extract Optimized Videos to Fields" Code Node

**Add this node after the "Optimize Videos" HTTP Request node:**

```javascript
// Extract optimized videos from optimizedVideos array to individual fields
const items = $input.all();
const processedItems = [];

for (const item of items) {
  // Get the original data and optimization results
  const originalData = item.json;
  
  console.log('Processing item:', originalData.id);
  console.log('Video optimization success:', originalData.success);
  
  if (originalData.success && originalData.optimizedVideos) {
    const optimizedVideos = originalData.optimizedVideos;
    
    // Create new data structure with optimized videos as individual fields
    const updatedData = { ...originalData };
    
    // Remove the nested optimizedVideos array - we'll extract it to individual fields
    delete updatedData.optimizedVideos;
    delete updatedData.success;
    delete updatedData.message;
    delete updatedData.stats;
    
    // Update video fields with Firebase Storage URLs
    if (optimizedVideos[0] && optimizedVideos[0].includes('storage.googleapis.com')) {
      updatedData.optimizedVideourl = optimizedVideos[0]; // New optimized video field
      console.log('✅ Updated optimizedVideourl with Firebase Storage URL');
    } else {
      console.log('⚠️ Video optimization failed, keeping original');
    }
    
    // Add optimization metadata
    updatedData.videoOptimizationComplete = true;
    updatedData.videoOptimizationDate = new Date().toISOString();
    updatedData.optimizedInN8n = true;
    
    console.log('✅ Optimized video data restructured successfully');
    processedItems.push({ json: updatedData });
    
  } else {
    console.log('❌ Video optimization failed, using original data');
    processedItems.push({ json: originalData });
  }
}

return processedItems;
```

## Step 4: Update Your Firestore Save Node

**Make sure your Firestore save node includes the new fields:**
- `optimizedVideourl` (Firebase Storage video URL)
- `videoOptimizationComplete` (boolean)
- `videoOptimizationDate` (timestamp)
- `optimizedInN8n` (boolean)

## Workflow Order:
1. **Google Sheets** → Get event data
2. **Filter Valid Videos** (Code) → Filter video URLs
3. **Optimize Videos** (HTTP Request) → Download and store in Firebase Storage
4. **Extract Optimized Videos to Fields** (Code) → Extract to individual fields
5. **Your existing AI processing nodes** → Continue with your workflow
6. **Firestore Save** → Save with optimized videos

## Benefits:
- ⚡ **Faster loading** (no Instagram URL expiration)
- 🎬 **Reliable access** (stored in Firebase Storage)
- 🔒 **No expiration** (Firebase Storage URLs don't expire)
- 📱 **Better mobile performance** (optimized delivery)

## Testing:
After deployment, check your Firestore documents for:
- `optimizedVideourl` field with `https://storage.googleapis.com/...` values
- `videoOptimizationComplete: true`
- `videoOptimizationDate` timestamp 