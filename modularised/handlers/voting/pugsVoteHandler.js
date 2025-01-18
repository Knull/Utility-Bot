// handlers/voting/pugsVoteHandler.js
const { 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const { pool } = require('../../utilities/database');
const config = require('../../config/config');
const logger = require('../../utilities/logger'); // Ensure you have a logger utility

module.exports = {
    /**
     * List of roles allowed to use PUGs commands and interact with voting buttons
     */
    allowedRoles: [
        config.pugsManagerRoleId,
        config.premiumManagerRoleId
        // Add more role IDs if necessary
    ],

    /**
     * Handle the `/pugs vote` command
     * @param {CommandInteraction} interaction 
     */
    async handleVote(interaction) {
        const user = interaction.options.getUser('user');
        const member = interaction.member;

        // Permission check using the allowedRoles list
        if (!this.allowedRoles.some(roleId => member.roles.cache.has(roleId))) {
            const embed = new EmbedBuilder()
                .setDescription(`You do not have permission to use this command. Required roles:\n${this.allowedRoles.map(roleId => `<@&${roleId}>`).join('\n')}`)
                .setColor(0x980e00);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Check for existing active poll
        const [rows] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pugs" AND active = 1', [user.id]);
        if (rows.length > 0) {
            const embed = new EmbedBuilder()
                .setDescription('A poll is already active for this user.')
                .setColor(0x980e00);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Create new poll
        await pool.execute('INSERT INTO polls (user_id, type, upvotes, downvotes, active, created_at, initiator_id) VALUES (?, "pugs", 0, 0, 1, NOW(), ?)', [user.id, interaction.user.id]);

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${user.username} | PUGS Vote`, iconURL: user.displayAvatarURL() })
            .setDescription(`A vote has been created for <@${user.id}> to join <@&${config.pugsRoleId}>.`)
            .addFields(
                { name: 'Upvotes 👍', value: '```0```', inline: true },
                { name: 'Downvotes 👎', value: '```0```', inline: true }
            )
            .setFooter({ text: `Created by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setColor('#b90d1a');

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`upvote_pugs_${user.id}`)
                    .setLabel('Upvote')
                    .setEmoji('👍')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`downvote_pugs_${user.id}`)
                    .setLabel('Downvote')
                    .setEmoji('👎')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`end_vote_pugs_${user.id}`)
                    .setLabel('End Vote')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Use pugsChannelId from config.js
        const channel = interaction.guild.channels.cache.get(config.pugsChannelId);
        if (!channel) {
            logger.error(`PUGS Channel with ID ${config.pugsChannelId} not found.`);
            return interaction.reply({ content: 'PUGS voting channel not found.', ephemeral: true });
        }

        await channel.send({ content: `<@&${config.pugsRoleId}>`, embeds: [embed], components: [buttons] });

        return interaction.reply({ embeds: [new EmbedBuilder().setDescription('Vote created successfully.').setColor(0xb90d1a)], ephemeral: true });
    },

    /**
     * Handle the Upvote button
     * @param {ButtonInteraction} interaction 
     */
    async handleUpvote(interaction) {
        await this.handleVoteButton(interaction, 'upvote');
    },

    /**
     * Handle the Downvote button
     * @param {ButtonInteraction} interaction 
     */
    async handleDownvote(interaction) {
        await this.handleVoteButton(interaction, 'downvote');
    },

    /**
     * Common function to handle vote buttons, including changing votes
     * @param {ButtonInteraction} interaction 
     * @param {string} voteType - 'upvote' or 'downvote'
     */
    async handleVoteButton(interaction, voteType) {
        const customId = interaction.customId;
        const parts = customId.split('_');

        if (parts.length < 3) {
            logger.warn(`Invalid customId: ${customId}`);
            return;
        }

        const action = parts[0]; // 'upvote' or 'downvote'
        const type = parts[1]; // 'pugs'
        const targetUserId = parts.slice(2).join('_'); // In case user IDs have underscores

        if (type !== 'pugs') {
            logger.warn(`Ignoring non-pugs type: ${type}`);
            return;
        }

        // Fetch active poll
        const [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pugs" AND active = 1', [targetUserId]);
        if (polls.length === 0) {
            logger.warn('No active poll found for the user.');
            return interaction.reply({ content: 'No active poll found for this user.', ephemeral: true });
        }

        const poll = polls[0];
        const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);

        // Permission check using the allowedRoles list
        if (!this.allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
            return interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setDescription(`You do not have permission to vote. Required roles:\n${this.allowedRoles.map(roleId => `<@&${roleId}>`).join('\n')}`)
                    .setColor(0x980e00)
                ], 
                ephemeral: true 
            });
        }

        // Prevent self-voting
        if (interaction.user.id === targetUserId) {
            return interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setDescription('You cannot vote on your own poll.')
                    .setColor(0x980e00)
                ], 
                ephemeral: true 
            });
        }

        // Check if the user has already voted
        const [existingVote] = await pool.execute('SELECT * FROM votes WHERE user_id = ? AND poll_id = ?', [interaction.user.id, poll.id]);

        if (existingVote.length > 0) {
            const previousVote = existingVote[0].vote;
            if (previousVote === voteType) {
                return interaction.reply({ 
                    embeds: [new EmbedBuilder()
                        .setDescription(`You have already ${voteType}d this poll.`)
                        .setColor(0x980e00)
                    ], 
                    ephemeral: true 
                });
            } else {
                // User is changing their vote
                try {
                    // Begin transaction
                    const connection = await pool.getConnection();
                    try {
                        await connection.beginTransaction();

                        if (voteType === 'upvote') {
                            await connection.execute('UPDATE polls SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id = ?', [poll.id]);
                            await connection.execute('UPDATE votes SET vote = "upvote" WHERE user_id = ? AND poll_id = ?', [interaction.user.id, poll.id]);
                        } else if (voteType === 'downvote') {
                            await connection.execute('UPDATE polls SET downvotes = downvotes + 1, upvotes = upvotes - 1 WHERE id = ?', [poll.id]);
                            await connection.execute('UPDATE votes SET vote = "downvote" WHERE user_id = ? AND poll_id = ?', [interaction.user.id, poll.id]);
                        }

                        await connection.commit();
                        logger.info(`User ${interaction.user.id} changed their vote to ${voteType} on poll for user ${targetUserId}`);
                    } catch (error) {
                        await connection.rollback();
                        throw error;
                    } finally {
                        connection.release();
                    }

                    // Fetch updated poll
                    const [updatedPolls] = await pool.execute('SELECT * FROM polls WHERE id = ?', [poll.id]);
                    const updatedPoll = updatedPolls[0];

                    // Update the embed in the voting channel
                    const channel = interaction.guild.channels.cache.get(config.pugsChannelId);
                    if (!channel) {
                        logger.error(`PUGS Channel with ID ${config.pugsChannelId} not found.`);
                        return interaction.reply({ content: 'PUGS voting channel not found.', ephemeral: true });
                    }

                    // Fetch the original message to update
                    const fetchedMessages = await channel.messages.fetch({ limit: 100 });
                    const message = fetchedMessages.find(msg => 
                        msg.embeds.length > 0 && 
                        msg.embeds[0].author && 
                        msg.embeds[0].author.name === `${interaction.guild.members.cache.get(targetUserId).user.username} | PUGS Vote`
                    );

                    if (!message) {
                        logger.error('Original voting message not found.');
                        return interaction.reply({ content: 'Original voting message not found.', ephemeral: true });
                    }

                    const embed = new EmbedBuilder(message.embeds[0].data)
                        .setDescription(`A vote has been created for <@${targetUserId}> to join <@&${config.pugsRoleId}>.`)
                        .spliceFields(0, 2, 
                            { name: 'Upvotes 👍', value: `\`\`\`${updatedPoll.upvotes}\`\`\``, inline: true },
                            { name: 'Downvotes 👎', value: `\`\`\`${updatedPoll.downvotes}\`\`\``, inline: true }
                        )
                        .setTimestamp();

                    await message.edit({ embeds: [embed] });

                    return interaction.reply({ 
                        embeds: [new EmbedBuilder()
                            .setDescription(`Your vote has been changed to **${voteType}**.`)
                            .setColor(0xb90d1a)
                        ], 
                        ephemeral: true 
                    });
                } catch (error) {
                    logger.error('Error changing vote:', error);
                    return interaction.reply({ 
                        content: 'An error occurred while changing your vote.', 
                        ephemeral: true 
                    });
                }
            }
        } else {
            // User has not voted yet, proceed to cast the vote
            try {
                // Begin transaction
                const connection = await pool.getConnection();
                try {
                    await connection.beginTransaction();

                    if (voteType === 'upvote') {
                        await connection.execute('UPDATE polls SET upvotes = upvotes + 1 WHERE id = ?', [poll.id]);
                        await connection.execute('INSERT INTO votes (user_id, poll_id, type, vote) VALUES (?, ?, "pugs", "upvote")', [interaction.user.id, poll.id]);
                    } else if (voteType === 'downvote') {
                        await connection.execute('UPDATE polls SET downvotes = downvotes + 1 WHERE id = ?', [poll.id]);
                        await connection.execute('INSERT INTO votes (user_id, poll_id, type, vote) VALUES (?, ?, "pugs", "downvote")', [interaction.user.id, poll.id]);
                    }

                    await connection.commit();
                    logger.info(`User ${interaction.user.id} cast a ${voteType} on poll for user ${targetUserId}`);
                } catch (error) {
                    await connection.rollback();
                    throw error;
                } finally {
                    connection.release();
                }

                // Fetch updated poll
                const [updatedPolls] = await pool.execute('SELECT * FROM polls WHERE id = ?', [poll.id]);
                const updatedPoll = updatedPolls[0];

                // Update the embed in the voting channel
                const channel = interaction.guild.channels.cache.get(config.pugsChannelId);
                if (!channel) {
                    logger.error(`PUGS Channel with ID ${config.pugsChannelId} not found.`);
                    return interaction.reply({ content: 'PUGS voting channel not found.', ephemeral: true });
                }

                // Fetch the original message to update
                const fetchedMessages = await channel.messages.fetch({ limit: 100 });
                const message = fetchedMessages.find(msg => 
                    msg.embeds.length > 0 && 
                    msg.embeds[0].author && 
                    msg.embeds[0].author.name === `${interaction.guild.members.cache.get(targetUserId).user.username} | PUGS Vote`
                );

                if (!message) {
                    logger.error('Original voting message not found.');
                    return interaction.reply({ content: 'Original voting message not found.', ephemeral: true });
                }

                const embed = new EmbedBuilder(message.embeds[0].data)
                    .setDescription(`A vote has been created for <@${targetUserId}> to join <@&${config.pugsRoleId}>.`)
                    .spliceFields(0, 2, 
                        { name: 'Upvotes 👍', value: `\`\`\`${updatedPoll.upvotes}\`\`\``, inline: true },
                        { name: 'Downvotes 👎', value: `\`\`\`${updatedPoll.downvotes}\`\`\``, inline: true }
                    )
                    .setTimestamp();

                await message.edit({ embeds: [embed] });

                return interaction.reply({ 
                    embeds: [new EmbedBuilder()
                        .setDescription(`You have cast a **${voteType}**.`)
                        .setColor(0xb90d1a)
                    ], 
                    ephemeral: true 
                });
            } catch (error) {
                logger.error('Error casting vote:', error);
                return interaction.reply({ 
                    content: 'An error occurred while casting your vote.', 
                    ephemeral: true 
                });
            }
        }
    },

    /**
     * Handle the End Vote button
     * @param {ButtonInteraction} interaction 
     */
    async handleEndVote(interaction) {
        const customId = interaction.customId;
        const parts = customId.split('_');

        if (parts.length < 4) {
            logger.warn(`Invalid customId: ${customId}`);
            return;
        }

        const action = `${parts[0]}_${parts[1]}`; // 'end_vote'
        const type = parts[2]; // 'pugs'
        const targetUserId = parts.slice(3).join('_'); // Handle any underscores in user IDs

        if (type !== 'pugs') {
            logger.warn(`Ignoring non-pugs type: ${type}`);
            return;
        }

        // Fetch active poll
        const [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pugs" AND active = 1', [targetUserId]);
        if (polls.length === 0) {
            logger.warn('No active poll found for the user.');
            return interaction.reply({ content: 'No active poll found for this user.', ephemeral: true });
        }

        const poll = polls[0];
        const initiatorId = poll.initiator_id;

        // Permission check using the allowedRoles list
        if (!this.allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
            const embed = new EmbedBuilder()
                .setDescription(`Only people with these roles can use this button:\n${this.allowedRoles.map(roleId => `<@&${roleId}>`).join('\n')}`)
                .setColor(0x980e00);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Deactivate the poll
        try {
            await pool.execute('UPDATE polls SET active = 0 WHERE id = ?', [poll.id]);
        } catch (error) {
            logger.error('Error deactivating poll:', error);
            return interaction.reply({ content: 'An error occurred while ending the vote.', ephemeral: true });
        }

        const upvotes = poll.upvotes;
        const downvotes = poll.downvotes;
        const result = upvotes > downvotes ? 'won' : 'lost';
        const resultColor = upvotes > downvotes ? '#00FF00' : '#FF0000';

        // Disable all buttons in the original message
        const disabledButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`upvote_pugs_${targetUserId}`)
                .setLabel('Upvote')
                .setEmoji('👍')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`downvote_pugs_${targetUserId}`)
                .setLabel('Downvote')
                .setEmoji('👎')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`end_vote_pugs_${targetUserId}`)
                .setLabel('End Vote')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        // Fetch the original message to update
        const channel = interaction.guild.channels.cache.get(config.pugsChannelId);
        if (!channel) {
            logger.error(`PUGS Channel with ID ${config.pugsChannelId} not found.`);
            return interaction.reply({ content: 'PUGS voting channel not found.', ephemeral: true });
        }

        const fetchedMessages = await channel.messages.fetch({ limit: 100 });
        const message = fetchedMessages.find(msg => 
            msg.embeds.length > 0 && 
            msg.embeds[0].author && 
            msg.embeds[0].author.name === `${interaction.guild.members.cache.get(targetUserId).user.username} | PUGS Vote`
        );

        if (!message) {
            logger.error('Original voting message not found.');
            return interaction.reply({ content: 'Original voting message not found.', ephemeral: true });
        }

        // Update the embed with the final vote counts
        const embed = new EmbedBuilder(message.embeds[0].data)
            .setDescription(`A vote has been created for <@${targetUserId}> to join <@&${config.pugsRoleId}>.`)
            .spliceFields(0, 2, 
                { name: 'Upvotes 👍', value: `\`\`\`${upvotes}\`\`\``, inline: true },
                { name: 'Downvotes 👎', value: `\`\`\`${downvotes}\`\`\``, inline: true }
            )
            .setTimestamp();

        try {
            await message.edit({ embeds: [embed], components: [disabledButtons] });

            // Create a result embed
            const resultEmbed = new EmbedBuilder()
                .setAuthor({ name: `${interaction.guild.members.cache.get(targetUserId).user.username} | PUGS Vote`, iconURL: interaction.guild.members.cache.get(targetUserId).user.displayAvatarURL() })
                .setDescription(`**Upvotes:** \`\`\`${upvotes}\`\`\`\n**Downvotes 👎** \`\`\`${downvotes}\`\`\`\n<@${targetUserId}> has **${result}** the vote!`)
                .setColor(resultColor)
                .setFooter({ text: `Created by ${message.embeds[0].footer.text.replace('Created by ', '')}`, iconURL: message.embeds[0].footer.iconURL });

            // Add a button to add to PUGS if the vote is won
            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`add_to_pugs_${targetUserId}`)
                    .setLabel('Add To PUGS')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(result === 'lost')
            );

            await interaction.reply({ embeds: [resultEmbed], components: [buttons], ephemeral: true });
            await interaction.followUp({ embeds: [new EmbedBuilder().setDescription('Vote ended successfully.').setColor(0xb90d1a)], ephemeral: true });
        } catch (error) {
            logger.error(`Error handling end_vote interaction: ${error}`);
            return interaction.reply({ content: 'Error handling end_vote interaction.', ephemeral: true });
        }
    },

    /**
     * Handle the Add To PUGS button
     * @param {ButtonInteraction} interaction 
     */
    async handleAddToPugs(interaction) {
        const customId = interaction.customId;
        const parts = customId.split('_');

        if (parts.length < 4) { // 'add_to_pugs_{userId}'
            logger.warn(`Invalid customId: ${customId}`);
            return;
        }

        const action = `${parts[0]}_${parts[1]}_${parts[2]}`; // 'add_to_pugs'
        const targetUserId = parts.slice(3).join('_'); // Handle any underscores in user IDs

        // Check if the user has the necessary roles
        if (!this.allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
            const embed = new EmbedBuilder()
                .setDescription(`Only people with these roles can use this button:\n${this.allowedRoles.map(roleId => `<@&${roleId}>`).join('\n')}`)
                .setColor(0x980e00);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
        const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);
        const [pollResult] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pugs" AND active = 0', [targetUserId]);

        if (pollResult.length === 0) {
            logger.warn('No completed poll found for the user.');
            return interaction.reply({ content: 'No completed poll found for this user.', ephemeral: true });
        }

        const poll = pollResult[0];
        const member = interaction.guild.members.cache.get(targetUserId);

        if (!member) {
            return interaction.reply({ content: 'User not found in the guild.', ephemeral: true });
        }

        if (member.roles.cache.has(pugsRole.id) || member.roles.cache.has(pugsTrialRole.id)) {
            return interaction.reply({ content: `<@${targetUserId}> already has a PUGS role.`, ephemeral: true });
        }

        try {
            // Assign the appropriate PUGS role
            // Here, assuming that the type can be determined based on some condition or data
            // For simplicity, assigning the standard PUGS role
            await member.roles.add(pugsRole);
            logger.info(`Added user ${targetUserId} to PUGS`);

            // Create the embed for the interaction reply
            const replyEmbed = new EmbedBuilder()
                .setDescription(`✅ Successfully added <@${targetUserId}> to <@&${config.pugsRoleId}>.`)
                .setColor(0x00FF00);

            await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

            // Create the embed for the pugs-voting channel
            const user = member.user;
            const votingEmbed = new EmbedBuilder()
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setTitle("PUGS Addition")
                .setDescription(`<@${targetUserId}> has been added to <@&${config.pugsRoleId}>.`)
                .addFields(
                    { name: 'Upvotes 👍', value: `\`\`\`${poll.upvotes}\`\`\``, inline: true },
                    { name: 'Downvotes 👎', value: `\`\`\`${poll.downvotes}\`\`\``, inline: true }
                )
                .setFooter({ text: `Added by: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp()
                .setColor(0x00FF00);

            const votingChannel = interaction.guild.channels.cache.get(config.pugsChannelId);
            if (votingChannel) {
                await votingChannel.send({ embeds: [votingEmbed] });
            } else {
                logger.error('PUGS voting channel not found.');
            }
        } catch (error) {
            logger.error('Error adding PUGS role:', error);
            return interaction.reply({ content: 'Error adding PUGS role.', ephemeral: true });
        }
    },

    /**
     * Handle the Remove PUGS role button
     * @param {ButtonInteraction} interaction 
     */
    async handleRemovePugs(interaction) {
        const customId = interaction.customId;
        const parts = customId.split('_');

        if (parts.length < 4) { // 'remove_pugs_{userId}'
            logger.warn(`Invalid customId: ${customId}`);
            return;
        }

        const action = `${parts[0]}_${parts[1]}_${parts[2]}`; // 'remove_pugs'
        const targetUserId = parts.slice(3).join('_'); // Handle any underscores in user IDs

        // Check if the user has the necessary roles
        if (!this.allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
            const embed = new EmbedBuilder()
                .setDescription(`Only people with these roles can use this button:\n${this.allowedRoles.map(roleId => `<@&${roleId}>`).join('\n')}`)
                .setColor(0x980e00);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
        const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);
        const member = interaction.guild.members.cache.get(targetUserId);

        if (!member) {
            return interaction.reply({ content: 'User not found in the guild.', ephemeral: true });
        }

        if (!member.roles.cache.has(pugsRole.id) && !member.roles.cache.has(pugsTrialRole.id)) {
            return interaction.reply({ content: `<@${targetUserId}> doesn't have any PUGS roles.`, ephemeral: true });
        }

        // Determine which role to remove
        const roleToRemove = member.roles.cache.has(pugsTrialRole.id) ? pugsTrialRole : pugsRole;

        try {
            await member.roles.remove(roleToRemove);
            logger.info(`Removed PUGS role from ${member.user.username}`);

            // Create the embed for the interaction reply
            const replyEmbed = new EmbedBuilder()
                .setDescription(`❌ Successfully removed <@${targetUserId}> from <@&${roleToRemove.id}>.`)
                .setColor(0xFF0000);

            await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

            // Create the embed for the pugs-voting channel
            const votingEmbed = new EmbedBuilder()
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setTitle("PUGS Removal")
                .setDescription(`<@${targetUserId}> has been removed from <@&${roleToRemove.id}>.`)
                .addFields(
                    { name: 'Upvotes 👍', value: '```0```', inline: true },
                    { name: 'Downvotes 👎', value: '```0```', inline: true }
                )
                .setFooter({ text: `Removed by: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp()
                .setColor(0xFF0000);

            const votingChannel = interaction.guild.channels.cache.get(config.pugsChannelId);
            if (votingChannel) {
                await votingChannel.send({ embeds: [votingEmbed] });
            } else {
                logger.error('PUGS voting channel not found.');
            }
        } catch (error) {
            logger.error('Error removing PUGS role:', error);
            return interaction.reply({ content: 'Error removing PUGS role.', ephemeral: true });
        }
    },

    /**
     * Handle the Undo PUGS role button
     * @param {ButtonInteraction} interaction 
     */
    async handleUndoPugs(interaction) {
        const customId = interaction.customId;
        const parts = customId.split('_');

        if (parts.length < 4) { // 'undo_pugs_{pollId}'
            logger.warn(`Invalid customId: ${customId}`);
            return;
        }

        const action = `${parts[0]}_${parts[1]}_${parts[2]}`; // 'undo_pugs'
        const pollId = parts.slice(3).join('_'); // Handle any underscores in poll IDs

        // Fetch poll details
        const [polls] = await pool.execute('SELECT * FROM polls WHERE id = ?', [pollId]);
        if (polls.length === 0) {
            logger.warn('No poll found with the given ID.');
            return interaction.reply({ content: 'No poll found.', ephemeral: true });
        }

        const poll = polls[0];
        const userId = poll.user_id;
        const initiatorId = poll.initiator_id; // Ensure your polls table has an initiator_id

        // Fetch the member and role
        const member = interaction.guild.members.cache.get(userId);
        const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
        const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);

        if (!member) {
            return interaction.reply({ content: 'User not found in the guild.', ephemeral: true });
        }

        // Decide which role to add back
        const roleToAdd = member.roles.cache.has(pugsTrialRole.id) ? pugsTrialRole : pugsRole;

        if (member.roles.cache.has(pugsRole.id) || member.roles.cache.has(pugsTrialRole.id)) {
            return interaction.reply({ content: `<@${userId}> already has a PUGS role.`, ephemeral: true });
        }

        try {
            // Assign the appropriate PUGS role
            await member.roles.add(roleToAdd);
            logger.info(`Added user ${userId} back to PUGS`);

            // Update the poll status to closed to prevent further actions
            await pool.execute('UPDATE polls SET active = 0 WHERE id = ?', [pollId]);

            // Update the embed in the pugs-voting channel
            const votingChannel = interaction.guild.channels.cache.get(config.pugsChannelId);
            if (!votingChannel) {
                logger.error(`PUGS Channel with ID ${config.pugsChannelId} not found.`);
                return interaction.reply({ content: 'PUGS voting channel not found.', ephemeral: true });
            }

            const fetchedMessages = await votingChannel.messages.fetch({ limit: 100 });
            const message = fetchedMessages.find(msg => 
                msg.embeds.length > 0 && 
                msg.embeds[0].author && 
                msg.embeds[0].author.name === `${member.user.username} | PUGS Vote`
            );

            if (!message) {
                logger.error('Original voting message not found.');
                return interaction.reply({ content: 'Original voting message not found.', ephemeral: true });
            }

            // Update the embed to reflect the restoration
            const embed = new EmbedBuilder(message.embeds[0].data)
                .setDescription(`A vote has been created for <@${userId}> to join <@&${config.pugsRoleId}>.`)
                .spliceFields(0, 2, 
                    { name: 'Upvotes 👍', value: `\`\`\`${poll.upvotes}\`\`\``, inline: true },
                    { name: 'Downvotes 👎', value: `\`\`\`${poll.downvotes}\`\`\``, inline: true }
                )
                .setTimestamp();

            // Disable all buttons
            const disabledButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`upvote_pugs_${userId}`)
                    .setLabel('Upvote')
                    .setEmoji('👍')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`downvote_pugs_${userId}`)
                    .setLabel('Downvote')
                    .setEmoji('👎')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`end_vote_pugs_${userId}`)
                    .setLabel('End Vote')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            await message.edit({ embeds: [embed], components: [disabledButtons] });

            // Create the embed to show that the user was restored
            const resultEmbed = new EmbedBuilder()
                .setAuthor({ name: `${member.user.username} | PUGS Vote`, iconURL: member.user.displayAvatarURL() })
                .setDescription(`**<@${userId}> has been restored to <@&${roleToAdd.id}>.**`)
                .setColor('#00FF00')
                .setFooter({ text: `Created by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            const buttonsFinal = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`remove_pugs_${pollId}`)
                    .setLabel('Remove')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(false),
                new ButtonBuilder()
                    .setCustomId(`undo_pugs_${pollId}`)
                    .setLabel('Undo')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            await interaction.reply({ embeds: [resultEmbed], components: [buttonsFinal], ephemeral: true });
            await interaction.followUp({ embeds: [new EmbedBuilder().setDescription('Undo successful.').setColor(0xb90d1a)], ephemeral: true });
        } catch (error) {
            logger.error('Error during undo_pugs interaction:', error);
            return interaction.reply({ content: 'Error handling undo_pugs interaction.', ephemeral: true });
        }
    },

    /**
     * Handle the `/pugs myvote` command
     * @param {CommandInteraction} interaction 
     */
    async handleMyVote(interaction) {
        const userId = interaction.user.id;
        let [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pugs" ORDER BY created_at DESC', [userId]);

        if (polls.length === 0) {
            const noPollsEmbed = new EmbedBuilder()
                .setDescription('```ini\nYou do not have any polls```\n')
                .setColor('#D72F2F');
            return interaction.reply({ embeds: [noPollsEmbed], ephemeral: true });
        }

        const pollIndex = 0; // Start with the first poll
        const poll = polls[pollIndex];
        const status = poll.active ? 'active' : 'inactive';
        const user = interaction.user;

        const pollEmbed = new EmbedBuilder()
            .setAuthor({ name: `${user.username} | PUGS Vote`, iconURL: user.displayAvatarURL() })
            .setDescription(`A vote has been created for <@${poll.user_id}> to join <@&${config.pugsRoleId}>.`)
            .addFields(
                { name: 'Upvotes 👍', value: `\`\`\`${poll.upvotes}\`\`\``, inline: true },
                { name: 'Downvotes 👎', value: `\`\`\`${poll.downvotes}\`\`\``, inline: true }
            )
            .setFooter({ text: `Poll ${pollIndex + 1}/${polls.length}`, iconURL: user.displayAvatarURL() })
            .setColor('#b90d1a')
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev_pugs_${userId}_${pollIndex}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pollIndex === 0),
                new ButtonBuilder()
                    .setCustomId(`next_pugs_${userId}_${pollIndex}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pollIndex === polls.length - 1)
            );

        await interaction.reply({ embeds: [pollEmbed], components: [buttons], ephemeral: false });
    },

    /**
     * Handle the `/pugs list` command
     * @param {CommandInteraction} interaction 
     */
    async handleList(interaction) {
        const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
        const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);

        if (!pugsRole && !pugsTrialRole) {
            logger.error(`PUGS Roles with IDs ${config.pugsRoleId} and ${config.pugsTrialRoleId} not found.`);
            return interaction.reply({ content: 'PUGS roles not found.', ephemeral: true });
        }

        const membersWithRole = await interaction.guild.members.fetch();
        const membersArray = membersWithRole.filter(member => member.roles.cache.has(pugsRole.id) || member.roles.cache.has(pugsTrialRole.id)).map(member => member);
        const pageSize = 10;
        const totalPages = Math.ceil(membersArray.length / pageSize);

        if (totalPages === 0) {
            const noMembersEmbed = new EmbedBuilder()
                .setDescription('```ini\nNo members with PUGS role found.\n```')
                .setColor(0x980e00);
            return interaction.reply({ embeds: [noMembersEmbed], ephemeral: true });
        }

        const currentPage = 0; // Start with the first page
        const paginatedMembers = membersArray.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

        const memberList = paginatedMembers.map((member, index) => `\`\`${index + 1 + currentPage * pageSize}.\`\` <@${member.id}>`).join('\n');
        const userPosition = membersArray.findIndex(member => member.id === interaction.user.id) + 1;

        const listEmbed = new EmbedBuilder()
            .setAuthor({ name: 'PUGS List', iconURL: interaction.guild.iconURL() })
            .setDescription(`Mode: **PUGS** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
            .setFooter({ text: `${userPosition}. [${interaction.user.username}]`, iconURL: interaction.user.displayAvatarURL() })
            .setColor('#b90d1a');

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev_list_pugs_${interaction.user.id}_${currentPage}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`next_list_pugs_${interaction.user.id}_${currentPage}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1)
            );

        await interaction.reply({ embeds: [listEmbed], components: [buttons], ephemeral: false });
    },

    /**
     * Handle pagination buttons for both `myvote` and `list`
     * @param {ButtonInteraction} interaction 
     */
    async handlePagination(interaction) {
        const customId = interaction.customId;
        const parts = customId.split('_');

        if (parts.length < 4) {
            logger.warn(`Invalid customId for pagination: ${customId}`);
            return;
        }

        const action = parts[0]; // 'prev' or 'next'
        const type = parts[1]; // 'pugs' or 'list_pugs'
        const userId = parts[2];
        let currentPage = parseInt(parts[3]);

        if (interaction.user.id !== userId) {
            const errorEmbed = new EmbedBuilder()
                .setDescription(`> Only <@${userId}> can interact with this button.`)
                .setColor('#D72F2F');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        if (action === 'prev') currentPage -= 1;
        if (action === 'next') currentPage += 1;

        if (type === 'pugs') {
            // Handle `/pugs myvote` pagination
            let [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pugs" ORDER BY created_at DESC', [userId]);

            if (polls.length === 0 || currentPage < 0 || currentPage >= polls.length) {
                const noPollsEmbed = new EmbedBuilder()
                    .setDescription('```ini\nYou do not have any polls```\n')
                    .setColor('#D72F2F');
                return interaction.update({ embeds: [noPollsEmbed], components: [], ephemeral: true });
            }

            const poll = polls[currentPage];
            const status = poll.active ? 'active' : 'inactive';
            const user = interaction.user;

            const pollEmbed = new EmbedBuilder()
                .setAuthor({ name: `${user.username} | PUGS Vote`, iconURL: user.displayAvatarURL() })
                .setDescription(`A vote has been created for <@${poll.user_id}> to join <@&${config.pugsRoleId}>.`)
                .addFields(
                    { name: 'Upvotes 👍', value: `\`\`\`${poll.upvotes}\`\`\``, inline: true },
                    { name: 'Downvotes 👎', value: `\`\`\`${poll.downvotes}\`\`\``, inline: true }
                )
                .setFooter({ text: `Poll ${pollIndex + 1}/${polls.length}`, iconURL: user.displayAvatarURL() })
                .setColor('#b90d1a')
                .setTimestamp();

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`prev_pugs_${userId}_${currentPage}`)
                        .setEmoji('⬅️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId(`next_pugs_${userId}_${currentPage}`)
                        .setEmoji('➡️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === polls.length - 1)
                );

            await interaction.update({ embeds: [pollEmbed], components: [buttons], ephemeral: false });
        } else if (type === 'list_pugs') {
            // Handle `/pugs list` pagination
            const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
            const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);
            const membersWithRole = await interaction.guild.members.fetch();
            const membersArray = membersWithRole.filter(member => member.roles.cache.has(pugsRole.id) || member.roles.cache.has(pugsTrialRole.id)).map(member => member);
            const pageSize = 10;
            const totalPages = Math.ceil(membersArray.length / pageSize);

            if (totalPages === 0 || currentPage < 0 || currentPage >= totalPages) {
                const noMembersEmbed = new EmbedBuilder()
                    .setDescription('```ini\nNo members with PUGS role found.\n```')
                    .setColor('#D72F2F');
                return interaction.update({ embeds: [noMembersEmbed], components: [], ephemeral: true });
            }

            const paginatedMembers = membersArray.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
            const memberList = paginatedMembers.map((member, index) => `\`\`${index + 1 + currentPage * pageSize}.\`\` <@${member.id}>`).join('\n');
            const userPosition = membersArray.findIndex(member => member.id === interaction.user.id) + 1;

            const listEmbed = new EmbedBuilder()
                .setAuthor({ name: 'PUGS List', iconURL: interaction.guild.iconURL() })
                .setDescription(`Mode: **PUGS** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
                .setFooter({ text: `${userPosition}. [${interaction.user.username}]`, iconURL: interaction.user.displayAvatarURL() })
                .setColor('#b90d1a');

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`prev_list_pugs_${userId}_${currentPage}`)
                        .setEmoji('⬅️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId(`next_list_pugs_${userId}_${currentPage}`)
                        .setEmoji('➡️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === totalPages - 1)
                );

            await interaction.update({ embeds: [listEmbed], components: [buttons], ephemeral: false });
        }
    },

    /**
     * Handle adding PUGs role after a successful vote
     * @param {ButtonInteraction} interaction 
     */
    async handleAddToPugsAfterVote(interaction) {
        const customId = interaction.customId;
        const parts = customId.split('_');

        if (parts.length < 4) { // 'add_to_pugs_{userId}'
            logger.warn(`Invalid customId: ${customId}`);
            return;
        }

        const action = `${parts[0]}_${parts[1]}_${parts[2]}`; // 'add_to_pugs'
        const targetUserId = parts.slice(3).join('_'); // Handle any underscores in user IDs

        // Check if the user has the necessary roles
        if (!this.allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
            const embed = new EmbedBuilder()
                .setDescription(`Only people with these roles can use this button:\n${this.allowedRoles.map(roleId => `<@&${roleId}>`).join('\n')}`)
                .setColor(0x980e00);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
        const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);
        const [pollResult] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pugs" AND active = 0', [targetUserId]);

        if (pollResult.length === 0) {
            logger.warn('No completed poll found for the user.');
            return interaction.reply({ content: 'No completed poll found for this user.', ephemeral: true });
        }

        const poll = pollResult[0];
        const member = interaction.guild.members.cache.get(targetUserId);

        if (!member) {
            return interaction.reply({ content: 'User not found in the guild.', ephemeral: true });
        }

        if (member.roles.cache.has(pugsRole.id) || member.roles.cache.has(pugsTrialRole.id)) {
            return interaction.reply({ content: `<@${targetUserId}> already has a PUGS role.`, ephemeral: true });
        }

        try {
            // Assign the appropriate PUGS role
            await member.roles.add(pugsRole);
            logger.info(`Added user ${targetUserId} to PUGS`);

            // Create the embed for the interaction reply
            const replyEmbed = new EmbedBuilder()
                .setDescription(`✅ Successfully added <@${targetUserId}> to <@&${pugsRole.id}>.`)
                .setColor(0x00FF00);

            await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

            // Create the embed for the pugs-voting channel
            const user = member.user;
            const votingEmbed = new EmbedBuilder()
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setTitle("PUGS Addition")
                .setDescription(`<@${targetUserId}> has been added to <@&${pugsRole.id}>.`)
                .addFields(
                    { name: 'Upvotes 👍', value: `\`\`\`${poll.upvotes}\`\`\``, inline: true },
                    { name: 'Downvotes 👎', value: `\`\`\`${poll.downvotes}\`\`\``, inline: true }
                )
                .setFooter({ text: `Added by: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp()
                .setColor(0x00FF00);

            const votingChannel = interaction.guild.channels.cache.get(config.pugsChannelId);
            if (votingChannel) {
                await votingChannel.send({ embeds: [votingEmbed] });
            } else {
                logger.error('PUGS voting channel not found.');
            }
        } catch (error) {
            logger.error('Error adding PUGS role:', error);
            return interaction.reply({ content: 'Error adding PUGS role.', ephemeral: true });
        }
    },

    /**
     * Handle the Vouch Button for PUGS Demotion
     * @param {ButtonInteraction} interaction 
     * @param {number} pollId 
     */
    async handleVouchPugs(interaction, pollId) {
        const reason = interaction.fields.getTextInputValue('reason_input');

        try {
            // Defer the reply to prevent timeout
            await interaction.deferReply({ ephemeral: true });

            // Insert vouch into the database with the parsed pollId
            await pool.execute(
                'INSERT INTO removal_vouches (poll_id, manager_id, reason) VALUES (?, ?, ?)',
                [pollId, interaction.member.id, reason]
            );

            // Get updated vote count
            const [votes] = await pool.execute('SELECT COUNT(*) as count FROM removal_vouches WHERE poll_id = ?', [pollId]);
            const currentVotes = votes[0].count;

            // Fetch poll details including userId and vouchMessageId
            const [pollDetails] = await pool.execute('SELECT * FROM removal_polls WHERE id = ?', [pollId]);
            const userId = pollDetails[0].user_id;
            const vouchMessageId = pollDetails[0].vouch_message_id;
            const pollReason = pollDetails[0].reason;

            // Fetch user and update the vouch message
            let user = interaction.guild.members.cache.get(userId);
            if (!user) {
                try {
                    user = await interaction.guild.members.fetch(userId);
                } catch (fetchError) {
                    return interaction.followUp({ content: `User not found or has left the server.`, ephemeral: true });
                }
            }

            // Determine which role to remove
            const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
            const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);
            const hasPugsRole = user.roles.cache.has(pugsRole.id);
            const hasPugsTrialRole = user.roles.cache.has(pugsTrialRole.id);
            const roleToRemove = hasPugsTrialRole ? pugsTrialRole : pugsRole;

            // Update the vouch message in #pugs-vouching
            const pugsVouchingChannel = interaction.guild.channels.cache.get(config.pugsVouchingChannelId);
            if (!pugsVouchingChannel) {
                logger.error('PUGS Vouching channel not found.');
                return interaction.followUp({ content: 'PUGS Vouching channel not found.', ephemeral: true });
            }

            const vouchMessage = await pugsVouchingChannel.messages.fetch(vouchMessageId);

            // Update the vouch embed
            const updatedVouchEmbed = new EmbedBuilder()
                .setAuthor({ name: user.user.username, iconURL: user.user.displayAvatarURL() })
                .setTitle("PUGS Demotion")
                .setDescription(`A poll has been created for <@${userId}> regarding demotion from <@&${roleToRemove.id}>.`)
                .addFields({ name: 'Vouches', value: `\`\`\`${currentVotes}\`\`\`` })
                .setFooter({ text: 'Click the button to vouch', iconURL: interaction.guild.iconURL() })
                .setColor('#3640b7')
                .setTimestamp();

            await vouchMessage.edit({ embeds: [updatedVouchEmbed] });

            // Handle the final vote
            if (currentVotes >= 6) {
                // Demote the user by removing the role
                const member = interaction.guild.members.cache.get(userId);
                await this.closePreviousPoll(pollId);

                if (member && (hasPugsRole || hasPugsTrialRole)) {
                    await member.roles.remove(roleToRemove);

                    // Update the embed to indicate demotion and disable the vouch button
                    const finalVouchEmbed = new EmbedBuilder()
                        .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                        .setTitle("PUGS Demotion")
                        .setDescription(`**<@${userId}> has been removed from <@&${roleToRemove.id}>.**`)
                        .addFields(
                            { name: 'Vouches', value: `\`\`\`3\`\`\`` },
                            { name: 'Removed by', value: `<@${initiatorId}>`, inline: true }
                        )
                        .setFooter({ text: `${member.user.username} has been demoted`, iconURL: interaction.guild.members.cache.get(initiatorId).user.displayAvatarURL() })
                        .setColor('#e91e63')
                        .setTimestamp();

                    // Create undo and remove buttons
                    const undoButton = new ButtonBuilder()
                        .setCustomId(`undo_pugs_${pollId}`)
                        .setLabel('Undo')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(false);

                    const removeButton = new ButtonBuilder()
                        .setCustomId(`remove_pugs_${pollId}`)
                        .setLabel('Remove')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true); // Initially disabled until undo

                    const vouchButton = new ButtonBuilder()
                        .setCustomId(`vouch_pugs_${pollId}`)
                        .setLabel('Vouch')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true);

                    const row = new ActionRowBuilder().addComponents(vouchButton, removeButton, undoButton);

                    // Update the embed and components in #pugs-vouching
                    await vouchMessage.edit({ embeds: [finalVouchEmbed], components: [row] });

                    // Announce demotion in #pugs-voting
                    const votingChannel = interaction.guild.channels.cache.get(config.pugsChannelId);
                    if (votingChannel) {
                        await votingChannel.send({ embeds: [finalVouchEmbed] });
                    }

                    return interaction.followUp({
                        content: `<@${userId}> has been demoted successfully.`,
                        ephemeral: true
                    });
                } else {
                    return interaction.followUp({ content: 'User no longer has the PUGS role or has left the server.', ephemeral: true });
                }
            } else {
                // Still need more vouches
                return interaction.followUp({
                    content: `Vouched successfully! You need \`${6 - currentVotes}\` more vouches.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            logger.error('Error during vouch process:', error);
            return interaction.followUp({ content: 'An error occurred while processing the vouch.', ephemeral: true });
        }
    },

    /**
     * Close a poll by setting its status to closed
     * @param {number} pollId 
     */
    async closePreviousPoll(pollId) {
        await pool.execute('UPDATE polls SET active = 0 WHERE id = ?', [pollId]);
    },
};
