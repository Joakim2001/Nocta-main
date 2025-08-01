import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavCompany from './BottomNavCompany';

export default function CreateSelection() {
  const navigate = useNavigate();
  const [selectionType, setSelectionType] = useState(null); // 'event' or 'offer'
  const [ticketOption, setTicketOption] = useState('No ticket');
  const [offerOption, setOfferOption] = useState('No ticket');

  const handleProceed = () => {
    if (!selectionType) return;
    if (selectionType === 'event') {
      navigate('/company-create-event', { state: { isCreation: true, ticketOption } });
    } else {
      navigate('/company-create-event', { state: { isCreation: false, offerOption } });
    }
  };

  const baseCompositeStyle = {
    display: 'flex',
    alignItems: 'center',
    background: 'linear-gradient(90deg, #3E29F0 0%, #a445ff 100%)',
    borderRadius: '24px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
    transition: 'transform 0.3s, opacity 0.3s',
    width: '100%',
    maxWidth: '420px',
    overflow: 'hidden',
    cursor: 'pointer',
  };

  const activeCompositeStyle = {
    ...baseCompositeStyle,
    opacity: 1,
    transform: 'scale(1.02)',
  };

  const inactiveCompositeStyle = {
    ...baseCompositeStyle,
    opacity: 0.5,
  };
  
  const buttonTextStyle = {
    color: '#fff',
    padding: '16px 24px',
    fontWeight: '700',
    fontSize: '16px',
    flexGrow: 1,
    textAlign: 'left',
    cursor: 'pointer',
  };

  const selectStyle = {
    background: 'transparent',
    color: '#fff',
    padding: '16px',
    border: 'none',
    borderLeft: '1px solid rgba(255, 255, 255, 0.3)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    textAlign: 'center',
    flexShrink: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='white'%3E%3Cpath d='M4.5 6.5L8 10l3.5-3.5h-7z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '16px',
  };

  const optionStyle = {
    background: '#2d1a47',
    color: '#f0f0f0',
    padding: '14px 20px',
    border: 'none',
    fontSize: '16px',
  };
  
  const continueButtonStyle = {
    background: 'linear-gradient(90deg, #3E29F0 0%, #a445ff 100%)',
    color: '#fff',
    padding: '16px 24px',
    borderRadius: '24px',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
    width: '47.5%',
    textAlign: 'center',
    fontSize: '18px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
    marginTop: '96px',
    alignSelf: 'center',
  };

  const disabledContinueButtonStyle = {
    ...continueButtonStyle,
    background: 'linear-gradient(90deg, #555 0%, #777 100%)',
    opacity: 0.6,
    cursor: 'not-allowed',
  };

  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>
      {/* Top bar */}
      <div style={{ width: '100vw', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 448, background: '#0f172a', padding: '22px 0 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #1e293b', position: 'relative' }}>
          <span style={{ display: 'flex', alignItems: 'center', background: 'rgba(34,4,58,0.95)', color: '#fff', fontWeight: 700, fontSize: 18, borderRadius: 24, padding: '8px 22px', boxShadow: '0 2px 12px #0004', letterSpacing: 0.5, border: '2px solid #fff', textShadow: '0 2px 8px #3E29F099' }}>
            Choose type of post
          </span>
        </div>
      </div>
      
      {/* Main content */}
      <div style={{ flex: 1, width: '100%', background: '#22043a', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', paddingBottom: '80px', paddingLeft: '16px', paddingRight: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '420px', transform: 'translateY(-40px)' }}>
          <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '600', textAlign: 'left', paddingLeft: '24px', transform: 'translateY(8px)' }}>Post relates to</h2>
          <div 
            style={selectionType === 'event' ? {...activeCompositeStyle, width: '95%', alignSelf: 'center'} : {...inactiveCompositeStyle, width: '95%', alignSelf: 'center'}}
            onClick={() => setSelectionType('event')}
          >
            <div 
              style={buttonTextStyle}
            >
              Event/DJ/Artist/Theme
            </div>
            <select
              style={{...selectStyle, width: '130px'}}
              value={ticketOption}
              onChange={(e) => setTicketOption(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              disabled={selectionType !== 'event'}
            >
              <option style={optionStyle} value="No ticket">No ticket</option>
              <option style={optionStyle} value="Free ticket">Free ticket</option>
              <option style={optionStyle} value="Buy ticket">Buy ticket</option>
            </select>
          </div>
          <div
            style={selectionType === 'offer' ? {...activeCompositeStyle, width: '95%', alignSelf: 'center'} : {...inactiveCompositeStyle, width: '95%', alignSelf: 'center'}}
            onClick={() => setSelectionType('offer')}
          >
            <div 
              style={buttonTextStyle}
            >
              Offer
            </div>
            <select
              style={{...selectStyle, width: '130px'}}
              value={offerOption}
              onChange={(e) => setOfferOption(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              disabled={selectionType !== 'offer'}
            >
              <option style={optionStyle} value="No ticket">No ticket</option>
              <option style={optionStyle} value="Free ticket">Free ticket</option>
              <option style={optionStyle} value="Buy ticket">Buy ticket</option>
            </select>
          </div>
          <button 
            onClick={handleProceed} 
            style={selectionType ? continueButtonStyle : disabledContinueButtonStyle}
            disabled={!selectionType}
          >
            Continue
          </button>
        </div>
      </div>
      <BottomNavCompany />
    </div>
  );
} 