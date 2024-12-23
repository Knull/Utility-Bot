const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require('discord.js');
const config = require('../config/config');
const { handleStaffListCommand, handlePagination, getPageEmbed, getPaginationButtons } = require('../utilities/pagination');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff-list')
        .setDescription('Displays a paginated list of staff members')
        .addStringOption(option =>
            option.setName('sort-by')
                .setDescription('Sort staff list by hierarchy level')
                .setRequired(false)
                .addChoices(
                    { name: 'Owner', value: 'owner' },
                    { name: 'Head Developer', value: 'head-developer' },
                    { name: 'Manager', value: 'manager' },
                    { name: 'Developer', value: 'developer' },
                    { name: 'Designer', value: 'designer' },
                    { name: 'Admin', value: 'admin' },
                    { name: 'Mod', value: 'mod' },
                    { name: 'Helper', value: 'helper' },
                ))
        .addStringOption(option =>
            option.setName('order')
                .setDescription('Order of the list')
                .setRequired(false)
                .addChoices(
                    { name: 'Ascending', value: 'ascending' },
                    { name: 'Descending', value: 'descending' },
                )),
    
    async execute(interaction) {
        await handleStaffListCommand(interaction, config);
    },
};
