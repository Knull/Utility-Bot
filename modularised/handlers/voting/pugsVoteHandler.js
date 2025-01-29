// handlers/voting/pugsVoteHandler.js
const { 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder,
    MessageFlags,
    InteractionResponseFlags, 
} = require('discord.js');

const { pool } = require('../../utilities/database');
const config = require('../../config/config');
const logger = require('../../utilities/logger');

// List of roles allowed to use PUGS commands (excluding pups managers)
const allowedRoles = [
    config.pugsManagerRoleId,
    config.premiumManagerRoleId
    // Add more role IDs if necessary
];

// Roles allowed to vote on PUGS polls
const votingAllowedRoles = [
    config.pugsRoleId,
    config.pugsTrialRoleId,
    config.premiumRoleId
];

/**
 * Handle the `/pugs vote` command
 * @param {CommandInteraction} interaction 
 */
const handleVote = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    try {
        const user = interaction.options.getUser('user');
        const type = interaction.options.getString('type'); // 'pugs' or 'pugs_trial'
        const member = interaction.member;

        // Permission check using the allowedRoles list
        if (!allowedRoles.some(roleId => member.roles.cache.has(roleId))) {
            const embed = new EmbedBuilder()
                .setTitle('Missing Role!')
                .setDescription(`Only these members can use this command:\n${allowedRoles
                    .map(roleId => `- <@&${roleId}>`)
                    .join('\n')}`)
                .setColor(0x980e00)
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // Check for existing active poll
        const [rows] = await pool.execute(
            'SELECT * FROM polls WHERE user_id = ? AND type = ? AND active = 1',
            [user.id, type]
        );
        if (rows.length > 0) {
            const embed = new EmbedBuilder()
                .setDescription('A poll is already active for this user.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Insert new poll
        const [result] = await pool.execute(
            'INSERT INTO polls (user_id, type, upvotes, downvotes, active, created_at) VALUES (?, ?, 0, 0, 1, NOW())',
            [user.id, type]
        );

        const pollId = result.insertId;

        // Determine the role ID based on type
        const roleId = type === 'pugs_trial' ? config.pugsTrialRoleId : config.pugsRoleId;

        // Fetch the role to get its color
        const role = interaction.guild.roles.cache.get(roleId);
        const embedColor = role ? role.color : '#e96d6d'; // Default color if role not found

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${user.username} | PUGS Vote`, iconURL: user.displayAvatarURL() })
            .setDescription(`> A vote has been created for <@${user.id}> to join <@&${roleId}>.`)
            .addFields(
                { name: 'Upvotes 👍', value: '```0```', inline: true },
                { name: 'Downvotes 👎', value: '```0```', inline: true }
            )
            .setFooter({ text: `Created by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setColor(embedColor)
            .setTimestamp();

            const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`upvote_${type}_${user.id}`)
                    .setLabel('Upvote')
                    .setEmoji('👍')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`downvote_${type}_${user.id}`)
                    .setLabel('Downvote')
                    .setEmoji('👎')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`end_vote_${type}_${user.id}`)
                    .setLabel('End Vote')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        // Determine the channel ID based on type
        const channelId = type === 'pugs_trial' ? config.pugsTrialChannelId : config.pugsChannelId;
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) {
            logger.error(`PUGS Channel with ID ${channelId} not found.`);
            const errorEmbed = new EmbedBuilder()
                .setDescription('PUGS voting channel not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        const sentMessage = await channel.send({ content: `<@&${roleId}>`, embeds: [embed], components: [buttons] });

        // Update the poll record with the message_id
        await pool.execute('UPDATE polls SET message_id = ? WHERE id = ?', [sentMessage.id, pollId]);

        const successEmbed = new EmbedBuilder()
            .setDescription('Vote created successfully.')
            .setColor(0xe96d6d)
            .setTimestamp();

        return interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
        logger.error('Error handling /pugs vote command:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while creating the vote.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};

/**
 * Common function to handle vote buttons, including changing votes
 * @param {ButtonInteraction} interaction 
 * @param {string} voteType - 'upvote' or 'downvote'
 */
const handleVoteButton = async (interaction, voteType) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const customId = interaction.customId;
        const parts = customId.split('_');

        if (parts.length < 3) {
            logger.warn(`Invalid customId: ${customId}`);
            const embed = new EmbedBuilder()
                .setDescription('Invalid interaction.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const action = parts[0]; // 'upvote' or 'downvote'
        const userId = parts[parts.length - 1]; // Last part is User ID
        const type = parts.slice(1, parts.length - 1).join('_'); // Join the middle parts for type

        // Log the parsed components for debugging
        logger.debug(`Parsed customId - Action: ${action}, Type: ${type}, User ID: ${userId}`);

        if (type !== 'pugs' && type !== 'pugs_trial') {
            logger.warn(`Ignoring non-pugs type: ${type}`);
            const embed = new EmbedBuilder()
                .setDescription('This interaction is not valid for PUGS polls.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // Check if the user has one of the votingAllowedRoles
        if (!votingAllowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
            const embed = new EmbedBuilder()
                .setTitle('No Permission to Vote!')
                .setDescription(`Required roles:\n- ${votingAllowedRoles.map(roleId => `<@&${roleId}>`).join('\n- ')}`)
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // Prevent self-voting
        if (interaction.user.id === userId) {
            const embed = new EmbedBuilder()
                .setDescription('You cannot vote on your own poll.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // Fetch active poll
        const sqlFetchPoll = 'SELECT * FROM polls WHERE user_id = ? AND type = ? AND active = 1';
        logger.debug(`Executing SQL Query: ${sqlFetchPoll} with parameters: [${userId}, ${type}]`);
        const [polls] = await pool.execute(sqlFetchPoll, [userId, type]);
        if (polls.length === 0) {
            logger.warn('No active poll found for the user.');
            const embed = new EmbedBuilder()
                .setDescription('No active poll found for this user.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const poll = polls[0];
        const roleId = type === 'pugs_trial' ? config.pugsTrialRoleId : config.pugsRoleId;

        // Check if the user has already voted
        const sqlCheckVote = 'SELECT * FROM votes WHERE user_id = ? AND poll_id = ?';
        logger.debug(`Executing SQL Query: ${sqlCheckVote} with parameters: [${interaction.user.id}, ${poll.id}]`);
        const [existingVote] = await pool.execute(sqlCheckVote, [interaction.user.id, poll.id]);

        if (existingVote.length > 0) {
            const previousVote = existingVote[0].vote;
            if (previousVote === voteType) {
                const embed = new EmbedBuilder()
                    .setDescription(`You have already ${voteType}d this poll.`)
                    .setColor(0x980e00)
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            } else {
                // User is changing their vote
                try {
                    // Begin transaction
                    const connection = await pool.getConnection();
                    try {
                        await connection.beginTransaction();

                        if (voteType === 'upvote') {
                            const sqlUpdatePoll = 'UPDATE polls SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id = ?';
                            logger.debug(`Executing SQL Query: ${sqlUpdatePoll} with parameters: [${poll.id}]`);
                            await connection.execute(sqlUpdatePoll, [poll.id]);

                            const sqlUpdateVote = 'UPDATE votes SET vote = "upvote" WHERE user_id = ? AND poll_id = ?';
                            logger.debug(`Executing SQL Query: ${sqlUpdateVote} with parameters: [${interaction.user.id}, ${poll.id}]`);
                            await connection.execute(sqlUpdateVote, [interaction.user.id, poll.id]);
                        } else if (voteType === 'downvote') {
                            const sqlUpdatePoll = 'UPDATE polls SET downvotes = downvotes + 1, upvotes = upvotes - 1 WHERE id = ?';
                            logger.debug(`Executing SQL Query: ${sqlUpdatePoll} with parameters: [${poll.id}]`);
                            await connection.execute(sqlUpdatePoll, [poll.id]);

                            const sqlUpdateVote = 'UPDATE votes SET vote = "downvote" WHERE user_id = ? AND poll_id = ?';
                            logger.debug(`Executing SQL Query: ${sqlUpdateVote} with parameters: [${interaction.user.id}, ${poll.id}]`);
                            await connection.execute(sqlUpdateVote, [interaction.user.id, poll.id]);
                        }

                        await connection.commit();
                        logger.info(`User ${interaction.user.id} changed their vote to ${voteType} on poll for user ${userId}`);
                    } catch (error) {
                        await connection.rollback();
                        throw error;
                    } finally {
                        connection.release();
                    }

                    // Fetch updated poll
                    const sqlFetchUpdatedPoll = 'SELECT * FROM polls WHERE id = ?';
                    logger.debug(`Executing SQL Query: ${sqlFetchUpdatedPoll} with parameters: [${poll.id}]`);
                    const [updatedPolls] = await pool.execute(sqlFetchUpdatedPoll, [poll.id]);
                    const updatedPoll = updatedPolls[0];

                    // Update the embed in the voting channel
                    const channelId = type === 'pugs_trial' ? config.pugsTrialChannelId : config.pugsChannelId;
                    const channel = interaction.guild.channels.cache.get(channelId);
                    if (!channel) {
                        logger.error(`PUGS Channel with ID ${channelId} not found.`);
                        const errorEmbed = new EmbedBuilder()
                            .setDescription('PUGS voting channel not found.')
                            .setColor(0x980e00)
                            .setTimestamp();
                        return interaction.editReply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                    }

                    // Fetch the original message to update
                    let targetMember;
                    try {
                        targetMember = await interaction.guild.members.fetch(userId);
                    } catch (err) {
                        targetMember = null;
                        logger.error(`Target member with ID ${userId} not found.`);
                    }

                    if (!targetMember) {
                        const embed = new EmbedBuilder()
                            .setDescription('Target member not found.')
                            .setColor(0x980e00)
                            .setTimestamp();
                        return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }

                    const fetchedMessages = await channel.messages.fetch({ limit: 100 });
                    const message = fetchedMessages.find(msg => 
                        msg.embeds.length > 0 && 
                        msg.embeds[0].author && 
                        msg.embeds[0].author.name === `${targetMember.user.username} | PUGS Vote`
                    );

                    if (!message) {
                        logger.error('Original voting message not found.');
                        const embed = new EmbedBuilder()
                            .setDescription('Original voting message not found.')
                            .setColor(0x980e00)
                            .setTimestamp();
                        return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }

                    const updatedEmbed = EmbedBuilder.from(message.embeds[0])
                        .setDescription(`A vote has been created for <@${userId}> to join <@&${roleId}>.`)
                        .setFields( 
                            { name: 'Upvotes 👍', value: `\`\`\`${updatedPoll.upvotes}\`\`\``, inline: true },
                            { name: 'Downvotes 👎', value: `\`\`\`${updatedPoll.downvotes}\`\`\``, inline: true }
                        )
                        .setTimestamp();

                    await message.edit({ embeds: [updatedEmbed] });

                    const replyEmbed = new EmbedBuilder()
                        .setDescription(`You have cast a **${voteType}**.`)
                        .setColor(0xe96d6d)
                        .setTimestamp();

                    return interaction.editReply({ embeds: [replyEmbed], flags: MessageFlags.Ephemeral });
                } catch (error) {
                    logger.error('Error changing vote:', error);
                    const embed = new EmbedBuilder()
                        .setDescription('An error occurred while changing your vote.')
                        .setColor(0x980e00)
                        .setTimestamp();
                    return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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
                        const sqlUpdatePoll = 'UPDATE polls SET upvotes = upvotes + 1 WHERE id = ?';
                        logger.debug(`Executing SQL Query: ${sqlUpdatePoll} with parameters: [${poll.id}]`);
                        await connection.execute(sqlUpdatePoll, [poll.id]);

                        const sqlInsertVote = 'INSERT INTO votes (user_id, poll_id, vote) VALUES (?, ?, "upvote")';
                        logger.debug(`Executing SQL Query: ${sqlInsertVote} with parameters: [${interaction.user.id}, ${poll.id}]`);
                        await connection.execute(sqlInsertVote, [interaction.user.id, poll.id]);
                    } else if (voteType === 'downvote') {
                        const sqlUpdatePoll = 'UPDATE polls SET downvotes = downvotes + 1 WHERE id = ?';
                        logger.debug(`Executing SQL Query: ${sqlUpdatePoll} with parameters: [${poll.id}]`);
                        await connection.execute(sqlUpdatePoll, [poll.id]);

                        const sqlInsertVote = 'INSERT INTO votes (user_id, poll_id, vote) VALUES (?, ?, "downvote")';
                        logger.debug(`Executing SQL Query: ${sqlInsertVote} with parameters: [${interaction.user.id}, ${poll.id}]`);
                        await connection.execute(sqlInsertVote, [interaction.user.id, poll.id]);
                    }

                    await connection.commit();
                    logger.info(`User ${interaction.user.id} cast a ${voteType} on poll for user ${userId}`);
                } catch (error) {
                    await connection.rollback();
                    throw error;
                } finally {
                    connection.release();
                }

                // Fetch updated poll
                const sqlFetchUpdatedPoll = 'SELECT * FROM polls WHERE id = ?';
                logger.debug(`Executing SQL Query: ${sqlFetchUpdatedPoll} with parameters: [${poll.id}]`);
                const [updatedPolls] = await pool.execute(sqlFetchUpdatedPoll, [poll.id]);
                const updatedPoll = updatedPolls[0];

                // Update the embed in the voting channel
                const channelId = type === 'pugs_trial' ? config.pugsTrialChannelId : config.pugsChannelId;
                const channel = interaction.guild.channels.cache.get(channelId);
                if (!channel) {
                    logger.error(`PUGS Channel with ID ${channelId} not found.`);
                    const errorEmbed = new EmbedBuilder()
                        .setDescription('PUGS voting channel not found.')
                        .setColor(0x980e00)
                        .setTimestamp();
                    return interaction.editReply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                }

                // Fetch the original message to update
                let targetMember;
                try {
                    targetMember = await interaction.guild.members.fetch(userId);
                } catch (err) {
                    targetMember = null;
                    logger.error(`Target member with ID ${userId} not found.`);
                }

                if (!targetMember) {
                    const embed = new EmbedBuilder()
                        .setDescription('Target member not found.')
                        .setColor(0x980e00)
                        .setTimestamp();
                    return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                }

                const fetchedMessages = await channel.messages.fetch({ limit: 100 });
                const message = fetchedMessages.find(msg => 
                    msg.embeds.length > 0 && 
                    msg.embeds[0].author && 
                    msg.embeds[0].author.name === `${targetMember.user.username} | PUGS Vote`
                );

                if (!message) {
                    logger.error('Original voting message not found.');
                    const embed = new EmbedBuilder()
                        .setDescription('Original voting message not found.')
                        .setColor(0x980e00)
                        .setTimestamp();
                    return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                }

                const updatedEmbed = EmbedBuilder.from(message.embeds[0])
                    .setDescription(`A vote has been created for <@${userId}> to join <@&${roleId}>.`)
                    .setFields( 
                        { name: 'Upvotes 👍', value: `\`\`\`${updatedPoll.upvotes}\`\`\``, inline: true },
                        { name: 'Downvotes 👎', value: `\`\`\`${updatedPoll.downvotes}\`\`\``, inline: true }
                    )
                    .setTimestamp();

                await message.edit({ embeds: [updatedEmbed] });

                const replyEmbed = new EmbedBuilder()
                    .setDescription(`You have cast a **${voteType}**.`)
                    .setColor(0xe96d6d)
                    .setTimestamp();

                return interaction.editReply({ embeds: [replyEmbed], flags: MessageFlags.Ephemeral });
            } catch (error) {
                logger.error('Error casting vote:', error);
                const embed = new EmbedBuilder()
                    .setDescription('An error occurred while casting your vote.')
                    .setColor(0x980e00)
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
        }
    } catch (error) {
        logger.error('Error handling vote button:', error);
        const embed = new EmbedBuilder()
            .setDescription('An unexpected error occurred while processing your vote.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};



/**
 * Handle the Upvote button
 * @param {ButtonInteraction} interaction 
 */
const handleUpvote = async (interaction) => {
    await handleVoteButton(interaction, 'upvote');
};

/**
 * Handle the Downvote button
 * @param {ButtonInteraction} interaction 
 */
const handleDownvote = async (interaction) => {
    await handleVoteButton(interaction, 'downvote');
};

/**
 * Handle the End Vote button
 * @param {ButtonInteraction} interaction 
 */
const handleEndVote = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    try {
        const customId = interaction.customId; // e.g., 'end_vote_pugs_trial_536991182035746816'
        const parts = customId.split('_');

        // Expected formats:
        // 'end_vote_pugs_<userId>' => 4 parts
        // 'end_vote_pugs_trial_<userId>' => 5 parts

        if (parts.length < 4) {
            logger.warn(`Invalid customId format for end_vote: ${customId}`);
            const embed = new EmbedBuilder()
                .setDescription('Invalid interaction format.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const action = `${parts[0]}_${parts[1]}`; // 'end_vote'
        let type, targetUserId;

        if (parts.length === 4) {
            // Format: 'end_vote_pugs_<userId>'
            type = parts[2]; // 'pugs'
            targetUserId = parts[3]; // '536991182035746816'
        } else if (parts.length === 5) {
            // Format: 'end_vote_pugs_trial_<userId>'
            type = `${parts[2]}_${parts[3]}`; // 'pugs_trial'
            targetUserId = parts[4]; // '536991182035746816'
        } else {
            // Handle unexpected formats with more than 5 parts
            type = parts.slice(2, -1).join('_'); // Combine all parts except action and pollId
            targetUserId = parts[parts.length - 1]; // Last part is pollId
        }

        // Log the parsed components for debugging
        logger.debug(`Parsed customId - Action: ${action}, Type: ${type}, User ID: ${targetUserId}`);

        if (type !== 'pugs' && type !== 'pugs_trial') {
            logger.warn(`Ignoring non-pugs type: ${type}`);
            const embed = new EmbedBuilder()
                .setDescription('This interaction is not valid for PUGS polls.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Fetch active poll
        const [polls] = await pool.execute(
            'SELECT * FROM polls WHERE user_id = ? AND type = ? AND active = 1',
            [targetUserId, type]
        );

        if (polls.length === 0) {
            logger.warn(`No active poll found for user_id=${targetUserId} and type=${type}`);
            const embed = new EmbedBuilder()
                .setDescription('Poll not found or is already inactive.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const poll = polls[0];
        const roleId = type === 'pugs_trial' ? config.pugsTrialRoleId : config.pugsRoleId;

        // Permission check using the allowedRoles list
        if (!allowedRoles.some(rid => interaction.member.roles.cache.has(rid))) {
            const embed = new EmbedBuilder()
                .setDescription(`Only members with the following roles can end votes:\n${allowedRoles.map(rid => `<@&${rid}>`).join('\n')}`)
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        // Deactivate the poll
        try {
            await pool.execute('UPDATE polls SET active = 0 WHERE id = ?', [poll.id]);
            logger.info(`Poll ID ${poll.id} for user ID ${targetUserId} has been deactivated.`);
        } catch (error) {
            logger.error('Error deactivating poll:', error);
            const embed = new EmbedBuilder()
                .setDescription('An error occurred while ending the vote.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        const upvotes = poll.upvotes;
        const downvotes = poll.downvotes;
        const voteWon = upvotes > downvotes;
        const resultColor = voteWon ? '#00FF00' : '#FF0000';

        // Disable all buttons in the original message
        const disabledButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`upvote_${type}_${targetUserId}`)
                .setLabel('Upvote')
                .setEmoji('👍')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`downvote_${type}_${targetUserId}`)
                .setLabel('Downvote')
                .setEmoji('👎')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`end_vote_${type}_${targetUserId}`)
                .setLabel('End Vote')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        // Determine the channel ID based on type
        const channelId = type === 'pugs_trial' ? config.pugsTrialChannelId : config.pugsChannelId;
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) {
            logger.error(`PUGS Channel with ID ${channelId} not found.`);
            const embed = new EmbedBuilder()
                .setDescription('PUGS voting channel not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Fetch the target member
        let targetMember;
        try {
            targetMember = await interaction.guild.members.fetch(targetUserId);
        } catch (err) {
            targetMember = null;
            logger.error(`Target member with ID ${targetUserId} not found.`);
        }

        if (!targetMember) {
            const embed = new EmbedBuilder()
                .setDescription('Target member not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        // Fetch the original voting message using message_id
        const messageId = poll.message_id;
        if (!messageId) {
            logger.error(`Poll with ID ${poll.id} does not have a message_id.`);
            const embed = new EmbedBuilder()
                .setDescription('Original voting message ID not found in the database.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        let originalMessage;
        try {
            originalMessage = await channel.messages.fetch(messageId);
        } catch (err) {
            originalMessage = null;
            logger.error(`Could not fetch message with ID ${messageId}:`, err);
        }

        if (!originalMessage) {
            const embed = new EmbedBuilder()
                .setDescription('Original voting message not found in the channel.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Update the embed with the final vote counts
        const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0])
            .setDescription(`A vote has been created for <@${targetUserId}> to join <@&${roleId}>.`)
            .setFields( 
                { name: 'Upvotes 👍', value: `\`\`\`${upvotes}\`\`\``, inline: true },
                { name: 'Downvotes 👎', value: `\`\`\`${downvotes}\`\`\``, inline: true }
            )
            .setTimestamp();

        await originalMessage.edit({ embeds: [updatedEmbed], components: [disabledButtons] });
        logger.info(`Updated voting message for poll ID ${poll.id}. Buttons disabled.`);

        // Create a result embed
        const resultEmbed = new EmbedBuilder()
            .setAuthor({ name: `${targetMember.user.username} | PUGS Vote Results`, iconURL: targetMember.user.displayAvatarURL() })
            .setDescription(`**Upvotes 👍:** \`\`\`${upvotes}\`\`\`\n**Downvotes 💔:** \`\`\`${downvotes}\`\`\`\n<@${targetUserId}> has **${voteWon ? 'won' : 'lost'}** the vote!`)
            .setColor(resultColor)
            .setFooter({ 
                text: `Created by ${originalMessage.embeds[0].footer.text.replace('Created by ', '')}`, 
                iconURL: originalMessage.embeds[0].footer.iconURL 
            })
            .setTimestamp();

        // Add the "Add to Pugs/Pugs Trial" button if the vote was won
        let actionButtons;
        if (voteWon) {
            actionButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`add_to_pugs_${type}_${poll.id}`)
                    .setLabel('Add to Pugs')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✅') // Checkmark emoji
            );
        } else {
            // Add a disabled "Add to Pugs" button
            actionButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`add_to_pugs_${type}_${poll.id}`)
                    .setLabel('Add to Pugs')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✅') // Checkmark emoji
                    .setDisabled(true)
            );
        }

        await interaction.editReply({ embeds: [resultEmbed], components: [actionButtons] });
        logger.info(`Poll ID ${poll.id} ended. Vote Won: ${voteWon}`);
    } catch (error) {
        logger.error('Error handling end_vote interaction:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while ending the vote.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};


/**
 * Handle the `/pugs create` command for managers to create their own PUGS votes
 * @param {CommandInteraction} interaction 
 */
const handleCreate = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.user;
    const member = interaction.member;
    const type = interaction.options.getString('type'); // 'pugs' or 'pugs_trial'

    // Permission check using the allowedRoles list
    if (!allowedRoles.some(roleId => member.roles.cache.has(roleId))) {
        const embed = new EmbedBuilder()
            .setTitle('Missing Role!')
            .setDescription(`Only these members can use this command:\n${allowedRoles
                .map(roleId => `- <@&${roleId}>`)
                .join('\n')}`)
            .setColor(0x980e00)
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }

    try {
        // Check if the user already has an active poll
        const [activePolls] = await pool.execute(
            'SELECT * FROM polls WHERE user_id = ? AND type = ? AND active = 1',
            [user.id, type]
        );
        if (activePolls.length > 0) {
            const embed = new EmbedBuilder()
                .setDescription('You already have an active PUGS poll.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Check if the user is already PUGS or PREMIUM
        let memberData;
        try {
            memberData = await interaction.guild.members.fetch(user.id);
        } catch (err) {
            memberData = null;
            logger.error(`Member data for user ID ${user.id} not found.`);
        }

        if (!memberData) {
            const embed = new EmbedBuilder()
                .setDescription('Member data not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const isPugs = memberData.roles.cache.has(config.pugsRoleId);
        const isPugsTrial = memberData.roles.cache.has(config.pugsTrialRoleId);
        const isPremium = memberData.roles.cache.has(config.premiumRoleId);

        if (isPugs || isPugsTrial || isPremium) {
            const embed = new EmbedBuilder()
                .setDescription('You cannot create a PUGS poll while holding PUGS, PUGS Trial, or PREMIUM roles.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Create new poll
        const [result] = await pool.execute(
            'INSERT INTO polls (user_id, type, upvotes, downvotes, active, created_at) VALUES (?, ?, 0, 0, 1, NOW())',
            [user.id, type]
        );

        const pollId = result.insertId;

        // Determine the role ID based on type
        const roleId = type === 'pugs_trial' ? config.pugsTrialRoleId : config.pugsRoleId;

        // Fetch the role to get its color
        const role = interaction.guild.roles.cache.get(roleId);
        const embedColor = role ? role.color : '#e96d6d'; // Default color if role not found

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${user.username} | PUGS Vote`, iconURL: user.displayAvatarURL() })
            .setDescription(`You have initiated a vote to join <@&${roleId}>.`)
            .addFields(
                { name: 'Upvotes 👍', value: '```0```', inline: true },
                { name: 'Downvotes 👎', value: '```0```', inline: true }
            )
            .setFooter({ text: `Created by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setColor(embedColor)
            .setTimestamp();

            const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`upvote_${type}_${user.id}`)
                    .setLabel('Upvote')
                    .setEmoji('👍')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`downvote_${type}_${user.id}`)
                    .setLabel('Downvote')
                    .setEmoji('👎')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`end_vote_${type}_${user.id}`)
                    .setLabel('End Vote')
                    .setStyle(ButtonStyle.Secondary)
            );
        

        // Determine the channel ID based on type
        const channelId = type === 'pugs_trial' ? config.pugsTrialChannelId : config.pugsChannelId;
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) {
            logger.error(`PUGS Channel with ID ${channelId} not found.`);
            const errorEmbed = new EmbedBuilder()
                .setDescription('PUGS voting channel not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        const sentMessage = await channel.send({ content: `<@&${roleId}>`, embeds: [embed], components: [buttons] });

        // Update the poll record with the message_id
        await pool.execute('UPDATE polls SET message_id = ? WHERE id = ?', [sentMessage.id, pollId]);

        const successEmbed = new EmbedBuilder()
            .setDescription('Your PUGS vote has been created successfully.')
            .setColor(0xe96d6d)
            .setTimestamp();

        return interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
        logger.error('Error creating PUGS poll:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while creating your PUGS poll.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};

/**
 * Handle the `/pugs list` command
 * @param {CommandInteraction} interaction 
 */
const handleList = async (interaction) => {
    try {
        // Defer the reply to give the bot more time to process
        await interaction.deferReply({ ephemeral: false });

        // Fetch the PUGS and PUGS Trial roles from the guild
        const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
        const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);

        if (!pugsRole || !pugsTrialRole) {
            logger.error(`PUGS Role(s) not found.`);
            const embed = new EmbedBuilder()
                .setDescription('PUGS or PUGS Trial role not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Fetch all guild members (requires GUILD_MEMBERS intent)
        await interaction.guild.members.fetch();

        // Access the members with the PUGS and PUGS Trial roles from the cache
        const membersWithPugs = pugsRole.members;
        const membersWithPugsTrial = pugsTrialRole.members;

        const combinedMembers = new Set([...membersWithPugs.values(), ...membersWithPugsTrial.values()]);

        const membersArray = Array.from(combinedMembers);
        const pageSize = 10;
        const totalPages = Math.ceil(membersArray.length / pageSize);

        // Debugging Log
        logger.info(`Total members with PUGS or PUGS Trial roles: ${membersArray.length}`);

        if (totalPages === 0) {
            const noMembersEmbed = new EmbedBuilder()
                .setDescription('```ini\nNo members with PUGS or PUGS Trial roles found.\n```')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [noMembersEmbed] });
        }

        const currentPage = 0; // Start with the first page
        const paginatedMembers = membersArray.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

        const memberList = paginatedMembers.map((member, index) => `\`\`${index + 1 + currentPage * pageSize}.\`\` <@${member.id}>`).join('\n');
        const userPosition = membersArray.findIndex(member => member.id === interaction.user.id) + 1;

        // Determine the color based on the roles the member has
        let embedColor = 0xe96d6d; // Default color
        if (membersArray.length > 0) {
            const firstMember = membersArray[0];
            if (firstMember.roles.cache.has(pugsRole.id)) {
                embedColor = pugsRole.color || 0xe96d6d;
            } else if (firstMember.roles.cache.has(pugsTrialRole.id)) {
                embedColor = pugsTrialRole.color || 0xe96d6d;
            }
        }

        const listEmbed = new EmbedBuilder()
            .setAuthor({ name: 'PUGS List', iconURL: interaction.guild.iconURL() })
            .setDescription(`Mode: **PUGS** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
            .setFooter({ text: `${userPosition}. ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setColor(embedColor)
            .setTimestamp();

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

        await interaction.editReply({ embeds: [listEmbed], components: [buttons] });
    } catch (error) {
        logger.error('Error handling /pugs list command:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while fetching the PUGS list.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};

/**
 * Handle pagination for the PUGS list
 * @param {ButtonInteraction} interaction 
 */
const handlePagination = async (interaction) => {
    const customId = interaction.customId; // e.g., 'next_list_pugs_<userId>_<currentPage>'
    const parts = customId.split('_');

    if (parts.length < 5) {
        logger.warn(`Invalid customId format for pagination: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid pagination interaction.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const action = parts[0]; // 'next' or 'prev'
    const type = parts[1]; // 'list'
    const roleType = parts[2]; // 'pugs'
    const userId = parts[3]; // User ID
    let currentPage = parseInt(parts[4], 10); // Current page index

    // Verify that the user interacting is the initiator
    if (interaction.user.id !== userId) {
        const embed = new EmbedBuilder()
            .setDescription(`> Only <@${userId}> can interact with these buttons.`)
            .setColor('#D72F2F')
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Fetch the PUGS and PUGS Trial roles
    const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
    const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);
    if (!pugsRole || !pugsTrialRole) {
        logger.error(`PUGS Role(s) not found.`);
        const embed = new EmbedBuilder()
            .setDescription('PUGS or PUGS Trial role not found.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
        // Fetch all guild members (requires GUILD_MEMBERS intent)
        await interaction.guild.members.fetch();

        // Access the members with the PUGS and PUGS Trial roles from the cache
        const membersWithPugs = pugsRole.members;
        const membersWithPugsTrial = pugsTrialRole.members;

        const combinedMembers = new Set([...membersWithPugs.values(), ...membersWithPugsTrial.values()]);
        const membersArray = Array.from(combinedMembers);
        const pageSize = 10;
        const totalPages = Math.ceil(membersArray.length / pageSize);

        if (membersArray.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('No members have the PUGS or PUGS Trial roles.')
                .setColor(0xFFD700)
                .setTimestamp();
            return interaction.update({ embeds: [embed], components: [] });
        }

        // Adjust currentPage based on action
        if (action === 'next') {
            currentPage += 1;
        } else if (action === 'prev') {
            currentPage -= 1;
        } else {
            logger.warn(`Unknown pagination action: ${action}`);
            const embed = new EmbedBuilder()
                .setDescription('Unknown pagination action.')
                .setColor(0xFFD700)
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Ensure currentPage is within bounds after increment/decrement
        if (currentPage < 0) currentPage = 0;
        if (currentPage >= totalPages) currentPage = totalPages - 1;

        const paginatedMembers = membersArray.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
        const memberList = paginatedMembers.map((member, index) => `\`\`${index + 1 + currentPage * pageSize}.\`\` <@${member.id}>`).join('\n');

        const userPosition = membersArray.findIndex(member => member.id === interaction.user.id) + 1;

        // Determine the color based on the roles the member has
        let embedColor = 0xe96d6d; // Default color
        if (paginatedMembers.length > 0) {
            const firstMember = paginatedMembers[0];
            if (firstMember.roles.cache.has(pugsRole.id)) {
                embedColor = pugsRole.color || 0xe96d6d;
            } else if (firstMember.roles.cache.has(pugsTrialRole.id)) {
                embedColor = pugsTrialRole.color || 0xe96d6d;
            }
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'PUGS List', iconURL: interaction.guild.iconURL() })
            .setDescription(`Mode: **PUGS** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
            .setFooter({ text: `${userPosition}. ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setColor(embedColor)
            .setTimestamp();

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

        // Update the original message with the new embed and updated buttons
        await interaction.update({ embeds: [embed], components: [buttons] });

        logger.info(`PUGS list pagination: user ${userId} navigated to page ${currentPage + 1}/${totalPages}`);
    } catch (error) {
        logger.error('Error handling pagination:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while handling pagination.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
/**
 * Handle the `/pugs add` command
 * @param {CommandInteraction} interaction 
 */
const handleAdd = async (interaction) => {
    await interaction.deferReply({ ephemeral: false });

    const user = interaction.options.getUser('user');
    const type = interaction.options.getString('type'); // 'pugs' or 'pugs_trial'
    const executor = interaction.member;

    // Permission check using the allowedRoles list
    if (!allowedRoles.some(roleId => executor.roles.cache.has(roleId))) {
        const embed = new EmbedBuilder()
            .setTitle('No Permission!')
            .setDescription(`You need one of the following roles to use this command:\n- ${allowedRoles.map(roleId => `<@&${roleId}>`).join('\n- ')}`)
            .setColor(0x980e00);

        return interaction.editReply({ embeds: [embed] });
    }

    // Validate the type
    if (type !== 'pugs' && type !== 'pugs_trial') {
        const embed = new EmbedBuilder()
            .setDescription('Invalid type specified. Please choose either `pugs` or `pugs_trial`.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    try {
        const member = await interaction.guild.members.fetch(user.id);
        const roleId = type === 'pugs_trial' ? config.pugsTrialRoleId : config.pugsRoleId;
        const role = interaction.guild.roles.cache.get(roleId);

        if (!role) {
            logger.error(`PUGs Role with ID ${roleId} not found.`);
            const embed = new EmbedBuilder()
                .setDescription('PUGs role not found. Please contact an administrator.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        if (member.roles.cache.has(role.id)) {
            const embed = new EmbedBuilder()
                .setDescription(`> <@${user.id}> is already <@&${roleId}>.`)
                .setColor(0xFFD700);
            return interaction.editReply({ embeds: [embed] });
        }

        await member.roles.add(role);

        // Optional: Log the addition in a specific channel
        const announcementChannel = interaction.guild.channels.cache.get(config.pugsChannelId);
        if (announcementChannel) {
            const announcementEmbed = new EmbedBuilder()
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setTitle('PUGS Addition')
                .setDescription(`> <@${user.id}> has been added to <@&${roleId}>.\n- **Added By:** <@${interaction.user.id}>.`)
                .setColor(role.color || 0x00FF00);

            await announcementChannel.send({ embeds: [announcementEmbed] }).then(sentMessage => {
                sentMessage.react('🔥'); // Fire emoji for addition
            });
        }

        // Confirmation Embed
        const successEmbed = new EmbedBuilder()
            .setDescription(`> Successfully added <@${user.id}> to <@&${roleId}>.`)
            .setColor(0x00FF00)
            .setTimestamp();

        return interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
        logger.error('Error adding PUGs role:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while adding the PUGs role.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};

/**
 * Handle the `/pugs remove` command
 * @param {CommandInteraction} interaction 
 */
const handleRemove = async (interaction) => {
    await interaction.deferReply({ ephemeral: false });

    const user = interaction.options.getUser('user');
    const type = interaction.options.getString('type'); // 'pugs' or 'pugs_trial' (optional, if needed)
    const executor = interaction.member;

    // Permission check using the allowedRoles list
    if (!allowedRoles.some(roleId => executor.roles.cache.has(roleId))) {
        const embed = new EmbedBuilder()
            .setTitle('No Permission')
            .setDescription(`You need one of the following roles to use this command:\n- ${allowedRoles.map(roleId => `<@&${roleId}>`).join('\n- ')}`)
            .setColor(0x980e00);

        return interaction.editReply({ embeds: [embed] });
    }

    // Validate the type if provided
    if (type && type !== 'pugs' && type !== 'pugs_trial') {
        const embed = new EmbedBuilder()
            .setDescription('Invalid type specified. Please choose either `pugs` or `pugs_trial`.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    try {
        const member = await interaction.guild.members.fetch(user.id);
        let rolesToRemove = [];

        if (type) {
            // Specific type removal
            const roleId = type === 'pugs_trial' ? config.pugsTrialRoleId : config.pugsRoleId;
            const role = interaction.guild.roles.cache.get(roleId);

            if (!role) {
                logger.error(`PUGs Role with ID ${roleId} not found.`);
                const embed = new EmbedBuilder()
                    .setDescription('PUGs role not found. Please contact an administrator.')
                    .setColor(0x980e00)
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }

            if (!member.roles.cache.has(role.id)) {
                const embed = new EmbedBuilder()
                    .setDescription(`> <@${user.id}> does not have the <@&${roleId}> role.`)
                    .setColor(0xFFD700);
                return interaction.editReply({ embeds: [embed] });
            }

            rolesToRemove.push(role);
        } else {
            // Remove both pugs and pugs_trial roles if no type is specified
            const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
            const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);

            if (!pugsRole || !pugsTrialRole) {
                logger.error(`PUGs Role(s) not found.`);
                const embed = new EmbedBuilder()
                    .setDescription('PUGs or PUGs Trial role not found.')
                    .setColor(0x980e00)
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }

            if (!member.roles.cache.has(pugsRole.id) && !member.roles.cache.has(pugsTrialRole.id)) {
                const embed = new EmbedBuilder()
                    .setDescription(`> <@${user.id}> does not have any PUGs roles.`)
                    .setColor(0xFFD700);
                return interaction.editReply({ embeds: [embed] });
            }

            if (member.roles.cache.has(pugsRole.id)) rolesToRemove.push(pugsRole);
            if (member.roles.cache.has(pugsTrialRole.id)) rolesToRemove.push(pugsTrialRole);
        }

        // Remove roles
        await member.roles.remove(rolesToRemove);

        // Optional: Log the removal in a specific channel
        const announcementChannel = interaction.guild.channels.cache.get(config.pugsChannelId);
        if (announcementChannel) {
            rolesToRemove.forEach(role => {
                const announcementEmbed = new EmbedBuilder()
                    .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                    .setTitle('PUGS Removal')
                    .setDescription(`> <@${user.id}> has been removed from <@&${role.id}>.\n- **Removed By:** <@${interaction.user.id}>.`)
                    .setColor(role.color || 0xFF0000)
                    .setTimestamp();

                announcementChannel.send({ embeds: [announcementEmbed] }).then(sentMessage => {
                    sentMessage.react('💔'); // Heart emoji for removal
                });
            });
        }

        // Confirmation Embed
        const successEmbed = new EmbedBuilder()
            .setDescription(`> Successfully removed ${rolesToRemove.map(role => `<@&${role.id}>`).join(' and ')} from <@${user.id}>.`)
            .setColor(0xFF0000);

        return interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
        logger.error('Error removing PUGs role:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while removing the PUGs role.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};


/**
 * Handle the Add to Pugs/Pugs Trial button
 * @param {ButtonInteraction} interaction 
 */
const handleAddToPugs = async (interaction) => {
    // Define the action prefix
    const actionPrefix = 'add_to_pugs_';

    // Replace deprecated 'ephemeral' with flags
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customId = interaction.customId; // e.g., 'add_to_pugs_pugs_trial_179'

    // Check if customId starts with the action prefix
    if (!customId.startsWith(actionPrefix)) {
        logger.warn(`Invalid customId prefix for add_to_pugs: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid interaction prefix.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Remove the action prefix and split the remaining string
    const remaining = customId.slice(actionPrefix.length); // 'pugs_trial_179'
    const parts = remaining.split('_'); // ['pugs', 'trial', '179']

    // At least type and pollId should be present
    if (parts.length < 2) {
        logger.warn(`Invalid customId format after prefix for add_to_pugs: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid interaction format.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Extract type and pollId
    const pollId = parts.pop(); // '179'
    const type = parts.join('_'); // 'pugs_trial'

    // Log the parsed components for debugging
    logger.debug(`Parsed customId - Type: ${type}, Poll ID: ${pollId}`);

    // Validate the type
    if (type !== 'pugs' && type !== 'pugs_trial') {
        logger.warn(`Ignoring non-pugs type: ${type}`);
        const embed = new EmbedBuilder()
            .setDescription('This interaction is not valid for PUGS polls.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    try {
        // Fetch poll details using pollId and type
        const [polls] = await pool.execute(
            'SELECT * FROM polls WHERE id = ? AND type = ? AND active = 0',
            [pollId, type]
        );

        if (polls.length === 0) {
            logger.warn(`Poll not found or is still active for poll_id=${pollId} and type=${type}`);
            const embed = new EmbedBuilder()
                .setDescription('Poll not found or is still active.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const poll = polls[0];
        const userId = poll.user_id;
        const roleId = type === 'pugs_trial' ? config.pugsTrialRoleId : config.pugsRoleId;

        // Permission check using the allowedRoles list
        if (!allowedRoles.some(rid => interaction.member.roles.cache.has(rid))) {
            const embed = new EmbedBuilder()
                .setDescription(`Only members with the following roles can use this button:\n${allowedRoles.map(rid => `<@&${rid}>`).join('\n')}`)
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // Fetch the target member
        let member;
        try {
            member = await interaction.guild.members.fetch(userId);
        } catch (err) {
            member = null;
            logger.error(`Target member with ID ${userId} not found.`);
        }

        if (!member) {
            const embed = new EmbedBuilder()
                .setDescription('Target member not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // Check if the member already has the role
        if (member.roles.cache.has(roleId)) {
            const embed = new EmbedBuilder()
                .setDescription(`> <@${userId}> is already <@&${roleId}>.`)
                .setColor(0xFFD700);
            return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // Add the role to the member
        await member.roles.add(roleId);

        // Fetch the original voting message using message_id
        const messageId = poll.message_id;
        if (!messageId) {
            logger.error(`Poll with ID ${poll.id} does not have a message_id.`);
            const embed = new EmbedBuilder()
                .setDescription('Original voting message ID not found in the database.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const channelId = type === 'pugs_trial' ? config.pugsTrialChannelId : config.pugsChannelId;
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) {
            logger.error(`PUGS Channel with ID ${channelId} not found.`);
            const embed = new EmbedBuilder()
                .setDescription('PUGS voting channel not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        let originalMessage;
        try {
            originalMessage = await channel.messages.fetch(messageId);
        } catch (err) {
            originalMessage = null;
            logger.error(`Could not fetch message with ID ${messageId}:`, err);
        }

        if (!originalMessage) {
            const embed = new EmbedBuilder()
                .setDescription('Original voting message not found in the channel.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // Prepare the new embed for addition
        const additionEmbed = new EmbedBuilder()
            .setAuthor({ name: `${member.user.username}`, iconURL: member.user.displayAvatarURL() })
            .setTitle('PUGS Addition')
            .setDescription(`> <@${userId}> has been added to <@&${roleId}>.\n- **Added By:** <@${interaction.user.id}>`)
            .setColor('#e96d6d') // Adjust color as needed
            .setTimestamp();

        // Send the new message as a reply to the original vote message
        const sentAdditionMessage = await channel.send({
            embeds: [additionEmbed],
            reply: { messageReference: originalMessage.id }
        });

        // React to the new message with fire emoji
        await sentAdditionMessage.react('🔥');

        // Send a confirmation to the user who clicked the button
        const confirmationEmbed = new EmbedBuilder()
            .setDescription(`> <@${userId}> has been successfully added to <@&${roleId}>.`)
            .setColor(0x00FF00)
            .setTimestamp();
        await interaction.editReply({ embeds: [confirmationEmbed], flags: MessageFlags.Ephemeral });

        logger.info(`Added <@${userId}> to <@&${roleId}> via poll ID ${pollId}.`);
    } catch (error) {
        logger.error(`Error in handleAddToPugs: ${error}`);
        const embed = new EmbedBuilder()
            .setDescription('An unexpected error occurred while processing your request.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};
/**
 * Handle the `/pugs myvote` command
 * @param {CommandInteraction} interaction
 */
const handleMyVote = async (interaction) => {
    await interaction.deferReply();

    try {
        const userId = interaction.user.id;
        const [polls] = await pool.execute(
            'SELECT * FROM polls WHERE user_id = ? AND type IN ("pugs", "pugs_trial") ORDER BY created_at DESC',
            [userId]
        );

        if (polls.length === 0) {
            const noPollsEmbed = new EmbedBuilder()
                .setDescription('```ini\nYou do not have any polls```')
                .setColor('#D72F2F')
                .setTimestamp();
            return interaction.editReply({ embeds: [noPollsEmbed] });
        }

        const totalPages = polls.length;
        let currentPage = 0; // Start with the most recent poll
        const poll = polls[currentPage];
        const status = poll.active ? 'active' : 'inactive';
        const user = interaction.user;

        // Calculate Poll ID "relative to user" if you want, but that’s just a label
        const pollIdLabel = totalPages - currentPage; 
        // or pollIdLabel = currentPage + 1, whichever you prefer

        // Determine the role ID based on poll type
        const roleId = (poll.type === 'pugs_trial') ? config.pugsTrialRoleId : config.pugsRoleId;
        const role = interaction.guild.roles.cache.get(roleId);
        const embedColor = role ? role.color : '#e96d6d';

        // Determine the embed author text based on poll type
        const embedAuthorText = (poll.type === 'pugs_trial') ? 'PUGS Trial Vote' : 'PUGS Vote';

        const pollEmbed = new EmbedBuilder()
            .setAuthor({ name: `${user.username} | ${embedAuthorText}`, iconURL: user.displayAvatarURL() })
            .setDescription(
                `- **Poll ID** relative to user: \`${pollIdLabel}\`\n` +
                `> **Status:** This poll is currently __\`${status}\`__.\u00A0\u00A0\u00A0\u00A0\u00A0`
            )
            .addFields(
                { name: 'Upvotes 👍',   value: `\`\`\`${poll.upvotes}\`\`\``,   inline: true },
                { name: 'Downvotes 👎', value: `\`\`\`${poll.downvotes}\`\`\``, inline: true }
            )
            .setFooter({ 
                text: `Poll 1/${polls.length}`, 
                iconURL: user.displayAvatarURL() 
            })
            .setColor(embedColor)
            .setTimestamp();

        // Notice the "View Votes" button changed to:
        // myvote_viewvotes_<poll.id>
        // That’s all we need to fetch the poll by ID.
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev_myvote_pugs_${userId}_${currentPage}_${poll.type}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`myvote_viewvotes_${poll.id}`)
                    .setEmoji('🔍')
                    .setLabel('View Votes')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`next_myvote_pugs_${userId}_${currentPage}_${poll.type}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === totalPages - 1)
            );

        await interaction.editReply({
            embeds: [pollEmbed],
            components: [buttons]
        });

    } catch (error) {
        logger.error('Error handling /pugs myvote command:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while fetching your polls.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};


/**
 * Handle pagination for the /pugs myvote command
 * @param {ButtonInteraction} interaction 
 */
const handleMyVotePagination = async (interaction) => {
    const customId = interaction.customId; 
    // e.g. "next_myvote_pugs_<userId>_<currentPage>_<poll.type>"
    const parts = customId.split('_');

    if (parts.length < 6) {
        logger.warn(`Invalid customId format for myvote pagination: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid pagination interaction.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const action      = parts[0]; // 'next' or 'prev'
    const type        = parts[1]; // 'myvote'
    const pollType    = parts[2]; // 'pugs' or 'pugs_trial'
    const initiatorId = parts[3]; // userId
    let currentPage   = parseInt(parts[4], 10);
    // parts[5] = poll.type again, but you might not even need it

    // Check permission
    if (interaction.user.id !== initiatorId) {
        const embed = new EmbedBuilder()
            .setDescription(`> Only <@${initiatorId}> can use these buttons.`)
            .setColor('#D72F2F')
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
        // Re-fetch the user's polls
        const [polls] = await pool.execute(
            'SELECT * FROM polls WHERE user_id = ? AND type IN ("pugs", "pugs_trial") ORDER BY created_at DESC',
            [initiatorId]
        );

        if (polls.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('You do not have any polls.')
                .setColor(0xFFD700)
                .setTimestamp();
            return interaction.update({ embeds: [embed], components: [] });
        }

        const totalPages = polls.length;

        // Adjust currentPage
        if (action === 'next') {
            currentPage++;
        } else if (action === 'prev') {
            currentPage--;
        } else {
            logger.warn(`Unknown pagination action: ${action}`);
            const embed = new EmbedBuilder()
                .setDescription('Unknown pagination action.')
                .setColor(0xFFD700)
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Clamp the page in [0, totalPages-1]
        if (currentPage < 0) currentPage = 0;
        if (currentPage >= totalPages) currentPage = totalPages - 1;

        const poll = polls[currentPage];
        const status = poll.active ? 'active' : 'inactive';
        const pollIndexLabel = currentPage + 1; 

        // Determine embed color
        const roleId = (poll.type === 'pugs_trial') 
            ? config.pugsTrialRoleId 
            : config.pugsRoleId;
        const role = interaction.guild.roles.cache.get(roleId);
        const embedColor = role ? role.color : '#e96d6d';

        const embedAuthorText = (poll.type === 'pugs_trial')
            ? 'PUGS Trial Vote'
            : 'PUGS Vote';

        const pollEmbed = new EmbedBuilder()
            .setAuthor({
                name: `${interaction.user.username} | ${embedAuthorText}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            })
            .setDescription(`**Poll ID:** \`${pollIndexLabel}\`\n> **Status:** This poll is currently __\`${status}\`__`)
            .addFields(
                { name: 'Upvotes 👍',   value: `\`\`\`${poll.upvotes   || 0}\`\`\``, inline: true },
                { name: 'Downvotes 👎', value: `\`\`\`${poll.downvotes || 0}\`\`\``, inline: true }
            )
            .setFooter({
                text: `Poll ${pollIndexLabel}/${totalPages}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            })
            .setColor(embedColor)
            .setTimestamp();

        // Notice the "View Votes" button uses poll.id
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev_myvote_pugs_${initiatorId}_${currentPage}_${poll.type}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`myvote_viewvotes_${poll.id}`)
                    .setLabel('View Votes')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔍'),
                new ButtonBuilder()
                    .setCustomId(`next_myvote_pugs_${initiatorId}_${currentPage}_${poll.type}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === totalPages - 1)
            );

        await interaction.update({
            embeds: [pollEmbed],
            components: [buttons]
        });

        logger.info(`PUGS myvote pagination: user ${initiatorId} navigated to poll ${pollIndexLabel}/${totalPages}`);

    } catch (error) {
        logger.error('Error handling myvote pagination:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while handling pagination.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};  


/**
 * Handle the "myvote_viewvotes_<pollId>" button
 * @param {ButtonInteraction} interaction
 */
const handleMyVoteViewVotes = async (interaction) => {
    try {
        // We can do ephemeral so only the user sees the up/downvoters
        await interaction.deferReply({ ephemeral: true });

        const customId = interaction.customId; // e.g. "myvote_viewvotes_179"
        const parts = customId.split('_');
        if (parts.length !== 3) {
            logger.warn(`Invalid customId for myvote_viewvotes button: ${customId}`);
            const embed = new EmbedBuilder()
                .setDescription('Invalid view votes interaction.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const pollId = parts[2]; // "179", etc.

        // Fetch the poll by ID
        const [rows] = await pool.execute(
            'SELECT * FROM polls WHERE id = ?',
            [pollId]
        );

        if (rows.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('Poll not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const poll = rows[0];

        // If you want to ensure the clicker is the poll owner:
        if (poll.user_id !== interaction.user.id) {
            const embed = new EmbedBuilder()
                .setDescription('You do not own this poll.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Retrieve upvoters/downvoters
        const [upvoters] = await pool.execute(
            'SELECT user_id FROM votes WHERE poll_id = ? AND vote = "upvote"',
            [pollId]
        );
        const [downvoters] = await pool.execute(
            'SELECT user_id FROM votes WHERE poll_id = ? AND vote = "downvote"',
            [pollId]
        );

        const upvoteMentions = upvoters.length
            ? upvoters.map(v => `- <@${v.user_id}>`).join('\n')
            : '• No upvotes yet.';
        const downvoteMentions = downvoters.length
            ? downvoters.map(v => `- <@${v.user_id}>`).join('\n')
            : '• No downvotes yet.';

        // Build an embed
        const embed = new EmbedBuilder()
            .setTitle(`Votes for Poll #${poll.id}`)
            .addFields(
                { name: 'Upvotes 👍',    value: upvoteMentions,    inline: true },
                { name: 'Downvotes 👎', value: downvoteMentions,  inline: true }
            )
            .setColor('#2b2d31')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [] });

    } catch (error) {
        logger.error('Error in handleMyVoteViewVotes:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while viewing the votes.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};


/**
 * Handle the Add to Pugs/Pugs Trial button in the voting result message
 * @param {ButtonInteraction} interaction 
 */
const handleAddToPugsButton = async (interaction) => {
    await handleAddToPugs(interaction);
};

// Export all handlers and necessary properties
module.exports = {
    allowedRoles,
    votingAllowedRoles,
    handleVote,
    handleUpvote,
    handleDownvote,
    handleEndVote,
    handleCreate,
    handleList,
    handlePagination,
    handleAddToPugs,
    handleAddToPugsButton,
    handleMyVote,
    handleMyVotePagination,
    handleAdd,
    handleRemove,
    handleMyVoteViewVotes
};
