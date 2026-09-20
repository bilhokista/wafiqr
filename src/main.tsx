import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Couriers are registered once, at start, so nothing deeper has to know which
// carriers exist. With no key the list stays empty and every waybill is
// recorded unverified.
import { DHL_API_KEY } from './lib/config';
import { useCourier } from './lib/courier';
import { dhlCourier } from './lib/couriers/dhl';

if (DHL_API_KEY) useCourier(dhlCourier(DHL_API_KEY));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
