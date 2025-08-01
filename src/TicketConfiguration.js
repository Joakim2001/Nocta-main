import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { getFirestore, addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

function TicketConfiguration() {
  const navigate = useNavigate();
  const location = useLocation();
  const ticketType = location.state?.ticketOption;
  const eventType = location.state?.eventType;
  
  const [ticketConfig, setTicketConfig] = useState({
    hasTickets: ticketType !== 'No ticket',
    pricingTiers: [
      {
        name: 'Early Bird',
        price: '',
        quantity: '',
        availableUntil: '',
        description: 'Limited early bird tickets'
      }
    ],
    totalQuantity: '',
    maxTicketsPerPerson: ''
  });

  const [uploading, setUploading] = useState(false);

  // If no tickets, skip this page
  useEffect(() => {
    if (ticketType === 'No ticket') {
      handleSubmit();
    }
  }, [ticketType]);

  const addPricingTier = () => {
    setTicketConfig(prev => ({
      ...prev,
      pricingTiers: [
        ...prev.pricingTiers,
        {
          name: `Tier ${prev.pricingTiers.length + 1}`,
          price: '',
          quantity: '',
          availableUntil: '',
          description: ''
        }
      ]
    }));
  };

  const removePricingTier = (index) => {
    setTicketConfig(prev => ({
      ...prev,
      pricingTiers: prev.pricingTiers.filter((_, i) => i !== index)
    }));
  };

  const updatePricingTier = (index, field, value) => {
    setTicketConfig(prev => ({
      ...prev,
      pricingTiers: prev.pricingTiers.map((tier, i) => 
        i === index ? { ...tier, [field]: value } : tier
      )
    }));
  };

  const handleSubmit = async () => {
    setUploading(true);

    try {
      // Navigate to event creation with ticket configuration
      navigate('/company-create-event/new', { 
        state: { 
          ticketOption: ticketType,
          ticketConfiguration: ticketConfig,
          eventType: eventType
        } 
      });

    } catch (error) {
      console.error("Error preparing ticket configuration: ", error);
      alert("Failed to prepare ticket configuration. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    borderRadius: 12,
    fontSize: 16,
    outline: 'none',
    marginBottom: 12
  };

  const buttonStyle = {
    background: 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '12px 20px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    marginRight: 8,
    marginBottom: 8
  };

  const cardStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16
  };

  if (ticketType === 'No ticket') {
    return null; // Will redirect in useEffect
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <div style={{ maxWidth: 448, margin: '0 auto', background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', padding: '16px', flexShrink: 0 }}>
        <span onClick={() => navigate(-1)} style={{ color: '#fff', fontSize: 24, cursor: 'pointer' }}>‹</span>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, textAlign: 'center', flexGrow: 1 }}>Ticket Configuration</h2>
      </div>

      <div style={{ background: '#22043a', flex: 1, overflowY: 'auto', paddingTop: '24px', paddingBottom: '100px' }}>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: '0 16px' }}>
          
          {/* Ticket Type Summary */}
          <div style={cardStyle}>
            <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 18, marginBottom: 12 }}>Ticket Configuration</h3>
            <p style={{ color: '#fff', fontSize: 14, marginBottom: 8 }}><strong>Event Type:</strong> {eventType === 'event' ? 'Event' : 'Offer'}</p>
            <p style={{ color: '#fff', fontSize: 14, marginBottom: 8 }}><strong>Ticket Type:</strong> {ticketType}</p>
          </div>

          {/* General Ticket Settings */}
          <div style={cardStyle}>
            <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 18, marginBottom: 16 }}>General Settings</h3>
            
            <label style={{ color: '#fff', fontSize: 14, marginBottom: 8, display: 'block' }}>
              Total Tickets Available
            </label>
            <input
              type="number"
              value={ticketConfig.totalQuantity}
              onChange={(e) => setTicketConfig(prev => ({ ...prev, totalQuantity: e.target.value }))}
              style={inputStyle}
              placeholder="100"
            />

            <label style={{ color: '#fff', fontSize: 14, marginBottom: 8, display: 'block' }}>
              Max Tickets Per Person
            </label>
            <input
              type="number"
              value={ticketConfig.maxTicketsPerPerson}
              onChange={(e) => setTicketConfig(prev => ({ ...prev, maxTicketsPerPerson: e.target.value }))}
              style={inputStyle}
              placeholder="4"
            />
          </div>

          {/* Pricing Tiers */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>Pricing Tiers</h3>
              <button onClick={addPricingTier} style={buttonStyle}>+ Add Tier</button>
            </div>

            {ticketConfig.pricingTiers.map((tier, index) => (
              <div key={index} style={{ ...cardStyle, background: 'rgba(255,255,255,0.03)', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>Tier {index + 1}</h4>
                  {ticketConfig.pricingTiers.length > 1 && (
                    <button 
                      onClick={() => removePricingTier(index)}
                      style={{ ...buttonStyle, background: '#dc2626', padding: '8px 12px', fontSize: 14 }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ color: '#fff', fontSize: 12, marginBottom: 4, display: 'block' }}>Name</label>
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) => updatePricingTier(index, 'name', e.target.value)}
                      style={{ ...inputStyle, marginBottom: 8 }}
                      placeholder="Early Bird"
                    />
                  </div>
                  <div>
                    <label style={{ color: '#fff', fontSize: 12, marginBottom: 4, display: 'block' }}>Price (€)</label>
                                         <input
                       type="number"
                       value={tier.price}
                       onChange={(e) => updatePricingTier(index, 'price', e.target.value)}
                       style={{ ...inputStyle, marginBottom: 8 }}
                       placeholder="0"
                     />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ color: '#fff', fontSize: 12, marginBottom: 4, display: 'block' }}>Quantity</label>
                                         <input
                       type="number"
                       value={tier.quantity}
                       onChange={(e) => updatePricingTier(index, 'quantity', e.target.value)}
                       style={{ ...inputStyle, marginBottom: 8 }}
                       placeholder="50"
                     />
                  </div>
                  <div>
                    <label style={{ color: '#fff', fontSize: 12, marginBottom: 4, display: 'block' }}>Available Until</label>
                    <input
                      type="date"
                      value={tier.availableUntil}
                      onChange={(e) => updatePricingTier(index, 'availableUntil', e.target.value)}
                      style={{ ...inputStyle, marginBottom: 8 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ color: '#fff', fontSize: 12, marginBottom: 4, display: 'block' }}>Description</label>
                  <textarea
                    value={tier.description}
                    onChange={(e) => updatePricingTier(index, 'description', e.target.value)}
                    style={{ ...inputStyle, height: 60, resize: 'vertical' }}
                    placeholder="Describe this ticket tier..."
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button 
              onClick={() => navigate(-1)} 
              style={{ ...buttonStyle, background: 'rgba(255,255,255,0.1)', flex: 1 }}
            >
              Back
            </button>
            <button 
              onClick={handleSubmit} 
              disabled={uploading}
              style={{ ...buttonStyle, flex: 2, opacity: uploading ? 0.6 : 1 }}
            >
              {uploading ? 'Continuing...' : 'Continue to Event Details'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TicketConfiguration; 