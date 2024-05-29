// graph.js
document.addEventListener("DOMContentLoaded", function() {
    // Get the status div element
    const statusDiv = document.getElementById('status');

    // Load data and render the graph
    loadDataAndRender();

    function loadDataAndRender() {
        // Fetch data from the JSON file
        fetch('filtered_data.json')
            .then(response => response.json())
            .then(data => {
                console.log('Data loaded:', data);
                if (Array.isArray(data.data)) {
                    // Render the graph with the filtered data
                    renderGraph(data.data);
                    statusDiv.innerHTML = 'Visualisation prête.'; // Visualization ready
                } else {
                    throw new Error("Les données chargées ne sont pas un tableau."); // Data loaded is not an array
                }
            })
            .catch(error => {
                // Handle errors during data loading
                statusDiv.innerHTML = 'Erreur lors du chargement des données: ' + error.message; // Error loading data
            });
    }

    function renderGraph(data) {
        const nodes = {};
        const links = data.map(d => {
            const source = getLastSegment(d.Source);
            const target = getLastSegment(d.Destination);
            // Initialize source and target nodes
            nodes[source] = nodes[source] || { name: source, url: d.Source, inDegree: 0, outDegree: 0, hidden: false, indexable: true, level: 0 };
            nodes[target] = nodes[target] || { name: target, url: d.Destination, inDegree: 0, outDegree: 0, hidden: false, indexable: true, level: 0 };
            // Update outDegree and inDegree for source and target nodes
            nodes[source].outDegree += 1;
            nodes[target].inDegree += 1;
            return { source: source, target: target };
        });

        // Find the root node (homepage)
        const root = findRoot(nodes, links);
        if (root) {
            nodes[root].level = 0;
            calculateLevels(nodes, links, root);
        }

        const width = 1900, height = 1000;

        // Clear the existing graph
        d3.select("#graph").html("");

        // Create the SVG container for the graph
        const svg = d3.select("#graph").append("svg")
            .attr("width", width)
            .attr("height", height)
            .call(d3.zoom().on("zoom", (event) => {
                svg.attr("transform", event.transform);
            }))
            .append("g");

        // Define arrow markers for the links
        svg.append("defs").append("marker")
            .attr("id", "arrowhead")
            .attr("viewBox", "-0 -5 10 10")
            .attr("refX", 15)
            .attr("refY", 0)
            .attr("orient", "auto")
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("xoverflow", "visible")
            .append("svg:path")
            .attr("d", "M 0,-5 L 10 ,0 L 0,5")
            .attr("fill", "#4CAF50") // Medium green for arrowheads
            .style("stroke", "none");

        // Create the simulation
        const simulation = d3.forceSimulation(Object.values(nodes))
            .force("link", d3.forceLink(links).id(d => d.name).distance(300))
            .force("charge", d3.forceManyBody().strength(-500))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(d => Math.log(1 + Math.max(d.inDegree, d.outDegree)) * 5));

        // Create links
        const link = svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(links)
            .enter().append("line")
            .attr("class", "link")
            .attr("marker-end", "url(#arrowhead)")
            .style("stroke", "#2E7D32") // Dark green for links
            .style("stroke-width", 1.5)
            .style("opacity", 0.8);

        // Create nodes
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
                    toggleNodeSelection(d.name);
                }
            });

        // Append circles to nodes
        node.append("circle")
            .attr("r", d => Math.log(1 + Math.max(d.inDegree, d.outDegree)) * 5)
            .style("fill", "#81C784") // Light green for nodes
            .style("stroke", "#1B5E20")
            .style("stroke-width", 0.5);

        // Append text to nodes
        node.append("text")
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text(d => getLastSegment(d.url))
            .style("font-size", "8px")
            .style("fill", "#FFFFFF"); // White for text

        // Create tooltip
        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        // Show tooltip on mouseover
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

        // Update positions on each tick
        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => {
                    const dx = d.target.x - d.source.x;
                    const dy = d.target.y - d.source.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const r = Math.log(1 + Math.max(d.target.inDegree, d.target.outDegree)) * 5;
                    return d.target.x - (dx / distance) * r;
                })
                .attr("y2", d => {
                    const dx = d.target.x - d.source.x;
                    const dy = d.target.y - d.source.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const r = Math.log(1 + Math.max(d.target.inDegree, d.target.outDegree)) * 5;
                    return d.target.y - (dy / distance) * r;
                })
                .style("opacity", d => (nodes[d.source]?.hidden || nodes[d.target]?.hidden) ? 0 : 0.8);

            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        // Drag event handlers
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

        // Toggle node selection
        function toggleNodeSelection(nodeName) {
            const checkbox = document.querySelector(`.delete-checkbox[data-node="${nodeName}"]`);
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
            }
        }

        // Reload page on reset button click
        document.getElementById('reset-button').addEventListener('click', reloadPage);
    }

    // Find the root node (the one with no incoming links)
    function findRoot(nodes, links) {
        const targetNodes = new Set(links.map(l => l.target));
        for (let node in nodes) {
            if (!targetNodes.has(node)) {
                return node;
            }
        }
        return null;
    }

    // Calculate the levels of each node based on the root
    function calculateLevels(nodes, links, root) {
        const queue = [root];

        while (queue.length > 0) {
            const current = queue.shift();
            const currentLevel = nodes[current].level;

            links.forEach(l => {
                if (l.source === current && nodes[l.target].level === 0 && l.target !== root) {
                    nodes[l.target].level = currentLevel + 1;
                    queue.push(l.target);
                }
            });
        }
    }
});
