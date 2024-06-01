<?php
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST' && isset($_FILES['csv-file'])) {
    $csvFile = $_FILES['csv-file']['tmp_name'];
    if (empty($csvFile)) {
        die('Error: CSV file path is empty.');
    }

    $data = array();
    $filteredData = array();

    if (($handle = fopen($csvFile, 'r')) !== FALSE) {
        // Lire les en-têtes et supprimer le BOM s'il existe
        $headers = fgetcsv($handle, 1000, ',');
        if ($headers === FALSE) {
            die('Erreur lors de la lecture des en-têtes du fichier CSV.');
        }

        // Supprimer le BOM du premier en-tête si présent et trim les guillemets
        $headers = array_map(function($header) {
            return trim(preg_replace('/[\x{FEFF}\x{200B}]/u', '', $header), "\" \t\n\r\0\x0B");
        }, $headers);

        // Indices des colonnes pertinentes
        $sourceIndex = array_search('Source', $headers);
        $destinationIndex = array_search('Destination', $headers);
        $statusCodeIndex = array_search('Status Code', $headers);
        $linkPositionIndex = array_search('Link Position', $headers);
        $linkTypeIndex = array_search('Type', $headers);

        // Vérification de l'existence des colonnes nécessaires
        if ($sourceIndex === FALSE) {
            die('Colonne "Source" manquante dans le fichier CSV.');
        }
        if ($destinationIndex === FALSE) {
            die('Colonne "Destination" manquante dans le fichier CSV.');
        }
        if ($statusCodeIndex === FALSE) {
            die('Colonne "Status Code" manquante dans le fichier CSV.');
        }
        if ($linkPositionIndex === FALSE) {
            die('Colonne "Link Position" manquante dans le fichier CSV.');
        }
        if ($linkTypeIndex === FALSE) {
            die('Colonne "Type" manquante dans le fichier CSV.');
        }

        // Lire les lignes
        while (($row = fgetcsv($handle, 1000, ',')) !== FALSE) {
            $row = array_map(function($field) {
                return trim($field, "\"");
            }, $row);

            $source = $row[$sourceIndex];
            $destination = $row[$destinationIndex];
            $statusCode = $row[$statusCodeIndex];
            $linkPosition = $row[$linkPositionIndex];
            $linkType = $row[$linkTypeIndex];

            // Appliquer les filtres
            if ($linkType === 'Hyperlink' && $statusCode == '200' && $linkPosition === 'Content') {
                $filteredData[] = array(
                    'Source' => $source,
                    'Destination' => $destination
                );
            }
        }
        fclose($handle);
    } else {
        die('Erreur lors de l\'ouverture du fichier CSV.');
    }

    // Enregistrer les données filtrées dans un fichier JSON
    $jsonFile = 'filtered_data.json';
    $jsonData = json_encode(array('data' => $filteredData));
    if ($jsonData === FALSE) {
        die('Erreur lors de l\'encodage JSON des données filtrées.');
    }

    if (file_put_contents($jsonFile, $jsonData) === FALSE) {
        die('Erreur lors de l\'écriture des données filtrées dans le fichier JSON.');
    }

    // Rediriger vers la page de visualisation
    header('Location: index.html');
    exit();
} elseif ($method === 'POST' && isset($_POST['remove_node'])) {
    $nodeToRemove = $_POST['remove_node'];

    $jsonFile = 'filtered_data.json';
    if (!file_exists($jsonFile)) {
        die('Erreur: fichier JSON non trouvé.');
    }

    $jsonData = json_decode(file_get_contents($jsonFile), true);
    if ($jsonData === NULL) {
        die('Erreur lors du décodage du fichier JSON.');
    }

    $filteredData = array_filter($jsonData['data'], function($link) use ($nodeToRemove) {
        return $link['Source'] !== $nodeToRemove && $link['Destination'] !== $nodeToRemove;
    });

    $jsonData['data'] = array_values($filteredData);
    if (file_put_contents($jsonFile, json_encode($jsonData)) === FALSE) {
        die('Erreur lors de l\'écriture des données filtrées dans le fichier JSON.');
    }

    echo json_encode($jsonData);
    exit();
} elseif ($method === 'POST' && isset($_POST['remove_nodes'])) {
    $nodesToRemove = json_decode($_POST['remove_nodes'], true);

    $jsonFile = 'filtered_data.json';
    if (!file_exists($jsonFile)) {
        die('Erreur: fichier JSON non trouvé.');
    }

    $jsonData = json_decode(file_get_contents($jsonFile), true);
    if ($jsonData === NULL) {
        die('Erreur lors du décodage du fichier JSON.');
    }

    $filteredData = array_filter($jsonData['data'], function($link) use ($nodesToRemove) {
        return !in_array($link['Source'], $nodesToRemove) && !in_array($link['Destination'], $nodesToRemove);
    });

    $jsonData['data'] = array_values($filteredData);
    if (file_put_contents($jsonFile, json_encode($jsonData)) === FALSE) {
        die('Erreur lors de l\'écriture des données filtrées dans le fichier JSON.');
    }

    echo json_encode($jsonData);
    exit();
} else {
    // Afficher les données filtrées si elles existent
    if (file_exists('filtered_data.json')) {
        $jsonData = file_get_contents('filtered_data.json');
        echo $jsonData;
    } else {
        echo json_encode(array('data' => array()));
    }
}
?>
