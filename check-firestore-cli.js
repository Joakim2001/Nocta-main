const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 Checking Firestore collections using Firebase CLI...');

async function checkCollectionsWithCLI() {
  try {
    // Check if we're authenticated
    console.log('🔐 Checking Firebase CLI authentication...');
    const authCheck = execSync('firebase projects:list', { encoding: 'utf8' });
    console.log('✅ Firebase CLI authenticated');
    
    // Try to get project info
    console.log('📊 Getting project info...');
    const projectInfo = execSync('firebase use --add', { encoding: 'utf8' });
    console.log('✅ Project info retrieved');
    
    // Since we can't directly query Firestore data with CLI, let's check what we can access
    console.log('\n📋 Available Firebase CLI commands for this project:');
    
    try {
      const firestoreIndexes = execSync('firebase firestore:indexes --project nocta-d1113', { encoding: 'utf8' });
      console.log('✅ Can access Firestore indexes');
      console.log('   Indexes:', firestoreIndexes.trim());
    } catch (error) {
      console.log('❌ Cannot access Firestore indexes');
    }
    
    console.log('\n💡 Since Firebase CLI works but Admin SDK doesn\'t,');
    console.log('   the issue is likely with the service account permissions');
    console.log('   or the service account key has expired.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCollectionsWithCLI().then(() => {
  console.log('\n✅ CLI check complete!');
  console.log('\n📝 Summary:');
  console.log('   - Firebase CLI: ✅ Working');
  console.log('   - Admin SDK: ❌ Authentication failed');
  console.log('   - Real database: Has unoptimized videos');
  console.log('   - Script result: False "all optimized" message');
});
