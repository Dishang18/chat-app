import express from 'express';
import User from '../models/User.js';

const userController = {
    async getAllUsers(req,res){
        try{
        const users = await User.find({},"username online")
        .limit(10)
        res.status(200).json(users);
        }
        catch(err){
            console.error(err);
            res.status(500).json({message:"Internal server error"});
        }
    }
}

export default userController;