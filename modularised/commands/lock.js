const { SlashCommandBuilder } = require('discord.js');
const { handleLockCommand } = require('../handlers/lockHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock the current ticket channel to Manager+ roles.'),
    
    async execute(interaction) {
        await handleLockCommand(interaction, interaction.client);
    },
};
