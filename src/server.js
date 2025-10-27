import express from "express";
import { ENV } from "./config/env.js";
import { db } from "./config/db.js";
import { favoritesTable } from "./db/schema.js";
import { and, eq } from "drizzle-orm";
import job from "./config/cron.js";
import GoogleGenAI from "@google/genai";

const app = express();
const PORT = ENV.PORT || 5001;

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

if (ENV.NODE_ENV === "production") job.start();

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true });
});

// -------------------------------------- favorites endpoint --------------------------------------
// endpoint to add recipe to user favorites
app.post("/api/favorites", async (req, res) => {
  try {
    const { userId, recipeId, title, image, cookTime, servings } = req.body;

    if (!userId || !recipeId || !title) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newFavorite = await db
      .insert(favoritesTable)
      .values({
        userId,
        recipeId,
        title,
        image,
        cookTime,
        servings,
      })
      .returning();

    res.status(201).json(newFavorite[0]);
  } catch (error) {
    console.log("Error adding favorite", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// endpoint to get all the user favorite recipes
app.get("/api/favorites/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const userFavorites = await db
      .select()
      .from(favoritesTable)
      .where(eq(favoritesTable.userId, userId));

    res.status(200).json(userFavorites);
  } catch (error) {
    console.log("Error fetching the favorites", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// endpoint to delete a favorite recipe of user
app.delete("/api/favorites/:userId/:recipeId", async (req, res) => {
  try {
    const { userId, recipeId } = req.params;

    await db
      .delete(favoritesTable)
      .where(
        and(
          eq(favoritesTable.userId, userId),
          eq(favoritesTable.recipeId, parseInt(recipeId))
        )
      );

    res.status(200).json({ message: "Favorite removed successfully" });
  } catch (error) {
    console.log("Error removing a favorite", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
// -------------------------------------- favorites endpoint --------------------------------------

// -------------------------------------- ask ai endpoint --------------------------------------
// endpoint to as ai about the selected recipe
app.post("/api/ai/chat", async (req, res) => {
  try {
    // 1. Get user message and recipe context from the client request body
    const { userMessage, recipeContext } = req.body;

    // 2. Construct the prompt with system instructions (context) and user message
    const prompt = `You are a helpful cooking assistant named Recifind AI. You are helping a user with the following recipe details: ${JSON.stringify(
      recipeContext
    )}. Respond to the user's question: "${userMessage}"`;

    // 3. Call the Gemini API
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Use a suitable model
      contents: prompt,
    });

    // 4. Send the AI's response back to the React Native app
    res.status(200).json({
      response: response.text, // The generated text
    });
  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "Failed to get response from AI." });
  }
});
// -------------------------------------- ask ai endpoint --------------------------------------

app.listen(5001, () => {
  console.log("Server is running on P0RT: ", PORT);
});
