import { useWindowDimensions } from 'react-native';

// Master dokument poglavlje 5.1 / M9 spec §8 — "telefon, preklopni telefon (sklopljen i
// rasklopljen), tablet, fluidnim rasporedom". Bez dodatne biblioteke: samo širina prozora u
// trenutku renderovanja — preklopni telefon rasklopljen i tablet oba padaju u širi raspon,
// razlika između njih nije bitna za layout (oba dobijaju dvokolonski prikaz), samo sklopljeno
// stanje (uzak ekran) je posebno.
export type ScreenSize = 'compact' | 'wide';

export function useScreenSize(): ScreenSize {
  const { width } = useWindowDimensions();
  return width >= 600 ? 'wide' : 'compact';
}
