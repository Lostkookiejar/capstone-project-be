let express = require("express");
let path = require("path");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { DATABASE_URL, SECRET_KEY } = process.env;

let app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    require: true,
  },
});

app.get("/allreviews", async (req, res) => {
  const client = await pool.connect();

  try {
    const reviews = await client.query("SELECT * FROM reviews", []);
    if (reviews.rowCount > 0) {
      res.json(reviews.rows);
    } else {
      res.status(404).json({ error: "No reviews are available" });
    }
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

//boiler plate code
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/index.html"));
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname + "/404.html"));
});

app.listen(3000, () => {
  console.log("App is listening on port 3000");
});
