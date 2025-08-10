# Video Optimization Automation Guide

This guide explains how to automate the process of optimizing videos and updating Firestore documents for the Nocta platform.

## Overview

The automation system consists of two main scripts:

1. **`bulk-video-optimization.js`** - Downloads, converts, and stores videos in Firebase Storage
2. **`bulk-update-firestore.js`** - Updates Firestore documents with optimized video URLs

## Prerequisites

Before running these scripts, ensure you have:

1. **Service Account Key**: A `serviceAccountKey.json` file with Firebase Admin permissions
2. **Node.js Dependencies**: Install required packages:
   ```bash
   npm install firebase-admin axios
   ```
3. **Firebase Project Access**: The service account must have read/write access to:
   - Firestore collections (`Instagram_posts`, `company-events`)
   - Firebase Storage bucket (`nocta_bucket.appspot.com`)

## Script 1: Bulk Video Optimization

### Purpose
This script automatically:
- Scans all events for unoptimized Instagram video URLs
- Calls the `optimizeVideos` Firebase Function for each video
- Updates Firestore documents with the new optimized URLs
- Processes videos in batches to avoid overwhelming the system

### Usage

#### Check Status (Dry Run)
```bash
node bulk-video-optimization.js --check
```
This shows which events need optimization without making changes.

#### Run Full Optimization
```bash
node bulk-video-optimization.js
```
This processes all unoptimized videos and updates Firestore.

### Configuration
The script includes configurable parameters:
- `BATCH_SIZE`: Number of videos to process simultaneously (default: 5)
- `DELAY_BETWEEN_BATCHES`: Delay between batches in milliseconds (default: 2000)
- `DELAY_BETWEEN_VIDEOS`: Delay between individual videos (default: 1000)

### What It Does
1. **Scans Collections**: Checks both `Instagram_posts` and `company-events`
2. **Identifies Videos**: Finds events with Instagram URLs in video fields
3. **Optimizes Videos**: Calls the Firebase Function to download and convert videos
4. **Updates Firestore**: Adds `optimizedVideourl` field to each document
5. **Tracks Progress**: Provides detailed logging and progress updates

### Output Fields Added
- `optimizedVideourl`: The new optimized video URL from Firebase Storage
- `videoOptimizationDate`: Timestamp when optimization completed
- `videoOptimizationStatus`: Status indicator ('completed')
- `{field}_original`: Backup of the original video URL

## Script 2: Bulk Firestore Updates

### Purpose
This script is useful when:
- Videos are already optimized and stored in Firebase Storage
- You only need to update Firestore documents
- You want to check the current status of video optimization

### Usage

#### Check Status
```bash
node bulk-update-firestore.js --check
```
Shows optimization status across all collections.

#### Update All Documents
```bash
node bulk-update-firestore.js
```
Updates Firestore documents with already-optimized video URLs.

### What It Does
1. **Scans Storage**: Looks for optimized videos in Firebase Storage
2. **Matches Events**: Links optimized videos to their corresponding events
3. **Updates Firestore**: Sets the `optimizedVideourl` field
4. **Provides Reports**: Shows success/failure rates and detailed status

## Workflow Options

### Option 1: Full Automation (Recommended)
```bash
# Step 1: Check current status
node bulk-video-optimization.js --check

# Step 2: Run full optimization
node bulk-video-optimization.js
```

### Option 2: Separate Optimization and Updates
```bash
# Step 1: Check what needs optimization
node bulk-video-optimization.js --check

# Step 2: Run optimization only (if needed)
node bulk-video-optimization.js

# Step 3: Check Firestore update status
node bulk-update-firestore.js --check

# Step 4: Update Firestore documents
node bulk-update-firestore.js
```

### Option 3: Just Check Status
```bash
# Check video optimization status
node bulk-video-optimization.js --check

# Check Firestore update status
node bulk-update-firestore.js --check
```

## Monitoring and Troubleshooting

### Console Output
Both scripts provide detailed logging:
- 🔍 Scanning and discovery
- 🎬 Video processing
- ✅ Success confirmations
- ❌ Error details
- 📊 Progress and statistics

### Common Issues

#### Permission Denied
- Ensure your service account has proper Firestore and Storage permissions
- Check that `serviceAccountKey.json` is in the correct location

#### Function Timeout
- The `optimizeVideos` function has a 5-minute timeout
- Large videos may take longer to process
- Consider reducing video quality or size if timeouts persist

#### Rate Limiting
- Scripts include built-in delays to avoid overwhelming Firebase
- Adjust `DELAY_BETWEEN_BATCHES` and `DELAY_BETWEEN_VIDEOS` if needed

### Verification
After running the scripts:
1. Check your app's console for the new debugging logs
2. Verify that videos are loading from `storage.googleapis.com` URLs
3. Check Firestore documents for the new `optimizedVideourl` fields

## Performance Considerations

### Batch Processing
- Videos are processed in batches to avoid overwhelming the system
- Default batch size is 5 videos
- Adjust based on your Firebase Function capacity

### Delays
- Built-in delays prevent rate limiting
- Can be adjusted based on your Firebase project limits
- Consider your Firebase Function's memory and timeout settings

### Storage Costs
- Optimized videos are permanently stored in Firebase Storage
- Monitor your Storage usage and costs
- Consider implementing cleanup for old/unused videos

## Security Notes

- **Service Account**: Keep your `serviceAccountKey.json` secure and never commit it to version control
- **Permissions**: Use the principle of least privilege for your service account
- **Firestore Rules**: Ensure your security rules allow the necessary operations

## Next Steps

After running the automation:

1. **Test Your App**: Verify that videos are loading from optimized URLs
2. **Monitor Performance**: Check if video loading times have improved
3. **Review Costs**: Monitor Firebase Storage and Function usage
4. **Set Up Monitoring**: Consider implementing alerts for failed optimizations

## Support

If you encounter issues:
1. Check the console output for detailed error messages
2. Verify your Firebase project configuration
3. Ensure all dependencies are properly installed
4. Check your service account permissions

The scripts are designed to be robust and provide detailed feedback to help troubleshoot any issues that arise.
