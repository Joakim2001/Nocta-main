import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function QRCodeComponent({ ticketData, size = 120 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && ticketData) {
      // Create QR code data with ticket information
      const qrData = JSON.stringify({
        ticketId: ticketData.id,
        eventName: ticketData.eventName,
        price: ticketData.price,
        userId: ticketData.userId,
        purchaseDate: ticketData.purchaseDate?.seconds || ticketData.downloadDate?.seconds || Date.now() / 1000,
        type: ticketData.price === 0 ? 'Free' : (ticketData.price >= 200 ? 'VIP' : 'General')
      });

      QRCode.toCanvas(canvasRef.current, qrData, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }, (error) => {
        if (error) console.error('QR Code generation error:', error);
      });
    }
  }, [ticketData, size]);

  if (!ticketData) {
    return (
      <div style={{
        width: size,
        height: size,
        background: '#f3f4f6',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6b7280',
        fontWeight: 'bold'
      }}>
        No Data
      </div>
    );
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      padding: '24px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <canvas 
        ref={canvasRef}
        style={{
          maxWidth: '100%',
          height: 'auto',
          borderRadius: '8px',
          marginBottom: '12px'
        }}
      />
      <p style={{ 
        color: '#6b7280', 
        fontSize: '14px', 
        margin: '0',
        fontWeight: '500'
      }}>
        Show this at the event entrance
      </p>
    </div>
  );
} 