// commands/pups.js
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pups')
        .setDescription('PUPS related commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('vote')
                .setDescription('Vote for a user to join PUPS')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to vote for')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('myvote')
                .setDescription('Show your vote results'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add PUPS role to a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to add role to')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove PUPS role from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to remove role from')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all users with PUPS role')),
    
    async execute(interaction) {
        const { commandName, options } = interaction;
        const config = require('../config/config');
        const pupsVoteHandler = require('../handlers/voting/pupsVoteHandler');
    
        if (commandName === 'pups') {
            const subcommand = options.getSubcommand();
            switch (subcommand) {
                case 'vote':
                    await pupsVoteHandler.handleVote(interaction);
                    break;
                case 'myvote':
                    await pupsVoteHandler.handleMyVote(interaction);
                    break;
                case 'add':
                    await pupsVoteHandler.handleAdd(interaction);
                    break;
                case 'remove':
                    await pupsVoteHandler.handleRemove(interaction);
                    break;
                case 'list':
                    await pupsVoteHandler.handleList(interaction);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        }
    },
};
