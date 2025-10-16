require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
const { createClient: createDeepgramClient } = require("@deepgram/sdk");
const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);
const { createReadStream } = require("fs");

const app = express();

const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DEEPGRAM_API_KEY"];
requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    console.error(`⚠️ Missing environment variable: ${key}`);
    process.exit(1);
  }
});

app.use(cors());
app.use(express.json());

// Use /tmp for temp uploads on Vercel
const uploadsDir = "/tmp";

const upload = multer({ dest: uploadsDir, limits: { fileSize: 50 * 1024 * 1024 } });

const tempWebmPath = path.join(uploadsDir, "live_recording.webm");
const mp3OutputPath = path.join(uploadsDir, "final_recording.mp3");

const supabase = createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const deepgram = createDeepgramClient(process.env.DEEPGRAM_API_KEY);

// Async handler middleware
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

async function saveTranscription(req, transcriptionText, audioUrl = null) {
  const userId = req.headers["x-user-id"];
  if (!userId) throw new Error("Missing user_id in request");

  const { data, error } = await supabase
    .from("auth.users")
    .select()
    .eq("id", userId)
    .single();

  if (error || !data) {
    console.warn(`User with ID ${userId} does not exist, saving without association.`);
    return await supabase.from("transcriptions").insert([
      { transcription: transcriptionText, audio_url: audioUrl, user_id: null },
    ]);
  }

  const { data: insertData, error: insertError } = await supabase.from("transcriptions").insert([
    { transcription: transcriptionText, audio_url: audioUrl, user_id: userId },
  ]);

  if (insertError) throw insertError;

  return insertData;
}

app.post(
  "/upload",
  upload.single("audio"),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No audio file uploaded" });

    const filePath = req.file.path;

    try {
      const response = await deepgram.listen.prerecorded.transcribeFile(createReadStream(filePath), {
        punctuate: true,
        language: "en-US",
      });

      if (response.error) throw new Error(response.error);

      const channels = response.result?.results?.channels;
      if (!channels || channels.length === 0) throw new Error("No transcription channels found.");

      const transcription = channels[0].alternatives[0].transcript;

      await saveTranscription(req, transcription, null);

      res.json({ transcription });
    } finally {
      fs.unlink(filePath, (err) => {
        if (err) console.warn("Failed to remove uploaded file:", err);
      });
    }
  })
);

app.post(
  "/upload-chunk",
  upload.single("chunk"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new Error("No chunk file uploaded");

    const chunkFilePath = req.file.path;
    const chunkData = fs.readFileSync(chunkFilePath);

    fs.appendFileSync(tempWebmPath, chunkData);

    fs.unlinkSync(chunkFilePath);

    res.json({ message: "Chunk received and appended" });
  })
);

app.post(
  "/stop-recording",
  asyncHandler(async (req, res) => {
    if (!fs.existsSync(tempWebmPath)) {
      return res.status(400).json({ error: "No recording found to convert" });
    }

    ffmpeg(tempWebmPath)
      .format("mp3")
      .on("end", async () => {
        fs.unlinkSync(tempWebmPath);

        try {
          const dgResponse = await deepgram.listen.prerecorded.transcribeFile(createReadStream(mp3OutputPath), {
            punctuate: true,
            language: "en-US",
          });

          if (dgResponse.error) throw new Error(dgResponse.error);

          const channels = dgResponse.result?.results?.channels;
          if (!channels || channels.length === 0) throw new Error("No transcription channels found.");

          const transcription = channels[0].alternatives[0].transcript;

          await saveTranscription(req, transcription);

          // Clean mp3 temp file after response
          fs.unlink(mp3OutputPath, (err) => {
            if (err) console.warn("Failed to remove mp3 file:", err);
          });

          res.json({ mp3: "/uploads/final_recording.mp3", transcription });
        } catch (err) {
          console.error("Transcription error:", err);
          res.status(500).json({ error: err.message });
        }
      })
      .on("error", (err) => {
        console.error("Conversion error:", err);
        res.status(500).json({ error: "MP3 conversion failed" });
      })
      .save(mp3OutputPath);
  })
);

app.get(
  "/transcriptions",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase.from("transcriptions").select().order("created_at", { ascending: false });
    if (error) {
      console.error("Error fetching transcriptions:", error);
      return res.status(500).json({ error: "Failed to fetch transcriptions" });
    }
    res.json(data);
  })
);

app.delete(
  "/transcriptions/:id",
  asyncHandler(async (req, res) => {
    const transcriptionId = req.params.id;
    const { error } = await supabase.from("transcriptions").delete().eq("id", transcriptionId);
    if (error) {
      console.error("Error deleting transcription:", error);
      return res.status(500).json({ error: "Failed to delete transcription" });
    }
    res.json({ message: "Transcription deleted successfully" });
  })
);

app.use("/uploads", express.static(uploadsDir));

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
