const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { User } = require("./models/user.model");
const { Album } = require("./models/album.model");
const { Image } = require("./models/image.model");
const { verifyAccessToken, verifyJWT } = require("./middleware");
const { initializeDatabase } = require("./db.connect");
require("dotenv").config();

const app = express();
app.use(cors({
    credentials: true,
    origin: "*"
}));
app.use(express.json());
app.use(cookieParser());

initializeDatabase();

// const JWT_SECRET = "kaviospix";

const storage = multer.diskStorage({});
const upload = multer({ storage });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

const PORT = process.env.PORT || 3000;

app.get("/user/profile/google", async (req, res) => {
    try {
        const { access_token } = req.body;
        const googleUserDataResponse = await axios.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            {
                headers: {
                    Authorization: `Bearer ${access_token}`
                }
            }
        )
        // issue a JWT upon successful authentication
        const googleUserData = googleUserDataResponse?.data
        // console.log("googleUserDataResponse", googleUserDataResponse);
        let user = await User.findOne({ email: googleUserData.email });
        if (!user) {
            user = new User({ email: googleUserData.email });
            await user.save();
        }
        // console.log("user", user);
        const token = jwt.sign({ _id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "24h" });
        console.log("token", token);
        // Use JWT for all subsequent API requests to ensure authentication.
        res.status(200).json({ user: googleUserDataResponse.data });
    } catch (error) {
        console.log("Error", error)
        res.status(500).json({ error: "Could not fetch user google profile "});
    }
})

app.get("/auth/google", (req, res) => {
    const googleAuthUrl = `http://accounts.google.com/o/oauth2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=http://localhost:${PORT}/auth/google/callback&response_type=code&scope=profile email`;
    res.redirect(googleAuthUrl);
})

app.get("/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).json({ message: "Authorization code is required" });
    }
    let accessToken;
    try {
        const tokenResponse = await axios.post(
            'https://oauth2.googleapis.com/token',
            {
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                code,
                grant_type: "authorization_code",
                redirect_uri: `http://localhost:${PORT}/auth/google/callback`
            },
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        )
        accessToken = tokenResponse.data.access_token;
        // console.log("accessToken", accessToken);   
        res.cookie("access_token", accessToken, {
            httpOnly: true,
            maxAge: 60 * 1000,
        });
        res.redirect(`${process.env.FRONTEND_URL}/v2/profile/google`)
    } catch (error) {
        console.error(error);
    }
})

app.post("/albums", verifyJWT, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ message: "Name is required" })
        }
        const album = new Album({
            name,
            description,
            ownerId: req.user._id,
        })
        await album.save();
        res.status(201).json({ message: "Album created successfully", album });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" })
    }
})

app.put("/albums/:albumId", verifyJWT, async (req, res) => {
    try {
        const { albumId } = req.params;
        const { description } = req.body;
        const album = await Album.findOneAndUpdate(
            { _id: albumId, ownerId: req.user._id },
            { description },
            { new: true }
        )
        if (!album) {
            return res.status(404).json({ message: "Album not found or Access Denied" });
        }
        res.status(201).json({ message: "Album description updated successfully", album });
    } catch (error) {
        console.log("Error", error);
        res.status(500).json({ message: "Internal Server Error" })
    }
})

app.post("/albums/:albumId/share", verifyJWT, async (req, res) => {
    try {
        const { albumId } = req.params;
        const { emails } = req.body;
        const users = await User.find({ email: { $in: emails }});
        const existingEmails = users.map(user => user.email);
        const missingEmails = emails.filter(email => !existingEmails.includes(email));

        if (missingEmails.length > 0) {
            return res.status(404).json({ message: `User with email ${missingEmails} does not exists` });
        }

        const album = await Album.findOneAndUpdate(
            { _id: albumId, ownerId: req.user._id },
            { sharedWith: emails },
            { new: true }
        )
        if (!album) {
            return res.status(404).json({ message: "Album not found or Access Denied" });
        }
        res.status(200).json({ message: "Album shared successfully", album });
    } catch (error) {
        console.log("Error", error);
        res.status(500).json({ message: "Internal Server Error" })
    }
})

