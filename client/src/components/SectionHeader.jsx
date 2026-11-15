import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

// Consistent heading for home-page sections: small eyebrow, big title, optional link/actions.
const SectionHeader = ({ eyebrow, title, to, linkLabel = 'View all', children }) => (
  <div className="flex items-end justify-between gap-4">
    <div>
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-dull">{eyebrow}</p>}
      <h2 className="mt-1.5 text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
    </div>
    <div className="flex items-center gap-2">
      {children}
      {to && (
        <Link to={to} className="group flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-gray-300 hover:text-white">
          {linkLabel}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  </div>
);

export default SectionHeader;
