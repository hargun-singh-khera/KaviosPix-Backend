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
    origin: process.env.FRONTEND_URL
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

app.get("/", (req, res) => {
    res.status(200).json({ message: "Welcome to Kaviospix API" });
})

app.get("/user/profile/google", verifyAccessToken, async (req, res) => {
    try {
        // console.log("req.cookies", req.cookies)
        const { access_token } = req.cookies;
        const googleUserDataResponse = await axios.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            {
                headers: {
                    Authorization: `Bearer ${access_token}`
                }
            }
        )
        // console.log("googleUserDataResponse", googleUserDataResponse?.data);
        // issue a JWT upon successful authentication
        const googleUserData = googleUserDataResponse?.data
        let user = await User.findOne({ email: googleUserData.email });
        if (!user) {
            user = new User({ name: googleUserData.name, avatar: googleUserData.picture, email: googleUserData.email });
            await user.save();
        }
        // console.log("user", user);
        const token = jwt.sign({ _id: user._id, name: googleUserData.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: "24h" });
        // console.log("token", token);
        // Use JWT for all subsequent API requests to ensure authentication.
        res.status(200).json({ user: googleUserDataResponse.data, token });
    } catch (error) {
        console.log("Error", error)
        res.status(500).json({ error: "Could not fetch user google profile " });
    }
})

app.get("/auth/google", (req, res) => {
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=https://kavios-pix-backend-pied.vercel.app/auth/google/callback&response_type=code&scope=profile email`;
    // const googleAuthUrl = `http://accounts.google.com/o/oauth2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=http://localhost:${PORT}/auth/google/callback&response_type=code&scope=profile email`;
    res.redirect(googleAuthUrl);
})

app.get("/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).json({ message: "Authorization code is required" });
    }
    let accessToken;
    try {
        console.log("auth callback")
        const tokenResponse = await axios.post(
            'https://oauth2.googleapis.com/token',
            {
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                code,
                grant_type: "authorization_code",
                redirect_uri: `https://kavios-pix-backend-pied.vercel.app/auth/google/callback`
                // redirect_uri: `http://localhost:${PORT}/auth/google/callback`
            },
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        )
        accessToken = tokenResponse.data.access_token;
        console.log("process.env.FRONTEND_URL", process.env.FRONTEND_URL);
        // console.log("accessToken", accessToken);   
        res.cookie("access_token", accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 24 * 60 * 60 * 1000
        });
        res.redirect(`${process.env.FRONTEND_URL}/dashboard`)
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
        const { name, description } = req.body;
        const album = await Album.findOneAndUpdate(
            { _id: albumId, ownerId: req.user._id },
            { name, description },
            { new: true }
        )
        if (!album) {
            return res.status(404).json({ message: "Album not found or Access Denied" });
        }
        const images = await Image.find({ albumId: album._id });
        const modifiedAlbum = { ...album.toObject(), thumbnail: images[0]?.imageUrl, imagesCount: images.length };
        res.status(201).json({ message: "Album description updated successfully", album: modifiedAlbum });
    } catch (error) {
        console.log("Error", error);
        res.status(500).json({ message: "Internal Server Error" })
    }
})

app.post("/albums/:albumId/share", verifyJWT, async (req, res) => {
    try {
        const { albumId } = req.params;
        const { emails } = req.body;
        const users = await User.find({ email: { $in: emails } });
        const existingEmails = users.map(user => user.email);
        const missingEmails = emails.filter(email => !existingEmails.includes(email));

        if (missingEmails.length > 0) {
            return res.status(404).json({ message: `User with email ${missingEmails.join(", ")} does not exists` });
        }

        const album = await Album.findOneAndUpdate(
            { _id: albumId, ownerId: req.user._id },
            { $addToSet: { sharedWith: { $each: emails } } },
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
        const album = await Album.findOne({ _id: albumId });
        if (!album) {
            return res.status(404).json({ message: "Album not found" });
        }
        if (album.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied" });
        }
        await Album.deleteOne({ _id: albumId });
        await Image.deleteMany({ albumId });
        res.status(200).json({ message: "Album & it's images deleted successfully", album });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
})

app.post("/albums/:albumId/images", verifyJWT, upload.single("image"), async (req, res) => {
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
            return res.status(400).json({ message: "Invalid file type. Only JPG, PNG, and GIF files are allowed" });
        }
        const imageSize = fs.statSync(file.path).size;
        if (imageSize > 5 * 1024 * 1024) {
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
        const { tags, person } = req.body;
        const image = new Image({
            albumId,
            name: file.originalname,
            imageUrl: result.secure_url,
            tags,
            person,
            isFavorite: false,
            size: imageSize,
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
            {
                $push: {
                    comments: {
                        user: req.user._id,
                        comment,
                        createdAt: Date.now(),
                    }
                }
            },
            { new: true }
        ).populate("comments.user");
        if (!image) {
            return res.status(404).json({ message: "Image not found" });
        }
        res.status(200).json({ message: "Comment added successfully", comment: image.comments[image.comments.length - 1] });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
})

app.delete("/albums/:albumId/images/:imageId", verifyJWT, async (req, res) => {
    try {
        const { albumId, imageId } = req.params;
        const album = await Album.findById(albumId);
        if (req.user._id.toString() !== album.ownerId.toString()) {
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

        const sharedAlbums = albums
            .filter(album => album.sharedWith.includes(req.user.email.toLowerCase()))
            .map(album => ({ ...album.toObject(), isShared: true }));
        const ownedAlbums = albums
            .filter(album => album.ownerId.toString() === req.user._id.toString())
            .map(album => ({ ...album.toObject(), isShared: false }));

        const albumsCombined = [...sharedAlbums, ...ownedAlbums];
        const modifiedAlbums = [];

        for (const album of albumsCombined) {
            const images = await Image.find({ albumId: album._id })
            const modifiedAlbum = { ...album, thumbnail: images[0]?.imageUrl, imagesCount: images.length };
            modifiedAlbums.push(modifiedAlbum);
        }
        res.status(200).json({ message: "Albums fetched successfully", albums: modifiedAlbums });
    } catch (error) {
        console.error("Error", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
})

app.get("/albums/:albumId/images", verifyJWT, async (req, res) => {
    try {
        const { albumId } = req.params;
        const { tags } = req.query;
        const album = await Album.findById(albumId);
        if (!album) {
            return res.status(404).json({ message: "Album not found" });
        }
        const query = { albumId };
        if (tags) query.tags = { $in: [tags] };
        const images = await Image.find(query).populate("comments.user");
        res.status(200).json({ message: "Images fetched successfully", album, images });
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


app.get("/users", verifyJWT, async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user._id } });
        res.status(200).json({ message: "Users fetched successfully", users });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
})

app.listen(PORT, () => {
    console.log(`Server is running on PORT: ${PORT}`);
})