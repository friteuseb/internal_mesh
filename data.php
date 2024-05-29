<?php
// Check if the request method is POST and the CSV file is uploaded
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['csv-file'])) {
    $csvFile = $_FILES['csv-file']['tmp_name'];
    $data = array();
    $filteredData = array();

    if (($handle = fopen($csvFile, 'r')) !== FALSE) {
        // Read the headers
        $headers = fgetcsv($handle, 1000, ',');

        // Get the indices of relevant columns
        $sourceIndex = array_search('Source', $headers);
        $destinationIndex = array_search('Destination', $headers);
        $statusCodeIndex = array_search('Code de statut', $headers);
        $linkPositionIndex = array_search('Position du lien', $headers);
        $linkTypeIndex = array_search('Type', $headers);

        // Read the rows
        while (($row = fgetcsv($handle, 1000, ',')) !== FALSE) {
            $source = $row[$sourceIndex];
            $destination = $row[$destinationIndex];
            $statusCode = $row[$statusCodeIndex];
            $linkPosition = $row[$linkPositionIndex];
            $linkType = $row[$linkTypeIndex];

            // Apply filters
            if ($linkType === 'Hyperlien' && $statusCode == '200' && $linkPosition === 'Contenu') {
                $filteredData[] = array(
                    'Source' => $source,
                    'Destination' => $destination
                );
            }
        }
        fclose($handle);
    }

    // Save the filtered data to a JSON file
    $jsonFile = 'filtered_data.json';
    file_put_contents($jsonFile, json_encode(array('data' => $filteredData)));

    // Redirect to the visualization page
    header('Location: index.php');
    exit();
} else {
    // Display the filtered data if it exists
    if (file_exists('filtered_data.json')) {
        $jsonData = file_get_contents('filtered_data.json');
        echo $jsonData;
    } else {
        // If no filtered data exists, return an empty data array
        echo json_encode(array('data' => array()));
    }
}
?>
