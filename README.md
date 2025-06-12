# eLearning Platform

Welcome to the eLearning Platform, a comprehensive online learning management system designed to facilitate courses, user management, and interactive learning experiences.

## Features

- User authentication and authorization
- Course management
- Payment integration (Stripe)
- Real-time notifications
- File uploads (AWS S3)
- Email notifications
- Admin dashboard
- WebSocket support for real-time features

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v14 or higher)
- npm (Node Package Manager)
- MySQL database
- AWS S3 bucket (for file storage)
- Stripe account (for payments)
- Google OAuth credentials (for social login)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd eLearn
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory with the following variables:

```
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=90d
JWT_COOKIE_EXPIRES_IN=90

# Email Configuration
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASSWORD=your_email_password

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
AWS_BUCKET_NAME=your_bucket_name

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

### 4. Database Setup

1. Create a new MySQL database
2. Import the database schema (if available)
3. Update the database configuration in the `.env` file

### 5. Run the Application

#### Development Mode

```bash
npm run dev
```

This will start the development server with nodemon for automatic reloading.

#### Production Mode

```bash
npm start
```

### 6. Access the Application

The application will be available at:
- Frontend: `http://localhost:5173` Or if on production `https://yourDomain.com`
- Backend API: `http://localhost:3000` Or if on production `https://yourDomain.com`

## Project Structure

```
eLearn/
├── Config/           # Configuration files
├── Controllers/      # Request handlers
├── Models/           # Database models
├── Routes/           # API routes
├── Utils/            # Utility functions
├── public/           # Static files
├── websocket/        # WebSocket implementation
├── app.js            # Main application file
├── server.js         # Server entry point
└── package.json      # Project dependencies and scripts
```

## Available Scripts

- `npm start`: Start the production server
- `npm run dev`: Start the development server with nodemon

## Environment Variables

Make sure to set up all required environment variables in the `.env` file before running the application.

## Support

For any questions or issues, please contact the development team.

## License

This project is proprietary and confidential. All rights reserved.
