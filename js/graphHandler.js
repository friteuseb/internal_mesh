import { getLastSection, getColor, drag, removeNodesInQueue, updateTable } from './nodeHandler.js';

let currentData = [];
let nodeSpacing = 150; // Default link distance
let repulsionForce = -100; // Default repulsion force
let collisionRadius = 10; // Default collision radius

export function updateGraph(data) {
    currentData = data;

    if (!Array.isArray(data)) {
        console.error('Data is not an array:', data);
        return;
    }

    const nodes = Array.from(new Set(data.flatMap(d => [d.Source, d.Destination]))).map(id => ({ id }));
    const links = data.map(d => ({ source: d.Source, target: d.Destination }));

    nodes.forEach(node => {
        node.incoming = links.filter(link => link.target === node.id).length;
        node.outgoing = links.filter(link => link.source === node.id).length;
    });

    const width = document.getElementById('chart').clientWidth;
    const height = document.getElementById('chart').clientHeight;

    const svg = d3.select('#chart').html("").append('svg')
        .attr('width', width)
        .attr('height', height)
        .call(d3.zoom().on('zoom', (event) => {
            svg.attr('transform', event.transform);
        }))
        .append('g');

    svg.append('defs').selectAll('marker')
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

    const link = svg.append('g')
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('stroke-width', 1) // Reduced thickness
        .attr('stroke', '#00d4ff')
        .attr('opacity', 0.3) // Reduced opacity
        .attr('marker-end', 'url(#end)');

    const node = svg.append('g')
        .selectAll('circle')
        .data(nodes)
        .enter().append('circle')
        .attr('r', d => Math.max(5, Math.sqrt(d.incoming) * 5))
        .attr('fill', d => `rgba(0, 212, 255, 0.7)`)
        .attr('stroke', '#0078ff')
        .attr('stroke-width', 1.5)
        .call(drag(simulation));

    node.append('title')
        .text(d => getLastSection(d.id));

    const labels = svg.append('g')
        .selectAll('text')
        .data(nodes)
        .enter().append('text')
        .attr('dy', 3)
        .attr('text-anchor', 'middle')
        .attr('font-size', 12)
        .attr('fill', '#f0f0f0')
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
        updateGraph(currentData);
    });

    document.getElementById('repulsion-force').addEventListener('input', (event) => {
        repulsionForce = +event.target.value;
        updateGraph(currentData);
    });

    document.getElementById('collision-radius').addEventListener('input', (event) => {
        collisionRadius = +event.target.value;
        updateGraph(currentData);
    });

    // Add event listener for PDF generation
    document.getElementById('download-pdf').addEventListener('click', generatePDF);
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
                updateGraph([]);
            } else {
                alert('Erreur lors de la suppression des nœuds.');
            }
        })
        .catch(error => console.error('Erreur lors de la suppression des nœuds:', error));
    }
});

