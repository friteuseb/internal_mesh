import { updateGraph, displayMetrics, displayThemes, displaySuggestions } from './graphHandler.js';

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
    
    // Simulation de progression initiale
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress > 90) progress = 90;
        progressFill.style.width = progress + '%';
        
        if (fileSizeMB > 100) {
            progressText.textContent = `Traitement d'un gros fichier (${fileSizeMB.toFixed(1)} MB)... ${Math.round(progress)}%`;
        } else {
            progressText.textContent = `Analyse en cours... ${Math.round(progress)}%`;
        }
    }, 500);

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

    // Timeout spécial pour gros fichiers
    const timeoutMs = fileSizeMB > 50 ? 300000 : 120000; // 5min pour gros fichiers, 2min sinon
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    fetch('data.php', {
        method: 'POST',
        body: formData,
        signal: controller.signal
    })
    .then(response => {
        return response.text().then(text => {
            console.log('Raw response:', text);
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('JSON Parse Error:', e);
                throw new Error('Réponse serveur invalide: ' + text);
            }
        });
    })
    .then(json => {
        clearTimeout(timeoutId);
        clearInterval(progressInterval);
        
        console.log('Parsed JSON:', json);
        if (json.error) {
            throw new Error(json.error);
        }
        
        // Finaliser la progression
        progressFill.style.width = '100%';
        progressText.textContent = 'Traitement terminé !';
        
        // Afficher les résultats
        updateGraph(json.data || [], json.themes || {}, json.metrics?.orphan_pages || [], json.metrics?.suggestions || []);
        displayMetrics(json.metrics || null);
        displayThemes(json.themes || {});
        displaySuggestions(json.metrics?.suggestions || []);
        
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
        clearInterval(progressInterval);
        
        console.error('Error:', error);
        
        let errorMessage = error.message;
        if (error.name === 'AbortError') {
            errorMessage = `Timeout: Le fichier est trop volumineux (${fileSizeMB.toFixed(1)} MB) ou le traitement a pris trop de temps. Essayez de diviser le fichier ou augmentez les limites du serveur.`;
        }
        
        errorContainer.innerHTML = `<p>❌ ${errorMessage}</p>`;
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

// Initialiser les valeurs par défaut
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('excluded-selectors').value = 'header, footer, nav, .navbar, .menu, .navigation, .breadcrumb, .pagination, .sidebar, .widget';
});
