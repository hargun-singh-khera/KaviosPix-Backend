# Albumix Backend

Albumix Backend is the REST API service for the Albumix photo management application. It provides Google authentication, album management, image uploads, favorites, comments, album sharing, and user management for the Albumix frontend.

Built with Node.js, Express.js, MongoDB, Mongoose, JWT authentication, Google OAuth, Cloudinary, and Multer.

---

## Demo Link

Backend API: `https://albumix-backend-pied.vercel.app/`

Frontend Repository: `https://albumix-omega.vercel.app/`

---

## Authentication

Albumix uses **Google OAuth 2.0** for authentication.

After successful Google authentication, the backend generates a JWT token.

All protected routes require the token to be sent in the request headers.

```http
Authorization: <token>
```

---

## Quick Start

```bash
git clone https://github.com/your-username/Albumix-Backend.git

cd Albumix-Backend

npm install

npm run dev
```

---

## Environment Variables

Create a `.env` file in the project root.

```env
PORT=3000

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
```

Never commit production credentials or secrets to GitHub.

---

## Technologies

* Node.js
* Express.js
* MongoDB
* Mongoose
* Google OAuth 2.0
* JSON Web Token (JWT)
* Cloudinary
* Multer
* Axios
* Cookie Parser
* CORS

---

# Features

## Authentication

* Google OAuth login
* JWT authentication
* Protected routes
* Secure cookie-based Google access token
* Automatic user registration on first login

## Albums

* Create albums
* Update album information
* Delete albums
* View owned albums
* View albums shared with the user
* Album thumbnails
* Image count per album

## Images

* Upload images
* Cloudinary image storage
* Delete images
* Mark images as favorite
* Filter images using tags
* Store image metadata
* Store upload size

## Sharing

* Share albums with registered users
* Email-based sharing
* Prevent sharing with non-existing users

## Comments

* Add comments to images
* View comments with user information
* Timestamped comments

## Users

* Automatic account creation after Google login
* Fetch all registered users
* Exclude currently logged-in user

---

# API Reference

Base URL

```bash
https://albumix-backend-pied.vercel.app
```

For local development

```bash
http://localhost:<PORT>
```

---

# Health Check

## GET /

Returns API status.

Sample Response

```json
{
  "message": "Welcome to Albumix API"
}
```

---

# Authentication Routes

## GET /auth/google

Redirects the user to Google's OAuth login page.

Protected: No

---

## GET /auth/google/callback

Handles Google's callback.

Protected: No

On success

* Exchanges authorization code
* Creates user if not already registered
* Sets Google access token cookie
* Redirects to frontend

---

## GET /user/profile/google

Returns authenticated Google profile and issues JWT.

Protected: Google Access Token

Sample Response

```json
{
  "user": {
    "name": "John Doe",
    "email": "john@example.com",
    "picture": "profile_image"
  },
  "token": "jwt_token"
}
```

---

# User Routes

## GET /users

Returns all registered users except the current user.

Protected: Yes

Sample Response

```json
{
  "message": "Users fetched successfully",
  "users": []
}
```

---

# Album Routes

## GET /albums

Returns

* Owned albums
* Shared albums
* Thumbnail image
* Image count

Protected: Yes

Sample Response

```json
{
  "message": "Albums fetched successfully",
  "albums": []
}
```

---

## POST /albums

Create a new album.

Protected: Yes

Sample Request

```json
{
  "name": "Vacation",
  "description": "Trip to Goa"
}
```

Sample Response

```json
{
  "message": "Album created successfully",
  "album": {
    "_id": "album_id",
    "name": "Vacation",
    "description": "Trip to Goa"
  }
}
```

---

## PUT /albums/:albumId

Update album details.

Protected: Yes

Sample Request

```json
{
  "name": "Vacation 2025",
  "description": "Family Trip"
}
```

Sample Response

```json
{
  "message": "Album description updated successfully",
  "album": {}
}
```

---

## DELETE /albums/:albumId

Delete an album and all associated images.

Protected: Yes

Sample Response

```json
{
  "message": "Album & its images deleted successfully"
}
```

---

## POST /albums/:albumId/share

Share an album with registered users.

Protected: Yes

Sample Request

```json
{
  "emails": [
    "john@example.com",
    "jane@example.com"
  ]
}
```

Sample Response

```json
{
  "message": "Album shared successfully",
  "album": {}
}
```

---

# Image Routes

## GET /albums/:albumId/images

Fetch all images belonging to an album.

Supports optional tag filtering.

Protected: Yes

Example

```http
GET /albums/:albumId/images?tags=travel
```

Sample Response

```json
{
  "message": "Images fetched successfully",
  "album": {},
  "images": []
}
```

---

## GET /albums/:albumId/images/favorites

Fetch all favorite images from an album.

Protected: Yes

Sample Response

```json
{
  "message": "Images fetched successfully",
  "images": []
}
```

---

## POST /albums/:albumId/images

Upload a new image.

Protected: Yes

Content-Type

```
multipart/form-data
```

Fields

| Field  | Type   |
| ------ | ------ |
| image  | File   |
| tags   | Array  |
| person | String |

Restrictions

* JPG
* PNG
* GIF
* Maximum size 5 MB

Sample Response

```json
{
  "message": "Image uploaded successfully",
  "image": {}
}
```

---

## PUT /albums/:albumId/images/:imageId/favorite

Update favorite status.

Protected: Yes

Sample Request

```json
{
  "isFavorite": true
}
```

Sample Response

```json
{
  "message": "Image favorite status updated successfully",
  "image": {}
}
```

---

## DELETE /albums/:albumId/images/:imageId

Delete an image.

Protected: Yes

Sample Response

```json
{
  "message": "Image deleted successfully"
}
```

---

# Comment Routes

## POST /albums/:albumId/images/:imageId/comments

Add a comment to an image.

Protected: Yes

Sample Request

```json
{
  "comment": "Beautiful picture!"
}
```

Sample Response

```json
{
  "message": "Comment added successfully",
  "comment": {
    "comment": "Beautiful picture!"
  }
}
```

---

# Data Models

## User

| Field  | Type   |
| ------ | ------ |
| name   | String |
| avatar | String |
| email  | String |

---

## Album

| Field       | Type          |
| ----------- | ------------- |
| name        | String        |
| description | String        |
| ownerId     | ObjectId      |
| sharedWith  | Array<String> |

---

## Image

| Field      | Type          |
| ---------- | ------------- |
| albumId    | ObjectId      |
| name       | String        |
| imageUrl   | String        |
| tags       | Array<String> |
| person     | String        |
| isFavorite | Boolean       |
| comments   | Array         |
| size       | String        |
| createdAt  | Date          |
| updatedAt  | Date          |

---

# Folder Structure

```
Albumix-Backend
│
├── models
├── middleware
├── routes (if separated)
├── db.connect.js
├── index.js
├── package.json
├── .env
└── README.md
```

---

# Security

* Google OAuth authentication
* JWT-based authorization
* Protected API routes
* Owner-only album modification
* Owner-only image upload
* Owner-only image deletion
* Owner-only album deletion
* Shared album access control
* File type validation
* File size validation

---

# Contact

For bugs, improvements, or feature requests, please reach out to hargunsinghkhera8@gmail.com.
