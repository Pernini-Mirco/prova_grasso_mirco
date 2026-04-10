const nbaFallback =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" rx="28" fill="#0f1722"/>
      <rect x="24" y="24" width="192" height="192" rx="22" fill="#1d4ed8"/>
      <path d="M120 54c-26 0-48 21-48 48v36c0 27 22 48 48 48s48-21 48-48v-36c0-27-22-48-48-48z" fill="#f8fafc" opacity=".14"/>
      <text x="120" y="133" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#f8fafc">NBA</text>
    </svg>
  `);

const logoModules = import.meta.glob('../assets/logos/*.{png,jpg,jpeg,svg,webp}', {
  eager: true,
  import: 'default'
});

const logos = Object.fromEntries(
  Object.entries(logoModules).map(([path, assetUrl]) => {
    const filename = path.split('/').pop()?.replace(/\.[^.]+$/, '').toLowerCase();
    return [filename, assetUrl];
  })
);

export function getTeamLogo(abbr) {
  const key = String(abbr || '').toLowerCase();
  return logos[key] || nbaFallback;
}
