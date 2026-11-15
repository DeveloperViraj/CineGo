// Soft decorative glow behind sections (kept subtle so it never tints the page)
const BlurCircle = ({ top = 'auto', left = 'auto', right = 'auto', bottom = 'auto' }) => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -z-10 aspect-square h-72 w-72 rounded-full bg-primary/12 blur-3xl"
      style={{ top, bottom, left, right }}
    />
  );
};

export default BlurCircle;
