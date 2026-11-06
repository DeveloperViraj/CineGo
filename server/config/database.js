// Purpose: Establish and manage the MongoDB connection using Mongoose.
// The connection promise is cached at module level so that:
// - long-running hosts (Render, local dev) connect exactly once, and
// - serverless hosts (Vercel) reuse the connection across warm invocations
//   instead of paying the TLS + auth handshake on every request.

import mongoose from "mongoose";

let connectionPromise = null;
let listenersAttached = false;

const mongoConnect = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  if (!listenersAttached) {
    listenersAttached = true;
    mongoose.connection.on("connected", () =>
      console.log("Connected to MongoDB:", mongoose.connection.name)
    );
    mongoose.connection.on("error", (e) =>
      console.error("MongoDB connection error:", e?.message || e)
    );
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set");
  }

  connectionPromise = mongoose
    .connect(process.env.MONGO_URI, {
      // dbName is explicitly set to avoid accidental connections to the wrong database
      dbName: process.env.MONGO_DB_NAME || "test",
      // Fail fast instead of hanging a request for 30s when Atlas is unreachable
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 10,
    })
    .then(() => mongoose.connection)
    .catch((error) => {
      // Allow the next request to retry instead of caching a failed promise forever
      connectionPromise = null;
      console.error("MongoDB connection failed:", error.message);
      throw error;
    });

  return connectionPromise;
};

export default mongoConnect;
