# Mise en route — guide pas à pas

Compte ~45 minutes en tout. Aucune étape ne demande d'écrire du code.

À la fin, tu auras : un lien à donner aux invités, et un dossier Dropbox qui se
remplit tout seul.

---

## ⚠️ À lire avant tout : l'espace Dropbox

Un compte Dropbox gratuit, c'est **2 Go**. Une photo d'iPhone pèse 3 à 5 Mo.

| Invités qui envoient | Photos chacun | Espace nécessaire |
| -------------------- | ------------- | ----------------- |
| 20                   | 20            | ~1,6 Go — ça passe |
| 40                   | 30            | ~4,8 Go — **saturé** |
| 80                   | 40            | ~12,8 Go — **saturé** |

Quand le compte est plein, Dropbox refuse les uploads et les invités voient une
erreur. Deux options :

1. **Dropbox Plus** (2 To) — quelques euros pour un mois, résilié après. C'est
   l'option sûre et la moins chère en tranquillité d'esprit.
2. **Rester en gratuit** et surveiller l'espace pendant la soirée
   (dropbox.com → ton avatar → l'espace utilisé s'affiche).

Si le mariage fait plus de 30 invités, prends Plus. Vraiment.

---

## Étape 1 — Créer l'app Dropbox

L'app sert à donner au site un accès **limité à un seul dossier**. Même si
quelqu'un mettait la main sur les clés, il ne verrait rien du reste du Dropbox.

1. Va sur **<https://www.dropbox.com/developers/apps>** et connecte-toi avec le
   compte Dropbox qui stockera les photos.
