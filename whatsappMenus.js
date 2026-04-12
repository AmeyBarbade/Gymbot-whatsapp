

function getWelcomeMenu(userPhone, todayStr) {
    return {
        "messaging_product": "whatsapp",
        "to": userPhone,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {
                "text": `🔥 ${todayStr} means it's time to work. Are we killing the standard routine today or pivoting?`
            },
            "action": {
                "buttons": [
                    {
                        "type": "reply",
                        "reply": {
                            "id": "btn_start_default",
                            "title": "🚀 Let's Start"
                        }
                    },
                    {
                        "type": "reply",
                        "reply": {
                            "id": "btn_main_menu",
                            "title": "📋 Main Menu"
                        }
                    }
                ]
            }
        }
    };
}

// ==========================================
// Exercise Selection Menu
// ==========================================
function getExerciseMenu(userPhone, exercises) {
    const buttons = exercises.map((ex, index) => ({
        "type": "reply",
        "reply": {
            "id": ex.id,
            "title": ex.name.substring(0, 20)  // WhatsApp button limit
        }
    }));

    return {
        "messaging_product": "whatsapp",
        "to": userPhone,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {
                "text": "💪 Pick your next exercise:"
            },
            "action": {
                "buttons": buttons
            }
        }
    };
}

// ==========================================
// 5-Day Split Menu
// ==========================================
function getMainMenuList(userPhone) {
    return {
        "messaging_product": "whatsapp",
        "to": userPhone,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "body": {
                "text": "📅 Choose your workout day:"
            },
            "action": {
                "button": "Select Day",
                "sections": [
                    {
                        "title": "Weekly Split",
                        "rows": [
                            {
                                "id": "btn_day_chest",
                                "title": "Monday - Chest"
                            },
                            {
                                "id": "btn_day_back",
                                "title": "Tuesday - Back"
                            },
                            {
                                "id": "btn_day_legs",
                                "title": "Wednesday - Legs"
                            },
                            {
                                "id": "btn_day_shoulders",
                                "title": "Thursday - Shoulders"
                            },
                            {
                                "id": "btn_day_arms",
                                "title": "Friday - Arms"
                            }
                        ]
                    }
                ]
            }
        }
    };
}

const exerciseData = {
    back: ["lat pulldown wide grip", "Horizontal cable pull(close)", "Tbar", "Onehand Db Row", "Close grip lat pulldown", "V grip lat pulldown", "Rowing with bar", "butterfly"],
    biceps: ["Incline Curl", "Preacher curl", "hammer curl", "Cable curl", "Rope hammer curl", "Crossbody hammer", "reverse grip cable curl"],
    chest: ["Incline Smith", "Flat Smith", "Incline Db", "Flat Db", "Peck Deck Flys", "Cable Crossovers (Lower chest)", "Pushups"],
    triceps: ["Rope Pushdown", "Cable pushdown", "Overhead Db", "overhead bar", "overhead rope", "reverse grip D handle", "reverse grip cable bar", "Dips"],
    shoulders: ["Shoulder press Db", "Shoulder press Smith", "Lateral raise Db", "Lateral raise D handle", "Rear delt peck deck", "rear delt rope", "front raise"],
    legs: ["Hack Squats", "Hack Squats (back rest)", "Leg press", "leg extension", "leg extension for hamstrings", "Calf raises", "bulgian squats"]
};

function getMuscleGroupList(userPhone) {
    return {
        "messaging_product": "whatsapp",
        "to": userPhone,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "header": { "type": "text", "text": "Gym Tracker" },
            "body": { "text": "Select a muscle group:" },
            "action": {
                "button": "Select Muscle",
                "sections": [{
                    "title": "Muscle Groups",
                    "rows": [
                        { "id": "group_back", "title": "Back" },
                        { "id": "group_biceps", "title": "Biceps" },
                        { "id": "group_chest", "title": "Chest" },
                        { "id": "group_triceps", "title": "Triceps" },
                        { "id": "group_legs", "title": "Legs" },
                        { "id": "group_shoulders", "title": "Shoulders" }
                    ]
                }]
            }
        }
    };
}

function getExerciseList(userPhone, muscleGroup) {
    const exercises = exerciseData[muscleGroup] || [];
    const rows = exercises.map((ex, index) => ({
        "id": `ex|${muscleGroup}|${ex}`, // Store muscle and name in the ID
        "title": ex.substring(0, 24)
    }));

    return {
        "messaging_product": "whatsapp",
        "to": userPhone,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "header": { "type": "text", "text": `${muscleGroup.toUpperCase()}` },
            "body": { "text": "Pick your exercise:" },
            "action": {
                "button": "Select Exercise",
                "sections": [{ "title": "Exercises", "rows": rows }]
            }
        }
    };
}

function getPostSetMenu(userPhone) {
    return {
        "messaging_product": "whatsapp",
        "to": userPhone,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {
                "text": "✅ Sets recorded! What's the next move?"
            },
            "action": {
                "buttons": [
                    { "type": "reply", "reply": { "id": "btn_add_set", "title": "Add another set" } },
                    { "type": "reply", "reply": { "id": "btn_select_ex", "title": "Select Exercise" } },
                    { "type": "reply", "reply": { "id": "btn_select_muscle", "title": "Select Muscle" } }
                ]
            }
        }
    };
}

function getFinishMenu(userPhone) {
    return {
        "messaging_product": "whatsapp",
        "to": userPhone,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {
                "text": "🔥 Session Closed. All data synced to MongoDB. Great work today! Tap the button below when you're ready for your next workout."
            },
            "action": {
                "buttons": [
                    { "type": "reply", "reply": { "id": "gym", "title": "🚀 Next Workout" } }
                ]
            }
        }
    };
}

module.exports = { getMuscleGroupList, getExerciseList, getPostSetMenu, getFinishMenu };