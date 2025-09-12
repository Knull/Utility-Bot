// commands/staffList.js
const { SlashCommandBuilder } = require('discord.js');
const config = require('../config/config');
const { handleStaffListCommand } = require('../handlers/staffListHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff-list')
        .setDescription('Displays a paginated list of staff members')
        .addStringOption(option =>
            option.setName('sort-by')
                .setDescription('Sort staff list by hierarchy level')
                .setRequired(false)
                .addChoices(
                    // you will have to adjust this based on your role structure
                    { name: 'Owner', value: 'owner' },
                    { name: 'Head Developer', value: 'head-developer' },
                    { name: 'Manager', value: 'manager' },
                    { name: 'Developer', value: 'developer' },
                    { name: 'Designer', value: 'designer' },
                    { name: 'Sr. Admin', value: 'sr-admin' }, 
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
