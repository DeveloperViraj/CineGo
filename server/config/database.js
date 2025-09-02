// server/config/database.js
import mongoose from "mongoose";

const mongoConnect = async () => {
  try {
    mongoose.connection.on("connected", () =>
      console.log("✅ Connected to MongoDB Atlas:", mongoose.connection.name)
    );

    mongoose.connection.on("error", (e) =>
      console.error("❌ Mongo error:", e?.message || e)
    );

    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "test", // force use of "test" DB
    });

    console.log("🚀 MongoDB connection established successfully.");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1); // exit on failure so Render restarts service
  }
};

export default mongoConnect;
