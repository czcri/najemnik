// Záchranná obrazovka: když se při zobrazení cokoli pokazí, aplikace nezůstane bílá
// a vždy jde stáhnout záloha dat přímo z úložiště telefonu.
import { Component, type ReactNode } from 'react';
import * as db from '../data/db';
import { stahniZalohu } from '../lib/zaloha';

type Stav = { chyba: Error | null; zprava: string };

export class Zachrana extends Component<{ children: ReactNode }, Stav> {
  state: Stav = { chyba: null, zprava: '' };

  static getDerivedStateFromError(chyba: Error) {
    return { chyba };
  }

  stahni = async () => {
    try {
      stahniZalohu(await db.nactiVse());
      this.setState({ zprava: 'Záloha uložena do Stažených souborů.' });
    } catch (e) {
      this.setState({ zprava: `Zálohu se nepodařilo vytvořit: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  render() {
    if (!this.state.chyba) return this.props.children;
    return (
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col justify-center gap-4 p-6 text-center">
        <p className="text-4xl">⚠️</p>
        <h1 className="text-xl font-extrabold">Něco se pokazilo</h1>
        <p className="text-sm text-muted-foreground">Vaše data jsou v telefonu v pořádku. Pro jistotu si stáhněte zálohu a aplikaci načtěte znovu.</p>
        <button onClick={this.stahni} className="card-hero h-14 font-bold">Stáhnout zálohu</button>
        <button onClick={() => { location.hash = '#/'; location.reload(); }} className="h-12 rounded-2xl bg-muted font-bold">Načíst znovu</button>
        {this.state.zprava && <p className="text-sm font-semibold">{this.state.zprava}</p>}
        <p className="mt-4 text-xs break-all text-muted-foreground">{this.state.chyba.message}</p>
      </div>
    );
  }
}
