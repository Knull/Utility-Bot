const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Returns the bot latency.'),
    
    async execute(interaction) {
        // Send an initial reply and fetch the reply message
        const sentMessage = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        // Calculate the latency by comparing the message timestamps
        const latency = sentMessage.createdTimestamp - interaction.createdTimestamp;
        // Get the API latency (ping)
        const apiLatency = Math.round(interaction.client.ws.ping);
        
        // Edit the original reply to include the latency information
        await interaction.editReply(`Pong! Latency: ${latency}ms | API Latency: ${apiLatency}ms`);
    },
};
