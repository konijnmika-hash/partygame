# Puls

Jouw persoonlijke coach voor eten, trainen en energie: calorieën en macro's tellen, water en stappen bijhouden, een gymschema op maat, en een coach die je herinnert, tips geeft en je viert als je goed bezig bent.

## Wat zit erin

- **Intake bij de eerste start**: naam, geslacht, leeftijd, lengte, gewicht, **vet (schaal 1–10)** en **spieren (schaal 1–10)** met een silhouet dat meeverandert, doel, tempo en streefgewicht, dagelijkse activiteit, trainingsdagen, gym of thuis, **beschikbare apparatuur**, **gymervaring**, focus en coach-reminders.
- **Persoonlijke doelen**: rustverbranding als gemiddelde van Mifflin-St Jeor en Katch-McArdle (op basis van de geschatte vetvrije massa uit de schalen, met correctie voor spiermassa) × activiteitsfactor, met tekort/overschot op basis van tempo. Eiwit 2,0–2,5 g per kg vetvrije massa, vet 28 %, de rest koolhydraten; waterdoel 35 ml/kg (+0,5 L op trainingsdagen) en een stappendoel op basis van je activiteit.
- **Coach**: elke dag berichten op maat (ochtendplan, “je loopt achter met water”, eiwittips, trainingsreminder, stappen, streaks), een felicitatie-animatie zodra je een doel haalt, en reminders (water, maaltijden, training op een zelfgekozen tijd, dagoverzicht om 21:00) als melding op je telefoon of in de app.
- **Dagboek**: ontbijt, lunch, avondeten en snacks, met aanbevolen kcal per maaltijd, “zelfde als gisteren” en per dag terugbladeren.
- **Voedingsdatabase**: 200+ Nederlandse basisproducten met porties (snee, plak, glas…), plus online zoeken in miljoenen merkproducten via [Open Food Facts](https://world.openfoodfacts.org). Ook: snel kcal toevoegen, eigen producten, favorieten, recent en een barcodescanner (camera, of cijfers intikken).
- **Water**: glas met golfanimatie en een seintje als je achterloopt op schema.
- **Stappen**: handmatig invoeren; koppelscherm voor Health Connect / Apple Gezondheid (zie hieronder).
- **Trainingsschema**: 1–2 dagen = full body; 3 dagen = push / pull / benen; 4 dagen = borst & triceps, rug & biceps, benen, schouders & armen; 5 dagen = één spiergroep per dag; 6 dagen = push/pull/benen 2×. Oefeningen worden gekozen op je apparatuur en ervaring (van machines en lichaamsgewicht voor starters tot halterstang-oefeningen voor gevorderden). Elke oefening heeft een **geanimeerd plaatje**, stapsgewijze uitleg en een tip. Je kunt een oefening **wisselen** of aangeven dat je hem **niet kunt doen**; dan kiest Puls een alternatief voor dezelfde spieren. Tijdens de training vink je sets af, houd je je gewichten bij en loopt er een rusttimer.
- **Activiteiten**: hardlopen, fietsen, padel, zwemmen enz. met kcal-schatting (MET).
- **Voortgang**: gewichtslijn naar streefgewicht, calorieën, water en stappen per dag, streak.
- **Premium (€ 4,99/mnd of € 39,99/jaar)**: barcodescanner, eigen doelen en 30-dagen-grafieken. Nu een demo-schakelaar; echte betalingen gaan straks via App Store / Google Play.
- Licht en donker thema, werkt offline als PWA (installeerbaar op je beginscherm), gegevens blijven op het toestel.

## Starten

```bash
cd puls
npm install
npm run dev        # http://localhost:5173, open op je telefoon via het netwerkadres
npm test           # rekenregels, database en schema-generator
npm run build      # productiebuild in dist/
npm run build:single  # alles in één HTML-bestand (dist-single/) om te delen
```

## Volgende stappen richting App Store / Play Store

1. **Native verpakken** met [Capacitor](https://capacitorjs.com): dezelfde code wordt een iOS- en Android-app.
2. **Push-meldingen op de achtergrond**: in de webversie komen reminders alleen als de app open is of op de achtergrond draait. In de native app plan je ze met lokale notificaties (Capacitor Local Notifications).
3. **Stappen automatisch**: Google Fit-API’s worden uitgefaseerd; gebruik **Health Connect** (Android) en **HealthKit** (iOS) via een Capacitor-plugin. Het koppelscherm staat al klaar.
4. **Abonnement**: in-app aankopen via App Store en Google Play (bijv. met RevenueCat); de Premium-schermen en vergrendelde functies staan al klaar.
5. **Accounts en sync**: nu staat alles lokaal op het toestel; met een backend (bijv. Supabase of Firebase) kunnen gebruikers wisselen van telefoon.
6. **Open Food Facts**: vermeld de bron (ODbL-licentie) in de app en stuur een eigen User-Agent mee vanuit de native app.
