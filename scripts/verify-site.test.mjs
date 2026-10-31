import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';
import { verifySite } from './verify-site.mjs';

const temporaryDirectories = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true });
});

function fixture(origin = 'https://showme.codes', preview = false) {
  const directory = mkdtempSync(join(tmpdir(), 'showme-url-validation-'));
  temporaryDirectories.push(directory);
  const write = (path, content) => {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), content);
  };
  const html = `<html><head><link rel=canonical href=${origin}/><meta name=robots content="${preview ? 'noindex, nofollow' : 'index, follow'}"><meta property=og:url content=${origin}/></head></html>`;
  for (const path of ['index.html', 'search/index.html', 'en/index.html', 'zh-cn/index.html', 'about-me/index.html', 'tags/index.html', '404.html']) write(path, html);
  write('sitemap.xml', `<urlset><url><loc>${origin}/</loc></url></urlset>`);
  write('robots.txt', `User-agent: *\nDisallow: ${preview ? '/' : ''}\nSitemap: ${origin}/sitemap.xml\n`);
  write('index.xml', `<rss><channel><link>${origin}/</link></channel></rss>`);
  write('index.json', '[]');
  write('ads.txt', 'publisher');
  const options = { directory, baseURL: `${origin}/`, baseline: ['https://showme.codes/'] };
  return { directory, write, html, options };
}

test('accepts production output and an encoded Chinese published URL', () => {
  const site = fixture();
  const url = 'https://showme.codes/zh-cn/%E4%B8%AD%E6%96%87/';
  site.options.baseline.push(url);
  site.write('sitemap.xml', `<urlset><url><loc>https://showme.codes/</loc></url><url><loc>${url}</loc></url></urlset>`);
  site.write('zh-cn/中文/index.html', site.html.replaceAll('https://showme.codes/', url));
  assert.equal(verifySite(site.options).preservedURLs, 2);
});

test('rejects a removed published URL', () => {
  const site = fixture();
  site.options.baseline.push('https://showme.codes/old-post/');
  assert.throws(() => verifySite(site.options), /Published URL disappeared/);
});

test('rejects a changed canonical path even on the same domain', () => {
  const site = fixture();
  site.write('index.html', site.html.replace('href=https://showme.codes/', 'href=https://showme.codes/renamed/'));
  assert.throws(() => verifySite(site.options), /Canonical differs/);
});

test('rejects noindex on a published production page', () => {
  const site = fixture();
  site.write('index.html', site.html.replace('index, follow', 'noindex, nofollow'));
  assert.throws(() => verifySite(site.options), /Incorrect indexing policy/);
});

test('requires noindex and a disallowed robots policy for the preview', () => {
  const site = fixture('https://zacker330.github.io', true);
  assert.equal(verifySite(site.options).mode, 'preview (noindex)');
  site.write('robots.txt', 'User-agent: *\nDisallow:\nSitemap: https://zacker330.github.io/sitemap.xml\n');
  assert.throws(() => verifySite(site.options), /robots.txt indexing policy/);
});

test('rejects an indexable page outside the preview sitemap', () => {
  const site = fixture('https://zacker330.github.io', true);
  site.write('search/index.html', site.html.replace('noindex, nofollow', 'index, follow'));
  assert.throws(() => verifySite(site.options), /Preview page is indexable/);
});

test('accepts a historical alias and rejects a changed target', () => {
  const site = fixture();
  site.write('legacy/index.html', '<link rel=canonical href=https://showme.codes/><meta http-equiv=refresh content="0; url=https://showme.codes/">');
  assert.equal(verifySite(site.options).aliases, 1);
  site.write('legacy/index.html', '<link rel=canonical href=https://showme.codes/><meta http-equiv=refresh content="0; url=https://other.example/">');
  assert.throws(() => verifySite(site.options), /Alias target differs/);
});

test('rejects a repository prefix in the deployment URL', () => {
  const site = fixture();
  site.options.baseURL = 'https://showme.codes/zacker330.github.io/';
  assert.throws(() => verifySite(site.options), /Unexpected base URL/);
});

test('rejects Open Graph pointing at a different URL', () => {
  const site = fixture();
  site.write('index.html', site.html.replace('property=og:url content=https://showme.codes/', 'property=og:url content=https://zacker330.github.io/'));
  assert.throws(() => verifySite(site.options), /Open Graph URL differs/);
});

test('checks feed URLs without rejecting historical links in article text', () => {
  const site = fixture('https://zacker330.github.io', true);
  site.write('index.xml', '<rss><channel><link>https://zacker330.github.io/</link><description>https://showme.codes/an-old-reference/</description></channel></rss>');
  verifySite(site.options);
  site.write('index.xml', readFileSync(join(site.directory, 'index.xml'), 'utf8').replace('<link>https://zacker330.github.io/', '<link>https://showme.codes/'));
  assert.throws(() => verifySite(site.options), /RSS contains links/);
});
