document.addEventListener("DOMContentLoaded", function() {
    const statusDiv = document.getElementById('status');

    loadDataAndRender();

    function loadDataAndRender() {
        fetch('filtered_data.json')
            .then(response => response.json())
            .then(data => {
                renderGraph(data.data); // Utiliser les données filtrées
                statusDiv.innerHTML = 'Visualisation prête.';
            })
            .catch(error => {
                statusDiv.innerHTML = 'Erreur lors du chargement des données: ' + error.message;
            });
    }

    function renderGraph(data) {
        const nodes = {};
        const links = data.map(d => {
            const source = getLastSegment(d.Source);
            const target = getLastSegment(d.Destination);
            nodes[source] = nodes[source] || { name: source, url: d.Source, inDegree: 0, hidden: false, indexable: true };
            nodes[target] = nodes[target] || { name: target, url: d.Destination, inDegree: 0, hidden: false, indexable: true };
            nodes[target].inDegree += 1; // Count the number of incoming links
            return { source: source, target: target };
        });

        calculateLevels(nodes, links);

        const width = 1900, height = 1000;

        d3.select("#graph").html("");  // Clear the existing graph

        const svg = d3.select("#graph").append("svg")
            .attr("width", width)
            .attr("height", height)
            .call(d3.zoom().on("zoom", (event) => {
                svg.attr("transform", event.transform);
            }))
            .append("g");

        const simulation = d3.forceSimulation(Object.values(nodes))
            .force("link", d3.forceLink(links).id(d => d.name).distance(300))
            .force("charge", d3.forceManyBody().strength(-500))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(d => Math.log(1 + d.inDegree) * 5));

        const link = svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(links)
            .enter().append("line")
            .attr("class", "link")
            .style("stroke", d => {
                const sourceDepth = nodes[d.source]?.depth || 0;
                const targetDepth = nodes[d.target]?.depth || 0;
                const depth = Math.max(sourceDepth, targetDepth);
                return d3.interpolateViridis(depth / 5);
            })
            .style("stroke-width", 1)
            .style("opacity", 0.5);

        const node = svg.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(Object.values(nodes))
            .enter().append("g")
            .attr("class", "node")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended))
            .on("click", (event, d) => {
                if (event.ctrlKey) {
                    window.open(d.url, '_blank');
                } else {
                    toggleVisibility(d, nodes, links, link);
                }
            });

        node.append("circle")
            .attr("r", d => Math.log(1 + d.inDegree) * 5)
            .style("fill", "lightgreen")
            .style("stroke", "#000")
            .style("stroke-width", 0.5);

        node.append("text")
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text(d => getLastSegment(d.url))
            .style("font-size", "8px");

        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        node.on("mouseover", (event, d) => {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9)
                .style("visibility", "visible");
            tooltip.html(d.url)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0)
                .style("visibility", "hidden");
        });

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y)
                .style("opacity", d => (nodes[d.source]?.hidden || nodes[d.target]?.hidden) ? 0 : 0.5);

            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });

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
    }

    function calculateLevels(nodes, links) {
        const queue = [Object.keys(nodes)[0]];
        nodes[queue[0]].depth = 0;
        const visited = new Set(queue);

        while (queue.length > 0) {
            const name = queue.shift();
            const depth = nodes[name].depth;

            links.forEach(link => {
                if (link.source === name && !visited.has(link.target)) {
                    visited.add(link.target);
                    nodes[link.target].depth = depth + 1;
                    queue.push(link.target);
                }
            });
        }
    }

    function toggleVisibility(d, nodes, links, link) {
        links.forEach(l => {
            if (l.source.name === d.name) {
                l.hidden = !l.hidden;
            }
        });

        link.style("opacity", l => l.hidden ? 0 : 0.5);
    }

    function getLastSegment(url) {
        if (!url) return '';
        const segments = url.split('/');
        return segments[segments.length - 1] || segments[segments.length - 2];
    }
});
