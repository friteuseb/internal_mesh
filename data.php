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

// Fonction pour générer un identifiant unique
function generateUUID() {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

// Fonction pour valider les liens selon les critères de filtrage
function isValidLink($linkPosition, $linkPath, $postData) {
    // Configuration par défaut des zones exclues
    $defaultExcludedZones = ['Header', 'Footer', 'Navigation'];
    $defaultExcludedSelectors = [
        'header', 'footer', 'nav', '.navbar', '.menu', '.navigation',
        '.breadcrumb', '.pagination', '.sidebar', '.widget'
    ];
    
    // Récupérer les préférences utilisateur ou utiliser les valeurs par défaut
    $excludedZones = isset($postData['excluded_zones']) ? 
        json_decode($postData['excluded_zones'], true) : $defaultExcludedZones;
    $excludedSelectors = isset($postData['excluded_selectors']) ? 
        json_decode($postData['excluded_selectors'], true) : $defaultExcludedSelectors;
    $includeContentOnly = isset($postData['content_only']) ? 
        $postData['content_only'] === 'true' : false;
    
    // Si mode "Content seulement" activé
    if ($includeContentOnly) {
        return $linkPosition === 'Content';
    }
    
    // Filtrage par position
    if (in_array($linkPosition, $excludedZones)) {
        return false;
    }
    
    // Filtrage par sélecteurs CSS dans le chemin du lien
    foreach ($excludedSelectors as $selector) {
        if (strpos(strtolower($linkPath), strtolower($selector)) !== false) {
            return false;
        }
    }
    
    return true;
}

// Fonction pour analyser les thématiques des pages
function analyzePageThemes($data) {
    $themes = [];
    
    if (empty($data)) {
        return $themes;
    }
    
    foreach ($data as $link) {
        $sourceUrl = $link['Source'];
        $destUrl = $link['Destination'];
        
        // Vérifier que les URLs sont valides
        $sourcePath = parse_url($sourceUrl, PHP_URL_PATH);
        $destPath = parse_url($destUrl, PHP_URL_PATH);
        
        if ($sourcePath === false || $destPath === false) {
            continue;
        }
        
        // Extraire les segments d'URL pour identifier les thématiques
        $sourceParts = array_values(array_filter(explode('/', trim($sourcePath ?? '', '/'))));
        $destParts = array_values(array_filter(explode('/', trim($destPath ?? '', '/'))));
        
        // Identifier les catégories (premier segment après le domaine)
        if (!empty($sourceParts)) {
            $sourceCategory = $sourceParts[0];
            if (!isset($themes[$sourceCategory])) {
                $themes[$sourceCategory] = ['pages' => [], 'internal_links' => 0, 'external_links' => 0];
            }
            if (!in_array($sourceUrl, $themes[$sourceCategory]['pages'])) {
                $themes[$sourceCategory]['pages'][] = $sourceUrl;
            }
        } else {
            // Page racine
            if (!isset($themes['root'])) {
                $themes['root'] = ['pages' => [], 'internal_links' => 0, 'external_links' => 0];
            }
            if (!in_array($sourceUrl, $themes['root']['pages'])) {
                $themes['root']['pages'][] = $sourceUrl;
            }
        }
        
        if (!empty($destParts)) {
            $destCategory = $destParts[0];
            if (!isset($themes[$destCategory])) {
                $themes[$destCategory] = ['pages' => [], 'internal_links' => 0, 'external_links' => 0];
            }
            if (!in_array($destUrl, $themes[$destCategory]['pages'])) {
                $themes[$destCategory]['pages'][] = $destUrl;
            }
        } else {
            // Page racine
            if (!isset($themes['root'])) {
                $themes['root'] = ['pages' => [], 'internal_links' => 0, 'external_links' => 0];
            }
            if (!in_array($destUrl, $themes['root']['pages'])) {
                $themes['root']['pages'][] = $destUrl;
            }
        }
        
        // Compter les liens internes/externes par thématique
        $sourceCategory = !empty($sourceParts) ? $sourceParts[0] : 'root';
        $destCategory = !empty($destParts) ? $destParts[0] : 'root';
        
        if ($sourceCategory === $destCategory) {
            $themes[$sourceCategory]['internal_links']++;
        } else {
            $themes[$sourceCategory]['external_links']++;
        }
    }
    
    return $themes;
}

// Fonction pour détecter les pages orphelines
function detectOrphanPages($data) {
    if (empty($data)) {
        return [];
    }
    
    $allPages = array_unique(array_merge(
        array_column($data, 'Source'),
        array_column($data, 'Destination')
    ));
    
    $pagesWithIncomingLinks = array_unique(array_column($data, 'Destination'));
    $orphanPages = [];
    
    foreach ($allPages as $page) {
        if (!in_array($page, $pagesWithIncomingLinks)) {
            $outgoingLinks = array_filter($data, function($link) use ($page) {
                return $link['Source'] === $page;
            });
            
            $orphanPages[] = [
                'url' => $page,
                'outgoing_links' => count($outgoingLinks),
                'theme' => getPageTheme($page)
            ];
        }
    }
    
    return $orphanPages;
}

// Fonction pour obtenir le thème d'une page
function getPageTheme($url) {
    $path = parse_url($url, PHP_URL_PATH);
    if ($path === false) return 'unknown';
    
    $parts = array_values(array_filter(explode('/', trim($path, '/'))));
    return !empty($parts) ? $parts[0] : 'root';
}

// Fonction pour générer des suggestions d'amélioration
function generateMeshSuggestions($data, $themes, $orphanPages) {
    $suggestions = [];
    
    // Suggestion 1: Connecter les pages orphelines
    foreach ($orphanPages as $orphan) {
        if ($orphan['outgoing_links'] > 0) {
            // Trouver des pages du même thème qui pourraient pointer vers cette page
            $sameThemePages = [];
            foreach ($data as $link) {
                if (getPageTheme($link['Source']) === $orphan['theme'] && $link['Source'] !== $orphan['url']) {
                    $sameThemePages[] = $link['Source'];
                }
            }
            
            $sameThemePages = array_unique($sameThemePages);
            if (!empty($sameThemePages)) {
                $suggestions[] = [
                    'type' => 'connect_orphan',
                    'priority' => 'high',
                    'title' => 'Connecter une page orpheline',
                    'description' => 'La page "' . basename($orphan['url']) . '" n\'a aucun lien entrant.',
                    'action' => 'Ajouter des liens depuis: ' . implode(', ', array_slice($sameThemePages, 0, 3)),
                    'target_url' => $orphan['url'],
                    'source_urls' => array_slice($sameThemePages, 0, 3)
                ];
            }
        }
    }
    
    // Suggestion 2: Renforcer les thèmes faibles
    foreach ($themes as $theme => $themeData) {
        $totalThemeLinks = $themeData['internal_links'] + $themeData['external_links'];
        if ($totalThemeLinks < 5 && count($themeData['pages']) > 2) {
            $suggestions[] = [
                'type' => 'strengthen_theme',
                'priority' => 'medium',
                'title' => 'Renforcer le maillage thématique',
                'description' => 'Le thème "' . $theme . '" a peu de liens internes (' . $themeData['internal_links'] . ').',
                'action' => 'Créer plus de liens entre les pages de ce thème',
                'theme' => $theme,
                'pages' => $themeData['pages']
            ];
        }
    }
    
    // Limiter à 10 suggestions maximum
    return array_slice($suggestions, 0, 10);
}

// Fonction pour calculer les métriques de qualité du maillage
function calculateMeshQuality($data, $themes) {
    if (empty($data)) {
        return [
            'total_links' => 0,
            'total_pages' => 0,
            'link_density' => 0,
            'theme_count' => 0,
            'theme_balance' => 0,
            'orphan_pages' => [],
            'suggestions' => [],
            'themes' => []
        ];
    }
    
    $totalLinks = count($data);
    $uniquePages = array_unique(array_merge(
        array_column($data, 'Source'),
        array_column($data, 'Destination')
    ));
    $totalPages = count($uniquePages);
    
    // Calculer la densité de liens
    $linkDensity = $totalPages > 0 ? $totalLinks / $totalPages : 0;
    
    // Calculer la distribution thématique
    $themeDistribution = [];
    $totalThemeLinks = 0;
    foreach ($themes as $theme => $themeData) {
        $themeLinks = $themeData['internal_links'] + $themeData['external_links'];
        $themeDistribution[$theme] = $themeLinks;
        $totalThemeLinks += $themeLinks;
    }
    
    // Calculer l'équilibrage thématique (coefficient de variation)
    $themeBalance = 0;
    if (count($themeDistribution) > 1 && $totalThemeLinks > 0) {
        $mean = $totalThemeLinks / count($themeDistribution);
        $variance = 0;
        foreach ($themeDistribution as $links) {
            $variance += pow($links - $mean, 2);
        }
        $variance /= count($themeDistribution);
        $themeBalance = $mean > 0 ? sqrt($variance) / $mean : 0;
    }
    
    // Détecter les pages orphelines
    $orphanPages = detectOrphanPages($data);
    
    // Générer des suggestions
    $suggestions = generateMeshSuggestions($data, $themes, $orphanPages);
    
    return [
        'total_links' => $totalLinks,
        'total_pages' => $totalPages,
        'link_density' => round($linkDensity, 2),
        'theme_count' => count($themes),
        'theme_balance' => round($themeBalance, 2),
        'orphan_pages' => $orphanPages,
        'suggestions' => $suggestions,
        'themes' => $themes
    ];
}

$method = $_SERVER['REQUEST_METHOD'];

// Configuration pour gros fichiers
ini_set('memory_limit', '1024M');
ini_set('max_execution_time', 300);
ini_set('max_input_time', 300);
ini_set('upload_max_filesize', '500M');
ini_set('post_max_size', '500M');

// Debug: log des erreurs
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

if ($method === 'POST' && isset($_FILES['csv-file'])) {
    $csvFile = $_FILES['csv-file']['tmp_name'];
    if (empty($csvFile)) {
        sendJsonResponse(['error' => 'Error: CSV file path is empty.'], 400);
    }

    // Vérifier la taille du fichier
    $fileSize = filesize($csvFile);
    $fileSizeMB = $fileSize / (1024 * 1024);
    
    // Traitement optimisé pour gros fichiers
    $isLargeFile = $fileSizeMB > 50;
    
    if ($isLargeFile) {
        // Augmenter encore plus les limites pour très gros fichiers
        ini_set('memory_limit', '2048M');
        ini_set('max_execution_time', 600); // 10 minutes
    }

    $data = array();
    $filteredData = array();
    $processedRows = 0;
    $maxRows = $isLargeFile ? 50000 : 0; // Limiter à 50k lignes pour très gros fichiers

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
        $linkPathIndex = array_search('Link Path', $headers);

        // Vérification de l'existence des colonnes nécessaires
        if ($sourceIndex === FALSE || $destinationIndex === FALSE || $statusCodeIndex === FALSE || $linkPositionIndex === FALSE || $linkTypeIndex === FALSE || $linkPathIndex === FALSE) {
            sendJsonResponse(['error' => 'Veuillez réaliser l\'export en anglais.'], 400);
        }

        // Lire les lignes avec optimisation pour gros fichiers
        while (($row = fgetcsv($handle, 1000, ',')) !== FALSE) {
            $processedRows++;
            
            // Limiter le nombre de lignes pour éviter les timeouts
            if ($maxRows > 0 && $processedRows > $maxRows) {
                break;
            }
            
            // Libérer de la mémoire périodiquement
            if ($processedRows % 1000 === 0) {
                if (function_exists('gc_collect_cycles')) {
                    gc_collect_cycles();
                }
            }
            
            $row = array_map(function($field) {
                return trim($field, "\"");
            }, $row);

            $source = $row[$sourceIndex];
            $destination = $row[$destinationIndex];
            $statusCode = $row[$statusCodeIndex];
            $linkPosition = $row[$linkPositionIndex];
            $linkType = $row[$linkTypeIndex];
            $linkPath = $row[$linkPathIndex];

            // Appliquer les filtres avancés
            if ($linkType === 'Hyperlink' && $statusCode == '200' && isValidLink($linkPosition, $linkPath, $_POST ?? [])) {
                $filteredData[] = array(
                    'id' => generateUUID(),
                    'Source' => $source,
                    'Destination' => $destination,
                    'LinkPosition' => $linkPosition,
                    'LinkPath' => $linkPath
                );
                
                // Limiter aussi le nombre de liens filtrés pour éviter les problèmes de mémoire
                if ($isLargeFile && count($filteredData) > 10000) {
                    break;
                }
            }
        }
        fclose($handle);
    } else {
        sendJsonResponse(['error' => 'Erreur lors de l\'ouverture du fichier CSV.'], 400);
    }

    // Analyser les thématiques et calculer les métriques
    $themes = analyzePageThemes($filteredData);
    $meshQuality = calculateMeshQuality($filteredData, $themes);
    
    // Enregistrer les données filtrées dans un fichier JSON
    $jsonFile = 'filtered_data.json';
    $jsonData = json_encode(array(
        'data' => $filteredData,
        'themes' => $themes,
        'metrics' => $meshQuality
    ));
    if ($jsonData === FALSE) {
        sendJsonResponse(['error' => 'Erreur lors de l\'encodage JSON des données filtrées.'], 500);
    }

    if (file_put_contents($jsonFile, $jsonData) === FALSE) {
        sendJsonResponse(['error' => 'Erreur lors de l\'écriture des données filtrées dans le fichier JSON.'], 500);
    }

    // Message spécial pour les gros fichiers
    $message = 'Fichier traité avec succès';
    if ($isLargeFile) {
        $message = sprintf(
            'Gros fichier traité (%.1f MB, %d lignes processées, %d liens analysés)', 
            $fileSizeMB, 
            $processedRows, 
            count($filteredData)
        );
        
        if ($maxRows > 0 && $processedRows >= $maxRows) {
            $message .= sprintf(' - Limité à %d lignes pour optimiser les performances', $maxRows);
        }
    }
    
    // Retourner les données filtrées en JSON avec analyses
    sendJsonResponse([
        'message' => $message, 
        'data' => $filteredData,
        'themes' => $themes,
        'metrics' => $meshQuality,
        'processing_info' => [
            'file_size_mb' => round($fileSizeMB, 2),
            'total_rows_processed' => $processedRows,
            'filtered_links' => count($filteredData),
            'is_large_file' => $isLargeFile,
            'was_limited' => $maxRows > 0 && $processedRows >= $maxRows
        ]
    ]);
} elseif ($method === 'POST' && isset($_POST['clear_all'])) {
    $jsonFile = 'filtered_data.json';
    if (file_exists($jsonFile)) {
        if (unlink($jsonFile)) {
            sendJsonResponse(['success' => true, 'message' => 'Fichier JSON supprimé avec succès.']);
        } else {
            sendJsonResponse(['error' => 'Erreur lors de la suppression du fichier JSON.'], 500);
        }
    } else {
        sendJsonResponse(['error' => 'Erreur: fichier JSON non trouvé.'], 404);
    }
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
        return $link['id'] !== $nodeToRemove;
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

    $jsonData = file_get_contents($jsonFile);
    if ($jsonData === FALSE) {
        sendJsonResponse(['error' => 'Erreur lors de la lecture du fichier JSON.'], 500);
    }

    $jsonData = json_decode($jsonData, true);
    if ($jsonData === NULL) {
        sendJsonResponse(['error' => 'Erreur lors du décodage du fichier JSON.'], 500);
    }

    $filteredData = array_filter($jsonData['data'], function($link) use ($nodesToRemove) {
        return !in_array($link['id'], $nodesToRemove);
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
        if ($jsonData === FALSE) {
            sendJsonResponse(['error' => 'Erreur lors de la lecture du fichier JSON.'], 500);
        }

        $jsonData = json_decode($jsonData, true);
        if ($jsonData === NULL) {
            sendJsonResponse(['error' => 'Erreur lors du décodage du fichier JSON.'], 500);
        }

        sendJsonResponse($jsonData);
    } else {
        sendJsonResponse(['data' => array()]);
    }
}