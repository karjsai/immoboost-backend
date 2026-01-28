const OpenAI = require('openai');
const sharp = require('sharp');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID
});

module.exports = async (req, res) => {
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

    // Convertir base64 en buffer pour Sharp
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    console.log('Image reçue, taille:', imageBuffer.length, 'bytes');

    // 1. ANALYSE AVEC GPT-4 VISION
    console.log('Analyse GPT-4 Vision en cours...');
    
    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyse cette photo immobilière et fournis UNIQUEMENT un objet JSON (sans markdown, sans backticks) avec cette structure exacte:
{
  "lighting": "dark" ou "normal" ou "bright",
  "room_type": "bedroom" ou "living" ou "kitchen" ou "bathroom" ou "exterior",
  "main_issues": ["problème1", "problème2"],
  "needs_brightness_boost": true ou false,
  "needs_contrast_boost": true ou false,
  "needs_saturation_boost": true ou false,
  "needs_sharpness": true ou false,
  "brightness_adjustment": nombre entre -50 et 50,
  "contrast_adjustment": nombre entre 0.5 et 2.0,
  "saturation_adjustment": nombre entre 0.5 et 2.0
}`
          },
          {
            type: "image_url",
            image_url: { url: image }
          }
        ]
      }],
      max_tokens: 500
    });

    const analysisText = analysisResponse.choices[0].message.content.trim();
    console.log('Réponse GPT-4V brute:', analysisText);

    // Nettoyer la réponse (enlever markdown si présent)
    let cleanAnalysisText = analysisText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let analysis;
    try {
      analysis = JSON.parse(cleanAnalysisText);
    } catch (parseError) {
      console.error('Erreur parsing JSON:', parseError);
      console.error('Texte reçu:', cleanAnalysisText);
      
      // Fallback: stratégie par défaut
      analysis = {
        lighting: "normal",
        room_type: "unknown",
        main_issues: ["unclear analysis"],
        needs_brightness_boost: true,
        needs_contrast_boost: true,
        needs_saturation_boost: true,
        needs_sharpness: true,
        brightness_adjustment: 20,
        contrast_adjustment: 1.2,
        saturation_adjustment: 1.15
      };
    }

    console.log('Analyse finale:', analysis);

    // 2. GÉNÉRER STRATÉGIE D'AMÉLIORATION
    const strategy = generateEnhancementStrategy(analysis);
    console.log('Stratégie générée:', strategy);

    // 3. APPLIQUER LES AMÉLIORATIONS AVEC SHARP
    console.log('Application des améliorations...');
    
    let enhancedBuffer = await sharp(imageBuffer)
      .modulate({
        brightness: strategy.brightness,
        saturation: strategy.saturation
      })
      .linear(strategy.contrast, 0) // Ajustement du contraste
      .sharpen(strategy.sharpen)
      .toBuffer();

    // Convertir en base64 pour le frontend
    const enhancedBase64 = `data:image/jpeg;base64,${enhancedBuffer.toString('base64')}`;

    console.log('Amélioration terminée !');

    // 4. RETOURNER LE RÉSULTAT
    res.status(200).json({
      success: true,
      analysis: analysis,
      strategy: strategy,
      enhanced_image: enhancedBase64
    });

  } catch (error) {
    console.error('Erreur complète:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.stack
    });
  }
};

function generateEnhancementStrategy(analysis) {
  const strategy = {
    brightness: 1.0,
    saturation: 1.0,
    contrast: 1.0,
    sharpen: 0
  };

  // Ajustement de la luminosité
  if (analysis.needs_brightness_boost) {
    // Convertir l'ajustement (-50 à +50) en multiplicateur (0.7 à 1.5)
    const brightnessFactor = 1 + (analysis.brightness_adjustment / 100);
    strategy.brightness = Math.max(0.7, Math.min(1.5, brightnessFactor));
  }

  // Ajustement de la saturation
  if (analysis.needs_saturation_boost) {
    strategy.saturation = Math.max(0.8, Math.min(1.5, analysis.saturation_adjustment));
  }

  // Ajustement du contraste
  if (analysis.needs_contrast_boost) {
    strategy.contrast = Math.max(0.8, Math.min(1.5, analysis.contrast_adjustment));
  }

  // Ajustement de la netteté
  if (analysis.needs_sharpness) {
    strategy.sharpen = 2; // Valeur modérée pour éviter l'over-sharpening
  }

  // Ajustements spécifiques selon le type de pièce
  switch (analysis.room_type) {
    case 'exterior':
      strategy.saturation = Math.min(strategy.saturation * 1.1, 1.5);
      strategy.sharpen = 3;
      break;
    case 'bathroom':
      strategy.brightness = Math.min(strategy.brightness * 1.1, 1.4);
      break;
    case 'kitchen':
      strategy.saturation = Math.min(strategy.saturation * 1.05, 1.3);
      break;
  }

  // Ajustements selon l'éclairage
  if (analysis.lighting === 'dark') {
    strategy.brightness = Math.min(strategy.brightness * 1.2, 1.5);
    strategy.contrast = Math.min(strategy.contrast * 1.1, 1.4);
  } else if (analysis.lighting === 'bright') {
    strategy.brightness = Math.max(strategy.brightness * 0.95, 0.9);
  }

  return strategy;
}
