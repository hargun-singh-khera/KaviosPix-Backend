const mongoose = require("mongoose");

const imageSchema = mongoose.Schema({
    albumId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Album",
    },
    name: {
        type: String,
        required: true
    },
    imageUrl: String,
    tags: [{
        type: String,
        lowercase: true
    }],
    person: String,
    isFavorite: Boolean,
    comments: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            comment: String,
            createdAt: Date,
        }
    ],
    size: String,
}, { timestamps: true });

const Image = mongoose.model("Image", imageSchema);
module.exports = { Image };