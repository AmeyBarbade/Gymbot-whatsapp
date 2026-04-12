const axios = require('axios');
const { WorkoutSession, Routine } = require('./database');
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
            await sendToWhatsApp(getExerciseList(userPhone, session.routineName));
        } else {
            await sendToWhatsApp(getMuscleGroupList(userPhone));
        }
        return;
    }

    // Handle Muscle Group Selection
    if (text.startsWith('group_')) {
        const muscle = text.split('_')[1];
        
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

        // Then send the exercise list menu for them to pick the next move
        await sendToWhatsApp(getExerciseList(userPhone, muscle));
        return;
    }

    // Handle Exercise Selection
    if (text.startsWith('ex|')) {
        const [_, muscle, exName] = text.split('|');
        if (!session) {
            session = new WorkoutSession({ userPhone, routineName: muscle });
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