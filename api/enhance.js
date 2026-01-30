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
    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
    
    if (!OPENAI_API_KEY || !REPLICATE_API_TOKEN) {
      return res.status(500).json({ error: 'API keys not configured' });
    }

    console.log('🔍 ÉTAPE 1/2 : Analyse et génération prompt avec GPT-4 Vision...');

    // ============================================
    // ÉTAPE 1 : GPT-4 VISION - GÉNÉRATION PROMPT
    // ============================================
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                text: `Analyse cette photo immobilière et génère un prompt d'amélioration optimisé pour Stable Diffusion img2img.

Le prompt doit décrire la version AMÉLIORÉE de cette photo avec :
- Corrections de luminosité et d'exposition
- Amélioration des couleurs (saturation, balance des blancs)
- Augmentation du contraste et de la netteté
- Qualité professionnelle immobilière

Format attendu :
Un seul paragraphe en anglais décrivant la photo finale souhaitée.

Exemple pour EXTÉRIEUR :
"Professional real estate exterior photography, bright natural daylight, enhanced vibrant blue sky, lush green landscaping, crisp white facade, high contrast, sharp architectural details, HDR quality, magazine-worthy, photorealistic, 8k resolution"

Exemple pour INTÉRIEUR :
"Professional real estate interior photography, bright and airy atmosphere, perfect natural lighting, neutral white balance, enhanced contrast, warm inviting tones, sharp details, clean modern space, high-end staging, HDR quality, photorealistic, 8k resolution"

IMPORTANT :
- Décris la photo FINALE idéale (pas les corrections)
- Reste naturel et réaliste
- Qualité professionnelle immobilière
- UN SEUL paragraphe en anglais

Réponds UNIQUEMENT avec le prompt optimisé, sans explication supplémentaire.`
              },
              {
                type: 'image_url',
                image_url: { 
                  url: image,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 400,
        temperature: 0.4
      })
    });

    if (!gptResponse.ok) {
      const errorData = await gptResponse.json();
      console.error('GPT-4 Vision error:', errorData);
      throw new Error(`GPT-4 Vision failed: ${errorData.error?.message || 'Unknown error'}`);
    }

    const gptData = await gptResponse.json();
    const enhancementPrompt = gptData.choices[0].message.content.trim();
    
    console.log('✅ Prompt généré:', enhancementPrompt);

    // ============================================
    // ÉTAPE 2 : JUGGERNAUT XL V7 - AMÉLIORATION
    // ============================================
    console.log('✨ ÉTAPE 2/2 : Amélioration avec Juggernaut XL v7...');

    const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '6a52feace43ce1f6bbc2cdabfc68423cb2319d7444a1a1dae529c5e88b976382',
        input: {
          image: image,
          prompt: enhancementPrompt,
          negative_prompt: "blurry, distorted, low quality, artifacts, watermark, text, oversaturated, artificial, fake, unrealistic, cartoonish, painting, drawing",
          width: 2048,
          height: 2048,
          num_inference_steps: 30,
          guidance_scale: 7.5,
          strength: 0.15,
          scheduler: "DPMSolverMultistep",
          disable_safety_checker: true
        }
      })
    });

    if (!replicateResponse.ok) {
      const errorData = await replicateResponse.json();
      console.error('Replicate error:', errorData);
      throw new Error(`Replicate failed: ${errorData.detail || 'Unknown error'}`);
    }

    const replicateData = await replicateResponse.json();
    let prediction = replicateData;

    console.log('⏳ Prediction ID:', prediction.id);

    // ============================================
    // POLLING POUR RÉSULTAT
    // ============================================
    let attempts = 0;
    const maxAttempts = 60;

    while (
      prediction.status !== 'succeeded' && 
      prediction.status !== 'failed' && 
      prediction.status !== 'canceled' &&
      attempts < maxAttempts
    ) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const checkResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: {
            'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          }
        }
      );
      
      if (!checkResponse.ok) {
        console.error('Failed to check prediction status');
        throw new Error('Failed to check prediction status');
      }
      
      prediction = await checkResponse.json();
      attempts++;
      
      if (attempts % 5 === 0) {
        console.log(`⏳ Traitement... (${attempts * 2}s) - Status: ${prediction.status}`);
      }
    }

    if (prediction.status === 'failed') {
      console.error('Prediction failed:', prediction.error);
      throw new Error(`Enhancement failed: ${prediction.error || 'Unknown error'}`);
    }

    if (prediction.status === 'canceled') {
      throw new Error('Enhancement was canceled');
    }

    if (prediction.status !== 'succeeded') {
      throw new Error('Timeout: Le traitement a pris trop de temps (>2min)');
    }

    const enhancedUrl = Array.isArray(prediction.output) 
      ? prediction.output[0] 
      : prediction.output;

    if (!enhancedUrl) {
      throw new Error('No output image received from Replicate');
    }

    console.log('✅ Image améliorée générée:', enhancedUrl);

    return res.status(200).json({
      success: true,
      output: enhancedUrl,
      prompt: enhancementPrompt
    });

  } catch (error) {
    console.error('❌ Erreur complète:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
