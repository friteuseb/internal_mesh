<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visualisation des Cocons Sémantiques</title>
    <link rel="stylesheet" href="/css/styles.css">
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script> <!-- Ajout de jQuery -->
</head>
<body>
    <h1>Visualisation des Cocons Sémantiques</h1>
    <p>Veuillez importer un fichier CSV exporté depuis Screaming Frog (exportation en bloc, tous les liens sortants).</p>
    <form id="upload-form" action="data.php" method="post" enctype="multipart/form-data">
        <input type="file" id="csv-file" name="csv-file" accept=".csv">
        <input type="submit" value="Upload CSV">
    </form>
    <div id="status">En attente de fichier...</div>
    <div class="button-container">
        <button id="reset-button">Réinitialiser</button>
        <button id="go-to-statistics">Voir les statistiques</button>
    </div>
    <div id="graph"></div>
    <div id="statistics">
        <!-- Champ de recherche -->
        <input type="text" id="searchInput" placeholder="Rechercher...">

        <!-- Tableau des statistiques -->
        <table id="statsTable">
            <thead>
                <tr>
                    <th><input type="checkbox" id="selectAll"></th>
                    <th>Page</th>
                    <th>Liens entrants</th>
                    <th>Liens sortants</th>
                </tr>
            </thead>
            <tbody>
                <!-- Les lignes du tableau seront générées dynamiquement par JavaScript -->
            </tbody>
        </table>
    </div>
    <script src="/js/utils.js"></script>
    <script src="/js/graph.js"></script>
    <script src="/js/statistics.js"></script>
</body>
</html>
