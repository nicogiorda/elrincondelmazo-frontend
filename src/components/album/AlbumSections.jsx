import { ALBUM_THEMES } from '../../data/albumThemes.js'

export default function AlbumSections({ activeSection, onChange }) {
  return (
    <nav aria-label="Secciones del álbum" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ALBUM_THEMES.map(({ key, label, accent, symbol }) => (
        <button key={key} type="button" aria-pressed={activeSection === key}
          onClick={() => onChange(key)}
          style={{ '--album-accent': accent }}
          className={'album-collection-tab' + (activeSection === key ? ' album-collection-tab--active' : '')}>
          <span className="album-collection-tab__symbol" aria-hidden="true">{symbol}</span>
          <span className="album-collection-tab__label">{label}</span>
          <span className="album-collection-tab__marker" aria-hidden="true" />
        </button>
      ))}
    </nav>
  )
}
