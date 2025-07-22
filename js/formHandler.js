import { updateGraph, displayMetrics } from './graphHandler.js';

document.getElementById('upload-form').addEventListener('submit', function(event) {
    event.preventDefault();
    
    const formData = new FormData(this);
    const errorContainer = document.getElementById('error-container');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const submitButton = this.querySelector('input[type="submit"]');
    
    errorContainer.innerHTML = '';
    
    // Vérifier la taille du fichier
    const fileInput = this.querySelector('input[type="file"]');
    const file = fileInput.files[0];
    
    if (!file) {
        errorContainer.innerHTML = '<p>Veuillez sélectionner un fichier.</p>';
        return;
    }
    
    const fileSizeMB = file.size / (1024 * 1024);
    
    // Avertissement pour les gros fichiers
    if (fileSizeMB > 50) {
        const warning = `
            <div class="file-size-warning">
                ⚠️ Fichier volumineux détecté (${fileSizeMB.toFixed(1)} MB).<br>
                Le traitement peut prendre plusieurs minutes.
            </div>
        `;
        errorContainer.innerHTML = warning;
    }
    
    // Désactiver le bouton et afficher la progression
    submitButton.disabled = true;
    submitButton.value = 'Traitement en cours...';
    progressContainer.classList.remove('hidden');
    
    // Simulation de progression plus réaliste
    let progress = 0;
    let progressStage = 'upload';
    const startTime = Date.now();
    
    const progressInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000; // secondes écoulées
        
        // Progression différentielle selon la phase
        if (progress < 30) {
            // Phase upload - rapide pour petits fichiers, plus lente pour gros
            const uploadSpeed = fileSizeMB > 100 ? 2 : 8;
            progress += Math.random() * uploadSpeed;
            progressStage = 'upload';
        } else if (progress < 70) {
            // Phase traitement - plus lente
            progress += Math.random() * 3;
            progressStage = 'processing';
        } else if (progress < 92) {
            // Phase finale - très lente pour ne pas dépasser
            progress += Math.random() * 1.5;
            progressStage = 'finalizing';
        }
        
        // Ne jamais dépasser 92% avant la réponse serveur
        if (progress > 92) progress = 92;
        
        progressFill.style.width = progress + '%';
        
        // Messages selon la phase et la taille
        let message = '';
        if (fileSizeMB > 100) {
            const messages = {
                'upload': `📤 Upload du gros fichier (${fileSizeMB.toFixed(1)} MB)...`,
                'processing': `⚙️ Traitement des données (${Math.round(elapsed)}s)...`,
                'finalizing': `🔄 Finalisation de l'analyse...`
            };
            message = messages[progressStage];
        } else if (fileSizeMB > 50) {
            const messages = {
                'upload': `📤 Upload en cours...`,
                'processing': `⚙️ Analyse du fichier (${fileSizeMB.toFixed(1)} MB)...`,
                'finalizing': `🔄 Génération des résultats...`
            };
            message = messages[progressStage];
        } else {
            message = `Analyse en cours...`;
        }
        
        progressText.textContent = `${message} ${Math.round(progress)}%`;
    }, 800); // Ralenti pour plus de réalisme

    // Ajouter les données des filtres
    const contentOnly = document.getElementById('content-only').checked;
    formData.append('content_only', contentOnly.toString());

    // Zones exclues
    const excludedZones = [];
    document.querySelectorAll('input[name="excluded_zones"]:checked').forEach(checkbox => {
        excludedZones.push(checkbox.value);
    });
    formData.append('excluded_zones', JSON.stringify(excludedZones));

    // Sélecteurs CSS exclus
    const excludedSelectors = document.getElementById('excluded-selectors').value
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    formData.append('excluded_selectors', JSON.stringify(excludedSelectors));

    // Timeout spécial pour gros fichiers avec avertissement intermédiaire
    const timeoutMs = fileSizeMB > 100 ? 600000 : (fileSizeMB > 50 ? 300000 : 120000); // 10min pour très gros, 5min pour gros, 2min normal
    
    const controller = new AbortController();
    let timeoutWarningShown = false;
    
    // Avertissement à mi-parcours du timeout
    const warningTimeoutId = setTimeout(() => {
        if (!timeoutWarningShown) {
            timeoutWarningShown = true;
            progressText.textContent = `⏳ Traitement long en cours... (${Math.round((Date.now() - startTime) / 1000)}s écoulées)`;
            
            // Afficher info additionnelle
            const warningDiv = document.createElement('div');
            warningDiv.className = 'processing-info';
            warningDiv.innerHTML = `
                ⚠️ <strong>Traitement de gros fichier en cours</strong><br>
                Cela peut prendre plusieurs minutes selon la taille (${fileSizeMB.toFixed(1)} MB).<br>
                <small>Le serveur traite ${fileSizeMB > 50 ? '50 000 lignes maximum' : 'toutes les lignes'} pour optimiser les performances.</small>
            `;
            errorContainer.appendChild(warningDiv);
        }
    }, timeoutMs / 2);
    
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeoutMs);
    
    fetch('data.php', {
        method: 'POST',
        body: formData,
        signal: controller.signal
    })
    .then(response => {
        console.log('Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`Erreur serveur: ${response.status} ${response.statusText}`);
        }
        
        return response.text().then(text => {
            console.log('Raw response length:', text.length);
            console.log('Raw response preview:', text.substring(0, 200));
            
            if (!text.trim()) {
                throw new Error('Réponse serveur vide - vérifiez la configuration PHP');
            }
            
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('JSON Parse Error:', e);
                console.error('Response text:', text);
                
                // Vérifier si c'est une erreur de limite PHP
                if (text.includes('POST Content-Length') && text.includes('exceeds the limit')) {
                    const match = text.match(/(\d+) bytes exceeds the limit of (\d+) bytes/);
                    if (match) {
                        const sentMB = (parseInt(match[1]) / (1024*1024)).toFixed(1);
                        const limitMB = (parseInt(match[2]) / (1024*1024)).toFixed(1);
                        throw new Error(`Fichier trop volumineux: ${sentMB}MB envoyé, limite: ${limitMB}MB. Redémarrez le serveur avec: php -c php.ini -S localhost:8000`);
                    }
                    throw new Error('Fichier trop volumineux - vérifiez la configuration post_max_size PHP');
                }
                
                // Vérifier si c'est une erreur PHP
                if (text.includes('Fatal error') || text.includes('Parse error')) {
                    throw new Error('Erreur PHP détectée - vérifiez les logs serveur');
                }
                
                // Vérifier si c'est un timeout PHP
                if (text.includes('maximum execution time')) {
                    throw new Error('Timeout PHP - le fichier est trop volumineux pour les limites serveur');
                }
                
                throw new Error('Réponse serveur invalide - format JSON attendu');
            }
        });
    })
    .then(json => {
        clearTimeout(timeoutId);
        clearTimeout(warningTimeoutId);
        clearInterval(progressInterval);
        
        console.log('Parsed JSON:', json);
        if (json.error) {
            throw new Error(json.error);
        }
        
        // Animation finale de progression
        progressFill.style.width = '95%';
        progressText.textContent = '🔄 Génération de la visualisation...';
        
        // Finaliser après un court délai pour l'effet visuel
        setTimeout(() => {
            progressFill.style.width = '100%';
            progressText.textContent = '✅ Traitement terminé !';
        }, 500);
        
        // Afficher les résultats
        updateGraph(json.data || [], {}, json.metrics?.orphan_pages || []);
        displayMetrics(json.metrics || null);
        
        // Message de succès avec informations détaillées
        const dataCount = json.data ? json.data.length : 0;
        const processingInfo = json.processing_info || {};
        
        let successMessage = `
            <div class="processing-info">
                ✅ ${json.message || 'Fichier traité avec succès !'}<br>
        `;
        
        if (processingInfo.is_large_file) {
            successMessage += `
                📊 Statistiques: ${processingInfo.total_rows_processed || 0} lignes processées<br>
                🔗 ${dataCount} liens valides extraits<br>
            `;
            
            if (processingInfo.was_limited) {
                successMessage += `
                    ⚠️ Traitement limité pour optimiser les performances<br>
                `;
            }
        } else {
            successMessage += `${dataCount} liens analysés<br>`;
        }
        
        successMessage += `</div>`;
        errorContainer.innerHTML = successMessage;
        
        // Masquer la barre de progression après 3 secondes
        setTimeout(() => {
            progressContainer.classList.add('hidden');
        }, 3000);
    })
    .catch(error => {
        clearTimeout(timeoutId);
        clearTimeout(warningTimeoutId);
        clearInterval(progressInterval);
        
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            fileSize: fileSizeMB,
            elapsedTime: (Date.now() - startTime) / 1000
        });
        
        const elapsedTime = Math.round((Date.now() - startTime) / 1000);
        let errorMessage = '';
        
        if (error.name === 'AbortError') {
            errorMessage = `
                <div class="error-details">
                    <strong>⏱️ Timeout après ${elapsedTime}s</strong><br>
                    Le fichier (${fileSizeMB.toFixed(1)} MB) a pris trop de temps à traiter.<br><br>
                    
                    <strong>Solutions possibles :</strong><br>
                    • Diviser le fichier en parties plus petites<br>
                    • Utiliser des filtres plus restrictifs<br>
                    • Réessayer (le serveur peut être temporairement surchargé)<br>
                    • Contacter l'administrateur pour augmenter les limites
                </div>
            `;
        } else if (error.message === 'Failed to fetch') {
            errorMessage = `
                <div class="error-details">
                    <strong>🌐 Problème de connexion réseau</strong><br>
                    Impossible de communiquer avec le serveur.<br><br>
                    
                    <strong>Causes possibles :</strong><br>
                    • Serveur PHP arrêté ou inaccessible<br>
                    • Fichier trop volumineux (${fileSizeMB.toFixed(1)} MB) pour les limites serveur<br>
                    • Timeout réseau ou proxy<br>
                    • Configuration PHP incorrecte (.htaccess non supporté)<br><br>
                    
                    <strong>Solutions :</strong><br>
                    • Vérifier que le serveur PHP est démarré<br>
                    • Utiliser un fichier plus petit (&lt; 50MB) pour tester<br>
                    • Vérifier les logs d'erreur PHP<br>
                    • Essayer : <code>php -S localhost:8000</code>
                </div>
            `;
        } else if (error.message.includes('Erreur serveur: 5')) {
            errorMessage = `
                <div class="error-details">
                    <strong>🔧 Erreur serveur interne</strong><br>
                    Le serveur a rencontré une erreur lors du traitement.<br><br>
                    
                    <strong>Probable :</strong><br>
                    • Fichier trop volumineux (${fileSizeMB.toFixed(1)} MB)<br>
                    • Limites PHP dépassées (mémoire/temps)<br>
                    • Erreur dans le code PHP<br><br>
                    
                    <strong>Solutions :</strong><br>
                    • Réduire la taille du fichier<br>
                    • Vérifier les logs PHP<br>
                    • Augmenter memory_limit et max_execution_time
                </div>
            `;
        } else {
            errorMessage = `
                <div class="error-details">
                    <strong>❌ Erreur : ${error.message}</strong><br>
                    Temps écoulé: ${elapsedTime}s | Taille: ${fileSizeMB.toFixed(1)} MB<br><br>
                    
                    <strong>Diagnostic :</strong><br>
                    Ouvrez la console développeur (F12) pour plus de détails.<br>
                    Vérifiez l'onglet Réseau pour voir les requêtes.
                </div>
            `;
        }
        
        errorContainer.innerHTML = `<div class="error-message">${errorMessage}</div>`;
        progressContainer.classList.add('hidden');
    })
    .finally(() => {
        // Réactiver le bouton
        submitButton.disabled = false;
        submitButton.value = 'Télécharger et Traiter';
    });
});

