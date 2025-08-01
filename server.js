// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const xml2js = require('xml2js');
const WebSocket = require('ws');

const app = express();
app.use(bodyParser.text({ type: 'application/xml' }));
const XML_FILE = path.join(__dirname, 'recipes.xml');

// Create HTTP server
const server = app.listen(3000, () => console.log('HTTP server running on port 3000'));

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    
    ws.on('message', (message) => {
        console.log('Received message:', message);
        // Broadcast to all clients
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Get current recipes
app.get('/recipes', (req, res) => {
    fs.readFile(XML_FILE, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading recipes:', err);
            return res.status(500).send('Error reading recipes');
        }
        res.type('application/xml').send(data);
    });
});

// Add new recipe
app.post('/recipes', (req, res) => {
    const newRecipeXml = req.body;
    
    // Parse the existing XML
    fs.readFile(XML_FILE, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading recipes:', err);
            return res.status(500).send('Error reading recipes');
        }
        
        xml2js.parseString(data, (err, result) => {
            if (err) {
                console.error('Error parsing XML:', err);
                return res.status(500).send('Error parsing XML');
            }
            
            // Parse the new recipe
            xml2js.parseString(newRecipeXml, (err, newRecipe) => {
                if (err) {
                    console.error('Invalid recipe XML:', err);
                    return res.status(400).send('Invalid recipe XML');
                }
                
                // Add the new recipe
                result.recipes.recipe.push(newRecipe.recipe);
                
                // Convert back to XML
                const builder = new xml2js.Builder();
                const xml = builder.buildObject(result);
                
                // Save the file
                fs.writeFile(XML_FILE, xml, (err) => {
                    if (err) {
                        console.error('Error saving recipes:', err);
                        return res.status(500).send('Error saving recipes');
                    }
                    
                    console.log('Recipe added successfully');
                    
                    // Broadcast update to all WebSocket clients
                    wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send('UPDATE_RECIPES');
                        }
                    });
                    
                    res.status(201).send('Recipe added');
                });
            });
        });
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).send('Internal Server Error');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    wss.clients.forEach(client => client.close());
    wss.close();
    server.close(() => {
        process.exit(0);
    });
});