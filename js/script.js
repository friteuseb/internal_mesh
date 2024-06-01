// Charger les données filtrées depuis le fichier JSON
fetch('data.php')
    .then(response => response.json())
    .then(json => {
        let data = json.data;
        console.log('Données chargées:', data);

        // Ajouter une fonction pour obtenir la dernière section de l'URL
        function getLastSection(url) {
            const parts = url.split('/');
            return parts[parts.length - 1] || parts[parts.length - 2];
        }

        function updateGraph(data) {
            const nodes = Array.from(new Set(data.flatMap(d => [d.Source, d.Destination]))).map(id => ({ id }));
            console.log('Nœuds générés:', nodes);

            const links = data.map(d => ({ source: d.Source, target: d.Destination }));
            console.log('Liens générés:', links);

            // Calculer les liens entrants et sortants
            nodes.forEach(node => {
                node.incoming = links.filter(link => link.target === node.id).length;
                node.outgoing = links.filter(link => link.source === node.id).length;
            });

            console.log('Nœuds avec liens entrants et sortants:', nodes);

            const width = document.getElementById('chart').clientWidth;
            const height = document.getElementById('chart').clientHeight;

            const svg = d3.select('#chart').html("").append('svg')
                .attr('width', width)
                .attr('height', height)
                .call(d3.zoom().on('zoom', (event) => {
                    svg.attr('transform', event.transform);
                }))
                .append('g');

            // Définit les marqueurs de flèches
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
                .force('link', d3.forceLink(links).id(d => d.id).distance(150))
                .force('charge', d3.forceManyBody().strength(-500))
                .force('center', d3.forceCenter(width / 2, height / 2))
                .force('collision', d3.forceCollide().radius(d => Math.sqrt(d.incoming) * 10 + 20))
                .force('x', d3.forceX(width / 2).strength(0.05))
                .force('y', d3.forceY(height / 2).strength(0.05));

            const link = svg.append('g')
                .selectAll('line')
                .data(links)
                .enter().append('line')
                .attr('stroke-width', 1.5)
                .attr('stroke', '#999')
                .attr('marker-end', 'url(#end)');

            const node = svg.append('g')
                .selectAll('circle')
                .data(nodes)
                .enter().append('circle')
                .attr('r', d => Math.max(5, Math.sqrt(d.incoming) * 5)) // Ajuster la taille des nœuds
                .attr('fill', d => getColor(d.incoming)) // Couleur basée sur le nombre de liens entrants
                .call(drag(simulation));

            node.append('title')
                .text(d => getLastSection(d.id));

            // Ajouter des labels aux nœuds
            const labels = svg.append('g')
                .selectAll('text')
                .data(nodes)
                .enter().append('text')
                .attr('dy', -10)
                .attr('text-anchor', 'middle')
                .attr('font-size', 10)
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

            // Remplir le tableau avec les données des nœuds
            const tbody = d3.select('#data-table tbody').html("");
            nodes.sort((a, b) => a.incoming - b.incoming); // Trier les nœuds par nombre de liens entrants

            updateTable(nodes, true);

            // Fonction pour obtenir la couleur en fonction du nombre de liens
            function getColor(count) {
                const maxCount = Math.max(...nodes.map(n => n.incoming));
                const minCount = Math.min(...nodes.map(n => n.incoming));
                const scale = d3.scaleLinear().domain([minCount, maxCount]).range([120, 0]);
                const hue = scale(count);
                return `hsl(${hue}, 100%, 50%)`; // Dégradé du vert au rouge
            }

            // Fonction pour supprimer un nœud
            function removeNode(nodeId) {
                fetch('data.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `remove_node=${nodeId}`
                })
                .then(response => response.json())
                .then(json => {
                    updateGraph(json.data);
                })
                .catch(error => console.error('Erreur lors de la suppression du nœud:', error));
            }

            // Fonction pour supprimer plusieurs nœuds
            function removeNodes(nodeIds) {
                fetch('data.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `remove_nodes=${JSON.stringify(nodeIds)}`
                })
                .then(response => response.json())
                .then(json => {
                    updateGraph(json.data);
                })
                .catch(error => console.error('Erreur lors de la suppression des nœuds:', error));
            }

            // Fonction pour mettre à jour le tableau
            function updateTable(nodes, isAscending) {
                const sortedNodes = isAscending ? nodes : nodes.reverse();

                const rows = tbody.selectAll('tr')
                    .data(sortedNodes, d => d.id)
                    .join(
                        enter => {
                            const row = enter.append('tr');
                            row.append('td').append('input').attr('type', 'checkbox').on('click', function(event) {
                                row.classed('selected', this.checked);
                            });
                            row.append('td').text(d => getLastSection(d.id));
                            row.append('td').text(d => d.incoming).style('background-color', d => getColor(d.incoming));
                            row.append('td').text(d => d.outgoing).style('background-color', d => getColor(d.outgoing));
                            row.append('td').append('button').text('Supprimer').on('click', (event, d) => {
                                removeNode(d.id);
                            }).attr('class', 'styled-button');
                            return row;
                        },
                        update => {
                            update.select('td:nth-child(2)').text(d => getLastSection(d.id));
                            update.select('td:nth-child(3)').text(d => d.incoming).style('background-color', d => getColor(d.incoming));
                            update.select('td:nth-child(4)').text(d => d.outgoing).style('background-color', d => getColor(d.outgoing));
                            return update;
                        }
                    );
            }

            // Fonction pour trier les colonnes
            d3.selectAll('th[data-sort]').on('click', function() {
                const sortType = d3.select(this).attr('data-sort');
                const sortedNodes = nodes.sort((a, b) => {
                    if (sortType === 'node') return d3.ascending(a.id, b.id);
                    if (sortType === 'incoming') return d3.ascending(a.incoming, b.incoming);
                    if (sortType === 'outgoing') return d3.ascending(a.outgoing, b.outgoing);
                });

                // Inverser l'ordre si la colonne est déjà triée
                const header = d3.select(this);
                const isAscending = header.classed('ascending');
                d3.selectAll('th').classed('ascending', false).classed('descending', false);
                header.classed(isAscending ? 'descending' : 'ascending', !isAscending);
                header.classed(isAscending ? 'ascending' : 'descending', isAscending);

                updateTable(sortedNodes, !isAscending);
            });

            // Fonction pour tout sélectionner
            d3.select('#select-all').on('click', function() {
                const visibleRows = tbody.selectAll('tr').filter(function() {
                    return this.style.display !== 'none';
                });
                const isSelected = visibleRows.classed('selected');
                visibleRows.classed('selected', !isSelected);
                visibleRows.selectAll('input[type="checkbox"]').property('checked', !isSelected);
                visibleRows.style('background-color', !isSelected ? '#d3d3d3' : ''); // Changer la couleur de sélection
        });

        // Fonction pour supprimer les éléments sélectionnés
        d3.select('#delete-selected').on('click', function() {
            const selectedRows = tbody.selectAll('tr.selected').data();
            const nodeIds = selectedRows.map(d => d.id);
            removeNodes(nodeIds);
        });

        // Fonction de recherche
        document.getElementById('search').addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            tbody.selectAll('tr').each(function() {
                const row = d3.select(this);
                const text = row.text().toLowerCase();
                row.style('display', text.includes(searchTerm) ? '' : 'none');
            });
        });

        // Gestion des sélections avec Shift et Ctrl
        let lastChecked = null;
        tbody.selectAll('input[type="checkbox"]').on('click', function(event) {
            const currentRow = d3.select(this.parentNode.parentNode);
            if (!lastChecked) {
                lastChecked = this;
                return;
            }

            if (event.shiftKey) {
                const rows = Array.from(tbody.node().rows);
                const start = rows.indexOf(lastChecked.parentNode.parentNode);
                const end = rows.indexOf(currentRow.node());

                rows.slice(Math.min(start, end), Math.max(start, end) + 1)
                    .forEach(row => {
                        d3.select(row).classed('selected', this.checked);
                        d3.select(row).select('input[type="checkbox"]').property('checked', this.checked);
                        d3.select(row).style('background-color', this.checked ? '#d3d3d3' : '');
                    });
            } else if (event.ctrlKey || event.metaKey) {
                currentRow.classed('selected', this.checked);
                currentRow.style('background-color', this.checked ? '#d3d3d3' : '');
            }

            lastChecked = this;
        });
    }

    // Fonction de drag
    function drag(simulation) {
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

    // Initial update
    updateGraph(data);
})
.catch(error => console.error('Erreur lors du chargement des données:', error));
