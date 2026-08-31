import { beforeEach, describe, expect, it } from 'vitest';
import { ENGINES } from '../engines';
import {
  collectCandidates,
  extractFacts,
  findOverlayThumbnails,
  findTile,
  imageFacts,
  looksLikeContainer,
  sourceKeys,
} from './collect';

function mount(html: string): HTMLElement {
  document.body.innerHTML = `<div id="results">${html}</div>`;
  return document.getElementById('results')!;
}

const result = (host: string, title: string) =>
  `<div class="snippet" data-type="web"><a href="https://${host}/page">${title}</a></div>`;

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('collectCandidates', () => {
  it('collapses overlapping selectors onto one element per result', () => {
    const root = mount(result('a.com', 'first') + result('b.com', 'second'));
    const found = collectCandidates(root, ['.snippet[data-type]', '.snippet', '#results > div']);
    expect(found).toHaveLength(2);
    expect(found.every((el) => el.classList.contains('snippet'))).toBe(true);
  });

  it('drops a wrapper that holds several results in favour of the results', () => {
    const root = mount(
      `<div class="group">${result('a.com', 'first')}${result('b.com', 'second')}${result('c.com', 'third')}</div>`,
    );
    const found = collectCandidates(root, ['#results > div', '.snippet']);
    expect(found).toHaveLength(3);
    expect(found.some((el) => el.classList.contains('group'))).toBe(false);
  });

  it('keeps the outermost element when a wrapper holds a single result', () => {
    const root = mount(`<div class="wrap">${result('a.com', 'only')}</div>`);
    const found = collectCandidates(root, ['#results > div', '.snippet']);
    expect(found).toHaveLength(1);
    expect(found[0].className).toBe('wrap');
  });

  it('ignores decorative nodes with no link and no image', () => {
    const root = mount(`<div class="snippet">just text</div>${result('a.com', 'real')}`);
    expect(collectCandidates(root, ['.snippet'])).toHaveLength(1);
  });

  it('survives an unsupported selector instead of skipping the whole pass', () => {
    const root = mount(result('a.com', 'first'));
    expect(collectCandidates(root, ['::nonsense((', '.snippet'])).toHaveLength(1);
  });
});

describe('extractFacts', () => {
  it('lowercases text, collects hosts, and folds in image alt text', () => {
    mount(
      `<div class="snippet"><a href="https://Example.com/Path">The Headline</a>` +
        `<img src="x.png" alt="Chart Of Prices"></div>`,
    );
    const facts = extractFacts(document.querySelector('.snippet')!);
    expect(facts.hosts).toEqual(['example.com']);
    expect(facts.text).toContain('the headline');
    expect(facts.text).toContain('chart of prices');
  });

  it('unwraps the Google /url redirector to the real destination', () => {
    mount(`<div class="snippet"><a href="/url?q=https%3A%2F%2Fpinterest.com%2Fpin">pin</a></div>`);
    const facts = extractFacts(document.querySelector('.snippet')!);
    expect(facts.hosts).toEqual(['pinterest.com']);
  });

  it('skips anchors that do not go anywhere', () => {
    mount(`<div class="snippet"><a href="#top">jump</a><a href="javascript:void(0)">x</a></div>`);
    expect(extractFacts(document.querySelector('.snippet')!).hosts).toEqual([]);
  });
});

describe('image tiles', () => {
  const img = () => document.querySelector('img')!;

  it('picks up a source URL held in a data attribute instead of an href', () => {
    mount(`<div class="image-wrapper" data-url="https://pinterest.com/pin/1"><img src="https://cdn.x/t.jpg"></div>`);
    const facts = extractFacts(document.querySelector('.image-wrapper')!);
    expect(facts.hosts).toContain('pinterest.com');
  });

  it('prefers the page hosting the image over the image file on Google', () => {
    mount(
      `<div class="snippet"><a href="/imgres?imgurl=https%3A%2F%2Fcdn.net%2Fa.jpg&imgrefurl=https%3A%2F%2Fpinterest.com%2Fpin">t</a></div>`,
    );
    expect(extractFacts(document.querySelector('.snippet')!).hosts).toEqual(['pinterest.com']);
  });

  it('matches a lone image on its own src, alt and enclosing link', () => {
    mount(`<a href="https://pinterest.com/pin/2"><img src="https://cdn.example.com/x.jpg" alt="A Recipe"></a>`);
    const facts = imageFacts(img());
    expect(facts.hosts).toEqual(expect.arrayContaining(['cdn.example.com', 'pinterest.com']));
    expect(facts.text).toContain('a recipe');
  });

  it('reads a lazy-loaded source that has not been promoted to src yet', () => {
    mount(`<img src="data:image/gif;base64,R0lGOD" data-src="https://pinterest.com/img.jpg" alt="">`);
    expect(imageFacts(img()).hosts).toEqual(['pinterest.com']);
  });

  it('does not climb past the tile into neighbouring results', () => {
    mount(
      `<div id="grid"><span>unrelated sibling text</span>` +
        `<a href="https://a.com/1"><img src="https://a.com/1.jpg" alt="one"></a></div>`,
    );
    expect(imageFacts(img()).text).not.toContain('unrelated sibling text');
  });
});

