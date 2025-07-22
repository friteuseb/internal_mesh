import { getLastSection, getColor, drag, removeNodesInQueue, updateTable } from './nodeHandler.js';

let currentData = [];
let currentThemes = {};
let currentOrphanPages = [];
let currentSuggestions = [];
let nodeSpacing = 150;
let repulsionForce = -100;
let collisionRadius = 10;
let colorByTheme = false;
let selectedNode = null;

export function updateGraph(data, themes = {}, orphanPages = [], suggestions = []) {
    currentData = data;
    currentThemes = themes;
    currentOrphanPages = orphanPages;
    currentSuggestions = suggestions;

    if (!Array.isArray(data)) {
        console.error('Data is not an array:', data);
        return;
    }

    const nodes = Array.from(new Set(data.flatMap(d => [d.Source, d.Destination]))).map(id => ({ id }));
    const links = data.map(d => ({ source: d.Source, target: d.Destination }));

    nodes.forEach(node => {
        node.incoming = links.filter(link => link.target === node.id).length;
        node.outgoing = links.filter(link => link.source === node.id).length;
        
        // Assigner une thématique basée sur l'URL
        try {
            const url = new URL(node.id);
            const pathSegments = url.pathname.split('/').filter(s => s.length > 0);
            node.theme = pathSegments.length > 0 ? pathSegments[0] : 'root';
        } catch (e) {
            node.theme = 'unknown';
        }
        
        // Marquer les pages orphelines
        node.isOrphan = currentOrphanPages.some(orphan => orphan.url === node.id);
    });

    const width = document.getElementById('chart').clientWidth;
    const height = document.getElementById('chart').clientHeight;

    const svg = d3.select('#chart').html("").append('svg')
        .attr('width', width)
        .attr('height', height);
    
    const g = svg.append('g');
    
    // Zoom configuration
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });
    
    svg.call(zoom);

    g.append('defs').selectAll('marker')
        .data(['end'])
        .enter().append('marker')
        .attr('id', 'end')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 15)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#999');

    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(nodeSpacing))
        .force('charge', d3.forceManyBody().strength(repulsionForce))  // Adjust repulsion force
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => Math.max(5, Math.sqrt(d.incoming) * 5) + collisionRadius))  // Adjust collision radius
        .force('x', d3.forceX(width / 2).strength(0.05))
        .force('y', d3.forceY(height / 2).strength(0.05));

    const link = g.append('g')
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('stroke-width', 1)
        .attr('stroke', '#00d4ff')
        .attr('opacity', 0.3)
        .attr('marker-end', 'url(#end)');

    const node = g.append('g')
        .selectAll('circle')
        .data(nodes)
        .enter().append('circle')
        .attr('r', d => Math.max(5, Math.sqrt(d.incoming) * 5))
        .attr('fill', d => colorByTheme ? getThemeColor(d.theme) : `rgba(0, 212, 255, 0.7)`)
        .attr('stroke', d => colorByTheme ? d3.color(getThemeColor(d.theme)).darker() : '#0078ff')
        .attr('stroke-width', 1.5)
        .attr('class', d => d.isOrphan ? 'orphan-node' : '')
        .style('cursor', 'pointer')
        .style('pointer-events', 'all')
        .call(drag(simulation))
        .on('click', function(event, d) {
            event.stopPropagation();
            handleNodeClick(event, d);
        })
        .on('contextmenu', function(event, d) {
            event.preventDefault();
            event.stopPropagation();
            handleNodeRightClick(event, d);
        });

    node.append('title')
        .text(d => getLastSection(d.id));

    const labels = g.append('g')
        .selectAll('text')
        .data(nodes)
        .enter().append('text')
        .attr('dy', 3)
        .attr('text-anchor', 'middle')
        .attr('font-size', 12)
        .attr('fill', '#f0f0f0')
        .style('pointer-events', 'none')
        .text(d => getLastSection(d.id));

    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);

        labels
            .attr('x', d => d.x)
            .attr('y', d => d.y);
    });

    updateTable(nodes, true);

    d3.selectAll('th[data-sort]').on('click', function() {
        const sortType = d3.select(this).attr('data-sort');
        const sortedNodes = nodes.sort((a, b) => {
            if (sortType === 'node') return d3.ascending(a.id, b.id);
            if (sortType === 'incoming') return d3.ascending(a.incoming, b.incoming);
            if (sortType === 'outgoing') return d3.ascending(a.outgoing, b.outgoing);
        });

        const header = d3.select(this);
        const isAscending = header.classed('ascending');
        d3.selectAll('th').classed('ascending', false).classed('descending', false);
        header.classed(isAscending ? 'descending' : 'ascending', !isAscending);
        header.classed(isAscending ? 'ascending' : 'descending', isAscending);

        updateTable(sortedNodes, !isAscending);
    });

    d3.select('#select-all').on('click', function() {
        const visibleRows = d3.select('#data-table tbody').selectAll('tr').filter(function() {
            return this.style.display !== 'none';
        });
        const isSelected = visibleRows.classed('selected');
        visibleRows.classed('selected', !isSelected);
        visibleRows.selectAll('input[type="checkbox"]').property('checked', !isSelected);
        visibleRows.style('background-color', !isSelected ? '#d3d3d3' : '');
    });

    d3.select('#delete-selected').on('click', function() {
        const selectedRows = d3.select('#data-table tbody').selectAll('tr.selected').data();
        const nodeIds = selectedRows.map(d => d.id);
        console.log('Nœuds sélectionnés pour suppression:', nodeIds);
        removeNodesInQueue(nodeIds, currentData);
    });

    document.getElementById('search').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        d3.select('#data-table tbody').selectAll('tr').each(function() {
            const row = d3.select(this);
            const text = row.text().toLowerCase();
            row.style('display', text.includes(searchTerm) ? '' : 'none');
        });
    });

    let lastChecked = null;
    d3.select('#data-table tbody').selectAll('input[type="checkbox"]').on('click', function(event) {
        const currentRow = d3.select(this.parentNode.parentNode);
        const isChecked = this.checked;

        if (event.shiftKey && lastChecked) {
            const rows = Array.from(d3.select('#data-table tbody').node().rows);
            const start = rows.indexOf(lastChecked.parentNode.parentNode);
            const end = rows.indexOf(currentRow.node());
            const range = [Math.min(start, end), Math.max(start, end)];

            rows.slice(range[0], range[1] + 1).forEach(row => {
                const checkbox = d3.select(row).select('.node-checkbox').node();
                checkbox.checked = isChecked;
                d3.select(row).classed('selected', isChecked);
                d3.select(row).style('background-color', isChecked ? '#d3d3d3' : '');
            });
        } else if (event.ctrlKey || event.metaKey) {
            currentRow.classed('selected', isChecked);
            currentRow.style('background-color', isChecked ? '#d3d3d3' : '');
        } else {
            d3.select('#data-table tbody').selectAll('tr').classed('selected', false);
            d3.select('#data-table tbody').selectAll('.node-checkbox').property('checked', false);
            currentRow.classed('selected', isChecked);
            currentRow.style('background-color', isChecked ? '#d3d3d3' : '');
            this.checked = isChecked;
        }

        lastChecked = this;
    });

    // Add event listeners for control inputs
    document.getElementById('link-distance').addEventListener('input', (event) => {
        nodeSpacing = +event.target.value;
        updateGraph(currentData, currentThemes, currentOrphanPages, currentSuggestions);
    });

    document.getElementById('repulsion-force').addEventListener('input', (event) => {
        repulsionForce = +event.target.value;
        updateGraph(currentData, currentThemes, currentOrphanPages, currentSuggestions);
    });

    document.getElementById('collision-radius').addEventListener('input', (event) => {
        collisionRadius = +event.target.value;
        updateGraph(currentData, currentThemes, currentOrphanPages, currentSuggestions);
    });
    
    // Setup context menu event listeners
    setupContextMenuListeners();

    // Add event listener for PDF generation
    document.getElementById('download-pdf').addEventListener('click', generatePDF);
    
    // Add event listener for theme coloring
    document.getElementById('color-by-theme').addEventListener('change', (event) => {
        colorByTheme = event.target.checked;
        updateGraph(currentData, currentThemes, currentOrphanPages, currentSuggestions);
    });
    
    // Masquer le menu contextuel au clic sur le document
    document.addEventListener('click', hideContextMenu);
    
    // Permettre le clic dans la zone vide du SVG pour désélectionner
    svg.on('click', function(event) {
        // Vérifier si le clic est sur le fond du SVG
        if (event.target === this || event.target.tagName === 'svg') {
            hideContextMenu();
            clearHighlights();
        }
    });
    
    // Désactiver le menu contextuel par défaut sur le conteneur chart
    document.getElementById('chart').addEventListener('contextmenu', function(event) {
        // Ne pas empêcher si c'est sur un nœud
        if (!event.target.closest('circle')) {
            event.preventDefault();
        }
    });
}

function generatePDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    // Appliquer les styles PDF
    document.body.classList.add('pdf-style');

    // Capture the chart with a fixed width and height
    html2canvas(document.getElementById('chart'), {backgroundColor: '#ffffff', width: 800, height: 400}).then(canvas => {
        const chartImg = canvas.toDataURL('image/png');
        pdf.addImage(chartImg, 'PNG', 10, 10, 190, 100); // Adjust dimensions as needed

        // Capture the table with a fixed width
        html2canvas(document.getElementById('table-container'), {backgroundColor: '#ffffff', width: 800}).then(canvas => {
            const tableImg = canvas.toDataURL('image/png');
            pdf.addPage();
            pdf.addImage(tableImg, 'PNG', 10, 10, 190, 250); // Adjust dimensions as needed

            // Save the PDF
            pdf.save('analysis.pdf');

            // Remove PDF styles after capturing
            document.body.classList.remove('pdf-style');
        }).catch(error => {
            console.error('Erreur lors de la capture du tableau pour le PDF:', error);
            document.body.classList.remove('pdf-style'); // Remove PDF styles in case of error
        });
    }).catch(error => {
        console.error('Erreur lors de la capture de la visualisation pour le PDF:', error);
        document.body.classList.remove('pdf-style'); // Remove PDF styles in case of error
    });
}
// Fonction pour obtenir une couleur par thématique
function getThemeColor(theme) {
    const colors = {
        'our-articles': '#00d4ff',
        'customize': '#ff6b35',
        'root': '#00ff88',
        'blog': '#ff4081',
        'news': '#ffeb3b',
        'products': '#9c27b0',
        'services': '#4caf50',
        'about': '#ff9800',
        'contact': '#795548'
    };
    return colors[theme] || '#00d4ff';
}

