#!/bin/bash

echo "🚀 Configuration DDEV pour gros fichiers CSV..."

# Vérifier si DDEV est installé
if ! command -v ddev &> /dev/null; then
    echo "❌ DDEV n'est pas installé ou pas dans le PATH"
    echo "Installation: https://ddev.readthedocs.io/en/stable/users/install/"
    exit 1
fi

# Afficher la version DDEV
echo "📋 Version DDEV: $(ddev version | head -n1)"

# Arrêter DDEV si nécessaire
echo "🔄 Arrêt du projet DDEV..."
ddev stop 2>/dev/null || true

# Vérifier les fichiers de configuration
echo "⚙️  Vérification de la configuration..."

if [ -f ".ddev/php/large-files.ini" ]; then
    echo "✅ Configuration PHP trouvée"
else
    echo "❌ Configuration PHP manquante"
fi

if [ -f ".ddev/nginx_full/large-files.conf" ]; then
    echo "✅ Configuration Nginx trouvée"  
else
    echo "❌ Configuration Nginx manquante"
fi

# Redémarrer DDEV avec la nouvelle configuration
echo "🔄 Démarrage de DDEV avec nouvelle configuration..."
ddev start

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ DDEV démarré avec succès !"
    echo ""
    echo "📊 Configuration appliquée :"
    echo "   - upload_max_filesize: 500M"
    echo "   - post_max_size: 500M"
    echo "   - memory_limit: 2048M"
    echo "   - max_execution_time: 600s"
    echo "   - client_max_body_size: 500M"
    echo ""
    echo "🌐 URLs du projet :"
    ddev describe | grep -E "https?://"
    echo ""
    echo "🔧 Commandes utiles :"
    echo "   - ddev logs      # Voir les logs"
    echo "   - ddev ssh       # SSH dans le container"
    echo "   - ddev stop      # Arrêter le projet"
    echo ""
    echo "✨ Vous pouvez maintenant charger votre fichier de 161MB !"
else
    echo "❌ Erreur lors du démarrage de DDEV"
    echo "Vérifiez les logs avec: ddev logs"
fi