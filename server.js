import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Import de la fonction enhance
import enhanceHandler from './api/enhance.js';

// Route principale
app.post('/api/enhance', async (req, res) => {
  await enhanceHandler(req, res);
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ImmoBoost Backend OK',
    service: 'Railway',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ImmoBoost Backend running on port ${PORT}`);
});
