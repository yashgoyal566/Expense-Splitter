const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || '2023-08-01';
const CASHFREE_BASE_URL = process.env.CASHFREE_BASE_URL || 'https://sandbox.cashfree.com/pg';
const DEFAULT_CUSTOMER_PHONE = process.env.DEFAULT_CUSTOMER_PHONE || '6666666666';
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

app.post('/api/cashfree/create-order', async (req, res) => {
  try {
    const { amount, from, to, returnOrigin, returnPath } = req.body;
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const baseOrigin = returnOrigin || CLIENT_ORIGIN;
    let cleanPath = returnPath || '/index.html';
    if (!cleanPath.endsWith('.html')) {
      cleanPath = cleanPath.endsWith('/') ? `${cleanPath}index.html` : `${cleanPath}/index.html`;
    }
    const returnUrl = `${baseOrigin}${cleanPath}?order_id={order_id}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${amount}`;

    const sanitizedCustomerId = `cust_${from.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    const orderPayload = {
      order_id: orderId,
      order_amount: parseFloat(amount),
      order_currency: 'INR',
      customer_details: {
        customer_id: sanitizedCustomerId,
        customer_phone: DEFAULT_CUSTOMER_PHONE,
        customer_name: from
      },
      order_meta: {
        return_url: returnUrl
      }
    };

    const response = await fetch(`${CASHFREE_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
        'x-api-version': CASHFREE_API_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    const data = await response.json();
    if (data.payment_session_id) {
      res.json({ payment_session_id: data.payment_session_id, order_id: orderId });
    } else {
      res.status(400).json(data);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cashfree/verify-order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const response = await fetch(`${CASHFREE_BASE_URL}/orders/${orderId}`, {
      headers: {
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
        'x-api-version': CASHFREE_API_VERSION
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
