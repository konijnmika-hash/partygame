# Fris

Een frisse voedings- en sportapp: calorieën en macro's tellen, water en stappen bijhouden, en een gymschema op maat.

## Wat zit erin

- **Intake bij de eerste start**: naam, geslacht, leeftijd, lengte, gewicht, doel (afvallen / behouden / aankomen), tempo en streefgewicht, dagelijkse activiteit, trainingsdagen, gym of thuis, focus en ervaring.
- **Persoonlijke doelen**: calorieën via Mifflin-St Jeor × activiteitsfactor (met tekort/overschot op basis van tempo), eiwit 1,6–2,0 g/kg, vet 28 %, de rest koolhydraten; waterdoel 35 ml/kg (+0,5 L op trainingsdagen) en een stappendoel op basis van je activiteit.
- **Dagboek**: ontbijt, lunch, avondeten en snacks, met aanbevolen kcal per maaltijd, “zelfde als gisteren” en per dag terugbladeren.
- **Voedingsdatabase**: 200+ Nederlandse basisproducten met porties (snee, plak, glas…), plus online zoeken in miljoenen merkproducten via [Open Food Facts](https://world.openfoodfacts.org). Ook: snel kcal toevoegen, eigen producten, favorieten, recent en een barcodescanner (camera, of cijfers intikken).
- **Water**: glas met golfanimatie en een seintje als je achterloopt op schema.
- **Stappen**: handmatig invoeren; koppelscherm voor Health Connect / Apple Gezondheid (zie hieronder).
- **Trainingsschema**: kies je dagen en je krijgt automatisch een split (full body, boven/onder, push/pull/benen) met sets, herhalingen en rust die passen bij je doel (vet verbranden, spiermassa, kracht, fit) en of je in de gym of thuis traint. Tijdens de training vink je sets af, houd je je gewichten bij en loopt er een rusttimer. Verbrande kcal gaan naar je dagbudget.
- **Activiteiten**: hardlopen, fietsen, padel, zwemmen enz. met kcal-schatting (MET).
- **Voortgang**: gewichtslijn naar streefgewicht, calorieën, water en stappen per dag, streak.
- **Premium (€ 4,99/mnd of € 39,99/jaar)**: barcodescanner, eigen doelen en 30-dagen-grafieken. Nu een demo-schakelaar; echte betalingen gaan straks via App Store / Google Play.
- Licht en donker thema, werkt offline als PWA (installeerbaar op je beginscherm), gegevens blijven op het toestel.

## Starten

```bash
cd fris
npm install
npm run dev        # http://localhost:5173, open op je telefoon via het netwerkadres
npm test           # rekenregels, database en schema-generator
npm run build      # productiebuild in dist/
npm run build:single  # alles in één HTML-bestand (dist-single/) om te delen
```

## Volgende stappen richting App Store / Play Store

1. **Native verpakken** met [Capacitor](https://capacitorjs.com): dezelfde code wordt een iOS- en Android-app.
2. **Stappen automatisch**: Google Fit-API’s worden uitgefaseerd; gebruik **Health Connect** (Android) en **HealthKit** (iOS) via een Capacitor-plugin. Het koppelscherm staat al klaar.
3. **Abonnement**: in-app aankopen via App Store en Google Play (bijv. met RevenueCat); de Premium-schermen en vergrendelde functies staan al klaar.
4. **Accounts en sync**: nu staat alles lokaal op het toestel; met een backend (bijv. Supabase of Firebase) kunnen gebruikers wisselen van telefoon.
5. **Open Food Facts**: vermeld de bron (ODbL-licentie) in de app en stuur een eigen User-Agent mee vanuit de native app.
