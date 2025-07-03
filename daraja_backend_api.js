const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;
const businessShortCode = '174379';
const passkey = process.env.PASSKEY;
const callbackURL = process.env.CALLBACK_URL;

async function getAccessToken() {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const response = await axios.get(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return response.data.access_token;
}

function generatePassword() {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const password = Buffer.from(`${businessShortCode}${passkey}${timestamp}`).toString('base64');
  return { timestamp, password };
}

app.post('/api/mpesa/stkpush', async (req, res) => {
  const { phone, amount } = req.body;
  if (!phone || !amount) return res.status(400).json({ success: false, message: 'Missing phone or amount' });

  try {
    const token = await getAccessToken();
    const { timestamp, password } = generatePassword();

    const payload = {
      BusinessShortCode: businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: businessShortCode,
      PhoneNumber: phone,
      CallBackURL: callbackURL,
      AccountReference: 'ETELENETSOUND',
      TransactionDesc: 'Payment for service'
    };

    const stkRes = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (stkRes.data.ResponseCode === '0') {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: stkRes.data.ResponseDescription });
    }
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/mpesa/callback', (req, res) => {
  console.log('Mpesa Callback:', JSON.stringify(req.body));
  res.status(200).json({ success: true });
});

app.listen(PORT, () => console.log(`Mpesa API running on port ${PORT}`));
