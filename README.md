🎙️ Speech-to-Text Backend API

This is the backend service for the Speech-to-Text Application, built with Node.js, Express, Supabase, and Deepgram API.
It provides endpoints for audio upload, real-time audio chunk processing, and transcription storage.
🚀 Features

    🎧 Upload audio files for transcription

    🎤 Record and stream chunks in real-time

    🧠 Integration with Deepgram API for accurate transcriptions

    🗄️ Save and fetch transcription history using Supabase Database

    🧩 RESTful API structure for seamless frontend integration

    ⚙️ Deployment-ready with error handling and environment validation

🧰 Tech Stack
Technology	Purpose
Node.js + Express	Server + API Framework
Deepgram SDK	Audio transcription
Supabase	Authentication + Database
Multer	File upload handling
FFmpeg	Audio conversion (WebM → MP3)
CORS	Cross-origin access for frontend integration
⚙️ Environment Setup

Create a .env file in your backend root directory and add the following:

bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DEEPGRAM_API_KEY=your_deepgram_api_key
PORT=5000

🏗️ Installation & Run
1️⃣ Clone repository

bash
git clone https://github.com/your-username/Speech-to-text-backend.git
cd Speech-to-text-backend

2️⃣ Install dependencies

bash
npm install

3️⃣ Start server (Development)

bash
npm run dev

Or production:

bash
npm start

The backend will be available at http://localhost:5000
📡 Available API Endpoints
Method	Endpoint	Description
POST	/upload	Uploads audio for transcription
POST	/upload-chunk	Sends audio chunks during real-time recording
POST	/stop-recording	Finalizes recording and transcribes saved audio
GET	/transcriptions	Fetches all stored transcriptions
DELETE	/transcriptions/:id	Deletes a specific transcription
🧠 How It Works

    Frontend uploads audio or streams chunks while recording.

    Backend processes file using FFmpeg for conversion (if WebM).

    Deepgram API transcribes the processed audio.

    Supabase stores transcription text with relevant metadata.

    User retrieves history through /transcriptions.

📁 Project Structure

text
backend/
│
├── uploads/                # Temporary audio storage
├── server.js               # Main backend entry point
├── package.json            # Dependencies
├── .env                    # Environment variables
└── README.md               # Documentation

⚠️ Notes

    Ensure your Supabase Service Role Key is never exposed to the frontend.

    Uploaded files are automatically cleaned up post-processing.

    Verify Deepgram and Supabase credentials before deployment.

☁️ Deployment Guide
Using Render / Railway / Vercel

    Push your code to GitHub.

    Connect your backend repo to your hosting service.

    Add all environment variables in their dashboard.

    Deploy and test the live API.
