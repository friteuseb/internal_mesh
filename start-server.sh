#!/bin/bash

# Script de démarrage du serveur PHP avec configuration pour gros fichiers

echo "🚀 Démarrage du serveur PHP pour gros fichiers CSV..."

# Vérifier si PHP est installé
if ! command -v php &> /dev/null; then
    echo "❌ PHP n'est pas installé ou pas dans le PATH"
    exit 1
fi

# Afficher la version PHP
echo "📋 Version PHP: $(php -v | head -n1)"

# Tuer les processus PHP existants sur le port 8000
echo "🔄 Arrêt des serveurs existants..."
pkill -f "php.*8000" 2>/dev/null || true

# Démarrer le serveur avec la configuration personnalisée
if [ -f "php.ini" ]; then
    echo "⚙️  Utilisation de php.ini personnalisé"
    echo "📊 Configuration:"
    echo "   - post_max_size: 500M"
    echo "   - upload_max_filesize: 500M"
    echo "   - memory_limit: 2048M"
    echo "   - max_execution_time: 600s"
    echo ""
    echo "🌐 Serveur accessible sur: http://localhost:8000"
    echo "🔧 Pour arrêter: Ctrl+C ou pkill -f 'php.*8000'"
    echo ""
    
    php -c php.ini -S localhost:8000
else
    echo "⚠️  Fichier php.ini non trouvé, utilisation de la configuration par défaut"
    php -S localhost:8000
fi