const jwt = require("jsonwebtoken");

function verifyAccessToken(req, res, next) {
    if (!req.cookies.access_token) {
        return res.status(403).json({ message: "Access denied" });
    }
    next();
}

const verifyJWT = async (req, res, next) => {
    const token = req.headers["authorization"]?.split(" ")[1];
    console.log("token:", token);
    if (!token) {
        return res.status(401).json({ message: "No token provided" })
    }
    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET)
        console.log("decodedToken", decodedToken);
        req.user = decodedToken
        next()
    } catch (error) {
        console.log("Error while verifying token", error)
        return res.status(401).json({ message: "Invalid token provided" })
    }
}

module.exports = { verifyAccessToken, verifyJWT };