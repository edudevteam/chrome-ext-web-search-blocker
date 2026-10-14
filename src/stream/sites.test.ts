import { describe, expect, it } from 'vitest';
import { compileRules } from '../matcher';
import { DEFAULT_SETTINGS } from '../types';
import {
  blockedSearchTarget,
  channelAllowed,
  compileStreamRules,
  matchStream,
  readCard,
  readVideoChannel,
  readWatchPage,
  streamSiteFor,
  videoAwaitingChannel,
} from './sites';

const rules = (channels: string[], keywords: string[] = []) =>
  compileStreamRules({ enabled: true, channels, keywords });

describe('matchStream', () => {
  it('matches a channel ignoring case and spaces', () => {
    expect(matchStream('  V M X Gaming ', '', '', rules(['vmx']))).toBe('channel: vmx');
    expect(matchStream('VMXGaming', '', '', rules(['vmx gaming']))).toBe('channel: vmx gaming');
  });

  it('matches title keywords, and regex rules', () => {
    expect(matchStream('Someone', 'Huge PRANK gone wrong', '', rules([], ['prank']))).toBe('title: prank');
    expect(matchStream('vmx official', '', '', rules(['/^vmx/']))).toBe('channel: /^vmx/');
    expect(matchStream('the vmx', '', '', rules(['/^vmx/']))).toBeNull();
  });

  it('matches keywords in the description', () => {
    expect(
      matchStream('Someone', 'Day 3', 'Watch our biggest Prank yet', rules([], ['prank'])),
    ).toBe('description: prank');
  });

  it('leaves everything else alone', () => {
    expect(matchStream('Veritasium', 'Why the sky is blue', 'Light scattering explained', rules(['vmx'], ['prank']))).toBeNull();
    expect(rules([], []).empty).toBe(true);
  });
});

describe('streamSiteFor', () => {
  it('knows YouTube and nothing else yet', () => {
    expect(streamSiteFor('www.youtube.com')?.id).toBe('youtube');
    expect(streamSiteFor('vimeo.com')).toBeNull();
  });
});

// Trimmed from a real YouTube search page.
const VIDEO = `
<ytd-video-renderer>
  <h3><a id="video-title" title="Shawn Mendes - Treat You Better (Lyrics)">
    <yt-formatted-string>Shawn Mendes - Treat You Better (Lyrics)</yt-formatted-string></a></h3>
  <div id="channel-info">
    <a id="channel-thumbnail" href="/@WatermeIonMusic" aria-label="Go to channel Watermelon Music" hidden></a>
    <div id="attributed-channel-name"><span>Watermelon Music and bemu</span></div>
    <ytd-channel-name hidden><a>Watermelon Music and bemu</a></ytd-channel-name>
  </div>
  <div class="metadata-snippet-container">
    <yt-formatted-string class="metadata-snippet-text">Stream “Treat You Better" by Shawn Mendes: ...</yt-formatted-string>
  </div>
</ytd-video-renderer>`;

const AD = `
<ytd-ad-slot-renderer><yt-lockup-view-model>
  <span class="ytAttributedStringHost ytwFeedAdMetadataViewModelHostTextsStyleCompactHeadline">Bite-sized videos, big learning!</span>
  <span class="ytAttributedStringHost ytwFeedAdMetadataViewModelHostTextsStyleCompactDescription">No ads, no worries! Healthy edutainment videos.</span>
  <div class="ytSpecAvatarShapeHost ytSpecAvatarShapeButton" aria-label="Party Tunes" role="button"></div>
</yt-lockup-view-model></ytd-ad-slot-renderer>`;

describe('readCard', () => {
  const youtube = streamSiteFor('www.youtube.com')!;
  const card = (html: string) => {
    document.body.innerHTML = html;
    return document.body.firstElementChild!;
  };

  it('reads every field of a search result, hidden layouts included', () => {
    const text = readCard(card(VIDEO), youtube);
    expect(text.title).toContain('Treat You Better');
    expect(text.channel).toContain('Watermelon Music and bemu');
    expect(text.channel).toContain('Watermelon Music'); // from the avatar's aria-label
    expect(text.description).toContain('by Shawn Mendes');
  });

  it('reads sponsored results', () => {
    const text = readCard(card(AD), youtube);
    expect(text.title).toContain('Bite-sized videos');
    expect(text.description).toContain('edutainment');
    expect(text.channel).toContain('Party Tunes');
  });

  it('blocks on any of the three fields', () => {
    const video = readCard(card(VIDEO), youtube);
    const check = (channels: string[], keywords: string[]) =>
      matchStream(video.channel, video.title, video.description, rules(channels, keywords));
    expect(check(['watermelonmusic'], [])).toBe('channel: watermelonmusic');
    expect(check([], ['lyrics'])).toBe('title: lyrics');
    expect(check([], ['stream “treat'])).toBe('description: stream “treat');
    expect(check(['vmx'], ['prank'])).toBeNull();
  });
});

