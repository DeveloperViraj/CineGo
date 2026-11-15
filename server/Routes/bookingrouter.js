// server/Routes/bookingrouter.js
import express from "express";
import { createBooking, getoccupiedSeats } from "../Control/Bookingscontrol.js";
import { protectUser } from "../Middleware/Auth.js";

const bookingRouter = express.Router();

// Booking requires a signed-in user (it was previously open, and a missing
// userId made Booking.create fail after the seats were already locked)
bookingRouter.post("/create", protectUser, createBooking);
bookingRouter.get("/seats/:showId", getoccupiedSeats);

export default bookingRouter;
