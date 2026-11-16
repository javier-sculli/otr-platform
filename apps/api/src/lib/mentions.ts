// Resolución de @menciones en comentarios.
//
// Regla clave: en cada "@" gana el candidato MÁS LARGO que matchee en esa posición,
// considerando a TODOS los usuarios a la vez. Así "@Camila Montes" resuelve sólo a
// Camila Montes y no también a otra "Camila" por el primer nombre (bug reportado con
// Cami Montes / Sofi O). Si el texto es ambiguo (ej. "@sofi" y hay dos Sofías),
// se notifica a todas las que empatan.

export const NICKNAMES: Record<string, string> = {
  joaco: 'joaquín',
  manu: 'manuela',
  javi: 'javier',
  sofi: 'sofía',
  santi: 'santiago',
  lore: 'lorena',
  nati: 'natalia',
  nahue: 'nahuel',
  palo: 'paloma',
  geo: 'georgina',
  agu: 'agustina',
  guada: 'guadalupe',
  shai: 'shaiel',
};

export interface MentionUser {
  id: string;
  name: string | null;
  email?: string | null;
}

export function normalizeStr(str: string | null | undefined) {
  return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function candidatesFor(u: MentionUser): string[] {
  const nameNorm = normalizeStr(u.name).trim().replace(/\s+/g, ' ');
  const firstNameNorm = nameNorm.split(' ')[0];
  const emailPrefixNorm = normalizeStr(u.email ? u.email.split('@')[0] : '');

  const candidates = new Set<string>();
  if (nameNorm) candidates.add(nameNorm);
  if (firstNameNorm) candidates.add(firstNameNorm);
  if (emailPrefixNorm) candidates.add(emailPrefixNorm);

  for (const [nick, targetName] of Object.entries(NICKNAMES)) {
    const normTarget = normalizeStr(targetName);
    if (nameNorm === normTarget || firstNameNorm === normTarget || nameNorm.includes(normTarget)) {
      candidates.add(nick);
      // Apodo + apellido ("@sofi oliva") también identifica unívocamente
      const rest = nameNorm.split(' ').slice(1).join(' ');
      if (rest) candidates.add(`${nick} ${rest}`);
    }
  }
  return Array.from(candidates).filter(c => c.length >= 2);
}

const WORD_CHAR = /[a-z0-9]/;

/**
 * Devuelve los ids de usuarios mencionados en `text`, excluyendo al autor.
 * `text` debe venir sin URLs de medios/adjuntos.
 */
export function resolveMentions(text: string, users: MentionUser[], authorId?: string): string[] {
  const norm = normalizeStr(text).replace(/[ \t]+/g, ' ');
  if (!norm.includes('@')) return [];

  const userCands = users.map(u => ({ id: u.id, cands: candidatesFor(u) }));
  const matched = new Set<string>();

  for (let i = norm.indexOf('@'); i !== -1; i = norm.indexOf('@', i + 1)) {
    // Un "@" pegado a una palabra es un email, no una mención
    if (i > 0 && WORD_CHAR.test(norm[i - 1])) continue;
    const after = norm.slice(i + 1);

    let bestLen = 0;
    let bestIds: string[] = [];
    for (const { id, cands } of userCands) {
      let len = 0;
      for (const c of cands) {
        if (c.length > len && after.startsWith(c)) {
          const next = after[c.length];
          if (next === undefined || !WORD_CHAR.test(next)) len = c.length;
        }
      }
      if (len === 0) continue;
      if (len > bestLen) {
        bestLen = len;
        bestIds = [id];
      } else if (len === bestLen) {
        bestIds.push(id);
      }
    }
    bestIds.forEach(id => matched.add(id));
  }

  if (authorId) matched.delete(authorId);
  return Array.from(matched);
}