describe('blockedSearchTarget', () => {
  const r = rules(['vmx gaming'], ['prank']);
  const target = (href: string) => blockedSearchTarget(new URL(href), r);

  it('sends a blocked YouTube search home', () => {
    expect(target('https://www.youtube.com/results?search_query=funny+PRANK+videos')).toBe(
      'https://www.youtube.com/',
    );
    // Channel rules count too, spaces ignored.
    expect(target('https://www.youtube.com/results?search_query=vmxgaming')).toBe(
      'https://www.youtube.com/',
    );
  });

  it('sends a blocked Vimeo search home', () => {
    expect(target('https://vimeo.com/search?q=prank')).toBe('https://vimeo.com/');
  });

  it('lets other searches and pages through', () => {
    expect(target('https://www.youtube.com/results?search_query=music')).toBeNull();
    expect(target('https://www.youtube.com/watch?v=prank')).toBeNull();
    expect(target('https://www.google.com/search?q=prank')).toBeNull();
    expect(blockedSearchTarget(new URL('https://www.youtube.com/results?search_query=prank'), rules([]))).toBeNull();
  });
});

describe('readWatchPage', () => {
  const youtube = streamSiteFor('www.youtube.com')!;
  const WATCH = `
    <ytd-watch-flexy video-id="_fPh8_phIto">
      <ytd-watch-metadata>
        <div id="title"><h1><yt-formatted-string>Epic Prank Compilation</yt-formatted-string></h1></div>
        <div id="owner">
          <a class="yt-simple-endpoint" href="/@VMXGaming"><yt-img-shadow></yt-img-shadow></a>
          <ytd-channel-name><a href="/@VMXGaming">VMX Gaming</a></ytd-channel-name>
        </div>
        <ytd-text-inline-expander id="description-inline-expander">
          <yt-attributed-string>Subscribe for more reaction videos every week</yt-attributed-string>
        </ytd-text-inline-expander>
      </ytd-watch-metadata>
    </ytd-watch-flexy>`;
  const read = (href: string) => {
    document.body.innerHTML = WATCH;
    return readWatchPage(document, new URL(href), youtube);
  };

  it('reads the video under the player', () => {
    const details = read('https://www.youtube.com/watch?v=_fPh8_phIto');
    expect(details?.title).toContain('Epic Prank Compilation');
    expect(details?.channel).toContain('VMX Gaming');
    expect(details?.description).toContain('reaction videos');
    expect(
      matchStream(details!.channel, details!.title, details!.description, rules([], ['reaction'])),
    ).toBe('description: reaction');
  });

  it('waits while the page still shows the previous video', () => {
    expect(read('https://www.youtube.com/watch?v=someOtherId')).toBeNull();
  });

  it('ignores pages that are not videos', () => {
    expect(read('https://www.youtube.com/results?search_query=prank')).toBeNull();
  });

  it("reads the video's channel address, once the page shows that video", () => {
    document.body.innerHTML = WATCH;
    const channel = (href: string) => readVideoChannel(document, new URL(href), youtube);
    expect(channel('https://www.youtube.com/watch?v=_fPh8_phIto')).toBe('/@VMXGaming');
    expect(channel('https://www.youtube.com/watch?v=someOtherId')).toBeNull();
  });
});

describe('whitelisted channels', () => {
  const youtube = streamSiteFor('www.youtube.com')!;
  const allowing = (allowed: string[], blocked: string[] = []) =>
    compileRules({ ...DEFAULT_SETTINGS, sites: blocked, whitelist: { enabled: true, sites: allowed } });
  const awaiting = (href: string, siteRules: ReturnType<typeof allowing>) =>
    videoAwaitingChannel(new URL(href), siteRules);
  const VIDEO_URL = 'https://www.youtube.com/watch?v=_fPh8_phIto';

  it('leaves a video for the page to judge while a channel is whitelisted', () => {
    expect(awaiting(VIDEO_URL, allowing(['youtube.com/@vmxgaming']))).toBe(true);
    expect(awaiting('https://www.youtube.com/@other', allowing(['youtube.com/@vmxgaming']))).toBe(false);
  });

  it('does not step in where the address alone decides', () => {
    // No YouTube entry, the whole site allowed, the video itself allowed, or the whitelist off.
    expect(awaiting(VIDEO_URL, allowing(['example.com/page']))).toBe(false);
    expect(awaiting(VIDEO_URL, allowing(['youtube.com']))).toBe(false);
    expect(awaiting(VIDEO_URL, allowing(['youtube.com/@x', 'youtube.com/watch?v=_fPh8_phIto']))).toBe(false);
    expect(awaiting(VIDEO_URL, compileRules(DEFAULT_SETTINGS))).toBe(false);
    // The blocked list still wins.
    expect(awaiting(VIDEO_URL, allowing(['youtube.com/@vmxgaming'], ['youtube.com/watch']))).toBe(false);
  });

  it('allows only the whitelisted channels, by handle or id', () => {
    const siteRules = allowing(['youtube.com/@vmxgaming', 'youtube.com/channel/UCabc']);
    expect(channelAllowed('/@VMXGaming', youtube, siteRules)).toBe(true);
    expect(channelAllowed('/channel/UCabc', youtube, siteRules)).toBe(true);
    expect(channelAllowed('/@vmxgamingclips', youtube, siteRules)).toBe(false);
    expect(channelAllowed('/@other', youtube, siteRules)).toBe(false);
  });
});
