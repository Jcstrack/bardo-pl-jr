export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="brand">
        <span className="brand-symbol">
          <img src="/favicon.svg?v=2" alt="" width="28" height="28" />
        </span>
        <span>
          Bardo Politanense<span className="brand-dot">.</span>
        </span>
      </div>
      <div className="header-side">
        <span className="header-label">BIBLIOTECA COMPARTIDA</span>
      </div>
    </header>
  );
}
