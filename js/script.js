import { updateGraph } from './graphHandler.js';

document.addEventListener('DOMContentLoaded', () => {
    fetch('data.php')
        .then(response => response.json())
        .then(json => {
            if (json.error) {
                throw new Error(json.error);
            }
            updateGraph(json.data);
        })
        .catch(error => console.error('Error fetching initial data:', error));
});
