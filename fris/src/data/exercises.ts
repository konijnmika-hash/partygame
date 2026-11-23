export type Muscle =
  | 'Borst'
  | 'Rug'
  | 'Schouders'
  | 'Biceps'
  | 'Triceps'
  | 'Benen'
  | 'Billen'
  | 'Hamstrings'
  | 'Kuiten'
  | 'Core'
  | 'Conditie';

export interface Exercise {
  id: string;
  name: string;
  muscles: Muscle[];
  /** Compound (meergewrichts) oefening - krijgt zwaardere sets */
  compound: boolean;
  /** Gebruikt gewicht dat je kunt bijhouden */
  weighted: boolean;
  /** Tijd in seconden i.p.v. herhalingen (plank e.d.) */
  timed?: boolean;
  how: string;
}

const ex = (
  id: string,
  name: string,
  muscles: Muscle[],
  compound: boolean,
  weighted: boolean,
  how: string,
  timed = false,
): Exercise => ({ id, name, muscles, compound, weighted, how, timed });

export const EXERCISES: Record<string, Exercise> = Object.fromEntries(
  [
    // Gym
    ex('squat', 'Squat met halterstang', ['Benen', 'Billen'], true, true, 'Stang op je bovenrug, voeten op heupbreedte. Zak met een rechte rug tot je bovenbenen minstens horizontaal zijn en duw krachtig omhoog.'),
    ex('legpress', 'Beenpers', ['Benen', 'Billen'], true, true, 'Voeten op schouderbreedte midden op het platform. Laat gecontroleerd zakken tot je knieën ~90° zijn en duw weg zonder je knieën op slot te zetten.'),
    ex('rdl', 'Roemeense deadlift', ['Hamstrings', 'Billen', 'Rug'], true, true, 'Houd de stang dicht bij je benen, knieën licht gebogen. Duw je heupen naar achteren tot je rek voelt in je hamstrings en kom terug door je heupen naar voren te duwen.'),
    ex('deadlift', 'Deadlift', ['Hamstrings', 'Billen', 'Rug'], true, true, 'Stang boven je middenvoet. Rug recht, borst vooruit, en til door met je benen te duwen. Sta rechtop, laat daarna gecontroleerd zakken.'),
    ex('hipthrust', 'Hip thrust', ['Billen', 'Hamstrings'], true, true, 'Bovenrug tegen een bank, stang op je heupen. Duw je heupen omhoog tot je lichaam een rechte lijn vormt en knijp je billen samen.'),
    ex('bench', 'Bankdrukken', ['Borst', 'Triceps', 'Schouders'], true, true, 'Schouderbladen samen en omlaag. Laat de stang gecontroleerd zakken naar je onderborst en druk hem recht omhoog.'),
    ex('inclinedb', 'Schuin drukken met dumbbells', ['Borst', 'Schouders'], true, true, 'Bank op ~30°. Druk de dumbbells omhoog en iets naar elkaar toe, laat langzaam zakken tot je een rek in je borst voelt.'),
    ex('ohp', 'Schouderdrukken met dumbbells', ['Schouders', 'Triceps'], true, true, 'Zittend of staand, dumbbells op schouderhoogte. Druk omhoog tot je armen bijna gestrekt zijn, zonder hol te trekken.'),
    ex('row', 'Roeien met halterstang', ['Rug', 'Biceps'], true, true, 'Voorovergebogen met rechte rug. Trek de stang naar je navel en knijp je schouderbladen samen.'),
    ex('cablerow', 'Zittend roeien (kabel)', ['Rug', 'Biceps'], true, true, 'Rechtop zitten, trek de handgreep naar je buik en breng je schouderbladen naar elkaar. Laat gecontroleerd terug.'),
    ex('dbrow', 'Eenarmig roeien met dumbbell', ['Rug', 'Biceps'], true, true, 'Knie en hand op de bank. Trek de dumbbell langs je zij omhoog richting je heup.'),
    ex('pulldown', 'Lat pulldown', ['Rug', 'Biceps'], true, true, 'Brede greep, borst vooruit. Trek de stang naar je bovenborst en denk aan je ellebogen naar je zij brengen.'),
    ex('pullup', 'Optrekken', ['Rug', 'Biceps'], true, false, 'Hang aan de stang, trek jezelf op tot je kin boven de stang is. Lukt het nog niet? Gebruik een elastiek of de assisted machine.'),
    ex('lunge', 'Lunges met dumbbells', ['Benen', 'Billen'], true, true, 'Stap ver naar voren en zak tot je achterste knie bijna de grond raakt. Duw terug via je voorste hiel.'),
    ex('bulgarian', 'Bulgarian split squat', ['Benen', 'Billen'], true, true, 'Achterste voet op een bank. Zak recht naar beneden op je voorste been en duw terug omhoog.'),
    ex('legext', 'Leg extension', ['Benen'], false, true, 'Strek je benen volledig, houd even vast en laat langzaam zakken.'),
    ex('legcurl', 'Leg curl', ['Hamstrings'], false, true, 'Buig je knieën zo ver mogelijk, knijp aan en laat gecontroleerd terug.'),
    ex('calf', 'Kuitheffen', ['Kuiten'], false, true, 'Kom zo hoog mogelijk op je tenen, houd 1 seconde vast en zak diep terug voor een volle rek.'),
    ex('curl', 'Biceps curl', ['Biceps'], false, true, 'Ellebogen stil naast je lichaam. Krul de dumbbells omhoog en laat langzaam zakken.'),
    ex('hammer', 'Hammer curl', ['Biceps'], false, true, 'Duimen naar boven, krul omhoog zonder te zwaaien.'),
    ex('pushdown', 'Triceps pushdown', ['Triceps'], false, true, 'Ellebogen vast tegen je zij. Duw de kabel naar beneden tot je armen gestrekt zijn.'),
    ex('ohtriceps', 'Triceps extension boven het hoofd', ['Triceps'], false, true, 'Dumbbell of kabel achter je hoofd. Strek je armen omhoog, ellebogen naar voren gericht.'),
    ex('lateral', 'Zijwaartse heffingen', ['Schouders'], false, true, 'Til de dumbbells zijwaarts tot schouderhoogte met licht gebogen armen. Langzaam zakken.'),
    ex('facepull', 'Face pulls', ['Schouders', 'Rug'], false, true, 'Kabel op ooghoogte, trek het touw naar je gezicht en draai je handen naar buiten.'),
    ex('cablecrunch', 'Kabel crunch', ['Core'], false, true, 'Geknield, touw naast je hoofd. Rol je bovenlichaam naar beneden door je buikspieren aan te spannen.'),
    ex('hangingknee', 'Hangend knieheffen', ['Core'], false, false, 'Hang aan een stang en trek je knieën naar je borst zonder te zwaaien.'),

    // Thuis / lichaamsgewicht
    ex('gobletsquat', 'Goblet squat', ['Benen', 'Billen'], true, true, 'Houd een dumbbell, kettlebell of volle fles voor je borst. Zak diep tussen je knieën en kom krachtig omhoog.'),
    ex('bwsquat', 'Squat (lichaamsgewicht)', ['Benen', 'Billen'], true, false, 'Armen naar voren, zak zo diep als je kunt met je hielen op de grond en kom terug omhoog.'),
    ex('glutebridge', 'Glute bridge', ['Billen', 'Hamstrings'], true, false, 'Op je rug, voeten plat. Duw je heupen omhoog en knijp 1 seconde je billen samen.'),
    ex('slrdl', 'Eenbenige deadlift', ['Hamstrings', 'Billen'], true, false, 'Sta op één been, kantel naar voren met een rechte rug terwijl je andere been naar achteren gaat.'),
    ex('pushup', 'Opdrukken', ['Borst', 'Triceps', 'Schouders'], true, false, 'Handen iets breder dan je schouders, lichaam in een rechte lijn. Te zwaar? Doe ze op je knieën.'),
    ex('declinepushup', 'Opdrukken met voeten verhoogd', ['Borst', 'Schouders'], true, false, 'Voeten op een bank of stoel, handen op de grond. Zak met je borst richting de vloer.'),
    ex('pikepushup', 'Pike push-up', ['Schouders', 'Triceps'], true, false, 'Billen hoog (omgekeerde V). Buig je armen en breng je hoofd richting de grond.'),
    ex('tablerow', 'Roeien onder een tafel', ['Rug', 'Biceps'], true, false, 'Lig onder een stevige tafel, pak de rand en trek je borst naar de tafel met een gestrekt lichaam.'),
    ex('superman', 'Superman', ['Rug', 'Billen'], false, false, 'Op je buik, til tegelijk armen en benen van de grond en houd 2 seconden vast.'),
    ex('bwlunge', 'Lunges', ['Benen', 'Billen'], true, false, 'Stap naar voren, zak tot beide knieën ~90° zijn en duw terug.'),
    ex('chairsplit', 'Split squat op een stoel', ['Benen', 'Billen'], true, false, 'Achterste voet op een stoel, zak op je voorste been en duw omhoog.'),
    ex('chairdip', 'Dips op een stoel', ['Triceps'], false, false, 'Handen op de rand van een stoel, zak door je ellebogen te buigen en duw terug.'),
    ex('backpackcurl', 'Biceps curl met rugzak/fles', ['Biceps'], false, true, 'Gebruik dumbbells, flessen of een gevulde rugzak. Ellebogen stil, krul langzaam omhoog.'),
    ex('wallsit', 'Wall sit', ['Benen'], false, false, 'Rug tegen de muur, knieën 90°. Houd de positie vast.', true),
    ex('singlecalf', 'Kuitheffen op een traptrede', ['Kuiten'], false, false, 'Voorvoet op de rand van een trede, kom hoog op je tenen en zak diep.'),

    // Core & conditie
    ex('plank', 'Plank', ['Core'], false, false, 'Op je onderarmen, lichaam in een rechte lijn. Buik en billen aanspannen.', true),
    ex('sideplank', 'Zijplank', ['Core'], false, false, 'Op één onderarm, heupen omhoog. Wissel halverwege van kant.', true),
    ex('deadbug', 'Dead bug', ['Core'], false, false, 'Op je rug, armen en knieën omhoog. Strek langzaam tegenovergestelde arm en been, onderrug blijft op de grond.'),
    ex('mountain', 'Mountain climbers', ['Core', 'Conditie'], false, false, 'In opdruk-positie, breng snel om en om je knieën naar je borst.', true),
    ex('burpee', 'Burpees', ['Conditie'], false, false, 'Squat, handen op de grond, spring naar plank, terug en spring omhoog.'),
  ].map((e) => [e.id, e]),
);
