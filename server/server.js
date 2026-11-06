import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = "nityaseva";
const COLLECTION = "submissions";
const PORT = process.env.PORT || 3001;

const client = new MongoClient(MONGO_URI);
let db;

async function connectDB() {
  await client.connect();
  db = client.db(DB_NAME);
  console.log(`Connected to MongoDB — database: ${DB_NAME}`);
}

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, db: DB_NAME });
});

// Aggregated stats for the progress tracker
app.get("/api/stats", async (_req, res) => {
  try {
    const col = db.collection(COLLECTION);
    const [agg] = await col
      .aggregate([
        {
          $group: {
            _id: null,
            totalPledged: { $sum: { $toInt: "$amount" } },
            totalSewaks: { $sum: 1 },
          },
        },
      ])
      .toArray();

    res.json({
      ok: true,
      totalPledged: agg?.totalPledged || 0,
      totalSewaks: agg?.totalSewaks || 0,
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ ok: false, error: "Server error." });
  }
});

// API endpoint for form submissions
app.post("/api/submit", async (req, res) => {
  try {
    const { name, phone, email, amount, frequency, message, consent, submittedFrom } = req.body;

    if (!name || !phone || !amount || !consent) {
      return res.status(400).json({ ok: false, error: "Missing required fields." });
    }

    const doc = {
      name,
      phone,
      email: email || "",
      amount,
      frequency: frequency || "Monthly",
      message: message || "",
      consent,
      submittedFrom: submittedFrom || "",
      createdAt: new Date(),
    };

    await db.collection(COLLECTION).insertOne(doc);
    res.json({ ok: true });
  } catch (err) {
    console.error("Submit error:", err);
    res.status(500).json({ ok: false, error: "Server error. Please try again." });
  }
});

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