// Fonction pour afficher les métriques
export function displayMetrics(metrics) {
    const container = document.getElementById('metrics-display');
    if (!metrics) {
        container.innerHTML = '<p>Aucune métrique disponible</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="metric-card">
            <h4>Liens Totaux</h4>
            <div class="metric-value">${metrics.total_links}</div>
        </div>
        <div class="metric-card">
            <h4>Pages Totales</h4>
            <div class="metric-value">${metrics.total_pages}</div>
        </div>
        <div class="metric-card">
            <h4>Densité de Liens</h4>
            <div class="metric-value">${metrics.link_density}</div>
        </div>
        <div class="metric-card">
            <h4>Thématiques</h4>
            <div class="metric-value">${metrics.theme_count}</div>
        </div>
        <div class="metric-card">
            <h4>Équilibrage Thématique</h4>
            <div class="metric-value">${metrics.theme_balance}</div>
        </div>
    `;
}

// Fonction pour afficher l'analyse thématique
export function displayThemes(themes) {
    const container = document.getElementById('themes-display');
    if (!themes || Object.keys(themes).length === 0) {
        container.innerHTML = '<p>Aucune analyse thématique disponible</p>';
        return;
    }
    
    let html = '';
    Object.entries(themes).forEach(([theme, data]) => {
        const totalLinks = data.internal_links + data.external_links;
        const pagesPreview = data.pages.slice(0, 3).map(url => {
            try {
                const urlObj = new URL(url);
                return urlObj.pathname.split('/').pop() || 'index';
            } catch (e) {
                return url.split('/').pop() || url;
            }
        }).join(', ');
        
        html += `
            <div class="theme-card">
                <h4>${theme}</h4>
                <div class="theme-stats">
                    <span>Pages: ${data.pages.length}</span>
                    <span>Liens: ${totalLinks}</span>
                </div>
                <div class="theme-stats">
                    <span>Internes: ${data.internal_links}</span>
                    <span>Externes: ${data.external_links}</span>
                </div>
                <div class="theme-pages">
                    ${pagesPreview}${data.pages.length > 3 ? '...' : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Fonction pour afficher les suggestions
export function displaySuggestions(suggestions) {
    const container = document.getElementById('suggestions-container');
    const display = document.getElementById('suggestions-display');
    
    if (!suggestions || suggestions.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    
    let html = '';
    suggestions.forEach((suggestion, index) => {
        const priorityClass = suggestion.priority === 'high' ? 'high-priority' : 'medium-priority';
        html += `
            <div class="suggestion-card ${priorityClass}">
                <h5>${suggestion.title}</h5>
                <div class="suggestion-details">${suggestion.description}</div>
                <div class="suggestion-details"><strong>Action:</strong> ${suggestion.action}</div>
                <button class="suggestion-action" onclick="implementSuggestion(${index})">
                    Implémenter
                </button>
            </div>
        `;
    });
    
    display.innerHTML = html;
}

// Gestion des interactions de nœuds
function handleNodeClick(event, d) {
    if (event.ctrlKey || event.metaKey) {
        // Ctrl+Clic pour ouvrir la page
        window.open(d.id, '_blank');
        showNotification('Page ouverte dans un nouvel onglet', 'success');
    } else {
        // Clic simple pour sélectionner
        selectedNode = d;
        highlightNodeConnections(d);
    }
}

function handleNodeRightClick(event, d) {
    event.preventDefault();
    event.stopPropagation();
    selectedNode = d;
    
    // Utiliser les coordonnées de l'événement source pour avoir la position exacte
    const sourceEvent = event.sourceEvent || event;
    let x, y;
    
    if (sourceEvent.pageX && sourceEvent.pageY) {
        // Utiliser pageX/pageY si disponible (le plus fiable)
        x = sourceEvent.pageX;
        y = sourceEvent.pageY;
    } else if (sourceEvent.clientX && sourceEvent.clientY) {
        // Sinon utiliser clientX/clientY
        x = sourceEvent.clientX + window.scrollX;
        y = sourceEvent.clientY + window.scrollY;
    } else {
        // Fallback : calculer depuis le conteneur
        const rect = document.getElementById('chart').getBoundingClientRect();
        x = rect.left + (sourceEvent.offsetX || 0) + window.scrollX;
        y = rect.top + (sourceEvent.offsetY || 0) + window.scrollY;
    }
    
    console.log('Menu contextuel position:', { x, y, event: sourceEvent });
    showContextMenu(x, y, d);
}

function showContextMenu(x, y, nodeData) {
    const menu = document.getElementById('context-menu');
    
    // Rendre le menu visible pour calculer ses dimensions
    menu.style.display = 'block';
    menu.style.position = 'absolute';
    
    // Calculer les dimensions du menu et de la fenêtre
    const menuRect = menu.getBoundingClientRect();
    const menuWidth = menuRect.width || 180; // fallback correspondant au CSS
    const menuHeight = menuRect.height || 160; // fallback plus réaliste pour 4 items + divider
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    
    // Ajuster la position si le menu dépasse les bords
    let adjustedX = x;
    let adjustedY = y;
    
    // Vérifier le débordement horizontal
    if (x + menuWidth > windowWidth + scrollX) {
        adjustedX = x - menuWidth;
    }
    
    // Vérifier le débordement vertical
    if (y + menuHeight > windowHeight + scrollY) {
        adjustedY = y - menuHeight;
    }
    
    // S'assurer que le menu reste dans les limites minimales
    adjustedX = Math.max(scrollX + 5, adjustedX);
    adjustedY = Math.max(scrollY + 5, adjustedY);
    
    menu.style.left = adjustedX + 'px';
    menu.style.top = adjustedY + 'px';
    
    // Stocker les données du nœud pour les actions du menu
    menu.setAttribute('data-node-id', nodeData.id);
    
    console.log('Menu positionné à:', { 
        original: { x, y }, 
        adjusted: { x: adjustedX, y: adjustedY },
        menuSize: { width: menuWidth, height: menuHeight }
    });
}

function hideContextMenu() {
    const menu = document.getElementById('context-menu');
    menu.style.display = 'none';
}

function setupContextMenuListeners() {
    document.getElementById('open-page').addEventListener('click', () => {
        if (selectedNode) {
            window.open(selectedNode.id, '_blank');
            showNotification('Page ouverte dans un nouvel onglet', 'success');
        }
        hideContextMenu();
    });
    
    document.getElementById('delete-node').addEventListener('click', () => {
        if (selectedNode) {
            deleteNodeAndLinks(selectedNode.id);
            showNotification('Nœud supprimé', 'success');
        }
        hideContextMenu();
    });
    
    document.getElementById('focus-node').addEventListener('click', () => {
        if (selectedNode) {
            focusOnNode(selectedNode);
        }
        hideContextMenu();
    });
    
    document.getElementById('show-connections').addEventListener('click', () => {
        if (selectedNode) {
            highlightNodeConnections(selectedNode);
        }
        hideContextMenu();
    });
}

function deleteNodeAndLinks(nodeId) {
    // Filtrer les liens qui impliquent ce nœud
    const filteredData = currentData.filter(link => 
        link.Source !== nodeId && link.Destination !== nodeId
    );
    
    // Mettre à jour le graphique
    updateGraph(filteredData, currentThemes, currentOrphanPages, currentSuggestions);
    currentData = filteredData;
}

function focusOnNode(nodeData) {
    // Filtrer pour ne montrer que les liens de ce nœud
    const nodeLinks = currentData.filter(link => 
        link.Source === nodeData.id || link.Destination === nodeData.id
    );
    updateGraph(nodeLinks, currentThemes, currentOrphanPages, currentSuggestions);
}

function highlightNodeConnections(nodeData) {
    // Mettre en évidence les connexions du nœud
    d3.selectAll('line')
        .style('opacity', d => 
            (d.source.id === nodeData.id || d.target.id === nodeData.id) ? 1 : 0.1
        )
        .style('stroke-width', d => 
            (d.source.id === nodeData.id || d.target.id === nodeData.id) ? 3 : 1
        );
    
    d3.selectAll('circle')
        .style('opacity', d => 
            (d.id === nodeData.id || isConnectedTo(d.id, nodeData.id)) ? 1 : 0.3
        );
}

function isConnectedTo(nodeId1, nodeId2) {
    return currentData.some(link => 
        (link.Source === nodeId1 && link.Destination === nodeId2) ||
        (link.Source === nodeId2 && link.Destination === nodeId1)
    );
}

function clearHighlights() {
    // Remettre l'opacité normale pour tous les éléments
    d3.selectAll('line')
        .style('opacity', 0.3)
        .style('stroke-width', 1);
    
    d3.selectAll('circle')
        .style('opacity', 1);
        
    selectedNode = null;
}

function showNotification(message, type = 'info') {
    const notificationArea = document.getElementById('notification-area');
    if (!notificationArea) {
        console.warn('Notification area not found');
        return;
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notificationArea.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// Fonction globale pour implémenter les suggestions
window.implementSuggestion = function(index) {
    const suggestion = currentSuggestions[index];
    if (!suggestion) return;
    
    switch (suggestion.type) {
        case 'connect_orphan':
            showNotification(`Suggestion: Connecter ${suggestion.target_url} depuis ${suggestion.source_urls.join(', ')}`, 'info');
            break;
        case 'strengthen_theme':
            showNotification(`Suggestion: Renforcer les liens dans le thème ${suggestion.theme}`, 'info');
            break;
        default:
            showNotification('Suggestion notée', 'success');
    }
};

// tout supprimer pour effacer les traces après utilisation
document.getElementById('clear-all').addEventListener('click', () => {
    if (confirm('Êtes-vous sûr de vouloir tout effacer ?')) {
        fetch('data.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'clear_all=true'
        })
        .then(response => response.json())
        .then(json => {
            if (json.success) {
                alert('Tous les nœuds ont été effacés.');
                updateGraph([], {}, [], []);
                displayMetrics(null);
                displayThemes({});
                displaySuggestions([]);
            } else {
                alert('Erreur lors de la suppression des nœuds.');
            }
        })
        .catch(error => console.error('Erreur lors de la suppression des nœuds:', error));
    }
});

