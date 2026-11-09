/** AYYY portal's lighthouse mark and brand link. */
export function PortalBrand() {
  return (
    <a className="ayyy-brand" href="../#home" target="_top"
      aria-label="AYYY, главная портала" title="Вернуться на главную AYYY">
      <span className="ayyy-brand-mark" aria-hidden="true">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 9h4l3 13H7L10 9Z M8 6l4-4 4 4 M9 6h6v3H9V6Z M4 7 1 5 M20 7l3-2 M9 15h6 M6 22h12" />
        </svg>
      </span>
      <span className="ayyy-brand-name">ayyy<span className="ayyy-brand-dot">.</span></span>
    </a>
  );
}
