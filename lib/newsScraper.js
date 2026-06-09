'use strict';

/**
 * newsScraper.js â No external APIs. No RSS. No web scraping.
 *
 * Claude generates 5 high-octane FIFA World Cup story angles from its
 * own deep knowledge of the sport: player history, rivalries, stats,
 * iconic moments, tactical narratives, and World Cup 2026 context.
 * Every angle is pre-scored as maximum relevance so the scriptWriter
 * can immediately turn it into a sensational reel.
 */

const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

let client;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  return client;
}

const STORY_GENERATOR_PROMPT = `You are a FIFA World Cup 2026 story editor for a viral YouTube channel.
It is June 2026. The FIFA World Cup is live RIGHT NOW across USA, Canada, and Mexico (June 11 â July 19, 2026).
48 teams, 104 matches. MetLife Stadium hosts the Final.

Draw from your deep knowledge of:
- Every major player's career arc, stats, trophies, rivalries, controversies
- Tactical evolutions, iconic World Cup moments (all editions), upsets, heartbreaks
- Group stage drama, knockout tension, golden boot races
- Generational greatness debates (Messi vs Ronaldo era ending, MbappÃ© rising, Vinicius, Haaland, Bellingham)
- Host nation storylines: USA soccer growth, Mexico curse, Canada's first WC in 36 years
- Underdog nations: Morocco 2022 momentum, Japan discipline, Senegal physicality
- Coaching genius stories, tactical systems, historic records being broken

Generate exactly 5 story angles. Each must be SENSATIONAL â the kind of story that makes someone stop scrolling.
Think: shocking stats, emotional narratives, "nobody is talking about this" angles, generational debates.

RESPOND ONLY WITH VALID JSON â no markdown, no extra text:
[
  {
    "title": "string (the sensational headline)",
    "summary": "string (2-3 sentences of juicy detail Claude knows)",
    "angle": "string (hot_take | deep_dive | breaking_moment | countdown | underdog | legacy)",
    "source": "Claude Knowledge Base",
    "score": 10
  }
]`;

async function scrapeNews(maxArticles = 5) {
  console.log('[newsScraper] Generating story angles from Claude knowledge base...');

  const message = await getClient().messages.create({
    model: config.CLAUDE_MODEL || 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Generate ${maxArticles} sensational FIFA World Cup 2026 story angles right now. Make them feel URGENT and UNMISSABLE. Use your full knowledge of soccer history, current superstars, and World Cup 2026 context. Be bold â hot takes, shocking stats, emotional stories.`,
    }],
    system: STORY_GENERATOR_PROMPT,
  });

  const raw = message.content[0].text;
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`Story generator returned non-JSON: ${raw.slice(0, 200)}`);

  const angles = JSON.parse(jsonMatch[0]);
  console.log(`[newsScraper] Generated ${angles.length} story angles from Claude knowledge`);

  // Normalize to same shape the rest of the pipeline expects
  return angles.slice(0, maxArticles).map(a => ({
    title: a.title,
    summary: a.summary,
    url: '',
    pubDate: new Date().toISOString(),
    source: a.source || 'Claude Knowledge Base',
    angle: a.angle || 'deep_dive',
    score: a.score || 10,
    image: null,
  }));
}

module.exports = { scrapeNews };
