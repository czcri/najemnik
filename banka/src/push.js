// Upozornění do telefonu (Web Push bez obsahu – text doplní service worker aplikace).
// Klíče VAPID si služba vytvoří sama při prvním použití a drží je v KV.
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text = s => new TextEncoder().encode(s);

export async function klicePush(env) {
  let k = await env.DATA.get('vapid', 'json');
  if (!k) {
    const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    k = { verejny: b64u(await crypto.subtle.exportKey('raw', par.publicKey)), soukromy: await crypto.subtle.exportKey('jwk', par.privateKey) };
    await env.DATA.put('vapid', JSON.stringify(k));
  }
  return k;
}

async function podpis(aud, soukromy) {
  const hlavicka = b64u(text(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const obsah = b64u(text(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://czcri.github.io/najemnik/' })));
  const klic = await crypto.subtle.importKey('jwk', { ...soukromy, key_ops: ['sign'] }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, klic, text(`${hlavicka}.${obsah}`));
  return `${hlavicka}.${obsah}.${b64u(sig)}`;
}

// Pošle upozornění všem odběrům; zaniklé odběry (404/410) smaže. Vrací počet doručených.
export async function posliUpozorneni(env) {
  const k = await klicePush(env);
  const odbery = (await env.DATA.get('odbery', 'json')) ?? [];
  const zive = [];
  let doruceno = 0;
  for (const o of odbery) {
    try {
      const r = await fetch(o.endpoint, {
        method: 'POST',
        headers: { TTL: '86400', Urgency: 'normal', Authorization: `vapid t=${await podpis(new URL(o.endpoint).origin, k.soukromy)}, k=${k.verejny}` },
      });
      if (r.status === 404 || r.status === 410) continue;
      if (r.ok) doruceno++;
    } catch { /* síť – odběr ponechat */ }
    zive.push(o);
  }
  if (zive.length !== odbery.length) await env.DATA.put('odbery', JSON.stringify(zive));
  return doruceno;
}
