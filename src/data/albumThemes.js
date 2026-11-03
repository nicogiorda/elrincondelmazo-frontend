import nba from '../assets/collection-nba.png'
import pony from '../assets/collection-my-little-pony.png'
import cars from '../assets/collection-cars.png'
import marvel from '../assets/collection-marvel.png'
import nbaRookies from '../assets/nba-rookies.png'
import marvelUniverse from '../assets/marvel-universe.png'

// Los temas decoran solo las hojas del álbum. No alteran los datos del backend.
export const ALBUM_THEMES = [
  { key: 'NBA', label: 'NBA', cover: nba, pageArt: nbaRookies,
    accent: '#24649a', paper: '#f7ecda', watermark: 'CANCHA', detail: 'ESTRELLAS DE LA CANCHA' },
  { key: 'MY_LITTLE_PONY', label: 'My Little Pony', cover: pony, pageArt: pony,
    accent: '#a14583', paper: '#fae2f0', watermark: 'MAGIA', detail: 'UN MUNDO DE FANTASÍA' },
  { key: 'CARS', label: 'Cars', cover: cars, pageArt: cars,
    accent: '#b53024', paper: '#ffe3da', watermark: 'RUTA', detail: 'PASIÓN POR LA VELOCIDAD' },
  { key: 'MARVEL', label: 'Marvel', cover: marvel, pageArt: marvelUniverse,
    accent: '#a52c24', paper: '#fff0bc', watermark: 'CÓMIC', detail: 'ACCIÓN EN CADA PÁGINA' },
]

export function sectionLabel(key) {
  return ALBUM_THEMES.find(section => section.key === key)?.label ?? key
}
