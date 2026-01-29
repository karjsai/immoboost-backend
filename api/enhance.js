export default async function handler(req, res) {
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
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Étape 1 : Analyse avec GPT-4 Vision
    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyse cette photo immobilière et recommande des améliorations précises. Réponds en format texte simple (pas de JSON) avec les corrections à appliquer.'
              },
              {
                type: 'image_url',
                image_url: { url: image }
              }
            ]
          }
        ],
        max_tokens: 300
      })
    });

    if (!analysisResponse.ok) {
      throw new Error('Analyse failed');
    }

    const analysisData = await analysisResponse.json();
    const recommendations = analysisData.choices[0].message.content;

    // Étape 2 : Amélioration avec DALL-E
    const editPrompt = `Améliore cette photo immobilière : ${recommendations}. Reste réaliste et naturel, pas artificiel.`;

    const editResponse = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: await createFormData(image, editPrompt)
    });

    if (!editResponse.ok) {
      throw new Error('Edit failed');
    }

    const editData = await editResponse.json();
    return res.status(200).json({ output: editData.data[0].url });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function createFormData(imageDataUrl, prompt) {
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  
  // Convertir data URL en buffer
  const base64Data = imageDataUrl.split(',')[1];
  const buffer = Buffer.from(base64Data, 'base64');
  
  form.append('image', buffer, { filename: 'image.png', contentType: 'image/png' });
  form.append('prompt', prompt);
  form.append('size', '1024x1024');
  
  return form;
}
