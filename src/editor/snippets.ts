import { SITE_TEMPLATE_ID } from '../landing';

export interface Snippet {
  label: string;
  hint: string;
  html: string;
}

/** Pieces the landing page fills in itself. */
export const BLOCKS: Snippet[] = [
  {
    label: 'Rotating phrase',
    hint: 'Filled with one of your phrases, changing every twelve seconds',
    html: '<blockquote id="wcb-quote"></blockquote>',
  },
  {
    label: 'Allowed sites (built-in cards)',
    hint: 'Where the built-in site cards go, with the whitelist on',
    html: '<section id="wcb-allowed"></section>',
  },
];

/** Ready-made site templates; each is repeated once per allowed site. */
export const LAYOUTS: Snippet[] = [
  {
    label: 'Image only',
    hint: 'A row of linked images, set per site under Site images',
    html: `<style>
  .wcb-images { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; margin: 40px 0 0; padding: 0; list-style: none; }
  .wcb-images a { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 14px; overflow: hidden; color: inherit; text-decoration: none; }
  .wcb-images img { width: 100%; height: 100%; object-fit: cover; }
  .wcb-images span { display: none; font: 600 24px system-ui, sans-serif; }
  .wcb-images [data-no-image] a { border: 1px solid var(--rule); }
  .wcb-images [data-no-image] img { display: none; }
  .wcb-images [data-no-image] span { display: block; }
</style>
<ul class="wcb-images">
  <template id="${SITE_TEMPLATE_ID}">
    <li><a href="{{url}}" title="{{site}}"><img src="{{image}}" alt="{{site}}"><span>{{initial}}</span></a></li>
  </template>
</ul>`,
  },
  {
    label: 'Image + title',
    hint: 'Tiles with your image above the site name',
    html: `<style>
  .wcb-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; margin: 40px 0 0; padding: 0; list-style: none; }
  .wcb-tiles a { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 8px; border: 1px solid var(--rule); border-radius: 12px; color: inherit; text-decoration: none; font: 13px system-ui, sans-serif; }
  .wcb-tiles a:hover { border-color: var(--ink-soft); }
  .wcb-tiles img { width: 48px; height: 48px; object-fit: contain; }
  .wcb-tiles [data-no-image] img { display: none; }
</style>
<ul class="wcb-tiles">
  <template id="${SITE_TEMPLATE_ID}">
    <li><a href="{{url}}"><img src="{{image}}" alt=""><span>{{site}}</span></a></li>
  </template>
</ul>`,
  },
  {
    label: 'Text links',
    hint: 'A plain list of site names',
    html: `<style>
  .wcb-links { margin: 40px 0 0; padding: 0; list-style: none; font: 14px system-ui, sans-serif; }
  .wcb-links li { margin: 6px 0; }
  .wcb-links a { color: inherit; }
</style>
<ul class="wcb-links">
  <template id="${SITE_TEMPLATE_ID}">
    <li><a href="{{url}}">{{site}}</a></li>
  </template>
</ul>`,
  },
];
