const ITEMS = [
  'Real-time sync',
  'Optimistic UI',
  'Keyboard-first',
  'Dark & light',
  'Activity log',
  'Attachments',
  'Admin console',
  'Smart sort',
  'Instant search',
];

export function Marquee() {
  const loop = [...ITEMS, ...ITEMS];
  return (
    <div className="border-y border-line bg-surface/40 py-5">
      <div className="mask-fade-x overflow-hidden">
        <div className="marquee-track [--marquee-duration:38s]">
          {loop.map((item, i) => (
            <span key={i} className="flex items-center gap-3 whitespace-nowrap px-7 text-eyebrow">
              <span className="h-1 w-1 rounded-full bg-accent" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
