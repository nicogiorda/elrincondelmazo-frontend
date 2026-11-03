import { ALBUM_THEMES } from '../../data/albumThemes.js'

export default function AlbumSections({ activeSection, onChange }) {
  return (
    <nav aria-label="Secciones del álbum" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {ALBUM_THEMES.map(({ key, label, cover }) => (
        <button key={key} type="button" aria-pressed={activeSection === key}
          onClick={() => onChange(key)}
          className={`overflow-hidden rounded-[1.125rem] border-[2.4px] border-bordo bg-papel text-left transition-transform hover:-translate-y-1 ${activeSection === key ? 'ring-4 ring-amarillo shadow-product' : ''}`}>
          <img src={cover} alt="" className="aspect-[16/10] w-full object-cover" />
          <span className="block px-3 py-2 font-display text-xl font-black uppercase">{label}</span>
        </button>
      ))}
    </nav>
  )
}