// Gestion du toggle des filtres
document.getElementById('toggle-filters').addEventListener('click', function() {
    const filterConfig = document.querySelector('.filter-config');
    filterConfig.classList.toggle('collapsed');
});

// Gestion du mode strict
document.getElementById('content-only').addEventListener('change', function() {
    const excludeOptions = document.querySelectorAll('input[name="excluded_zones"], #excluded-selectors');
    excludeOptions.forEach(input => {
        input.disabled = this.checked;
    });
});

// Fonction de test du serveur
document.getElementById('test-server').addEventListener('click', function() {
    const errorContainer = document.getElementById('error-container');
    const testButton = this;
    
    testButton.disabled = true;
    testButton.textContent = '🔍 Test en cours...';
    errorContainer.innerHTML = '<div class="processing-info">🔧 Test de connexion serveur...</div>';
    
    // Test 1: Vérifier si le serveur répond
    fetch('data.php', {
        method: 'GET',
        cache: 'no-cache'
    })
    .then(response => {
        console.log('Server test - Status:', response.status);
        return response.text();
    })
    .then(text => {
        console.log('Server test - Response:', text.substring(0, 200));
        
        // Test réussi
        let testResult = `
            <div class="processing-info">
                ✅ <strong>Serveur accessible</strong><br>
                Status: OK | Réponse reçue (${text.length} caractères)<br><br>
                
                <strong>Configuration détectée :</strong><br>
        `;
        
        try {
            const data = JSON.parse(text);
            testResult += `• Format JSON: ✅<br>`;
            testResult += `• Données: ${data.data ? data.data.length + ' liens' : 'Aucune donnée'}<br>`;
        } catch (e) {
            testResult += `• Format JSON: ❌ (${e.message})<br>`;
        }
        
        testResult += `• Taille réponse: ${(text.length / 1024).toFixed(2)} KB<br>`;
        testResult += `</div>`;
        
        errorContainer.innerHTML = testResult;
    })
    .catch(error => {
        console.error('Server test failed:', error);
        
        let diagnosticResult = `
            <div class="error-message">
                <div class="error-details">
                    <strong>❌ Test serveur échoué</strong><br>
                    Erreur: ${error.message}<br><br>
                    
                    <strong>Diagnostic :</strong><br>
        `;
        
        if (error.message === 'Failed to fetch') {
            diagnosticResult += `
                    • Le serveur PHP n'est pas démarré<br>
                    • Port 8000 non accessible<br>
                    • Firewall bloquant la connexion<br><br>
                    
                    <strong>Solutions :</strong><br>
                    1. Redémarrer le serveur: <code>php -S localhost:8000</code><br>
                    2. Vérifier l'URL: <a href="http://localhost:8000/data.php" target="_blank">http://localhost:8000/data.php</a><br>
                    3. Vérifier les processus: <code>netstat -an | grep 8000</code>
            `;
        } else {
            diagnosticResult += `
                    • Erreur réseau ou configuration<br>
                    • Voir console développeur pour détails
            `;
        }
        
        diagnosticResult += `</div></div>`;
        errorContainer.innerHTML = diagnosticResult;
    })
    .finally(() => {
        testButton.disabled = false;
        testButton.textContent = '🔍 Tester le Serveur';
    });
});

// Initialiser les valeurs par défaut
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('excluded-selectors').value = 'header, footer, nav, .navbar, .menu, .navigation, .breadcrumb, .pagination, .sidebar, .widget';
});
