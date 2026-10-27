// České formátování a práce s datem (vše v místním čase telefonu).

const pad = (n: number) => String(n).padStart(2, '0');

export function dnes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function posunDny(datum: string, dny: number): string {
  const d = new Date(`${datum}T12:00:00`);
  d.setDate(d.getDate() + dny);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function posunMesic(mesic: string, o: number): string {
  let [r, m] = mesic.split('-').map(Number);
  m += o;
  while (m > 12) { m -= 12; r++; }
  while (m < 1) { m += 12; r--; }
  return `${r}-${pad(m)}`;
}

export const kc = (n: number) => `${new Intl.NumberFormat('cs-CZ').format(n).replace(/\s/g, ' ')} Kč`;

const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const MESICE_2P = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
const MESICE_KRATCE = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

const indexMesice = (m: string) => +m.slice(5, 7) - 1;
export const nazevMesice = (m: string) => `${MESICE[indexMesice(m)]} ${m.slice(0, 4)}`;
export const NazevMesice = (m: string) => { const t = nazevMesice(m); return t[0].toUpperCase() + t.slice(1); };
export const odMesice = (m: string) => `${MESICE_2P[indexMesice(m)]} ${m.slice(0, 4)}`; // „od října 2026“
export const kratkyMesic = (m: string) => MESICE_KRATCE[indexMesice(m)];
export const datumCz = (d: string) => `${+d.slice(8, 10)}. ${+d.slice(5, 7)}. ${d.slice(0, 4)}`;
export const datumKratce = (d: string) => `${+d.slice(8, 10)}. ${+d.slice(5, 7)}.`;

export const pocet = (n: number, jeden: string, dva: string, pet: string) => `${n} ${n === 1 ? jeden : n >= 2 && n <= 4 ? dva : pet}`;

export const noveId = () => crypto.randomUUID();
