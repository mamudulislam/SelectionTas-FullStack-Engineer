# SelectionTas - FullStack Engineer Project

## Overview
A social media web application built with a Next.js frontend and NestJS backend, featuring user authentication, post creation, and social interactions (likes, comments, replies).

## Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **Supabase Client** - For additional Supabase integration
- **Axios** - HTTP client
- **js-cookie** - Cookie management for auth tokens

### Backend
- **NestJS** - Node.js framework
- **TypeORM** - Database ORM
- **MongoDB** - Primary database (via Mongoose + TypeORM hybrid)
- **Passport JWT** - Authentication
- **Multer** - File uploads (images)
- **Winston** - Logging

## Architecture

### API Endpoints

**Auth (`/auth`)**
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Token refresh
- `POST /auth/logout` - User logout
- `GET /auth/me` - Get current user profile

**Posts (`/posts`)**
- `GET /posts` - Get paginated feed
- `POST /posts` - Create post (with optional image)
- `DELETE /:postId` - Delete post (ownership guard)
- `POST /:postId/like` - Like a post
- `POST /:postId/unlike` - Unlike a post
- `POST /:postId/comments` - Add comment
- `GET /:postId/comments` - Get post comments
- `POST /:postId/comments/:commentId/replies` - Add reply
- `GET /:postId/comments/:commentId/replies` - Get comment replies

## Key Design Decisions

1. **Hybrid Database Approach**: Used both MongoDB (via Mongoose) and PostgreSQL (via TypeORM) - this is a transitional architecture pattern.

2. **JWT Authentication**: Stateless JWT-based auth with access/refresh token pattern.

3. **Ownership Guard**: Custom guard to ensure users can only delete their own posts.

4. **File Upload**: Local disk storage with Multer, limited to 5MB images.

5. **Pagination**: Server-side pagination with configurable page size (max 100).

6. **Privacy Levels**: Posts support privacy settings (public/private).

## Running the Application

### Backend
```bash
cd backend
npm install
npm run start:dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Backend requires:
- `MONGODB_URI` - MongoDB connection
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` - PostgreSQL connection
- `JWT_SECRET` - JWT signing secret
- `BACKEND_URL` - Backend URL for file URLs

Frontend requires Supabase configuration in `lib/supabase.ts`.
