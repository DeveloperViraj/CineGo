// ✅ Bookingscontrol.js (Fixed occupied seat check logic)
import { inngest } from "../Inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import { Stripe } from 'stripe';

// ✅ Check availability of seats
export const checkavailabilty = async (showId, selectedSeats) => {
    try {
        const show = await Show.findById(showId);
        if (!show) return false;

        const occupiedSeats = show.occupiedSeats;
        const isSeatTaken = selectedSeats.some(seat => occupiedSeats.get(seat));

        return !isSeatTaken;
    } catch (error) {
        console.log(error);
        return false;
    }
};

// ✅ Create a booking
export const createBooking = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { showId, selectedSeats } = req.body;
        const origin = req.headers.origin;

        const isAvailable = await checkavailabilty(showId, selectedSeats);
        if (!isAvailable) {
            return res.json({ success: false, message: "Selected seats are not available" });
        }

        const show = await Show.findById(showId).populate('movie');

        // ✅ Mark seats as occupied
        selectedSeats.forEach((seat) => show.occupiedSeats.set(seat, true));
        show.markModified('occupiedSeats');
        await show.save();

        const booking = await Booking.create({
            user: userId,
            show: showId,
            amount: show.showprice * selectedSeats.length,
            bookedseats: selectedSeats
        });

        // ✅ Stripe setup
        const stripeInstance = new Stripe(`${process.env.STRIPE_SECRET_KEY}`);
        const conversionRate = 86;
        const usdAmount = (booking.amount / conversionRate);
        const unitAmountInCents = Math.floor(usdAmount * 100);

        const line_items = [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: show.movie.originalTitle,
                    },
                    unit_amount: unitAmountInCents,
                },
                quantity: 1,
            }
        ];

        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/loading/my-bookings`,
            cancel_url: `${origin}/my-bookings`,
            line_items,
            mode: 'payment',
            metadata: {
                bookingId: booking._id.toString(),
            },
        });

        booking.paymentLink = session.url;
        await booking.save();

        await inngest.send({
            name: "app/checkpayment",
            data: {
                bookingId: booking._id.toString(),
            }
        });

        res.json({ success: true, url: session.url });
    } catch (error) {
        console.error("Stripe session error:", error);
        res.json({ success: false, message: error.message });
    }
};

// ✅ Send list of occupied seats to frontend
export const getoccupiedSeats = async (req, res) => {
    try {
        const { showId } = req.params;
        const showdata = await Show.findById(showId);

        // Convert Map to Array
        const occupiedSeats = Array.from(showdata.occupiedSeats.entries())
            .filter(([_, value]) => value)
            .map(([key]) => key);

        res.json({ success: true, occupiedSeats });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};
