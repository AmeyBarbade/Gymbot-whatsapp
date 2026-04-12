const axios = require('axios');
const { WorkoutSession, Routine } = require('./database');
const { getWelcomeMenu, getExerciseMenu, getMainMenuList } = require('./whatsappMenus');

// ==========================================
// HELPER: Send message to WhatsApp via Meta API
// ==========================================
async function sendToWhatsApp(messagePayload) {
    try {
        const META_API_TOKEN = process.env.META_API_TOKEN;
        const META_PHONE_ID = process.env.META_PHONE_ID;

        const url = `https://graph.instagram.com/v18.0/${META_PHONE_ID}/messages`;

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

    // ==========================================
    // STATE 0: IDLE (You texted 'gym')
    // ==========================================
    if (text === 'start' || text === 'gym') {
        if (session) {
            await sendToWhatsApp({
                messaging_product: "whatsapp",
                to: userPhone,
                type: "text",
                text: { body: "Bro, you already have an active workout. Finish it or cancel it." }
            });
            return;
        }

        const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const menuPayload = getWelcomeMenu(userPhone, todayStr);
        
        await sendToWhatsApp(menuPayload);
        console.log("✅ Sent welcome menu to WhatsApp");
        return;
    }

    // ==========================================
    // STATE 0.5: THE BUTTON TAPS
    // ==========================================
    if (text === 'btn_start_default') {
        console.log("Starting default routine for today...");
        session = new WorkoutSession({
            userPhone,
            routineName: "Legs", 
            pendingExercises: [
                { id: "ex_squat", name: "Squat Machine" },
                { id: "ex_press", name: "Leg Press" }
            ]
        });
        await session.save();

        const exerciseMenu = getExerciseMenu(userPhone, session.pendingExercises);
        await sendToWhatsApp(exerciseMenu);
        return;
    }

    if (text === 'btn_main_menu') {
        console.log("User asking for 5-day list...");
        const mainMenu = getMainMenuList(userPhone);
        await sendToWhatsApp(mainMenu);
        return;
    }

    // ==========================================
    // STATE 1: WAITING FOR SETS (e.g., "45x10 40x12")
    // ==========================================
    if (session && session.activeExercise) {
        console.log(`Parsing sets for ${session.activeExercise}: ${text}`);
        try {
            const setsArray = text.split(" ").map(set => {
                const [weight, reps] = set.split("x");
                return { weight: Number(weight), reps: Number(reps) };
            });

            const exerciseObj = session.pendingExercises.find(e => e.id === session.activeExercise);

            session.completedExercises.push({
                exerciseId: session.activeExercise,
                exerciseName: exerciseObj.name,
                sets: setsArray
            });

            session.pendingExercises = session.pendingExercises.filter(e => e.id !== session.activeExercise);
            session.activeExercise = null; 

            if (session.pendingExercises.length === 0) {
                session.isCompleted = true;
                await session.save();
                await sendToWhatsApp({
                    messaging_product: "whatsapp",
                    to: userPhone,
                    type: "text",
                    text: { body: "🔥 Workout Complete! Great job bro. You crushed it!" }
                });
                return;
            }

            await session.save();
            await sendToWhatsApp({
                messaging_product: "whatsapp",
                to: userPhone,
                type: "text",
                text: { body: "✅ Sets logged! Pick next exercise:" }
            });
            
            const exerciseMenu = getExerciseMenu(userPhone, session.pendingExercises);
            await sendToWhatsApp(exerciseMenu);
            return;

        } catch (error) {
            await sendToWhatsApp({
                messaging_product: "whatsapp",
                to: userPhone,
                type: "text",
                text: { body: "❌ Bro, formatting error. Send as: 45x10 40x12" }
            });
            return;
        }
    }

    // ==========================================
    // STATE 2: EXERCISE SELECTION FROM CHECKLIST
    // ==========================================
    if (session && !session.activeExercise) {
        const selectedEx = session.pendingExercises.find(e => e.id === text);
        if (selectedEx) {
            session.activeExercise = selectedEx.id;
            await session.save();
            await sendToWhatsApp({
                messaging_product: "whatsapp",
                to: userPhone,
                type: "text",
                text: { body: `💪 Selected: ${selectedEx.name}\n\nSend your sets (e.g., 50x10 50x8):` }
            });
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