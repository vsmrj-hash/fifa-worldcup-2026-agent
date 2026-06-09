'use strict';

const RSSParser = require('rss-parser');
const axios = require('axios');
const config = require('../config');

const parser = new RSSParser({
  timeout: 10000,
  headers: { 'User-Agent': 'FIFAContentCreator/1.0 (automated news aggregator)' },
});

const RSS_SOURCES = [
  { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/football/rss' },
  { name: 'Sky Sports', url: 'https://www.skysports.com/rss/12040' },
  { name: 'ESPN Soccer', url: 'https://www.espn.com/espn/rss/soccer/news' },
  { name: 'Goal.com', url: 'https://www.goal.com/en/news/feed' },
];

const FIFA_KEYWORDS = [
  'fifa', 'world cup', 'worldcup', '2026', 'qualifier', 'qualifying',
  'messi', 'ronaldo', 'mbappe', 'haaland', 'neymar', 'vinicius', 'bellingham',
  'argentina', 'brazil', 'france', 'germany', 'england', 'spain', 'portugal',
  'usa', 'mexico', 'canada', 'morocco', 'japan', 'senegal',
  'champions league', 'transfer', 'ballon', 'copa america', 'euros',
  'premier league', 'la liga', 'bundesliga', 'serie a', 'ligue 1',
  'soccer', 'football',
];

function scoreArticle(article) {
  const titleLower = article.title.toLowerCase();
  const bodyLower = (article.summary || '').toLowerCase();
  let score = 0;

  for (const kw of FIFA_KEYWORDS) {
    if (titleLower.includes(kw)) {
      score += kw === 'world cup' || kw === 'fifa' || kw === '2026' ? 4 : 2;
    } else if (bodyLower.includes(kw)) {
      score += 1;
    }
  }

  const ageHours = (Date.now() - new Date(article.pubDate || 0).getTime()) / 3_600_000;
  if (ageHours < 6) score += 3;
  else if (ageHours < 24) score += 1;

  return score;
}

async function fetchRSSFeed(source) {
  try {
    const feed = await parser.parseURL(source.url);
    return feed.items.map(item => ({
      title: item.title || '',
      summary: item.contentSnippet || item.content || '',
      url: item.link || '',
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      source: source.name,
      image: item.enclosure?.url || null,
    }));
  } catch (err) {
    console.warn(`[newsScraper] ${source.name} RSS failed: ${err.message}`);
    return [];
  }
}

async function fetchNewsAPI() {
  if (!config.NEWS_API_KEY) return [];
  try {
    const res = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: 'FIFA World Cup 2026 soccer football',
        sortBy: 'publishedAt',
        language: 'en',
        pageSize: 20,
        apiKey: config.NEWS_API_KEY,
      },
      timeout: 10000,
    });
    return (res.data.articles || []).map(a => ({
      title: a.title || '',
      summary: a.description || '',
      url: a.url || '',
      pubDate: a.publishedAt || new Date().toISOString(),
      source: a.source?.name || 'NewsAPI',
      image: a.urlToImage || null,
    }));
  } catch (err) {
    console.warn(`[newsScraper] NewsAPI failed: ${err.message}`);
    return [];
  }
}

async function scrapeNews(maxArticles = 5) {
  console.log('[newsScraper] Fetching from RSS feeds + NewsAPI...');

  const [rssArrays, newsApiArticles] = await Promise.all([
    Promise.all(RSS_SOURCES.map(fetchRSSFeed)),
    fetchNewsAPI(),
  ]);

  const all = [...rssArrays.flat(), ...newsApiArticles];

  const seen = new Set();
  const unique = all.filter(a => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  const scored = unique
    .map(a => ({ ...a, score: scoreArticle(a) }))
    .filter(a => a.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, maxArticles);
  console.log(`[newsScraper] ${unique.length} unique articles â selected top ${top.length}`);
  return top;
}

module.exports = { scrapeNews };
