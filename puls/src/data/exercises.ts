import type { Anim, Pose, Prop, Seg } from '../components/Figure';

export type Muscle = 'Borst' | 'Rug' | 'Schouders' | 'Biceps' | 'Triceps' | 'Benen' | 'Billen' | 'Hamstrings' | 'Kuiten' | 'Core' | 'Conditie';

/** Apparatuur. Oefeningen zonder apparatuur (lichaamsgewicht, stoel, tafel) kunnen altijd. */
export type Equip = 'stang' | 'dumbbells' | 'bank' | 'kabel' | 'machines' | 'optrekstang';

export const EQUIP_LABEL: Record<Equip, { t: string; s: string; em: string }> = {
  stang: { t: 'Halterstang + rek', s: 'Squat-rek of bankdrukstation', em: '🏋️' },
  dumbbells: { t: 'Dumbbells', s: 'Losse halters', em: '💪' },
  bank: { t: 'Fitnessbank', s: 'Plat of verstelbaar', em: '🛋️' },
  kabel: { t: 'Kabelstation', s: 'Katrol met handvatten', em: '🪢' },
  machines: { t: 'Krachtmachines', s: 'Beenpers, chest press, leg curl…', em: '⚙️' },
  optrekstang: { t: 'Optrek- of dipstation', s: 'Stang om je aan op te trekken', em: '🧗' },
};
export const ALL_EQUIP = Object.keys(EQUIP_LABEL) as Equip[];

export interface Exercise {
  id: string;
  name: string;
  muscles: Muscle[];
  equip: Equip[];
  /** 1 = makkelijk/veilig voor starters, 3 = vraagt goede techniek */
  diff: 1 | 2 | 3;
  compound: boolean;
  weighted: boolean;
  timed?: boolean;
  steps: string[];
  tip: string;
  anim: Anim;
}

/* ---------- Poses ---------- */
const STAND: Pose = { anchor: 'foot', at: [58, 89.5], torso: 0, thigh: 180, shin: 180, arm: 180, fore: 180 };
const st = (o: Partial<Pose> = {}): Pose => ({ ...STAND, ...o });
const SQUAT_LOW = (o: Partial<Pose> = {}) => st({ torso: 38, thigh: 98, shin: 205, ...o });
const HINGE = (o: Partial<Pose> = {}) => st({ torso: 80, thigh: 165, shin: 186, ...o });
const LUNGE_TOP: Partial<Pose> = { anchor: 'foot', at: [72, 89.5], torso: 0, thigh: 165, shin: 180, thigh2: 200, shin2: 215, foot2: 160 };
const LUNGE_LOW: Partial<Pose> = { anchor: 'foot', at: [72, 89.5], torso: 0, thigh: 96, shin: 180, thigh2: 196, shin2: 262, foot2: 160 };
const BENCH: Pose = { anchor: 'hip', at: [72, 65], torso: 270, thigh: 105, shin: 180, arm: 0, fore: 0 };
const INCLINE: Pose = { anchor: 'hip', at: [66, 68], torso: 300, thigh: 100, shin: 180, arm: 15, fore: 15 };
const SEATED: Pose = { anchor: 'hip', at: [56, 70], torso: 0, thigh: 90, shin: 180, arm: 180, fore: 180 };
const PUSH_TOP: Pose = { anchor: 'hand', at: [88, 89], torso: 66, thigh: 246, shin: 246, arm: 182, fore: 180, foot: 200 };
const PUSH_LOW: Pose = { ...PUSH_TOP, torso: 80, thigh: 260, shin: 260, arm: 265, fore: 140 };
const HANG: Pose = { anchor: 'hand', at: [62, 9], torso: 0, thigh: 180, shin: 200, arm: 0, fore: 0 };
const LYING: Pose = { anchor: 'hip', at: [64, 86], torso: 270, thigh: 90, shin: 90, arm: 0, fore: 0, foot: 0 };
const FRONT: Pose = { anchor: 'foot', at: [66, 89.5], torso: 0, thigh: 176, thigh2: 184, shin: 180, shin2: 180, arm: 172, fore: 176, arm2: 188, fore2: 184 };

/* ---------- Props ---------- */
const bar = (at: 'wrist' | 'shoulder' | 'hip' = 'wrist'): Prop => ({ k: 'plate', at, r: 7.5 });
const db: Prop = { k: 'plate', at: 'wrist', r: 4.5 };
const benchFlat: Prop = { k: 'rect', x: 22, y: 69, w: 56, h: 5, legs: true };
const seat: Prop = { k: 'rect', x: 42, y: 73, w: 28, h: 4, legs: true };
const back: Prop = { k: 'line', x1: 49, y1: 74, x2: 48, y2: 44, w: 5 };

const A = (a: Pose, b: Pose, hi: Seg[], props: Prop[] = [], extra: Partial<Anim> = {}): Anim => ({ a, b, hi, props, ...extra });

type Def = Omit<Exercise, 'id'>;
const D = (name: string, muscles: Muscle[], equip: Equip[], diff: 1 | 2 | 3, compound: boolean, weighted: boolean, steps: string[], tip: string, anim: Anim, timed = false): Def => ({
  name, muscles, equip, diff, compound, weighted, steps, tip, anim, timed,
});

