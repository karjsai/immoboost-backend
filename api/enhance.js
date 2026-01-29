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

    // Étape 1 : GPT-4 Vision analyse la photo et crée un prompt DALL-E
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
                text: `Analyse cette photo immobilière et crée un prompt DALL-E 3 détaillé pour générer une version améliorée.

Le prompt doit :
- Décrire précisément l'architecture, les éléments, la composition
- Spécifier les améliorations (ciel plus bleu, végétation plus verte, luminosité, contraste)
- Indiquer le style : "photo immobilière professionnelle, réaliste, haute qualité, lumière naturelle"
- Être en anglais
- Faire maximum 400 caractères

Réponds UNIQUEMENT avec le prompt DALL-E, rien d'autre.`
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
      const errorData = await analysisResponse.json();
      console.error('GPT-4 Vision error:', errorData);
      throw new Error('Analysis failed: ' + (errorData.error?.message || 'Unknown error'));
    }

    const analysisData = await analysisResponse.json();
    const dallePrompt = analysisData.choices[0].message.content.trim();
    
    console.log('DALL-E Prompt:', dallePrompt);

    // Étape 2 : DALL-E 3 génère la version améliorée
    const generateResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: dallePrompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd',
        style: 'natural'
      })
    });

    if (!generateResponse.ok) {
      const errorData = await generateResponse.json();
      console.error('DALL-E 3 error:', errorData);
      throw new Error('Generation failed: ' + (errorData.error?.message || 'Unknown error'));
    }

    const generateData = await generateResponse.json();
    const enhancedImageUrl = generateData.data[0].url;

    return res.status(200).json({ output: enhancedImageUrl });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
