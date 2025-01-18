// handlers/voteviewHandler.js

const { EmbedBuilder } = require('discord.js');
const { pool } = require('../../utilities/database');
const { logger } = require('../../utilities/logger');

module.exports = {
    /**
     * Handle the `/voteview` command
     * @param {CommandInteraction} interaction 
     */
    async handleVoteViewCommand(interaction) {
        const user = interaction.options.getUser('user');
        const voteId = interaction.options.getString('vote_id');
        const type = interaction.options.getString('type'); // New option

        if (!user || !voteId) {
            const embed = new EmbedBuilder()
                .setDescription('Please provide both a user and a vote ID.')
                .setColor(0x980e00);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Parse voteId as integer
        const pollId = parseInt(voteId, 10);
        if (isNaN(pollId)) {
            const embed = new EmbedBuilder()
                .setDescription('Invalid vote ID provided. It should be a number.')
                .setColor(0x980e00);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        try {
            // Build SQL query dynamically based on whether type is provided
            let query = 'SELECT * FROM polls WHERE user_id = ? AND id = ?';
            const params = [user.id, pollId];

            if (type) {
                query += ' AND type = ?';
                params.push(type.toLowerCase()); // Assuming type is stored in lowercase
            }

            // Fetch poll based on user, pollId, and optionally type
            const [polls] = await pool.execute(query, params);

            if (polls.length === 0) {
                const embed = new EmbedBuilder()
                    .setDescription('No poll found with the provided details.')
                    .setColor(0x980e00);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const poll = polls[0];

            // Fetch upvoters and downvoters
            const [upvoters] = await pool.execute(
                'SELECT user_id FROM votes WHERE poll_id = ? AND vote = "upvote"',
                [poll.id]
            );
            const [downvoters] = await pool.execute(
                'SELECT user_id FROM votes WHERE poll_id = ? AND vote = "downvote"',
                [poll.id]
            );

            // Map user IDs to mentions, limit to 25 to prevent embed field overflow
            const maxMentions = 25;
            const upvoteMentions = upvoters
                .slice(0, maxMentions)
                .map(v => `<@${v.user_id}>`)
                .join('\n') || 'No upvotes yet.';
            const downvoteMentions = downvoters
                .slice(0, maxMentions)
                .map(v => `<@${v.user_id}>`)
                .join('\n') || 'No downvotes yet.';

            // Count total upvotes and downvotes
            const totalUpvotes = upvoters.length;
            const totalDownvotes = downvoters.length;

            // Fetch the poll owner's information reliably
            let pollOwner;
            try {
                pollOwner = await interaction.guild.members.fetch(poll.user_id);
            } catch (err) {
                logger.warn(`Poll owner with ID ${poll.user_id} not found in the guild.`);
                pollOwner = null;
            }

            const pollType = poll.type ? poll.type.toUpperCase() : 'UNKNOWN';
            const authorName = pollOwner ? `${pollOwner.user.username} | ${pollType} Vote Results` : `${pollType} Vote Results`;
            const authorIcon = pollOwner ? pollOwner.user.displayAvatarURL() : interaction.guild.iconURL();

            const embed = new EmbedBuilder()
                .setAuthor({ name: authorName, iconURL: authorIcon })
                .addFields(
                    { name: `Upvotes 👍 (${totalUpvotes})`, value: upvoteMentions, inline: true },
                    { name: `Downvotes 💔 (${totalDownvotes})`, value: downvoteMentions, inline: true }
                )
                .setColor('#FFD700') // Gold color for results
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            logger.error('Error fetching vote details:', error);
            return interaction.reply({ content: 'An error occurred while fetching the votes.', ephemeral: true });
        }
    },
    
    /**
     * Handle autocomplete interactions for the `/voteview` command
     * @param {AutocompleteInteraction} interaction 
     */
    async handleVoteViewAutocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'vote_id') {
            const user = interaction.options.getUser('user');
            const type = interaction.options.getString('type'); // New option

            if (!user) {
                await interaction.respond([]);
                return;
            }

            try {
                // Build SQL query dynamically based on whether type is provided
                let query = 'SELECT * FROM polls WHERE user_id = ?';
                const params = [user.id];

                if (type) {
                    query += ' AND type = ?';
                    params.push(type.toLowerCase()); // Assuming type is stored in lowercase
                }

                query += ' ORDER BY created_at DESC';

                // Fetch polls for the selected user (all types or specific type)
                const [polls] = await pool.execute(query, params);

                if (polls.length === 0) {
                    await interaction.respond([]);
                    return;
                }

                // Format the vote IDs for suggestions, including poll type
                const voteOptions = polls.map((poll, index) => ({
                    name: `#${poll.id} | ${poll.type ? poll.type.toUpperCase() : 'UNKNOWN'}`,
                    value: poll.id.toString()
                }));

                // Respond with up to 25 suggestions
                await interaction.respond(voteOptions.slice(0, 25));
            } catch (error) {
                logger.error('Error fetching polls for autocomplete:', error);
                await interaction.respond([]);
            }
        }
    }
};
