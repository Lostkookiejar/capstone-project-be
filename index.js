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

//legacy code, testing connection
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

//get reviews of a user
app.get("/reviews/user/:id", async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    const getQuery = await client.query(
      "SELECT * FROM reviews WHERE user_id = $1",
      [id],
    );
    if (getQuery.rowCount > 0) {
      res.json(getQuery.rows);
    } else {
      res
        .status(404)
        .json({ error: "No reviews are available from this user" });
    }
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

//create new review for a user
app.post("/create/review/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const { name, thumbnail, content, created_at, rating, playtime } = req.body;
  const client = await pool.connect();

  try {
    const userExists = await client.query(
      "SELECT user_id FROM reviews WHERE user_id = $1",
      [user_id],
    );

    if (userExists.rows.length > 0) {
      const createQuery = await client.query(
        `INSERT INTO reviews (name, thumbnail, content, created_at, rating, playtime, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
        [name, thumbnail, content, created_at, rating, playtime, user_id],
      );

      console.log(`Review created with id ${createQuery.rows[0]}`);

      res.json({
        status: "success",
        data: createQuery.rows[0],
        message: "Review created",
      });
    } else {
      res.status(400).json({ error: "User does not exist" });
    }
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

//update existing review for a user
app.put("/update/review/:id", async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;
  const { content, playtime, rating, thumbnail } = req.body;

  try {
    const updateQuery = await client.query(
      `
      UPDATE reviews SET content = $1, playtime = $2, 
      rating = $3, thumbnail = $4 WHERE id = $5`,
      [content, playtime, rating, thumbnail, id],
    );

    res.json({ status: "success", message: "Review updated." });
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.delete("/delete/review/:id", async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;

  try {
    await client.query(`DELETE FROM reviews WHERE id = $1`, [id]);

    res.json({ status: "success", message: "Review deleted." });
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
