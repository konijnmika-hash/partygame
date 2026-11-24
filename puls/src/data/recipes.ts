// Recepten van Puls. Hoeveelheden zijn per portie en verwijzen naar producten in de voedingsdatabase,
// zodat calorieën en macro's precies kloppen. Kruiden, zout en peper tellen niet mee.
import type { MealKey } from '../lib/types';

/** Ondergrond van de foto */
export type Bg = 'hout' | 'eiken' | 'linnen' | 'marmer' | 'leisteen' | 'terrazzo';
/** Waar het gerecht in of op ligt */
export type Dish = 'kom' | 'bord' | 'pan' | 'plank' | 'pot' | 'glas';
/** Wat de kom of het bord vult */
export type Base =
  | 'kwark' | 'pap' | 'smoothie' | 'soep' | 'curry' | 'dahl' | 'chili' | 'bolognese' | 'rijst' | 'quinoa'
  | 'couscous' | 'bulgur' | 'salade' | 'spinazie' | 'noedels' | 'omelet' | 'hummus' | 'linzen' | 'tomatensaus';

export type Item =
  | 'blauwe-bes' | 'framboos' | 'aardbei' | 'banaan' | 'appel' | 'kiwi' | 'mango' | 'granola' | 'walnoot' | 'amandel'
  | 'chia' | 'sesam' | 'pompoenpit' | 'kokos' | 'chilivlok' | 'peper' | 'kruid' | 'honing' | 'ahorn' | 'pesto-druppel'
  | 'gebakken-ei' | 'half-ei' | 'roerei' | 'avocado' | 'avocado-mash' | 'cherrytomaat' | 'tomaat' | 'komkommer'
  | 'sla' | 'rucola' | 'spinazie' | 'peterselie' | 'zalm' | 'gerookte-zalm' | 'kip' | 'kip-stuk' | 'kabeljauw'
  | 'broccoli' | 'boon-groen' | 'wortel' | 'wortelstick' | 'paprika' | 'paprika-geel' | 'mais' | 'kikkererwt'
  | 'zwarte-boon' | 'kidneyboon' | 'edamame' | 'edamame-peul' | 'feta' | 'mozzarella' | 'kaas' | 'parmezaan'
  | 'falafel' | 'dollop' | 'rode-ui' | 'citroen' | 'limoen' | 'champignon' | 'krieltje' | 'zoete-aardappel'
  | 'toast' | 'toast-volkoren' | 'bagel' | 'cracker' | 'rijstwafel' | 'wrap' | 'pannenkoek' | 'energiebal'
  | 'chocola' | 'dadel' | 'paksoi' | 'lente-ui' | 'rijst' | 'quinoa' | 'hummus' | 'tzatziki' | 'croutons'
  | 'pompoen' | 'mozzarella-plak' | 'gnocchi';

/** [item, aantal, x, y, straal van het gebied, grootte] - x/y van -1 tot 1 binnen de schaal of plank */
export type Part = [Item, number, number, number, number, number?];

export interface Art {
  bg: Bg;
  dish: Dish;
  /** kleur van het servies */
  tint?: string;
  base?: Base;
  parts: Part[];
  /** lagen van onder naar boven voor pot en glas: [kleur, hoogte 0-1] */
  layers?: [string, number][];
  /** losse ingrediënten op tafel rond het gerecht */
  side?: Part[];
}

export type Ingredient = [food: string, grams: number] | string;

export interface Step {
  t: string;
  /** minuten, voor de kookwekker */
  min?: number;
}

export interface Recipe {
  id: string;
  name: string;
  meal: MealKey;
  /** totale bereidingstijd in minuten */
  minutes: number;
  intro: string;
  ing: Ingredient[];
  steps: Step[];
  tip?: string;
  /** handmatige labels; vega, eiwitrijk en snel worden berekend */
  tags?: ('mealprep' | 'budget' | 'zoet' | 'comfort')[];
  art: Art;
  /** optioneel: pad naar een echte foto in public/, bijv. "recepten/overnight-oats.jpg" */
  photo?: string;
}

