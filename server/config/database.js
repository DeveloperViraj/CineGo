// Purpose: Establish and manage the MongoDB connection using Mongoose.
// This file is imported once when the server starts to ensure the database
// is connected before handling any API requests.

import mongoose from "mongoose";

const mongoConnect = async () => {
  try {
    // Log when the database connection is successfully established
    mongoose.connection.on("connected", () =>
      console.log("Connected to MongoDB:", mongoose.connection.name)
    );

    // Log any runtime connection errors from MongoDB
    mongoose.connection.on("error", (e) =>
      console.error("MongoDB connection error:", e?.message || e)
    );

    // Connect to MongoDB using the URI from environment variables
    // dbName is explicitly set to avoid accidental connections to the wrong database
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "test",
    });

    console.log("MongoDB connection established successfully.");
  } catch (error) {
    // If the database fails to connect, stop the server process
    // Hosting platforms like Render will automatically restart it
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

export default mongoConnect;
