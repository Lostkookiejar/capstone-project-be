let express = require("express");
let path = require("path");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();
const ai = require("@google/genai");
const { DATABASE_URL } = process.env;

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

app.get("/review/image/:review_id", async (req, res) => {
  const client = await pool.connect();
  const { review_id } = req.params;

  try {
    const images = await client.query(
      "SELECT * FROM images WHERE review_id = $1",
      [review_id],
    );
    res.json(images.rows);
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.delete("/review/image/:image_id", async (req, res) => {
  const client = await pool.connect();
  const { image_id } = req.params;

  try {
    await client.query("DELETE FROM images WHERE id = $1", [image_id]);
    res.json({
      status: "success",
      message: "Reservation deleted successfully",
    });
  } catch (error) {
    console.error("Error: ", error.message);
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
      "SELECT * FROM reviews WHERE user_id = $1 ORDER BY id DESC",
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

//generate a review for your suggested game
app.get("/generate/review/:gameName", async (req, res) => {
  const { gameName } = req.params;
  try {
    const ai = new GoogleGenAI({});
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Write a 4-sentence game review about ${gameName}, but get one thing factually wrong. Do not use any text formatting or newline escape sequences.`,
      config: {
        thinkingConfig: {
          thinkingLevel: "low",
        },
        maxOutputTokens: 1100,
      },
    });

    const finishReason = response.candidates[0].finishReason;
    res.json({
      review: response.text,
      finishReason: finishReason,
      responseTokens: response.usageMetadata.candidatesTokenCount,
    });
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: error.message });
  }
});

//create new review for a user
app.post("/create/review/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const { name, thumbnail, content, created_at, rating, playtime } = req.body;
  const client = await pool.connect();

  try {
    const createQuery = await client.query(
      `INSERT INTO reviews (name, thumbnail, content, created_at, rating, playtime, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, thumbnail, content, created_at, rating, playtime, user_id],
    );

    console.log(`Review created with id ${createQuery.rows[0]}`);

    res.json(createQuery.rows[0]);
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
      rating = $3, thumbnail = $4 WHERE id = $5 RETURNING *`,
      [content, playtime, rating, thumbnail, id],
    );

    res.json(updateQuery.rows[0]);
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
    const deleteQuery = await client.query(
      `DELETE FROM reviews WHERE id = $1 RETURNING id`,
      [id],
    );

    res.json(deleteQuery.rows[0]);
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
