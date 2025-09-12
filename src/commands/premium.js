// commands/premium.js
const { SlashCommandBuilder } = require('discord.js');
const { handlePromoteCommand, handlePromoteAutocomplete, handlePremiumList } = require('../handlers/premiumHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('premium')
        .setDescription('Manage Premium roles')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add Premium role to a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to add Premium role to')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove Premium role from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to remove Premium role from')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all users with the Premium role')),
    
    /**
     * Executes the command.
     * @param {Interaction} interaction 
     */
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'add' || subcommand === 'remove') {
            await handlePromoteCommand(interaction);
        } else if (subcommand === 'list') {
            await handlePremiumList(interaction);
        }
    },
    
    /**
     * Handles autocomplete for the tier option (if needed in future)
     * Currently, no autocomplete is needed for the 'list' subcommand.
     */
    async autocomplete(interaction) {
        // No autocomplete functionality for the 'premium' command as per current requirements.
    },
};
