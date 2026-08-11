/**
 * Fabrication d'une archive ZIP à la volée — **serveur uniquement**.
 *
 * Les entrées sont écrites « stockées », sans compression : une photo JPEG
 * est déjà compressée, la recompresser coûterait du temps de calcul pour
 * quelques pour-cent. Sans compression, l'archive se construit fichier par
 * fichier et part vers le navigateur au fur et à mesure : rien n'est gardé
 * en mémoire à part la photo en cours d'écriture.
 *
 * Format volontairement minimal (pas de Zip64) : il suppose des fichiers et
 * une archive de moins de 4 Go, ce qu'un album de mariage ne dépasse pas —
 * un compte Dropbox gratuit s'arrête bien avant.
 */

export type ZipEntry = {
  /** Chemin dans l'archive, séparateurs « / » */
  name: string;
  /** Poids annoncé par le catalogue, pour doser les lectures d'avance */
  size: number;
  /** Contenu, chargé seulement au moment où l'entrée est écrite */
  read: () => Promise<Uint8Array>;
  modified: Date;
};

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;

/** Bit 11 des drapeaux : les noms de fichiers sont en UTF-8 */
const UTF8_FLAG = 0x0800;
/** Méthode 0 = « stored ». Version 2.0 suffit pour du non compressé. */
const STORED = 0;
const VERSION = 20;

const encoder = new TextEncoder();

type CentralRecord = {
  name: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
};

/**
 * Assemble `entries` en un flux ZIP. Une entrée dont la lecture échoue est
 * simplement omise : mieux vaut une archive de 53 photos sur 54 qu'un
 * téléchargement interrompu au milieu.
 *
 * `concurrency` photos sont lues d'avance pendant que la précédente s'écrit.
 * C'est ce qui décide du temps total : une par une, chaque photo coûte un
 * aller-retour complet vers Dropbox, et une centaine de photos suffisent à
 * dépasser la durée de vie d'une fonction serverless — le téléchargement se
 * lance alors, avance, puis s'arrête sans jamais aboutir. Les entrées
 * s'écrivent malgré tout dans l'ordre : seule la lecture est en avance.
 *
 * `budget` borne ce que ces lectures d'avance occupent en mémoire. Une entrée
 * est tenue entière le temps de calculer son CRC : six photos de 4 Mo ne se
 * remarquent pas, six vidéos de 150 Mo font tomber la fonction. Une lecture
 * reste toujours autorisée, si grosse soit-elle, sans quoi une vidéo plus
 * lourde que le budget bloquerait l'archive pour de bon.
 */
export function createZipStream(
  entries: ZipEntry[],
  concurrency = 1,
  budget = Number.POSITIVE_INFINITY,
): ReadableStream<Uint8Array> {
  const central: CentralRecord[] = [];
  let offset = 0;
  /** Prochaine entrée dont la lecture reste à lancer */
  let reading = 0;
  /** Prochaine entrée à écrire dans le flux */
  let writing = 0;
  /** Poids annoncé des lectures en cours */
  let held = 0;

  /** Lectures en vol, par index — au plus `concurrency` à la fois */
  const inFlight = new Map<number, Promise<Uint8Array | null>>();

  function readAhead() {
    while (inFlight.size < Math.max(concurrency, 1) && reading < entries.length) {
      const entry = entries[reading];
      if (inFlight.size > 0 && held + entry.size > budget) return;

      const index = reading++;
      held += entry.size;

      inFlight.set(
        index,
        entry.read().catch((error: unknown) => {
          console.error(`ZIP : « ${entry.name} » a été sautée —`, error);
          return null;
        }),
      );
    }
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      readAhead();

      if (writing < entries.length) {
        const index = writing++;
        const entry = entries[index];

        const data = await inFlight.get(index)!;
        inFlight.delete(index);
        held -= entry.size;
        // La place libérée relance aussitôt une lecture : le tuyau ne se
        // vide jamais entre deux écritures.
        readAhead();

        if (data === null) return;

        const name = encoder.encode(entry.name);
        const crc = crc32(data);
        const time = dosTime(entry.modified);
        const date = dosDate(entry.modified);

        controller.enqueue(
          localHeader(name, crc, data.length, time, date),
        );
        controller.enqueue(data);

        central.push({ name, crc, size: data.length, offset, time, date });
        offset += 30 + name.length + data.length;
        return;
      }

      // Pas une seule photo n'a pu être lue : mieux vaut un téléchargement
      // en échec, visible, qu'une archive vide qui ne dit rien.
      if (central.length === 0) {
        controller.error(new Error("Aucune photo n'a pu être récupérée."));
        return;
      }

      // Toutes les entrées sont écrites : reste le sommaire de fin d'archive.
      let directorySize = 0;
      for (const record of central) {
        controller.enqueue(centralHeader(record));
        directorySize += 46 + record.name.length;
      }
      controller.enqueue(endOfDirectory(central.length, directorySize, offset));
      controller.close();
    },

    /**
     * Téléchargement abandonné en route (onglet fermé, réseau coupé) :
     * inutile de continuer à tirer des photos de Dropbox pour une archive
     * que plus personne n'attend.
     */
    cancel() {
      reading = entries.length;
      inFlight.clear();
      held = 0;
    },
  });
}

