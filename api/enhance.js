export default async function handler(req, res) {
  // CORS headers
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

    console.log('🔍 Étape 1: Analyse avec GPT-4 Vision...');

    // ÉTAPE 1: Analyse avec GPT-4 Vision
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
                text: `Tu es un expert en photographie immobilière. Analyse cette photo et identifie précisément les problèmes visuels.

Réponds UNIQUEMENT avec les éléments à améliorer, sous ce format :
- Type de pièce : [bedroom/living/kitchen/bathroom/exterior]
- Problèmes luminosité : [trop sombre/trop claire/normal]
- Problèmes couleurs : [terne/saturé/délavé/normal]
- Problèmes netteté : [flou/net/normal]
- Autres défauts : [liste les défauts visibles]

Sois concret et précis.`
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
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!analysisResponse.ok) {
      const errorData = await analysisResponse.json();
      console.error('GPT-4 Vision error:', errorData);
      throw new Error(`Analyse GPT-4 Vision failed: ${errorData.error?.message || 'Unknown error'}`);
    }

    const analysisData = await analysisResponse.json();
    const analysis = analysisData.choices[0].message.content;
    
    console.log('✅ Analyse GPT-4 Vision:', analysis);

    // ÉTAPE 2: Créer le prompt d'amélioration DALL-E 3
    const enhancementPrompt = createDALLEPrompt(analysis);
    
    console.log('🎨 Prompt DALL-E 3:', enhancementPrompt);

    // ÉTAPE 3: Générer avec DALL-E 3
    console.log('🎨 Génération avec DALL-E 3...');
    
    const dalleResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: enhancementPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd',
        style: 'natural'
      })
    });

    if (!dalleResponse.ok) {
      const errorData = await dalleResponse.json();
      console.error('DALL-E 3 error:', errorData);
      throw new Error(`DALL-E 3 failed: ${errorData.error?.message || 'Unknown error'}`);
    }

    const dalleData = await dalleResponse.json();
    const enhancedImageUrl = dalleData.data[0].url;

    console.log('✅ Image améliorée générée:', enhancedImageUrl);

    // Retourner le résultat
    return res.status(200).json({
      success: true,
      output: enhancedImageUrl,
      analysis: analysis,
      prompt: enhancementPrompt
    });

  } catch (error) {
    console.error('❌ Error in enhance API:', error);
    return res.status(500).json({ 
      error: error.message,
      details: error.stack
    });
  }
}

/**
 * Crée un prompt DALL-E 3 optimisé basé sur l'analyse
 */
function createDALLEPrompt(analysis) {
  let prompt = "Professional high-end real estate photography: ";

  // Détecter le type de pièce
  if (analysis.includes('bedroom')) {
    prompt += "bright and inviting bedroom interior, ";
  } else if (analysis.includes('living')) {
    prompt += "spacious and welcoming living room, ";
  } else if (analysis.includes('kitchen')) {
    prompt += "modern and clean kitchen space, ";
  } else if (analysis.includes('bathroom')) {
    prompt += "pristine and bright bathroom, ";
  } else if (analysis.includes('exterior')) {
    prompt += "attractive property exterior view, ";
  } else {
    prompt += "well-presented interior space, ";
  }

  // Corrections de luminosité
  if (analysis.includes('sombre') || analysis.includes('dark')) {
    prompt += "perfectly lit with abundant natural light, bright and airy atmosphere, ";
  } else if (analysis.includes('claire') || analysis.includes('bright')) {
    prompt += "balanced natural lighting, well-exposed, ";
  }

  // Corrections de couleurs
  if (analysis.includes('terne') || analysis.includes('dull') || analysis.includes('délavé')) {
    prompt += "vibrant and appealing colors, warm and inviting tones, ";
  } else if (analysis.includes('saturé')) {
    prompt += "natural and balanced color palette, ";
  }

  // Corrections de netteté
  if (analysis.includes('flou') || analysis.includes('blur')) {
    prompt += "crystal clear details, sharp focus, ";
  }

  // Qualités professionnelles
  prompt += "professional real estate photography, HDR quality, wide-angle perspective, ";
  prompt += "magazine-worthy composition, pristine condition, ";
  prompt += "attractive to potential buyers, real estate marketing photo, ";
  prompt += "high-resolution architectural photography, perfectly staged and presented.";

  return prompt;
}
