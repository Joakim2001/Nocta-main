import React from 'react';
import { getAuth } from 'firebase/auth';
import { db } from './firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export default function TestTickets() {
  const auth = getAuth();
  const user = auth.currentUser;

  const addTestTicket = async (ticketType) => {
    if (!user) {
      alert('Please log in first');
      return;
    }

    try {
      const price = ticketType === 'VIP' ? 250 : 150;
      const testTicket = {
        userId: user.uid,
        eventName: 'Test Event - Hip-Hop Saturday',
        price: price,
        currency: 'DKK',
        stripeSessionId: `test_session_${Date.now()}`,
        customerEmail: user.email,
        paymentStatus: 'paid',
        purchaseDate: Timestamp.now(),
        ticketId: `TKT-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      };

      await addDoc(collection(db, 'tickets'), testTicket);
      alert(`Test ${ticketType} ticket added successfully!`);
    } catch (error) {
      console.error('Error adding test ticket:', error);
      alert('Error adding test ticket');
    }
  };

  if (!user) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>
        <p>Please log in to add test tickets</p>
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 100, 
      right: 20, 
      background: '#1e293b', 
      padding: '16px', 
      borderRadius: '12px',
      border: '1px solid #334155',
      zIndex: 1000
    }}>
      <h4 style={{ color: '#fff', margin: '0 0 12px 0', fontSize: '14px' }}>Test Tickets (Dev Only)</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={() => addTestTicket('General')}
          style={{
            background: '#3E29F0',
            color: '#fff',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Add General Ticket (150 DKK)
        </button>
        <button
          onClick={() => addTestTicket('VIP')}
          style={{
            background: '#F941F9',
            color: '#fff',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Add VIP Ticket (250 DKK)
        </button>
      </div>
    </div>
  );
} 