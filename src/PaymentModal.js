import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Load Stripe outside of component render to avoid recreating on every render
const stripePromise = loadStripe('pk_test_51Qh0WcEStEhCuuzB8HWIY8lTxVpPz7UtppGJ6XLJrEfGIGYQO7xTqJ7OZSHNOGVXz7RXI5t6NJXWgLkcDFb7TGfD00WTDHaJ6c');

const CheckoutForm = ({ clientSecret, onSuccess, onError, onCancel, eventName, price }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setErrorMessage('Card information is required');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement
        }
      });

      if (error) {
        console.error('Payment failed:', error);
        setErrorMessage(error.message);
        onError(error);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        console.log('Payment succeeded!');
        onSuccess(paymentIntent);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setErrorMessage('Payment failed. Please try again.');
      onError(err);
    }

    setIsProcessing(false);
  };

  const cardStyle = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
    },
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0' }}>{eventName}</h3>
        <h2 style={{ margin: '0 0 20px 0' }}>DKK {price}.00</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '5px', 
            fontSize: '14px',
            fontWeight: 'bold' 
          }}>
            Card Information
          </label>
          <div style={{
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: '#fff'
          }}>
            <CardElement options={cardStyle} />
          </div>
        </div>

        {errorMessage && (
          <div style={{ 
            color: 'red', 
            marginBottom: '10px',
            fontSize: '14px'
          }}>
            {errorMessage}
          </div>
        )}

        <div style={{ marginBottom: '20px', fontSize: '12px', color: '#666' }}>
          Test card: 4242 4242 4242 4242 | Any future date | Any CVC
        </div>

        <button
          type="submit"
          disabled={!stripe || isProcessing}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: isProcessing ? '#ccc' : '#5469d4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        >
          {isProcessing ? 'Processing...' : `Pay DKK ${price}.00`}
        </button>
      </form>
    </div>
  );
};

const PaymentModal = ({ isOpen, clientSecret, eventName, price, onSuccess, onError, onClose }) => {
  if (!isOpen) return null;

  const handleSuccess = (paymentIntent) => {
    console.log('Payment successful:', paymentIntent);
    onSuccess(paymentIntent);
  };

  const handleError = (error) => {
    console.error('Payment error:', error);
    onError(error);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        maxWidth: '400px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '15px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#999'
          }}
        >
          ×
        </button>
        
        <Elements stripe={stripePromise}>
          <CheckoutForm
            clientSecret={clientSecret}
            onSuccess={handleSuccess}
            onError={handleError}
            onCancel={onClose}
            eventName={eventName}
            price={price}
          />
        </Elements>
      </div>
    </div>
  );
};

export default PaymentModal; 