2. Clique **Create app**.
3. Réponds aux trois questions :

   | Question | Réponse |
   | -------- | ------- |
   | Choose an API | **Scoped access** |
   | Choose the type of access | **App folder** ← important, c'est ce qui restreint l'accès |
   | Name your app | `photos-mariage-alex-seve` (le nom doit être unique sur tout Dropbox ; ajoute des chiffres si c'est refusé) |

4. Clique **Create app**.

Dropbox vient de créer le dossier `Dropbox/Applications/photos-mariage-alex-seve/`.
C'est là que les photos atterriront, dans un sous-dossier par invité.

## Étape 2 — Donner la permission d'écrire

**Fais cette étape avant l'étape 3**, sinon le token généré n'aura pas les
droits et il faudra tout recommencer.

1. Dans ton app, onglet **Permissions**.
2. Coche exactement ces trois cases :

   | Permission | À quoi elle sert |
   | ---------- | ---------------- |
   | `files.content.write` | déposer les photos |
   | `files.metadata.read` | lister les invités et leurs photos |
   | `files.content.read` | afficher et télécharger les photos |

   Laisse tout le reste décoché — et surtout pas `files.permanent_delete` :
   le site ne supprime rien, et il ne doit même pas pouvoir le faire.

3. Clique **Submit** en bas de la page.

> ⚠️ **Une permission ajoutée après coup ne s'applique pas au token existant.**
> Si tu coches une case alors que le site tourne déjà, il faut refaire
> l'étape 4 pour générer un refresh token neuf, puis le remplacer dans
> `.env.local` et dans Vercel.

## Étape 3 — Récupérer la clé et le secret

Onglet **Settings** de ton app. Note quelque part :

- **App key** → ce sera `DROPBOX_APP_KEY`
- **App secret** (clique « Show ») → ce sera `DROPBOX_APP_SECRET`

## Étape 4 — Générer le refresh token

Un *refresh token* n'expire jamais : tu le génères une fois, le site s'en sert
pour obtenir des accès courts au fil des uploads.

**4a.** Ouvre cette URL dans ton navigateur, en remplaçant `TON_APP_KEY` :

```
https://www.dropbox.com/oauth2/authorize?client_id=TON_APP_KEY&response_type=code&token_access_type=offline
```

Clique **Allow**. Dropbox affiche un code — copie-le.

**4b.** Dans un terminal, remplace les trois valeurs et lance :

```bash
curl -u TON_APP_KEY:TON_APP_SECRET https://api.dropbox.com/oauth2/token -d code=LE_CODE_COPIE -d grant_type=authorization_code
```

La réponse ressemble à ça :

```json
{
  "access_token": "sl.B...",
  "refresh_token": "8pP...",   ← celui-là
  "expires_in": 14400
}
```

Copie la valeur de **`refresh_token`** → ce sera `DROPBOX_REFRESH_TOKEN`.

> Le code de l'étape 4a n'est valable que quelques minutes et ne sert qu'une
> fois. Si le `curl` répond `invalid_grant`, refais 4a pour obtenir un code neuf.

## Étape 5 — Tester en local

```bash
cp .env.example .env.local
```

Ouvre `.env.local` et colle tes trois valeurs. Puis :

```bash
npm run dev
```

Va sur <http://localhost:3000>, mets un prénom, envoie une photo. Elle doit
apparaître dans `Dropbox/Applications/photos-mariage-alex-seve/TonPrénom/`.

Si ça ne marche pas, le terminal `npm run dev` affiche la vraie raison de
l'erreur (la page, elle, reste volontairement vague pour les invités).

## Étape 6 — Mettre en ligne sur Vercel

**6a. Envoyer le code sur GitHub**

```bash
git add -A && git commit -m "Site photos du mariage"
```

Crée un dépôt **privé** sur GitHub, puis :

```bash
git remote add origin git@github.com:TON_COMPTE/wedding-photos.git && git push -u origin main
```

**6b. Importer dans Vercel**

1. <https://vercel.com/new> → sélectionne le dépôt.
2. Avant de cliquer Deploy, déplie **Environment Variables** et ajoute :

   | Name | Value |
   | ---- | ----- |
   | `DROPBOX_APP_KEY` | ta clé |
   | `DROPBOX_APP_SECRET` | ton secret |
   | `DROPBOX_REFRESH_TOKEN` | ton refresh token |

3. **Deploy.**

**6c. Fixer l'URL du site**

Une fois déployé, Vercel te donne une URL (par ex. `wedding-photos-xyz.vercel.app`).
Tu peux la garder, ou en choisir une plus jolie dans *Settings → Domains*.

Ajoute ensuite une dernière variable dans *Settings → Environment Variables* :

| Name | Value |
| ---- | ----- |
| `NEXT_PUBLIC_SITE_URL` | `https://ton-url-definitive` (sans slash final) |

Puis *Deployments → … → Redeploy*. Cette variable sert aux aperçus quand le lien
est partagé dans une conversation.

## Étape 7 — Tester pour de vrai

Ouvre le lien sur ton propre téléphone, mets un prénom, envoie une photo, et va
vérifier qu'elle est bien dans le dossier Dropbox. C'est le seul test qui
compte : le mobile se comporte différemment du navigateur de bureau.

## Étape 8 — Après le mariage

**Récupérer les photos :** le plus simple est de passer par le site lui-même —
*Voir et récupérer les photos* → **Tout télécharger**. Tu peux aussi n'emporter
que les photos d'un invité, ou une sélection.

Tout part dans un seul fichier ZIP, quel que soit le poids de l'album. La
préparation dispose de cinq minutes chez l'hébergeur (`ARCHIVE_MAX_SECONDS`
dans `lib/config.ts`, à garder égal au `maxDuration` de
`app/api/download/route.ts`) : au-delà, la fonction est coupée et le fichier
reste inachevé. Si cela devait arriver sur une connexion lente, télécharge
plutôt invité par invité — ou passe par Dropbox, ci-dessous.

Sinon, directement sur dropbox.com : va dans
`Applications/photos-mariage-alex-seve`, clique les trois points → **Download**.
Dropbox prépare un ZIP de tout le dossier.

**Fermer le robinet :** sur <https://www.dropbox.com/developers/apps>, ouvre
l'app → *Settings* → **Delete app**. Le site ne pourra plus rien écrire, et les
photos déjà là ne bougent pas.

---

## En cas de pépin le jour J

| Symptôme | Cause probable | Quoi faire |
| -------- | -------------- | ---------- |
| « Impossible de préparer l'envoi » | Dropbox plein, ou variable d'env manquante | Vercel → *Logs* pour voir l'erreur exacte |
| Les photos sont listées mais les vignettes restent vides | `files.content.read` manquant sur le token | Étape 2, puis **refaire l'étape 4** : un token ne gagne pas une permission après coup |
| Les invités voient une page blanche | Déploiement raté | Vercel → *Deployments*, redéployer le dernier qui marchait |
| Un invité dit « ça tourne sans fin » | Réseau saturé dans la salle | Lui dire de réessayer plus tard, ou depuis chez lui — le lien reste valable |

Garde l'onglet **Vercel → Logs** ouvert sur ton téléphone pendant la soirée :
c'est là que tout se voit.
