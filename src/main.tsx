/**
 * G&A Pods — App Entry Point
 *
 * Routing logic (no React Router needed):
 *   ?mode=booking  OR  ?source=manychat  →  Guest Booking Page
 *   (default)                             →  Manager Dashboard
 *
 * ManyChat button URL format:
 *   https://your-app.com?mode=booking&source=manychat
 *
 * To add pre-filled guest count:
 *   https://your-app.com?mode=booking&source=manychat&guests=4
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import BookingPage from './BookingPage.tsx';
import './index.css';

const params = new URLSearchParams(window.location.search);
const isBooking =
  params.get('mode') === 'booking' ||
  params.get('source') === 'manychat';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isBooking ? <BookingPage /> : <App />}
  </StrictMode>
);
