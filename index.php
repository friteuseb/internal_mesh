<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visualisation des Cocons Sémantiques</title>
    <link rel="stylesheet" href="styles.css">
    <script src="https://d3js.org/d3.v7.min.js"></script>
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
    <div id="statistics"></div>
    <script src="utils.js"></script>
    <script src="graph.js"></script>
    <script src="statistics.js"></script>
</body>
</html>
