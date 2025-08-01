const admin = require('firebase-admin');

// Path to your service account key JSON file
const serviceAccount = require('./nocta-d1113-firebase-adminsdk-fbsvc-120a98ed68.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateDates() {
  const collectionName = 'Instagram posts'; // Change if your collection is named differently
  const snapshot = await db.collection(collectionName).get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    let updated = false;

    // Helper to convert to ISO if needed
    function toISO(val) {
      if (!val || typeof val !== 'string') return null;
      const trimmed = val.trim();
      // Try to parse any string
      const date = new Date(trimmed);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }

    // Always try to convert, even if it looks like a date
    const newEventDate = toISO(data.eventDate);
    const newEventDateEnd = toISO(data.eventDateEnd);

    // Only update if we can parse a date
    if (newEventDate) {
      data.eventDate = newEventDate;
      updated = true;
    }
    if (newEventDateEnd) {
      data.eventDateEnd = newEventDateEnd;
      updated = true;
    }

    if (updated) {
      await db.collection(collectionName).doc(doc.id).update({
        eventDate: data.eventDate,
        eventDateEnd: data.eventDateEnd
      });
      console.log(`Updated ${doc.id}:`, data.eventDate, data.eventDateEnd);
    }
  }

  console.log('Migration complete!');
}

migrateDates().catch(console.error);
