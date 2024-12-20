const { SlashCommandBuilder } = require('discord.js');
const { handlePremiumAdd, handlePremiumRemove, handlePremiumList } = require('../features/premiumFeatures');

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
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove Premium role from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to remove Premium role from')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all users with the Premium role')
        ),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'add') {
            await handlePremiumAdd(interaction);
        } else if (subcommand === 'remove') {
            await handlePremiumRemove(interaction);
        } else if (subcommand === 'list') {
            await handlePremiumList(interaction);
        }
    },
};
