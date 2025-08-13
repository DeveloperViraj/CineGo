// server/models/DemoShow.js
import mongoose from "mongoose";
import Show from "./Show.js";

const DemoShowSchema = new mongoose.Schema(
  {
    ...Show.schema.obj,                  // reuse same fields
    isDemo: { type: Boolean, default: true },
    demoOwner: { type: String, index: true }, // Clerk userId of the demo user
  },
  { timestamps: true }
);

export default mongoose.model("DemoShow", DemoShowSchema);
