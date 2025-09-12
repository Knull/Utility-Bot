const { SlashCommandBuilder } = require('discord.js');
const { handleStaffAnnouncement } = require('../handlers/staffAnnouncementHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Announce a user joining the staff team.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User joining the staff team.')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role the user is joining as.')
                .setRequired(true)),
    
    async execute(interaction) {
        await handleStaffAnnouncement(interaction, interaction.client);
    },
};
