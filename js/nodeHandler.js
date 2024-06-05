import { updateGraph } from './graphHandler.js';

export function getLastSection(url) {
    const parts = url.split('/');
    return parts[parts.length - 1] || parts[parts.length - 2];
}

export function getColor(nodes) {
    const maxCount = Math.max(...nodes.map(n => n.incoming));
    const minCount = Math.min(...nodes.map(n => n.incoming));
    const scale = d3.scaleLinear().domain([minCount, maxCount]).range([120, 0]);
    return function(count) {
        const hue = scale(count);
        return `hsl(${hue}, 100%, 50%)`;
    };
}

export function drag(simulation) {
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
}

export function removeNodesInQueue(nodeIds, currentData) {
    const filteredData = currentData.filter(d => !nodeIds.includes(d.Source) && !nodeIds.includes(d.Destination));
    updateGraph(filteredData);
}

export function updateTable(nodes, isAscending) {
    const tbody = d3.select('#data-table tbody');
    const sortedNodes = isAscending ? nodes : nodes.reverse();

    const colorScaleIncoming = d3.scaleLinear().domain([0, d3.max(nodes, d => d.incoming)]).range(['#0e0e0e', '#00d4ff']);
    const colorScaleOutgoing = d3.scaleLinear().domain([0, d3.max(nodes, d => d.outgoing)]).range(['#0e0e0e', '#0078ff']);

    const rows = tbody.selectAll('tr')
        .data(sortedNodes, d => d.id)
        .join(
            enter => {
                const row = enter.append('tr');
                row.append('td').append('input').attr('type', 'checkbox').attr('class', 'node-checkbox').attr('data-node-id', d => d.id).on('click', function(event) {
                    row.classed('selected', this.checked);
                });
                row.append('td').text(d => getLastSection(d.id));
                row.append('td').text(d => d.incoming).style('background-color', d => colorScaleIncoming(d.incoming));
                row.append('td').text(d => d.outgoing).style('background-color', d => colorScaleOutgoing(d.outgoing));
                return row;
            },
            update => {
                update.select('td:nth-child(2)').text(d => getLastSection(d.id));
                update.select('td:nth-child(3)').text(d => d.incoming).style('background-color', d => colorScaleIncoming(d.incoming));
                update.select('td:nth-child(4)').text(d => d.outgoing).style('background-color', d => colorScaleOutgoing(d.outgoing));
                return update;
            }
        );

    let lastChecked = null;

    tbody.selectAll('.node-checkbox').on('click', function(event) {
        const currentRow = d3.select(this.parentNode.parentNode);
        const isChecked = this.checked;

        if (event.shiftKey && lastChecked) {
            const rows = Array.from(tbody.node().rows);
            const start = rows.indexOf(lastChecked.parentNode.parentNode);
            const end = rows.indexOf(currentRow.node());
            const range = [Math.min(start, end), Math.max(start, end)];

            rows.slice(range[0], range[1] + 1).forEach(row => {
                const checkbox = d3.select(row).select('.node-checkbox').node();
                checkbox.checked = isChecked;
                d3.select(row).classed('selected', isChecked);
            });
        } else if (event.ctrlKey || event.metaKey) {
            currentRow.classed('selected', isChecked);
        } else {
            tbody.selectAll('tr').classed('selected', false);
            tbody.selectAll('.node-checkbox').property('checked', false);
            currentRow.classed('selected', isChecked);
            this.checked = isChecked;
        }

        lastChecked = this;
    });

    // Ensure all selected rows are marked as selected
    tbody.selectAll('tr').each(function() {
        const checkbox = d3.select(this).select('.node-checkbox').node();
        d3.select(this).classed('selected', checkbox.checked);
        d3.select(this).style('background-color', checkbox.checked ? '#d3d3d3' : '');
    });
}
