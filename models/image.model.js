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
    tags: [String],
    person: String,
    isFavorite: Boolean,
    comments: [String],
    size: String,
}, { timestamps: true });

const Image = mongoose.model("Image", imageSchema);
module.exports = { Image };