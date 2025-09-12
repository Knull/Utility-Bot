const { SlashCommandBuilder } = require('discord.js');
const { handleStaffAnnouncement } = require('../handlers/staffAnnouncementHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('departure')
        .setDescription('Announce the departure of a staff member.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User who is departing.')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role the user is departing from.')
                .setRequired(true)),
    
    async execute(interaction) {
        await handleStaffAnnouncement(interaction, interaction.client);
    },
};
