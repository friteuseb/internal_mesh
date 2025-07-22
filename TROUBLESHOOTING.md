# 🔧 Résolution de Problèmes - Gros Fichiers CSV

## ❌ Erreur "POST Content-Length exceeds the limit"

**Problème:** Votre fichier (161MB) dépasse la limite PHP `post_max_size` (100MB par défaut).

## 🚀 Solution DDEV (Recommandée)

1. **Reconfigurer et redémarrer DDEV:**
   ```bash
   chmod +x ddev-setup.sh
   ./ddev-setup.sh
   ```

2. **Ou manuellement:**
   ```bash
   ddev stop
   ddev start
   ```

3. **Vérifier la configuration:**
   ```bash
   ddev ssh -s web
   php -i | grep -E "(upload_max_filesize|post_max_size|memory_limit)"
   ```

## 🔧 Solution Serveur PHP Direct

Si vous n'utilisez pas DDEV :

### 📊 Nouvelle Configuration (php.ini)

- `upload_max_filesize = 500M`
- `post_max_size = 500M` 
- `memory_limit = 2048M`
- `max_execution_time = 600s` (10 minutes)

### 🔍 Vérification

1. **Tester le serveur** avec le bouton "🔍 Tester le Serveur"
2. **Vérifier les limites** : Ouvrir http://localhost:8000/data.php?info=1
3. **Console développeur** (F12) pour voir les détails

### ⚡ Alternatives si le problème persiste

1. **Diviser le fichier** en parties < 100MB
2. **Utiliser des filtres plus restrictifs** avant export
3. **Modifier php.ini système** (nécessite admin)

### 🛠️ Commandes de diagnostic

```bash
# Vérifier les processus PHP
ps aux | grep php

# Vérifier le port 8000
netstat -an | grep 8000

# Tester directement
curl -I http://localhost:8000/data.php
```

### 📞 Support

Si le problème persiste, vérifiez :
- Les logs d'erreur PHP
- Les permissions des fichiers
- La version PHP (minimum 7.4 recommandé)