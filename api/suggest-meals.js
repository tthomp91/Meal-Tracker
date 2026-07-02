export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { ingredients } = req.body;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: 'Please provide an ingredients array' });
    }

    // Build a consistent cache key by sorting and lowercasing ingredients
    // so "Chicken, Rice" and "rice, chicken" both hit the same cache entry
    const cacheKey = 'meals:' + [...ingredients]
      .map(i => i.toLowerCase().trim())
      .sort()
      .join(',');

    // Check Upstash Redis cache first
    const kvUrl   = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    if (kvUrl && kvToken) {
      try {
        const cacheRes  = await fetch(`${kvUrl}/get/${encodeURIComponent(cacheKey)}`, {
          headers: { Authorization: `Bearer ${kvToken}` }
        });
        const cacheData = await cacheRes.json();

        if (cacheData.result) {
          // Cache hit, return saved meals without calling Anthropic
          const cachedMeals = JSON.parse(cacheData.result);
          return res.status(200).json({ meals: cachedMeals, cached: true });
        }
      } catch (cacheErr) {
        // Cache read failed, just continue to Anthropic
        console.warn('Cache read failed:', cacheErr.message);
      }
    }

    // Cache miss, call Anthropic
    const prompt = `I have these ingredients at home: ${ingredients.join(', ')}.

Suggest 4 meals I can make. Respond ONLY with valid JSON, no extra text, no markdown:
[
  {
    "title": "Meal Name",
    "emoji": "🍗",
    "readyInMinutes": 30,
    "servings": 4,
    "usedIngredients": ["chicken", "garlic"],
    "missingIngredients": ["lemon", "herbs"],
    "description": "One sentence description of the dish."
  }
]`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic API error:', errText);
      return res.status(502).json({ error: 'Meal suggestion service failed' });
    }

    const data  = await anthropicRes.json();
    const text  = data.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const meals = JSON.parse(clean);

    // Save to cache with a 24 hour expiry (86400 seconds)
    if (kvUrl && kvToken) {
      try {
        await fetch(`${kvUrl}/set/${encodeURIComponent(cacheKey)}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${kvToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ value: JSON.stringify(meals), ex: 86400 })
        });
      } catch (cacheErr) {
        // Cache write failed, still return the meals to the user
        console.warn('Cache write failed:', cacheErr.message);
      }
    }

    return res.status(200).json({ meals });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
