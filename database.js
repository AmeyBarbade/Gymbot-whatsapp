const mongoose = require('mongoose');

// Connect to MongoDB using the URI from your .env file
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error('Database connection failed:', err.message);
        process.exit(1);
    }
};

// ==========================================
// THE BLUEPRINT: Stores your 5-Day Split
// ==========================================
const routineSchema = new mongoose.Schema({
    dayId: String,       // e.g., "Friday"
    dayName: String,     // e.g., "Push 2 (Tricep Priority)"
    exercises: [
        {
            id: String,      // e.g., "ex_skullcrushers"
            name: String     // e.g., "Lying DB Skullcrushers"
        }
    ]
});

// ==========================================
// THE DAILY LOG: Tracks your active session
// ==========================================
const workoutSessionSchema = new mongoose.Schema({
    userPhone: String,
    date: { type: Date, default: Date.now },
    routineName: String,
    
    // State Machine Trackers
    isCompleted: { type: Boolean, default: false },
    activeExercise: { type: String, default: null }, // Remembers what you tapped
    
    // The Dynamic Checklist
    pendingExercises: [{ id: String, name: String }],
    
    // The actual sets you pushed
    completedExercises: [
        {
            exerciseId: String,
            exerciseName: String,
            sets: [
                { weight: Number, reps: Number }
            ]
        }
    ]
});

module.exports = {
    connectDB,
    Routine: mongoose.model('Routine', routineSchema),
    WorkoutSession: mongoose.model('WorkoutSession', workoutSessionSchema)
};