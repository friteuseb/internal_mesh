# Internal Mesh Visualization

This PHP application allows you to visualize the internal linking structure of a website using an export of outbound links from Screaming Frog.

## Features

- **CSV Import**: Easily import data exported from Screaming Frog.
- **Link Filtering**: Only relevant hyperlinks (status 200 and present in the content) are considered.
- **Interactive Visualization**: Explore a clear and interactive representation of your internal links with D3.js.
- **Link Analysis**: Identify pages with the most incoming and outgoing links.
- **Reset and Delete Nodes**: Easily reset the graph and delete unwanted nodes.

## How to Use

1. **Export a CSV from Screaming Frog**:
   - Go to "Bulk Export" > "Links" > "All Outlinks".
2. **Import the CSV into the Application**:
   - Use the import form on the homepage to upload your file.
3. **Explore and Analyze**:
   - The interactive visualization will show how the pages of your site are interconnected.
4. **Optimize**:
   - Use the insights to strengthen your semantic cocoon and improve your SEO.

## Dependencies

- PHP
- D3.js

## Installation

1. Clone the repository to your local machine:
   ```sh
   git clone https://github.com/friteuseb/internal_mesh.git