describe('Brave image tiles', () => {
  const brave = ENGINES.find((engine) => engine.id === 'brave')!;

  // Shape taken from live Brave markup: a <button> with no anchor anywhere,
  // carrying the thumbnail, the caption and the source name.
  const tile = (index: number, caption: string, source: string) =>
    `<button class="image-result svelte-1qhxjcj" data-sveltekit-reload="true" data-index="${index}"` +
    ` style="--width: 500; --height: 500;">` +
    `<img src="https://imgs.search.brave.com/${index}.jpg" alt="${caption}">` +
    `<div class="meta"><span>${caption}</span><span>${source}</span></div></button>`;

  it('treats each button as one whole result', () => {
    const root = mount(tile(0, 'First picture', 'pinterest.com') + tile(1, 'Second', 'other.com'));
    const found = collectCandidates(root, brave.selectors.images);
    expect(found).toHaveLength(2);
    expect(found.every((el) => el.tagName === 'BUTTON')).toBe(true);
  });

  it('also treats the preview filmstrip buttons as results', () => {
    // Live markup: <button type="button" class="images-grid-image svelte-8d2983 selected">
    const root = mount(
      `<div class="preview">` +
        `<button type="button" class="images-grid-image svelte-8d2983 selected">` +
        `<img src="https://imgs.search.brave.com/a.jpg" alt="First"></button>` +
        `<button type="button" class="images-grid-image svelte-8d2983">` +
        `<img src="https://imgs.search.brave.com/b.jpg" alt="Second"></button></div>`,
    );
    const found = collectCandidates(root, brave.selectors.images);
    expect(found).toHaveLength(2);
    expect(found.every((el) => el.classList.contains('images-grid-image'))).toBe(true);
  });

  it('recognises the same picture shown again at a different size', () => {
    mount(
      `<img src="https://imgs.search.brave.com/rs:fit:200:200/9f8a7b6c5d4e3f2a1b0c">` +
        `<img src="https://imgs.search.brave.com/rs:fit:64:64/9f8a7b6c5d4e3f2a1b0c">`,
    );
    const [grid, strip] = [...document.querySelectorAll('img')];
    const shared = sourceKeys(grid).filter((key) => sourceKeys(strip).includes(key));
    // The URLs differ by size, so the trailing hash is what ties them together.
    expect(shared).toEqual(['9f8a7b6c5d4e3f2a1b0c']);
  });

  it('does not treat a short path segment as an identifier', () => {
    mount(`<img src="https://example.com/a.jpg"><img src="https://other.com/a.jpg">`);
    const [one, two] = [...document.querySelectorAll('img')];
    expect(sourceKeys(one).some((key) => sourceKeys(two).includes(key))).toBe(false);
  });

  it('ignores inline data images, which are not identifiers at all', () => {
    mount(`<img src="data:image/gif;base64,R0lGOD">`);
    expect(sourceKeys(document.querySelector('img')!)).toEqual([]);
  });

  it('names the filmstrip so it can be removed wholesale', () => {
    expect(brave.previewStrip.length).toBeGreaterThan(0);
  });

  // Regression: the grid and the preview share a component class, and hiding
  // grid tiles left clean results visible but unclickable.
  it('never treats a grid tile as an overlay thumbnail', () => {
    mount(
      `<button class="images-grid-image"><img src="https://x/1.jpg" alt="robotics"></button>` +
        `<button class="images-grid-image selected"><img src="https://x/2.jpg" alt="robotics"></button>`,
    );
    expect(findOverlayThumbnails(brave.previewStrip, brave.gate)).toEqual([]);
  });

  it('picks up the same component when it sits outside the results container', () => {
    mount('');
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div class="preview-overlay">` +
        `<button class="images-grid-image"><img src="https://x/3.jpg"></button>` +
        `<button class="images-grid-image"><img src="https://x/4.jpg"></button></div>`,
    );
    const found = findOverlayThumbnails(brave.previewStrip, brave.gate);
    expect(found).toHaveLength(2);
    expect(found.every((el) => el.closest('#results') === null)).toBe(true);
  });

  it('scans the whole page on image tabs, where the preview mounts', () => {
    expect(brave.scanWholePage).toContain('images');
    expect(brave.scanWholePage).not.toContain('all');
  });

  it('carries the caption and source out of a tile that never links anywhere', () => {
    const root = mount(tile(0, 'A cake recipe', 'pinterest.com'));
    const facts = extractFacts(root.querySelector('button')!);
    expect(facts.text).toContain('a cake recipe');
    // No anchors at all, so the visible source name is the only host signal.
    expect(facts.hosts).toContain('pinterest.com');
  });

  it('does not run adjacent elements together into words that were never there', () => {
    const root = mount(`<div class="snippet"><span>recipe</span><span>pinterest.com</span></div>`);
    const facts = extractFacts(root.querySelector('.snippet')!);
    expect(facts.text).toBe('recipe pinterest.com');
    expect(facts.hosts).toEqual(['pinterest.com']);
  });

  it('does not mistake a filename in the text for a source domain', () => {
    const root = mount(`<div class="snippet"><img src="/x.png" alt="see holiday-photo.jpg"></div>`);
    expect(extractFacts(root.querySelector('.snippet')!).hosts).toEqual([]);
  });

  it('ignores text domains when the result actually links somewhere', () => {
    const root = mount(
      `<div class="snippet"><a href="https://good.com/p">mentions pinterest.com in the snippet</a></div>`,
    );
    expect(extractFacts(root.querySelector('.snippet')!).hosts).toEqual(['good.com']);
  });
});

describe('findTile', () => {
  const tile = (host: string, caption: string) =>
    `<figure class="tile"><a href="https://${host}/p"><img src="https://${host}/t.jpg"></a>` +
    `<figcaption>${caption}</figcaption><a class="src" href="https://${host}">${host}</a></figure>`;

  it('climbs from the image to the element holding its caption and source link', () => {
    const root = mount(tile('pinterest.com', 'A description'));
    const found = findTile(document.querySelector('img')!, root);
    expect(found.tagName).toBe('FIGURE');
    expect(found.textContent).toContain('A description');
    expect(found.textContent).toContain('pinterest.com');
  });

  it('stops before an ancestor that would take neighbouring tiles with it', () => {
    const root = mount(`<div class="grid">${tile('a.com', 'one')}${tile('b.com', 'two')}</div>`);
    const found = findTile(document.querySelector('img')!, root);
    expect(found.className).toBe('tile');
    expect(found.textContent).not.toContain('two');
  });

  it('never climbs past the results root', () => {
    const root = mount(`<img src="https://a.com/1.jpg">`);
    const found = findTile(document.querySelector('img')!, root);
    expect(found.tagName).toBe('IMG');
  });

  it('stops at an ancestor spanning too many hosts even with one image', () => {
    const links = ['a', 'b', 'c', 'd', 'e', 'f']
      .map((h) => `<a href="https://${h}.com">${h}</a>`)
      .join('');
    const root = mount(`<div class="rail">${links}<figure><img src="https://a.com/1.jpg"></figure></div>`);
    const found = findTile(document.querySelector('img')!, root);
    expect(found.tagName).toBe('FIGURE');
  });
});

describe('looksLikeContainer', () => {
  it('rejects an element spanning many distinct hosts', () => {
    const hosts = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com', 'f.com'];
    expect(looksLikeContainer({ text: '', hosts, urls: [] })).toBe(true);
  });

  it('accepts a normal result with deep links to the same site', () => {
    const hosts = ['example.com', 'example.com', 'example.com', 'cdn.example.com'];
    expect(looksLikeContainer({ text: '', hosts, urls: [] })).toBe(false);
  });
});
