const axios = require('axios');
const { WorkoutSession, Routine, CustomExercise } = require('./database');
const { getMuscleGroupList, getExerciseList, getPostSetMenu, getFinishMenu } = require('./whatsappMenus');

// ==========================================
// HELPER: Send message to WhatsApp via Meta API
// ==========================================
async function sendToWhatsApp(messagePayload) {
    try {
        const META_API_TOKEN = process.env.META_API_TOKEN?.trim();
        const META_PHONE_ID = process.env.META_PHONE_ID?.trim();
        
        console.log("Token starts with:", META_API_TOKEN?.substring(0, 5));

        const url = `https://graph.facebook.com/v18.0/${META_PHONE_ID}/messages`;

        const response = await axios.post(url, messagePayload, {
            headers: {
                'Authorization': `Bearer ${META_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log("✅ Message sent to WhatsApp:", response.data.messages[0].id);
        return response.data;
    } catch (error) {
        console.error("❌ Failed to send message:", error.response?.data || error.message);
        throw error;
    }
}

async function processMessage(userPhone, messageText, phone_number_id) {
    const text = messageText.trim().toLowerCase();
    
    // Find if you have a workout running right now
    let session = await WorkoutSession.findOne({ userPhone, isCompleted: false });

    // 0. CHECK IF WE ARE WAITING FOR A CUSTOM EXERCISE NAME
    if (session && session.state === 'ADDING_CUSTOM_EXERCISE') {
        const customExName = messageText.trim();
        
        if (customExName.toLowerCase() === 'cancel') {
            session.state = 'IDLE';
            session.targetMuscleGroup = null;
            await session.save();
            await sendToWhatsApp({
                messaging_product: "whatsapp",
                to: userPhone,
                type: "text",
                text: { body: "🚫 Canceled adding exercise." }
            });
            return;
        }

        // Save new custom exercise
        await new CustomExercise({
            userPhone,
            muscleGroup: session.targetMuscleGroup,
            name: customExName
        }).save();

        session.state = 'IDLE';
        const muscleAddedTo = session.targetMuscleGroup;
        session.targetMuscleGroup = null;
        await session.save();

        await sendToWhatsApp({
            messaging_product: "whatsapp",
            to: userPhone,
            type: "text",
            text: { body: `✅ Sweet! Added *${customExName}* to your ${muscleAddedTo.toUpperCase()} exercises.` }
        });

        // Show them the updated list for that muscle
        const customExs = await CustomExercise.find({ userPhone, muscleGroup: muscleAddedTo });
        await sendToWhatsApp(getExerciseList(userPhone, muscleAddedTo, customExs));
        return;
    }

    // 0.2. CHECK IF WE ARE WAITING FOR A COMMENT
    if (session && session.state === 'ADDING_COMMENT') {
        const commentText = messageText.trim();
        
        if (commentText.toLowerCase() === 'cancel') {
            session.state = 'IDLE';
            await session.save();
            await sendToWhatsApp({
                messaging_product: "whatsapp",
                to: userPhone,
                type: "text",
                text: { body: "🚫 Canceled adding comment." }
            });
            return;
        }

        // Append comment if one already exists, else set it
        session.comment = session.comment ? session.comment + "\n• " + commentText : "• " + commentText;
        session.state = 'IDLE';
        await session.save();

        await sendToWhatsApp({
            messaging_product: "whatsapp",
            to: userPhone,
            type: "text",
            text: { body: "✅ Got it! Your note has been added to this session." }
        });
        return;
    }

    // 0.5. ADD EXERCISE FLOW
    if (text === 'add exercise') {
        if (!session) {
            session = new WorkoutSession({ userPhone });
            await session.save();
        }
        
        await sendToWhatsApp(getMuscleGroupList(userPhone, true)); // Pass true to get addgroup_ callback
        return;
    }

    // 1. FINISH COMMAND: Pushes everything to MongoDB permanently
    if (text === 'finish') {
        if (session) {
            session.isCompleted = true;
            await session.save();
            await sendToWhatsApp(getFinishMenu(userPhone));
        } else {
            await sendToWhatsApp({
                messaging_product: "whatsapp",
                to: userPhone,
                type: "text",
                text: { body: "Bro, you don't have an active workout to finish! Send 'gym' to start." }
            });
        }
        return;
    }

    // 1.2. COMMENT COMMAND: Add notes to the active session
    if (text === 'comment') {
        if (!session) {
            await sendToWhatsApp({
                messaging_product: "whatsapp",
                to: userPhone,
                type: "text",
                text: { body: "Bro, you don't have an active workout to comment on! Send 'gym' to start." }
            });
            return;
        }

        session.state = 'ADDING_COMMENT';
        await session.save();

        await sendToWhatsApp({
            messaging_product: "whatsapp",
            to: userPhone,
            type: "text",
            text: { body: "📝 Tell me what's on your mind. (Notes on energy levels, injuries, mistakes, etc.)\n\n(Type 'cancel' to abort)" }
        });
        return;
    }

    // 1.5. VIEW COMMAND: Check recorded workouts for today or a specific date
    if (text.startsWith('view')) {
        let targetDate = new Date(); // Defaults to today
        const customDate = text.replace('view', '').trim();
        
        if (customDate) {
            // Very simple date parsing (e.g., '24 april'). Append current year if missing to help parser
            const hasYear = /\d{4}/.test(customDate);
            const dateToParse = hasYear ? customDate : `${customDate} ${new Date().getFullYear()}`;
            targetDate = new Date(dateToParse);
            
            if (isNaN(targetDate.getTime())) {
                await sendToWhatsApp({
                    messaging_product: "whatsapp",
                    to: userPhone,
                    type: "text",
                    text: { body: "📅 I couldn't understand that date. Try 'view' or 'view 24 april'." }
                });
                return;
            }
        }

        // Setup 24-hour range for the chosen date
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Fetch both Active and Completed workouts for the requested day
        const dayWorkouts = await WorkoutSession.find({
            userPhone,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        const displayDate = targetDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

        if (dayWorkouts.length === 0) {
            await sendToWhatsApp({
                messaging_product: "whatsapp",
                to: userPhone,
                type: "text",
                text: { body: `📉 Hmm, I couldn't find any workouts logged on *${displayDate}*.` }
            });
            return;
        }

        let report = `📊 *Workout Summary for ${displayDate}*\n`;
        let totalVolume = 0;

        dayWorkouts.forEach((w, index) => {
            const status = w.isCompleted ? 'Finished' : 'Active';
            const routine = w.routineName ? w.routineName.toUpperCase() : 'Custom';
            report += `\n*Session ${index + 1}: ${routine}* (${status})\n`;
            
            if (w.comment) {
                report += `💬 *Note:* \n${w.comment}\n\n`;
            }
            
            if (w.completedExercises && w.completedExercises.length > 0) {
                w.completedExercises.forEach(ex => {
                    report += `  💪 *${ex.exerciseName}*\n`;
                    let exVolume = 0;
                    
                    ex.sets.forEach((set, i) => {
                        report += `    Set ${i + 1}: ${set.weight}kg x ${set.reps} reps\n`;
                        exVolume += (set.weight * set.reps);
                    });
                    totalVolume += exVolume;
                });
            } else {
                report += `  (No sets recorded yet)\n`;
            }
        });

        if (totalVolume > 0) {
            report += `\n🔥 *Total Volume Lifted:* ${totalVolume.toFixed(1)}kg!`;
        }

        await sendToWhatsApp({
            messaging_product: "whatsapp",
            to: userPhone,
            type: "text",
            text: { body: report }
        });
        
        return;
    }

    // Trigger Muscle List
    if (text === 'gym' || text === 'btn_select_muscle') {
        await sendToWhatsApp(getMuscleGroupList(userPhone));
        return;
    }

    // 2. NAVIGATIONAL BUTTONS
    if (text === 'btn_add_set') {
        await sendToWhatsApp({
            messaging_product: "whatsapp",
            to: userPhone,
            type: "text",
            text: { body: `💪 Log more for ${session.activeExercise}:` }
        });
        return;
    }

    if (text === 'btn_select_ex') {
        if (session && session.routineName) {
            const customExs = await CustomExercise.find({ userPhone, muscleGroup: session.routineName });
            await sendToWhatsApp(getExerciseList(userPhone, session.routineName, customExs));
        } else {
            await sendToWhatsApp(getMuscleGroupList(userPhone));
        }
        return;
    }

    // Handle Muscle Group Selection (Adding custom exercise)
    if (text.startsWith('addgroup_')) {
        const muscle = text.split('_')[1];
        
        if (!session) {
            session = new WorkoutSession({ userPhone });
        }
        
        session.state = 'ADDING_CUSTOM_EXERCISE';
        session.targetMuscleGroup = muscle;
        await session.save();

        await sendToWhatsApp({
            messaging_product: "whatsapp",
            to: userPhone,
            type: "text",
            text: { body: `Got it. What's the name of the new *${muscle}* exercise you want to record?\n\n(Type the exact name, e.g., 'Barbell curl'. If you change your mind, type 'cancel')` }
        });
        return;
    }

    // Handle Muscle Group Selection (Normal logging)
    if (text.startsWith('group_')) {
        const muscle = text.split('_')[1];
        
        if (!session) {
            session = new WorkoutSession({ userPhone, routineName: muscle });
        } else {
            session.routineName = muscle;
        }
        await session.save();

        // Fetch the last 2 completed sessions for this specific muscle group
        const pastSessions = await WorkoutSession.find({
            userPhone,
            routineName: muscle,
            isCompleted: true
        }).sort({ date: -1 }).limit(2);

        if (pastSessions.length > 0) {
            let historyText = `📊 *Last 2 ${muscle.toUpperCase()} Sessions:*\n`;
            
            pastSessions.forEach((sess, index) => {
                const sessionDate = new Date(sess.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                historyText += `\n📅 *${sessionDate}*\n`;
                
                sess.completedExercises.forEach(ex => {
                    historyText += `  • ${ex.exerciseName}: `;
                    const setDetails = ex.sets.map(set => `${set.weight}x${set.reps}`).join(', ');
                    historyText += `${setDetails}\n`;
                });
            });
            
            // Send the history message first
            await sendToWhatsApp({
                messaging_product: "whatsapp",
                to: userPhone,
                type: "text",
                text: { body: historyText }
            });
        }

        // Fetch custom exercises to include in the list menu
        const customExs = await CustomExercise.find({ userPhone, muscleGroup: muscle });

        // Then send the exercise list menu for them to pick the next move
        await sendToWhatsApp(getExerciseList(userPhone, muscle, customExs));
        return;
    }

    // Handle Exercise Selection
    if (text.startsWith('ex|')) {
        const [_, muscle, exName] = text.split('|');
        if (!session) {
            session = new WorkoutSession({ userPhone, routineName: muscle });
        } else {
            session.routineName = muscle;
        }
        session.activeExercise = exName;
        await session.save();
        await sendToWhatsApp({
            messaging_product: "whatsapp",
            to: userPhone,
            type: "text",
            text: { body: `💪 Logging: ${exName}\n\nSend sets as: weight reps\n(Example: 50 12)` }
        });
        return;
    }

    // 3. THE SMART PARSER (weight reps OR weight.reps)
    if (session && session.activeExercise) {
        const lines = text.split('\n');
        const loggedSets = [];

        lines.forEach(line => {
            // This regex finds two numbers separated by a space or a dot
            const match = line.trim().match(/^(\d+(?:\.\d+)?)(?:\s+|\.)(\d+)$/);
            if (match) {
                loggedSets.push({
                    weight: parseFloat(match[1]),
                    reps: parseInt(match[2])
                });
            }
        });

        if (loggedSets.length > 0) {
            // Find if this exercise already exists in this session to append sets
            // Note: Since this is mongoose, we find the index manually
            let exIndex = session.completedExercises.findIndex(e => e.exerciseName === session.activeExercise);
            
            if (exIndex > -1) {
                session.completedExercises[exIndex].sets.push(...loggedSets);
            } else {
                session.completedExercises.push({
                    exerciseName: session.activeExercise,
                    sets: loggedSets
                });
            }

            await session.save();
            
            // Send the new 3-button menu
            await sendToWhatsApp(getPostSetMenu(userPhone));
            return;
        }
    }

    await sendToWhatsApp({
        messaging_product: "whatsapp",
        to: userPhone,
        type: "text",
        text: { body: "❓ I didn't understand that. Type 'gym' to start." }
    });
    return;
}

module.exports = { processMessage };