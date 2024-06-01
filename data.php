<?php
function sendJsonResponse($data, $httpStatusCode = 200) {
    header('Content-Type: application/json');
    http_response_code($httpStatusCode);
    echo json_encode($data);
    exit();
}

function handleError($errno, $errstr, $errfile, $errline) {
    $error = [
        'error' => [
            'message' => $errstr,
            'file' => $errfile,
            'line' => $errline
        ]
    ];
    sendJsonResponse($error, 500);
}

set_error_handler('handleError');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST' && isset($_FILES['csv-file'])) {
    $csvFile = $_FILES['csv-file']['tmp_name'];
    if (empty($csvFile)) {
        sendJsonResponse(['error' => 'Error: CSV file path is empty.'], 400);
    }

    $data = array();
    $filteredData = array();

    if (($handle = fopen($csvFile, 'r')) !== FALSE) {
        // Lire les en-têtes et supprimer le BOM s'il existe
        $headers = fgetcsv($handle, 1000, ',');
        if ($headers === FALSE) {
            sendJsonResponse(['error' => 'Erreur lors de la lecture des en-têtes du fichier CSV.'], 400);
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
            sendJsonResponse(['error' => 'Colonne "Source" manquante dans le fichier CSV.'], 400);
        }
        if ($destinationIndex === FALSE) {
            sendJsonResponse(['error' => 'Colonne "Destination" manquante dans le fichier CSV.'], 400);
        }
        if ($statusCodeIndex === FALSE) {
            sendJsonResponse(['error' => 'Colonne "Status Code" manquante dans le fichier CSV.'], 400);
        }
        if ($linkPositionIndex === FALSE) {
            sendJsonResponse(['error' => 'Colonne "Link Position" manquante dans le fichier CSV.'], 400);
        }
        if ($linkTypeIndex === FALSE) {
            sendJsonResponse(['error' => 'Colonne "Type" manquante dans le fichier CSV.'], 400);
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
        sendJsonResponse(['error' => 'Erreur lors de l\'ouverture du fichier CSV.'], 400);
    }

    // Enregistrer les données filtrées dans un fichier JSON
    $jsonFile = 'filtered_data.json';
    $jsonData = json_encode(array('data' => $filteredData));
    if ($jsonData === FALSE) {
        sendJsonResponse(['error' => 'Erreur lors de l\'encodage JSON des données filtrées.'], 500);
    }

    if (file_put_contents($jsonFile, $jsonData) === FALSE) {
        sendJsonResponse(['error' => 'Erreur lors de l\'écriture des données filtrées dans le fichier JSON.'], 500);
    }

    // Rediriger vers la page de visualisation
    header('Location: index.html');
    exit();
} elseif ($method === 'POST' && isset($_POST['remove_node'])) {
    $nodeToRemove = $_POST['remove_node'];

    $jsonFile = 'filtered_data.json';
    if (!file_exists($jsonFile)) {
        sendJsonResponse(['error' => 'Erreur: fichier JSON non trouvé.'], 404);
    }

    $jsonData = json_decode(file_get_contents($jsonFile), true);
    if ($jsonData === NULL) {
        sendJsonResponse(['error' => 'Erreur lors du décodage du fichier JSON.'], 500);
    }

    $filteredData = array_filter($jsonData['data'], function($link) use ($nodeToRemove) {
        return $link['Source'] !== $nodeToRemove && $link['Destination'] !== $nodeToRemove;
    });

    $jsonData['data'] = array_values($filteredData);
    if (file_put_contents($jsonFile, json_encode($jsonData)) === FALSE) {
        sendJsonResponse(['error' => 'Erreur lors de l\'écriture des données filtrées dans le fichier JSON.'], 500);
    }

    sendJsonResponse($jsonData);
} elseif ($method === 'POST' && isset($_POST['remove_nodes'])) {
    $nodesToRemove = json_decode($_POST['remove_nodes'], true);

    $jsonFile = 'filtered_data.json';
    if (!file_exists($jsonFile)) {
        sendJsonResponse(['error' => 'Erreur: fichier JSON non trouvé.'], 404);
    }

    $jsonData = json_decode(file_get_contents($jsonFile), true);
    if ($jsonData === NULL) {
        sendJsonResponse(['error' => 'Erreur lors du décodage du fichier JSON.'], 500);
    }

    $filteredData = array_filter($jsonData['data'], function($link) use ($nodesToRemove) {
        return !in_array($link['Source'], $nodesToRemove) && !in_array($link['Destination'], $nodesToRemove);
    });

    $jsonData['data'] = array_values($filteredData);
    if (file_put_contents($jsonFile, json_encode($jsonData)) === FALSE) {
        sendJsonResponse(['error' => 'Erreur lors de l\'écriture des données filtrées dans le fichier JSON.'], 500);
    }

    sendJsonResponse($jsonData);
} else {
    // Afficher les données filtrées si elles existent
    if (file_exists('filtered_data.json')) {
        $jsonData = file_get_contents('filtered_data.json');
        echo $jsonData;
    } else {
        sendJsonResponse(['data' => array()]);
    }
}
?>
