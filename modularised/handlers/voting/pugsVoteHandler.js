// handlers/voting/pugsVoteHandler.js
const { 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder 
} = require('discord.js');

const { pool } = require('../../utilities/database');
const config = require('../../config/config');
const logger = require('../../utilities/logger');

// List of roles allowed to use PUGs commands (excluding pups managers)
const allowedRoles = [
    config.pugsManagerRoleId,
    config.premiumManagerRoleId
    // Add more role IDs if necessary
];

// Roles allowed to vote on PUGs polls
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
            .setAuthor({ name: `${user.username} | PUGs Vote`, iconURL: user.displayAvatarURL() })
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
                    .setCustomId(`upvote_pugs_${type}_${user.id}`)
                    .setLabel('Upvote')
                    .setEmoji('👍')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`downvote_pugs_${type}_${user.id}`)
                    .setLabel('Downvote')
                    .setEmoji('👎')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`end_vote_pugs_${type}_${user.id}`)
                    .setLabel('End Vote')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Determine the channel ID based on type
        const channelId = type === 'pugs_trial' ? config.pugsTrialChannelId : config.pugsChannelId;
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) {
            logger.error(`PUGs Channel with ID ${channelId} not found.`);
            const errorEmbed = new EmbedBuilder()
                .setDescription('PUGs voting channel not found.')
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
    await interaction.deferReply({ ephemeral: true });

    try {
        const customId = interaction.customId;
        const parts = customId.split('_');

        if (parts.length < 4) {
            logger.warn(`Invalid customId: ${customId}`);
            const embed = new EmbedBuilder()
                .setDescription('Invalid interaction.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const action = parts[0]; // 'upvote' or 'downvote'
        const type = parts[1]; // 'pugs' or 'pugs_trial'
        const targetUserId = parts.slice(2).join('_'); // User ID

        if (type !== 'pugs' && type !== 'pugs_trial') {
            logger.warn(`Ignoring non-pugs type: ${type}`);
            const embed = new EmbedBuilder()
                .setDescription('This interaction is not valid for PUGs polls.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Check if the user has one of the votingAllowedRoles
        if (!votingAllowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
            const embed = new EmbedBuilder()
                .setDescription(`You do not have permission to vote. Required roles:\n${votingAllowedRoles.map(roleId => `<@&${roleId}>`).join('\n')}`)
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Prevent self-voting
        if (interaction.user.id === targetUserId) {
            const embed = new EmbedBuilder()
                .setDescription('You cannot vote on your own poll.')
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
            logger.warn('No active poll found for the user.');
            const embed = new EmbedBuilder()
                .setDescription('No active poll found for this user.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const poll = polls[0];
        const roleId = type === 'pugs_trial' ? config.pugsTrialRoleId : config.pugsRoleId;

        // Check if the user has already voted
        const [existingVote] = await pool.execute(
            'SELECT * FROM votes WHERE user_id = ? AND poll_id = ?',
            [interaction.user.id, poll.id]
        );

        if (existingVote.length > 0) {
            const previousVote = existingVote[0].vote;
            if (previousVote === voteType) {
                const embed = new EmbedBuilder()
                    .setDescription(`You have already ${voteType}d this poll.`)
                    .setColor(0x980e00)
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            } else {
                // User is changing their vote
                try {
                    // Begin transaction
                    const connection = await pool.getConnection();
                    try {
                        await connection.beginTransaction();

                        if (voteType === 'upvote') {
                            await connection.execute(
                                'UPDATE polls SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id = ?',
                                [poll.id]
                            );
                            await connection.execute(
                                'UPDATE votes SET vote = "upvote" WHERE user_id = ? AND poll_id = ?',
                                [interaction.user.id, poll.id]
                            );
                        } else if (voteType === 'downvote') {
                            await connection.execute(
                                'UPDATE polls SET downvotes = downvotes + 1, upvotes = upvotes - 1 WHERE id = ?',
                                [poll.id]
                            );
                            await connection.execute(
                                'UPDATE votes SET vote = "downvote" WHERE user_id = ? AND poll_id = ?',
                                [interaction.user.id, poll.id]
                            );
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
                    const [updatedPolls] = await pool.execute(
                        'SELECT * FROM polls WHERE id = ?',
                        [poll.id]
                    );
                    const updatedPoll = updatedPolls[0];

                    // Update the embed in the voting channel
                    const channelId = type === 'pugs_trial' ? config.pugsTrialChannelId : config.pugsChannelId;
                    const channel = interaction.guild.channels.cache.get(channelId);
                    if (!channel) {
                        logger.error(`PUGs Channel with ID ${channelId} not found.`);
                        const errorEmbed = new EmbedBuilder()
                            .setDescription('PUGs voting channel not found.')
                            .setColor(0x980e00)
                            .setTimestamp();
                        return interaction.editReply({ embeds: [errorEmbed] });
                    }

                    // Fetch the original message to update
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
                        return interaction.editReply({ embeds: [embed] });
                    }

                    const fetchedMessages = await channel.messages.fetch({ limit: 100 });
                    const message = fetchedMessages.find(msg => 
                        msg.embeds.length > 0 && 
                        msg.embeds[0].author && 
                        msg.embeds[0].author.name === `${targetMember.user.username} | PUGs Vote`
                    );

                    if (!message) {
                        logger.error('Original voting message not found.');
                        const embed = new EmbedBuilder()
                            .setDescription('Original voting message not found.')
                            .setColor(0x980e00)
                            .setTimestamp();
                        return interaction.editReply({ embeds: [embed] });
                    }

                    const embed = EmbedBuilder.from(message.embeds[0])
                        .setDescription(`A vote has been created for <@${targetUserId}> to join <@&${roleId}>.`)
                        .setFields( 
                            { name: 'Upvotes 👍', value: `\`\`\`${updatedPoll.upvotes}\`\`\``, inline: true },
                            { name: 'Downvotes 👎', value: `\`\`\`${updatedPoll.downvotes}\`\`\``, inline: true }
                        )
                        .setTimestamp();

                    await message.edit({ embeds: [embed] });

                    const replyEmbed = new EmbedBuilder()
                        .setDescription(`You have cast a **${voteType}**.`)
                        .setColor(0xe96d6d)
                        .setTimestamp();

                    return interaction.editReply({ embeds: [replyEmbed] });
                } catch (error) {
                    logger.error('Error changing vote:', error);
                    const embed = new EmbedBuilder()
                        .setDescription('An error occurred while changing your vote.')
                        .setColor(0x980e00)
                        .setTimestamp();
                    return interaction.editReply({ embeds: [embed] });
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
                        await connection.execute(
                            'UPDATE polls SET upvotes = upvotes + 1 WHERE id = ?',
                            [poll.id]
                        );
                        await connection.execute(
                            'INSERT INTO votes (user_id, poll_id, vote) VALUES (?, ?, "upvote")',
                            [interaction.user.id, poll.id]
                        );
                    } else if (voteType === 'downvote') {
                        await connection.execute(
                            'UPDATE polls SET downvotes = downvotes + 1 WHERE id = ?',
                            [poll.id]
                        );
                        await connection.execute(
                            'INSERT INTO votes (user_id, poll_id, vote) VALUES (?, ?, "downvote")',
                            [interaction.user.id, poll.id]
                        );
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
                const [updatedPolls] = await pool.execute(
                    'SELECT * FROM polls WHERE id = ?',
                    [poll.id]
                );
                const updatedPoll = updatedPolls[0];

                // Update the embed in the voting channel
                const channelId = type === 'pugs_trial' ? config.pugsTrialChannelId : config.pugsChannelId;
                const channel = interaction.guild.channels.cache.get(channelId);
                if (!channel) {
                    logger.error(`PUGs Channel with ID ${channelId} not found.`);
                    const errorEmbed = new EmbedBuilder()
                        .setDescription('PUGs voting channel not found.')
                        .setColor(0x980e00)
                        .setTimestamp();
                    return interaction.editReply({ embeds: [errorEmbed] });
                }

                // Fetch the original message to update
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
                    return interaction.editReply({ embeds: [embed] });
                }

                const fetchedMessages = await channel.messages.fetch({ limit: 100 });
                const message = fetchedMessages.find(msg => 
                    msg.embeds.length > 0 && 
                    msg.embeds[0].author && 
                    msg.embeds[0].author.name === `${targetMember.user.username} | PUGs Vote`
                );

                if (!message) {
                    logger.error('Original voting message not found.');
                    const embed = new EmbedBuilder()
                        .setDescription('Original voting message not found.')
                        .setColor(0x980e00)
                        .setTimestamp();
                    return interaction.editReply({ embeds: [embed] });
                }

                const embed = EmbedBuilder.from(message.embeds[0])
                    .setDescription(`A vote has been created for <@${targetUserId}> to join <@&${roleId}>.`)
                    .setFields( 
                        { name: 'Upvotes 👍', value: `\`\`\`${updatedPoll.upvotes}\`\`\``, inline: true },
                        { name: 'Downvotes 👎', value: `\`\`\`${updatedPoll.downvotes}\`\`\``, inline: true }
                    )
                    .setTimestamp();

                await message.edit({ embeds: [embed] });

                const replyEmbed = new EmbedBuilder()
                    .setDescription(`You have cast a **${voteType}**.`)
                    .setColor(0xe96d6d)
                    .setTimestamp();

                return interaction.editReply({ embeds: [replyEmbed] });
            } catch (error) {
                logger.error('Error casting vote:', error);
                const embed = new EmbedBuilder()
                    .setDescription('An error occurred while casting your vote.')
                    .setColor(0x980e00)
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }
        }
    } catch (error) {
        logger.error('Error handling vote button interaction:', error);
        const embed = new EmbedBuilder()
            .setDescription('An unexpected error occurred while processing your vote.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
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
        const customId = interaction.customId;
        const parts = customId.split('_');

        if (parts.length < 5) {
            logger.warn(`Invalid customId: ${customId}`);
            const embed = new EmbedBuilder()
                .setDescription('Invalid interaction.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const action = `${parts[0]}_${parts[1]}`; // 'end_vote'
        const type = parts[2]; // 'pugs' or 'pugs_trial'
        const targetUserId = parts.slice(3).join('_'); // User ID

        if (type !== 'pugs' && type !== 'pugs_trial') {
            logger.warn(`Ignoring non-pugs type: ${type}`);
            const embed = new EmbedBuilder()
                .setDescription('This interaction is not valid for PUGs polls.')
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
            logger.warn('No active poll found for the user.');
            const embed = new EmbedBuilder()
                .setDescription('No active poll found for this user.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const poll = polls[0];
        const roleId = type === 'pugs_trial' ? config.pugsTrialRoleId : config.pugsRoleId;
        const role = interaction.guild.roles.cache.get(roleId);

        // Permission check using the allowedRoles list
        if (!allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
            const embed = new EmbedBuilder()
                .setDescription(`Only people with these roles can use this button:\n${allowedRoles.map(roleId => `<@&${roleId}>`).join('\n')}`)
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Deactivate the poll
        try {
            await pool.execute('UPDATE polls SET active = 0 WHERE id = ?', [poll.id]);
        } catch (error) {
            logger.error('Error deactivating poll:', error);
            const embed = new EmbedBuilder()
                .setDescription('An error occurred while ending the vote.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const upvotes = poll.upvotes;
        const downvotes = poll.downvotes;
        const voteWon = upvotes > downvotes;
        const resultColor = voteWon ? '#00FF00' : '#FF0000';

        // Disable all buttons in the original message
        const disabledButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`upvote_pugs_${type}_${targetUserId}`)
                .setLabel('Upvote')
                .setEmoji('👍')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`downvote_pugs_${type}_${targetUserId}`)
                .setLabel('Downvote')
                .setEmoji('👎')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`end_vote_pugs_${type}_${targetUserId}`)
                .setLabel('End Vote')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        // Fetch the original voting message
        const channelId = type === 'pugs_trial' ? config.pugsTrialChannelId : config.pugsChannelId;
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) {
            logger.error(`PUGs Channel with ID ${channelId} not found.`);
            const embed = new EmbedBuilder()
                .setDescription('PUGs voting channel not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

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
            return interaction.editReply({ embeds: [embed] });
        }

        const fetchedMessages = await channel.messages.fetch({ limit: 100 });
        const message = fetchedMessages.find(msg => 
            msg.embeds.length > 0 && 
            msg.embeds[0].author && 
            msg.embeds[0].author.name === `${targetMember.user.username} | PUGs Vote`
        );

        if (!message) {
            logger.error('Original voting message not found.');
            const embed = new EmbedBuilder()
                .setDescription('Original voting message not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Update the embed with the final vote counts
        const updatedEmbed = EmbedBuilder.from(message.embeds[0])
            .setDescription(`A vote has been created for <@${targetUserId}> to join <@&${roleId}>.`)
            .setFields( 
                { name: 'Upvotes 👍', value: `\`\`\`${upvotes}\`\`\``, inline: true },
                { name: 'Downvotes 👎', value: `\`\`\`${downvotes}\`\`\``, inline: true }
            )
            .setTimestamp();

        try {
            await message.edit({ embeds: [updatedEmbed], components: [disabledButtons] });

            // Create a result embed
            const resultEmbed = new EmbedBuilder()
                .setAuthor({ name: `${targetMember.user.username} | PUGs Vote Results`, iconURL: targetMember.user.displayAvatarURL() })
                .setDescription(`**Upvotes 👍:** \`\`\`${upvotes}\`\`\`\n**Downvotes 💔:** \`\`\`${downvotes}\`\`\`\n<@${targetUserId}> has **${voteWon ? 'won' : 'lost'}** the vote!`)
                .setColor(resultColor)
                .setFooter({ text: `Created by ${message.embeds[0].footer.text.replace('Created by ', '')}`, iconURL: message.embeds[0].footer.iconURL })
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
        } catch (error) {
            logger.error(`Error handling end_vote interaction: ${error}`);
            const embed = new EmbedBuilder()
                .setDescription('Error handling end_vote interaction.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }
    } catch (error) {
        logger.error('Error handling End Vote:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while ending the vote.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};

/**
 * Handle the `/pugs create` command for managers to create their own PUGs votes
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
                .setDescription('You already have an active PUGs poll.')
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
                .setDescription('You cannot create a PUGs poll while holding PUGS, PUGS Trial, or PREMIUM roles.')
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
            .setAuthor({ name: `${user.username} | PUGs Vote`, iconURL: user.displayAvatarURL() })
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
                    .setCustomId(`upvote_pugs_${type}_${user.id}`)
                    .setLabel('Upvote')
                    .setEmoji('👍')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`downvote_pugs_${type}_${user.id}`)
                    .setLabel('Downvote')
                    .setEmoji('👎')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`end_vote_pugs_${type}_${user.id}`)
                    .setLabel('End Vote')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Determine the channel ID based on type
        const channelId = type === 'pugs_trial' ? config.pugsTrialChannelId : config.pugsChannelId;
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) {
            logger.error(`PUGs Channel with ID ${channelId} not found.`);
            const errorEmbed = new EmbedBuilder()
                .setDescription('PUGs voting channel not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        const sentMessage = await channel.send({ content: `<@&${roleId}>`, embeds: [embed], components: [buttons] });

        // Update the poll record with the message_id
        await pool.execute('UPDATE polls SET message_id = ? WHERE id = ?', [sentMessage.id, pollId]);

        const successEmbed = new EmbedBuilder()
            .setDescription('Your PUGs vote has been created successfully.')
            .setColor(0xe96d6d)
            .setTimestamp();

        return interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
        logger.error('Error creating PUGs poll:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while creating your PUGs poll.')
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

        // Fetch the PUGs and PUGs Trial roles from the guild
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

        // Fetch all guild members (requires GUILD_MEMBERS intent)
        await interaction.guild.members.fetch();

        // Access the members with the PUGs and PUGs Trial roles from the cache
        const membersWithPugs = pugsRole.members;
        const membersWithPugsTrial = pugsTrialRole.members;

        const combinedMembers = new Set([...membersWithPugs.values(), ...membersWithPugsTrial.values()]);

        const membersArray = Array.from(combinedMembers);
        const pageSize = 10;
        const totalPages = Math.ceil(membersArray.length / pageSize);

        // Debugging Log
        logger.info(`Total members with PUGs or PUGs Trial roles: ${membersArray.length}`);

        if (totalPages === 0) {
            const noMembersEmbed = new EmbedBuilder()
                .setDescription('```ini\nNo members with PUGs or PUGs Trial roles found.\n```')
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
            .setAuthor({ name: 'PUGs List', iconURL: interaction.guild.iconURL() })
            .setDescription(`Mode: **PUGs & PUGs Trial** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
            .setFooter({ text: `${userPosition}. [${interaction.user.username}]`, iconURL: interaction.user.displayAvatarURL() })
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
            .setDescription('An error occurred while fetching the PUGs list.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};

/**
 * Handle pagination for the PUGs list
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

    // Fetch the PUGs and PUGs Trial roles
    const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
    const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);
    if (!pugsRole || !pugsTrialRole) {
        logger.error(`PUGs Role(s) not found.`);
        const embed = new EmbedBuilder()
            .setDescription('PUGs or PUGs Trial role not found.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
        // Fetch all guild members (requires GUILD_MEMBERS intent)
        await interaction.guild.members.fetch();

        // Access the members with the PUGs and PUGs Trial roles from the cache
        const membersWithPugs = pugsRole.members;
        const membersWithPugsTrial = pugsTrialRole.members;

        const combinedMembers = new Set([...membersWithPugs.values(), ...membersWithPugsTrial.values()]);
        const membersArray = Array.from(combinedMembers);
        const pageSize = 10;
        const totalPages = Math.ceil(membersArray.length / pageSize);

        if (membersArray.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('No members have the PUGs or PUGs Trial roles.')
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
            .setAuthor({ name: 'PUGs List', iconURL: interaction.guild.iconURL() })
            .setDescription(`Mode: **PUGs & PUGs Trial** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
            .setFooter({ text: `${userPosition}. [${interaction.user.username}]`, iconURL: interaction.user.displayAvatarURL() })
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

        logger.info(`PUGs list pagination: user ${userId} navigated to page ${currentPage + 1}/${totalPages}`);
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
 * Handle the Add to Pugs/Pugs Trial button
 * @param {ButtonInteraction} interaction 
 */
const handleAddToPugs = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const customId = interaction.customId; // e.g., 'add_to_pugs_pugs_151'
    const parts = customId.split('_');

    if (parts.length < 4) { // 'add_to_pugs_<type>_<pollId>'
        logger.warn(`Invalid customId for add to pugs: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid interaction.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    const action = `${parts[0]}_${parts[1]}`; // 'add_to'
    const type = parts[2]; // 'pugs' or 'pugs_trial'
    const pollId = parts[3];

    if (type !== 'pugs' && type !== 'pugs_trial') {
        logger.warn(`Ignoring non-pugs type: ${type}`);
        const embed = new EmbedBuilder()
            .setDescription('This interaction is not valid for PUGs polls.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    // Fetch poll details
    const [polls] = await pool.execute(
        'SELECT * FROM polls WHERE id = ? AND type = ? AND active = 0',
        [pollId, type]
    );
    if (polls.length === 0) {
        const embed = new EmbedBuilder()
            .setDescription('Poll not found or is still active.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    const poll = polls[0];
    const userId = poll.user_id;

    try {
        const member = await interaction.guild.members.fetch(userId);
        const roleId = type === 'pugs_trial' ? config.pugsTrialRoleId : config.pugsRoleId;
        const role = interaction.guild.roles.cache.get(roleId);

        if (!role) {
            logger.error(`PUGs Role with ID ${roleId} not found.`);
            const embed = new EmbedBuilder()
                .setDescription('PUGs role not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        if (member.roles.cache.has(role.id)) {
            const embed = new EmbedBuilder()
                .setDescription(`> <@${userId}> is already <@&${roleId}>`)
                .setColor(0xFFD700);
            return interaction.editReply({ embeds: [embed] });
        }

        await member.roles.add(role);

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

        const channelId = type === 'pugs_trial' ? config.pugsTrialChannelId : config.pugsChannelId;
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) {
            logger.error(`PUGs Channel with ID ${channelId} not found.`);
            const embed = new EmbedBuilder()
                .setDescription('PUGs voting channel not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        let originalMessage;
        try {
            originalMessage = await channel.messages.fetch(messageId);
        } catch (err) {
            logger.error(`Could not fetch message with ID ${messageId}:`, err);
            const embed = new EmbedBuilder()
                .setDescription('Original voting message not found in the channel.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Prepare the new embed
        const additionEmbed = new EmbedBuilder()
            .setAuthor({ name: `${member.user.username}`, iconURL: member.user.displayAvatarURL() })
            .setTitle('PUGs Addition')
            .setDescription(`> <@${userId}> has been added to <@&${roleId}>.\n- **Added By:** <@${interaction.user.id}>`)
            .setColor('#e96d6d') 
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
        await interaction.editReply({ embeds: [confirmationEmbed] });

    } catch (error) {
        logger.error('Error adding PUGs role via Add to PUGs button:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while adding the PUGs role.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};

/**
 * Handle the `/pugs myvote` command
 * @param {CommandInteraction} interaction 
 */
const handleMyVote = async (interaction) => {
    // Defer the reply to extend the timeout
    await interaction.deferReply({ ephemeral: false });

    try {
        const userId = interaction.user.id;
        let [polls] = await pool.execute(
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
        const currentPage = 0; // Start with the first poll
        const poll = polls[currentPage];
        const status = poll.active ? 'active' : 'inactive';
        const user = interaction.user;

        // Calculate Poll ID based on recency
        const pollId = totalPages - currentPage;

        // Determine the role ID based on poll type
        const roleId = poll.type === 'pugs_trial' ? config.pugsTrialRoleId : config.pugsRoleId;

        const pollEmbed = new EmbedBuilder()
            .setAuthor({ name: `${user.username} | PUGs Vote`, iconURL: user.displayAvatarURL() })
            .setDescription(
                `- **Poll ID** relative to user: \`${pollId}\`\n` +
                `> This poll is currently __\`${status}\`__.\u00A0\u00A0\u00A0\u00A0\u00A0`
            )
            .addFields(
                { name: 'Upvotes 👍', value: `\`\`\`${poll.upvotes}\`\`\``, inline: true },
                { name: 'Downvotes 👎', value: `\`\`\`${poll.downvotes}\`\`\``, inline: true }
            )
            .setFooter({ text: `Poll 1/${polls.length}`, iconURL: user.displayAvatarURL() })
            .setColor('#e96d6d')
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev_myvote_pugs_${userId}_${currentPage}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`voteview_viewvotes_${userId}_pugs_${currentPage}`)
                    .setEmoji('🔍')
                    .setLabel('View Votes')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`next_myvote_pugs_${userId}_${currentPage}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === totalPages - 1)                
            );

        await interaction.editReply({ embeds: [pollEmbed], components: [buttons] });
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
    const customId = interaction.customId; // e.g., 'next_myvote_pugs_<userId>_<currentPage>'
    const parts = customId.split('_');

    if (parts.length < 5) {
        logger.warn(`Invalid customId format for myvote pagination: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid pagination interaction.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const action = parts[0]; // 'next' or 'prev'
    const type = parts[1]; // 'myvote'
    const pollType = parts[2]; // 'pugs' or 'pugs_trial'
    const initiatorId = parts[3]; // 'userId'
    let currentPage = parseInt(parts[4], 10); // Current page index

    // Verify that the user interacting is the initiator
    if (interaction.user.id !== initiatorId) {
        const embed = new EmbedBuilder()
            .setDescription(`> Only <@${initiatorId}> can use these buttons.`)
            .setColor('#D72F2F')
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
        // Fetch all polls for the initiator
        let [polls] = await pool.execute(
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

        // Ensure currentPage is within bounds
        if (currentPage < 0) currentPage = 0;
        if (currentPage >= totalPages) currentPage = totalPages - 1;

        const poll = polls[currentPage];
        const status = poll.active ? 'active' : 'inactive';
        const pollId = currentPage + 1; // Adjust Poll ID based on zero-based index

        // Determine the role ID based on poll type
        const roleId = poll.type === 'pugs_trial' ? config.pugsTrialRoleId : config.pugsRoleId;

        const pollEmbed = new EmbedBuilder()
            .setAuthor({ name: `${interaction.user.username} | PUGs Vote`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setDescription(`**Poll ID:** \`${pollId}\`\n> This poll is currently __\`${status}\`__`)
            .addFields(
                { name: 'Upvotes 👍', value: `\`\`\`${poll.upvotes || 0}\`\`\``, inline: true },
                { name: 'Downvotes 👎', value: `\`\`\`${poll.downvotes || 0}\`\`\``, inline: true }
            )
            .setFooter({ 
                text: `Poll ${pollId}/${totalPages}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            })
            .setColor('#e96d6d')
            .setTimestamp();

        // Create navigation buttons with consistent customIds
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev_myvote_pugs_${initiatorId}_${currentPage}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`voteview_viewvotes_${initiatorId}_pugs_${currentPage}`)
                    .setLabel('View Votes')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔍'),
                new ButtonBuilder()
                    .setCustomId(`next_myvote_pugs_${initiatorId}_${currentPage}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === totalPages - 1)                
            );

        // Edit the original message with the new embed and updated buttons
        await interaction.update({ embeds: [pollEmbed], components: [buttons] });

        logger.info(`PUGs myvote pagination: user ${initiatorId} navigated to poll ${pollId}/${totalPages}`);
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
    handleMyVotePagination
};
