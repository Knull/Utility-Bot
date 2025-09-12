const { SlashCommandBuilder } = require('discord.js');
const { handleStaffAnnouncement } = require('../handlers/staffAnnouncementHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('promote')
        .setDescription('Announce the promotion of a staff member.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User who is being promoted.')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role the user is being promoted to.')
                .setRequired(true)),
    
    async execute(interaction) {
        await handleStaffAnnouncement(interaction, interaction.client);
    },
};
