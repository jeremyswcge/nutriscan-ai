# 🚀 Guide de déploiement Vercel — NutriScan AI

## Étapes de déploiement

### 1. Préparer le code sur GitHub
1. Crée un nouveau repo GitHub (ex: `nutriscan-ai`)
2. Push tous ces fichiers :
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TON_USERNAME/nutriscan-ai.git
git push -u origin main
```

### 2. Déployer sur Vercel
1. Va sur [vercel.com](https://vercel.com) → **New Project**
2. Importe ton repo GitHub
3. Vercel détecte automatiquement **Vite** → clique **Deploy**

### 3. ⚠️ Variables d'environnement (OBLIGATOIRE)
Dans Vercel → Settings → **Environment Variables**, ajoute :

| Variable | Valeur |
|----------|--------|
| `GEMINI_API_KEY` | Ta clé API Google Gemini AI Studio |

### 4. ⚠️ Configurer Firebase Auth (OBLIGATOIRE)
Google Sign-In ne fonctionnera pas si tu n'ajoutes pas le domaine Vercel à Firebase.

1. Va sur [console.firebase.google.com](https://console.firebase.google.com)
2. Projet **cryptosim-40acf** → **Authentication** → **Sign-in method**
3. Onglet **Authorized domains** → **Add domain**
4. Ajoute : `ton-projet.vercel.app` (le domaine que Vercel t'a assigné)

### 5. Variables d'environnement alternatives
Si tu préfères utiliser le préfixe Vite standard, tu peux nommer la variable :
- `VITE_GEMINI_API_KEY` → fonctionne aussi grâce au vite.config.ts modifié

---

## Structure du projet
```
nutriscan/
├── src/
│   ├── App.tsx              # Composant principal
│   ├── firebase.ts          # Config Firebase
│   ├── main.tsx             # Point d'entrée
│   ├── types.ts             # Types TypeScript
│   ├── index.css            # Styles Tailwind
│   └── services/
│       └── geminiService.ts # Service Gemini AI
├── firebase-applet-config.json  # Config Firebase (public)
├── firestore.rules          # Règles Firestore
├── vercel.json              # Config Vercel
├── vite.config.ts           # Config Vite
├── index.html               # HTML racine
└── package.json
```

## Notes importantes
- La clé API Firebase dans `firebase-applet-config.json` est **normale à exposer** (c'est une clé publique Firebase)
- La clé `GEMINI_API_KEY` doit rester **secrète** → toujours en variable d'environnement
- Les règles Firestore dans `firestore.rules` doivent être déployées séparément via Firebase CLI
