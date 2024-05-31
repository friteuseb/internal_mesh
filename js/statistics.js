// statistics.js
document.addEventListener("DOMContentLoaded", function() {
    loadStatistics();

    function loadStatistics() {
        fetch('filtered_data.json')
            .then(response => response.json())
            .then(data => {
                if (Array.isArray(data.data)) {
                    showStatistics(data.data);
                } else {
                    throw new Error("Les données chargées ne sont pas un tableau.");
                }
            })
            .catch(error => {
                console.error('Erreur lors du chargement des données: ' + error.message);
            });
    }

    function showStatistics(data) {
        const nodes = {};
        data.forEach(d => {
            const source = getLastSegment(d.Source);
            const target = getLastSegment(d.Destination);
            nodes[source] = nodes[source] || { name: source, url: d.Source, inDegree: 0, outDegree: 0 };
            nodes[target] = nodes[target] || { name: target, url: d.Destination, inDegree: 0, outDegree: 0 };
            nodes[source].outDegree += 1;
            nodes[target].inDegree += 1;
        });

        const statisticsDiv = d3.select("#statistics");
        statisticsDiv.html("");

        const sortedNodes = Object.values(nodes).sort((a, b) => a.inDegree - b.inDegree);
        const maxInDegree = d3.max(sortedNodes, d => d.inDegree);
        const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([0, maxInDegree]);

        // Create search input and select/deselect all checkbox
        const searchDiv = statisticsDiv.append("div").attr("class", "search-container");
        searchDiv.append("input")
            .attr("type", "text")
            .attr("id", "search-input")
            .attr("placeholder", "Rechercher...");

        searchDiv.append("input")
            .attr("type", "checkbox")
            .attr("id", "select-all-checkbox")
            .text("Tout sélectionner");

        const table = statisticsDiv.append("table");
        const thead = table.append("thead");
        const tbody = table.append("tbody");

        const columns = ["", "Page", "Liens entrants", "Liens sortants"];
        let sortOrder = "asc";

        thead.append("tr")
            .selectAll("th")
            .data(columns)
            .enter().append("th")
            .text(d => d)
            .on("click", (event, d) => {
                if (d !== "") {
                    sortOrder = sortOrder === "asc" ? "desc" : "asc";
                    sortTable(d, sortOrder);
                }
            });

        const rows = tbody.selectAll("tr")
            .data(sortedNodes)
            .enter().append("tr");

        rows.selectAll("td")
            .data(d => [d.name, d.url, d.inDegree, d.outDegree])
            .enter().append("td")
            .html((d, i) => {
                if (i === 0) {
                    return `<input type="checkbox" class="delete-checkbox" data-node="${d}">`;
                }
                return d;
            })
            .style("background-color", (d, i) => {
                if (i === 2) {
                    return colorScale(d);
                }
                return null;
            })
            .style("color", (d, i) => {
                if (i === 2) {
                    return d3.lab(colorScale(d)).l < 50 ? "white" : "black";
                }
                return null;
            });

        statisticsDiv.append("button")
            .attr("id", "delete-nodes")
            .text("Supprimer")
            .on("click", deleteNodes);

        // Function to sort the table based on the selected column
        function sortTable(column, order) {
            rows.sort((a, b) => {
                let comparison = 0;
                switch (column) {
                    case "Page":
                        comparison = d3.ascending(a.url, b.url);
                        break;
                    case "Liens entrants":
                        comparison = d3.ascending(a.inDegree, b.inDegree);
                        break;
                    case "Liens sortants":
                        comparison = d3.ascending(a.outDegree, b.outDegree);
                        break;
                }
                return order === "asc" ? comparison : -comparison;
            });

            rows.selectAll("td")
                .data(d => [d.name, d.url, d.inDegree, d.outDegree])
                .html((d, i) => {
                    if (i === 0) {
                        return `<input type="checkbox" class="delete-checkbox" data-node="${d}">`;
                    }
                    return d;
                })
                .style("background-color", (d, i) => {
                    if (i === 2) {
                        return colorScale(d);
                    }
                    return null;
                })
                .style("color", (d, i) => {
                    if (i === 2) {
                        return d3.lab(colorScale(d)).l < 50 ? "white" : "black";
                    }
                    return null;
                });
        }

        function deleteNodes() {
            const checkedNodes = Array.from(document.querySelectorAll(".delete-checkbox:checked")).map(cb => cb.value);
            const updatedData = data.filter(d => !checkedNodes.includes(getLastSegment(d.Source)) && !checkedNodes.includes(getLastSegment(d.Destination)));
            fetch('update_data.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ data: updatedData })
            }).then(response => {
                if (response.ok) {
                    window.location.reload();
                } else {
                    console.error('Erreur lors de la mise à jour des données.');
                }
            });
        }

        document.getElementById('go-to-statistics').addEventListener('click', () => {
            document.getElementById('statistics').scrollIntoView({ behavior: 'smooth' });
        });

        document.getElementById('search-input').addEventListener('input', (event) => {
            const searchTerm = event.target.value.toLowerCase();
            rows.style('display', d => {
                const match = d.url.toLowerCase().includes(searchTerm);
                return match ? null : 'none';
            });
        });

        document.getElementById('select-all-checkbox').addEventListener('change', (event) => {
            const isChecked = event.target.checked;
            document.querySelectorAll('.delete-checkbox').forEach(cb => {
                cb.checked = isChecked;
            });
        });
    }

    function getLastSegment(url) {
        if (!url) return '';
        const segments = url.split('/');
        return segments[segments.length - 1] || segments[segments.length - 2];
    }
});
