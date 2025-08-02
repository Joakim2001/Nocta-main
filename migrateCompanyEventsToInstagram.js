const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://nocta-d1113-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.firestore();

async function migrateCompanyEvents() {
  console.log('🚀 Starting migration of company events...');
  
  try {
    // 1. Fetch all events from company-events collection
    const companyEventsSnapshot = await db.collection('company-events').get();
    console.log(`📊 Found ${companyEventsSnapshot.docs.length} company events to migrate`);
    
    if (companyEventsSnapshot.empty) {
      console.log('✅ No company events found to migrate');
      return;
    }
    
    let migratedCount = 0;
    let errorCount = 0;
    
    // 2. Process each company event
    for (const doc of companyEventsSnapshot.docs) {
      try {
        const eventData = doc.data();
        const eventId = doc.id;
        
        console.log(`📝 Migrating event: ${eventData.title || eventData.name || eventId}`);
        
        // 3. Transform the data to match Instagram_posts structure
        const migratedEventData = {
          ...eventData,
          // Add source tracking fields
          source: 'company-created',
          createdBy: eventData.userId || eventData.createdBy,
          // Ensure compatibility fields exist
          fullname: eventData.companyName || eventData.fullname || "Unknown Company",
          username: eventData.companyName ? 
            eventData.companyName.toLowerCase().replace(/\s+/g, '') : 
            (eventData.username || "unknown"),
          caption: eventData.description || eventData.caption || "",
          timestamp: eventData.createdAt || eventData.timestamp || admin.firestore.FieldValue.serverTimestamp(),
          // Ensure engagement fields exist
          viewscount: eventData.viewscount || 0,
          likescount: eventData.likescount || 0
        };
        
        // 4. Add to Instagram_posts collection
        await db.collection('Instagram_posts').doc(eventId).set(migratedEventData);
        
        console.log(`✅ Successfully migrated: ${eventData.title || eventData.name || eventId}`);
        migratedCount++;
        
      } catch (error) {
        console.error(`❌ Error migrating event ${doc.id}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n🎉 Migration Summary:');
    console.log(`✅ Successfully migrated: ${migratedCount} events`);
    console.log(`❌ Errors: ${errorCount} events`);
    
    if (errorCount === 0) {
      console.log('\n🗑️  All events migrated successfully!');
      console.log('⚠️  You can now manually delete the company-events collection if desired');
      console.log('⚠️  Or run the cleanup script to remove migrated events');
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  }
}

async function cleanupOldCollection() {
  console.log('\n🧹 Starting cleanup of old company-events collection...');
  
  try {
    const companyEventsSnapshot = await db.collection('company-events').get();
    
    if (companyEventsSnapshot.empty) {
      console.log('✅ company-events collection is already empty');
      return;
    }
    
    console.log(`🗑️  Deleting ${companyEventsSnapshot.docs.length} documents from company-events...`);
    
    // Delete in batches to avoid limits
    const batch = db.batch();
    companyEventsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log('✅ Successfully cleaned up company-events collection');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--cleanup-only')) {
    await cleanupOldCollection();
  } else if (args.includes('--with-cleanup')) {
    await migrateCompanyEvents();
    await cleanupOldCollection();
  } else {
    await migrateCompanyEvents();
    console.log('\n💡 To cleanup the old collection, run:');
    console.log('node migrateCompanyEventsToInstagram.js --cleanup-only');
    console.log('\n💡 To migrate and cleanup in one go, run:');
    console.log('node migrateCompanyEventsToInstagram.js --with-cleanup');
  }
  
  process.exit(0);
}

main().catch(console.error);