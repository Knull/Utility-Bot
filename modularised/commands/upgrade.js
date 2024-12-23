// commands/upgrade.js
const { SlashCommandBuilder } = require('discord.js');
const { handlePromoteCommand, handlePromoteAutocomplete } = require('../handlers/upgradeHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('upgrade')
        .setDescription('Promote a user to a specific tier')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to promote')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tier')
                .setDescription('The tier to promote the user to')
                .setRequired(true)
                .setAutocomplete(true)),
    
    /**
     * Executes the command.
     * @param {Interaction} interaction 
     */
    async execute(interaction) {
        await handlePromoteCommand(interaction);
    },
    
    /**
     * Handles autocomplete for the tier option.
     * @param {Interaction} interaction 
     */
    async autocomplete(interaction) {
        await handlePromoteAutocomplete(interaction);
    },
};
