/** Vrai si le motif décrit un roulement plutôt qu'une cellule. */
export const isContinuous = (p) => p.density >= 0.85;
export function selectPatterns(model, role, stepsPerBar) {
    const rejected = [];
    const pool = [];
    for (const p of model.rhythm.patterns ?? []) {
        if (p.stepsPerBar !== stepsPerBar) {
            rejected.push({ patternId: p.patternId, reason: `grille ${p.stepsPerBar} pas ≠ ${stepsPerBar} du profil` });
            continue;
        }
        // les motifs de basse ne servent pas de cellule rythmique de percussion
        if (role === 'rhythm' && p.stemId === 'bass') {
            rejected.push({ patternId: p.patternId, reason: 'motif de basse, pas de percussion' });
            continue;
        }
        if (role === 'rhythm' && p.stemId === 'vocals') {
            rejected.push({ patternId: p.patternId, reason: 'motif vocal : ne définit pas le groove' });
            continue;
        }
        pool.push(p);
    }
    const continuous = pool.filter(isContinuous);
    const discrete = pool.filter((p) => !isContinuous(p));
    const base = discrete.filter((p) => p.confidence === 'confirmed').sort((a, b) => b.occurrences - a.occurrences);
    const variants = discrete.filter((p) => p.confidence !== 'confirmed').sort((a, b) => b.occurrences - a.occurrences);
    if (!base.length && discrete.length) {
        // aucune cellule confirmée : on accepte la plus observée, en le déclarant
        base.push(...discrete.sort((a, b) => b.occurrences - a.occurrences).slice(0, 1));
    }
    return { base, variants, continuous, rejected };
}
/** Similarité 0–1 entre deux cellules de même longueur (1 = identiques). */
export function cellSimilarity(a, b) {
    const n = Math.min(a.length, b.length);
    if (!n)
        return 0;
    let same = 0;
    for (let i = 0; i < n; i++)
        if (a[i] === b[i])
            same++;
    return same / Math.max(a.length, b.length);
}
/**
 * Produit une variante d'une cellule. La règle du brief est respectée : la
 * variation n'est pas une amélioration, `keep` est le cas le plus fréquent.
 * On ne modifie jamais plus de deux pas à la fois.
 */
export function varyCell(cell, kind, rand) {
    const arr = cell.split('');
    const hits = arr.map((c, i) => (c === 'x' ? i : -1)).filter((i) => i >= 0);
    const empties = arr.map((c, i) => (c === '.' ? i : -1)).filter((i) => i >= 0);
    const toggle = (i, v) => { arr[i] = v; };
    switch (kind) {
        case 'add_hit': {
            if (!empties.length)
                return { kind: 'keep', cell, distance: 0 };
            // on préfère un pas voisin d'une frappe existante : la variation reste lisible
            const near = empties.filter((e) => hits.some((h) => Math.abs(h - e) === 1));
            const target = (near.length ? near : empties)[Math.floor(rand() * (near.length || empties.length))];
            toggle(target, 'x');
            break;
        }
        case 'remove_hit': {
            if (hits.length <= 1)
                return { kind: 'keep', cell, distance: 0 };
            // on retire une frappe faible (pas le temps fort)
            const removable = hits.filter((h) => h !== 0);
            const target = removable[Math.floor(rand() * removable.length)];
            toggle(target, '.');
            break;
        }
        case 'shift_accent': {
            if (!hits.length)
                return { kind: 'keep', cell, distance: 0 };
            const from = hits[Math.floor(rand() * hits.length)];
            const to = (from + 1) % arr.length;
            if (arr[to] === 'x')
                return { kind: 'keep', cell, distance: 0 };
            toggle(from, '.');
            toggle(to, 'x');
            break;
        }
        case 'density_down': {
            const removable = hits.filter((h) => h !== 0);
            if (removable.length < 2)
                return { kind: 'keep', cell, distance: 0 };
            toggle(removable[Math.floor(rand() * removable.length)], '.');
            break;
        }
        case 'density_up': {
            if (!empties.length)
                return { kind: 'keep', cell, distance: 0 };
            toggle(empties[Math.floor(rand() * empties.length)], 'x');
            break;
        }
        case 'silence':
            return { kind: 'silence', cell: '.'.repeat(arr.length), distance: hits.length };
        case 'repeat':
        case 'keep':
        case 'velocity':
        default:
            return { kind, cell, distance: 0 };
    }
    const out = arr.join('');
    let dist = 0;
    for (let i = 0; i < cell.length; i++)
        if (cell[i] !== out[i])
            dist++;
    return { kind, cell: out, distance: dist };
}
/**
 * Choisit le type de variation pour une mesure donnée.
 * `stability` élevée = on garde la cellule plusieurs mesures de suite.
 */
export function chooseVariation(stability, rand) {
    const r = rand();
    if (r < stability)
        return 'keep';
    const rest = (r - stability) / (1 - stability);
    if (rest < 0.3)
        return 'add_hit';
    if (rest < 0.5)
        return 'remove_hit';
    if (rest < 0.68)
        return 'shift_accent';
    if (rest < 0.82)
        return 'velocity';
    if (rest < 0.92)
        return 'density_down';
    return 'density_up';
}
/**
 * Générateur de texture continue : produit des positions d'attaque réparties sur
 * la mesure, avec des accents, sans jamais imposer une cellule de 4 temps.
 * Le roulement n'est pas « quantifié en doubles-croches » : les positions sont
 * calculées à partir de la densité mesurée, puis légèrement dispersées.
 */
export function continuousBar(p, rand, barPhase = 0) {
    const count = Math.max(2, Math.round(p.densityPerBar));
    const out = [];
    const barSeconds = 1; // positions relatives : on travaille en fraction de mesure
    for (let i = 0; i < count; i++) {
        const even = (i + 0.5) / count;
        const jitter = (1 - p.regularity) * (rand() - 0.5) * (barSeconds / count) * 0.9;
        const pos = Math.min(0.999, Math.max(0, even + jitter));
        const sub = Math.round(pos * p.stepsPerBar) % p.stepsPerBar;
        // accent : temps forts de la mesure accentués, plus une respiration périodique
        const onPulse = sub % Math.max(1, Math.round(p.stepsPerBar / 2)) === 0;
        const breath = (i + barPhase) % 6 === 0 ? 0.2 : 0;
        out.push({ sub, accent: Math.min(1, (onPulse ? 0.85 : 0.55) + breath) });
    }
    // dédoublonnage en conservant la position quantifiée la plus proche
    const seen = new Set();
    return out.filter((e) => (seen.has(e.sub) ? false : (seen.add(e.sub), true)));
}
