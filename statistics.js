// statistics.js
document.addEventListener("DOMContentLoaded", function() {
    // Load statistics when the DOM is fully loaded
    loadStatistics();

    function loadStatistics() {
        // Fetch data from the JSON file
        fetch('filtered_data.json')
            .then(response => response.json())
            .then(data => {
                if (Array.isArray(data.data)) {
                    // Display statistics with the loaded data
                    showStatistics(data.data);
                } else {
                    throw new Error("Les données chargées ne sont pas un tableau."); // Loaded data is not an array
                }
            })
            .catch(error => {
                // Log any errors during data loading
                console.error('Erreur lors du chargement des données: ' + error.message); // Error loading data
            });
    }

    function showStatistics(data) {
        const nodes = {};
        // Process the data to create nodes and calculate inDegree and outDegree
        data.forEach(d => {
            const source = getLastSegment(d.Source);
            const target = getLastSegment(d.Destination);
            nodes[source] = nodes[source] || { name: source, url: d.Source, inDegree: 0, outDegree: 0 };
            nodes[target] = nodes[target] || { name: target, url: d.Destination, inDegree: 0, outDegree: 0 };
            nodes[source].outDegree += 1;
            nodes[target].inDegree += 1;
        });

        const statisticsDiv = d3.select("#statistics");
        statisticsDiv.html(""); // Clear previous statistics

        // Sort nodes by inDegree
        const sortedNodes = Object.values(nodes).sort((a, b) => a.inDegree - b.inDegree);

        // Define color scale for inDegree
        const maxInDegree = d3.max(sortedNodes, d => d.inDegree);
        const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
            .domain([0, maxInDegree]);

        // Create a table to display statistics
        const table = statisticsDiv.append("table");
        const thead = table.append("thead");
        const tbody = table.append("tbody");

        const columns = ["", "Page", "Liens entrants", "Liens sortants"];
        let sortOrder = "asc";

        // Create table header
        thead.append("tr")
            .selectAll("th")
            .data(columns)
            .enter().append("th")
            .text(d => d)
            .on("click", (event, d) => {
                if (d !== "") {
                    // Toggle sort order and sort table
                    sortOrder = sortOrder === "asc" ? "desc" : "asc";
                    sortTable(d, sortOrder);
                }
            });

        // Create table rows
        const rows = tbody.selectAll("tr")
            .data(sortedNodes)
            .enter().append("tr");

        rows.selectAll("td")
            .data(d => [d.name, d.url, d.inDegree, d.outDegree])
            .enter().append("td")
            .html((d, i, columns) => {
                if (i === 0) {
                    // Add a checkbox for deletion
                    return `<input type="checkbox" class="delete-checkbox" value="${d}">`;
                }
                return d;
            })
            .style("background-color", (d, i, columns) => {
                if (i === 2) { // Apply color scale to the "Liens entrants" column
                    return colorScale(d);
                }
                return null;
            })
            .style("color", (d, i, columns) => {
                if (i === 2) { // Adjust text color for better contrast
                    return d3.lab(colorScale(d)).l < 50 ? "white" : "black";
                }
                return null;
            });

        // Add a button to delete selected nodes
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
                .html((d, i, columns) => {
                    if (i === 0) {
                        return `<input type="checkbox" class="delete-checkbox" value="${d}">`;
                    }
                    return d;
                })
                .style("background-color", (d, i, columns) => {
                    if (i === 2) {
                        return colorScale(d);
                    }
                    return null;
                })
                .style("color", (d, i, columns) => {
                    if (i === 2) {
                        return d3.lab(colorScale(d)).l < 50 ? "white" : "black";
                    }
                    return null;
                });
        }

        // Function to delete selected nodes
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
                    // Reload the page to reflect changes
                    window.location.reload();
                } else {
                    console.error('Erreur lors de la mise à jour des données.'); // Error updating data
                }
            });
        }

        // Scroll to statistics section when button is clicked
        document.getElementById('go-to-statistics').addEventListener('click', () => {
            document.getElementById('statistics').scrollIntoView({ behavior: 'smooth' });
        });
    }

    // Function to get the last segment of a URL
    function getLastSegment(url) {
        if (!url) return ''; // Return an empty string if URL is undefined or null
        const segments = url.split('/');
        return segments[segments.length - 1] || segments[segments.length - 2];
    }
});
