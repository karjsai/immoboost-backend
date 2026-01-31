import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir les fichiers statiques (frontend)
app.use(express.static(join(__dirname, 'public')));

// Import de la fonction enhance
import enhanceHandler from './api/enhance.js';

// Route API
app.post('/api/enhance', async (req, res) => {
  await enhanceHandler(req, res);
});

// Route principale - servir le HTML
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Démarrage
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ImmoBoost Pro running on port ${PORT}`);
});
```

**Commit :** `Serve frontend from Railway`

---

## ⏱️ **Attendre 2 minutes** que Railway redéploie

---

## 🧪 **TESTER**

Allez sur :
```
https://immoboost-backend-production.up.railway.app/
