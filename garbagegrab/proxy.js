const express = require('express');
const axios = require('axios');
const app = express();
const port = 3001; // Use a different port if 3000 is in use

app.get('/model', async (req, res) => {
  try {
    const response = await axios.get('https://play.rosebud.ai/assets/Glub%20Evolved.glb?Quick', {
      responseType: 'arraybuffer' // Ensures the binary GLTF file is handled correctly
    });
    res.set('Content-Type', 'model/gltf-binary');
    res.send(response.data);
  } catch (error) {
    console.error('Error fetching model:', error);
    res.status(500).send('Error fetching model');
  }
});

app.listen(port, () => {
  console.log(`Proxy server running at http://localhost:1234}`);
});