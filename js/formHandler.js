import { updateGraph } from './graphHandler.js';
import { displayErrorMessage } from './errorHandler.js';

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById('upload-form').addEventListener('submit', function(event) {
        event.preventDefault();

        const formData = new FormData(this);

        fetch('data.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(json => {
            if (json.error) {
                displayErrorMessage(json.error);
            } else {
                console.log('Données chargées:', json.data);
                updateGraph(json.data);
            }
        })
        .catch(error => {
            console.error('Erreur lors du traitement du fichier:', error);
            displayErrorMessage('Une erreur s\'est produite lors du traitement du fichier.');
        });
    });

    fetch('data.php')
        .then(response => response.json())
        .then(json => {
            let data = json.data;
            console.log('Données chargées:', data);
            updateGraph(data);
        })
        .catch(error => console.error('Erreur lors du chargement des données:', error));
});

