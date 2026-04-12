require('dotenv').config();
const { connectDB } = require('./database');
const { processMessage } = require('./botLogic');

connectDB(); // Fires up MongoDB when the server starts


const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// ==========================================
// 0. HEALTH CHECK (For keep-alive pings)
// ==========================================
app.get('/health', (req, res) => {
    res.status(200).json({ status: "✅ Gym Bot is alive!" });
});

// ==========================================
// 1. META WEBHOOK VERIFICATION ROUTE (GET)
// Meta will hit this URL to verify your server
// ==========================================
app.get('/webhook', (req, res) => {
    const verify_token = process.env.VERIFY_TOKEN;

    // Parse params from the webhook verification request
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    // Check if a token and mode were sent
    if (mode && token) {
        // Check the mode and token sent are correct
        if (mode === "subscribe" && token === verify_token) {
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});

// ==========================================
// 2. RECEIVE WHATSAPP MESSAGES ROUTE (POST)
// This is where your texts will actually land
// ==========================================
app.post('/webhook', (req, res) => {
    let body = req.body;

    // Check the Incoming webhook message
    if (body.object) {
        if (
            body.entry &&
            body.entry[0].changes &&
            body.entry[0].changes[0] &&
            body.entry[0].changes[0].value.messages &&
            body.entry[0].changes[0].value.messages[0]
        ) {
            let phone_number_id = body.entry[0].changes[0].value.metadata.phone_number_id;
            let msg = body.entry[0].changes[0].value.messages[0];
            let from = msg.from; // Your WhatsApp number
            
            // Extract the text depending on message type (text vs list reply vs button reply)
            let msg_body = "";
            if (msg.type === "text") {
                msg_body = msg.text.body;
            } else if (msg.type === "interactive") {
                if (msg.interactive.type === "list_reply") {
                    msg_body = msg.interactive.list_reply.id;
                } else if (msg.interactive.type === "button_reply") {
                    msg_body = msg.interactive.button_reply.id;
                }
            }

            console.log(`Message from ${from}: ${msg_body}`);
            
            // Send the text to your brain
            processMessage(from, msg_body, phone_number_id).then(response => {
                console.log("✅ Message processed successfully");
            }).catch(error => {
                console.error("❌ Error processing message:", error.message);
            });
        }
        res.sendStatus(200); // Always send a 200 OK back to Meta quickly
    } else {
        res.sendStatus(404);
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Gym Bot Server is running on port ${PORT}`);
});