function localHeader(
  name: Uint8Array,
  crc: number,
  size: number,
  time: number,
  date: number,
): Uint8Array {
  const header = new Uint8Array(30 + name.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, LOCAL_SIGNATURE, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, UTF8_FLAG, true);
  view.setUint16(8, STORED, true);
  view.setUint16(10, time, true);
  view.setUint16(12, date, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true); // taille compressée = taille réelle
  view.setUint32(22, size, true);
  view.setUint16(26, name.length, true);
  view.setUint16(28, 0, true); // pas de champ « extra »
  header.set(name, 30);

  return header;
}

function centralHeader(record: CentralRecord): Uint8Array {
  const header = new Uint8Array(46 + record.name.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, CENTRAL_SIGNATURE, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, VERSION, true);
  view.setUint16(8, UTF8_FLAG, true);
  view.setUint16(10, STORED, true);
  view.setUint16(12, record.time, true);
  view.setUint16(14, record.date, true);
  view.setUint32(16, record.crc, true);
  view.setUint32(20, record.size, true);
  view.setUint32(24, record.size, true);
  view.setUint16(28, record.name.length, true);
  // extra, commentaire, disque, attributs internes puis externes : tous nuls
  view.setUint32(42, record.offset, true);
  header.set(record.name, 46);

  return header;
}

function endOfDirectory(
  count: number,
  directorySize: number,
  directoryOffset: number,
): Uint8Array {
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);

  view.setUint32(0, END_SIGNATURE, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, directorySize, true);
  view.setUint32(16, directoryOffset, true);

  return end;
}

/** Heure MS-DOS : heures, minutes, secondes par pas de 2 */
function dosTime(date: Date): number {
  return (
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    (date.getSeconds() >> 1)
  );
}

/** Date MS-DOS : années depuis 1980, mois, jour */
function dosDate(date: Date): number {
  const year = Math.max(date.getFullYear() - 1980, 0);
  return (year << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
}

/** Table du polynôme CRC-32 standard, calculée une fois pour toutes. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index++) {
    crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Rend `name` utilisable comme nom d'entrée, et garantit qu'il est unique
 * dans l'archive : deux invités peuvent très bien avoir un « IMG_1234.jpg ».
 * Le « / » est conservé : c'est lui qui crée les sous-dossiers à l'ouverture.
 */
export function uniqueEntryName(name: string, taken: Set<string>): string {
  const safe = name.replace(/[\\:*?"<>|]/g, "_").replace(/^\/+/, "");
  if (!taken.has(safe)) {
    taken.add(safe);
    return safe;
  }

  const dot = safe.lastIndexOf(".");
  const base = dot === -1 ? safe : safe.slice(0, dot);
  const extension = dot === -1 ? "" : safe.slice(dot);

  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})${extension}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}
