import Icon from '../components/ui/Icon.jsx';

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="brand">
        <span className="brand-symbol">
          <Icon name="music" size={18} />
        </span>
        <span>
          sonora<span className="brand-dot">.</span>
        </span>
      </div>
      <div className="header-side">
        <span className="header-label">BIBLIOTECA COMPARTIDA</span>
      </div>
    </header>
  );
}
