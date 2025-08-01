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
const NEW_BUCKET = "nocta-d1113.appspot.com"; // Try default bucket first
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
            
            // Get the event document
            const eventRef = db.collection('company-events').doc(eventId);
            const eventDoc = await eventRef.get();
            
            if (eventDoc.exists) {
              const eventData = eventDoc.data();
              const ticketConfig = eventData.ticketConfiguration;
              
              // Update ticket data with event information
              ticketData.eventDate = eventData.eventDate || eventData.eventDates?.[0];
              ticketData.eventDateEnd = eventData.eventDateEnd;
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

    const { price, eventName, userEmail, eventId, tierIndex } = req.body;

    if (!price || !eventName || !userEmail) {
      return res.status(400).send('Missing required fields');
    }

    try {
      console.log('Creating simple checkout session');
      const stripe = stripeLib(process.env.STRIPE_SECRET);

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
        metadata: {
          eventName: eventName,
          userEmail: userEmail,
          eventId: eventId || '',
          tierIndex: tierIndex?.toString() || '0'
        },
        success_url: 'https://nocta-d1113.web.app/payment-success',
        cancel_url: 'https://nocta-d1113.web.app/payment-cancel'
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
        totalTickets: allTickets.length
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