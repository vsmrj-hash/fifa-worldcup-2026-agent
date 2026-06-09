'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

let client;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `You are a viral YouTube script writer specializing in FIFA and soccer. It is 2026 and the FIFA World Cup is happening across the USA, Canada, and Mexico (June 11 â July 19). 48 teams, 104 matches, MetLife Stadium hosting the Final.

Your scripts are high-energy, punchy, opinionated, and built to maximize watch time.

RESPOND ONLY WITH VALID JSON matching this exact schema â fences, no extra text:
{
  "title": "string (YouTube title, â¤100 chars, include emoji, SEO keywords)",
  "description": "string (3-paragraph YouTube description; para 3 = #hashtags)",
  "tags": ["string"],
  "format": "short | long",
  "scenes": [
    {
      "id": 1,
      "text": "string (spoken narration for this scene)",
      "visualDescription": "string (what the viewer should see)",
      "searchQuery": "string (2-4 word query to find royalty-free footage)",
      "duration": 8
    }
  ],
  "totalDuration": 60
}

FORMATS:
- "short": 60-90s total, 6-10 scenes, ~10s each. Use for breaking news, hot takes, reaction videos.
- "long": 420-600s total, 30-40 scenes, ~15s each. Use for team analysis, top-5 lists, tactical deep dives.

STRUCTURE (both formats):
1. HOOK â shocking stat, controversial question, or cliffhanger (first 5 seconds)
2. CONTEXT â why this matters right now
3. DEEP DIVE â the meat (facts, analysis, drama)
4. HOT TAKE â your controversial personal opinion
5. CTA â "Comment below", "Subscribe for daily World Cup coverage"

VOICE: Direct, excited, opinionated. Channel energy of a passionate soccer fan who also knows their stats.`;

async function generateScript(articles, formatHint = 'auto') {
  console.log('[scriptWriter] Calling Claude to generate video script...');

  const newsContext = articles
    .slice(0, 5)
    .map((a, i) => `STORY ${i + 1} [${a.source}]: ${a.title}\n${a.summary}`)
    .join('\n\n---\n\n');

  const formatInstruction =
    formatHint === 'short' ? 'Use format "short" (60-90 seconds).' :
    formatHint === 'long' ? 'Use format "long" (7-10 minutes).' :
    'Choose the best format: "short" for news/reactions, "long" for analysis.';

  const message = await getClient().messages.create({
    model: config.CLAUDE_MODEL || 'claude-opus-4-8',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Here are today's top FIFA/soccer stories:\n\n${newsContext}\n\n${formatInstruction}\n\nWrite a script for the most compelling angle. Make fans NEED to watch this.`,
    }],
  });

  const raw = message.content[0].text;

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Script writer returned non-JSON: ${raw.slice(0, 200)}`);

  const script = JSON.parse(jsonMatch[0]);

  if (!script.scenes?.length) throw new Error('Script has no scenes');
  if (!script.title) throw new Error('Script has no title');

  console.log(`[scriptWriter] "${script.title}" â  ${script.format}, ${script.scenes.length} scenes, ${script.totalDuration}s`);
  return script;
}

module.exports = { generateScript };
