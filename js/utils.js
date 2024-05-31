// utils.js
function getLastSegment(url) {
    if (!url) return ''; // Return an empty string if url is undefined or null
    const segments = url.split('/');
    return segments[segments.length - 1] || segments[segments.length - 2];
}

function reloadPage() {
    window.location.reload();
}
