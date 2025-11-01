const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3001;

// Path to your SQLite database
// Use the parseblockchain/database.sqlite file, open read-only
const dbPath = path.join(__dirname, '../parseblockchain/blockchain.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database (read-only)');
  }
});

app.use(express.json());


/*
CREATE TABLE blocks
                 (height INTEGER PRIMARY KEY, 
                timestamp INTEGER, 
              num_transactions INTEGER, 
              size INTEGER,
              minted_value INTEGER,
              output_value INTEGER,
              difficulty REAL);
*/              
app.get('/api/blocks', (req, res) => {
  db.all('SELECT * FROM blocks', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ blocks: rows });
  });
});




app.get('/api/days', (req, res) => {
  db.all('SELECT * FROM days', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ days: rows });
  });
});

// Example API endpoint: Add a new item
// ...existing code...

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
