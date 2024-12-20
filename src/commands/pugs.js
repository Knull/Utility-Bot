const { SlashCommandBuilder } = require('discord.js');
const { handlePugsVote, handlePugsMyVote, handlePugsAdd, handlePugsRemove, handlePugsList } = require('../features/pugsFeatures');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pugs')
        .setDescription('PUGs commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('vote')
                .setDescription('Vote for PUGs')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to vote for')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('myvote')
                .setDescription('Show your vote results')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add PUGs role to a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to add role to')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Type of PUGs role (trial or pugs)')
                        .setRequired(true)
                        .addChoices(
                            { name: 'PUGs Trial', value: 'trial' },
                            { name: 'PUGs', value: 'pugs' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove PUGs role from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to remove role from')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all users with PUGs role')
        ),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'vote') {
            await handlePugsVote(interaction);
        } else if (subcommand === 'myvote') {
            await handlePugsMyVote(interaction);
        } else if (subcommand === 'add') {
            await handlePugsAdd(interaction);
        } else if (subcommand === 'remove') {
            await handlePugsRemove(interaction);
        } else if (subcommand === 'list') {
            await handlePugsList(interaction);
        }
    },
};
