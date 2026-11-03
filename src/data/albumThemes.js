import nba from '../assets/collection-nba.png'
import pony from '../assets/collection-my-little-pony.png'
import cars from '../assets/collection-cars.png'
import marvel from '../assets/collection-marvel.png'

export const ALBUM_THEMES = [
  { key: 'NBA', label: 'NBA', cover: nba },
  { key: 'MY_LITTLE_PONY', label: 'My Little Pony', cover: pony },
  { key: 'CARS', label: 'Cars', cover: cars },
  { key: 'MARVEL', label: 'Marvel', cover: marvel },
]

export function sectionLabel(key) {
  return ALBUM_THEMES.find(section => section.key === key)?.label ?? key
}

