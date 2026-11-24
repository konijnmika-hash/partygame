// Ingebouwde voedingsdatabase (waarden per 100 g of 100 ml, afgerond; gebaseerd op gangbare
// Nederlandse productwaarden). Online zoeken via Open Food Facts vult dit aan met miljoenen producten.

export type FoodCategory =
  | 'brood'
  | 'beleg'
  | 'zuivel'
  | 'vlees'
  | 'vega'
  | 'granen'
  | 'groente'
  | 'fruit'
  | 'snack'
  | 'drank'
  | 'gerecht'
  | 'saus';

export interface Portion {
  label: string;
  g: number;
}

export interface Food {
  id: string;
  name: string;
  brand?: string;
  cat: FoodCategory | 'online' | 'eigen' | 'recept';
  /** per 100 g / 100 ml */
  kcal: number;
  p: number;
  c: number;
  f: number;
  unit: 'g' | 'ml';
  portions: Portion[];
  source: 'db' | 'off' | 'custom' | 'recipe';
}

export const CATEGORY_LABEL: Record<Food['cat'], string> = {
  brood: 'Brood & ontbijt',
  beleg: 'Beleg & smeersels',
  zuivel: 'Zuivel & eieren',
  vlees: 'Vlees & vis',
  vega: 'Vega & peulvruchten',
  granen: 'Rijst, pasta & aardappel',
  groente: 'Groente',
  fruit: 'Fruit',
  snack: 'Snacks & noten',
  drank: 'Dranken',
  gerecht: 'Maaltijden',
  saus: 'Sauzen & oliën',
  online: 'Online database',
  eigen: 'Eigen product',
  recept: 'Recept van Puls',
};

export const CATEGORY_EMOJI: Record<Food['cat'], string> = {
  brood: '🍞',
  beleg: '🥜',
  zuivel: '🥛',
  vlees: '🍗',
  vega: '🌱',
  granen: '🍚',
  groente: '🥦',
  fruit: '🍎',
  snack: '🍫',
  drank: '🥤',
  gerecht: '🍲',
  saus: '🫒',
  online: '🔎',
  eigen: '✏️',
  recept: '🍽️',
};

// [naam, categorie, kcal, eiwit, koolhydraten, vet, porties "label:gram|label:gram", eenheid?]
type Row = [string, FoodCategory, number, number, number, number, string, ('ml' | 'g')?];

