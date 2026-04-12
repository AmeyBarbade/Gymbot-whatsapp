

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

module.exports = { getWelcomeMenu, getExerciseMenu, getMainMenuList };