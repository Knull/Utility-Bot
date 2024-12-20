require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const config = require('./config/config');
const eventHandler = require('./handlers/eventHandler');
const commandHandler = require('./handlers/commandHandler');
const { pool } = require('./utils/database');

// Initialize the Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember]
});

// Set up collections and utilities
client.commands = new Collection();
client.pool = pool;

// Load commands
commandHandler(client);

// Load events
eventHandler(client);

// Login to Discord
client.login(config.token);
