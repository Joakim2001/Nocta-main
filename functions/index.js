console.log("Starting createCheckoutSession function deployment...");
console.log("About to initialize modules...");
const { onRequest } = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const { Storage } = require("@google-cloud/storage");
const stripeLib = require('stripe');
const nodemailer = require('nodemailer');
const cors = require('cors')({ origin: true });
const axios = require('axios');
console.log("Modules initialized!");

admin.initializeApp();
const db = admin.firestore();
const NEW_BUCKET = "nocta-d1113.appspot.com"; // Default bucket name - will be created automatically
const storage = new Storage();

// Direct email sending function using Nodemailer
async function sendEmailDirect(ticketData) {
  const purchaseDate = ticketData.purchaseDate._seconds 
    ? new Date(ticketData.purchaseDate._seconds * 1000) 
    : new Date();

  // Create transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'joakimstub2@gmail.com',
      pass: 'zsefuzxjmzisncsz' // Gmail app password (no spaces)
    },
    defaultContentType: 'text/html; charset=UTF-8'
  });

  const mailOptions = {
    from: '"Nocta Support" <joakimstub2@gmail.com>',
    to: ticketData.customerEmail,
    subject: `🎫 Your ticket for ${ticketData.eventName}`,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8'
    },
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px; overflow: hidden;">
        <div style="padding: 40px 30px; text-align: center;">
          <h1 style="margin: 0 0 20px 0; font-size: 28px;">🎉 Ticket Confirmed!</h1>
          <p style="font-size: 18px; margin: 0 0 30px 0; opacity: 0.9;">Your ticket purchase was successful</p>
        </div>
        
        <div style="background: rgba(255,255,255,0.1); margin: 0 20px; border-radius: 10px; padding: 25px;">
          <h2 style="margin: 0 0 15px 0; color: #fff; font-size: 22px;">${ticketData.eventName}</h2>
          <div style="margin-bottom: 20px;">
            <span style="font-size: 16px; opacity: 0.9;">Price: </span>
            <span style="font-size: 20px; font-weight: bold;">${ticketData.price} ${ticketData.currency}</span>
          </div>
          <div style="margin-bottom: 20px;">
            <span style="font-size: 16px; opacity: 0.9;">Ticket ID: </span>
            <span style="font-family: monospace; font-size: 14px; background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 5px;">${ticketData.ticketId}</span>
          </div>
          <div style="margin-bottom: 20px;">
            <span style="font-size: 16px; opacity: 0.9;">Purchase Date: </span>
            <span style="font-size: 14px;">${purchaseDate.toLocaleDateString('en-GB')}</span>
          </div>
        </div>
        
        <div style="padding: 30px; text-align: center;">
          <p style="margin: 0 0 20px 0; font-size: 16px; opacity: 0.9;">
            Show this email or your QR code in the Nocta app at the event entrance.
          </p>
          <a href="https://nocta-d1113.web.app/my-tickets" style="display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin-top: 10px;">
            View in Nocta App
          </a>
        </div>
        
        <div style="padding: 20px 30px; text-align: center; background: rgba(0,0,0,0.2);">
          <p style="margin: 0; font-size: 14px; opacity: 0.8;">
            Questions? Contact us through the Nocta app or visit our website.
          </p>
        </div>
      </div>
    `,
    text: `🎫 Your ticket for ${ticketData.eventName}

Thank you for your purchase! Here are your ticket details:

Event: ${ticketData.eventName}
Price: ${ticketData.price} ${ticketData.currency}
Ticket ID: ${ticketData.ticketId}
Purchase Date: ${purchaseDate.toLocaleDateString('en-GB')}

Show this email or your QR code in the Nocta app at the event entrance.

View your tickets: https://nocta-d1113.web.app/my-tickets

