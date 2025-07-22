import { updateGraph, displayMetrics, displayThemes, displaySuggestions } from './graphHandler.js';

document.addEventListener('DOMContentLoaded', () => {
    fetch('data.php')
        .then(response => response.json())
        .then(json => {
            if (json.error) {
                throw new Error(json.error);
            }
            updateGraph(json.data || [], json.themes || {}, json.metrics?.orphan_pages || [], json.metrics?.suggestions || []);
            displayMetrics(json.metrics || null);
            displayThemes(json.themes || {});
            displaySuggestions(json.metrics?.suggestions || []);
        })
        .catch(error => {
            console.error('Error fetching initial data:', error);
            // Initialiser avec des données vides si aucun fichier n'existe
            updateGraph([], {}, [], []);
            displayMetrics(null);
            displayThemes({});
            displaySuggestions([]);
        });
});
