// index.js
const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');
const config = require('./config/config');
const mysql = require('mysql2/promise');

// Initialize MySQL Pool
const pool = mysql.createPool({
    host: config.dbHost,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Initialize Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [
        Partials.Message, 
        Partials.Channel, 
        Partials.Reaction,
        Partials.GuildMember
    ]
});

client.pool = pool;
client.commands = new Collection();

// Load Command Files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection
    if ('data' in command && ('execute' in command || 'autocomplete' in command)) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute/autocomplete" property.`);
    }
}

// Register Commands with Discord
const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

// Load Event Files
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}
client.login(config.token);

// Catch uncaught exceptions and unhandled promise rejections
const ownerId = config.ownerId; // Pls ensure that ownerId is defined in config.js
// function below is something for the developer.
async function sendErrorLog(error) {
    try {
        const user = await client.users.fetch(ownerId);
        
        const errorEmbed = new EmbedBuilder()
            .setColor(0x8B0000) 
            .setDescription(`\`\`\`js\n${error.stack || error}\n\`\`\``)
            .setTimestamp(); 

        await user.send({ embeds: [errorEmbed] });
    } catch (err) {
    }
}

process.on("uncaughtException", sendErrorLog);
process.on("unhandledRejection", sendErrorLog);


require('./utilities/booster')(client);
require('./events/guildMemberAdd')(client);
require('./events/guildMemberRemove')(client);


client.pagination = new Collection();
