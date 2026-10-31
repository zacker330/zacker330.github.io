import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const productionOrigin = 'https://showme.codes';
const previewOrigin = 'https://zacker330.github.io';
const baselinePath = new URL('./baselines/published-urls.json', import.meta.url);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function decodeEntities(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) => entities[entity]);
}

function attributes(tag) {
  const result = {};
  const pattern = /([^\s=<>/'"]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/g;
  for (const match of tag.matchAll(pattern)) {
    result[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(([tag]) => attributes(tag));
}

function sitemapURLs(xml) {
  requireCondition(/<urlset\b/.test(xml), 'Expected a sitemap urlset');
  const urls = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => decodeEntities(match[1]));
  requireCondition(urls.length > 0, 'Sitemap is empty');
  requireCondition(new Set(urls).size === urls.length, 'Sitemap contains duplicate URLs');
  return urls;
}

function* files(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

export function verifySite({ directory, baseURL = `${productionOrigin}/`, baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) }) {
  const root = resolve(directory);
  const origin = new URL(baseURL).origin;
  const preview = origin === previewOrigin;
  requireCondition([`${productionOrigin}/`, `${previewOrigin}/`].includes(baseURL), `Unexpected base URL: ${baseURL}`);

  const read = (path) => readFileSync(join(root, path), 'utf8');
  const urls = sitemapURLs(read('sitemap.xml'));
  const publishedURLs = new Set(urls.map((url) => url.replace(`${previewOrigin}/`, `${productionOrigin}/`)));
  for (const url of baseline) {
    requireCondition(publishedURLs.has(url), `Published URL disappeared: ${url}`);
  }

  for (const url of urls) {
    const parsed = new URL(url);
    requireCondition(parsed.origin === origin, `Sitemap has the wrong origin: ${url}`);
    const path = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
    const output = resolve(root, path, ...(parsed.pathname.endsWith('/') ? ['index.html'] : []));
    requireCondition(output.startsWith(`${root}${sep}`), `URL escapes the output directory: ${url}`);
    const html = readFileSync(output, 'utf8');
    const canonical = tags(html, 'link').find((tag) => tag.rel === 'canonical')?.href;
    requireCondition(canonical === url, `Canonical differs from the published URL: ${url} -> ${canonical}`);
    const robots = tags(html, 'meta').find((tag) => tag.name === 'robots')?.content ?? '';
    requireCondition(preview ? /\bnoindex\b/i.test(robots) : /\bindex\b/i.test(robots) && !/\bnoindex\b/i.test(robots), `Incorrect indexing policy: ${url}`);
  }

  let htmlCount = 0;
  let aliases = 0;
  for (const path of files(root)) {
    if (!path.endsWith('.html')) continue;
    htmlCount += 1;
    const html = readFileSync(path, 'utf8');
    const metadata = tags(html, 'meta');
    const canonical = tags(html, 'link').find((tag) => tag.rel === 'canonical')?.href;
    requireCondition(canonical && new URL(canonical).origin === origin, `Incorrect canonical in ${relative(root, path)}`);
    for (const tag of metadata.filter((tag) => tag.property === 'og:url')) {
      requireCondition(tag.content === canonical, `Open Graph URL differs from canonical in ${relative(root, path)}`);
    }
    if (preview) {
      requireCondition(metadata.some((tag) => tag.name === 'robots' && /\bnoindex\b/i.test(tag.content)), `Preview page is indexable: ${relative(root, path)}`);
    }
    for (const tag of metadata.filter((tag) => tag['http-equiv']?.toLowerCase() === 'refresh')) {
      aliases += 1;
      const target = tag.content?.match(/url=(.+)$/i)?.[1];
      requireCondition(target === canonical, `Alias target differs from canonical in ${relative(root, path)}`);
    }
  }

  const robots = read('robots.txt');
  requireCondition(preview ? /^Disallow:[ \t]*\/[ \t]*$/m.test(robots) : !/^Disallow:[ \t]*\S+/m.test(robots), 'Incorrect robots.txt indexing policy');
  requireCondition(robots.includes(`Sitemap: ${origin}/sitemap.xml`), 'robots.txt points to the wrong sitemap');
  const rss = read('index.xml');
  const feedURLs = [...rss.matchAll(/<(link|guid)(?:\s[^>]*)?>([^<]+)<\/\1>/g)].map((match) => decodeEntities(match[2]));
  requireCondition(feedURLs.length > 0, 'RSS has no links to the site');
  requireCondition(feedURLs.every((url) => new URL(url).origin === origin), 'RSS contains links to another origin');
  for (const path of ['index.html', 'index.json', 'search/index.html', 'en/index.html', 'zh-cn/index.html', 'about-me/index.html', 'tags/index.html', '404.html', 'ads.txt']) {
    requireCondition(statSync(join(root, path)).size > 0, `Required output is empty: ${path}`);
  }
  return { mode: preview ? 'preview (noindex)' : 'production', urls: urls.length, html: htmlCount, aliases, preservedURLs: baseline.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = verifySite({ directory: process.argv[2] ?? 'public', baseURL: process.argv[3] ?? `${productionOrigin}/` });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(`Site validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
