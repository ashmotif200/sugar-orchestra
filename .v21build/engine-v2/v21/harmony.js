/**
 * Construit l'état harmonique d'un profil.
 *
 * - un profil `progression` fournit une suite d'accords explicite ;
 * - un profil `pedal` fournit un centre fixe, avec éventuellement une seconde
 *   zone plus grave en fin de morceau (mouvement conclusif) ;
 * - un profil `none` n'a pas d'harmonie : on n'en fabrique pas. Les couches
 *   tonales restent alors sur une pédale de composition, déclarée comme telle.
 */
export function harmonicState(profile, bars) {
    const h = profile.harmony;
    if (h.mode === 'progression' && h.progression && h.progression.length) {
        const changes = [];
        const cycle = Math.max(2, Math.round(bars / (h.progression.length * 2)));
        for (let b = 0, k = 0; b < bars; b += cycle, k++) {
            const deg = h.progression[k % h.progression.length];
            changes.push({ bar: b, rootMidi: (h.rootMidi ?? 60) + (deg[0] ?? 0) });
        }
        return {
            rootMidi: h.rootMidi ?? 60,
            scale: h.scale,
            source: 'profile_progression',
            note: 'progression explicite du profil (choix de composition, pas une transcription)',
            changesAtBar: changes,
        };
    }
    if (h.mode === 'none') {
        return {
            rootMidi: h.rootMidi ?? 62,
            scale: h.scale,
            source: 'explicit_composition_choice',
            note: 'aucune harmonie fiable dans la référence : pédale de composition assumée',
            changesAtBar: null,
        };
    }
    return {
        rootMidi: h.rootMidi ?? 60,
        scale: h.scale,
        source: 'profile_pedal',
        note: 'pédale du profil, mesurée sur la référence',
        changesAtBar: null,
    };
}
export const rootAtBar = (state, bar) => {
    if (!state.changesAtBar?.length)
        return state.rootMidi;
    let root = state.rootMidi;
    for (const c of state.changesAtBar)
        if (bar >= c.bar)
            root = c.rootMidi;
    return root;
};
/**
 * Version de la politique de gain de basse.
 *
 * v1 (V2.1.0) : gains −1/−2/−3 dB → mesuré par `scripts/v2/analyze-layers.mjs`,
 *   la basse sortait 12,2 dB au-dessus de la couche de samples sur Énergétique et
 *   8,3 dB sur Détendu : elle menait le mix au lieu de le soutenir.
 * v2 (V2.1.1) : gains abaissés de 6 dB, pour que le mix reste au niveau de la
 *   couche de samples et que la basse soutienne sans dominer.
 */
export const GAIN_POLICY_VERSION = 2;
/**
 * Paramètres de synthèse par timbre. Ce sont des choix de conception, pas des
 * mesures : la référence ne fournit aucun timbre de basse synthétique.
 */
export const BASS_TIMBRES = {
    sub: {
        timbre: 'sub', harmonics: [1, 0.12, 0.05],
        attackS: 0.08, decayS: 0.4, sustain: 0.85, releaseS: 0.6,
        cutoffHz: 180, drive: 0.05, gainDb: -9,
    },
    warm: {
        timbre: 'warm', harmonics: [1, 0.32, 0.14],
        attackS: 0.03, decayS: 0.25, sustain: 0.7, releaseS: 0.25,
        cutoffHz: 420, drive: 0.18, gainDb: -8,
    },
    percussive: {
        timbre: 'percussive', harmonics: [1, 0.45, 0.22],
        attackS: 0.004, decayS: 0.09, sustain: 0.18, releaseS: 0.09,
        cutoffHz: 700, drive: 0.3, gainDb: -7,
    },
};
export const BASS_POLICIES = {
    // Ohwalawa : basse = renfort de kick, 75 % de coïncidence, IOI 0,36 s, staccato
    'electro-sega': {
        wants: true, timbre: 'percussive',
        allowedSteps: [0, 3, 6, 9], doublingRate: 0.7, midiRange: [33, 45],
        rationale: 'basse courte et synchronisée aux accents (mesuré : 75 % de coïncidence avec la percussion)',
    },
    // Tififi : aucune basse dans la référence — on n'en ajoute pas par défaut
    'sega-trad': {
        wants: false, timbre: 'sub',
        allowedSteps: [0], doublingRate: 0, midiRange: [33, 40],
        rationale: 'la référence ne contient pas de basse ; en ajouter une serait une invention',
    },
    // Zistoire : basse legato liée à l'harmonie (lift 2,55), 215,9 attaques/min
    segazz: {
        wants: true, timbre: 'warm',
        allowedSteps: [0, 2, 4, 6], doublingRate: 0.35, midiRange: [33, 45],
        rationale: 'basse legato liée à la couche tonale, pas au kick (lift 2,55 vs 2,37)',
    },
    // Rêveur : hypothèse. Sub tenue, aucune prétention stylistique.
    'ambient-creole': {
        wants: true, timbre: 'sub',
        allowedSteps: [0], doublingRate: 0, midiRange: [28, 40],
        rationale: 'profil hypothèse : sub tenue, pas une caractéristique démontrée',
    },
};
