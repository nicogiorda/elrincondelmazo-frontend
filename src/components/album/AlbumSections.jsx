import nba from '../../assets/collection-nba.png'
import pony from '../../assets/collection-my-little-pony.png'
import cars from '../../assets/collection-cars.png'
import marvel from '../../assets/collection-marvel.png'

export const ALBUM_THEMES = [
  { key: 'NBA', label: 'NBA', cover: nba },
  { key: 'MY_LITTLE_PONY', label: 'My Little Pony', cover: pony },
  { key: 'CARS', label: 'Cars', cover: cars },
  { key: 'MARVEL', label: 'Marvel', cover: marvel },
]

export function sectionLabel(key) {
  return ALBUM_THEMES.find(section => section.key === key)?.label ?? key
}

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
