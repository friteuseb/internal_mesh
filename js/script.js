import { updateGraph, displayMetrics } from './graphHandler.js';

document.addEventListener('DOMContentLoaded', () => {
    fetch('data.php')
        .then(response => response.json())
        .then(json => {
            if (json.error) {
                throw new Error(json.error);
            }
            updateGraph(json.data || [], {}, json.metrics?.orphan_pages || []);
            displayMetrics(json.metrics || null);
        })
        .catch(error => {
            console.error('Error fetching initial data:', error);
            // Initialiser avec des données vides si aucun fichier n'existe
            updateGraph([], {}, []);
            displayMetrics(null);
        });
});
