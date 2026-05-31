const mongoose = require("mongoose");

const albumSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: String,
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    sharedWith: [String],
}, { timestamps: true });

const Album = mongoose.model("Album", albumSchema);
module.exports = { Album };