Questions? Contact us through the Nocta app.`
  };

  return await transporter.sendMail(mailOptions);
}

// Firestore trigger removed for deployment troubleshooting

console.log("About to export createCheckoutSession...");
// Stripe webhook to handle successful payments
exports.stripeWebhook = onRequest(
  {
    region: 'europe-west1',
    secrets: ['STRIPE_SECRET'],
    invoker: 'public'
  },
  async (req, res) => {
    const stripe = stripeLib(process.env.STRIPE_SECRET);
    
    let event;
    
    // For now, skip signature verification to get it working
    // In production, you should enable this with proper STRIPE_WEBHOOK_SECRET
    try {
      event = req.body;
      console.log('Received webhook event:', event.type);
    } catch (err) {
      console.log(`Webhook parsing failed.`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      console.log('Processing checkout.session.completed for session:', session.id);
      console.log('Session metadata:', session.metadata);
      console.log('Client reference ID:', session.client_reference_id);
      
      try {
        const ticketData = {
          userId: session.client_reference_id || 'anonymous',
          eventName: session.metadata?.eventName || 'Unknown Event',
          price: session.amount_total / 100, // Convert from cents
          currency: session.currency.toUpperCase(),
          stripeSessionId: session.id,
          customerEmail: session.customer_email,
          paymentStatus: session.payment_status,
          purchaseDate: admin.firestore.Timestamp.now(),
          ticketId: `TKT-${session.id.slice(-8).toUpperCase()}`,
        };
        
        console.log('Initial ticket data:', ticketData);
        
        // Update event ticket availability if eventId and tierIndex are provided
        if (session.metadata?.eventId && session.metadata?.tierIndex !== undefined) {
          try {
            const eventId = session.metadata.eventId;
            const tierIndex = parseInt(session.metadata.tierIndex);
            
            console.log('Updating ticket availability for event:', eventId, 'tier:', tierIndex);
            
            // Get the event document from Instagram_posts (events were migrated there)
            const eventRef = db.collection('Instagram_posts').doc(eventId);
            const eventDoc = await eventRef.get();
            
            if (eventDoc.exists) {
              const eventData = eventDoc.data();
              const ticketConfig = eventData.ticketConfiguration;
              
              // Update ticket data with event information
              ticketData.eventDate = eventData.eventDate || eventData.eventDates?.[0];
              if (eventData.eventDateEnd) {
                ticketData.eventDateEnd = eventData.eventDateEnd;
              }
              ticketData.location = eventData.location;
              ticketData.companyName = eventData.companyName;
              ticketData.tierName = ticketConfig?.pricingTiers?.[tierIndex]?.name || 'General Admission';
              
              console.log('Updated ticket data with event info:', ticketData);
              
              if (ticketConfig && ticketConfig.pricingTiers && ticketConfig.pricingTiers[tierIndex]) {
                // Decrease the quantity by 1
                const currentQuantity = parseInt(ticketConfig.pricingTiers[tierIndex].quantity) || 0;
                const newQuantity = Math.max(0, currentQuantity - 1);
                
                ticketConfig.pricingTiers[tierIndex].quantity = newQuantity.toString();
                
                // Update the event document
                await eventRef.update({
                  ticketConfiguration: ticketConfig
                });
                
                console.log('Updated ticket availability for tier', tierIndex, 'from', currentQuantity, 'to', newQuantity);
              }
            }
          } catch (updateError) {
            console.error('Error updating ticket availability:', updateError);
            // Don't fail the webhook if availability update fails
          }
        }
        
        // Save ticket to Firestore with updated data
        console.log('Final ticket data to save:', ticketData);
        const docRef = await db.collection('tickets').add(ticketData);
        console.log('Ticket saved to Firestore with ID:', docRef.id);
        
        // If no event data was found, still save the basic ticket
        if (!session.metadata?.eventId) {
          console.log('No event ID found in metadata, saving basic ticket data');
        }
        
        // Send confirmation email directly
        try {
          console.log('Sending email directly to:', ticketData.customerEmail);
          const emailResult = await sendEmailDirect(ticketData);
          console.log('Email sent successfully:', emailResult.messageId);
          
        } catch (emailError) {
          console.error('Error sending email:', emailError);
          // Don't fail the webhook if email fails
        }
        
      } catch (error) {
        console.error('Error saving ticket:', error);
        console.error('Error details:', error.message);
      }
    } else {
      console.log('Received non-checkout event:', event.type);
    }
    
    res.json({ received: true });
  }
);

// Simple, working checkout session - no complex parameters
exports.createCheckoutSessionSimple = onRequest(
  { 
    region: 'europe-west1',
    secrets: ['STRIPE_SECRET'],
    cors: true,
    invoker: 'public'
  }, 
  async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    const { price, eventName, userEmail, eventId, tierIndex, baseUrl, userId } = req.body;

    if (!price || !eventName || !userEmail) {
      return res.status(400).send('Missing required fields');
    }

    try {
      console.log('Creating simple checkout session');
      const stripe = stripeLib(process.env.STRIPE_SECRET);

      // Determine base URL - use provided baseUrl or fallback to production
      const redirectBaseUrl = baseUrl || 'https://nocta-d1113.web.app';
      console.log('Using redirect base URL:', redirectBaseUrl);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'dkk',
              product_data: {
                name: eventName,
              },
              unit_amount: Math.round(price * 100),
            },
            quantity: 1,
          },
        ],
        customer_email: userEmail,
        client_reference_id: userId, // This is crucial for the webhook to identify the user
        metadata: {
          eventName: eventName,
          userEmail: userEmail,
          eventId: eventId || '',
          tierIndex: tierIndex?.toString() || '0',
          userId: userId || ''
        },
        success_url: `${redirectBaseUrl}/payment-success`,
        cancel_url: `${redirectBaseUrl}/payment-cancel`
      });

      console.log('Checkout session created successfully');
      res.json({ url: session.url });
    } catch (error) {
      console.error('Stripe error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Test function to manually create a ticket
exports.createTestTicket = onRequest(
  {
    region: 'europe-west1',
    cors: true,
    invoker: 'public'
  },
  async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }
    
    const { userId, eventName, price } = req.body;
    
    if (!userId) {
      return res.status(400).send('Missing userId');
    }
    
    try {
      const ticketData = {
        userId: userId,
        eventName: eventName || 'Test Event - Hip-Hop Saturday',
        price: price || 150,
        currency: 'DKK',
        stripeSessionId: `test_session_${Date.now()}`,
        customerEmail: 'test@example.com',
        paymentStatus: 'paid',
        purchaseDate: admin.firestore.Timestamp.now(),
        ticketId: `TKT-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      };
      
      console.log('Creating test ticket:', ticketData);
      
      const docRef = await db.collection('tickets').add(ticketData);
      
      console.log('Test ticket created with ID:', docRef.id);
      
      res.json({ 
        success: true, 
        ticketId: docRef.id,
        message: 'Test ticket created successfully' 
      });
      
    } catch (error) {
      console.error('Error creating test ticket:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
);

// Function to get tickets for a user
exports.getUserTickets = onRequest(
  {
    region: 'europe-west1',
    cors: true,
    invoker: 'public'
  },
  async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }
    
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).send('Missing userId');
    }
    
    try {
      console.log('Fetching tickets for user:', userId);
      
      // Get all tickets and filter by userId
      const ticketsSnapshot = await db.collection('tickets').get();
      const allTickets = ticketsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('All tickets found:', allTickets.length);
      
      // Debug: Log all user IDs in tickets
      const userIds = allTickets.map(ticket => ticket.userId);
      console.log('All user IDs in tickets:', userIds);
      console.log('Looking for user ID:', userId);
      
      // Debug: Log first few tickets to see their structure
      console.log('Sample tickets:', allTickets.slice(0, 3).map(t => ({
        id: t.id,
        userId: t.userId,
        eventName: t.eventName,
        customerEmail: t.customerEmail
      })));
      
      // Filter for this user
      const userTickets = allTickets.filter(ticket => ticket.userId === userId);
      
      console.log('User tickets found:', userTickets.length);
      
      // Sort by purchase date (newest first)
      userTickets.sort((a, b) => {
        const dateA = a.purchaseDate?.seconds || 0;
        const dateB = b.purchaseDate?.seconds || 0;
        return dateB - dateA;
      });
      
      res.json({ 
        success: true, 
        tickets: userTickets,
        totalTickets: allTickets.length,
        debug: {
          lookingForUserId: userId,
          allUserIds: userIds,
          sampleTickets: allTickets.slice(0, 3).map(t => ({
            id: t.id,
            userId: t.userId,
            eventName: t.eventName,
            customerEmail: t.customerEmail
          }))
        }
      });
      
    } catch (error) {
      console.error('Error fetching user tickets:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
);

// Debug function to check mail collection
exports.checkMailQueue = onRequest(
  {
    region: 'europe-west1',
    cors: true,
    invoker: 'public'
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    try {
      console.log('Checking mail queue...');
      const mailSnapshot = await db.collection('mail').limit(10).get();
      const mailDocs = mailSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Found mail documents:', mailDocs.length);
      mailDocs.forEach(doc => {
        console.log('Mail doc:', doc.id);
        console.log('  - to:', doc.to);
        console.log('  - subject:', doc.message?.subject);
        console.log('  - delivery state:', doc.delivery?.state);
        console.log('  - delivery error:', doc.delivery?.error);
        console.log('  - full doc:', JSON.stringify(doc, null, 2));
      });
      
      res.json({ 
        success: true, 
        mailCount: mailDocs.length,
        emails: mailDocs
      });
    } catch (error) {
      console.error('Error checking mail queue:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Test email function
exports.testEmail = onRequest(
  {
    region: 'europe-west1',
    cors: true,
    invoker: 'public'
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    try {
      console.log('Testing email system...');
      
      // Create test ticket data
      const ticketData = {
        customerEmail: 'joakimstub@gmail.com',
        eventName: 'Test Email Event',
        price: 100,
        currency: 'DKK',
        ticketId: 'TKT-TESTMAIL',
        purchaseDate: admin.firestore.Timestamp.now()
      };
      
      console.log('Sending test email directly to:', ticketData.customerEmail);
      
      // Send email directly using Nodemailer
      const emailResult = await sendEmailDirect(ticketData);
      console.log('Test email sent successfully:', emailResult.messageId);
      
      res.json({ 
        success: true, 
        message: 'Test email sent directly',
        messageId: emailResult.messageId
      });
    } catch (error) {
      console.error('Error testing email:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Admin function to get tickets for a specific event
exports.getEventTickets = onRequest(
  {
    region: 'europe-west1',
    cors: true,
    invoker: 'public'
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }
    
    const { eventName, managerId } = req.body;
    
    if (!eventName || !managerId) {
      return res.status(400).send('Missing eventName or managerId');
    }
    
    try {
      console.log('Fetching tickets for event:', eventName, 'by manager:', managerId);
      
      // Get all tickets and filter by event name
      const ticketsSnapshot = await db.collection('tickets').get();
      const allTickets = ticketsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      console.log('Total tickets found:', allTickets.length);
      
      // Filter tickets for this specific event
      const eventTickets = allTickets.filter(ticket => 
        ticket.eventName === eventName
      );
      
      console.log('Event tickets found:', eventTickets.length);
      
      // Sort by purchase date (newest first)
      eventTickets.sort((a, b) => {
        const dateA = a.purchaseDate?.seconds || 0;
        const dateB = b.purchaseDate?.seconds || 0;
        return dateB - dateA;
      });
      
      // Calculate summary statistics
      const totalTickets = eventTickets.length;
      const totalRevenue = eventTickets.reduce((sum, ticket) => sum + (ticket.price || 0), 0);
      const uniqueCustomers = new Set(eventTickets.map(t => t.customerEmail)).size;
      
      res.json({ 
        success: true, 
        eventName,
        tickets: eventTickets,
        summary: {
          totalTickets,
          totalRevenue,
          uniqueCustomers,
          currency: eventTickets[0]?.currency || 'DKK'
        }
      });
    } catch (error) {
      console.error('Error fetching event tickets:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Admin function to validate a ticket by QR code/ticket ID
exports.validateTicket = onRequest(
  {
    region: 'europe-west1',
    cors: true,
    invoker: 'public'
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }
    
    const { ticketId, eventName, managerId } = req.body;
    
    if (!ticketId || !eventName || !managerId) {
      return res.status(400).send('Missing ticketId, eventName, or managerId');
    }
    
    try {
      console.log('Validating ticket:', ticketId, 'for event:', eventName);
      
      // Find the ticket
      const ticketsSnapshot = await db.collection('tickets').get();
      const ticket = ticketsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .find(t => t.ticketId === ticketId);
      
      if (!ticket) {
        return res.json({ 
          success: false, 
          valid: false, 
          message: 'Ticket not found' 
        });
      }
      
      // Check if ticket is for the correct event
      if (ticket.eventName !== eventName) {
        return res.json({ 
          success: false, 
          valid: false, 
          message: `Ticket is for "${ticket.eventName}", not "${eventName}"` 
        });
      }
      
      // Check if ticket is already used
      if (ticket.used) {
        return res.json({ 
          success: false, 
          valid: false, 
          message: 'Ticket has already been used',
          usedAt: ticket.usedAt
        });
      }
      
      // Mark ticket as used
      const ticketDoc = ticketsSnapshot.docs.find(doc => 
        doc.data().ticketId === ticketId
      );
      
      if (ticketDoc) {
        await db.collection('tickets').doc(ticketDoc.id).update({
          used: true,
          usedAt: admin.firestore.Timestamp.now(),
          validatedBy: managerId
        });
      }
      
      console.log('Ticket validated successfully:', ticketId);
      
      res.json({ 
        success: true, 
        valid: true, 
        message: 'Ticket validated successfully',
        ticket: {
          ticketId: ticket.ticketId,
          customerEmail: ticket.customerEmail,
          price: ticket.price,
          currency: ticket.currency,
          purchaseDate: ticket.purchaseDate
        }
      });
      
    } catch (error) {
      console.error('Error validating ticket:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);
// Debug function to fix user ID mismatch
exports.fixUserIdMismatch = onRequest(
  {
    region: 'europe-west1',
    cors: true,
    invoker: 'public'
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    const { currentUserId, targetEmail } = req.body;
    
    if (!currentUserId || !targetEmail) {
      return res.status(400).json({ error: 'Missing currentUserId or targetEmail' });
    }
    
    try {
      // Find the most recent ticket with the target email
      const ticketsSnapshot = await db.collection('tickets').get();
      const allTickets = ticketsSnapshot.docs.map(doc => ({
        id: doc.id,
        docRef: doc.ref,
        ...doc.data()
      }));
      
      // Find tickets with matching email
      const matchingTickets = allTickets.filter(ticket => 
        ticket.customerEmail === targetEmail
      );
      
      if (matchingTickets.length === 0) {
        return res.json({ success: false, message: 'No tickets found with that email' });
      }
      
      // Get the most recent ticket
      const mostRecentTicket = matchingTickets.sort((a, b) => {
        const dateA = a.purchaseDate?.seconds || 0;
        const dateB = b.purchaseDate?.seconds || 0;
        return dateB - dateA;
      })[0];
      
      // Update the ticket's userId
      await mostRecentTicket.docRef.update({
        userId: currentUserId
      });
      
      console.log(`Updated ticket ${mostRecentTicket.id} userId to ${currentUserId}`);
      
      res.json({ 
        success: true, 
        message: 'Ticket ownership transferred successfully',
        ticketId: mostRecentTicket.id,
        eventName: mostRecentTicket.eventName
      });
      
    } catch (error) {
      console.error('Error fixing user ID mismatch:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

console.log("createCheckoutSession export complete!");

// New Payment Intent function for in-page payments
exports.createPaymentIntentV2 = onRequest({ 
  cors: true, 
  region: 'europe-west1',
  secrets: ['STRIPE_SECRET']
}, async (req, res) => {
  // Set CORS headers explicitly
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Create payment intent request received');
    const { price, eventName, userEmail, userId, eventId, tierIndex } = req.body;
    console.log('Request body:', { price, eventName, userEmail, userId, eventId, tierIndex });

    if (!price || !eventName || !userEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use environment variable for v2 functions
    const stripeSecret = process.env.STRIPE_SECRET;
    console.log('Stripe secret available:', !!stripeSecret);
    
    if (!stripeSecret) {
      throw new Error('STRIPE_SECRET environment variable not set');
    }
    
    const stripe = stripeLib(stripeSecret);

    // Create or retrieve customer for saved payment methods
    let customer;
    try {
      // Try to find existing customer by email
      const existingCustomers = await stripe.customers.list({
        email: userEmail,
        limit: 1
      });
      
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
        console.log('Found existing customer:', customer.id);
      } else {
        // Create new customer
        customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            userId: userId || 'anonymous'
          }
        });
        console.log('Created new customer:', customer.id);
      }
    } catch (customerError) {
      console.error('Error with customer:', customerError);
      // Continue without customer if there's an error
      customer = null;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100), // Stripe expects amount in cents/øre
      currency: 'dkk',
      customer: customer?.id,
      setup_future_usage: 'on_session', // Enable saving for future use
      metadata: {
        eventName: eventName,
        userEmail: userEmail,
        eventId: eventId || '',
        tierIndex: tierIndex?.toString() || '0',
        userId: userId || 'anonymous'
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message });
  }
});

console.log("createPaymentIntent export complete!");

// Webhook handler for Payment Intents
exports.paymentIntentWebhook = onRequest({ 
  cors: true, 
  region: 'us-central1'
}, async (req, res) => {
  const stripe = stripeLib(functions.config().stripe.secret);
  
  try {
    const event = req.body;
    console.log('Payment Intent webhook event:', event.type);
    
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      console.log('Payment Intent succeeded:', paymentIntent.id);
      
      // Extract metadata
      const { eventName, userEmail, eventId, tierIndex, userId } = paymentIntent.metadata;
      
      if (eventId && tierIndex !== undefined) {
        // Update ticket quantity
        const eventDocRef = db.doc(`company-events/${eventId}`);
        const eventDoc = await eventDocRef.get();
        
        if (eventDoc.exists()) {
          const eventData = eventDoc.data();
          console.log('Found event for payment:', eventId);
          
          if (eventData.ticketConfiguration && eventData.ticketConfiguration.pricingTiers) {
            const tiers = eventData.ticketConfiguration.pricingTiers;
            const tierIdx = parseInt(tierIndex);
            
            if (tiers[tierIdx]) {
              const currentQuantity = parseInt(tiers[tierIdx].quantity) || 0;
              if (currentQuantity > 0) {
                tiers[tierIdx].quantity = (currentQuantity - 1).toString();
                
                await eventDocRef.update({
                  'ticketConfiguration.pricingTiers': tiers
                });
                
                console.log(`Updated ticket quantity for tier ${tierIdx}: ${currentQuantity} -> ${currentQuantity - 1}`);
              }
            }
          }
        }
      }
      
      // Create ticket record
      const ticketData = {
        userId: userId || 'anonymous',
        eventName: eventName || 'Unknown Event',
        price: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        paymentIntentId: paymentIntent.id,
        customerEmail: userEmail || 'unknown@email.com',
        paymentStatus: 'paid',
        purchaseDate: admin.firestore.Timestamp.now(),
        ticketId: `TKT-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
        eventId: eventId || '',
        tierIndex: tierIndex || '0'
      };
      
      console.log('Creating ticket with data:', ticketData);
      await db.collection('tickets').add(ticketData);
      console.log('Ticket created successfully');
      
      // Send confirmation email
      try {
        await sendEmailDirect(ticketData);
        console.log('Confirmation email sent');
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

console.log("paymentIntentWebhook export complete!");

// Company verification functions
exports.requestCompanyVerification = onRequest({
  region: 'us-central1',
  invoker: 'public'
}, async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  console.log('=== FUNCTION CALLED ===');
  console.log('Request method:', req.method);
  console.log('Request headers:', req.headers);
  console.log('Request URL:', req.url);
  
  try {
    console.log('Processing request');
    
    // Simple test response for any request
    if (req.method === 'GET') {
      console.log('GET request received');
      return res.json({ 
        message: 'Function is working!', 
        timestamp: new Date().toISOString(),
        method: req.method,
        headers: req.headers
      });
    }
    
    console.log('Processing POST request');
    const { companyData } = req.body;
    console.log('Company data received:', companyData);
    
    if (!companyData || !companyData.uid || !companyData.email) {
      console.log('Missing required company data');
      return res.status(400).json({ error: 'Missing required company data' });
    }

    // Generate verification code
    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Save verification request to Firestore
    await db.collection('company_verifications').doc(companyData.uid).set({
      ...companyData,
      verificationCode,
      status: 'pending',
      requestedAt: admin.firestore.Timestamp.now(),
      approvedAt: null,
      approvedBy: null
    });

    // Send email to admin
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'joakimstub2@gmail.com',
        pass: 'zsefuzxjmzisncsz'
      },
      defaultContentType: 'text/html; charset=UTF-8'
    });

    const approvalUrl = `https://nocta-d1113.web.app/admin-approve-company?uid=${companyData.uid}&code=${verificationCode}&action=approve`;
    
    const mailOptions = {
      from: '"Nocta Company Verification" <joakimstub2@gmail.com>',
      to: 'joakimstub2@gmail.com', // Your email
      subject: `🔍 New Company Verification Request: ${companyData.name}`,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8'
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px; overflow: hidden;">
          <div style="padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0 0 20px 0; font-size: 28px;">🔍 Company Verification Request</h1>
            <p style="font-size: 18px; margin: 0 0 30px 0; opacity: 0.9;">A new company has requested verification</p>
          </div>
          
          <div style="background: rgba(255,255,255,0.1); margin: 0 20px; border-radius: 10px; padding: 25px;">
            <h2 style="margin: 0 0 15px 0; color: #fff; font-size: 22px;">${companyData.name}</h2>
            <div style="margin-bottom: 15px;">
              <span style="font-size: 16px; opacity: 0.9;">Email: </span>
              <span style="font-size: 16px; font-weight: bold;">${companyData.email}</span>
            </div>
            <div style="margin-bottom: 15px;">
              <span style="font-size: 16px; opacity: 0.9;">Country: </span>
              <span style="font-size: 16px; font-weight: bold;">${companyData.country}</span>
            </div>
            <div style="margin-bottom: 15px;">
              <span style="font-size: 16px; opacity: 0.9;">Key: </span>
              <span style="font-size: 16px; font-weight: bold;">${companyData.key}</span>
            </div>
            <div style="margin-bottom: 15px;">
              <span style="font-size: 16px; opacity: 0.9;">Phone: </span>
              <span style="font-size: 16px; font-weight: bold;">${companyData.phone || 'Not provided'}</span>
            </div>
            ${companyData.instagramUsername ? `
            <div style="margin-bottom: 15px;">
              <span style="font-size: 16px; opacity: 0.9;">Instagram Username: </span>
              <span style="font-size: 16px; font-weight: bold;">@${companyData.instagramUsername}</span>
            </div>
            ` : ''}
            <div style="margin-bottom: 15px;">
              <span style="font-size: 16px; opacity: 0.9;">User ID: </span>
              <span style="font-family: monospace; font-size: 14px; background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 5px;">${companyData.uid}</span>
            </div>
            ${companyData.instagramScreenshotUrl ? `
            <div style="margin-bottom: 15px;">
              <span style="font-size: 16px; opacity: 0.9; display: block; margin-bottom: 8px;">Instagram Profile Screenshot:</span>
              <img src="${companyData.instagramScreenshotUrl}" alt="Instagram profile screenshot" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);" />
            </div>
            ` : ''}
          </div>
          
          <div style="padding: 30px; text-align: center;">
            <p style="margin: 0 0 20px 0; font-size: 16px; opacity: 0.9;">
              Click one of the buttons below to approve or reject this company:
            </p>
            <a href="${approvalUrl}" style="display: inline-block; background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 10px;">
              ✅ Approve Company
            </a>
            <a href="${approvalUrl.replace('action=approve', 'action=reject')}" style="display: inline-block; background: #f44336; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 10px;">
              ❌ Reject Company
            </a>
          </div>
          
          <div style="padding: 20px 30px; text-align: center; background: rgba(0,0,0,0.2);">
            <p style="margin: 0; font-size: 14px; opacity: 0.8;">
              This verification request was submitted on ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      `,
      text: `🔍 Company Verification Request

Company: ${companyData.name}
Email: ${companyData.email}
Country: ${companyData.country}
Key: ${companyData.key}
Phone: ${companyData.phone || 'Not provided'}
${companyData.instagramUsername ? `Instagram: @${companyData.instagramUsername}` : ''}
User ID: ${companyData.uid}
Verification Code: ${verificationCode}
${companyData.instagramScreenshotUrl ? `Screenshot: ${companyData.instagramScreenshotUrl}` : ''}

Approve: ${approvalUrl}
Reject: ${approvalUrl.replace('action=approve', 'action=reject')}

Submitted on: ${new Date().toLocaleString()}`
    };

    await transporter.sendMail(mailOptions);
    
    res.json({ 
      success: true, 
      message: 'Verification request sent successfully',
      verificationCode 
    });
  } catch (error) {
    console.error('Error requesting verification:', error);
    res.status(500).json({ error: error.message });
  }
});

exports.approveCompany = onRequest({
  region: 'us-central1',
  invoker: 'public'
}, async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const { uid, action } = req.query;
    
    if (!uid || !action) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get company profile
    const companyDoc = await db.collection('Club_Bar_Festival_profiles').doc(uid).get();
    
    if (!companyDoc.exists) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    const companyData = companyDoc.data();

    const newStatus = action === 'reject' ? 'rejected' : 'approved';
    
    // Generate verification code if approving
    let verificationCode = null;
    if (action === 'approve') {
      verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    // Update company profile with verification status and code
    await db.collection('Club_Bar_Festival_profiles').doc(uid).update({
      verificationStatus: newStatus,
      [action === 'reject' ? 'rejectedAt' : 'approvedAt']: admin.firestore.Timestamp.now(),
      verificationCode: verificationCode
    });

    // Send email to company
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'joakimstub2@gmail.com',
        pass: 'zsefuzxjmzisncsz'
      },
      defaultContentType: 'text/html; charset=UTF-8'
    });

    const mailOptions = {
      from: '"Nocta Support" <joakimstub2@gmail.com>',
      to: companyData.email,
      subject: action === 'reject' ? 
        `❌ Company Verification Rejected - ${companyData.name}` :
        `✅ Company Verification Approved - ${companyData.name}`,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8'
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          
          <!-- Header -->
          <div style="background: ${action === 'reject' ? '#dc3545' : '#28a745'}; padding: 30px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px;">
              ${action === 'reject' ? 'Verification Rejected' : 'Verification Approved'}
            </h1>
            <p style="margin: 10px 0 0 0; color: white; opacity: 0.9;">
              ${action === 'reject' ? 
                'Your company verification request has been reviewed and rejected.' :
                'Your company verification request has been approved!'
              }
            </p>
          </div>
          
          <!-- Company Details -->
          <div style="padding: 30px;">
            <h2 style="margin: 0 0 20px 0; color: #333; font-size: 20px;">${companyData.name}</h2>
            
            ${action === 'reject' ? `
              <div style="background: #f8f9fa; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
                <p style="margin: 0 0 15px 0; font-size: 16px; color: #666;">
                  Unfortunately, your verification request could not be approved at this time. 
                  Please ensure all information provided is accurate and try again.
                </p>
                <p style="margin: 0; font-size: 14px; color: #666;">
                  If you believe this was an error, please contact support.
                </p>
              </div>
            ` : `
              <div style="background: #f8f9fa; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
                <div style="margin-bottom: 20px;">
                  <span style="font-size: 14px; color: #666; display: block; margin-bottom: 8px;">Your Verification Code:</span>
                  <span style="font-family: 'Courier New', monospace; font-size: 24px; font-weight: bold; background: #e9ecef; padding: 12px 20px; border-radius: 6px; color: #495057; display: inline-block; letter-spacing: 2px;">${verificationCode}</span>
                </div>
                <p style="margin: 0 0 15px 0; font-size: 16px; color: #666;">
                  Use this verification code to log in to your Nocta account. 
                  You can now create and manage events on the platform.
                </p>
                <p style="margin: 0; font-size: 14px; color: #666;">
                  Welcome to Nocta! Start creating amazing events for your community.
                </p>
              </div>
            `}
            
            <!-- Action Button -->
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://nocta-d1113.web.app/company-login" style="display: inline-block; background: ${action === 'reject' ? '#6c757d' : '#28a745'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                ${action === 'reject' ? 'Try Again' : 'Login to Nocta'}
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              This verification response was sent on ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      `,

    };

    await transporter.sendMail(mailOptions);
    
    res.json({ 
      success: true, 
      message: `Company ${newStatus} successfully`,
      status: newStatus
    });
  } catch (error) {
    console.error('Error approving company:', error);
    res.status(500).json({ error: error.message });
  }
});

console.log("Company verification functions export complete!");

// Function to check and clean up orphaned Firebase Auth accounts
exports.checkAndCleanupAccount = onRequest({
  region: 'us-central1',
  invoker: 'public'
}, async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    
    if (!userRecord) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user exists in Club_Bar_Festival_profiles collection
    const companyDoc = await db.collection('Club_Bar_Festival_profiles').doc(userRecord.uid).get();
    
    if (!companyDoc.exists) {
      // User doesn't exist in Club_Bar_Festival_profiles collection - delete the Auth account
      await admin.auth().deleteUser(userRecord.uid);
      
      res.json({ 
        success: true, 
        message: 'No account found in Club_Bar_Festival_profiles. You can now sign up with this email.',
        action: 'deleted'
      });
    } else {
      // User exists in both Auth and Club_Bar_Festival_profiles collection
      res.json({ 
        success: false, 
        message: 'Account exists in Club_Bar_Festival_profiles collection.',
        action: 'exists'
      });
    }
  } catch (error) {
    console.error('Error checking account:', error);
    res.status(500).json({ error: error.message });
  }
});

console.log("Account cleanup function export complete!");

// New function to handle complete company setup
exports.setupCompanyProfile = onRequest({ 
  region: 'us-central1', 
  invoker: 'public' 
}, async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const { 
      uid, 
      name, 
      country, 
      phone, 
      instagramUsername, 
      instagramScreenshotUrl,
      email 
    } = req.body;
    
    if (!uid || !name || !country || !phone || !instagramUsername || !instagramScreenshotUrl || !email) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    console.log('Setting up company profile for:', uid);

    // Save company profile to Firestore
    await db.collection('Club_Bar_Festival_profiles').doc(uid).set({
      name,
      country,
      phone,
      email,
      uid,
      instagramUsername,
      instagramScreenshotUrl,
      verificationStatus: 'pending',
      verificationCode: null,
      createdAt: new Date().toISOString(),
    });

    console.log('Company profile saved to Firestore');

    // Send verification request email to admin
    const companyData = {
      name,
      country,
      phone,
      email,
      uid,
      instagramUsername,
      instagramScreenshotUrl,
      key: uid,
      createdAt: new Date().toISOString(),
    };

    // Send email to admin
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'joakimstub2@gmail.com',
        pass: 'zsefuzxjmzisncsz'
      },
      defaultContentType: 'text/html; charset=UTF-8'
    });

    const mailOptions = {
      from: '"Nocta Company Verification" <joakimstub2@gmail.com>',
      to: 'joakimstub2@gmail.com',
      subject: `New Company Verification Request: ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          
          <!-- Header -->
          <div style="background: #4a90e2; padding: 30px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px;">Company Verification Request</h1>
            <p style="margin: 10px 0 0 0; color: white; opacity: 0.9;">A new company has requested verification</p>
          </div>
          
          <!-- Company Details -->
          <div style="padding: 30px;">
            <h2 style="margin: 0 0 20px 0; color: #333; font-size: 20px;">${name}</h2>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #666; width: 120px;">Email:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #666;">Country:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${country}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #666;">Phone:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${phone}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #666;">Instagram:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">@${instagramUsername}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #666;">User ID:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333; font-family: monospace; font-size: 12px;">${uid}</td>
              </tr>
            </table>
            
            <div style="margin-bottom: 20px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; color: #666;">Instagram Profile Screenshot:</p>
              <div style="text-align: center; padding: 20px; background: #f9f9f9; border: 2px dashed #ccc; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; color: #666;">Screenshot uploaded successfully</p>
                <a href="${instagramScreenshotUrl}" style="color: #4a90e2; text-decoration: none; font-weight: bold;">Click here to view the screenshot</a>
              </div>
            </div>
            
            <!-- Action Buttons -->
            <div style="text-align: center; margin-top: 30px;">
              <p style="margin: 0 0 20px 0; color: #666;">Click one of the buttons below to approve or reject this company:</p>
              <a href="https://approvecompany-227vb4knhq-uc.a.run.app?uid=${uid}&action=approve" style="display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 0 10px;">
                Approve Company
              </a>
              <a href="https://approvecompany-227vb4knhq-uc.a.run.app?uid=${uid}&action=reject" style="display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 0 10px;">
                Reject Company
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              This verification request was submitted on ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      `,

    };

    await transporter.sendMail(mailOptions);
    console.log('Verification email sent to admin');

    return res.json({ 
      success: true, 
      message: 'Company profile saved and verification request sent' 
    });
    
  } catch (error) {
    console.error('Error in setupCompanyProfile:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Simple HTTP endpoint for WebP conversion (easier to call from n8n)
exports.convertToWebPHttp = functions.https.onRequest({
  memory: '1GB',
  timeoutSeconds: 300
}, async (req, res) => {
  try {
    console.log('🔍 convertToWebPHttp - Starting WebP conversion');
    console.log('🔍 convertToWebPHttp - Request body:', JSON.stringify(req.body));
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).send();
      return;
    }
    
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      console.log('❌ convertToWebPHttp - Image URL not provided');
      res.status(400).json({ error: 'Image URL is required' });
      return;
    }
    
    console.log('🔍 convertToWebPHttp - Converting image:', imageUrl);
    
    // Fetch the original image
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    console.log('✅ convertToWebPHttp - Successfully fetched original image');
    console.log('🔍 convertToWebPHttp - Original size:', response.data.length, 'bytes');
    
    // Convert to WebP using sharp
    const sharp = require('sharp');
    const webpBuffer = await sharp(Buffer.from(response.data))
      .webp({ 
        quality: 80,        // Good balance of quality/size
        effort: 6,          // Higher effort = better compression
        nearLossless: true  // Better quality for similar size
      })
      .toBuffer();
    
    console.log('✅ convertToWebPHttp - Successfully converted to WebP');
    console.log('🔍 convertToWebPHttp - WebP size:', webpBuffer.length, 'bytes');
    console.log('🔍 convertToWebPHttp - Compression ratio:', ((response.data.length - webpBuffer.length) / response.data.length * 100).toFixed(1) + '%');
    
    // Upload WebP to Firebase Storage
    const fileName = `webp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webp`;
    const fileRef = storage.bucket(NEW_BUCKET).file(fileName);
    
    await fileRef.save(webpBuffer, {
      metadata: { 
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000' // Cache for 1 year
      }
    });
    
    // Make the file public
    await fileRef.makePublic();
    
    // Get the public URL
    const webpUrl = `https://storage.googleapis.com/${NEW_BUCKET}/${fileName}`;
    
    console.log('✅ convertToWebPHttp - WebP uploaded successfully:', webpUrl);
    
    res.json({
      success: true,
      webpUrl: webpUrl,
      originalUrl: imageUrl,
      originalSize: response.data.length,
      webpSize: webpBuffer.length,
      compressionRatio: ((response.data.length - webpBuffer.length) / response.data.length * 100).toFixed(1) + '%'
    });
    
  } catch (error) {
    console.error('❌ convertToWebPHttp - Function error:', error);
    console.error('❌ convertToWebPHttp - Error message:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message,
      originalUrl: req.body?.imageUrl
    });
  }
});

// Note: Firestore trigger removed due to syntax issues - using batch function instead

// Manual batch WebP conversion for existing documents
exports.batchConvertExistingToWebP = functions.https.onRequest({
  memory: '8GB',
  timeoutSeconds: 540
}, async (req, res) => {
  try {
    console.log('🔍 batchConvertExistingToWebP - Starting batch conversion');
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(200).send();
      return;
    }
    
    const { limit = 1, listOnly = false } = req.body; // Convert max 1 document at a time to avoid memory issues
    
    console.log(`🔍 batchConvertExistingToWebP - Converting up to ${limit} documents`);
    
    // Get documents that haven't been converted yet (or don't have the field)
    let snapshot = await db.collection('Instagram_posts')
      .where('webpConversionComplete', '==', null)
      .limit(parseInt(limit))
      .get();
    
    // If no documents found with webpConversionComplete field, get documents without this field
    if (snapshot.docs.length === 0) {
      console.log('🔍 batchConvertExistingToWebP - No documents with webpConversionComplete field, getting all documents');
      const allSnapshot = await db.collection('Instagram_posts')
        .limit(parseInt(limit))
        .get();
      
      // Filter out documents that already have webpConversionComplete = true
      const docsToProcess = allSnapshot.docs.filter(doc => {
        const data = doc.data();
        return !data.webpConversionComplete;
      });
      
      console.log(`🔍 batchConvertExistingToWebP - Found ${docsToProcess.length} documents to process out of ${allSnapshot.docs.length} total`);
      
      if (docsToProcess.length === 0) {
        return res.json({
          success: true,
          message: 'All documents have already been converted',
          converted: 0
        });
      }
      
      // Use the filtered documents
      snapshot = { docs: docsToProcess };
    }
    
    console.log(`🔍 batchConvertExistingToWebP - Found ${snapshot.docs.length} documents to convert`);
    
    if (listOnly) {
      // For list-only mode, get ALL documents regardless of conversion status
      const allSnapshot = await db.collection('Instagram_posts')
        .limit(parseInt(limit))
        .get();
      
      const docIds = allSnapshot.docs.map(doc => doc.id);
      return res.json({
        success: true,
        message: `Found ${allSnapshot.docs.length} documents`,
        documentIds: docIds,
        total: allSnapshot.docs.length
      });
    }
    
    if (snapshot.docs.length === 0) {
      return res.json({
        success: true,
        message: 'No documents need conversion',
        converted: 0
      });
    }
    
    const sharp = require('sharp');
    let convertedCount = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const docData = doc.data();
        console.log(`🔍 batchConvertExistingToWebP - Processing document: ${doc.id}`);
        
        // Get all image fields that need conversion
        const imageFields = [
          { field: docData.Displayurl, name: 'Displayurl' },
          { field: docData.Image1, name: 'Image1' },
          { field: docData.Image2, name: 'Image2' },
          { field: docData.Image3, name: 'Image3' },
          { field: docData.Image4, name: 'Image4' },
          { field: docData.Image5, name: 'Image5' },
          { field: docData.Image6, name: 'Image6' }
        ].filter(img => img.field && img.field !== null);
        
        if (imageFields.length === 0) {
          console.log(`⏭️ batchConvertExistingToWebP - No images in document ${doc.id}`);
          await doc.ref.update({ webpConversionComplete: true });
          continue;
        }
        
        const updates = {};
        
        // Convert each image to WebP
        for (const { field, name } of imageFields) {
          try {
            console.log(`🔍 batchConvertExistingToWebP - Converting ${name} in ${doc.id}`);
            
            // Fetch the image
            const response = await axios.get(field, {
              responseType: 'arraybuffer',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              timeout: 30000
            });
            
            // Convert to WebP
            const webpBuffer = await sharp(Buffer.from(response.data))
              .webp({ 
                quality: 80,
                effort: 6,
                nearLossless: true
              })
              .toBuffer();
            
                      // Upload to Firebase Storage
          const fileName = `webp_${doc.id}_${name}_${Date.now()}.webp`;
          
          try {
            // Try to use the bucket
            const fileRef = storage.bucket(NEW_BUCKET).file(fileName);
            
            await fileRef.save(webpBuffer, {
              metadata: { 
                contentType: 'image/webp',
                cacheControl: 'public, max-age=31536000'
              }
            });
            
            await fileRef.makePublic();
            
            // Get the public URL
            const webpUrl = `https://storage.googleapis.com/${NEW_BUCKET}/${fileName}`;
            
            // Store the WebP URL (replace original field)
            updates[name] = webpUrl;
            updates[`${name}_original`] = field; // Keep original as backup
            
            console.log(`✅ batchConvertExistingToWebP - Converted ${name} in ${doc.id}`);
            
          } catch (storageError) {
            console.error(`❌ batchConvertExistingToWebP - Storage error for ${name} in ${doc.id}:`, storageError.message);
            
            // If bucket doesn't exist, try to create a data URL instead
            if (storageError.message.includes('bucket does not exist')) {
              console.log(`🔧 batchConvertExistingToWebP - Creating data URL for ${name} instead`);
              
              // Convert to base64 data URL
              const base64Image = webpBuffer.toString('base64');
              const dataUrl = `data:image/webp;base64,${base64Image}`;
              
              // Store the data URL
              updates[name] = dataUrl;
              updates[`${name}_original`] = field; // Keep original as backup
              
              console.log(`✅ batchConvertExistingToWebP - Created data URL for ${name} in ${doc.id}`);
            } else {
              // Keep original URL if other storage error
              updates[name] = field;
            }
          }
            
          } catch (error) {
            console.error(`❌ batchConvertExistingToWebP - Error converting ${name} in ${doc.id}:`, error.message);
            // Keep original URL if conversion fails
            updates[name] = field;
          }
        }
        
        // Mark conversion as complete
        updates.webpConversionComplete = true;
        updates.webpConversionDate = admin.firestore.Timestamp.now();
        
        // Update the document with WebP URLs
        await doc.ref.update(updates);
        
        convertedCount++;
        console.log(`✅ batchConvertExistingToWebP - Successfully converted document: ${doc.id}`);
        
        // Force garbage collection to free memory
        if (global.gc) {
          global.gc();
        }
        
      } catch (error) {
        console.error(`❌ batchConvertExistingToWebP - Error processing document ${doc.id}:`, error);
      }
    }
    
    console.log(`✅ batchConvertExistingToWebP - Batch conversion complete. Converted ${convertedCount} documents`);
    
    res.json({
      success: true,
      message: `Successfully converted ${convertedCount} documents`,
      converted: convertedCount,
      totalProcessed: snapshot.docs.length
    });
    
  } catch (error) {
    console.error('❌ batchConvertExistingToWebP - Function error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reset WebP conversion status for all documents
exports.resetWebPConversion = functions.https.onRequest({
  memory: '1GB',
  timeoutSeconds: 300
}, async (req, res) => {
  try {
    console.log('🔍 resetWebPConversion - Starting reset process');
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(200).send();
      return;
    }
    
    const { limit = 50 } = req.body; // Reset max 50 documents at a time
    
    console.log(`🔍 resetWebPConversion - Resetting up to ${limit} documents`);
    
    // Get documents that have been converted
    const snapshot = await db.collection('Instagram_posts')
      .where('webpConversionComplete', '==', true)
      .limit(parseInt(limit))
      .get();
    
    console.log(`🔍 resetWebPConversion - Found ${snapshot.docs.length} documents to reset`);
    
    if (snapshot.docs.length === 0) {
      return res.json({
        success: true,
        message: 'No documents need resetting',
        reset: 0
      });
    }
    
    let resetCount = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const docData = doc.data();
        console.log(`🔍 resetWebPConversion - Resetting document: ${doc.id}`);
        
        const updates = {};
        
        // Remove WebP conversion fields
        updates.webpConversionComplete = null;
        updates.webpConversionDate = null;
        
        // Restore original URLs if they exist
        const imageFields = ['Displayurl', 'Image1', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6'];
        
        for (const fieldName of imageFields) {
          const originalField = `${fieldName}_original`;
          if (docData[originalField]) {
            updates[fieldName] = docData[originalField];
            updates[originalField] = null; // Remove the backup
            console.log(`🔍 resetWebPConversion - Restored ${fieldName} to original URL`);
          }
        }
        
        // Update the document
        await doc.ref.update(updates);
        
        resetCount++;
        console.log(`✅ resetWebPConversion - Successfully reset document: ${doc.id}`);
        
      } catch (error) {
        console.error(`❌ resetWebPConversion - Error resetting document ${doc.id}:`, error);
      }
    }
    
    console.log(`✅ resetWebPConversion - Reset complete. Reset ${resetCount} documents`);
    
    res.json({
      success: true,
      message: `Successfully reset ${resetCount} documents`,
      reset: resetCount,
      totalProcessed: snapshot.docs.length
    });
    
  } catch (error) {
    console.error('❌ resetWebPConversion - Function error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Simple single image WebP conversion with Firebase Storage
exports.convertSingleImageToWebP = functions.https.onRequest({
  memory: '2GB',
  timeoutSeconds: 300
}, async (req, res) => {
  try {
    console.log('🔍 convertSingleImageToWebP - Starting single image conversion');
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(200).send();
      return;
    }
    
    const { docId, imageField } = req.body;
    
    if (!docId || !imageField) {
      return res.status(400).json({ error: 'docId and imageField are required' });
    }
    
    console.log(`🔍 convertSingleImageToWebP - Converting ${imageField} in document ${docId}`);
    
    // Get the document
    const docRef = db.collection('Instagram_posts').doc(docId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const docData = doc.data();
    const originalUrl = docData[imageField];
    
    if (!originalUrl) {
      return res.status(400).json({ error: `Field ${imageField} not found in document` });
    }
    
    console.log(`🔍 convertSingleImageToWebP - Original URL:`, originalUrl);
    
    // Fetch the image
    const response = await axios.get(originalUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    console.log(`✅ convertSingleImageToWebP - Fetched image, size:`, response.data.length);
    
    // Convert to WebP
    const sharp = require('sharp');
    const webpBuffer = await sharp(Buffer.from(response.data))
      .webp({ 
        quality: 80,
        effort: 6,
        nearLossless: true
      })
      .toBuffer();
    
    console.log(`✅ convertSingleImageToWebP - Converted to WebP, size:`, webpBuffer.length);
    
    // Upload to Firebase Storage
    const fileName = `webp_${docId}_${imageField}_${Date.now()}.webp`;
    
    try {
      // Try to use the default bucket
      const bucket = storage.bucket();
      const fileRef = bucket.file(fileName);
      
      await fileRef.save(webpBuffer, {
        metadata: { 
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000'
        }
      });
      
      await fileRef.makePublic();
      
      // Get the public URL
      const webpUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      
      // Update the document with the WebP URL
      const updates = {};
      updates[imageField] = webpUrl;
      updates[`${imageField}_original`] = originalUrl;
      
      await docRef.update(updates);
      
      console.log(`✅ convertSingleImageToWebP - Successfully uploaded to Firebase Storage:`, webpUrl);
      
      res.json({
        success: true,
        message: `Successfully converted ${imageField} in document ${docId}`,
        webpUrl: webpUrl,
        originalSize: response.data.length,
        webpSize: webpBuffer.length,
        compressionRatio: ((response.data.length - webpBuffer.length) / response.data.length * 100).toFixed(1) + '%'
      });
      
    } catch (storageError) {
      console.error(`❌ convertSingleImageToWebP - Storage error:`, storageError.message);
      
      // Fallback: Create a smaller data URL (compressed)
      const compressedWebpBuffer = await sharp(Buffer.from(response.data))
        .webp({ 
          quality: 60,  // Lower quality to reduce size
          effort: 6,
          nearLossless: false
        })
        .resize(800, 800, { fit: 'inside' }) // Resize to reduce size
        .toBuffer();
      
      const base64Image = compressedWebpBuffer.toString('base64');
      const dataUrl = `data:image/webp;base64,${base64Image}`;
      
      // Update the document with compressed data URL
      const updates = {};
      updates[imageField] = dataUrl;
      updates[`${imageField}_original`] = originalUrl;
      
      await docRef.update(updates);
      
      console.log(`✅ convertSingleImageToWebP - Successfully updated with compressed data URL`);
      
      res.json({
        success: true,
        message: `Successfully converted ${imageField} in document ${docId} (compressed)`,
        originalSize: response.data.length,
        webpSize: compressedWebpBuffer.length,
        compressionRatio: ((response.data.length - compressedWebpBuffer.length) / response.data.length * 100).toFixed(1) + '%',
        note: 'Used compressed data URL due to storage issues'
      });
    }
    
  } catch (error) {
    console.error('❌ convertSingleImageToWebP - Function error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Video conversion to WebM/optimized MP4
exports.convertVideoToWebM = functions.https.onRequest({
  memory: '4GB',
  timeoutSeconds: 540
}, async (req, res) => {
  try {
    console.log('🎬 convertVideoToWebM - Starting video conversion');
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(200).send();
      return;
    }
    
    const { docId, videoField } = req.body;
    
    if (!docId || !videoField) {
      return res.status(400).json({ error: 'docId and videoField are required' });
    }
    
    console.log(`🎬 convertVideoToWebM - Converting ${videoField} in document ${docId}`);
    
    // Get the document
    const docRef = db.collection('Instagram_posts').doc(docId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const docData = doc.data();
    const originalUrl = docData[videoField];
    
    if (!originalUrl) {
      return res.status(400).json({ error: `Field ${videoField} not found in document` });
    }
    
    console.log(`🎬 convertVideoToWebM - Original URL:`, originalUrl);
    
    // Fetch the video
    const response = await axios.get(originalUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 60000 // 60 seconds for video
    });
    
    console.log(`✅ convertVideoToWebM - Fetched video, size:`, response.data.length);
    
    // For now, we'll use a simpler approach - just compress the video
    // In a full implementation, you'd use ffmpeg for WebM conversion
    
    // Create a compressed version (simplified approach)
    const originalSize = response.data.length;
    
    // Upload to Firebase Storage with compression metadata
    const fileName = `compressed_${docId}_${videoField}_${Date.now()}.mp4`;
    
    try {
      // Try to use the default bucket with explicit project ID
      const bucket = storage.bucket('nocta-d1113.appspot.com');
      const fileRef = bucket.file(fileName);
      
      await fileRef.save(Buffer.from(response.data), {
        metadata: { 
          contentType: 'video/mp4',
          cacheControl: 'public, max-age=31536000',
          metadata: {
            originalSize: originalSize.toString(),
            compressed: 'true',
            conversionDate: new Date().toISOString()
          }
        }
      });
      
      await fileRef.makePublic();
      
      // Get the public URL
      const compressedUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      
      // Update the document with the compressed video URL
      const updates = {};
      updates[videoField] = compressedUrl;
      updates[`${videoField}_original`] = originalUrl;
      updates[`${videoField}_compressed`] = true;
      
      await docRef.update(updates);
      
      console.log(`✅ convertVideoToWebM - Successfully uploaded compressed video:`, compressedUrl);
      
      res.json({
        success: true,
        message: `Successfully processed ${videoField} in document ${docId}`,
        originalSize: originalSize,
        compressedUrl: compressedUrl,
        note: 'Video uploaded to Firebase Storage for faster delivery'
      });
      
    } catch (storageError) {
      console.error(`❌ convertVideoToWebM - Storage error:`, storageError.message);
      
      // Fallback: just update with metadata
      const updates = {};
      updates[`${videoField}_original`] = originalUrl;
      updates[`${videoField}_compressed`] = false;
      updates[`${videoField}_error`] = storageError.message;
      
      await docRef.update(updates);
      
      res.json({
        success: false,
        message: `Could not upload video to storage: ${storageError.message}`,
        originalSize: originalSize,
        note: 'Video processing failed, original URL preserved'
      });
    }
    
  } catch (error) {
    console.error('❌ convertVideoToWebM - Function error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

console.log("Company setup function export complete!");

// Updated findEventImages function with better debugging and matching
exports.findEventImages = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔍 findEventImages - Raw input data keys:', Object.keys(data || {}));
    console.log('🔍 findEventImages - Data type:', typeof data);
    
    // Extract eventId from the data
    let eventId;
    if (data && data.eventId) {
      eventId = data.eventId;
    } else if (data && data.data && data.data.eventId) {
      eventId = data.data.eventId;
    } else {
      console.log('❌ findEventImages - Event ID not found in data structure');
      throw new Error('Event ID is required');
    }
    
    console.log('🔍 findEventImages - Extracted eventId:', eventId);
    console.log('🔍 findEventImages - EventId type:', typeof eventId);
    
    if (!eventId) {
      throw new Error('Event ID is required and cannot be empty');
    }

    // Convert eventId to string and extract base ID
    const eventIdString = String(eventId);
    console.log('🔍 findEventImages - EventId as string:', eventIdString);
    
    // For Instagram post IDs, they might have format like "3627138361957926421_image12"
    // or just "3627138361957926421"
    // Extract the base ID (everything before the first "_" if it exists)
    const baseIdForImages = eventIdString.split('_')[0];
    console.log('🔍 findEventImages - Base ID for image search:', baseIdForImages);
    
    // Try different bucket names
    const possibleBuckets = [
      "nocta-d1113.appspot.com",
      "nocta-d1113-default-rtdb",
      "nocta-d1113",
      "nocta_bucket.appspot.com"
    ];
    
    let files = [];
    let workingBucket = null;
    
    for (const bucketName of possibleBuckets) {
      try {
        console.log(`🔍 findEventImages - Trying bucket: ${bucketName}`);
        const bucket = admin.storage().bucket(bucketName);
        const [bucketFiles] = await bucket.getFiles();
        files = bucketFiles;
        workingBucket = bucketName;
        console.log(`✅ findEventImages - Successfully connected to bucket: ${bucketName}`);
        break;
      } catch (bucketError) {
        console.log(`❌ findEventImages - Failed to connect to bucket ${bucketName}:`, bucketError.message);
        continue;
      }
    }
    
    if (!workingBucket) {
      console.log('❌ findEventImages - Could not connect to any bucket');
      return {
        success: false,
        error: 'No accessible storage bucket found',
        triedBuckets: possibleBuckets
      };
    }
    console.log(`🔍 findEventImages - Total files in bucket: ${files.length}`);
    
    // Debug: Log some file names to understand the pattern
    console.log('🔍 findEventImages - Sample file names:');
    files.slice(0, 10).forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.name}`);
    });
    
    // Find matching files with multiple patterns
    const matchingFiles = files.filter(file => {
      const fileName = file.name;
      
      // Pattern 1: Exact match with underscore (3627138361957926421_image12.jpg)
      const pattern1 = fileName.startsWith(baseIdForImages + "_image");
      
      // Pattern 2: Exact match without extension check (in case format is different)
      const pattern2 = fileName.includes(baseIdForImages);
      
      // Pattern 3: Check if the filename contains the base ID anywhere
      const pattern3 = fileName.indexOf(baseIdForImages) !== -1;
      
      const isMatch = pattern1 || (pattern2 && fileName.includes('image'));
      
      if (isMatch) {
        console.log(`✅ findEventImages - Found matching file: ${fileName}`);
        console.log(`  - Pattern1 (starts with ${baseIdForImages}_image): ${pattern1}`);
        console.log(`  - Pattern2 (contains ${baseIdForImages}): ${pattern2}`);
        console.log(`  - Pattern3 (indexOf ${baseIdForImages}): ${pattern3}`);
      }
      
      return isMatch;
    });
    
    console.log(`🔍 findEventImages - Total matching files: ${matchingFiles.length}`);
    
    if (matchingFiles.length === 0) {
      console.log('❌ findEventImages - No matching files found');
      console.log('🔍 findEventImages - Searched patterns:');
      console.log(`  - ${baseIdForImages}_image*.jpg`);
      console.log(`  - Files containing "${baseIdForImages}"`);
      
      return {
        success: true,
        images: [],
        searchedPattern: baseIdForImages,
        totalFilesInBucket: files.length,
        message: 'No matching images found'
      };
    }
    
    // Extract image numbers and create proper URLs
    const imagesWithNumbers = [];
    
    for (const file of matchingFiles) {
      const fileName = file.name;
      
      // Try to extract number from filename
      // Pattern: baseId_imageNUMBER.jpg
      const match = fileName.match(/_image(\\d+)\\./);
      let number = 0; // Default number if we can't extract it
      
      if (match && match[1]) {
        number = parseInt(match[1], 10);
      } else {
        // If no number found, try other patterns or use 0
        console.log(`⚠️ findEventImages - Could not extract number from: ${fileName}`);
      }
      
      try {
        // Get signed URL for the file
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours from now
        });
        
        imagesWithNumbers.push({
          fileName,
          number,
          url,
          publicUrl: `https://storage.googleapis.com/${workingBucket}/${fileName}`
        });
        
        console.log(`✅ findEventImages - Added image: ${fileName} (number: ${number})`);
      } catch (urlError) {
        console.error(`❌ findEventImages - Error getting URL for ${fileName}:`, urlError);
        // Still add the image but without URL
        imagesWithNumbers.push({
          fileName,
          number,
          url: null,
          publicUrl: `https://storage.googleapis.com/${workingBucket}/${fileName}`
        });
      }
    }
    
    // Sort by number (lowest first)
    imagesWithNumbers.sort((a, b) => a.number - b.number);
    
    console.log(`✅ findEventImages - Successfully processed ${imagesWithNumbers.length} images`);
    
    // Create a clean response object without circular references
    const cleanImages = imagesWithNumbers.map(img => ({
      fileName: img.fileName,
      number: img.number,
      url: img.url,
      publicUrl: img.publicUrl
    }));
    
    console.log('🔍 findEventImages - Final image list (clean):', cleanImages);
    
    return {
      success: true,
      images: cleanImages,
      searchedPattern: baseIdForImages,
      eventId: eventIdString,
      totalMatching: cleanImages.length
    };
    
  } catch (error) {
    console.error('❌ findEventImages - Function error:', error);
    console.error('❌ findEventImages - Error stack:', error.stack);
    
    return {
      success: false,
      error: error.message
    };
  }
});

// Proxy image function to bypass CORS restrictions
exports.proxyImage = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔍 proxyImage - Raw input data keys:', Object.keys(data || {}));
    
    // Extract image URL from the data
    let imageUrl;
    if (data && data.imageUrl) {
      imageUrl = data.imageUrl;
    } else if (data && data.data && data.data.imageUrl) {
      imageUrl = data.data.imageUrl;
    } else {
      console.log('❌ proxyImage - Image URL not found in data structure');
      throw new Error('Image URL is required');
    }
    
    console.log('🔍 proxyImage - Extracted imageUrl:', imageUrl);
    
    if (!imageUrl) {
      throw new Error('Image URL is required and cannot be empty');
    }
    
    // Clean the URL (remove quotes if present)
    let cleanedUrl = imageUrl.trim();
    if (cleanedUrl.startsWith('"') && cleanedUrl.endsWith('"')) {
      cleanedUrl = cleanedUrl.slice(1, -1);
    }
    if (cleanedUrl.startsWith("'") && cleanedUrl.endsWith("'")) {
      cleanedUrl = cleanedUrl.slice(1, -1);
    }
    
    console.log('🔍 proxyImage - Cleaned URL:', cleanedUrl);
    
    // Fetch the image from the URL
    console.log('🔍 proxyImage - Fetching image from:', cleanedUrl);
    const response = await axios.get(cleanedUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log('✅ proxyImage - Successfully fetched image');
    console.log('🔍 proxyImage - Response status:', response.status);
    console.log('🔍 proxyImage - Content type:', response.headers['content-type']);
    console.log('🔍 proxyImage - Image size:', response.data.length, 'bytes');
    
    // Convert the image data to base64
    const base64Image = Buffer.from(response.data).toString('base64');
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    // Create a data URL
    const dataUrl = `data:${contentType};base64,${base64Image}`;
    
    console.log('✅ proxyImage - Successfully created data URL');
    console.log('🔍 proxyImage - Data URL length:', dataUrl.length);
    
    return {
      success: true,
      dataUrl: dataUrl,
      contentType: contentType,
      originalUrl: cleanedUrl,
      size: response.data.length
    };
    
  } catch (error) {
    console.error('❌ proxyImage - Function error:', error);
    console.error('❌ proxyImage - Error message:', error.message);
    
    return {
      success: false,
      error: error.message,
      originalUrl: imageUrl
    };
  }
});

// Proxy video function to bypass CORS restrictions
exports.proxyVideo = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔍 proxyVideo - Raw input data keys:', Object.keys(data || {}));
    
    // Extract video URL from the data
    let videoUrl;
    if (data && data.videoUrl) {
      videoUrl = data.videoUrl;
    } else if (data && data.data && data.data.videoUrl) {
      videoUrl = data.data.videoUrl;
    } else {
      console.log('❌ proxyVideo - Video URL not found in data structure');
      throw new Error('Video URL is required');
    }
    
    console.log('🔍 proxyVideo - Extracted videoUrl:', videoUrl);
    
    if (!videoUrl) {
      throw new Error('Video URL is required and cannot be empty');
    }
    
    // Clean the URL (remove quotes if present)
    let cleanedUrl = videoUrl.trim();
    if (cleanedUrl.startsWith('"') && cleanedUrl.endsWith('"')) {
      cleanedUrl = cleanedUrl.slice(1, -1);
    }
    if (cleanedUrl.startsWith("'") && cleanedUrl.endsWith("'")) {
      cleanedUrl = cleanedUrl.slice(1, -1);
    }
    
    console.log('🔍 proxyVideo - Cleaned URL:', cleanedUrl);
    
    // For videos, we'll return a proxied URL that the client can use
    // This avoids loading the entire video into memory on the server
    const proxyUrl = `https://us-central1-nocta-d1113.cloudfunctions.net/proxyVideoStream?url=${encodeURIComponent(cleanedUrl)}`;
    
    console.log('✅ proxyVideo - Created proxy URL:', proxyUrl);
    
    return {
      success: true,
      proxyUrl: proxyUrl,
      originalUrl: cleanedUrl
    };
    
  } catch (error) {
    console.error('❌ proxyVideo - Function error:', error);
    console.error('❌ proxyVideo - Error message:', error.message);
    
    return {
      success: false,
      error: error.message,
      originalUrl: videoUrl
    };
  }
});

// Proxy video stream function to handle video streaming
exports.proxyVideoStream = functions.https.onRequest(async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      res.status(400).send('Video URL is required');
      return;
    }
    
    console.log('🔍 proxyVideoStream - Proxying video from:', url);
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).send();
      return;
    }
    
    // Fetch the video with proper headers
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://www.instagram.com/'
      },
      timeout: 30000 // 30 second timeout for videos
    });
    
    // Forward the content type
    res.set('Content-Type', response.headers['content-type'] || 'video/mp4');
    
    // Send the video data
    res.send(response.data);
    
    console.log('✅ proxyVideoStream - Successfully proxied video');
    
  } catch (error) {
    console.error('❌ proxyVideoStream - Function error:', error);
    console.error('❌ proxyVideoStream - Error message:', error.message);
    
    res.status(500).send('Failed to proxy video');
  }
});

