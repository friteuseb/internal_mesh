import { updateGraph } from './graphHandler.js';

document.getElementById('upload-form').addEventListener('submit', function(event) {
    event.preventDefault();
    
    const formData = new FormData(this);
    const errorContainer = document.getElementById('error-container');
    errorContainer.innerHTML = '';

    fetch('data.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(json => {
        if (json.error) {
            throw new Error(json.error);
        }
        updateGraph(json.data);
    })
    .catch(error => {
        console.error('Error:', error);
        errorContainer.innerHTML = `<p>${error.message}</p>`;
    });
});
