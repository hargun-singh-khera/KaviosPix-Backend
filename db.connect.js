const mongoose = require("mongoose");

const initializeDatabase = async () => {
    try {
        const connection = await mongoose.connect(process.env.MONGODB_URI);
        if (connection) {
            console.log("MongoDB Connected Successfully")
        }
    } catch (error) {
        console.log("Database connection failed", error);
    }
}

module.exports = { initializeDatabase }