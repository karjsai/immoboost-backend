export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { predictionId } = req.body;

    if (!predictionId) {
      return res.status(400).json({ error: 'No prediction ID provided' });
    }

    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to check status' });
    }

    const prediction = await response.json();

    return res.status(200).json(prediction);

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