app.delete("/albums/:albumId", verifyJWT, async (req, res) => {
    try {
        // Ensure only the owner of the album can delete it.
        const { albumId } = req.params;
        const album = await Album.findOneAndDelete({ _id: albumId, ownerId: req.user._id });
        if (!album) {
            return res.status(404).json({ message: "Album not found or Access Denied" });
        }
        await Image.deleteMany({ albumId });
        res.status(200).json({ message: "Album & it's images deleted successfully", album });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
})

app.post("/albums/:albumId/images", upload.single("image"), verifyJWT, async (req, res) => {
    try {
        const { albumId } = req.params;
        const file = req.file;
        if (!albumId) {
            return res.status(400).json({ message: "Album ID is required" });
        }
        if (!file) {
            return res.status(400).json({ message: "No file uploaded" });
        }
        if (!["jpg", "png", "gif"].includes(path.extname(file.originalname).slice(1))) {
            return res.status(400).json({ message: "Invalid file type" });
        }
        if (fs.statSync(file.path).size > 5 * 1024 * 1024) {
            return res.status(400).json({ message: "File size limit exceeded (5MB)" });
        }
        const album = await Album.findById(albumId);
        if (!album) {
            return res.status(404).json({ message: "Album not found" });
        }
        if (req.user._id.toString() !== album.ownerId.toString()) {
            return res.status(403).json({ message: "Access denied" });
        }
        // upload to cloudinary
        const result = await cloudinary.uploader.upload(file.path, { folder: "uploads" });
        const { tags, person, isFavorite } = req.body;
        const image = new Image({
            albumId,
            name: file.originalname,
            imageUrl: result.secure_url,
            tags,
            person,
            isFavorite,
        })
        await image.save();
        res.status(201).json({ message: "Image uploaded successfully", image });
    } catch (error) {
        console.log("Error", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
})

app.put("/albums/:albumId/images/:imageId/favorite", verifyJWT, async (req, res) => {
    try {
        const { albumId, imageId } = req.params;
        const { isFavorite } = req.body;
        if (!albumId) {
            return res.status(400).json({ message: "Album ID is required" });
        }
        const album = await Album.findById(albumId);
        if (!album) {
            return res.status(404).json({ message: "Album not found" });
        }
        if (req.user._id.toString() !== album.ownerId.toString()) {
            return res.status(403).json({ message: "Access denied" });
        }
        if (!imageId) {
            return res.status(400).json({ message: "Image ID is required" });
        }
        const image = await Image.findByIdAndUpdate(imageId, { isFavorite }, { new: true });
        res.status(200).json({ message: "Image favorite status updated successfully", image });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
})

app.post("/albums/:albumId/images/:imageId/comments", verifyJWT, async (req, res) => {
    try {
        const { albumId, imageId } = req.params;
        const { comment } = req.body;
        const image = await Image.findByIdAndUpdate(
            imageId,
            { $push: { comments: comment }},
            { new: true }
        )
        if (!image) {
            return res.status(404).json({ message: "Image not found" });
        }
        res.status(200).json({ message: "Comment added successfully", image });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
})

app.delete("/albums/:albumId/images/:imageId", verifyJWT, async (req, res) => {
    try {
        const { albumId, imageId } = req.params;
        const album = await Album.findById(albumId);
        if (req.user._id !== album.ownerId) {
            return res.status(403).json({ message: "Access denied" });
        }
        const image = await Image.findByIdAndDelete(imageId);
        if (!image) {
            return res.status(404).json({ message: "Image not found" });
        }
        res.status(200).json({ message: "Image deleted successfully", image });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
})

app.get("/albums", verifyJWT, async (req, res) => {
    try {
        const albums = await Album.find();
        res.status(200).json({ message: "Albums fetched successfully", albums });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
})

app.get("/albums/:albumId/images", verifyJWT, async (req, res) => {
    try {
        const { albumId } = req.params;
        const album = await Album.findById(albumId);
        if (!album) {
            return res.status(404).json({ message: "Album not found" });
        }
        if (!album.sharedWith.includes(req.user.email)) {
            return res.status(403).json({ message: "Access denied" });
        }
        const images = await Image.find({ albumId });
        res.status(200).json({ message: "Images fetched successfully", images });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
})

app.get("/albums/:albumId/images/favorites", verifyJWT, async (req, res) => {
    try {
        const { albumId } = req.params;
        const images = await Image.find({ albumId, isFavorite: true });
        res.status(200).json({ message: "Images fetched successfully", images });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
})

app.get("/albums/:albumId/images", verifyJWT, async (req, res) => {
    try {
        const { albumId } = req.params;
        const { tags } = req.query;
        const images = await Image.find({ albumId, tags });
        res.status(200).json({ message: "Images fetched successfully", images });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
})

app.listen(PORT, () => {
    console.log(`Server is running on PORT: ${PORT}`);
})