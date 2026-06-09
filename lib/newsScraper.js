'use strict';

const RSSParser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');

const parser = new RSSParser({
  timeout: 12000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FIFAContentBot/1.0)' },
});

// Free public RSS feeds â no API key needed
const RSS_SOURCES = [
  { name: 'BBC Sport Football', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
  { name: 'The Guardian Football', url: 'https://www.theguardian.com/football/rss' },
  { name: 'Sky Sports Football', url: 'https://www.skysports.com/rss/12040' },
  { name: 'ESPN Soccer', url: 'https://www.espn.com/espn/rss/soccer/news' },
  { name: 'Goal.com', url: 'https://www.goal.com/en/news/feed' },
  { name: 'FIFA News', url: 'https://www.fifa.com/rss-feeds/news/en.rss' },
  { name: 'UEFA', url: 'https://www.uefa.com/rssfeed/news/index.xml' },
];

// Live web-scrape targets (no key required)
const SCRAPE_SOURCES = [
  {
    name: 'Google News Soccer',
    url: 'https://news.google.com/rss/search?q=FIFA+World+Cup+2026+soccer&hl=en-US&gl=US&ceid=US:en',
    isRSS: true,
  },
  {
    name: 'Google News Football',
    url: 'https://news.google.com/rss/search?q=FIFA+soccer+football+2026&hl=en-US&gl=US&ceid=US:en',
    isRSS: true,
  },
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

async function scrapeWebPage(source) {
  try {
    const res = await axios.get(source.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FIFAContentBot/1.0)' },
      timeout: 12000,
    });

    // Google News returns RSS XML even via direct fetch
    if (source.isRSS) {
      const feed = await parser.parseString(res.data);
      return feed.items.map(item => ({
        title: item.title || '',
        summary: item.contentSnippet || item.content || '',
        url: item.link || '',
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        source: source.name,
        image: null,
      }));
    }

    // Generic HTML scrape fallback
    const $ = cheerio.load(res.data);
    const articles = [];
    $('article, .article, [class*="story"], [class*="headline"]').each((_, el) => {
      const title = $(el).find('h1, h2, h3').first().text().trim();
      const summary = $(el).find('p').first().text().trim();
      const url = $(el).find('a').first().attr('href') || '';
      if (title) articles.push({ title, summary, url, pubDate: new Date().toISOString(), source: source.name, image: null });
    });
    return articles;
  } catch (err) {
    console.warn(`[newsScraper] ${source.name} web scrape failed: ${err.message}`);
    return [];
  }
}

async function scrapeNews(maxArticles = 5) {
  console.log('[newsScraper] Fetching from RSS feeds + live web sources...');

  const [rssResults, scrapeResults] = await Promise.all([
    Promise.all(RSS_SOURCES.map(fetchRSSFeed)),
    Promise.all(SCRAPE_SOURCES.map(scrapeWebPage)),
  ]);

  const all = [...rssResults.flat(), ...scrapeResults.flat()];

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
