export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ministries } = req.body;
  if (!ministries || !ministries.length) return res.status(400).json({ error: 'No ministries provided' });

  const prompt = `Si expert na európske fondy a slovenské ministerstvá. Použi web search a vyhľadaj AKTUÁLNE výzvy na čerpanie prostriedkov z EÚ fondov na týchto stránkach slovenských ministerstiev:\n\n${ministries.map(m => `- ${m.name}: ${m.url}`).join('\n')}\n\nVráť výsledky VÝHRADNE ako JSON pole bez akéhokoľvek iného textu. Každý objekt:\n{"title":"Názov výzvy","ministry":"Skrátený názov ministerstva","summary":"2-3 vety o výzve","deadline":"Termín alebo null","amount":"Výška pomoci alebo null","fund":"Názov fondu","url":"URL alebo null"}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'API error' });

    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const match = clean.match(/\[[\s\S]*\]/);
    const vyzvy = match ? JSON.parse(match[0]) : [];

    return res.status(200).json({ vyzvy });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
