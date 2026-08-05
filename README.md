# Photos du mariage — Alex & Séve

Une page où les invités déposent les photos qu'ils ont prises. Pas de compte à
créer, pas d'application à installer : un prénom, des photos, envoyé.

**Nouveau sur ce projet ? Va directement dans [SETUP.md](./SETUP.md)** — c'est le
guide pas à pas des étapes Dropbox et Vercel.

---

## Comment ça marche

```
Navigateur                    Vercel                      Dropbox
    │                           │                            │
    ├── « je veux envoyer ──────►                            │
    │    IMG_1234.jpg »         ├── refresh token ──────────►│
    │                           │◄──── lien temporaire ──────┤
    │◄──── lien temporaire ─────┤                            │
    │                                                        │
    └──────────── la photo, en direct ──────────────────────►│
```

Deux conséquences, et c'est tout l'intérêt du montage :

- **Le token Dropbox ne quitte jamais le serveur.** Le navigateur ne reçoit
  qu'un lien d'écriture à usage unique, pour un seul fichier. Impossible pour un
  invité — ou pour quelqu'un qui inspecterait la page — de lire ou de supprimer
  quoi que ce soit.
- **Les photos ne passent pas par Vercel.** Elles vont du téléphone à Dropbox en
  direct, donc pas de limite de taille de requête serverless, et rien à payer.

Les fichiers arrivent rangés : un dossier par prénom, un horodatage devant
chaque nom de fichier pour garder l'ordre chronologique.

## Développement

```bash
npm install
```

```bash
cp .env.example .env.local
```

Remplis `.env.local` (voir [SETUP.md](./SETUP.md)), puis :

```bash
npm run dev
```

| Commande | Effet |
| -------- | ----- |
| `npm run dev` | Serveur de développement sur <http://localhost:3000> |
| `npm run build` | Build de production |
| `npm run lint` | ESLint |

### Tester depuis un vrai téléphone

C'est le seul test qui vaille : le drag & drop marche partout, la sélection
photo d'iOS est plus capricieuse.

```bash
npm run dev -- --hostname 0.0.0.0
```

Puis ouvre `http://<ip-de-ton-mac>:3000` depuis le téléphone, sur le même wifi.

## Le code, en cinq fichiers

| Fichier | Rôle |
| ------- | ---- |
| [`lib/config.ts`](lib/config.ts) | **Prénoms, date, formats acceptés.** Le seul fichier à toucher pour réutiliser le site pour un autre mariage. |
| [`app/globals.css`](app/globals.css) | Le thème daisyUI `rustique` — toutes les couleurs sont en haut du fichier. |
| [`app/api/upload-link/route.ts`](app/api/upload-link/route.ts) | Valide la demande et renvoie un lien Dropbox temporaire. |
| [`lib/upload.ts`](lib/upload.ts) | Côté navigateur : envoi, progression, réessais, file d'attente. |
| [`app/components/UploadZone.tsx`](app/components/UploadZone.tsx) | Toute l'interface d'envoi. |

## Choix de conception

**Réessais automatiques.** Chaque fichier a droit à trois tentatives, et
redemande un lien neuf à chaque fois. Un lien expiré pendant qu'une photo
attendait son tour dans la file se répare donc tout seul — c'est le cas le plus
fréquent quand quelqu'un envoie 60 photos d'un coup.

**Trois envois en parallèle.** Le wifi d'une salle de réception est ce qu'il
est : trois uploads simultanés vont plus vite que dix qui se battent pour la
bande passante. Réglable via `UPLOAD_CONCURRENCY`.

**Photos uniquement.** Les vidéos dépassent vite les 150 Mo qu'accepte un lien
d'upload temporaire Dropbox. Pour les autoriser malgré tout, ajoute les
extensions dans `ALLOWED_EXTENSIONS` et élargis `ACCEPT_ATTRIBUTE` — en
acceptant que les longues vidéos échoueront.

**Le prénom est retenu.** Il est enregistré dans le navigateur : un invité qui
revient dix minutes plus tard n'a plus qu'à choisir ses photos.

**La page n'est pas indexée.** `robots: noindex` sur toutes les pages. L'album
est privé, il n'a rien à faire dans un moteur de recherche.

## Réutiliser ce site pour un autre mariage

1. Change `WEDDING` dans [`lib/config.ts`](lib/config.ts).
2. Ajuste les couleurs du thème `rustique` en haut de
   [`app/globals.css`](app/globals.css).
3. Refais [SETUP.md](./SETUP.md) avec une nouvelle app Dropbox.

---

Next.js 16 (App Router) · Tailwind CSS 4 · daisyUI 5 · Dropbox API v2
