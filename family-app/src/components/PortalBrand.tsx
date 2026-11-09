import { Lighthouse } from 'lucide-react';

/** Matches the AYYY portal identity; always returns to the main portal. */
export function PortalBrand() {
  return (
    <a className="ayyy-brand" href="../#home" target="_top"
       aria-label="AYYY, главная портала" title="Вернуться на главную AYYY">
      <span className="ayyy-brand-mark" aria-hidden="true">
        <Lighthouse size={23} strokeWidth={1.9} />
      </span>
      <span className="ayyy-brand-name">ayyy<span className="ayyy-brand-dot">.</span></span>
    </a>
  );
}
