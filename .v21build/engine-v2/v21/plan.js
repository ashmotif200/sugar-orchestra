import { buildCapabilities, assignRoles } from '../capabilities.js';
import { selectPatterns, varyCell, chooseVariation, continuousBar, cellSimilarity } from './patterns.js';
import { harmonicState, rootAtBar, BASS_POLICIES, BASS_TIMBRES, } from './harmony.js';
export const ENGINE_VERSION_21 = 'v2.1.0';
const MAX_TRANSPOSITION = 7;
const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const hzToMidi = (hz) => 69 + 12 * Math.log2(hz / 440);
function prng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** Nombre de mesures pour viser une durée, borné par le profil. */
export function barsForDuration(profile, targetSeconds) {
    const raw = Math.round(targetSeconds / profile.time.barSeconds);
    // une mesure de 4 s (Rêveur) impose moins de mesures pour rester sous 60 s
    const minBars = profile.id === 'ambient-creole' ? 8 : profile.id === 'sega-trad' ? 12 : 16;
    return Math.max(minBars, Math.min(64, raw));
}
function form(bars, kind) {
    const intro = Math.max(2, Math.round(bars * (kind === 'ambient' ? 0.22 : 0.14)));
    const outro = Math.max(2, Math.round(bars * 0.12));
    const build = Math.max(2, Math.round(bars * 0.16));
    const breakBars = kind === 'dance' ? 0 : Math.max(1, Math.round(bars * 0.08));
    const main = Math.max(4, bars - intro - outro - build - breakBars);
    const s = [];
    let at = 0;
    const push = (k, n, roles) => { s.push({ kind: k, startBar: at, bars: n, activeRoles: roles }); at += n; };
    const all = ['bass', 'melody', 'rhythm', 'texture', 'earcandy'];
    push('intro', intro, kind === 'ambient' ? ['texture'] : ['texture', kind === 'dance' ? 'rhythm' : 'earcandy']);
    push('build', build, kind === 'dance' ? ['rhythm', 'texture'] : ['rhythm', 'bass', 'texture']);
    push('main', main, all);
    if (breakBars)
        push('break', breakBars, ['texture', 'melody']);
    push('outro', outro, kind === 'dance' ? ['rhythm', 'texture', 'melody'] : ['bass', 'texture', 'melody', 'rhythm']);
    return s;
}
const FORM_KIND = {
    'electro-sega': 'energetic', 'sega-trad': 'dance', segazz: 'relaxed', 'ambient-creole': 'ambient',
};
export function buildPlan21(input) {
    const { profile, selection, mode, styleModel } = input;
    const rand = prng(input.seed >>> 0);
    const caps = buildCapabilities(selection);
    const { roles, adaptations, limits } = assignRoles(caps, profile);
    const target = input.targetSeconds ?? (FORM_KIND[profile.id] === 'dance' ? 40 : 36);
    const bars = barsForDuration(profile, target);
    const sections = form(bars, FORM_KIND[profile.id] ?? 'energetic');
    const totalBars = sections.reduce((n, s) => n + s.bars, 0);
    const { beatsPerBar, subdivision } = profile.time;
    const stepsPerBar = beatsPerBar * subdivision;
    const pset = selectPatterns(styleModel ?? { rhythm: { patterns: [] } }, 'rhythm', stepsPerBar);
    const usingContinuous = pset.continuous.length > 0;
    const notes = [];
    const recognised = new Set();
    let id = 0;
    const voices = [];
    for (const role of ['bass', 'melody', 'rhythm', 'texture', 'earcandy']) {
        for (const soundId of roles[role]) {
            const cap = caps.get(soundId);
            voices.push({ role, soundId, midiAnchor: cap?.pitch.medianHz ? hzToMidi(cap.pitch.medianHz) : null });
        }
    }
    const harmony = harmonicState(profile, totalBars);
    const policy = BASS_POLICIES[profile.id] ?? BASS_POLICIES['electro-sega'];
    const wantBass = policy.wants && mode === 'hybrid_synth';
    if (policy.wants && mode !== 'hybrid_synth') {
        adaptations.push({ role: 'bass', sourceId: null, reason: `basse désactivée par le mode ${mode}` });
    }
    const addNote = (v, bar, sub, beats, opts) => {
        const cap = caps.get(v.soundId);
        const f0 = cap?.pitch.medianHz ?? null;
        let written = null;
        let rate = 1;
        let realizedHz = f0 ?? 0;
        if (opts.midi != null && f0 && cap?.pitch.credible) {
            const semis = opts.midi - hzToMidi(f0);
            if (Math.abs(semis) <= MAX_TRANSPOSITION) {
                written = opts.midi;
                rate = Math.pow(2, semis / 12);
                realizedHz = f0 * rate;
            }
            else {
                limits.push({ code: 'transposition-refused', detail: `${v.soundId} aurait dû bouger de ${semis.toFixed(1)} demi-tons` });
            }
        }
        else if (opts.midi != null && !cap?.pitch.credible) {
            limits.push({ code: 'pitch-not-credible', detail: `${v.soundId} ne tient pas de hauteur fiable : frappe non tonale` });
        }
        notes.push({
            id: `n${id++}`,
            sourceId: v.soundId,
            role: v.role,
            bar,
            beat: Math.floor(sub / subdivision),
            sub: sub % subdivision,
            durationBeats: beats,
            writtenMidi: written,
            realizedHz,
            playbackRate: Number(rate.toFixed(6)),
            gainDb: (opts.gainDb ?? 0) + profile.mix.roleGainDb[v.role],
            pan: v.role === 'texture' ? -0.35 : v.role === 'earcandy' ? 0.35 : 0,
            sourceOffsetS: Number((rand() * (cap?.pitch.credible ? 0.2 : 0.5)).toFixed(3)),
            recognisable: opts.recognisable ?? false,
            lowpassHz: opts.lowpassHz,
            attackS: opts.attackS ?? (v.role === 'texture' ? 0.25 : 0.005),
            releaseS: opts.releaseS ?? (v.role === 'texture' ? 0.5 : 0.08),
        });
        if (opts.recognisable)
            recognised.add(v.soundId);
    };
    /* ------------------------------------------------------------- parcours */
    const variationLog = [];
    const patternBars = new Map();
    let currentCell = pset.base[0]?.cell ?? 'x'.padEnd(stepsPerBar, '.');
    const baseCell = currentCell;
    const stability = profile.id === 'sega-trad' ? 0.86 : profile.id === 'segazz' ? 0.5 : 0.62;
    const energyCurve = [];
    const rhythmVoice = voices.find((v) => v.role === 'rhythm');
    const textureVoice = voices.find((v) => v.role === 'texture');
    const melodyVoice = voices.find((v) => v.role === 'melody');
    const candyVoice = voices.find((v) => v.role === 'earcandy');
    for (const section of sections) {
        for (let b = section.startBar; b < section.startBar + section.bars; b++) {
            const phase = (b - section.startBar) / Math.max(section.bars, 1);
            const dens = profile.groove.densityBySection[section.kind];
            let energy = 0;
            // --- percussion
            if (rhythmVoice && section.activeRoles.includes('rhythm')) {
                if (usingContinuous) {
                    const params = {
                        densityPerBar: Math.max(4, Math.round((styleModel?.rhythm.density_by_stem?.drums ?? 8) * dens)),
                        regularity: 0.9,
                        microtimingMs: profile.time.microtimingMs,
                        stepsPerBar,
                    };
                    for (const hit of continuousBar(params, rand, b)) {
                        addNote(rhythmVoice, b, hit.sub, 0.35, { gainDb: -6 + hit.accent * 6, recognisable: !recognised.has(rhythmVoice.soundId) && rand() < 0.4 });
                        energy += 0.5;
                    }
                }
                else {
                    const kind = chooseVariation(stability, rand);
                    const varRes = kind === 'keep'
                        ? { kind, cell: currentCell, distance: 0 }
                        : varyCell(currentCell, kind, rand);
                    if (varRes.kind !== 'keep' && varRes.distance > 0)
                        currentCell = varRes.cell;
                    variationLog.push({
                        bar: b, kind: varRes.kind, distance: varRes.distance,
                        similarity: Number(cellSimilarity(baseCell, currentCell).toFixed(3)),
                    });
                    patternBars.set(currentCell, [...(patternBars.get(currentCell) ?? []), b]);
                    const hits = [...currentCell].map((c, i) => (c === 'x' ? i : -1)).filter((i) => i >= 0);
                    for (const sub of hits) {
                        const onPulse = sub % subdivision === 0;
                        addNote(rhythmVoice, b, sub, onPulse ? 0.45 : 0.28, {
                            gainDb: onPulse ? 0 : -3,
                            recognisable: !recognised.has(rhythmVoice.soundId) && rand() < 0.35,
                        });
                        energy += onPulse ? 1 : 0.6;
                    }
                }
            }
            // --- texture : longues nappes, plus présentes dans les creux
            const textureEvery = profile.id === 'ambient-creole' ? 1 : 2;
            if (textureVoice && section.activeRoles.includes('texture') && b % textureEvery === 0) {
                addNote(textureVoice, b, 0, beatsPerBar * (section.kind === 'break' ? 2 : 1), {
                    recognisable: !recognised.has(textureVoice.soundId),
                    lowpassHz: section.kind === 'intro' || section.kind === 'break' ? 1600 : undefined,
                    gainDb: section.kind === 'main' ? -3 : 0,
                });
                energy += 0.4;
            }
            // --- mélodie : phrases courtes, notes prises dans la gamme du profil
            if (melodyVoice && section.activeRoles.includes('melody') && b % 2 === 1 && melodyVoice.midiAnchor) {
                const root = rootAtBar(harmony, b);
                const deg = harmony.scale[Math.floor(rand() * harmony.scale.length)];
                const targetMidi = root + deg;
                const semis = targetMidi - melodyVoice.midiAnchor;
                if (Math.abs(semis) <= MAX_TRANSPOSITION) {
                    addNote(melodyVoice, b, Math.floor(rand() * stepsPerBar), 1.2, { midi: targetMidi, recognisable: !recognised.has(melodyVoice.soundId), gainDb: -2 });
                    energy += 0.7;
                }
            }
            // --- earcandy : ponctuation rare
            if (candyVoice && section.activeRoles.includes('earcandy') && rand() < 0.22) {
                addNote(candyVoice, b, Math.floor(rand() * stepsPerBar), 0.3, { recognisable: !recognised.has(candyVoice.soundId), gainDb: -8 });
                energy += 0.3;
            }
            // --- respiration de fin de phrase
            if (profile.groove.fillProbability > 0 && b % 4 === 3 && rand() < profile.groove.fillProbability && rhythmVoice) {
                for (let k = stepsPerBar - 2; k < stepsPerBar; k++) {
                    addNote(rhythmVoice, b, k, 0.2, { gainDb: -7 });
                    energy += 0.4;
                }
            }
            energyCurve.push(Number((energy / Math.max(1, stepsPerBar)).toFixed(3)));
            void phase;
        }
    }
    /* ---------------------------------------------------------------- basse */
    const bassNotes = [];
    if (wantBass) {
        const art = policy.timbre === 'percussive' ? 'staccato' : 'legato';
        const durBeats = policy.timbre === 'percussive' ? 0.5 : policy.timbre === 'warm' ? 2 : beatsPerBar;
        for (const section of sections) {
            if (section.kind === 'intro' || (section.kind === 'break' && policy.timbre === 'percussive'))
                continue;
            for (let b = section.startBar; b < section.startBar + section.bars; b++) {
                const active = section.activeRoles.includes('bass');
                if (!active)
                    continue;
                const root = rootAtBar(harmony, b);
                const steps = policy.allowedSteps.filter((s) => s < stepsPerBar);
                // on ne double pas systématiquement la percussion : taux mesuré par univers
                const hits = steps.filter(() => rand() < (section.kind === 'outro' ? 0.6 : 0.85));
                if (!hits.length)
                    continue;
                for (const [k, sub] of hits.entries()) {
                    // fondamentale, puis quinte ou octave : mouvement simple et déclaré
                    const move = k === 0 ? 0 : (rand() < 0.55 ? 7 : 12);
                    const midi = Math.max(policy.midiRange[0], Math.min(policy.midiRange[1], root - 12 + move));
                    bassNotes.push({
                        bar: b, beat: Math.floor(sub / subdivision), sub: sub % subdivision,
                        durationBeats: durBeats, midi, velocity: k === 0 ? 0.95 : 0.7, articulation: art,
                    });
                }
            }
        }
        if (bassNotes.length) {
            adaptations.push({
                role: 'bass', sourceId: null,
                reason: `basse synthétisée (${policy.timbre}) — ${policy.rationale}`,
            });
        }
    }
    else if (!policy.wants && mode === 'hybrid_synth') {
        adaptations.push({ role: 'bass', sourceId: null, reason: `pas de basse : ${policy.rationale}` });
    }
    /* ------------------------------------------------- couverture des sons */
    for (const sound of selection) {
        if (recognised.has(sound.id))
            continue;
        const v = voices.find((x) => x.soundId === sound.id);
        if (!v)
            continue;
        addNote(v, Math.floor(totalBars * 0.35), 0, 1, { recognisable: true, gainDb: -4 });
    }
    const missing = selection.filter((s) => !recognised.has(s.id)).map((s) => s.id);
    if (missing.length)
        limits.push({ code: 'recognition-incomplete', detail: `sons sans apparition reconnaissable : ${missing.join(', ')}` });
    const usedSources = [...new Set(notes.map((n) => n.sourceId))].sort();
    const patternsUsed = [...patternBars.entries()]
        .map(([cell, bs]) => ({
        patternId: `v21:${profile.id}:${cell}`,
        cell, bars: bs,
        similarity: Number(cellSimilarity(baseCell, cell).toFixed(3)),
    }))
        .sort((a, b) => b.bars.length - a.bars.length);
    if (pset.rejected.length) {
        limits.push({ code: 'patterns-rejected', detail: `${pset.rejected.length} motif(s) écarté(s) : ${pset.rejected.slice(0, 3).map((r) => r.reason).join(' · ')}` });
    }
    if (usingContinuous) {
        adaptations.push({ role: 'rhythm', sourceId: rhythmVoice?.soundId ?? null, reason: 'texture rythmique continue (la référence n’a pas de cellule discrète)' });
    }
    return {
        schema: 2,
        engine: 'v2.1',
        mode,
        seed: input.seed >>> 0,
        profileId: profile.id,
        profileVersion: profile.version,
        time: profile.time,
        bars: totalBars,
        durationTargetS: target,
        notes,
        bassNotes,
        bassSynth: wantBass ? BASS_TIMBRES[policy.timbre] : null,
        sections,
        roles,
        mix: { roleGainDb: profile.mix.roleGainDb, masterLufs: profile.mix.masterLufs, truePeakMax: -1 },
        adaptations,
        limits,
        sources: usedSources,
        patternsUsed,
        variations: variationLog,
        energyCurve,
        harmony: {
            source: harmony.source,
            note: harmony.note,
            rootMidi: harmony.rootMidi,
            changes: harmony.changesAtBar?.length ?? 0,
        },
        reproducibility: {
            engineVersion: ENGINE_VERSION_21,
            policyVersion: 2,
            capabilityMatrix: input.capabilityMatrixSource,
            styleModels: styleModel ? [`style-${profile.id}.json (${styleModel.referenceId})`] : [],
            soundIds: [...selection.map((s) => s.id)].sort(),
        },
    };
}
export function summarise21(plan) {
    const byRole = {};
    for (const n of plan.notes)
        byRole[n.role] = (byRole[n.role] ?? 0) + 1;
    return {
        engine: plan.engine, mode: plan.mode,
        profileId: plan.profileId, profileVersion: plan.profileVersion,
        seed: plan.seed, bars: plan.bars,
        durationS: Number((plan.bars * plan.time.barSeconds).toFixed(2)),
        notes: plan.notes.length, byRole,
        bassNotes: plan.bassNotes.length,
        bassTimbre: plan.bassSynth?.timbre ?? null,
        patternsUsed: plan.patternsUsed.length,
        variations: plan.variations.length,
        meanSimilarity: plan.variations.length
            ? Number((plan.variations.reduce((s, v) => s + v.similarity, 0) / plan.variations.length).toFixed(3))
            : 1,
        sections: plan.sections.map((s) => `${s.kind}:${s.bars}`).join(' '),
        harmony: plan.harmony,
        limits: plan.limits.map((l) => l.code),
        adaptations: plan.adaptations.map((a) => a.reason),
        midiToHzCheck: plan.notes.filter((n) => n.writtenMidi != null).length,
        bassHz: plan.bassNotes.slice(0, 3).map((b) => Number(midiToHz(b.midi).toFixed(1))),
    };
}
