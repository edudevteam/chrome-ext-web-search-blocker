/**
 * "v1.0.7 · built Aug 31, 14:32" — shown in the popup and settings page so a
 * reload can be confirmed at a glance. The patch number changes on every
 * `pnpm build`; the timestamp separates builds made in the same minute.
 */
export function buildStamp(): string {
  const version = chrome.runtime.getManifest().version;
  const built = new Date(__BUILD_TIME__);
  if (Number.isNaN(built.getTime())) return `v${version}`;

  const when = built.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `v${version} · built ${when}`;
}
