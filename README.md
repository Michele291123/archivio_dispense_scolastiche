# Archivio dispense

Sito statico per raccogliere dispense scolastiche divise per materia.
HTML, CSS e JavaScript puri, senza dipendenze né build.

## Struttura

```
archivio-dispense/
├── index.html
├── css/
│   ├── fonts.css          caratteri (file in assets/fonts)
│   ├── base.css           colori dei due temi, reset, tipografia
│   ├── layout.css         barra in alto, intestazioni, griglie
│   └── components.css     cartelle, schede dispensa, ricerca, tasto tema
├── js/
│   ├── boot.js            applica il tema salvato prima che la pagina compaia
│   ├── app.js             punto d'ingresso: navigazione e ricerca
│   ├── config.js          nome del sito ed elenco delle materie
│   ├── archive.js         carica indice e dispense, le divide per materia
│   ├── parser.js          legge i file .yml
│   ├── views.js           costruisce le pagine (cartelle, dispense, risultati)
│   ├── filetypes.js       tipo di file dall'estensione
│   ├── theme.js           tasto tema scuro/chiaro
│   └── dom.js, icons.js, text.js   piccole utilità
├── dispense/              i file delle dispense, i loro .yml e indice.json
├── assets/                favicon e caratteri
├── strumenti/
│   └── aggiorna-indice.mjs
└── .github/workflows/aggiorna-indice.yml
```

## Aggiungere una dispensa

1. Copia il file in `dispense/` (va bene anche una sottocartella).
   Formati: PDF, immagini, Word, Excel, PowerPoint, OpenDocument, txt, zip.
2. Crea accanto un file **con lo stesso nome** ed estensione `.yml`:

   ```yaml
   titolo: Verga e il Verismo
   descrizione: Contesto storico, poetica dell'impersonalità e trama de I Malavoglia.
   autore: Mario Rossi
   materia: Italiano
   ```

   Esempio: `verga.pdf` + `verga.yml`.
3. Aggiorna l'indice:

   ```
   node strumenti/aggiorna-indice.mjs
   ```

Titolo, descrizione e autore compaiono sotto la scheda. `materia` decide la
cartella: deve corrispondere a uno dei nomi in `js/config.js` (maiuscole,
accenti e trattini non contano). Una materia non in elenco crea una cartella
nuova.

### Dispense senza `.yml`

Un file senza il suo `.yml` compare comunque: il titolo è il nome del file,
la descrizione è "descrizione vuota" e l'autore "autore sconosciuto". La
materia viene cercata nel nome del file: `DB_Informatica.pdf` finisce in
Informatica, `appunti-sistemi-e-reti.pdf` in Sistemi e Reti. Se nel nome non
c'è nessuna materia, la dispensa va in "Senza materia".

### Perché serve l'indice

Una pagina web non può sfogliare una cartella del server, quindi il sito legge
`dispense/indice.json` per sapere quali dispense esistono; i dati li prende poi
dai singoli `.yml`. Lo script rigenera l'indice e segnala i file senza `.yml`
(che compaiono con i dati ricavati dal nome) e i `.yml` senza file.

Se il sito sta su GitHub, il workflow in `.github/workflows/` esegue lo script
a ogni push che tocca `dispense/` (ramo `main`): lì basta caricare i due file.

## Vedere il sito in locale

Va aperto da un server web: con il doppio clic su `index.html` il browser
blocca la lettura delle dispense.

```
python -m http.server 8000
```

poi `http://localhost:8000`. Funziona anche con Live Server di VS Code.

## Modificare le materie

In `js/config.js`: nome e colore di ogni cartella, nell'ordine in cui compaiono.

## Caratteri

Barlow, Barlow Condensed e JetBrains Mono sono inclusi in `assets/fonts` con
le rispettive licenze (SIL Open Font License).