const ROWS: Row[] = [
  // Brood & ontbijt
  ['Volkorenbrood', 'brood', 230, 9.5, 38, 3, 'snee:35'],
  ['Bruinbrood', 'brood', 240, 9, 42, 2.5, 'snee:35'],
  ['Witbrood', 'brood', 255, 8.5, 48, 2.5, 'snee:35'],
  ['Meergranenbrood', 'brood', 250, 10, 38, 5, 'snee:35'],
  ['Speltbrood', 'brood', 245, 9.5, 42, 3, 'snee:35'],
  ['Zuurdesembrood', 'brood', 245, 9, 47, 1.5, 'snee:40'],
  ['Volkoren bolletje', 'brood', 245, 10, 40, 3.5, 'bolletje:55'],
  ['Wit bolletje', 'brood', 270, 9, 51, 3, 'bolletje:50'],
  ['Krentenbol', 'brood', 285, 7.5, 52, 4, 'stuk:60'],
  ['Croissant', 'brood', 410, 8, 45, 21, 'stuk:50'],
  ['Volkoren wrap', 'brood', 290, 9, 46, 6.5, 'stuk:60'],
  ['Beschuit', 'brood', 400, 10, 76, 5.5, 'stuk:10'],
  ['Knäckebröd volkoren', 'brood', 350, 10, 62, 2, 'stuk:12'],
  ['Rijstwafel', 'brood', 385, 8, 81, 3, 'stuk:8'],
  ['Wrap (tortilla)', 'brood', 300, 8.5, 50, 7, 'stuk:60'],
  ['Bagel', 'brood', 260, 10, 50, 1.5, 'stuk:90'],
  ['Ontbijtkoek', 'brood', 320, 4, 72, 1.5, 'plak:25'],
  ['Havermout', 'brood', 370, 13.5, 59, 7, 'portie:40|eetlepel:10'],
  ['Muesli (zonder toegevoegd suiker)', 'brood', 360, 10, 60, 6.5, 'portie:50'],
  ['Cruesli', 'brood', 450, 8, 64, 16, 'portie:45'],
  ['Granola', 'brood', 470, 10, 58, 20, 'portie:45'],
  ['Cornflakes', 'brood', 375, 7.5, 84, 0.9, 'portie:30'],
  ['Pannenkoek', 'brood', 200, 6.5, 26, 8, 'stuk:100'],
  ['Wentelteefje', 'brood', 220, 8, 27, 9, 'stuk:70'],

  // Beleg
  ['Pindakaas', 'beleg', 620, 25, 13, 50, 'op brood:15|eetlepel:20'],
  ['Pindakaas 100% pinda', 'beleg', 600, 27, 10, 49, 'op brood:15|eetlepel:20'],
  ['Hagelslag puur', 'beleg', 470, 6, 66, 19, 'op brood:15'],
  ['Hagelslag melk', 'beleg', 490, 5, 72, 20, 'op brood:15'],
  ['Chocoladepasta', 'beleg', 540, 6, 57, 31, 'op brood:15'],
  ['Jam', 'beleg', 245, 0.4, 60, 0.1, 'op brood:15'],
  ['Appelstroop', 'beleg', 285, 1, 69, 0, 'op brood:15'],
  ['Honing', 'beleg', 320, 0.4, 80, 0, 'theelepel:7|eetlepel:21'],
  ['Jonge kaas 48+', 'beleg', 360, 24, 0, 29, 'plak:20'],
  ['Belegen kaas 48+', 'beleg', 375, 25, 0, 30, 'plak:20'],
  ['Kaas 30+', 'beleg', 270, 30, 0, 16.5, 'plak:20'],
  ['Smeerkaas', 'beleg', 250, 11, 4, 21, 'op brood:20'],
  ['Kipfilet (beleg)', 'beleg', 110, 21, 2, 2, 'plak:15'],
  ['Achterham', 'beleg', 115, 19, 1, 4, 'plak:15'],
  ['Rookvlees', 'beleg', 120, 25, 0.5, 2, 'plak:10'],
  ['Filet americain', 'beleg', 210, 15, 2, 16, 'op brood:25'],
  ['Salami', 'beleg', 420, 22, 1, 37, 'plak:8'],
  ['Hummus', 'beleg', 290, 7.5, 13, 23, 'eetlepel:20'],
  ['Boter', 'beleg', 740, 0.7, 0.6, 82, 'op brood:5'],
  ['Halvarine', 'beleg', 355, 0.2, 0.5, 39, 'op brood:5'],
  ['Avocado', 'beleg', 160, 2, 2, 15, 'halve:70|hele:140'],
  ['Ahornsiroop', 'beleg', 260, 0, 67, 0, 'eetlepel:20'],

  // Zuivel & eieren
  ['Ei (gekookt)', 'zuivel', 140, 12.5, 0.5, 10, 'stuk:55'],
  ['Ei (gebakken)', 'zuivel', 190, 13, 0.5, 15, 'stuk:55'],
  ['Roerei', 'zuivel', 160, 11, 1.5, 12, 'portie (2 eieren):120'],
  ['Omelet', 'zuivel', 155, 11, 1, 12, 'portie (2 eieren):120'],
  ['Ei (rauw)', 'zuivel', 143, 12.6, 0.7, 9.5, 'stuk:55'],
  ['Halfvolle melk', 'zuivel', 46, 3.5, 4.7, 1.5, 'glas:200|scheutje:30', 'ml'],
  ['Volle melk', 'zuivel', 63, 3.4, 4.6, 3.5, 'glas:200|scheutje:30', 'ml'],
  ['Magere melk', 'zuivel', 35, 3.5, 4.8, 0.1, 'glas:200', 'ml'],
  ['Karnemelk', 'zuivel', 35, 3.1, 3.9, 0.5, 'glas:200', 'ml'],
  ['Halfvolle yoghurt', 'zuivel', 50, 4, 4.5, 1.5, 'schaaltje:150'],
  ['Volle yoghurt', 'zuivel', 65, 3.8, 4.3, 3.3, 'schaaltje:150'],
  ['Griekse yoghurt 10%', 'zuivel', 117, 3.6, 4, 10, 'schaaltje:150'],
  ['Griekse yoghurt 0%', 'zuivel', 55, 10, 3.5, 0.2, 'schaaltje:150'],
  ['Skyr naturel', 'zuivel', 60, 11, 4, 0.2, 'bakje:150'],
  ['Magere kwark', 'zuivel', 55, 10, 3.5, 0.1, 'schaaltje:150'],
  ['Hüttenkäse', 'zuivel', 95, 12, 3, 4, 'portie:100'],
  ['Vanillevla', 'zuivel', 110, 3, 17, 3, 'schaaltje:150'],
  ['Mozzarella', 'zuivel', 240, 18, 1, 18, 'bol:125|portie:50'],
  ['Feta', 'zuivel', 265, 15, 1, 22, 'portie:30'],
  ['Parmezaanse kaas', 'zuivel', 400, 33, 0, 29, 'eetlepel:10'],
  ['Sojadrink', 'zuivel', 39, 3.3, 2.5, 1.8, 'glas:200', 'ml'],
  ['Haverdrink', 'zuivel', 45, 0.3, 6.5, 1.5, 'glas:200', 'ml'],
  ['Amandeldrink ongezoet', 'zuivel', 13, 0.4, 0.1, 1.1, 'glas:200', 'ml'],
  ['Proteïnepoeder (whey)', 'zuivel', 380, 75, 8, 6, 'schep:30'],

  // Vlees & vis
  ['Kipfilet (gebakken)', 'vlees', 150, 30, 0, 3, 'stuk:120|portie:100'],
  ['Kippendij (gebakken)', 'vlees', 200, 25, 0, 11, 'portie:100'],
  ['Kippenpoot', 'vlees', 215, 26, 0, 12, 'stuk:150'],
  ['Rundergehakt (gebakken)', 'vlees', 250, 26, 0, 16, 'portie:100'],
  ['Half-om-half gehakt (gebakken)', 'vlees', 270, 24, 0, 19, 'portie:100'],
  ['Kipgehakt (gebakken)', 'vlees', 170, 22, 0, 9, 'portie:100'],
  ['Biefstuk (gebakken)', 'vlees', 160, 28, 0, 5.5, 'stuk:125'],
  ['Mager rundergehakt (gebakken)', 'vlees', 200, 28, 0, 10, 'portie:100'],
  ['Varkenshaas (gebakken)', 'vlees', 145, 27, 0, 4, 'portie:100'],
  ['Shoarmavlees', 'vlees', 200, 20, 3, 12, 'portie:125'],
  ['Bacon (gebakken)', 'vlees', 400, 30, 1, 31, 'plak:10'],
  ['Rookworst', 'vlees', 290, 12, 2, 26, 'portie:60'],
  ['Frikandel', 'vlees', 230, 11, 10, 16, 'stuk:70'],
  ['Kroket', 'vlees', 245, 6, 20, 16, 'stuk:75'],
  ['Kipnuggets', 'vlees', 270, 15, 17, 16, 'stuk:18'],
  ['Zalm (gebakken)', 'vlees', 200, 22, 0, 12, 'moot:125'],
  ['Gerookte zalm', 'vlees', 180, 22, 0, 10, 'plak:20'],
  ['Tonijn in water (uitgelekt)', 'vlees', 110, 25, 0, 1, 'blikje:120'],
  ['Kabeljauw', 'vlees', 90, 20, 0, 0.7, 'filet:125'],
  ['Pangasius', 'vlees', 85, 16, 0, 2.5, 'filet:125'],
  ['Garnalen', 'vlees', 85, 18, 0, 1, 'portie:100'],
  ['Hollandse nieuwe haring', 'vlees', 200, 16, 0, 15, 'stuk:80'],
  ['Kibbeling', 'vlees', 230, 15, 12, 14, 'portie:150'],

  // Vega & peulvruchten
  ['Tofu', 'vega', 125, 13, 1.5, 7.5, 'portie:100'],
  ['Tempeh', 'vega', 190, 19, 9, 11, 'portie:100'],
  ['Vegetarische burger', 'vega', 220, 16, 10, 12, 'stuk:100'],
  ['Vegetarische kipstukjes', 'vega', 160, 18, 4, 7, 'portie:100'],
  ['Linzen (gekookt)', 'vega', 115, 9, 17, 0.4, 'portie:150'],
  ['Kikkererwten (uitgelekt)', 'vega', 120, 7, 14, 2.5, 'portie:100'],
  ['Kidneybonen (uitgelekt)', 'vega', 105, 7.5, 14, 0.5, 'portie:100'],
  ['Zwarte bonen (uitgelekt)', 'vega', 110, 7.5, 15, 0.5, 'portie:100'],
  ['Edamame', 'vega', 120, 11, 9, 5, 'portie:100'],
  ['Falafel', 'vega', 330, 13, 31, 18, 'stuk:20'],

  // Rijst, pasta & aardappel
  ['Witte rijst (gekookt)', 'granen', 130, 2.7, 28, 0.3, 'portie:150|opscheplepel:50'],
  ['Witte rijst (droog)', 'granen', 350, 7, 78, 0.6, 'portie:75'],
  ['Zilvervliesrijst (gekookt)', 'granen', 125, 2.7, 25.5, 1, 'portie:150|opscheplepel:50'],
  ['Pasta (gekookt)', 'granen', 150, 5.5, 30, 0.9, 'portie:200|opscheplepel:60'],
  ['Pasta (droog)', 'granen', 355, 12.5, 71, 1.5, 'portie:80'],
  ['Volkoren pasta (gekookt)', 'granen', 140, 6, 26, 1.2, 'portie:200'],
  ['Couscous (bereid)', 'granen', 115, 4, 23, 0.3, 'portie:150'],
  ['Rijstnoedels (gekookt)', 'granen', 110, 1.8, 25, 0.2, 'portie:200'],
  ['Gnocchi', 'granen', 150, 4, 32, 0.4, 'portie:200'],
  ['Quinoa (gekookt)', 'granen', 120, 4.4, 21, 1.9, 'portie:150'],
  ['Bulgur (gekookt)', 'granen', 85, 3, 17, 0.2, 'portie:150'],
  ['Noedels (gekookt)', 'granen', 140, 4.5, 26, 2, 'portie:200'],
  ['Aardappelen (gekookt)', 'granen', 75, 2, 16, 0.1, 'stuk:70|portie:200'],
  ['Krieltjes (gebakken)', 'granen', 130, 2.5, 19, 4.5, 'portie:200'],
  ['Zoete aardappel (gekookt)', 'granen', 85, 1.5, 18, 0.1, 'portie:200'],
  ['Aardappelpuree', 'granen', 100, 2, 14, 4, 'portie:200'],
  ['Patat', 'granen', 290, 3.5, 36, 14, 'klein:100|middel:150|groot:200'],

  // Groente
  ['Broccoli', 'groente', 30, 3, 3, 0.4, 'portie:150|opscheplepel:50'],
  ['Sperziebonen', 'groente', 28, 2, 4, 0.2, 'portie:150|opscheplepel:50'],
  ['Spinazie', 'groente', 23, 2.9, 1, 0.4, 'portie:150'],
  ['Bloemkool', 'groente', 25, 2, 3, 0.3, 'portie:150'],
  ['Spruitjes', 'groente', 40, 3.5, 5, 0.4, 'portie:150'],
  ['Rode kool', 'groente', 30, 1.4, 5, 0.2, 'portie:150'],
  ['Boerenkool', 'groente', 40, 3.5, 4, 0.9, 'portie:150'],
  ['Andijvie', 'groente', 15, 1.5, 1.5, 0.2, 'portie:150'],
  ['Courgette', 'groente', 18, 1.5, 2, 0.3, 'stuk:250|portie:150'],
  ['Champignons', 'groente', 22, 3, 0.5, 0.3, 'portie:100'],
  ['Doperwten', 'groente', 75, 5.5, 10, 0.4, 'portie:100'],
  ['Maïs', 'groente', 80, 3, 14, 1.5, 'portie:75'],
  ['Wortel', 'groente', 35, 0.7, 7, 0.3, 'stuk:80'],
  ['Paprika', 'groente', 28, 1, 5, 0.3, 'stuk:150'],
  ['Tomaat', 'groente', 18, 0.9, 3, 0.2, 'stuk:100|cherrytomaatje:15'],
  ['Komkommer', 'groente', 13, 0.7, 2, 0.1, 'halve:150|plakjes:50'],
  ['Ui', 'groente', 35, 1.2, 7, 0.1, 'stuk:100'],
  ['Sla', 'groente', 15, 1.2, 1.5, 0.2, 'portie:50'],
  ['Gemengde salade', 'groente', 20, 1.3, 2.5, 0.2, 'portie:100'],
  ['Wokgroenten', 'groente', 30, 1.8, 4, 0.3, 'portie:200'],
  ['Tomatenblokjes (blik)', 'groente', 22, 1.2, 3.5, 0.2, 'blik:400'],
  ['Rucola', 'groente', 25, 2.6, 2, 0.7, 'handje:20'],
  ['Knoflook', 'groente', 150, 6, 30, 0.5, 'teentje:4'],
  ['Lente-ui', 'groente', 32, 1.8, 6, 0.2, 'stengel:15'],
  ['Paksoi', 'groente', 13, 1.5, 2, 0.2, 'struik:150'],
  ['Pompoen', 'groente', 30, 1, 6, 0.1, 'portie:200'],

  // Fruit
  ['Appel', 'fruit', 52, 0.3, 12, 0.2, 'stuk:150'],
  ['Banaan', 'fruit', 95, 1.1, 21, 0.3, 'stuk:120'],
  ['Peer', 'fruit', 55, 0.4, 12, 0.1, 'stuk:160'],
  ['Sinaasappel', 'fruit', 45, 1, 9, 0.2, 'stuk:150'],
  ['Mandarijn', 'fruit', 45, 0.8, 10, 0.3, 'stuk:70'],
  ['Aardbeien', 'fruit', 33, 0.7, 6, 0.3, 'schaaltje:150'],
  ['Blauwe bessen', 'fruit', 57, 0.7, 12, 0.3, 'handje:75'],
  ['Frambozen', 'fruit', 45, 1.2, 5.5, 0.6, 'handje:75'],
  ['Druiven', 'fruit', 70, 0.6, 16, 0.2, 'trosje:100'],
  ['Kiwi', 'fruit', 60, 1, 12, 0.5, 'stuk:75'],
  ['Mango', 'fruit', 65, 0.8, 14, 0.4, 'halve:150'],
  ['Ananas', 'fruit', 50, 0.5, 11, 0.1, 'schijf:80'],
  ['Watermeloen', 'fruit', 30, 0.6, 7, 0.2, 'part:200'],
  ['Dadels', 'fruit', 290, 2.5, 66, 0.4, 'stuk:8'],
  ['Rozijnen', 'fruit', 300, 3, 69, 0.5, 'handje:25'],
  ['Bosvruchten (diepvries)', 'fruit', 45, 1, 8, 0.3, 'handje:75'],
  ['Citroen', 'fruit', 30, 1, 9, 0.3, 'partje:10|halve:40'],

  // Snacks & noten
  ['Amandelen', 'snack', 600, 21, 7, 52, 'handje:25'],
  ['Walnoten', 'snack', 680, 15, 7, 65, 'handje:25'],
  ['Cashewnoten', 'snack', 580, 18, 27, 46, 'handje:25'],
  ["Pinda's (gezouten)", 'snack', 600, 26, 10, 49, 'handje:25'],
  ['Ongebrande gemengde noten', 'snack', 620, 20, 10, 54, 'handje:25'],
  ['Chiazaad', 'snack', 450, 17, 8, 31, 'eetlepel:10'],
  ['Sesamzaad', 'snack', 570, 18, 12, 50, 'theelepel:3'],
  ['Pompoenpitten', 'snack', 560, 30, 11, 46, 'eetlepel:10'],
  ['Kokosrasp', 'snack', 660, 6, 24, 62, 'eetlepel:5'],
  ['Cacaopoeder', 'snack', 380, 20, 12, 21, 'theelepel:5'],
  ['Pure chocolade 70%', 'snack', 580, 8, 33, 43, 'stukje:10|reep:100'],
  ['Melkchocolade', 'snack', 540, 7, 56, 31, 'stukje:10|reep:45'],
  ['Chips naturel', 'snack', 540, 6, 52, 34, 'portie:30|zak:150'],
  ['Popcorn (zout)', 'snack', 470, 9, 56, 22, 'portie:25'],
  ['Stroopwafel', 'snack', 460, 3.5, 66, 19, 'stuk:30'],
  ['Mueslireep', 'snack', 420, 6, 65, 13, 'stuk:25'],
  ['Proteïnereep', 'snack', 360, 33, 35, 12, 'stuk:55'],
  ['Biscuitje', 'snack', 450, 6.5, 70, 15, 'stuk:8'],
  ['Gevulde koek', 'snack', 440, 7, 52, 22, 'stuk:85'],
  ['Appeltaart', 'snack', 270, 3, 37, 12, 'punt:120'],
  ['Drop', 'snack', 350, 4, 80, 0.5, 'portie:20'],
  ['Winegums', 'snack', 340, 5, 78, 0.2, 'portie:20'],
  ['Roomijs', 'snack', 210, 3.5, 24, 11, 'bolletje:50'],

  // Dranken (per 100 ml)
  ['Water', 'drank', 0, 0, 0, 0, 'glas:250|fles:500', 'ml'],
  ['Koffie zwart', 'drank', 2, 0.1, 0.3, 0, 'kopje:125', 'ml'],
  ['Cappuccino', 'drank', 38, 2.2, 3.2, 1.8, 'kop:150', 'ml'],
  ['Latte macchiato', 'drank', 45, 2.6, 3.7, 2, 'glas:250', 'ml'],
  ['Thee (zonder suiker)', 'drank', 1, 0, 0.2, 0, 'kop:200', 'ml'],
  ['Sinaasappelsap', 'drank', 45, 0.7, 10, 0.1, 'glas:200', 'ml'],
  ['Appelsap', 'drank', 45, 0.1, 11, 0, 'glas:200', 'ml'],
  ['Smoothie', 'drank', 55, 0.7, 12, 0.3, 'flesje:250', 'ml'],
  ['Cola', 'drank', 42, 0, 10.6, 0, 'glas:250|blikje:330', 'ml'],
  ['Cola zero', 'drank', 0.3, 0, 0, 0, 'glas:250|blikje:330', 'ml'],
  ['Ice tea', 'drank', 19, 0, 4.5, 0, 'glas:250|blikje:330', 'ml'],
  ['Energiedrank', 'drank', 45, 0, 11, 0, 'blikje:250', 'ml'],
  ['Chocolademelk', 'drank', 70, 3.3, 10, 1.6, 'glas:200', 'ml'],
  ['Bier (pils)', 'drank', 43, 0.5, 3, 0, 'fluitje:200|flesje:300|vaasje:250', 'ml'],
  ['Bier 0.0%', 'drank', 20, 0.4, 4.4, 0, 'flesje:300', 'ml'],
  ['Rode wijn', 'drank', 85, 0, 2.6, 0, 'glas:125', 'ml'],
  ['Witte wijn', 'drank', 80, 0, 2.6, 0, 'glas:125', 'ml'],

  // Maaltijden
  ['Pizza margherita', 'gerecht', 250, 10, 30, 9, 'halve pizza:175|hele pizza:350'],
  ['Spaghetti bolognese', 'gerecht', 130, 7, 16, 4.5, 'bord:400'],
  ['Lasagne', 'gerecht', 160, 8, 13, 8.5, 'portie:400'],
  ['Nasi goreng', 'gerecht', 160, 6, 20, 6, 'bord:400'],
  ['Bami goreng', 'gerecht', 155, 6, 19, 6, 'bord:400'],
  ['Stamppot boerenkool met worst', 'gerecht', 140, 5, 10, 9, 'bord:400'],
  ['Chili con carne', 'gerecht', 110, 8, 9, 4.5, 'bord:350'],
  ['Kip tandoori met rijst', 'gerecht', 140, 10, 17, 3.5, 'bord:400'],
  ['Pokébowl zalm', 'gerecht', 145, 7, 18, 5, 'bowl:400'],
  ['Maaltijdsalade met kip', 'gerecht', 120, 8, 8, 6, 'bak:350'],
  ['Sushi (maki)', 'gerecht', 150, 4, 28, 1.5, 'stuk:25'],
  ['Hamburger (broodje)', 'gerecht', 250, 13, 25, 11, 'stuk:200'],
  ['Kapsalon', 'gerecht', 230, 11, 16, 14, 'bak:550'],
  ['Tosti ham-kaas', 'gerecht', 270, 15, 25, 12, 'stuk:120'],
  ['Broodje gezond', 'gerecht', 190, 10, 22, 7, 'stuk:200'],
  ['Tomatensoep', 'gerecht', 40, 1.5, 5, 1.5, 'kom:250'],
  ['Erwtensoep', 'gerecht', 85, 5.5, 8, 3.5, 'kom:250'],
  ['Kippensoep', 'gerecht', 35, 2.5, 3.5, 1, 'kom:250'],

  // Sauzen & oliën
  ['Olijfolie', 'saus', 884, 0, 0, 100, 'eetlepel:13|theelepel:5'],
  ['Mayonaise', 'saus', 720, 1, 2, 79, 'eetlepel:15'],
  ['Fritessaus', 'saus', 290, 1, 12, 26, 'portie:25'],
  ['Ketchup', 'saus', 110, 1.2, 24, 0.2, 'eetlepel:15'],
  ['Pesto', 'saus', 450, 5, 6, 45, 'eetlepel:15'],
  ['Satésaus', 'saus', 240, 7, 14, 17, 'portie:50'],
  ['Sojasaus', 'saus', 60, 8, 6, 0, 'eetlepel:15', 'ml'],
  ['Suiker', 'saus', 400, 0, 100, 0, 'theelepel:4|klontje:5'],
  ['Kokosmelk light', 'saus', 75, 0.7, 2, 7, 'blik:400', 'ml'],
  ['Kerriepasta', 'saus', 150, 2, 10, 11, 'eetlepel:15'],
  ['Tomatenpuree', 'saus', 85, 4.5, 13, 0.5, 'eetlepel:15'],
  ['Pastasaus (tomaat)', 'saus', 55, 1.5, 8, 1.5, 'pot:400'],
  ['Balsamicoazijn', 'saus', 110, 0.5, 22, 0, 'eetlepel:15', 'ml'],
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const FOODS: Food[] = ROWS.map(([name, cat, kcal, p, c, f, portions, unit]) => ({
  id: 'db-' + slug(name),
  name,
  cat,
  kcal,
  p,
  c,
  f,
  unit: unit ?? 'g',
  portions: portions.split('|').map((part) => {
    const [label, g] = part.split(':');
    return { label, g: Number(g) };
  }),
  source: 'db',
}));

export const FOOD_BY_ID = new Map(FOODS.map((f) => [f.id, f]));

/** Lowercase, accents removed - for forgiving search. */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Ranks foods for a query: names that start with the query first, then word matches, then substrings. */
export function searchFoods(query: string, foods: Food[], limit = 40): Food[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const terms = q.split(/\s+/);
  const scored: { food: Food; score: number }[] = [];
  for (const food of foods) {
    const name = normalize(food.name + ' ' + (food.brand ?? ''));
    if (!terms.every((t) => name.includes(t))) continue;
    let score = 0;
    if (name.startsWith(q)) score += 100;
    if (name.split(/[\s(),-]+/).some((w) => w.startsWith(terms[0]))) score += 40;
    score -= name.length * 0.5;
    scored.push({ food, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.food);
}