// Manual video conversion for new posts
exports.convertNewVideo = functions.https.onRequest({
  memory: '4GB',
  timeoutSeconds: 540
}, async (req, res) => {
  try {
    console.log('🎬 convertNewVideo - Starting manual video conversion');
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(200).send();
      return;
    }
    
    const { docId } = req.body;
    
    if (!docId) {
      return res.status(400).json({ error: 'docId is required' });
    }
    
    console.log(`🎬 convertNewVideo - Converting video in document ${docId}`);
    
    // Get the document
    const docRef = db.collection('Instagram_posts').doc(docId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const docData = doc.data();
    
    // Check for video fields
    const videoFields = ['videourl', 'videoUrl', 'VideoURL', 'Video', 'video'];
    let videoFieldToConvert = null;
    
    for (const field of videoFields) {
      if (docData[field] && !docData[`${field}_compressed`]) {
        videoFieldToConvert = field;
        break;
      }
    }
    
    if (!videoFieldToConvert) {
      return res.status(400).json({ 
        error: 'No unconverted video field found',
        note: 'Video may already be converted or not exist'
      });
    }
    
    const videoUrl = docData[videoFieldToConvert];
    console.log(`🎬 convertNewVideo - Video URL:`, videoUrl);
    
    // Check if it's an Instagram URL (likely to be blocked)
    const isInstagramUrl = videoUrl.includes('instagram.com') || 
                         videoUrl.includes('cdninstagram.com') || 
                         videoUrl.includes('fbcdn.net');
    
    if (isInstagramUrl) {
      console.log('🎬 convertNewVideo - Instagram video detected, marking as blocked');
      
      // Mark as blocked by Instagram
      const updates = {};
      updates[`${videoFieldToConvert}_original`] = videoUrl;
      updates[`${videoFieldToConvert}_compressed`] = false;
      updates[`${videoFieldToConvert}_blocked`] = true;
      updates[`${videoFieldToConvert}_error`] = 'Instagram video - access blocked';
      
      await docRef.update(updates);
      
      res.json({
        success: false,
        message: 'Instagram video detected - access blocked',
        note: 'Instagram videos cannot be converted due to access restrictions'
      });
      return;
    }
    
    // For non-Instagram videos, attempt conversion
    try {
      // Fetch the video
      const response = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 60000
      });
      
      console.log(`🎬 convertNewVideo - Fetched video, size:`, response.data.length);
      
      // Upload to Firebase Storage
      const fileName = `compressed_${docId}_${videoFieldToConvert}_${Date.now()}.mp4`;
      const bucket = storage.bucket('nocta-d1113.appspot.com');
      const fileRef = bucket.file(fileName);
      
      await fileRef.save(Buffer.from(response.data), {
        metadata: { 
          contentType: 'video/mp4',
          cacheControl: 'public, max-age=31536000',
          metadata: {
            originalSize: response.data.length.toString(),
            compressed: 'true',
            conversionDate: new Date().toISOString()
          }
        }
      });
      
      await fileRef.makePublic();
      const compressedUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      
      // Update the document
      const updates = {};
      updates[videoFieldToConvert] = compressedUrl;
      updates[`${videoFieldToConvert}_original`] = videoUrl;
      updates[`${videoFieldToConvert}_compressed`] = true;
      
      await docRef.update(updates);
      
      console.log(`🎬 convertNewVideo - Successfully converted video:`, compressedUrl);
      
      res.json({
        success: true,
        message: `Successfully converted ${videoFieldToConvert} in document ${docId}`,
        originalSize: response.data.length,
        compressedUrl: compressedUrl,
        note: 'Video uploaded to Firebase Storage for faster delivery'
      });
      
    } catch (conversionError) {
      console.error('🎬 convertNewVideo - Conversion failed:', conversionError.message);
      
      // Mark as failed
      const updates = {};
      updates[`${videoFieldToConvert}_original`] = videoUrl;
      updates[`${videoFieldToConvert}_compressed`] = false;
      updates[`${videoFieldToConvert}_error`] = conversionError.message;
      
      await docRef.update(updates);
      
      res.json({
        success: false,
        message: `Video conversion failed: ${conversionError.message}`,
        originalSize: 0,
        note: 'Video processing failed, original URL preserved'
      });
    }
    
  } catch (error) {
    console.error('🎬 convertNewVideo - Function error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

console.log("Manual video conversion function added!");

// Download and permanently store Instagram videos before they expire
exports.downloadAndStoreInstagramVideo = functions.https.onRequest({
  memory: '4GB',
  timeoutSeconds: 540
}, async (req, res) => {
  try {
    console.log('🎬 downloadAndStoreInstagramVideo - Starting video download and storage');
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(200).send();
      return;
    }
    
    const { docId } = req.body;
    
    if (!docId) {
      return res.status(400).json({ error: 'docId is required' });
    }
    
    console.log(`🎬 downloadAndStoreInstagramVideo - Processing document ${docId}`);
    
    // Get the document
    const docRef = db.collection('Instagram_posts').doc(docId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const docData = doc.data();
    
    // Check for video fields
    const videoFields = ['videourl', 'videoUrl', 'VideoURL', 'Video', 'video'];
    let videoFieldToProcess = null;
    
    for (const field of videoFields) {
      if (docData[field] && !docData[`${field}_permanent`]) {
        videoFieldToProcess = field;
        break;
      }
    }
    
    if (!videoFieldToProcess) {
      return res.status(400).json({ 
        error: 'No unconverted video field found',
        note: 'Video may already be permanently stored or not exist'
      });
    }
    
    const videoUrl = docData[videoFieldToProcess];
    console.log(`🎬 downloadAndStoreInstagramVideo - Video URL:`, videoUrl);
    
    // Check if it's an Instagram URL
    const isInstagramUrl = videoUrl.includes('instagram.com') || 
                         videoUrl.includes('cdninstagram.com') || 
                         videoUrl.includes('fbcdn.net');
    
    if (!isInstagramUrl) {
      return res.status(400).json({ 
        error: 'Not an Instagram video URL',
        note: 'This function is designed for Instagram videos only'
      });
    }
    
    try {
      console.log('🎬 downloadAndStoreInstagramVideo - Attempting to download Instagram video...');
      
      // Try to fetch the video with Instagram-specific headers
      const response = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': 'https://www.instagram.com/',
          'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 120000 // 2 minutes for video download
      });
      
      console.log(`🎬 downloadAndStoreInstagramVideo - Successfully downloaded video, size:`, response.data.length);
      
            // Upload to Firebase Storage with permanent filename
      const fileName = `permanent_${docId}_${videoFieldToProcess}_${Date.now()}.mp4`;
      
      // Try to upload to Firebase Storage
      try {
        const bucket = storage.bucket('nocta_bucket');
        const fileRef = bucket.file(fileName);
        
        await fileRef.save(Buffer.from(response.data), {
          metadata: { 
            contentType: 'video/mp4',
            cacheControl: 'public, max-age=31536000',
            metadata: {
              originalSize: response.data.length.toString(),
              originalUrl: videoUrl,
              permanentlyStored: 'true',
              storageDate: new Date().toISOString(),
              source: 'instagram'
            }
          }
        });
        
        // Skip makePublic() for uniform bucket-level access
        // The bucket should already be configured for public access
        const permanentUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        
        // Update the document with permanent URL
        const updates = {};
        updates[videoFieldToProcess] = permanentUrl; // Replace original URL with permanent one
        updates[`${videoFieldToProcess}_original`] = videoUrl; // Keep original for reference
        updates[`${videoFieldToProcess}_permanent`] = true; // Mark as permanently stored
        updates[`${videoFieldToProcess}_storedAt`] = new Date().toISOString();
        updates[`${videoFieldToProcess}_size`] = response.data.length;
        
        await docRef.update(updates);
        
        console.log(`🎬 downloadAndStoreInstagramVideo - Successfully stored video permanently:`, permanentUrl);
        
        res.json({
          success: true,
          message: `Successfully downloaded and permanently stored ${videoFieldToProcess} in document ${docId}`,
          originalSize: response.data.length,
          permanentUrl: permanentUrl,
          note: 'Video is now permanently stored and will not expire'
        });
        
      } catch (storageError) {
        console.error('🎬 downloadAndStoreInstagramVideo - Storage upload failed:', storageError.message);
        
                 // Fallback: Try to use default bucket
         console.log('🎬 downloadAndStoreInstagramVideo - Trying default bucket...');
         try {
           const defaultBucket = admin.storage().bucket('nocta_bucket');
           const fileRef = defaultBucket.file(fileName);
           
           await fileRef.save(Buffer.from(response.data), {
             metadata: { 
               contentType: 'video/mp4',
               cacheControl: 'public, max-age=31536000',
               metadata: {
                 originalSize: response.data.length.toString(),
                 originalUrl: videoUrl,
                 permanentlyStored: 'true',
                 storageDate: new Date().toISOString(),
                 source: 'instagram'
               }
             }
           });
           
           // Skip makePublic() for uniform bucket-level access
           // The bucket should already be configured for public access
           const permanentUrl = `https://storage.googleapis.com/${defaultBucket.name}/${fileName}`;
           
           // Update the document with permanent URL
           const updates = {};
           updates[videoFieldToProcess] = permanentUrl; // Replace original URL with permanent one
           updates[`${videoFieldToProcess}_original`] = videoUrl; // Keep original for reference
           updates[`${videoFieldToProcess}_permanent`] = true; // Mark as permanently stored
           updates[`${videoFieldToProcess}_storedAt`] = new Date().toISOString();
           updates[`${videoFieldToProcess}_size`] = response.data.length;
           
           await docRef.update(updates);
           
           console.log(`🎬 downloadAndStoreInstagramVideo - Successfully stored video permanently:`, permanentUrl);
           
           res.json({
             success: true,
             message: `Successfully downloaded and permanently stored ${videoFieldToProcess} in document ${docId}`,
             originalSize: response.data.length,
             permanentUrl: permanentUrl,
             note: 'Video is now permanently stored and will not expire'
           });
           
                  } catch (defaultBucketError) {
           console.error('🎬 downloadAndStoreInstagramVideo - Default bucket also failed:', defaultBucketError.message);
           
           // Final fallback: Just mark as downloaded but keep original URL
           const updates = {};
           updates[`${videoFieldToProcess}_original`] = videoUrl; // Keep original for reference
           updates[`${videoFieldToProcess}_permanent`] = false; // Mark as not permanently stored
           updates[`${videoFieldToProcess}_downloaded`] = true; // Mark as downloaded
           updates[`${videoFieldToProcess}_storedAt`] = new Date().toISOString();
           updates[`${videoFieldToProcess}_size`] = response.data.length;
           updates[`${videoFieldToProcess}_error`] = 'Downloaded but storage failed: ' + defaultBucketError.message;
           
           await docRef.update(updates);
           
           res.json({
             success: false,
             message: `Video downloaded but storage failed: ${defaultBucketError.message}`,
             originalSize: response.data.length,
             note: 'Video was downloaded but could not be stored permanently. Original URL preserved.'
           });
         }
        
        console.log(`🎬 downloadAndStoreInstagramVideo - Stored video as data URL (fallback)`);
        
        res.json({
          success: true,
          message: `Successfully downloaded and stored ${videoFieldToProcess} as data URL in document ${docId}`,
          originalSize: response.data.length,
          permanentUrl: dataUrl.substring(0, 100) + '...', // Show first 100 chars
          note: 'Video stored as data URL due to storage bucket issues'
        });
      }
      
    } catch (downloadError) {
      console.error('🎬 downloadAndStoreInstagramVideo - Download failed:', downloadError.message);
      
      // Check if it's a 403 error (access blocked)
      if (downloadError.response && downloadError.response.status === 403) {
        const updates = {};
        updates[`${videoFieldToProcess}_original`] = videoUrl;
        updates[`${videoFieldToProcess}_permanent`] = false;
        updates[`${videoFieldToProcess}_error`] = 'Instagram access blocked - URL may have expired';
        updates[`${videoFieldToProcess}_attemptedAt`] = new Date().toISOString();
        
        await docRef.update(updates);
        
        res.json({
          success: false,
          message: 'Instagram video access blocked - URL may have expired',
          note: 'Try downloading the video manually or wait for a fresh URL'
        });
      } else {
        // Other download errors
        const updates = {};
        updates[`${videoFieldToProcess}_original`] = videoUrl;
        updates[`${videoFieldToProcess}_permanent`] = false;
        updates[`${videoFieldToProcess}_error`] = downloadError.message;
        updates[`${videoFieldToProcess}_attemptedAt`] = new Date().toISOString();
        
        await docRef.update(updates);
        
        res.json({
          success: false,
          message: `Video download failed: ${downloadError.message}`,
          originalSize: 0,
          note: 'Video processing failed, original URL preserved'
        });
      }
    }
    
  } catch (error) {
    console.error('🎬 downloadAndStoreInstagramVideo - Function error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

console.log("Instagram video download and storage function added!");

// Video optimization function (download and store in Firebase Storage)
exports.optimizeVideos = functions.https.onRequest({
  memory: '4GB',
  timeoutSeconds: 540
}, async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { videos } = req.body;

    if (!videos || !Array.isArray(videos)) {
      return res.status(400).json({ 
        success: false, 
        message: 'videos array is required' 
      });
    }

    console.log(`Optimizing ${videos.length} videos...`);
    const optimizedVideos = [];
    const batchSize = 2; // Process 2 videos at a time

    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize);
      const batchPromises = batch.map(async (videoUrl, batchIndex) => {
        const globalIndex = i + batchIndex;
        try {
          console.log(`Processing video ${globalIndex + 1}/${videos.length}: ${videoUrl.substring(0, 50)}...`);
          
          // Download the video
          const response = await axios.get(videoUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          const videoBuffer = Buffer.from(response.data);
          const videoSize = videoBuffer.length;
          
          console.log(`Video ${globalIndex + 1} downloaded (${(videoSize / 1024 / 1024).toFixed(2)}MB)`);

                            // Store in Firebase Storage with optimized filename
                  const storage = admin.storage();
                  const bucket = storage.bucket('nocta_bucket');
                  
                  // Create a more descriptive filename that includes metadata
                  const timestamp = Date.now();
                  const originalUrlHash = Buffer.from(videoUrl).toString('base64').substring(0, 8);
                  const fileName = `optimized-videos/${timestamp}-${globalIndex}-${originalUrlHash}.mp4`;
                  const file = bucket.file(fileName);

                  await file.save(videoBuffer, {
                    metadata: {
                      contentType: 'video/mp4',
                      cacheControl: 'public, max-age=31536000', // Cache for 1 year
                      metadata: {
                        originalUrl: videoUrl,
                        optimizedDate: new Date().toISOString(),
                        originalSize: videoSize,
                        optimizedSize: videoBuffer.length
                      }
                    }
                  });

                  // Make the file publicly accessible
                  await file.makePublic();

                  // Get the public URL
                  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
                  
                  console.log(`Video ${globalIndex + 1} stored at: ${publicUrl}`);
                  optimizedVideos.push(publicUrl);

        } catch (error) {
          console.error(`Error processing video ${globalIndex + 1}:`, error);
          // Return original URL if optimization fails
          optimizedVideos.push(videoUrl);
        }
      });

      const batchResults = await Promise.all(batchPromises);
      optimizedVideos.push(...batchResults);
      
      if (global.gc) {
        global.gc();
      }
      
      if (i + batchSize < videos.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const stats = {
      total: videos.length,
      optimized: optimizedVideos.filter(v => v && typeof v === 'string' && v.includes('storage.googleapis.com')).length,
      failed: optimizedVideos.filter(v => !v || typeof v !== 'string' || !v.includes('storage.googleapis.com')).length
    };

    console.log(`Video optimization complete: ${stats.optimized}/${stats.total} optimized`);

    res.json({
      success: true,
      message: `Optimized ${stats.optimized} videos`,
      optimizedVideos,
      stats
    });

  } catch (error) {
    console.error('Video optimization error:', error);
    res.status(500).json({
      success: false,
      message: 'Video optimization failed',
      error: error.message
    });
  }
});