const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'nocta_bucket.appspot.com'
});

const storage = new Storage({
  projectId: 'nocta-d1113',
  keyFilename: './serviceAccountKey.json'
});

const bucketName = 'nocta_bucket';

async function setCorsConfigurationV2() {
  try {
    const bucket = storage.bucket(bucketName);
    
    // More permissive CORS configuration
    const corsConfiguration = [
      {
        origin: ['*'], // Allow all origins temporarily for testing
        method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
        maxAgeSeconds: 3600,
        responseHeader: [
          'Content-Type', 
          'Access-Control-Allow-Origin',
          'Access-Control-Allow-Methods',
          'Access-Control-Allow-Headers',
          'Access-Control-Max-Age'
        ]
      }
    ];

    console.log('🔄 Setting CORS configuration...');
    await bucket.setCorsConfiguration(corsConfiguration);
    
    console.log('✅ CORS configuration set successfully!');
    console.log('Configuration:', JSON.stringify(corsConfiguration, null, 2));
    
    // Wait a moment for the configuration to propagate
    console.log('⏳ Waiting for configuration to propagate...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('✅ CORS configuration should now be active!');
    
  } catch (error) {
    console.error('❌ Error setting CORS configuration:', error);
    
    // Try alternative approach
    try {
      console.log('🔄 Trying alternative approach...');
      
      // Use the Firebase Admin SDK directly
      const bucket = admin.storage().bucket(bucketName);
      
      const corsConfiguration = [
        {
          origin: ['https://nocta-d1113.web.app', 'http://localhost:3000'],
          method: ['GET', 'HEAD'],
          maxAgeSeconds: 3600,
          responseHeader: ['Content-Type', 'Access-Control-Allow-Origin']
        }
      ];

      await bucket.setCorsConfiguration(corsConfiguration);
      console.log('✅ Alternative CORS configuration set successfully!');
      
    } catch (altError) {
      console.error('❌ Alternative approach also failed:', altError);
    }
  }
}

setCorsConfigurationV2(); 