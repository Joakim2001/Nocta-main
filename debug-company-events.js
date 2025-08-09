// Debug script to check company events
// Run this in your browser console on the Firebase Console

async function debugCompanyEvents() {
  try {
    console.log('🔍 Debugging company events...');
    
    // Get all events from Instagram_posts collection
    const response = await fetch('https://firestore.googleapis.com/v1/projects/nocta-d1113/databases/(default)/documents/Instagram_posts', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + (await firebase.auth().currentUser?.getIdToken() || 'no-token')
      }
    });
    
    const data = await response.json();
    console.log('📊 All events:', data.documents?.length || 0);
    
    // Filter company-created events
    const companyEvents = data.documents?.filter(doc => 
      doc.fields?.source?.stringValue === 'company-created'
    ) || [];
    
    console.log('🏢 Company-created events found:', companyEvents.length);
    
    companyEvents.forEach((doc, index) => {
      const fields = doc.fields;
      console.log(`🏢 Company Event ${index + 1}:`, {
        id: doc.name.split('/').pop(),
        title: fields.title?.stringValue || 'No title',
        companyName: fields.companyName?.stringValue || 'No company name',
        eventDate: fields.eventDate?.timestampValue || 'No eventDate',
        eventDateEnd: fields.eventDateEnd?.timestampValue || 'No eventDateEnd',
        createdAt: fields.createdAt?.timestampValue || 'No createdAt',
        timestamp: fields.timestamp?.timestampValue || 'No timestamp',
        source: fields.source?.stringValue || 'No source'
      });
    });
    
    // Check if any company events have valid future dates
    const now = new Date();
    const futureCompanyEvents = companyEvents.filter(doc => {
      const fields = doc.fields;
      const eventDate = fields.eventDate?.timestampValue;
      if (eventDate) {
        const date = new Date(eventDate);
        return date > now;
      }
      return false;
    });
    
    console.log('📅 Company events with future dates:', futureCompanyEvents.length);
    
  } catch (error) {
    console.error('❌ Error debugging company events:', error);
  }
}

// Alternative: Use Firebase Console directly
console.log('📋 Or check manually in Firebase Console:');
console.log('1. Go to Firebase Console → Firestore Database');
console.log('2. Look at Instagram_posts collection');
console.log('3. Filter by source = "company-created"');
console.log('4. Check if events have valid eventDate fields');

debugCompanyEvents(); 