const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Returns the bot latency.'),
    
    async execute(interaction) {
        const sentMessage = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const latency = sentMessage.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);
        await interaction.editReply(`Pong! Latency: ${latency}ms | API Latency: ${apiLatency}ms`);
    },
};
