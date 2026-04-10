const placeholder =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <rect width="320" height="320" rx="24" fill="#1b2230"/>
      <circle cx="160" cy="118" r="54" fill="#4f5d75"/>
      <path d="M74 270c12-48 48-78 86-78s74 30 86 78" fill="#4f5d75"/>
    </svg>
  `);

const playerModules = import.meta.glob('../assets/players/*.{png,jpg,jpeg,svg,webp}', {
  eager: true,
  import: 'default'
});

const variantPriority = {
  default: ['png', 'jpg', 'jpeg', 'webp', 'svg'],
  compact: ['jpg', 'jpeg', 'png', 'webp', 'svg']
};

const images = Object.entries(playerModules).reduce((map, [path, assetUrl]) => {
  const file = path.split('/').pop() || '';
  const extension = file.split('.').pop()?.toLowerCase() || '';
  const filename = file.replace(/\.[^.]+$/, '').toLowerCase();
  const variants = map.get(filename) || new Map();
  variants.set(extension, assetUrl);
  map.set(filename, variants);

  return map;
}, new Map());

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolvePlayerImage(name, variant = 'default') {
  const variants = images.get(slugify(name));

  if (!variants) {
    return placeholder;
  }

  const priority = variantPriority[variant] || variantPriority.default;

  for (const extension of priority) {
    const asset = variants.get(extension);
    if (asset) {
      return asset;
    }
  }

  return variants.values().next().value || placeholder;
}

export function getPlayerImage(player, variant = 'default') {
  const name = player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim();
  return resolvePlayerImage(name, variant);
}
