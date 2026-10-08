# Archivio dispense

Sito statico per raccogliere dispense scolastiche divise per materia e, dentro
ogni materia, per argomento.
HTML, CSS e JavaScript puri, senza dipendenze né build.

## Struttura

```
archivio-dispense/
├── index.html
├── css/
│   ├── fonts.css          caratteri (file in assets/fonts)
│   ├── base.css           colori dei due temi, reset, tipografia
│   ├── layout.css         barra in alto, intestazioni, griglie
│   └── components.css     cartelle, schede dispensa, ricerca, bottoni, tasto tema
├── js/
│   ├── boot.js            applica il tema salvato prima che la pagina compaia
│   ├── app.js             punto d'ingresso: password, navigazione e ricerca
│   ├── config.js          nome del sito, password, repository, elenco delle materie
│   ├── archive.js         carica indice e dispense, le divide per materia e argomento
│   ├── parser.js          legge i file .yml
│   ├── views.js           costruisce le pagine (cartelle, dispense, risultati)
│   ├── filetypes.js       tipo di file dall'estensione
│   ├── theme.js           tasto tema scuro/chiaro
│   └── dom.js, icons.js, text.js   piccole utilità
├── dispense/              i file delle dispense, i loro .yml e indice.json
│   └── <materia>/<argomento>/      dove finiscono le dispense proposte con una issue
├── assets/                favicon e caratteri
├── strumenti/
│   ├── aggiorna-indice.mjs         rigenera dispense/indice.json
│   └── issue-in-pr.mjs             trasforma una issue in una pull request
├── netlify.toml           a ogni pubblicazione Netlify rigenera l'indice
└── .github/
    ├── ISSUE_TEMPLATE/    un modulo per materia, per proporre una dispensa
    └── workflows/proposta-dispensa.yml
```

## Proporre una dispensa (senza permessi sulla repo)

Serve solo un account GitHub.

1. Nel sito premi **Carica dispensa** (pagina iniziale), oppure su GitHub vai in
   *Issues > New issue*.
2. Scegli il modulo della materia.
3. Compila: titolo, descrizione (facoltativa), autore, argomento e file.
   - **Argomento** è la cartella dentro la materia. Se quella che ti serve non
     c'è, scegli "Nuovo argomento" e scrivi il nome nel campo sotto.
   - **File**: uno solo, al massimo 50 MB. Formati ammessi: pdf, png, jpg, jpeg,
     gif, webp, doc, docx, xls, xlsx, pptx, odt, ods, odp, txt, zip (i vecchi
     .ppt GitHub non li fa caricare: salvali come .pptx o mettili in uno zip).
4. Invia. Entro un minuto circa un commento sulla issue ti dà il link alla pull
   request preparata in automatico, oppure ti dice cosa correggere. In quel
   caso apri una nuova issue: modificare quella vecchia non fa ripartire il
   controllo.

La dispensa compare nel sito quando un collaboratore accetta la pull request.

## Accettare una proposta (collaboratori)

Ogni issue valida diventa una pull request dal ramo `dispensa/issue-<numero>`.
Non viene mai accettata in automatico.

1. Apri la pull request e guarda *Files changed*: ci sono il file, il suo
   `.yml` e, se l'argomento è nuovo, la voce aggiunta alla tendina del modulo.
2. **Apri il file** e controlla che sia davvero una dispensa: chiunque può
   aprire una issue. Controlla anche titolo, autore e argomento nel `.yml`
   (puoi correggerli direttamente nella pull request).
3. Se va bene, *Merge pull request*: la issue si chiude da sola e Netlify
   ripubblica il sito. Se non va bene, chiudi la pull request e la issue.

Come funziona: il workflow `.github/workflows/proposta-dispensa.yml` parte a
ogni issue aperta ed esegue `strumenti/issue-in-pr.mjs`, che legge i campi,
scarica l'allegato (solo dagli allegati di GitHub), lo salva in
`dispense/<materia>/<argomento>/` senza sovrascrivere nulla e scrive il `.yml`.
Le issue che non vengono da un modulo sono ignorate.

Per provarlo in locale senza scaricare né scrivere niente, salva il corpo di
una issue in un file e lancia:

```
node strumenti/issue-in-pr.mjs --prova corpo.md
```

### Impostazioni della repo necessarie

- *Settings > Actions > General > Workflow permissions*: attiva
  **Allow GitHub Actions to create and approve pull requests**.
- *Settings > General > Features*: **Issues** attive.
- Repo **pubblica**, altrimenti solo i collaboratori possono aprire issue.

### Moduli e materie

I moduli stanno in `.github/ISSUE_TEMPLATE/`, uno per materia. L'action legge
da lì la materia e gli argomenti: non cambiare gli `id`, le etichette (`label`)
e la forma delle voci sotto `options`.

- Un argomento proposto con una issue viene aggiunto alla tendina dall'action.
  Se invece ne crei uno a mano (vedi sotto), aggiungi tu la riga
  `- "Nome argomento"` nel modulo, prima di `- "Nuovo argomento"`.
- Per una materia nuova: aggiungila in `js/config.js`, copia un modulo e cambia
  il nome della materia in tutti i punti in cui compare.

## Aggiungere una dispensa a mano

1. Copia il file in `dispense/` (va bene anche una sottocartella, per esempio
   `dispense/storia/eta-napoleonica/`).
   Formati: PDF, immagini, Word, Excel, PowerPoint, OpenDocument, txt, zip.
2. Crea accanto un file **con lo stesso nome** ed estensione `.yml`:

   ```yaml
   titolo: Verga e il Verismo
   descrizione: Contesto storico, poetica dell'impersonalità e trama de I Malavoglia.
   autore: Mario Rossi
   materia: Italiano
   argomento: Verismo
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

### Il campo `argomento`

È facoltativo. Le dispense con lo stesso `argomento` finiscono in una cartella
dentro la materia, all'indirizzo `#/materia/<materia>/<argomento>`; maiuscole,
accenti e trattini non contano, quindi "Età napoleonica" ed "eta-napoleonica"
sono la stessa cartella. Le dispense senza `argomento` restano nella pagina
della materia, sotto le cartelle. La ricerca trova anche per argomento.

Conta solo quello che è scritto nel `.yml`: la cartella in cui si trova il file
non decide né la materia né l'argomento. Le dispense già presenti in
`dispense/` possono quindi restare dove sono.

I valori stanno su una riga sola. Possono essere tra virgolette; tra virgolette
doppie `\"` vale `"` e `\\` vale `\` (così li scrive l'action).

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

Il sito è pubblicato su Netlify, che a ogni push sul ramo `main` esegue lo
script (vedi `netlify.toml`) e ripubblica: su GitHub basta caricare i due file,
o accettare una pull request.

## Password

All'apertura il sito chiede una password, una volta sola per browser. Si cambia
in `js/config.js` (`PASSWORD`).

Serve solo a tenere lontani i curiosi: è scritta in chiaro nel codice, che in
una repo pubblica chiunque può leggere, e i file in `dispense/` restano
raggiungibili da chi ne conosce l'indirizzo. Non usarla per proteggere
materiale riservato.

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
