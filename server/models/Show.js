import mongoose from 'mongoose';
const { Schema } = mongoose;

const showSchema = new Schema({
  movie: {
    type: String, // TMDB movie ID as String
    ref: 'Movie',
    required: true,
  },
  showDateTime: { type: Date, required: true },
  showprice: { type: Number, required: true },
  occupiedSeats: {
    type: Map,
    of: Boolean,
    default: {},
  }
}, { timestamps: true });

export default mongoose.model('Show', showSchema);
