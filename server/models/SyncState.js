// Purpose: Tiny key/value collection for background job bookkeeping.
// The automatic show scheduler uses it to:
// - hold a short-lived lock so two runs never schedule the same shows twice
// - remember when it last succeeded (so the API can self-heal if a cron run is missed)

import mongoose, { Schema } from "mongoose";

const syncStateSchema = new Schema(
  {
    _id: { type: String, required: true },
    lockedUntil: { type: Date },
    lastRunAt: { type: Date },
    lastSuccessAt: { type: Date },
    lastResult: { type: Object },
    lastError: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.SyncState ||
  mongoose.model("SyncState", syncStateSchema);
