// Routes/userrouter.js
import express from "express";
import { getfavorites, getUserbookings, updateUserfavorites } from "../Control/Usercontrol.js";
import { protectUser } from "../Middleware/Auth.js";

const userRouter = express.Router();

userRouter.get('/userbookings', protectUser, getUserbookings);
userRouter.post('/updatefavorites', protectUser, updateUserfavorites);
userRouter.get('/getfavorites', protectUser, getfavorites);

export default userRouter;
