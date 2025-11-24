# RecipeForum - Recipe Sharing Platform

A mobile recipe sharing platform built with React Native and Expo, featuring AI-powered content validation, intelligent shopping cart with package calculations, and a hybrid SQL/NoSQL database architecture.

## Features

- **Recipe Management**: Create, edit, share, and discover recipes
- **AI Content Validation**: Google Gemini AI for spam detection and unit validation
- **Smart Shopping Cart**: Automatic package quantity calculations
- **Nutritional Analysis**: AI-powered nutrition calculation with caching
- **Voting System**: Upvote/downvote recipes with gamified points
- **Order Tracking**: Full lifecycle from cart to delivery
- **Image Uploads**: Cloudinary integration with asynchronous processing
- **Cross-Database Architecture**: PostgreSQL + MongoDB hybrid system

## Tech Stack

**Frontend:**
- React Native + Expo
- TypeScript
- React Navigation

**Backend:**
- Node.js + Express
- PostgreSQL (users, orders, ingredients, shopping carts)
- MongoDB (recipes with embedded data)
- Google Gemini AI (content validation, nutrition)
- Cloudinary (image hosting)
- Nodemailer (email notifications)

## Getting Started

### Prerequisites

- Node.js installed
- PostgreSQL database running
- MongoDB database running
- `.env` file configured in backend folder

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `backend/.env`:
   ```
   DATABASE_URL=your_postgresql_url
   PORT=3001

   MONGODB_URI=your_mongodb_url

   EMAIL_USER=your_email
   EMAIL_PASS=your_email_password
   EMAIL_FROM=your_email

   CLOUDINARY_CLOUD_NAME=your_cloudinary_name
   CLOUDINARY_API_KEY=your_cloudinary_key
   CLOUDINARY_API_SECRET=your_cloudinary_secret

   GEMINI_API_KEY=your_google_api_key

   NGROK_URL=your_ngrok_url
   ```

### Running the Application

**Step 1: Start Backend Server**
```bash
npm run backend
```

**Step 2: Start Ngrok**
```bash
cd backend
npx ngrok http 3001
```

**Step 3: Start Expo App**
```bash
npx expo start
```

Then scan the QR code with Expo Go app on your mobile device.

## Project Structure

```
├── app/                    # Expo app screens and routing
├── backend/                # Node.js backend server
├── components/             # React components
├── utils/                  # Utility functions (package calculation, image upload)
├── contexts/               # React contexts (cart, notifications)
├── config/                 # API configuration (auto-generated)
└── admin/                  # Admin dashboard pages
```

## APK Build

An Android production APK built with Expo Application Services (EAS) is included in the `apk/` folder at the project root. This file can be installed directly on compatible Android devices.

## Key Innovations

1. **Hybrid Database**: PostgreSQL + MongoDB working together
2. **AI Validation**: Smart spam detection and unit checking
3. **Package Calculation**: Converts recipe amounts to shopping quantities
4. **Async Image Upload**: Non-blocking with status tracking
5. **Cross-Database Sync**: Vote counts update user points across databases
6. **Auto Network Config**: Dynamic IP detection and config generation

## Performance Testing

See `PERFORMANCE_TESTING.md` for detailed testing instructions.

## Admin Dashboard

Access admin pages at:
- `http://localhost:3001/ingredients-manager`
- `http://localhost:3001/orders-manager`