const LIST: Record<string, Def> = {
  /* ===== Benen ===== */
  squat: D('Squat met halterstang', ['Benen', 'Billen'], ['stang'], 3, true, true, [
    'Leg de stang op je bovenrug (niet op je nek) en stap met twee passen uit het rek.',
    'Voeten op schouderbreedte, tenen iets naar buiten. Span je buik aan.',
    'Zak met je heupen naar achteren en beneden tot je bovenbenen minstens horizontaal zijn.',
    'Duw door je hele voet omhoog. Knieën blijven in de lijn van je tenen.',
  ], 'Houd je borst omhoog en je hielen op de grond. Zet de veiligheidsstangen van het rek net onder je diepste punt.',
  A(st({ arm: 215, fore: 340 }), SQUAT_LOW({ arm: 250, fore: 10 }), ['thigh'], [{ k: 'plate', at: 'shoulder', r: 7.5 }])),

  legpress: D('Beenpers', ['Benen', 'Billen'], ['machines'], 1, true, true, [
    'Ga zitten met je rug en billen helemaal tegen de rugleuning.',
    'Zet je voeten op heupbreedte midden op het platform.',
    'Ontgrendel en laat het platform zakken tot je knieën ongeveer 90° zijn.',
    'Duw weg tot je benen bijna gestrekt zijn, zonder je knieën op slot te zetten.',
  ], 'Je onderrug blijft tegen de leuning. Komt je billen los? Zak dan minder diep.',
  A({ anchor: 'hip', at: [44, 66], torso: 296, thigh: 35, shin: 150, arm: 160, fore: 120 }, { anchor: 'hip', at: [44, 66], torso: 296, thigh: 62, shin: 72, arm: 160, fore: 120 }, ['thigh'],
    [{ k: 'line', x1: 22, y1: 55, x2: 46, y2: 72, w: 5 }, { k: 'rect', x: 34, y: 70, w: 24, h: 4, legs: true }, { k: 'pad', at: 'ankle', angle: 155, len: 16 }])),

  gobletsquat: D('Goblet squat', ['Benen', 'Billen'], ['dumbbells'], 1, true, true, [
    'Houd één dumbbell rechtop tegen je borst, ellebogen naar beneden.',
    'Voeten iets breder dan je heupen.',
    'Zak diep tussen je knieën, borst blijft rechtop.',
    'Kom krachtig omhoog en knijp bovenin je billen samen.',
  ], 'De beste squat om de beweging te leren: het gewicht voor je houdt je vanzelf rechtop.',
  A(st({ arm: 168, fore: 18 }), SQUAT_LOW({ arm: 150, fore: 30 }), ['thigh'], [{ k: 'plate', at: 'wrist', r: 5 }])),

  bwsquat: D('Squat (lichaamsgewicht)', ['Benen', 'Billen'], [], 1, true, false, [
    'Sta met je voeten op schouderbreedte, armen naar voren.',
    'Zak met je billen naar achteren alsof je op een stoel gaat zitten.',
    'Ga zo diep als je kunt met je hielen op de grond.',
    'Duw jezelf terug omhoog.',
  ], 'Te makkelijk? Zak in 3 tellen en kom in 1 tel omhoog.',
  A(st({ arm: 90, fore: 90 }), SQUAT_LOW({ arm: 90, fore: 90 }), ['thigh'])),

  lunge: D('Lunges met dumbbells', ['Benen', 'Billen'], ['dumbbells'], 2, true, true, [
    'Sta rechtop met een dumbbell in elke hand.',
    'Zet een grote stap naar voren.',
    'Zak tot je achterste knie bijna de grond raakt; je voorste knie staat boven je enkel.',
    'Duw via je voorste hiel terug en wissel van been.',
  ], 'Neem een flinke stap: dan blijft je voorste knie achter je tenen.',
  A({ ...STAND, ...LUNGE_TOP } as Pose, { ...STAND, ...LUNGE_LOW } as Pose, ['thigh'], [db])),

  bwlunge: D('Lunges', ['Benen', 'Billen'], [], 1, true, false, [
    'Sta rechtop, handen in je zij.',
    'Stap ver naar voren en zak recht naar beneden.',
    'Beide knieën maken ongeveer een hoek van 90°.',
    'Duw terug naar de start en wissel van been.',
  ], 'Houd je romp rechtop en kijk recht vooruit.',
  A({ ...STAND, ...LUNGE_TOP, arm: 200, fore: 120 } as Pose, { ...STAND, ...LUNGE_LOW, arm: 200, fore: 120 } as Pose, ['thigh'])),

  bulgarian: D('Bulgarian split squat', ['Benen', 'Billen'], ['dumbbells', 'bank'], 2, true, true, [
    'Zet de wreef van je achterste voet op een bank, dumbbells in je handen.',
    'Je voorste voet staat ongeveer een grote pas voor de bank.',
    'Zak recht naar beneden op je voorste been.',
    'Duw via je voorste hiel terug omhoog. Eerst alle herhalingen, dan wisselen.',
  ], 'Een van de beste oefeningen voor benen en billen. Begin licht: balans is het lastigste.',
  A({ anchor: 'foot', at: [74, 89.5], torso: 5, thigh: 170, shin: 180, thigh2: 208, shin2: 292, foot2: 250, arm: 180, fore: 180 }, { anchor: 'foot', at: [74, 89.5], torso: 14, thigh: 100, shin: 184, thigh2: 186, shin2: 276, foot2: 250, arm: 180, fore: 180 }, ['thigh'],
    [{ k: 'rect', x: 10, y: 66, w: 26, h: 5, legs: true }, db])),

  chairsplit: D('Split squat op een stoel', ['Benen', 'Billen'], [], 2, true, false, [
    'Zet je achterste voet op een stevige stoel of de bank.',
    'Zet je voorste voet een grote pas naar voren.',
    'Zak recht naar beneden op je voorste been.',
    'Duw terug omhoog. Eerst alle herhalingen, dan wisselen.',
  ], 'Houd je vast aan een muur als je balans nog lastig is.',
  A({ anchor: 'foot', at: [74, 89.5], torso: 5, thigh: 170, shin: 180, thigh2: 208, shin2: 292, foot2: 250, arm: 200, fore: 120 }, { anchor: 'foot', at: [74, 89.5], torso: 14, thigh: 100, shin: 184, thigh2: 186, shin2: 276, foot2: 250, arm: 200, fore: 120 }, ['thigh'],
    [{ k: 'rect', x: 10, y: 66, w: 26, h: 5, legs: true }])),

  rdl: D('Roemeense deadlift', ['Hamstrings', 'Billen', 'Rug'], ['stang'], 2, true, true, [
    'Sta rechtop met de stang tegen je bovenbenen, handen op schouderbreedte.',
    'Knieën licht gebogen. Duw je billen naar achteren.',
    'Laat de stang langs je benen zakken tot je een flinke rek in je hamstrings voelt.',
    'Duw je heupen naar voren om weer rechtop te komen.',
  ], 'Je rug blijft recht. Het is een heupbeweging, geen squat.',
  A(st(), HINGE(), ['thigh'], [bar()])),

  dbrdl: D('Roemeense deadlift met dumbbells', ['Hamstrings', 'Billen'], ['dumbbells'], 2, true, true, [
    'Houd de dumbbells voor je bovenbenen.',
    'Knieën licht gebogen, duw je billen naar achteren.',
    'Laat de dumbbells langs je benen zakken tot halverwege je scheenbenen.',
    'Kom omhoog door je heupen naar voren te duwen en knijp je billen samen.',
  ], 'Denk aan "billen naar de muur achter je".',
  A(st(), HINGE(), ['thigh'], [db])),

  deadlift: D('Deadlift', ['Hamstrings', 'Billen', 'Rug'], ['stang'], 3, true, true, [
    'Sta met je middenvoet onder de stang, voeten op heupbreedte.',
    'Pak de stang net buiten je knieën. Rug recht, borst vooruit, schouders boven de stang.',
    'Duw de grond van je af en houd de stang dicht tegen je benen.',
    'Sta rechtop met je heupen naar voren en laat gecontroleerd zakken.',
  ], 'Begin licht en film jezelf van opzij: een bolle rug is het teken om lichter te gaan.',
  A(st({ torso: 60, thigh: 118, shin: 198 }), st(), ['thigh', 'torso'], [bar()])),

  slrdl: D('Eenbenige deadlift', ['Hamstrings', 'Billen'], [], 2, true, false, [
    'Sta op één been met een lichte buiging in je knie.',
    'Kantel naar voren terwijl je andere been naar achteren gaat.',
    'Je lichaam en achterste been vormen één rechte lijn.',
    'Kom gecontroleerd terug en wissel na de set van been.',
  ], 'Houd je heupen recht naar de grond gericht, niet open draaien.',
  A(st(), st({ torso: 84, thigh: 178, thigh2: 264, shin2: 268, foot2: 300 }), ['thigh'])),

  hipthrust: D('Hip thrust', ['Billen', 'Hamstrings'], ['stang', 'bank'], 2, true, true, [
    'Zit op de grond met je bovenrug tegen de rand van een bank.',
    'Rol de stang (met een pad) op je heupen. Voeten plat, op heupbreedte.',
    'Duw je heupen omhoog tot je lichaam van schouders tot knieën recht is.',
    'Knijp bovenin 1 seconde je billen samen en zak gecontroleerd.',
  ], 'Kin naar je borst, dan blijf je rug neutraal.',
  A({ anchor: 'foot', at: [84, 89.5], torso: 292, thigh: 62, shin: 186, arm: 70, fore: 120, neck: 300 }, { anchor: 'foot', at: [84, 89.5], torso: 268, thigh: 93, shin: 182, arm: 75, fore: 120, neck: 300 }, ['thigh'],
    [{ k: 'rect', x: 14, y: 60, w: 30, h: 6, legs: true }, bar('hip')])),

  glutebridge: D('Glute bridge', ['Billen', 'Hamstrings'], [], 1, true, false, [
    'Lig op je rug, knieën gebogen, voeten plat op de grond.',
    'Armen naast je lichaam.',
    'Duw je heupen omhoog tot je lichaam van schouders tot knieën recht is.',
    'Knijp 1 seconde je billen samen en zak langzaam.',
  ], 'Voel je het in je hamstrings? Zet je voeten dichter bij je billen.',
  A({ anchor: 'foot', at: [80, 89.5], torso: 272, thigh: 58, shin: 196, arm: 90, fore: 90, neck: 270 }, { anchor: 'foot', at: [80, 89.5], torso: 252, thigh: 92, shin: 186, arm: 108, fore: 100, neck: 260 }, ['thigh'])),

  legext: D('Leg extension', ['Benen'], ['machines'], 1, false, true, [
    'Stel de machine zo in dat je knie bij het draaipunt zit en het kussen op je enkels.',
    'Houd de handvatten vast.',
    'Strek je benen volledig en houd 1 seconde vast.',
    'Laat langzaam zakken.',
  ], 'Niet zwaaien: rustig omlaag geeft het meeste resultaat.',
  A({ ...SEATED, at: [52, 70], torso: 355, shin: 180, arm: 175, fore: 150 }, { ...SEATED, at: [52, 70], torso: 355, shin: 94, arm: 175, fore: 150 }, ['thigh'], [{ k: 'rect', x: 38, y: 73, w: 32, h: 4, legs: true }, { k: 'line', x1: 44, y1: 74, x2: 42, y2: 46, w: 5 }, { k: 'plate', at: 'ankle', r: 3.4 }])),

  legcurl: D('Leg curl', ['Hamstrings'], ['machines'], 1, false, true, [
    'Ga zitten met het kussen net boven je hielen.',
    'Zet het bovenste kussen stevig op je bovenbenen.',
    'Buig je knieën zo ver mogelijk en knijp aan.',
    'Laat gecontroleerd terugkomen.',
  ], 'Houd je billen op de zitting.',
  A({ ...SEATED, at: [52, 70], torso: 352, shin: 94, arm: 175, fore: 150 }, { ...SEATED, at: [52, 70], torso: 352, shin: 205, arm: 175, fore: 150 }, ['shin'], [{ k: 'rect', x: 38, y: 73, w: 32, h: 4, legs: true }, { k: 'line', x1: 44, y1: 74, x2: 42, y2: 46, w: 5 }, { k: 'plate', at: 'ankle', r: 3.4 }])),

  calf: D('Kuitheffen', ['Kuiten'], [], 1, false, false, [
    'Sta rechtop, eventueel met je voorvoeten op een traptrede.',
    'Houd je vast aan een muur of leuning voor balans.',
    'Kom zo hoog mogelijk op je tenen en houd 1 seconde vast.',
    'Zak langzaam en diep terug.',
  ], 'Met een dumbbell in je hand maak je het zwaarder.',
  A({ ...STAND, anchor: 'toe', at: [66, 90], foot: 90 }, { ...STAND, anchor: 'toe', at: [66, 90], foot: 122 }, ['shin'])),

  wallsit: D('Wall sit', ['Benen'], [], 1, false, false, [
    'Leun met je rug tegen een muur.',
    'Schuif naar beneden tot je knieën 90° zijn.',
    'Houd deze positie vast, armen ontspannen.',
  ], 'Brandt het? Dan doe je het goed. Blijf rustig ademen.',
  A({ ...STAND, at: [64, 89.5], thigh: 90 }, { ...STAND, at: [64, 89.5], thigh: 92, shin: 182 }, ['thigh'], [{ k: 'line', x1: 40, y1: 14, x2: 40, y2: 92, w: 3 }], { speed: 4 }), true),

  /* ===== Borst ===== */
  bench: D('Bankdrukken', ['Borst', 'Triceps', 'Schouders'], ['stang', 'bank'], 3, true, true, [
    'Lig op de bank met je ogen onder de stang, voeten plat op de grond.',
    'Knijp je schouderbladen samen en pak de stang iets breder dan je schouders.',
    'Laat de stang gecontroleerd zakken naar je onderborst.',
    'Druk hem recht omhoog tot je armen gestrekt zijn.',
  ], 'Train je zwaar? Vraag iemand om je te spotten.',
  A(BENCH, { ...BENCH, arm: 135, fore: 0 }, ['arm', 'torso'], [benchFlat, bar()])),

  dbbench: D('Dumbbell press', ['Borst', 'Triceps'], ['dumbbells', 'bank'], 2, true, true, [
    'Lig op de bank met een dumbbell in elke hand boven je borst.',
    'Schouderbladen samen, voeten plat.',
    'Laat de dumbbells zakken tot ze naast je borst zijn.',
    'Druk ze omhoog en iets naar elkaar toe.',
  ], 'Ellebogen ongeveer 45° van je lichaam, niet wijd uit.',
  A(BENCH, { ...BENCH, arm: 135, fore: 0 }, ['arm', 'torso'], [benchFlat, db])),

  inclinedb: D('Schuin drukken met dumbbells', ['Borst', 'Schouders'], ['dumbbells', 'bank'], 2, true, true, [
    'Zet de bank op ongeveer 30°.',
    'Begin met de dumbbells naast je bovenborst.',
    'Druk ze omhoog tot je armen bijna gestrekt zijn.',
    'Laat langzaam zakken tot je een rek in je borst voelt.',
  ], 'Te steil (meer dan 45°) en je traint vooral je schouders.',
  A(INCLINE, { ...INCLINE, arm: 140, fore: 10 }, ['arm', 'torso'], [{ k: 'line', x1: 70, y1: 72, x2: 40, y2: 54, w: 5 }, { k: 'rect', x: 58, y: 72, w: 20, h: 4, legs: true }, db])),

  inclinebench: D('Schuin bankdrukken', ['Borst', 'Schouders'], ['stang', 'bank'], 3, true, true, [
    'Lig op de schuine bank (30°) met je ogen onder de stang.',
    'Schouderbladen samen, pak de stang iets breder dan je schouders.',
    'Laat zakken naar je bovenborst.',
    'Druk recht omhoog.',
  ], 'Houd je billen op de bank.',
  A(INCLINE, { ...INCLINE, arm: 140, fore: 10 }, ['arm', 'torso'], [{ k: 'line', x1: 70, y1: 72, x2: 40, y2: 54, w: 5 }, { k: 'rect', x: 58, y: 72, w: 20, h: 4, legs: true }, bar()])),

  chestpress: D('Chest press machine', ['Borst', 'Triceps'], ['machines'], 1, true, true, [
    'Stel de stoel zo in dat de handvatten op borsthoogte zitten.',
    'Rug tegen de leuning, schouderbladen samen.',
    'Druk de handvatten naar voren tot je armen bijna gestrekt zijn.',
    'Laat gecontroleerd terugkomen.',
  ], 'Een veilige manier om je borst zwaar te trainen zonder spotter.',
  A({ ...SEATED, at: [52, 72], torso: 354, arm: 205, fore: 88 }, { ...SEATED, at: [52, 72], torso: 354, arm: 92, fore: 90 }, ['arm', 'torso'], [{ k: 'rect', x: 38, y: 75, w: 26, h: 4, legs: true }, { k: 'line', x1: 44, y1: 76, x2: 42, y2: 44, w: 5 }, { k: 'plate', at: 'wrist', r: 3 }])),

  cablefly: D('Cable fly', ['Borst'], ['kabel'], 2, false, true, [
    'Zet beide katrollen op schouderhoogte en pak een handvat in elke hand.',
    'Stap naar voren, armen wijd met een lichte buiging in je ellebogen.',
    'Breng je handen in een boog naar elkaar toe voor je borst.',
    'Laat langzaam terug tot je een rek in je borst voelt.',
  ], 'Denk aan "een grote boom omhelzen".',
  A({ ...FRONT, arm: 102, fore: 96, arm2: 258, fore2: 264 }, { ...FRONT, arm: 150, fore: 220, arm2: 210, fore2: 140 }, ['arm'], [{ k: 'cable', from: [114, 22], to: 'wrist' }, { k: 'cable', from: [6, 22], to: 'wrist2' }], { view: 'front' })),

  dips: D('Dips', ['Borst', 'Triceps'], ['optrekstang'], 3, true, false, [
    'Steun op de dipbars met gestrekte armen.',
    'Leun iets naar voren en buig je knieën.',
    'Zak tot je bovenarmen ongeveer horizontaal zijn.',
    'Duw jezelf terug omhoog.',
  ], 'Lukt het nog niet? Gebruik de assisted dip-machine of een elastiek.',
  A({ anchor: 'hand', at: [62, 50], torso: 8, thigh: 186, shin: 228, arm: 182, fore: 180 }, { anchor: 'hand', at: [62, 50], torso: 18, thigh: 192, shin: 234, arm: 250, fore: 165 }, ['arm'], [{ k: 'line', x1: 50, y1: 52, x2: 80, y2: 52, w: 3 }, { k: 'line', x1: 78, y1: 52, x2: 78, y2: 92, w: 3 }])),

  pushup: D('Opdrukken', ['Borst', 'Triceps', 'Schouders'], [], 1, true, false, [
    'Handen iets breder dan je schouders, op je tenen.',
    'Lichaam in een rechte lijn van hoofd tot hielen, buik aangespannen.',
    'Zak tot je borst bijna de grond raakt.',
    'Duw jezelf krachtig terug omhoog.',
  ], 'Te zwaar? Doe ze op je knieën. Te licht? Zet je voeten op een stoel.',
  A(PUSH_TOP, PUSH_LOW, ['arm', 'torso'])),

  kneepushup: D('Opdrukken op je knieën', ['Borst', 'Triceps'], [], 1, true, false, [
    'Handen iets breder dan je schouders, knieën op de grond.',
    'Lichaam in een rechte lijn van hoofd tot knieën.',
    'Zak tot je borst bijna de grond raakt.',
    'Duw terug omhoog.',
  ], 'Lukt 15 keer makkelijk? Ga dan naar gewoon opdrukken.',
  A({ ...PUSH_TOP, torso: 52, thigh: 232, shin: 300, foot: 300 }, { ...PUSH_LOW, torso: 72, thigh: 252, shin: 300, foot: 300 }, ['arm', 'torso'])),

  declinepushup: D('Opdrukken met voeten verhoogd', ['Borst', 'Schouders'], [], 2, true, false, [
    'Zet je voeten op een bank of stoel, handen op de grond.',
    'Lichaam in een rechte lijn.',
    'Zak met je borst richting de vloer.',
    'Duw terug omhoog.',
  ], 'Hoe hoger je voeten, hoe zwaarder.',
  A({ ...PUSH_TOP, torso: 96, thigh: 276, shin: 276, foot: 200 }, { ...PUSH_LOW, torso: 106, thigh: 286, shin: 286, foot: 200 }, ['arm', 'torso'], [{ k: 'rect', x: 4, y: 64, w: 22, h: 5, legs: true }])),

  /* ===== Schouders ===== */
  ohp: D('Schouderdrukken met stang', ['Schouders', 'Triceps'], ['stang'], 3, true, true, [
    'Sta rechtop met de stang op je bovenborst, handen net buiten je schouders.',
    'Span je billen en buik aan.',
    'Druk de stang recht omhoog; beweeg je hoofd even naar achteren.',
    'Laat gecontroleerd terugzakken naar je borst.',
  ], 'Niet hol trekken: liever iets lichter en strak.',
  A(st({ arm: 165, fore: 4 }), st({ arm: 2, fore: 0 }), ['arm'], [bar()])),

  dbohp: D('Schouderdrukken met dumbbells', ['Schouders', 'Triceps'], ['dumbbells'], 2, true, true, [
    'Zit rechtop (of sta), dumbbells op schouderhoogte.',
    'Handpalmen naar voren, ellebogen iets naar voren.',
    'Druk de dumbbells omhoog tot je armen bijna gestrekt zijn.',
    'Laat gecontroleerd zakken tot oorhoogte.',
  ], 'Een bank met rugleuning helpt je rechtop te blijven.',
  A({ ...SEATED, arm: 165, fore: 4 }, { ...SEATED, arm: 2, fore: 0 }, ['arm'], [seat, back, db])),

  machinepress: D('Shoulder press machine', ['Schouders', 'Triceps'], ['machines'], 1, true, true, [
    'Stel de stoel zo in dat de handvatten op schouderhoogte zitten.',
    'Rug tegen de leuning.',
    'Druk de handvatten omhoog.',
    'Laat langzaam zakken tot net onder oorhoogte.',
  ], 'Een veilige start om je schouders sterker te maken.',
  A({ ...SEATED, arm: 165, fore: 4 }, { ...SEATED, arm: 2, fore: 0 }, ['arm'], [seat, back, { k: 'plate', at: 'wrist', r: 3 }])),

  pikepushup: D('Pike push-up', ['Schouders', 'Triceps'], [], 2, true, false, [
    'Begin in opdrukpositie en loop met je voeten naar je handen: billen hoog.',
    'Je lichaam vormt een omgekeerde V.',
    'Buig je armen en breng je hoofd richting de grond tussen je handen.',
    'Duw terug omhoog.',
  ], 'Hoe dichter je voeten bij je handen, hoe zwaarder voor je schouders.',
  A({ anchor: 'hand', at: [80, 89], torso: 138, thigh: 222, shin: 222, arm: 160, fore: 162, foot: 220 }, { anchor: 'hand', at: [80, 89], torso: 150, thigh: 225, shin: 225, arm: 240, fore: 150, foot: 220 }, ['arm'])),

  lateral: D('Zijwaartse heffingen', ['Schouders'], ['dumbbells'], 1, false, true, [
    'Sta rechtop met lichte dumbbells naast je lichaam.',
    'Til ze zijwaarts op tot schouderhoogte, armen licht gebogen.',
    'Je pinken mogen iets hoger dan je duimen.',
    'Laat langzaam zakken.',
  ], 'Kies licht gewicht: zwaaien betekent dat het te zwaar is.',
  A(FRONT, { ...FRONT, arm: 96, fore: 92, arm2: 264, fore2: 268 }, ['arm'], [{ k: 'plate', at: 'wrist', r: 4 }, { k: 'plate', at: 'wrist2', r: 4 }], { view: 'front' })),

  cablelateral: D('Zijwaartse heffing met kabel', ['Schouders'], ['kabel'], 2, false, true, [
    'Zet de katrol laag en pak het handvat met de hand die het verst van de kabel is.',
    'Sta zijwaarts naast de kabel.',
    'Til je arm zijwaarts op tot schouderhoogte.',
    'Laat langzaam zakken. Eerst alle herhalingen, dan wisselen.',
  ], 'De kabel geeft spanning over de hele beweging.',
  A({ ...FRONT, arm: 192, fore: 198 }, { ...FRONT, arm: 96, fore: 94 }, ['arm'], [{ k: 'cable', from: [40, 90], to: 'wrist' }], { view: 'front' })),

  facepull: D('Face pulls', ['Schouders', 'Rug'], ['kabel'], 2, false, true, [
    'Zet de katrol op ooghoogte met een touw.',
    'Pak het touw met je duimen naar achteren en stap naar achteren.',
    'Trek het touw naar je gezicht, ellebogen hoog en naar buiten.',
    'Houd even vast en laat gecontroleerd terug.',
  ], 'Goed voor een rechte houding en gezonde schouders.',
  A(st({ arm: 92, fore: 90 }), st({ arm: 262, fore: 25 }), ['arm'], [{ k: 'cable', from: [114, 28], to: 'wrist' }])),

  /* ===== Rug ===== */
  row: D('Roeien met halterstang', ['Rug', 'Biceps'], ['stang'], 3, true, true, [
    'Pak de stang op schouderbreedte en buig voorover met een rechte rug.',
    'Knieën licht gebogen, romp ongeveer 45° of lager.',
    'Trek de stang naar je navel en knijp je schouderbladen samen.',
    'Laat gecontroleerd zakken.',
  ], 'Je romp blijft stil: niet omhoog zwaaien.',
  A(st({ torso: 70, thigh: 165, shin: 186 }), st({ torso: 70, thigh: 165, shin: 186, arm: 228, fore: 178 }), ['arm', 'torso'], [bar()])),

  dbrow: D('Eenarmig roeien met dumbbell', ['Rug', 'Biceps'], ['dumbbells'], 2, true, true, [
    'Steun met één hand en knie op een bank of leun op een stevig meubel.',
    'Laat de dumbbell aan een gestrekte arm hangen.',
    'Trek de dumbbell langs je zij omhoog richting je heup.',
    'Laat langzaam zakken. Eerst alle herhalingen, dan wisselen.',
  ], 'Denk aan je elleboog naar het plafond trekken, niet je hand.',
  A(st({ torso: 76, thigh: 165, shin: 186, arm2: 170, fore2: 170 }), st({ torso: 76, thigh: 165, shin: 186, arm: 232, fore: 178, arm2: 170, fore2: 170 }), ['arm', 'torso'], [db])),

  cablerow: D('Zittend roeien (kabel)', ['Rug', 'Biceps'], ['kabel'], 1, true, true, [
    'Zit rechtop met je voeten tegen de steunen en knieën licht gebogen.',
    'Pak het handvat met gestrekte armen.',
    'Trek het handvat naar je buik en breng je schouderbladen naar elkaar.',
    'Laat gecontroleerd terug zonder voorover te vallen.',
  ], 'Borst vooruit, schouders laag.',
  A({ anchor: 'hip', at: [44, 84], torso: 356, thigh: 82, shin: 96, arm: 92, fore: 90 }, { anchor: 'hip', at: [44, 84], torso: 352, thigh: 82, shin: 96, arm: 210, fore: 88 }, ['arm', 'torso'], [{ k: 'rect', x: 26, y: 87, w: 44, h: 3 }, { k: 'cable', from: [114, 76], to: 'wrist' }])),

  pulldown: D('Lat pulldown', ['Rug', 'Biceps'], ['kabel'], 1, true, true, [
    'Zit met je knieën onder de kussens en pak de stang breed vast.',
    'Leun een klein beetje achterover, borst vooruit.',
    'Trek de stang naar je bovenborst; ellebogen naar je zij.',
    'Laat de stang gecontroleerd terug omhoog.',
  ], 'Niet achter je nek trekken; altijd voor je gezicht langs.',
  A({ ...SEATED, at: [56, 74], torso: 350, arm: 8, fore: 4 }, { ...SEATED, at: [56, 74], torso: 346, arm: 205, fore: 14 }, ['arm', 'torso'], [{ k: 'rect', x: 42, y: 77, w: 28, h: 4, legs: true }, { k: 'cable', from: [58, 3], to: 'wrist' }])),

  pullup: D('Optrekken', ['Rug', 'Biceps'], ['optrekstang'], 3, true, false, [
    'Hang aan de stang met je handen iets breder dan je schouders.',
    'Span je buik aan en trek je schouders omlaag.',
    'Trek jezelf op tot je kin boven de stang is.',
    'Laat gecontroleerd zakken tot je armen gestrekt zijn.',
  ], 'Lukt het nog niet? Gebruik een elastiek of de assisted machine.',
  A(HANG, { ...HANG, torso: 6, arm: 205, fore: 14 }, ['arm', 'torso'], [{ k: 'line', x1: 40, y1: 9, x2: 84, y2: 9, w: 3 }])),

  tablerow: D('Roeien onder een tafel', ['Rug', 'Biceps'], [], 2, true, false, [
    'Lig onder een stevige tafel en pak de rand vast.',
    'Maak je lichaam recht, hielen op de grond.',
    'Trek je borst naar de tafel.',
    'Laat jezelf langzaam zakken.',
  ], 'Check eerst of de tafel stevig genoeg is!',
  A({ anchor: 'hand', at: [44, 40], torso: 290, thigh: 110, shin: 110, arm: 5, fore: 0, foot: 20 }, { anchor: 'hand', at: [44, 40], torso: 298, thigh: 114, shin: 114, arm: 150, fore: 5, foot: 20 }, ['arm', 'torso'], [{ k: 'rect', x: 18, y: 36, w: 42, h: 4 }, { k: 'line', x1: 22, y1: 40, x2: 22, y2: 92, w: 3 }])),

  bottlerow: D('Roeien met een rugzak', ['Rug', 'Biceps'], [], 1, true, true, [
    'Vul een rugzak met boeken of flessen en pak hem aan de hengsels.',
    'Buig voorover met een rechte rug en licht gebogen knieën.',
    'Trek de rugzak naar je buik en knijp je schouderbladen samen.',
    'Laat langzaam zakken.',
  ], 'Hoe zwaarder de rugzak, hoe zwaarder de oefening.',
  A(st({ torso: 70, thigh: 165, shin: 186 }), st({ torso: 70, thigh: 165, shin: 186, arm: 228, fore: 178 }), ['arm', 'torso'], [{ k: 'plate', at: 'wrist', r: 5.5 }])),

  reversefly: D('Reverse fly', ['Schouders', 'Rug'], [], 1, false, true, [
    'Pak twee lichte dumbbells of flessen en buig voorover met een rechte rug.',
    'Laat je armen hangen met een lichte buiging in je ellebogen.',
    'Til je armen zijwaarts op tot schouderhoogte en knijp je schouderbladen samen.',
    'Laat langzaam zakken.',
  ], 'Licht gewicht is genoeg: deze kleine spieren zijn snel moe.',
  A(HINGE({ torso: 76 }), HINGE({ torso: 76, arm: 262, fore: 262 }), ['arm'], [{ k: 'plate', at: 'wrist', r: 4 }])),

  superman: D('Superman', ['Rug', 'Billen'], [], 1, false, false, [
    'Lig op je buik met je armen gestrekt voor je.',
    'Til tegelijk je armen, borst en benen van de grond.',
    'Houd 2 seconden vast.',
    'Zak rustig terug.',
  ], 'Kijk naar de grond, dan blijft je nek ontspannen.',
  A({ ...LYING, torso: 270, thigh: 90, shin: 90, arm: 270, fore: 270, foot: 160 }, { ...LYING, torso: 282, thigh: 80, shin: 80, arm: 288, fore: 290, foot: 160, neck: 290 }, ['torso'])),

  /* ===== Armen ===== */
  curl: D('Biceps curl', ['Biceps'], ['dumbbells'], 1, false, true, [
    'Sta rechtop met een dumbbell in elke hand, handpalmen naar voren.',
    'Ellebogen stil naast je lichaam.',
    'Krul de dumbbells omhoog naar je schouders.',
    'Laat langzaam zakken.',
  ], 'Laten zakken in 3 tellen geeft meer resultaat dan zwaarder gewicht.',
  A(st({ arm: 178, fore: 178 }), st({ arm: 172, fore: 22 }), ['arm'], [db])),

  barbellcurl: D('Curl met stang', ['Biceps'], ['stang'], 2, false, true, [
    'Pak de stang op schouderbreedte, handpalmen naar voren.',
    'Ellebogen tegen je zij.',
    'Krul de stang omhoog zonder je rug te gebruiken.',
    'Laat langzaam zakken.',
  ], 'Houd je billen en buik aangespannen tegen het zwaaien.',
  A(st({ arm: 178, fore: 178 }), st({ arm: 172, fore: 22 }), ['arm'], [{ k: 'plate', at: 'wrist', r: 6 }])),

  cablecurl: D('Curl met kabel', ['Biceps'], ['kabel'], 1, false, true, [
    'Zet de katrol laag en pak de stang of het touw.',
    'Ellebogen stil naast je lichaam.',
    'Krul omhoog naar je schouders.',
    'Laat gecontroleerd zakken.',
  ], 'Knijp bovenin even extra.',
  A(st({ arm: 178, fore: 172 }), st({ arm: 172, fore: 22 }), ['arm'], [{ k: 'cable', from: [82, 90], to: 'wrist' }])),

  hammer: D('Hammer curl', ['Biceps'], ['dumbbells'], 1, false, true, [
    'Houd de dumbbells met je duimen naar boven.',
    'Ellebogen stil naast je lichaam.',
    'Krul omhoog zonder te zwaaien.',
    'Laat langzaam zakken.',
  ], 'Traint ook je onderarmen voor een sterkere grip.',
  A(st({ arm: 178, fore: 178 }), st({ arm: 172, fore: 22 }), ['arm'], [db])),

  backpackcurl: D('Curl met rugzak of flessen', ['Biceps'], [], 1, false, true, [
    'Vul een rugzak met boeken of pak twee volle flessen.',
    'Ellebogen stil naast je lichaam.',
    'Krul langzaam omhoog.',
    'Laat in 3 tellen zakken.',
  ], 'Hoe langzamer, hoe zwaarder.',
  A(st({ arm: 178, fore: 178 }), st({ arm: 172, fore: 22 }), ['arm'], [{ k: 'plate', at: 'wrist', r: 5 }])),

  pushdown: D('Triceps pushdown', ['Triceps'], ['kabel'], 1, false, true, [
    'Zet de katrol hoog met een stang of touw.',
    'Ellebogen vast tegen je zij, iets voorover.',
    'Duw naar beneden tot je armen gestrekt zijn.',
    'Laat gecontroleerd terug tot je onderarmen horizontaal zijn.',
  ], 'Alleen je onderarmen bewegen.',
  A(st({ torso: 8, arm: 174, fore: 55 }), st({ torso: 8, arm: 174, fore: 174 }), ['arm'], [{ k: 'cable', from: [82, 6], to: 'wrist' }])),

  ohtriceps: D('Triceps extension boven het hoofd', ['Triceps'], ['dumbbells'], 1, false, true, [
    'Houd één dumbbell met twee handen boven je hoofd.',
    'Laat de dumbbell achter je hoofd zakken; ellebogen wijzen naar voren.',
    'Strek je armen weer omhoog.',
    'Houd je buik aangespannen.',
  ], 'Rekt de lange kop van je triceps flink op: begin licht.',
  A(st({ arm: 8, fore: 200 }), st({ arm: 8, fore: 4 }), ['arm'], [{ k: 'plate', at: 'wrist', r: 5 }])),

  skullcrusher: D('Skull crushers', ['Triceps'], ['stang', 'bank'], 2, false, true, [
    'Lig op een bank met de stang (of dumbbells) boven je borst.',
    'Bovenarmen iets schuin naar achteren en stil houden.',
    'Buig je ellebogen en laat het gewicht naar je voorhoofd zakken.',
    'Strek je armen weer.',
  ], 'Gebruik een EZ-stang als je polsen gevoelig zijn.',
  A({ ...BENCH, arm: 345, fore: 0 }, { ...BENCH, arm: 345, fore: 248 }, ['arm'], [benchFlat, { k: 'plate', at: 'wrist', r: 6 }])),

  chairdip: D('Dips op een bank of stoel', ['Triceps'], [], 1, false, false, [
    'Zet je handen op de rand van een stevige stoel achter je.',
    'Benen gestrekt of gebogen (makkelijker).',
    'Zak door je ellebogen te buigen tot ongeveer 90°.',
    'Duw jezelf terug omhoog.',
  ], 'Houd je rug dicht bij de stoel.',
  A({ anchor: 'hand', at: [40, 67], torso: 0, thigh: 100, shin: 180, arm: 200, fore: 195 }, { anchor: 'hand', at: [40, 67], torso: 4, thigh: 80, shin: 175, arm: 250, fore: 165 }, ['arm'], [{ k: 'rect', x: 22, y: 68, w: 20, h: 4, legs: true }])),

  /* ===== Core & conditie ===== */
  plank: D('Plank', ['Core'], [], 1, false, false, [
    'Steun op je onderarmen, ellebogen onder je schouders.',
    'Lichaam in een rechte lijn van hoofd tot hielen.',
    'Span je buik en billen aan en adem rustig door.',
  ], 'Hangende heupen? Kort de tijd in en houd het strak.',
  A({ anchor: 'elbow', at: [82, 88], torso: 78, thigh: 258, shin: 258, arm: 180, fore: 90, foot: 200 }, { anchor: 'elbow', at: [82, 88], torso: 79, thigh: 259, shin: 259, arm: 180, fore: 90, foot: 200 }, ['torso'], [], { speed: 4 }), true),

  sideplank: D('Zijplank', ['Core'], [], 1, false, false, [
    'Lig op je zij en steun op één onderarm.',
    'Til je heupen op tot je lichaam een rechte lijn is.',
    'Houd vast en wissel halverwege van kant.',
  ], 'Te zwaar? Laat je onderste knie op de grond.',
  A({ anchor: 'elbow', at: [82, 88], torso: 74, thigh: 254, shin: 254, arm: 180, fore: 90, arm2: 0, fore2: 0, foot: 200 }, { anchor: 'elbow', at: [82, 88], torso: 76, thigh: 256, shin: 256, arm: 180, fore: 90, arm2: 0, fore2: 0, foot: 200 }, ['torso'], [], { speed: 4 }), true),

  deadbug: D('Dead bug', ['Core'], [], 1, false, false, [
    'Lig op je rug, armen omhoog en knieën boven je heupen (90°).',
    'Druk je onderrug tegen de grond.',
    'Strek langzaam je ene been en de tegenovergestelde arm uit.',
    'Kom terug en wissel van kant.',
  ], 'Je onderrug blijft de hele tijd op de grond.',
  A({ ...LYING, torso: 270, thigh: 0, shin: 90, thigh2: 0, shin2: 90, arm: 0, fore: 0, arm2: 0, fore2: 0, foot: 0 }, { ...LYING, torso: 270, thigh: 78, shin: 84, thigh2: 0, shin2: 90, arm: 0, fore: 0, arm2: 262, fore2: 266, foot: 0 }, ['torso'])),

  crunch: D('Crunch', ['Core'], [], 1, false, false, [
    'Lig op je rug met gebogen knieën, voeten plat.',
    'Handen langs je oren of over je borst.',
    'Rol je schouders van de grond door je buik aan te spannen.',
    'Zak langzaam terug.',
  ], 'Trek niet aan je nek; kijk schuin omhoog.',
  A({ ...LYING, torso: 270, thigh: 40, shin: 165, arm: 92, fore: 90, foot: 90 }, { ...LYING, torso: 298, thigh: 40, shin: 165, arm: 105, fore: 100, foot: 90 }, ['torso'])),

  hangingknee: D('Hangend knieheffen', ['Core'], ['optrekstang'], 2, false, false, [
    'Hang aan een stang met gestrekte armen.',
    'Trek je knieën naar je borst.',
    'Laat gecontroleerd zakken zonder te zwaaien.',
  ], 'Rol je bekken bovenin een beetje op voor extra buikspierwerk.',
  A(HANG, { ...HANG, thigh: 88, shin: 180 }, ['thigh', 'torso'], [{ k: 'line', x1: 40, y1: 9, x2: 84, y2: 9, w: 3 }])),

  cablecrunch: D('Kabel crunch', ['Core'], ['kabel'], 1, false, true, [
    'Kniel voor een hoge katrol met een touw.',
    'Houd het touw naast je hoofd.',
    'Rol je bovenlichaam naar beneden door je buik aan te spannen.',
    'Kom gecontroleerd terug.',
  ], 'Je heupen blijven stil; alleen je romp krult.',
  A({ anchor: 'knee', at: [54, 88], torso: 14, thigh: 180, shin: 270, arm: 30, fore: 200, foot: 270 }, { anchor: 'knee', at: [54, 88], torso: 112, thigh: 180, shin: 270, arm: 140, fore: 330, foot: 270 }, ['torso'], [{ k: 'cable', from: [64, 4], to: 'wrist' }])),

  mountain: D('Mountain climbers', ['Core', 'Conditie'], [], 1, false, false, [
    'Begin in opdrukpositie met gestrekte armen.',
    'Trek één knie naar je borst.',
    'Wissel snel van been, alsof je rent.',
  ], 'Houd je billen laag en je handen onder je schouders.',
  A(PUSH_TOP, { ...PUSH_TOP, thigh: 150, shin: 235 }, ['thigh'], [], { speed: 1 }), true),

  burpee: D('Burpees', ['Conditie'], [], 2, false, false, [
    'Sta rechtop en zak naar een squat met je handen op de grond.',
    'Spring met je voeten naar achteren in opdrukpositie.',
    'Spring je voeten terug naar je handen.',
    'Spring omhoog met je armen boven je hoofd.',
  ], 'Te pittig? Stap je voeten naar achteren in plaats van springen.',
  A(st({ arm: 0, fore: 0 }), SQUAT_LOW({ torso: 62, arm: 175, fore: 175 }), ['thigh'], [], { speed: 1.6 })),
};

export const EXERCISES: Record<string, Exercise> = Object.fromEntries(Object.entries(LIST).map(([id, d]) => [id, { id, ...d }]));

export const canDo = (e: Exercise, equip: Equip[]) => e.equip.every((q) => equip.includes(q));
