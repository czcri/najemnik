import * as db from './db.js';
import {
  stavNajemnika, souhrn, zmenNajem, aktualniNajem, potrebaZalohy, parseCastka,
  vytvorZalohu, nactiZalohu, castkaPredpisu, mesicZData, predpisVMesici,
} from './logika.js';

const VERZE_APLIKACE = '0.2';
const app = document.getElementById('app');
const data = { najemnici: [], platby: [], posledniZaloha: null };

// ---------- formátování ----------
const pad = n => String(n).padStart(2, '0');
function dnes() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const kc = n => `${new Intl.NumberFormat('cs-CZ').format(n)} Kč`;
const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const MESICE_2P = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
const nazevMesice = m => `${MESICE[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
const odMesice = m => `${MESICE_2P[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`; // 2. pád: „od srpna 2026“
const datumCz = d => `${+d.slice(8, 10)}. ${+d.slice(5, 7)}. ${d.slice(0, 4)}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function toast(text) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.add('videt');
  clearTimeout(toast.casovac);
  toast.casovac = setTimeout(() => t.classList.remove('videt'), 2200);
}

const BANKY = { fio: 'Fio', cs: 'Česká spořitelna', kb: 'Komerční banka' };
function zdrojText(p) {
  const typ = p.zdroj?.typ;
  if (typ === 'vypis') return `<span class="zdroj vypis">Výpis · ${esc(BANKY[p.zdroj.banka] ?? p.zdroj.banka)}</span>`;
  if (typ === 'hotove') return '<span class="zdroj">Hotově</span>';
  if (typ === 'prevod') return '<span class="zdroj">Převod – ručně</span>';
  return '<span class="zdroj">Ručně</span>';
}

const jdi = cesta => location.replace(`#/${cesta}`);
const najemnik = id => data.najemnici.find(n => n.id === id);
const platbyNajemnika = id => data.platby.filter(p => p.najemnikId === id);

async function nacti() {
  [data.najemnici, data.platby, data.posledniZaloha] = await Promise.all([
    db.vsechny('najemnici'), db.vsechny('platby'), db.meta('posledniZaloha'),
  ]);
}

// ---------- společné kousky ----------
function lista(titulek, zpet, vpravo = '') {
  return `<header class="lista">
    ${zpet !== null ? `<a class="zpet" href="#/${zpet}" aria-label="Zpět">‹</a>` : ''}
    <h1>${esc(titulek)}</h1>${vpravo}</header>`;
}

function stavText(s) {
  if (s.stav === 'dluh') return `<span class="castka dluh">dluh ${kc(s.dluh)}</span>`;
  if (s.stav === 'bezi') return `<span class="castka bezi">tento měsíc ${kc(s.tentoMesic)}</span>`;
  if (s.stav === 'preplatek') return `<span class="castka preplatek">přeplatek ${kc(s.preplatek)}</span>`;
  return '<span class="castka ok">v pořádku</span>';
}

// ---------- přehled ----------
function prehled() {
  const den = dnes();
  const s = souhrn(data.najemnici, data.platby, den);
  const aktivni = s.radky.filter(r => !r.ukonceny);
  const ukonceni = s.radky.filter(r => r.ukonceny);
  const radek = r => `<li><a href="#/n/${r.najemnik.id}">
      <span class="jmeno">${esc(r.najemnik.jmeno)}<small>${esc(r.najemnik.oznaceni)}</small></span>
      ${stavText(r)}</a></li>`;
  const zaloha = potrebaZalohy(data.posledniZaloha, den, data.najemnici.length > 0)
    ? `<div class="vyzva"><span>Tento měsíc ještě není záloha.</span>
       <button type="button" id="zalohovat">Zálohovat</button></div>` : '';

  app.innerHTML = `${lista('Nájemníci', null, '<a class="ikona" href="#/nastaveni" aria-label="Nastavení">⚙</a>')}
  <main>
    ${zaloha}
    ${data.najemnici.length ? `<section class="souhrn">
      <div class="dlazdice ${s.dluhCelkem ? 'dluh' : 'ok'}"><small>Dluh po splatnosti</small>
        <b>${kc(s.dluhCelkem)}</b><small>${s.dluzniku ? `${s.dluzniku} ${s.dluzniku === 1 ? 'dlužník' : s.dluzniku < 5 ? 'dlužníci' : 'dlužníků'}` : 'nikdo nedluží'}</small></div>
      <div class="dlazdice ${s.tentoMesicCelkem ? 'bezi' : 'ok'}"><small>Tento měsíc ještě chybí</small>
        <b>${kc(s.tentoMesicCelkem)}</b><small>splatné do konce měsíce</small></div>
    </section>` : ''}
    ${aktivni.length ? `<ul class="seznam">${aktivni.map(radek).join('')}</ul>`
      : '<p class="prazdne">Zatím žádní nájemníci.<br>Začněte tlačítkem <b>+ Nájemník</b>.</p>'}
    ${ukonceni.length ? `<details class="ukonceni"><summary>Ukončené nájmy (${ukonceni.length})</summary>
      <ul class="seznam">${ukonceni.map(radek).join('')}</ul></details>` : ''}
  </main>
  <a class="fab" href="#/n/novy">+ Nájemník</a>`;

  document.getElementById('zalohovat')?.addEventListener('click', zalohujDoTelefonu);
}

// ---------- detail nájemníka ----------
function detail(id, zalozka) {
  const n = najemnik(id);
  if (!n) return jdi('');
  const den = dnes();
  const platby = platbyNajemnika(id).sort((a, b) => b.datum.localeCompare(a.datum));
  const s = stavNajemnika(n, platby, den);
  const najem = aktualniNajem(n, den);

  const vyrovnani = s.stav === 'dluh'
    ? `<div class="vysledek dluh">Dluh po splatnosti <b>${kc(s.dluh)}</b></div>
       ${s.tentoMesic ? `<div class="vysledek bezi">+ tento měsíc <b>${kc(s.tentoMesic)}</b></div>` : ''}`
    : s.stav === 'bezi' ? `<div class="vysledek bezi">Tento měsíc ještě chybí <b>${kc(s.tentoMesic)}</b></div>`
    : s.stav === 'preplatek' ? `<div class="vysledek preplatek">Přeplatek <b>${kc(s.preplatek)}</b></div>`
    : '<div class="vysledek ok">Vše zaplaceno</div>';

  const seznamPlateb = platby.length
    ? `<ul class="seznam platby">${platby.map(p => `<li><a href="#/p/${p.id}">
        <span class="jmeno">${datumCz(p.datum)}<small>${zdrojText(p)}${p.poznamka ? ` · ${esc(p.poznamka)}` : ''}</small></span>
        <span class="castka">${kc(p.castka)}</span></a></li>`).join('')}</ul>`
    : '<p class="prazdne">Zatím žádná platba.</p>';

  const STAVY = { ok: '✓', bezi: 'běží', dluh: 'dluh' };
  const tabulka = s.radky.length
    ? `<table class="mesice"><thead><tr><th>Měsíc</th><th>Měl</th><th>Zaplatil</th><th>Rozdíl</th></tr></thead><tbody>
      ${[...s.radky].reverse().map(r => `<tr class="${r.stav}">
        <td>${nazevMesice(r.mesic)}<small>${r.chybi ? `chybí ${kc(r.chybi)}` : STAVY.ok}</small></td>
        <td>${kc(r.mel)}</td><td>${kc(r.zaplatil)}</td><td>${kc(r.prubeznyRozdil)}</td></tr>`).join('')}
      </tbody></table>
      <p class="pozn">Zaplatil = platby s datem v daném měsíci. Rozdíl = průběžně, kolik k tomu měsíci chybělo (záporný = přeplatek). Stav vlevo počítá i pozdější platby.</p>`
    : `<p class="prazdne">Nájem začne od ${odMesice(n.zacatek)}.</p>`;

  app.innerHTML = `${lista(n.jmeno, '', `<a class="ikona" href="#/n/${id}/upravit" aria-label="Upravit">✎</a>`)}
  <main>
    <section class="karta">
      <p class="oznaceni">${esc(n.oznaceni)}${n.telefon ? ` · <a href="tel:${esc(n.telefon)}">${esc(n.telefon)}</a>` : ''}</p>
      <p>Nájem <b>${kc(najem)}</b> měsíčně · od ${odMesice(n.zacatek)}${n.konec ? ` do ${odMesice(n.konec)}` : ''}</p>
      <div class="porovnani">
        <div><small>Měl zaplatit</small><b>${kc(s.mel)}</b></div>
        <div><small>Zaplatil</small><b>${kc(s.zaplatil)}</b></div>
      </div>
      ${vyrovnani}
      ${n.poznamka ? `<p class="pozn">${esc(n.poznamka)}</p>` : ''}
    </section>
    <a class="tlacitko hlavni velke" href="#/n/${id}/platba">+ Platba</a>
    <nav class="zalozky">
      <a href="#/n/${id}" class="${zalozka ? '' : 'aktivni'}">Platby (${platby.length})</a>
      <a href="#/n/${id}/mesice" class="${zalozka ? 'aktivni' : ''}">Měsíce</a>
    </nav>
    ${zalozka ? tabulka : seznamPlateb}
    <div class="akce">
      <a class="tlacitko" href="#/n/${id}/najem">Změnit nájem</a>
      <a class="tlacitko" href="#/n/${id}/upravit">Upravit / ukončit nájem</a>
    </div>
  </main>`;
}

// ---------- formuláře ----------
function formular(titulek, zpet, pole, { smazat = false } = {}) {
  app.innerHTML = `${lista(titulek, zpet)}
  <main><form class="formular" novalidate>
    ${pole}
    <p class="chyba" hidden></p>
    <button class="tlacitko hlavni velke" type="submit">Uložit</button>
    ${smazat ? '<button class="tlacitko nebezpecne" type="button" id="smazat">Smazat</button>' : ''}
  </form></main>`;
  const form = app.querySelector('form');
  const chyba = form.querySelector('.chyba');
  return {
    form,
    hodnota: jmeno => form.elements[jmeno].value.trim(),
    chyba: text => { chyba.textContent = text; chyba.hidden = false; },
  };
}

function formPlatba(najemnikId, platbaId) {
  const p = platbaId ? data.platby.find(x => x.id === platbaId) : null;
  if (platbaId && !p) return jdi('');
  const n = najemnik(najemnikId ?? p.najemnikId);
  if (!n) return jdi('');
  const f = formular(p ? 'Upravit platbu' : 'Nová platba', `n/${n.id}`, `
    <p class="pro">${esc(n.jmeno)} · ${esc(n.oznaceni)}</p>
    <label>Datum<input name="datum" type="date" required value="${p?.datum ?? dnes()}"></label>
    <label>Částka (Kč)<input name="castka" inputmode="numeric" autocomplete="off" required
      value="${p?.castka ?? aktualniNajem(n, dnes())}"></label>
    ${p?.zdroj?.typ === 'vypis'
      ? `<p class="pole-info">Importováno z výpisu (${esc(BANKY[p.zdroj.banka] ?? p.zdroj.banka)}, ${esc(p.zdroj.ucet)})${p.zdroj.protiucet ? ` · plátce ${esc(p.zdroj.protiucet)}` : ''}${p.zdroj.vs ? ` · VS ${esc(p.zdroj.vs)}` : ''}</p>`
      : `<fieldset class="volba"><legend>Způsob platby</legend>
        <label><input type="radio" name="zpusob" value="hotove" ${p?.zdroj?.typ === 'hotove' ? 'checked' : ''}> Hotově</label>
        <label><input type="radio" name="zpusob" value="prevod" ${p?.zdroj?.typ === 'prevod' ? 'checked' : ''}> Převodem</label></fieldset>`}
    <label>Poznámka<input name="poznamka" maxlength="200" value="${esc(p?.poznamka)}" placeholder="nepovinné"></label>`,
  { smazat: !!p });

  f.form.addEventListener('submit', async e => {
    e.preventDefault();
    const datum = f.hodnota('datum'), castka = parseCastka(f.hodnota('castka'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return f.chyba('Vyplňte datum.');
    if (!castka) return f.chyba('Částka musí být kladné celé číslo (v korunách).');
    let zdroj = p?.zdroj;
    if (zdroj?.typ !== 'vypis') {
      const zpusob = f.form.elements.zpusob.value;
      if (!zpusob) return f.chyba('Vyberte způsob platby: hotově, nebo převodem.');
      zdroj = { typ: zpusob };
    }
    await db.uloz('platby', { ...p, id: p?.id ?? crypto.randomUUID(), najemnikId: n.id, datum, castka, poznamka: f.hodnota('poznamka'), zdroj });
    await nacti();
    toast(p ? 'Platba upravena' : 'Platba uložena');
    jdi(`n/${n.id}`);
  });
  document.getElementById('smazat')?.addEventListener('click', async () => {
    if (!confirm(`Smazat platbu ${kc(p.castka)} z ${datumCz(p.datum)}?`)) return;
    await db.smaz('platby', p.id);
    await nacti();
    toast('Platba smazána');
    jdi(`n/${n.id}`);
  });
}

function formNajemnik(id) {
  const n = id ? najemnik(id) : null;
  if (id && !n) return jdi('');
  const f = formular(n ? 'Upravit nájemníka' : 'Nový nájemník', n ? `n/${id}` : '', `
    <label>Jméno<input name="jmeno" required maxlength="100" value="${esc(n?.jmeno)}" autocomplete="off"></label>
    <label>Označení bydliště<input name="oznaceni" required maxlength="100" value="${esc(n?.oznaceni)}" placeholder="např. Byt 2 – Kolín"></label>
    <label>Začátek nájmu<input name="zacatek" type="month" required value="${n?.zacatek ?? mesicZData(dnes())}"></label>
    ${n ? `<p class="pole-info">Nájem ${kc(aktualniNajem(n, dnes()))} měsíčně – <a href="#/n/${id}/najem">změnit</a></p>`
      : '<label>Nájem měsíčně (Kč)<input name="castka" inputmode="numeric" required autocomplete="off"></label>'}
    <label>Telefon<input name="telefon" type="tel" maxlength="30" value="${esc(n?.telefon)}" placeholder="nepovinné"></label>
    <label>Poznámka<textarea name="poznamka" rows="2" maxlength="500" placeholder="nepovinné">${esc(n?.poznamka)}</textarea></label>
    ${n ? `<label>Konec nájmu<input name="konec" type="month" value="${n.konec ?? ''}">
      <small>Vyplňte, až nájem skončí – od dalšího měsíce už se nic nepředepisuje.</small></label>` : ''}`,
  { smazat: !!n });

  f.form.addEventListener('submit', async e => {
    e.preventDefault();
    const jmeno = f.hodnota('jmeno'), oznaceni = f.hodnota('oznaceni'), zacatek = f.hodnota('zacatek');
    if (!jmeno) return f.chyba('Vyplňte jméno.');
    if (!oznaceni) return f.chyba('Vyplňte označení bydliště.');
    if (!/^\d{4}-\d{2}$/.test(zacatek)) return f.chyba('Vyplňte začátek nájmu.');
    let predpisy, konec = null;
    if (n) {
      konec = f.hodnota('konec') || null;
      if (konec && konec < zacatek) return f.chyba('Konec nájmu je před jeho začátkem.');
      // Posun začátku: nájem platný k novému začátku začne od něj, pozdější změny zůstanou.
      const platny = predpisVMesici(n, zacatek) ?? n.predpisy[0];
      predpisy = [{ ...platny, od: zacatek }, ...n.predpisy.filter(p => p.od > zacatek)];
    } else {
      const castka = parseCastka(f.hodnota('castka'));
      if (!castka) return f.chyba('Nájem musí být kladné celé číslo (v korunách).');
      predpisy = zmenNajem([], zacatek, castka);
    }
    const novy = {
      id: n?.id ?? crypto.randomUUID(), jmeno, oznaceni, zacatek, konec, predpisy,
      telefon: f.hodnota('telefon'), poznamka: f.hodnota('poznamka'),
    };
    await db.uloz('najemnici', novy);
    await nacti();
    toast('Uloženo');
    jdi(`n/${novy.id}`);
  });
  document.getElementById('smazat')?.addEventListener('click', async () => {
    const pocet = platbyNajemnika(n.id).length;
    if (!confirm(`Opravdu smazat nájemníka ${n.jmeno}${pocet ? ` i s ${pocet} platbami` : ''}?\n\nUkončený nájem raději označte „Konec nájmu“ – historie zůstane.`)) return;
    await db.smazNajemnika(n.id);
    await nacti();
    toast('Nájemník smazán');
    jdi('');
  });
}

function formNajem(id) {
  const n = najemnik(id);
  if (!n) return jdi('');
  const historie = [...n.predpisy].reverse().map(p =>
    `<li><span>od ${odMesice(p.od)}</span><b>${kc(castkaPredpisu(p))}</b></li>`).join('');
  const f = formular('Změnit nájem', `n/${id}`, `
    <p class="pro">${esc(n.jmeno)} · ${esc(n.oznaceni)}</p>
    <label>Od měsíce<input name="od" type="month" required value="${mesicZData(dnes())}"></label>
    <label>Nový nájem měsíčně (Kč)<input name="castka" inputmode="numeric" required autocomplete="off"
      value="${aktualniNajem(n, dnes())}"></label>
    <p class="pole-info">Dřívější měsíce se nezmění.</p>
    <h2>Historie nájmu</h2><ul class="historie">${historie}</ul>`);

  f.form.addEventListener('submit', async e => {
    e.preventDefault();
    const od = f.hodnota('od'), castka = parseCastka(f.hodnota('castka'));
    if (!/^\d{4}-\d{2}$/.test(od)) return f.chyba('Vyplňte měsíc.');
    if (od < n.zacatek) return f.chyba(`Nájem začíná od ${odMesice(n.zacatek)} – změna nemůže být dřív.`);
    if (!castka) return f.chyba('Nájem musí být kladné celé číslo (v korunách).');
    await db.uloz('najemnici', { ...n, predpisy: zmenNajem(n.predpisy, od, castka) });
    await nacti();
    toast('Nájem změněn');
    jdi(`n/${id}`);
  });
}

// ---------- záloha ----------
function souborZalohy() {
  const text = JSON.stringify(vytvorZalohu(data.najemnici, data.platby, new Date().toISOString()), null, 1);
  return new File([text], `najemnik-zaloha-${dnes()}.json`, { type: 'application/json' });
}

async function oznacZalohu() {
  data.posledniZaloha = dnes();
  await db.nastavMeta('posledniZaloha', data.posledniZaloha);
}

async function zalohujDoTelefonu() {
  const soubor = souborZalohy();
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(soubor), download: soubor.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  await oznacZalohu();
  toast('Záloha uložena do Stažených souborů');
  route();
}

async function posliZalohuJinam() {
  const soubor = souborZalohy();
  try {
    await navigator.share({ files: [soubor], title: 'Záloha Nájemník', text: `Záloha aplikace Nájemník ${datumCz(dnes())}` });
    await oznacZalohu();
    toast('Záloha odeslána');
    route();
  } catch (e) {
    if (e.name !== 'AbortError') toast('Sdílení se nepodařilo');
  }
}

async function nastaveni() {
  const lzeSdilet = !!navigator.canShare?.({ files: [new File(['x'], 'x.json', { type: 'application/json' })] });
  const trvale = await navigator.storage?.persisted?.();
  app.innerHTML = `${lista('Nastavení', '')}
  <main>
    <section class="karta">
      <h2>Záloha</h2>
      <p>Poslední záloha: <b>${data.posledniZaloha ? datumCz(data.posledniZaloha) : 'zatím žádná'}</b></p>
      <button class="tlacitko hlavni" type="button" id="dotelefonu">Zálohovat do telefonu</button>
      ${lzeSdilet ? '<button class="tlacitko" type="button" id="jinam">Poslat zálohu jinam (e-mail, Disk…)</button>' : ''}
      <p class="pozn">Záloha v telefonu chrání před smazáním dat aplikace. Proti ztrátě telefonu občas pošlete zálohu jinam.</p>
    </section>
    <section class="karta">
      <h2>Obnova ze zálohy</h2>
      <p class="pozn">Nahradí všechna současná data obsahem zálohy.</p>
      <label class="tlacitko">Vybrat soubor zálohy<input type="file" id="obnova" accept=".json,application/json" hidden></label>
    </section>
    <section class="karta pozn">
      <p>Nájemníků: ${data.najemnici.length} · plateb: ${data.platby.length}</p>
      <p>Data jsou uložena jen v tomto telefonu${trvale === true ? ' (trvalé úložiště)' : trvale === false ? ' – trvalé úložiště prohlížeč zatím nepovolil, zálohujte' : ''}.</p>
      <p>Verze ${VERZE_APLIKACE}</p>
    </section>
  </main>`;
  document.getElementById('dotelefonu').addEventListener('click', zalohujDoTelefonu);
  document.getElementById('jinam')?.addEventListener('click', posliZalohuJinam);
  document.getElementById('obnova').addEventListener('change', async e => {
    const soubor = e.target.files[0];
    if (!soubor) return;
    try {
      const z = nactiZalohu(await soubor.text());
      if (!confirm(`Obnovit ze zálohy ${soubor.name}?\n\n${z.najemnici.length} nájemníků, ${z.platby.length} plateb.\nSoučasná data se nahradí.`)) return;
      await db.nahradVse(z.najemnici, z.platby);
      await nacti();
      toast('Data obnovena ze zálohy');
      jdi('');
    } catch (chyba) {
      alert(chyba.message);
    } finally {
      e.target.value = '';
    }
  });
}

// ---------- směrování ----------
const CESTY = [
  [/^$/, prehled],
  [/^nastaveni$/, nastaveni],
  [/^n\/novy$/, () => formNajemnik(null)],
  [/^n\/([\w-]+)$/, id => detail(id, false)],
  [/^n\/([\w-]+)\/mesice$/, id => detail(id, true)],
  [/^n\/([\w-]+)\/upravit$/, formNajemnik],
  [/^n\/([\w-]+)\/najem$/, formNajem],
  [/^n\/([\w-]+)\/platba$/, id => formPlatba(id, null)],
  [/^p\/([\w-]+)$/, id => formPlatba(null, id)],
];

function route() {
  const cesta = location.hash.replace(/^#\/?/, '');
  for (const [vzor, obrazovka] of CESTY) {
    const m = cesta.match(vzor);
    if (m) { obrazovka(...m.slice(1)); window.scrollTo(0, 0); return; }
  }
  jdi('');
}

window.addEventListener('hashchange', route);
// Po návratu do aplikace (např. další den / měsíc) přepočítat.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !app.querySelector('form')) route();
});

navigator.storage?.persist?.();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

try {
  await nacti();
  route();
} catch (e) {
  app.innerHTML = `<p class="prazdne">Nepodařilo se otevřít data v telefonu.<br><small>${esc(e?.message ?? e)}</small></p>`;
}