export const RECIPES: Recipe[] = [
  /* ------------------------------ Ontbijt ------------------------------ */
  {
    id: 'overnight-oats',
    name: 'Overnight oats met blauwe bessen',
    meal: 'ontbijt',
    minutes: 5,
    intro: 'Vanavond in 5 minuten klaargezet, morgenochtend meteen pakken. Romig, vullend en vol eiwit door de skyr.',
    ing: [['Havermout', 50], ['Halfvolle melk', 125], ['Skyr naturel', 100], ['Chiazaad', 10], ['Blauwe bessen', 75], ['Honing', 7], 'snufje kaneel'],
    steps: [
      { t: 'Roer havermout, chiazaad, kaneel, melk en de helft van de skyr door elkaar in een pot of bakje.' },
      { t: 'Sluit af en zet minstens 4 uur (of een nacht) in de koelkast.' },
      { t: 'Schep de rest van de skyr erop, verdeel de blauwe bessen erover en druppel de honing erop.' },
    ],
    tip: 'Maak er drie tegelijk: ze blijven 3 dagen goed in de koelkast.',
    tags: ['mealprep'],
    art: {
      bg: 'eiken', dish: 'pot',
      layers: [['#d9c39a', 0.32], ['#f6f1e6', 0.16], ['#5a4fa2', 0.1], ['#efe6d2', 0.22]],
      parts: [['blauwe-bes', 9, 0, 0, 0.8, 7], ['honing', 1, 0, 0, 0.6]],
      side: [['blauwe-bes', 5, 0.78, 0.7, 0.18, 7], ['kruid', 2, -0.8, 0.75, 0.12, 9]],
    },
  },
  {
    id: 'kwarkbowl-aardbei',
    name: 'Kwarkbowl met aardbei en granola',
    meal: 'ontbijt',
    minutes: 5,
    intro: 'Het snelste eiwitrijke ontbijt dat er is: 20 gram eiwit in een paar tikken, met crunch van granola.',
    ing: [['Magere kwark', 200], ['Aardbeien', 100], ['Granola', 30], ['Honing', 7]],
    steps: [
      { t: 'Schep de kwark in een kom en roer hem even luchtig.' },
      { t: 'Halveer de aardbeien en leg ze op de kwark.' },
      { t: 'Strooi de granola erover en maak af met een streep honing.' },
    ],
    tip: 'Geen aardbeien? Diepvries-bosvruchten werken ook: laat ze 10 minuten ontdooien.',
    art: {
      bg: 'linnen', dish: 'kom', tint: '#e8ede6', base: 'kwark',
      parts: [['granola', 14, 0.3, 0.15, 0.55, 9], ['aardbei', 8, -0.3, -0.15, 0.55, 14], ['blauwe-bes', 4, 0.1, -0.5, 0.3, 7], ['honing', 1, 0, 0, 0.6]],
      side: [['aardbei', 2, 0.85, -0.75, 0.15, 13]],
    },
  },
  {
    id: 'banaan-pannenkoekjes',
    name: 'Banaan-havermoutpannenkoekjes',
    meal: 'ontbijt',
    minutes: 15,
    intro: 'Drie ingrediënten, geen bloem en geen suiker. Smaakt als een weekendontbijt, past gewoon in je doel.',
    ing: [['Banaan', 100], ['Ei (rauw)', 110], ['Havermout', 40], ['Boter', 5], ['Skyr naturel', 50], ['Blauwe bessen', 50], 'snufje kaneel'],
    steps: [
      { t: 'Prak de banaan fijn en klop de eieren, havermout en kaneel erdoor tot een dik beslag.' },
      { t: 'Smelt de boter in een koekenpan op middelhoog vuur.' },
      { t: 'Schep kleine hoopjes beslag in de pan en bak ze 2 minuten per kant tot ze goudbruin zijn.', min: 6 },
      { t: 'Stapel ze op een bord met een lepel skyr en de blauwe bessen.' },
    ],
    tags: ['zoet'],
    art: {
      bg: 'hout', dish: 'bord', tint: '#f4f1ea',
      parts: [['pannenkoek', 1, 0.05, 0.07, 0.02, 78], ['pannenkoek', 1, -0.02, 0.01, 0.02, 75], ['pannenkoek', 1, 0, -0.05, 0.02, 72], ['dollop', 1, 0, -0.05, 0.05, 16], ['blauwe-bes', 9, 0.05, 0.05, 0.45, 7], ['ahorn', 1, 0, 0, 0.4]],
      side: [['banaan', 3, -0.85, 0.7, 0.18, 12]],
    },
  },
  {
    id: 'avocado-toast-ei',
    name: 'Avocadotoast met ei',
    meal: 'ontbijt',
    minutes: 10,
    intro: 'Krokant zuurdesem, romige avocado en een zacht eitje. Gezonde vetten en eiwit die je tot de lunch vol houden.',
    ing: [['Zuurdesembrood', 80], ['Avocado', 70], ['Ei (rauw)', 110], ['Tomaat', 45], ['Citroen', 5], 'chilivlokken', 'zout en peper'],
    steps: [
      { t: 'Kook water en pocheer of bak de eieren in 3 tot 4 minuten.', min: 4 },
      { t: 'Rooster intussen het brood.' },
      { t: 'Prak de avocado met een kneepje citroen, zout en peper.' },
      { t: 'Besmeer het brood, leg het ei erop en maak af met tomaatjes en chilivlokken.' },
    ],
    art: {
      bg: 'leisteen', dish: 'plank',
      parts: [['toast', 1, -0.42, 0, 0.05, 60], ['toast', 1, 0.42, 0.02, 0.05, 60], ['avocado-mash', 1, -0.42, 0, 0.05, 44], ['avocado-mash', 1, 0.42, 0.02, 0.05, 44],
        ['gebakken-ei', 1, -0.42, 0, 0.05, 30], ['gebakken-ei', 1, 0.42, 0.02, 0.05, 30], ['chilivlok', 14, 0, 0, 0.8], ['cherrytomaat', 3, 0, 0.75, 0.25, 11]],
    },
  },
  {
    id: 'roerei-spinazie',
    name: 'Roerei met spinazie en volkorentoast',
    meal: 'ontbijt',
    minutes: 10,
    intro: 'Een klassieker met een flinke lading groente en ruim 30 gram eiwit. Ideaal na een ochtendtraining.',
    ing: [['Ei (rauw)', 165], ['Spinazie', 60], ['Kaas 30+', 20], ['Boter', 5], ['Volkorenbrood', 70], 'zout en peper'],
    steps: [
      { t: 'Klop de eieren los met zout en peper.' },
      { t: 'Smelt de boter, laat de spinazie in 1 minuut slinken.', min: 1 },
      { t: 'Giet de eieren erbij en schuif ze op laag vuur langzaam heen en weer tot ze net gestold zijn.', min: 3 },
      { t: 'Strooi de kaas erover en serveer met het geroosterde brood.' },
    ],
    art: {
      bg: 'marmer', dish: 'bord', tint: '#ffffff',
      parts: [['spinazie', 7, 0.15, 0.15, 0.5, 16], ['roerei', 1, 0.2, 0, 0.1, 56], ['kaas', 10, 0.15, 0, 0.35], ['peper', 14, 0.1, 0, 0.5], ['toast-volkoren', 1, -0.55, -0.05, 0.05, 42], ['toast-volkoren', 1, -0.45, 0.25, 0.05, 40]],
    },
  },
  {
    id: 'smoothiebowl-bosvruchten',
    name: 'Bosvruchten-smoothiebowl',
    meal: 'ontbijt',
    minutes: 5,
    intro: 'Dik, koud en knalpaars. Skyr maakt hem eiwitrijk, de toppings geven crunch.',
    ing: [['Bosvruchten (diepvries)', 150], ['Banaan', 60], ['Skyr naturel', 150], ['Granola', 20], ['Kiwi', 40], ['Kokosrasp', 5]],
    steps: [
      { t: 'Blend de bevroren bosvruchten, banaan en skyr tot een dikke smoothie. Voeg alleen een scheutje water toe als het echt niet draait.' },
      { t: 'Giet in een kom.' },
      { t: 'Leg kiwi, granola en kokos in rijtjes erop.' },
    ],
    tags: ['zoet'],
    art: {
      bg: 'terrazzo', dish: 'kom', tint: '#f3efe7', base: 'smoothie',
      parts: [['kiwi', 4, -0.5, -0.05, 0.35, 15], ['granola', 10, -0.05, 0, 0.3, 9], ['banaan', 4, 0.45, 0.05, 0.35, 13], ['kokos', 24, 0.05, 0.4, 0.4], ['blauwe-bes', 6, 0.05, -0.55, 0.3, 7]],
    },
  },
  {
    id: 'bagel-zalm',
    name: 'Bagel met gerookte zalm',
    meal: 'ontbijt',
    minutes: 5,
    intro: 'Een weekendontbijt dat in 5 minuten op tafel staat. Omega-3 uit de zalm en verse crunch van komkommer.',
    ing: [['Bagel', 90], ['Smeerkaas', 30], ['Gerookte zalm', 50], ['Komkommer', 30], ['Citroen', 5], 'verse dille'],
    steps: [
      { t: 'Snijd de bagel open en rooster hem kort.' },
      { t: 'Besmeer met smeerkaas en beleg met komkommer en zalm.' },
      { t: 'Kneepje citroen, wat dille en peper erover.' },
    ],
    art: {
      bg: 'linnen', dish: 'bord', tint: '#dfe7ee',
      parts: [['bagel', 1, -0.38, 0, 0.05, 50], ['bagel', 1, 0.38, 0, 0.05, 50], ['gerookte-zalm', 2, -0.38, 0, 0.15, 24], ['komkommer', 3, 0.38, 0, 0.25, 12], ['gerookte-zalm', 1, 0.38, 0.05, 0.05, 22], ['kruid', 5, 0, 0, 0.7, 7]],
      side: [['citroen', 1, 0.85, 0.72, 0.05, 18]],
    },
  },
  {
    id: 'cracker-huttenkase',
    name: 'Knäckebröd met hüttenkäse en tomaat',
    meal: 'ontbijt',
    minutes: 3,
    intro: 'Licht, knapperig en verrassend vullend. Perfect als je weinig tijd of trek hebt.',
    ing: [['Knäckebröd volkoren', 36], ['Hüttenkäse', 100], ['Tomaat', 80], 'zwarte peper', 'verse basilicum'],
    steps: [
      { t: 'Schep de hüttenkäse op de crackers.' },
      { t: 'Leg plakjes tomaat erop en maak af met peper en basilicum.' },
    ],
    tags: ['budget'],
    art: {
      bg: 'eiken', dish: 'plank',
      parts: [['cracker', 1, -0.55, -0.05, 0.05, 40], ['cracker', 1, 0, 0.05, 0.05, 40], ['cracker', 1, 0.55, -0.05, 0.05, 40], ['dollop', 3, 0, 0, 0.6, 14], ['cherrytomaat', 6, 0, 0, 0.7, 9], ['kruid', 4, 0, 0, 0.7, 7], ['peper', 20, 0, 0, 0.8]],
    },
  },
  {
    id: 'appel-kaneel-pap',
    name: 'Appel-kaneel havermoutpap',
    meal: 'ontbijt',
    minutes: 8,
    intro: 'Warm, troostend en goedkoop. De walnoten geven goede vetten en een lekkere bite.',
    ing: [['Havermout', 50], ['Halfvolle melk', 250], ['Appel', 75], ['Walnoten', 10], ['Ahornsiroop', 5], 'theelepel kaneel'],
    steps: [
      { t: 'Breng melk met havermout en kaneel aan de kook en laat 4 minuten zachtjes pruttelen. Blijf roeren.', min: 4 },
      { t: 'Snijd intussen de appel in dunne partjes.' },
      { t: 'Schep de pap in een kom, leg de appel en walnoten erop en druppel er wat ahornsiroop over.' },
    ],
    tags: ['budget', 'comfort'],
    art: {
      bg: 'hout', dish: 'kom', tint: '#2f4b45', base: 'pap',
      parts: [['appel', 7, 0.15, -0.15, 0.45, 16], ['walnoot', 6, -0.35, 0.35, 0.35, 10], ['ahorn', 1, 0, 0, 0.45], ['peper', 10, 0, 0, 0.6]],
      side: [['walnoot', 2, -0.85, -0.75, 0.15, 10]],
    },
  },

  /* ------------------------------ Lunch ------------------------------ */
  {
    id: 'wrap-kip-pesto',
    name: 'Wrap met kip, pesto en mozzarella',
    meal: 'lunch',
    minutes: 10,
    intro: 'Mee te nemen naar werk of school. Veel eiwit, frisse rucola en de zomerse smaak van pesto.',
    ing: [['Volkoren wrap', 60], ['Kipfilet (gebakken)', 100], ['Pesto', 15], ['Mozzarella', 30], ['Tomaat', 60], ['Rucola', 20]],
    steps: [
      { t: 'Bak de kipfilet in reepjes gaar, of gebruik restjes van gisteren.', min: 6 },
      { t: 'Besmeer de wrap met pesto.' },
      { t: 'Leg rucola, tomaat, mozzarella en kip erop, rol strak op en snijd schuin doormidden.' },
    ],
    tags: ['mealprep'],
    art: {
      bg: 'leisteen', dish: 'plank',
      parts: [['wrap', 1, -0.3, -0.02, 0.05, 50], ['wrap', 1, 0.3, 0.06, 0.05, 50], ['rucola', 5, 0, 0.75, 0.5, 13], ['cherrytomaat', 3, 0.75, -0.6, 0.2, 11]],
    },
  },
  {
    id: 'linzensalade-feta',
    name: 'Linzensalade met feta',
    meal: 'lunch',
    minutes: 10,
    intro: 'Plantaardig eiwit, veel vezels en een frisse dressing. Smaakt de volgende dag nog beter.',
    ing: [['Linzen (gekookt)', 150], ['Feta', 30], ['Komkommer', 80], ['Tomaat', 80], ['Ui', 20], ['Rucola', 20], ['Olijfolie', 7], ['Citroen', 10], 'peper en oregano'],
    steps: [
      { t: 'Spoel de linzen af en laat uitlekken.' },
      { t: 'Snijd komkommer, tomaat en rode ui klein.' },
      { t: 'Meng met olijfolie, citroensap, oregano en peper.' },
      { t: 'Schep op de rucola en verkruimel de feta erover.' },
    ],
    tags: ['mealprep', 'budget'],
    art: {
      bg: 'marmer', dish: 'kom', tint: '#c7d9cf', base: 'linzen',
      parts: [['rucola', 6, -0.45, -0.35, 0.35, 15], ['komkommer', 5, 0.4, -0.3, 0.35, 12], ['cherrytomaat', 5, 0.35, 0.35, 0.35, 11], ['rode-ui', 4, -0.3, 0.35, 0.35, 9], ['feta', 9, 0, 0, 0.55, 8], ['kruid', 4, 0, 0, 0.6, 6]],
    },
  },
  {
    id: 'tonijnsalade-brood',
    name: 'Open broodjes tonijnsalade',
    meal: 'lunch',
    minutes: 7,
    intro: 'Tonijnsalade met Griekse yoghurt in plaats van mayo: net zo romig, veel minder calorieën.',
    ing: [['Volkorenbrood', 70], ['Tonijn in water (uitgelekt)', 80], ['Griekse yoghurt 0%', 30], ['Mayonaise', 5], ['Ui', 15], ['Maïs', 30], ['Sla', 20], 'peper en citroen'],
    steps: [
      { t: 'Prak de tonijn met yoghurt, mayonaise, fijngesneden ui en maïs. Breng op smaak met peper en citroen.' },
      { t: 'Leg sla op het brood en schep de tonijnsalade erop.' },
    ],
    tags: ['budget'],
    art: {
      bg: 'eiken', dish: 'plank',
      parts: [['toast-volkoren', 1, -0.42, 0, 0.05, 56], ['toast-volkoren', 1, 0.42, 0.03, 0.05, 56], ['sla', 1, -0.42, 0, 0.05, 40], ['sla', 1, 0.42, 0.03, 0.05, 40], ['dollop', 1, -0.42, 0, 0.05, 30], ['dollop', 1, 0.42, 0.03, 0.05, 30], ['mais', 10, 0, 0, 0.55, 5], ['rode-ui', 3, 0, 0, 0.55, 7], ['peper', 14, 0, 0, 0.6]],
    },
  },
  {
    id: 'tomatensoep-linzen',
    name: 'Tomatensoep met rode linzen',
    meal: 'lunch',
    minutes: 25,
    intro: 'Een dikke, verwarmende soep die écht vult dankzij de linzen. Maak een grote pan en vries porties in.',
    ing: [['Tomatenblokjes (blik)', 200], ['Linzen (gekookt)', 100], ['Ui', 50], ['Wortel', 60], ['Knoflook', 4], ['Olijfolie', 5], ['Griekse yoghurt 0%', 30], ['Volkorenbrood', 35], 'bouillonblokje en paprikapoeder'],
    steps: [
      { t: 'Fruit ui, wortel en knoflook in de olie in 5 minuten zacht.', min: 5 },
      { t: 'Voeg tomatenblokjes, linzen, paprikapoeder en 200 ml bouillon toe.' },
      { t: 'Laat 15 minuten zachtjes koken.', min: 15 },
      { t: 'Pureer glad, schep in een kom en maak af met een lepel yoghurt. Lekker met een snee brood.' },
    ],
    tags: ['mealprep', 'budget', 'comfort'],
    art: {
      bg: 'linnen', dish: 'kom', tint: '#f2ede4', base: 'soep',
      parts: [['tzatziki', 1, 0.05, 0, 0.05, 24], ['kruid', 5, 0.05, 0, 0.3, 7], ['peper', 12, 0, 0, 0.55]],
      side: [['toast-volkoren', 1, 0.86, 0.55, 0.05, 40]],
    },
  },
  {
    id: 'quinoasalade-kikkererwten',
    name: 'Quinoasalade met kikkererwten',
    meal: 'lunch',
    minutes: 15,
    intro: 'Kleurrijk, plantaardig en vol vezels. Een perfecte lunch om de avond ervoor te maken.',
    ing: [['Quinoa (gekookt)', 150], ['Kikkererwten (uitgelekt)', 80], ['Paprika', 75], ['Komkommer', 60], ['Feta', 25], ['Olijfolie', 7], ['Citroen', 10], 'verse munt of peterselie'],
    steps: [
      { t: 'Kook de quinoa volgens de verpakking en laat afkoelen.', min: 12 },
      { t: 'Snijd paprika en komkommer in blokjes.' },
      { t: 'Meng alles met olie, citroen en de verse kruiden. Verkruimel de feta erover.' },
    ],
    tags: ['mealprep'],
    art: {
      bg: 'terrazzo', dish: 'kom', tint: '#e9dfcf', base: 'quinoa',
      parts: [['kikkererwt', 12, -0.38, -0.32, 0.32, 8], ['paprika', 6, 0.38, -0.32, 0.32, 13], ['komkommer', 5, 0.38, 0.38, 0.3, 11], ['feta', 8, -0.35, 0.38, 0.3, 8], ['peterselie', 6, 0, 0, 0.6, 7]],
    },
  },
  {
    id: 'omelet-champignon',
    name: 'Omelet met champignons en kaas',
    meal: 'lunch',
    minutes: 10,
    intro: 'Snel, warm en eiwitrijk. Gooi erin wat je nog aan groente hebt liggen.',
    ing: [['Ei (rauw)', 165], ['Champignons', 80], ['Kaas 30+', 20], ['Lente-ui', 15], ['Olijfolie', 5], ['Volkorenbrood', 35], 'zout en peper'],
    steps: [
      { t: 'Bak de champignons in de olie goudbruin.', min: 4 },
      { t: 'Giet de losgeklopte eieren erover en laat op laag vuur stollen.', min: 3 },
      { t: 'Strooi kaas en lente-ui erover, vouw dubbel en serveer met brood.' },
    ],
    art: {
      bg: 'hout', dish: 'pan',
      base: 'omelet',
      parts: [['champignon', 7, 0, 0, 0.55, 12], ['kaas', 12, 0, 0, 0.5], ['lente-ui', 10, 0, 0, 0.6, 5], ['peper', 14, 0, 0, 0.7]],
    },
  },
  {
    id: 'caesarsalade-kip',
    name: 'Lichte caesarsalade met kip',
    meal: 'lunch',
    minutes: 15,
    intro: 'Alle smaak van een caesarsalade, met een yoghurtdressing die de helft lichter is.',
    ing: [['Kipfilet (gebakken)', 120], ['Sla', 80], ['Parmezaanse kaas', 10], ['Volkorenbrood', 30], ['Griekse yoghurt 0%', 40], ['Mayonaise', 5], ['Citroen', 5], 'knoflook en mosterd'],
    steps: [
      { t: 'Bak de kip gaar en snijd in plakjes.', min: 8 },
      { t: 'Rooster blokjes brood in een droge pan tot croutons.', min: 3 },
      { t: 'Roer yoghurt, mayonaise, citroen, een beetje knoflook en mosterd tot dressing.' },
      { t: 'Hussel de sla met de dressing, leg kip en croutons erop en schaaf de Parmezaan erover.' },
    ],
    art: {
      bg: 'marmer', dish: 'kom', tint: '#ffffff', base: 'salade',
      parts: [['kip', 5, 0.1, 0, 0.4, 20], ['croutons', 7, -0.3, 0.2, 0.5, 8], ['parmezaan', 10, 0, 0, 0.6], ['peper', 12, 0, 0, 0.6]],
      side: [['citroen', 1, -0.85, 0.7, 0.05, 18]],
    },
  },
  {
    id: 'falafel-bowl',
    name: 'Falafelbowl met hummus',
    meal: 'lunch',
    minutes: 15,
    intro: 'Een Midden-Oosterse lunchbowl vol kleur. Vegetarisch en lekker vullend.',
    ing: [['Couscous (bereid)', 120], ['Falafel', 80], ['Hummus', 40], ['Tomaat', 60], ['Komkommer', 60], ['Griekse yoghurt 0%', 30], 'citroen en peterselie'],
    steps: [
      { t: 'Bereid de couscous met heet water en laat 5 minuten wellen.', min: 5 },
      { t: 'Verwarm de falafel in de oven of airfryer.', min: 8 },
      { t: 'Verdeel couscous, groente, falafel, hummus en yoghurt in de kom.' },
    ],
    art: {
      bg: 'leisteen', dish: 'kom', tint: '#d8c7b0', base: 'couscous',
      parts: [['hummus', 1, -0.35, 0.3, 0.05, 30], ['falafel', 4, 0.35, -0.25, 0.3, 13], ['cherrytomaat', 4, -0.4, -0.3, 0.25, 11], ['komkommer', 3, 0.4, 0.35, 0.25, 11], ['tzatziki', 1, 0.05, 0.05, 0.05, 16], ['peterselie', 6, 0, 0, 0.6, 7]],
    },
  },
  {
    id: 'tosti-caprese',
    name: 'Tosti caprese',
    meal: 'lunch',
    minutes: 8,
    intro: 'Een tosti met Italiaanse twist: gesmolten mozzarella, tomaat en pesto.',
    ing: [['Volkorenbrood', 70], ['Mozzarella', 50], ['Tomaat', 60], ['Pesto', 10], ['Rucola', 10]],
    steps: [
      { t: 'Besmeer een snee met pesto, beleg met mozzarella en tomaat en dek af.' },
      { t: 'Bak in een tosti-ijzer of pan in 4 minuten goudbruin.', min: 4 },
      { t: 'Snijd schuin doormidden en serveer met rucola.' },
    ],
    tags: ['comfort'],
    art: {
      bg: 'eiken', dish: 'bord', tint: '#f4efe6',
      parts: [['toast', 1, -0.2, -0.05, 0.05, 56], ['toast', 1, 0.25, 0.1, 0.05, 56], ['rucola', 6, 0.1, -0.55, 0.3, 13], ['cherrytomaat', 2, -0.5, 0.5, 0.15, 11]],
    },
  },

  /* ------------------------------ Avondeten ------------------------------ */
  {
    id: 'teriyaki-zalm',
    name: 'Teriyaki-zalm met rijst en broccoli',
    meal: 'diner',
    minutes: 25,
    intro: 'Glanzende zalm met een zoet-zoute saus. Een restaurantgerecht dat je thuis in 25 minuten maakt.',
    ing: [['Zalm (gebakken)', 125], ['Zilvervliesrijst (gekookt)', 150], ['Broccoli', 150], ['Sojasaus', 15], ['Honing', 7], ['Sesamzaad', 3], 'stukje gember en knoflook'],
    steps: [
      { t: 'Kook de rijst.', min: 20 },
      { t: 'Roer sojasaus, honing, geraspte gember en knoflook tot teriyakisaus.' },
      { t: 'Bak de zalm 3 minuten op de huid, keer en schenk de saus erbij. Laat 2 minuten indikken.', min: 5 },
      { t: 'Stoom de broccoli in 4 minuten beetgaar.', min: 4 },
      { t: 'Serveer met sesamzaad.' },
    ],
    art: {
      bg: 'leisteen', dish: 'bord', tint: '#e9e4da',
      parts: [['rijst', 1, -0.45, 0.1, 0.05, 50], ['broccoli', 5, 0.45, 0.35, 0.3, 17], ['zalm', 1, 0.15, -0.25, 0.05, 44], ['sesam', 18, 0.15, -0.25, 0.35], ['lente-ui', 8, 0, 0, 0.6, 5]],
    },
  },
  {
    id: 'kip-curry-kokos',
    name: 'Kip-kokoscurry met spinazie',
    meal: 'diner',
    minutes: 25,
    intro: 'Romige curry met lichte kokosmelk: alle smaak, de helft van de calorieën van een afhaalcurry.',
    ing: [['Kipfilet (gebakken)', 130], ['Kokosmelk light', 100], ['Kerriepasta', 15], ['Spinazie', 100], ['Ui', 50], ['Witte rijst (gekookt)', 150], 'limoen en koriander'],
    steps: [
      { t: 'Zet de rijst op.', min: 15 },
      { t: 'Fruit de ui, voeg de kerriepasta toe en bak 1 minuut mee.', min: 3 },
      { t: 'Bak de kip in blokjes mee tot hij rondom kleurt.', min: 5 },
      { t: 'Schenk de kokosmelk erbij en laat 8 minuten pruttelen.', min: 8 },
      { t: 'Roer de spinazie erdoor tot hij slinkt. Serveer met rijst en een partje limoen.' },
    ],
    tags: ['mealprep', 'comfort'],
    art: {
      bg: 'hout', dish: 'kom', tint: '#1f3a4a', base: 'curry',
      parts: [['rijst', 1, -0.4, -0.3, 0.05, 36], ['kip-stuk', 8, 0.15, 0.15, 0.5, 11], ['spinazie', 4, 0.3, 0.3, 0.4, 12], ['limoen', 1, 0.55, -0.4, 0.05, 15], ['peterselie', 7, 0, 0, 0.6, 7]],
    },
  },
  {
    id: 'bolognese-groente',
    name: 'Spaghetti bolognese met verstopte groente',
    meal: 'diner',
    minutes: 30,
    intro: 'Het favoriete gerecht van iedereen, met wortel en courgette die je niet proeft maar wel binnenkrijgt.',
    ing: [['Volkoren pasta (gekookt)', 200], ['Mager rundergehakt (gebakken)', 100], ['Pastasaus (tomaat)', 150], ['Wortel', 50], ['Courgette', 80], ['Ui', 40], ['Parmezaanse kaas', 10], 'oregano en knoflook'],
    steps: [
      { t: 'Rasp wortel en courgette fijn, snipper de ui.' },
      { t: 'Bak het gehakt rul, voeg de groente en ui toe en bak 5 minuten mee.', min: 5 },
      { t: 'Voeg pastasaus en oregano toe en laat 15 minuten pruttelen.', min: 15 },
      { t: 'Kook intussen de pasta beetgaar.', min: 10 },
      { t: 'Serveer met Parmezaan.' },
    ],
    tags: ['mealprep', 'comfort'],
    art: {
      bg: 'linnen', dish: 'bord', tint: '#ffffff', base: 'bolognese',
      parts: [['parmezaan', 16, 0, 0, 0.4], ['kruid', 4, 0.05, -0.05, 0.2, 8], ['peper', 10, 0, 0, 0.5]],
      side: [['cherrytomaat', 3, -0.86, 0.66, 0.15, 11]],
    },
  },
  {
    id: 'pokebowl-zalm',
    name: 'Pokébowl met zalm en edamame',
    meal: 'diner',
    minutes: 20,
    intro: 'Een bowl vol kleur, eiwit en goede vetten. Net zo lekker als bij de pokébar, voor een fractie van de prijs.',
    ing: [['Witte rijst (gekookt)', 150], ['Zalm (gebakken)', 100], ['Edamame', 60], ['Komkommer', 60], ['Wortel', 40], ['Avocado', 50], ['Sojasaus', 10], ['Sesamzaad', 3]],
    steps: [
      { t: 'Kook de rijst en laat iets afkoelen.', min: 15 },
      { t: 'Bak de zalm kort en snijd in blokjes. Kook de edamame 3 minuten.', min: 5 },
      { t: 'Snijd komkommer, wortel en avocado.' },
      { t: 'Leg alles in vakjes op de rijst en maak af met sojasaus en sesam.' },
    ],
    art: {
      bg: 'terrazzo', dish: 'kom', tint: '#2d3a5a', base: 'rijst',
      parts: [['zalm', 4, -0.4, -0.38, 0.28, 20], ['edamame', 18, 0.42, -0.36, 0.3, 7], ['komkommer', 5, 0.45, 0.4, 0.28, 11], ['wortelstick', 8, -0.42, 0.42, 0.28, 12], ['avocado', 4, 0, 0.02, 0.18, 17], ['sesam', 30, 0, 0, 0.75], ['lente-ui', 10, 0, 0, 0.6, 5]],
    },
  },
  {
    id: 'zoete-aardappel-bonen',
    name: 'Gevulde zoete aardappel met zwarte bonen',
    meal: 'diner',
    minutes: 40,
    intro: 'Mexicaans gekruid, zoet en hartig tegelijk. Vegetarisch comfortfood dat je lang verzadigd houdt.',
    ing: [['Zoete aardappel (gekookt)', 250], ['Zwarte bonen (uitgelekt)', 100], ['Maïs', 40], ['Paprika', 50], ['Kaas 30+', 20], ['Griekse yoghurt 0%', 40], 'komijn, paprikapoeder en limoen'],
    steps: [
      { t: 'Halveer de zoete aardappel en rooster 35 minuten op 200 °C.', min: 35 },
      { t: 'Verwarm bonen, maïs en paprika met de kruiden in een pan.', min: 5 },
      { t: 'Prak het vruchtvlees een beetje los, schep de vulling erop en strooi de kaas erover.' },
      { t: 'Maak af met een lepel yoghurt en limoen.' },
    ],
    tags: ['budget'],
    art: {
      bg: 'eiken', dish: 'bord', tint: '#e7ddd0',
      parts: [['zoete-aardappel', 1, -0.3, 0, 0.05, 56], ['zoete-aardappel', 1, 0.32, 0.05, 0.05, 56], ['zwarte-boon', 9, -0.3, 0, 0.3, 6], ['zwarte-boon', 9, 0.32, 0.05, 0.3, 6], ['mais', 10, 0, 0, 0.55, 5], ['tzatziki', 1, -0.3, 0, 0.05, 12], ['tzatziki', 1, 0.32, 0.05, 0.05, 12], ['peterselie', 6, 0, 0, 0.6, 6]],
      side: [['limoen', 1, 0.86, -0.68, 0.05, 16]],
    },
  },
  {
    id: 'wok-kip-paksoi',
    name: 'Noedelwok met kip en paksoi',
    meal: 'diner',
    minutes: 20,
    intro: 'Sneller dan bezorgen. Knapperige groente, malse kip en hartige noedels uit één pan.',
    ing: [['Noedels (gekookt)', 200], ['Kipfilet (gebakken)', 120], ['Paksoi', 150], ['Paprika', 75], ['Sojasaus', 15], ['Olijfolie', 7], ['Knoflook', 4], ['Sesamzaad', 3], 'gember en rode peper'],
    steps: [
      { t: 'Kook de noedels en spoel ze koud.', min: 4 },
      { t: 'Roerbak de kip in de hete olie gaar.', min: 6 },
      { t: 'Voeg knoflook, gember, paprika en paksoi toe en roerbak 3 minuten.', min: 3 },
      { t: 'Schep de noedels en sojasaus erdoor en strooi sesam erover.' },
    ],
    art: {
      bg: 'leisteen', dish: 'pan', base: 'noedels',
      parts: [['kip', 5, 0, 0, 0.55, 18], ['paksoi', 3, 0, 0, 0.6, 22], ['paprika', 5, 0, 0, 0.6, 12], ['sesam', 18, 0, 0, 0.7], ['chilivlok', 10, 0, 0, 0.7], ['lente-ui', 8, 0, 0, 0.6, 5]],
    },
  },
  {
    id: 'kabeljauw-krieltjes',
    name: 'Kabeljauw met krieltjes en sperziebonen',
    meal: 'diner',
    minutes: 25,
    intro: 'Een licht en echt Hollands bord: witvis, knapperige krieltjes en boontjes met citroen.',
    ing: [['Kabeljauw', 150], ['Krieltjes (gebakken)', 200], ['Sperziebonen', 150], ['Olijfolie', 5], ['Citroen', 10], 'peterselie, zout en peper'],
    steps: [
      { t: 'Bak de krieltjes in een koekenpan of airfryer goudbruin.', min: 20 },
      { t: 'Kook de sperziebonen in 6 minuten beetgaar.', min: 6 },
      { t: 'Bak de kabeljauw 3 minuten per kant in de olie.', min: 6 },
      { t: 'Maak af met citroen en peterselie.' },
    ],
    art: {
      bg: 'marmer', dish: 'bord', tint: '#ffffff',
      parts: [['krieltje', 9, -0.45, 0.22, 0.34, 13], ['boon-groen', 9, 0.4, 0.3, 0.3, 18], ['kabeljauw', 1, 0.1, -0.3, 0.05, 44], ['citroen', 1, 0.55, -0.5, 0.05, 15], ['peterselie', 8, 0, 0, 0.6, 7], ['peper', 12, 0, 0, 0.6]],
    },
  },
  {
    id: 'chili-sin-carne',
    name: 'Chili sin carne',
    meal: 'diner',
    minutes: 30,
    intro: 'Pittig, vullend en vol vezels. Een grote pan maakt meteen je lunches voor de rest van de week.',
    ing: [['Kidneybonen (uitgelekt)', 100], ['Zwarte bonen (uitgelekt)', 80], ['Tomatenblokjes (blik)', 200], ['Paprika', 75], ['Ui', 50], ['Maïs', 40], ['Zilvervliesrijst (gekookt)', 150], ['Griekse yoghurt 0%', 30], 'chilipoeder, komijn en knoflook'],
    steps: [
      { t: 'Fruit ui, knoflook en paprika.', min: 5 },
      { t: 'Voeg kruiden, tomaten, bonen en maïs toe.' },
      { t: 'Laat 20 minuten zachtjes pruttelen.', min: 20 },
      { t: 'Serveer met rijst en een lepel yoghurt.' },
    ],
    tags: ['mealprep', 'budget', 'comfort'],
    art: {
      bg: 'hout', dish: 'kom', tint: '#b5583a', base: 'chili',
      parts: [['rijst', 1, -0.38, -0.3, 0.05, 34], ['tzatziki', 1, 0.2, 0.15, 0.05, 20], ['peterselie', 7, 0.15, 0.1, 0.4, 7], ['limoen', 1, 0.5, -0.4, 0.05, 14]],
    },
  },
  {
    id: 'dahl-rode-linzen',
    name: 'Rode-linzendahl met spinazie',
    meal: 'diner',
    minutes: 30,
    intro: 'Indiaas comfortfood dat bijna vanzelf gaat. Goedkoop, plantaardig en heerlijk geurig.',
    ing: [['Linzen (gekookt)', 200], ['Tomatenblokjes (blik)', 150], ['Kokosmelk light', 75], ['Spinazie', 80], ['Ui', 40], ['Kerriepasta', 10], ['Witte rijst (gekookt)', 120], 'gember, knoflook en koriander'],
    steps: [
      { t: 'Fruit ui, gember en knoflook en bak de kerriepasta 1 minuut mee.', min: 4 },
      { t: 'Voeg linzen, tomaten en kokosmelk toe en laat 15 minuten pruttelen.', min: 15 },
      { t: 'Roer de spinazie erdoor en serveer met rijst.' },
    ],
    tags: ['mealprep', 'budget', 'comfort'],
    art: {
      bg: 'terrazzo', dish: 'kom', tint: '#e9e1d4', base: 'dahl',
      parts: [['rijst', 1, 0.35, -0.3, 0.05, 32], ['spinazie', 4, -0.3, 0.2, 0.35, 12], ['tzatziki', 1, -0.05, 0.3, 0.05, 14], ['peterselie', 8, 0, 0, 0.6, 7], ['chilivlok', 10, 0, 0, 0.6]],
    },
  },
  {
    id: 'kipshoarma-bowl',
    name: 'Kipshoarmabowl met tzatziki',
    meal: 'diner',
    minutes: 20,
    intro: 'De smaak van de snackbar, maar dan licht en vol groente. Met zelfgemaakte tzatziki.',
    ing: [['Kipfilet (gebakken)', 130], ['Bulgur (gekookt)', 150], ['Komkommer', 60], ['Tomaat', 60], ['Ui', 20], ['Griekse yoghurt 0%', 60], ['Sla', 30], 'shoarmakruiden en knoflook'],
    steps: [
      { t: 'Kook de bulgur.', min: 10 },
      { t: 'Snijd de kip in reepjes, meng met shoarmakruiden en bak gaar.', min: 7 },
      { t: 'Rasp een stukje komkommer en meng met yoghurt en knoflook tot tzatziki.' },
      { t: 'Verdeel bulgur, sla, groente en kip over een bord en schep de tzatziki erbij.' },
    ],
    tags: ['mealprep'],
    art: {
      bg: 'linnen', dish: 'bord', tint: '#3d5a50', base: 'bulgur',
      parts: [['sla', 3, -0.45, -0.3, 0.25, 22], ['kip', 6, 0.25, -0.15, 0.35, 19], ['cherrytomaat', 4, -0.45, 0.35, 0.25, 11], ['komkommer', 3, 0.05, 0.5, 0.25, 11], ['rode-ui', 3, 0.5, 0.35, 0.2, 9], ['tzatziki', 1, -0.1, 0.1, 0.05, 20], ['peterselie', 6, 0, 0, 0.6, 7]],
    },
  },
  {
    id: 'gnocchi-tomaat-mozzarella',
    name: 'Gnocchi uit de oven met tomaat en mozzarella',
    meal: 'diner',
    minutes: 25,
    intro: 'Eén ovenschaal, bijna geen afwas. Knapperige gnocchi in tomatensaus met gesmolten mozzarella.',
    ing: [['Gnocchi', 200], ['Tomatenblokjes (blik)', 200], ['Mozzarella', 60], ['Spinazie', 60], ['Knoflook', 4], ['Olijfolie', 5], 'basilicum en oregano'],
    steps: [
      { t: 'Verwarm de oven voor op 200 °C.' },
      { t: 'Meng gnocchi, tomaten, spinazie, knoflook, olie en kruiden in een ovenschaal.' },
      { t: 'Scheur de mozzarella erover en bak 20 minuten tot hij bubbelt.', min: 20 },
    ],
    tags: ['comfort'],
    art: {
      bg: 'eiken', dish: 'pan', base: 'tomatensaus',
      parts: [['gnocchi', 14, 0, 0, 0.6, 11], ['mozzarella-plak', 4, 0, 0, 0.45, 18], ['kruid', 6, 0, 0, 0.6, 9], ['peper', 12, 0, 0, 0.6]],
    },
  },

  /* ------------------------------ Snacks ------------------------------ */
  {
    id: 'energieballetjes',
    name: 'Cacao-energieballetjes',
    meal: 'snacks',
    minutes: 15,
    intro: 'Zoet zonder geraffineerde suiker en met extra eiwit. Ideaal voor de middagdip of voor de gym.',
    ing: [['Dadels', 24], ['Havermout', 15], ['Pindakaas 100% pinda', 10], ['Proteïnepoeder (whey)', 10], ['Cacaopoeder', 3], ['Kokosrasp', 3]],
    steps: [
      { t: 'Maal dadels, havermout, pindakaas, proteïnepoeder en cacao in een hakmolen tot een plakkerige massa.' },
      { t: 'Rol er balletjes van en haal ze door de kokos.' },
      { t: 'Zet 10 minuten in de koelkast. Bewaar ze een week in een afgesloten bakje.', min: 10 },
    ],
    tags: ['mealprep', 'zoet'],
    art: {
      bg: 'leisteen', dish: 'bord', tint: '#e8e2d6',
      parts: [['energiebal', 5, 0, 0, 0.55, 22], ['kokos', 24, 0, 0, 0.7]],
      side: [['dadel', 2, 0.85, 0.65, 0.2, 13]],
    },
  },
  {
    id: 'appel-pindakaas',
    name: 'Appel met pindakaas',
    meal: 'snacks',
    minutes: 3,
    intro: 'Zoet, zout en knapperig. Vezels en eiwit houden je tot het avondeten vol.',
    ing: [['Appel', 150], ['Pindakaas 100% pinda', 15], 'snufje kaneel'],
    steps: [
      { t: 'Snijd de appel in partjes.' },
      { t: 'Doop ze in de pindakaas en strooi er wat kaneel over.' },
    ],
    tags: ['zoet', 'budget'],
    art: {
      bg: 'eiken', dish: 'plank',
      parts: [['appel', 8, -0.3, 0, 0.6, 22], ['hummus', 1, 0.55, 0.05, 0.05, 34], ['peper', 10, -0.3, 0, 0.5]],
    },
  },
  {
    id: 'skyr-frambozen',
    name: 'Skyr met frambozen en pitten',
    meal: 'snacks',
    minutes: 2,
    intro: 'Bijna 20 gram eiwit voor maar zo’n 150 kcal. De perfecte snack als je eiwit tekortkomt.',
    ing: [['Skyr naturel', 150], ['Frambozen', 75], ['Pompoenpitten', 5]],
    steps: [{ t: 'Schep de skyr in een kommetje, leg de frambozen erop en strooi de pitten erover.' }],
    art: {
      bg: 'marmer', dish: 'kom', tint: '#d7c4c9', base: 'kwark',
      parts: [['framboos', 12, 0, 0, 0.55, 12], ['pompoenpit', 16, 0, 0, 0.6], ['kruid', 2, 0.1, -0.1, 0.2, 8]],
      side: [['framboos', 3, 0.84, 0.66, 0.15, 12]],
    },
  },
  {
    id: 'groentesticks-hummus',
    name: 'Groentesticks met hummus',
    meal: 'snacks',
    minutes: 5,
    intro: 'Knapperig, kleurrijk en je eet meteen een flinke portie groente.',
    ing: [['Wortel', 80], ['Komkommer', 80], ['Paprika', 75], ['Hummus', 40]],
    steps: [
      { t: 'Snijd wortel, komkommer en paprika in reepjes.' },
      { t: 'Serveer met de hummus om in te dippen.' },
    ],
    tags: ['budget'],
    art: {
      bg: 'linnen', dish: 'plank',
      parts: [['hummus', 1, 0.45, 0, 0.05, 36], ['wortelstick', 6, -0.45, -0.35, 0.3, 22], ['paprika-geel', 4, -0.4, 0.35, 0.3, 16], ['paprika', 4, 0.05, 0.4, 0.25, 16], ['komkommer', 4, -0.05, -0.35, 0.25, 12]],
    },
  },
  {
    id: 'edamame-zeezout',
    name: 'Edamame met zeezout',
    meal: 'snacks',
    minutes: 5,
    intro: 'De snack van sushirestaurants, met 11 gram plantaardig eiwit per portie.',
    ing: [['Edamame', 100], 'vlokken zeezout', 'optioneel: chilivlokken'],
    steps: [
      { t: 'Kook de edamame 3 tot 4 minuten in water met zout.', min: 4 },
      { t: 'Giet af en bestrooi met zeezout en eventueel chili.' },
    ],
    art: {
      bg: 'leisteen', dish: 'kom', tint: '#efe9dd',
      parts: [['edamame-peul', 12, 0, 0, 0.62, 20], ['chilivlok', 14, 0, 0, 0.6], ['peper', 10, 0, 0, 0.6]],
    },
  },
  {
    id: 'rijstwafel-huttenkase',
    name: 'Rijstwafels met hüttenkäse en komkommer',
    meal: 'snacks',
    minutes: 3,
    intro: 'Licht en eiwitrijk. Een snack die je zonder schuldgevoel ’s avonds nog kunt nemen.',
    ing: [['Rijstwafel', 16], ['Hüttenkäse', 60], ['Komkommer', 40], 'zwarte peper'],
    steps: [{ t: 'Besmeer de rijstwafels met hüttenkäse en leg plakjes komkommer erop. Peper erover.' }],
    tags: ['budget'],
    art: {
      bg: 'eiken', dish: 'bord', tint: '#f3efe6',
      parts: [['rijstwafel', 1, -0.3, 0, 0.05, 44], ['rijstwafel', 1, 0.32, 0.05, 0.05, 44], ['dollop', 1, -0.3, 0, 0.05, 26], ['dollop', 1, 0.32, 0.05, 0.05, 26], ['komkommer', 3, -0.3, 0, 0.18, 11], ['komkommer', 3, 0.32, 0.05, 0.18, 11], ['peper', 14, 0, 0, 0.6]],
    },
  },
  {
    id: 'eitjes-kruiden',
    name: 'Gekookte eitjes met kruiden',
    meal: 'snacks',
    minutes: 10,
    intro: 'Kook er een paar tegelijk: dan heb je de hele week een eiwitrijke snack klaarliggen.',
    ing: [['Ei (gekookt)', 110], 'paprikapoeder, zeezout en bieslook'],
    steps: [
      { t: 'Kook de eieren 8 minuten en laat schrikken in koud water.', min: 8 },
      { t: 'Pel, halveer en bestrooi met paprikapoeder, zout en bieslook.' },
    ],
    tags: ['mealprep', 'budget'],
    art: {
      bg: 'terrazzo', dish: 'bord', tint: '#e5ece6',
      parts: [['half-ei', 6, 0, 0, 0.55, 20], ['lente-ui', 12, 0, 0, 0.6, 5], ['chilivlok', 14, 0, 0, 0.6]],
    },
  },
  {
    id: 'chocola-amandelen',
    name: 'Pure chocolade met amandelen',
    meal: 'snacks',
    minutes: 1,
    intro: 'Want iets lekkers hoort er gewoon bij. Pure chocolade en noten verzadigen beter dan een koek.',
    ing: [['Pure chocolade 70%', 15], ['Amandelen', 15]],
    steps: [{ t: 'Leg twee blokjes chocolade en een handje amandelen in een schaaltje. Neem de tijd en geniet ervan.' }],
    tags: ['zoet'],
    art: {
      bg: 'hout', dish: 'plank',
      parts: [['chocola', 5, -0.35, 0, 0.5, 20], ['amandel', 14, 0.4, 0, 0.5, 11]],
    },
  },
];

export const RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));
