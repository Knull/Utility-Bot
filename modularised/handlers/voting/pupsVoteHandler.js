// handlers/voting/pupsVoteHandler.js
const { 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder
} = require('discord.js'); // Removed InteractionResponseFlags from imports

const { pool } = require('../../utilities/database');
const config = require('../../config/config');
const logger = require('../../utilities/logger'); // Ensure you have a logger utility

// List of roles allowed to use PUPS commands
const allowedRoles = [
    config.pupsManagerRoleId,
    config.premiumManagerRoleId,
    config.pugsManagerRoleId
    // Add more role IDs if necessary
];

// Roles allowed to vote
const votingAllowedRoles = [
    config.pupsRoleId,
    config.pugsRoleId,
    config.premiumRoleId
];

/**
 * Handle the `/pups vote` command
 * @param {CommandInteraction} interaction 
 */
const handleVote = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    try {
        const user = interaction.options.getUser('user');
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
        const [rows] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pups" AND active = 1', [user.id]);
        if (rows.length > 0) {
            const embed = new EmbedBuilder()
                .setDescription('A poll is already active for this user.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Create new poll
        const [result] = await pool.execute(
            'INSERT INTO polls (user_id, type, upvotes, downvotes, active, created_at) VALUES (?, "pups", 0, 0, 1, NOW())',
            [user.id]
        );

        const pollId = result.insertId; // Assuming 'id' is the primary key with AUTO_INCREMENT

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${user.username} | PUPS Vote`, iconURL: user.displayAvatarURL() })
            .setDescription(`> A vote has been created for <@${user.id}> to join <@&${config.pupsRoleId}>.`)
            .addFields(
                { name: 'Upvotes 👍', value: '```0```', inline: true },
                { name: 'Downvotes 👎', value: '```0```', inline: true }
            )
            .setFooter({ text: `Created by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setColor('#e96d6d')
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`upvote_pups_${user.id}`)
                    .setLabel('Upvote')
                    .setEmoji('👍')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`downvote_pups_${user.id}`)
                    .setLabel('Downvote')
                    .setEmoji('👎')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`end_vote_pups_${user.id}`)
                    .setLabel('End Vote')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Use pupsChannelId from config.js
        const channel = interaction.guild.channels.cache.get(config.pupsChannelId);
        if (!channel) {
            logger.error(`PUPS Channel with ID ${config.pupsChannelId} not found.`);
            const errorEmbed = new EmbedBuilder()
                .setDescription('PUPS voting channel not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        const sentMessage = await channel.send({ content: `<@&${config.pupsRoleId}>`, embeds: [embed], components: [buttons] });

        // Update the poll record with the message_id
        await pool.execute('UPDATE polls SET message_id = ? WHERE id = ?', [sentMessage.id, pollId]);

        const successEmbed = new EmbedBuilder()
            .setDescription('Vote created successfully.')
            .setColor(0xe96d6d)
            .setTimestamp();

        return interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
        logger.error('Error handling /pups vote command:', error);
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
    await interaction.deferReply({ ephemeral: true }); // Changed from flags: InteractionResponseFlags.EPHEMERAL

    try {
        const customId = interaction.customId;
        const parts = customId.split('_');

        if (parts.length < 3) {
            logger.warn(`Invalid customId: ${customId}`);
            const embed = new EmbedBuilder()
                .setDescription('Invalid interaction.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const action = parts[0]; // 'upvote' or 'downvote'
        const type = parts[1]; // 'pups'
        const targetUserId = parts.slice(2).join('_'); // In case user IDs have underscores

        if (type !== 'pups') {
            logger.warn(`Ignoring non-pups type: ${type}`);
            const embed = new EmbedBuilder()
                .setDescription('This interaction is not valid for PUPS polls.')
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
        const [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pups" AND active = 1', [targetUserId]);
        if (polls.length === 0) {
            logger.warn('No active poll found for the user.');
            const embed = new EmbedBuilder()
                .setDescription('No active poll found for this user.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const poll = polls[0];

        // Check if the user has already voted
        const [existingVote] = await pool.execute('SELECT * FROM votes WHERE user_id = ? AND poll_id = ?', [interaction.user.id, poll.id]);

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
                    const channel = interaction.guild.channels.cache.get(config.pupsChannelId);
                    if (!channel) {
                        logger.error(`PUPS Channel with ID ${config.pupsChannelId} not found.`);
                        const errorEmbed = new EmbedBuilder()
                            .setDescription('PUPS voting channel not found.')
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
                        msg.embeds[0].author.name === `${targetMember.user.username} | PUPS Vote`
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
                        .setDescription(`A vote has been created for <@${targetUserId}> to join <@&${config.pupsRoleId}>.`)
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
                        await connection.execute('UPDATE polls SET upvotes = upvotes + 1 WHERE id = ?', [poll.id]);
                        await connection.execute('INSERT INTO votes (user_id, poll_id, vote) VALUES (?, ?, "upvote")', [interaction.user.id, poll.id]);
                    } else if (voteType === 'downvote') {
                        await connection.execute('UPDATE polls SET downvotes = downvotes + 1 WHERE id = ?', [poll.id]);
                        await connection.execute('INSERT INTO votes (user_id, poll_id, vote) VALUES (?, ?, "downvote")', [interaction.user.id, poll.id]);
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
                const channel = interaction.guild.channels.cache.get(config.pupsChannelId);
                if (!channel) {
                    logger.error(`PUPS Channel with ID ${config.pupsChannelId} not found.`);
                    const errorEmbed = new EmbedBuilder()
                        .setDescription('PUPS voting channel not found.')
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
                    msg.embeds[0].author.name === `${targetMember.user.username} | PUPS Vote`
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
                    .setDescription(`A vote has been created for <@${targetUserId}> to join <@&${config.pupsRoleId}>.`)
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
    await interaction.deferReply({ ephemeral: true }); // Changed from flags: InteractionResponseFlags.EPHEMERAL

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

        const action = `${parts[0]}_${parts[1]}`; // 'end_vote'
        const type = parts[2]; // 'pups'
        const targetUserId = parts.slice(3).join('_'); // Handle any underscores in user IDs

        if (type !== 'pups') {
            logger.warn(`Ignoring non-pups type: ${type}`);
            const embed = new EmbedBuilder()
                .setDescription('This interaction is not valid for PUPS polls.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Fetch active poll
        const [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pups" AND active = 1', [targetUserId]);
        if (polls.length === 0) {
            logger.warn('No active poll found for the user.');
            const embed = new EmbedBuilder()
                .setDescription('No active poll found for this user.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const poll = polls[0];
        const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);

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
                .setCustomId(`upvote_pups_${targetUserId}`)
                .setLabel('Upvote')
                .setEmoji('👍')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`downvote_pups_${targetUserId}`)
                .setLabel('Downvote')
                .setEmoji('👎')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`end_vote_pups_${targetUserId}`)
                .setLabel('End Vote')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        // Fetch the original message to update
        const channel = interaction.guild.channels.cache.get(config.pupsChannelId);
        if (!channel) {
            logger.error(`PUPS Channel with ID ${config.pupsChannelId} not found.`);
            const embed = new EmbedBuilder()
                .setDescription('PUPS voting channel not found.')
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
            msg.embeds[0].author.name === `${targetMember.user.username} | PUPS Vote`
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
            .setDescription(`A vote has been created for <@${targetUserId}> to join <@&${config.pupsRoleId}>.`)
            .setFields( 
                { name: 'Upvotes 👍', value: `\`\`\`${upvotes}\`\`\``, inline: true },
                { name: 'Downvotes 👎', value: `\`\`\`${downvotes}\`\`\``, inline: true }
            )
            .setTimestamp();

        try {
            await message.edit({ embeds: [updatedEmbed], components: [disabledButtons] });

            // Create a result embed
            const resultEmbed = new EmbedBuilder()
                .setAuthor({ name: `${targetMember.user.username} | PUPS Vote Results`, iconURL: targetMember.user.displayAvatarURL() })
                .setDescription(`**Upvotes 👍:** \`\`\`${upvotes}\`\`\`\n**Downvotes 💔:** \`\`\`${downvotes}\`\`\`\n<@${targetUserId}> has **${voteWon ? 'won' : 'lost'}** the vote!`)
                .setColor(resultColor)
                .setFooter({ text: `Created by ${message.embeds[0].footer.text.replace('Created by ', '')}`, iconURL: message.embeds[0].footer.iconURL })
                .setTimestamp();

            // Add the "Add to Pups" button if the vote was won
            let actionButtons;
            if (voteWon) {
                actionButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`add_to_pups_${poll.id}`)
                        .setLabel('Add to Pups')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('✅') // Checkmark emoji
                );
            } else {
                // Add a disabled "Add to Pups" button
                actionButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`add_to_pups_${poll.id}`)
                        .setLabel('Add to Pups')
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
 * Handle the `/pups create` command for managers to create their own PUPS votes
 * @param {CommandInteraction} interaction 
 */
const handleCreate = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.user;
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

    try {
        // Check if the user already has an active poll
        const [activePolls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pups" AND active = 1', [user.id]);
        if (activePolls.length > 0) {
            const embed = new EmbedBuilder()
                .setDescription('You already have an active PUPS poll.')
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
        const isPremium = memberData.roles.cache.has(config.premiumRoleId);

        if (isPugs || isPremium) {
            const embed = new EmbedBuilder()
                .setDescription('You cannot create a PUPS poll while holding PUGS or PREMIUM roles.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Create new poll
        const [result] = await pool.execute(
            'INSERT INTO polls (user_id, type, upvotes, downvotes, active, created_at) VALUES (?, "pups", 0, 0, 1, NOW())',
            [user.id]
        );

        const pollId = result.insertId;

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${user.username} | PUPS Vote`, iconURL: user.displayAvatarURL() })
            .setDescription(`You have initiated a vote to join <@&${config.pupsRoleId}>.`)
            .addFields(
                { name: 'Upvotes 👍', value: '```0```', inline: true },
                { name: 'Downvotes 👎', value: '```0```', inline: true }
            )
            .setFooter({ text: `Created by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setColor('#e96d6d')
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`upvote_pups_${user.id}`)
                    .setLabel('Upvote')
                    .setEmoji('👍')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`downvote_pups_${user.id}`)
                    .setLabel('Downvote')
                    .setEmoji('👎')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`end_vote_pups_${user.id}`)
                    .setLabel('End Vote')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Use pupsChannelId from config.js
        const channel = interaction.guild.channels.cache.get(config.pupsChannelId);
        if (!channel) {
            logger.error(`PUPS Channel with ID ${config.pupsChannelId} not found.`);
            const errorEmbed = new EmbedBuilder()
                .setDescription('PUPS voting channel not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        const sentMessage = await channel.send({ content: `<@&${config.pupsRoleId}>`, embeds: [embed], components: [buttons] });

        // Update the poll record with the message_id
        await pool.execute('UPDATE polls SET message_id = ? WHERE id = ?', [sentMessage.id, pollId]);

        const successEmbed = new EmbedBuilder()
            .setDescription('Your PUPS vote has been created successfully.')
            .setColor(0xe96d6d)
            .setTimestamp();

        return interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
        logger.error('Error creating PUPS poll:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while creating your PUPS poll.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};

/**
 * Handle the `/pups list` command
 * @param {CommandInteraction} interaction 
 */
const handleList = async (interaction) => {
    try {
        // Defer the reply to give the bot more time to process
        await interaction.deferReply({ ephemeral: false });

        // Fetch the PUPS role from the guild
        const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);

        if (!pupsRole) {
            logger.error(`PUPS Role with ID ${config.pupsRoleId} not found.`);
            const embed = new EmbedBuilder()
                .setDescription('PUPS role not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Fetch all guild members (requires GUILD_MEMBERS intent)
        await interaction.guild.members.fetch();

        // Access the members with the PUPS role from the cache
        const membersWithRole = pupsRole.members;

        const membersArray = Array.from(membersWithRole.values());
        const pageSize = 10;
        const totalPages = Math.ceil(membersArray.length / pageSize);

        // Debugging Log
        logger.info(`Total members with PUPS role: ${membersArray.length}`);

        if (totalPages === 0) {
            const noMembersEmbed = new EmbedBuilder()
                .setDescription('```ini\nNo members with PUPS role found.\n```')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [noMembersEmbed] });
        }

        const currentPage = 0; // Start with the first page
        const paginatedMembers = membersArray.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

        const memberList = paginatedMembers.map((member, index) => `\`\`${index + 1 + currentPage * pageSize}.\`\` <@${member.id}>`).join('\n');
        const userPosition = membersArray.findIndex(member => member.id === interaction.user.id) + 1;

        const pupsRoleColor = pupsRole.color || 0xe96d6d; // Fallback color if role has no color

        const listEmbed = new EmbedBuilder()
            .setAuthor({ name: 'PUPS List', iconURL: interaction.guild.iconURL() })
            .setDescription(`Mode: **PUPS** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
            .setFooter({ text: `${userPosition}. [${interaction.user.username}]`, iconURL: interaction.user.displayAvatarURL() })
            .setColor(pupsRoleColor)
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev_list_pups_${interaction.user.id}_${currentPage}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`next_list_pups_${interaction.user.id}_${currentPage}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1)
            );

        await interaction.editReply({ embeds: [listEmbed], components: [buttons] });
    } catch (error) {
        logger.error('Error handling /pups list command:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while fetching the PUPS list.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};
/**
 * Handle pagination for the PUPS list
 * @param {ButtonInteraction} interaction 
 */
const handlePagination = async (interaction) => {
    const customId = interaction.customId; // e.g., 'next_list_pups_<userId>_<currentPage>'
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
    const role = parts[2]; // 'pups'
    const userId = parts[3]; // '1155078877803192420'
    let currentPage = parseInt(parts[4], 10); // 0

    // Verify that the user interacting is the initiator
    if (interaction.user.id !== userId) {
        const embed = new EmbedBuilder()
            .setDescription(`> Only <@${userId}> can interact with these buttons.`)
            .setColor('#D72F2F')
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Fetch the PUPS role
    const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);
    if (!pupsRole) {
        logger.error(`PUPS Role with ID ${config.pupsRoleId} not found.`);
        const embed = new EmbedBuilder()
            .setDescription('PUPS role not found.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
        // Fetch all guild members (requires GUILD_MEMBERS intent)
        await interaction.guild.members.fetch();

        // Access the members with the PUPS role from the cache
        const membersWithRole = pupsRole.members;
        const membersArray = Array.from(membersWithRole.values());
        const pageSize = 10;
        const totalPages = Math.ceil(membersArray.length / pageSize);

        if (membersArray.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('No members have the PUPS role.')
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

        const pupsRoleColor = pupsRole.color || 0xe96d6d; // Fallback color if role has no color

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'PUPS List', iconURL: interaction.guild.iconURL() })
            .setDescription(`Mode: **PUPS** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
            .setFooter({ text: `${userPosition}. [${interaction.user.username}]`, iconURL: interaction.user.displayAvatarURL() })
            .setColor(pupsRoleColor)
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev_list_pups_${userId}_${currentPage}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`next_list_pups_${userId}_${currentPage}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1)
            );

        // Update the original message with the new embed and updated buttons
        await interaction.update({ embeds: [embed], components: [buttons] });
        logger.info(`PUPS list pagination: user ${userId} navigated to page ${currentPage + 1}/${totalPages}`);
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
 * Handle the `/pups add` command
 * @param {CommandInteraction} interaction 
 */
const handleAdd = async (interaction) => {
    // Defer the reply to extend the timeout
    await interaction.deferReply({ ephemeral: true }); // Changed from flags: InteractionResponseFlags.EPHEMERAL

    const user = interaction.options.getUser('user');

    if (!user) {
        const embed = new EmbedBuilder()
            .setDescription('Please provide a user to add the PUPS role to.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    const executor = interaction.member;

    // Permission check using the allowedRoles list
    if (!allowedRoles.some(roleId => executor.roles.cache.has(roleId))) {
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
        const member = await interaction.guild.members.fetch(user.id);
        const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);

        if (!pupsRole) {
            logger.error(`PUPS Role with ID ${config.pupsRoleId} not found.`);
            const embed = new EmbedBuilder()
                .setDescription('PUPS role not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        if (member.roles.cache.has(pupsRole.id)) {
            const embed = new EmbedBuilder()
                .setDescription(`> <@${user.id}> is already <@&${config.pupsRoleId}>`)
                .setColor(0xFFD700);
            return interaction.editReply({ embeds: [embed] });
        }

        await member.roles.add(pupsRole);

        // Reply with confirmation embed
        const addedEmbed = new EmbedBuilder()
            .setDescription(`> Added <@${user.id}> to <@&${config.pupsRoleId}>.`)
            .setColor(pupsRole.color || 0x00FF00); // Default to green if role has no color
        await interaction.editReply({ embeds: [addedEmbed] });

        // Removed the automatic announcement embed
         const announcementEmbed = new EmbedBuilder()
             .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
             .setTitle('PUPS Addition')
             .setDescription(`> <@${user.id}> has been added to <@&${config.pupsRoleId}>\n**Added By:** <@${interaction.user.id}>.`)
             .setColor('#00FF00')
             .setTimestamp();

         await channel.send({ embeds: [announcementEmbed] }).then(sentMessage => {
             sentMessage.react('🔥'); // Fire emoji for addition
         });

        // Optionally, you can log or perform other actions here

    } catch (error) {
        logger.error('Error adding PUPS role:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while adding the PUPS role.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};

/**
 * Handle the `/pups remove` command
 * @param {CommandInteraction} interaction 
 */
const handleRemove = async (interaction) => {
    // Defer the reply to extend the timeout
    await interaction.deferReply({ ephemeral: true }); // Changed from flags: InteractionResponseFlags.EPHEMERAL

    const user = interaction.options.getUser('user');
    const channel = interaction.guild.channels.cache.get(config.pupsChannelId);

    if (!user) {
        const embed = new EmbedBuilder()
            .setDescription('You need to provide a user to remove the PUPS from.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    const executor = interaction.member;

    // Permission check using the allowedRoles list
    if (!allowedRoles.some(roleId => executor.roles.cache.has(roleId))) {
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
        const member = await interaction.guild.members.fetch(user.id);
        const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);

        if (!pupsRole) {
            logger.error(`PUPS Role with ID ${config.pupsRoleId} not found.`);
            const embed = new EmbedBuilder()
                .setDescription(`PUPS role not found.\n> Current PUPS role config: ${config.pupsRoleId}`)
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        if (!member.roles.cache.has(pupsRole.id)) {
            const embed = new EmbedBuilder()
                .setDescription(`> <@${user.id}> is not <@&${config.pupsRoleId}>.`)
                .setColor(0xFFD700);
            return interaction.editReply({ embeds: [embed] });
        }

        await member.roles.remove(pupsRole);

        // Reply with confirmation embed
        const removedEmbed = new EmbedBuilder()
            .setDescription(`> Removed <@${user.id}> from <@&${config.pupsRoleId}>.`)
            .setColor(pupsRole.color || 0xFF0000); // Default to red if role has no color
        await interaction.editReply({ embeds: [removedEmbed] });

        const announcementEmbed = new EmbedBuilder()
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
            .setTitle('PUPS Removal')
            .setDescription(`> <@${user.id}> has been removed from <@&${config.pupsRoleId}>.\n- **Removed by:** <@${interaction.user.id}>`)
            .setColor(pupsRole.color || 0xFF0000) // Same as role color
            .setTimestamp();

         await channel.send({ embeds: [announcementEmbed] }).then(sentMessage => {
             sentMessage.react('💔'); // Heartbreak emoji for removal
         });

    } catch (error) {
        logger.error('Error removing PUPS role:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while removing the PUPS role.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};

/**
 * Handle the `/pups myvote` command
 * @param {CommandInteraction} interaction 
 */
const handleMyVote = async (interaction) => {
    // Defer the reply to extend the timeout
    await interaction.deferReply({ ephemeral: false }); // Public reply as per requirements

    try {
        const userId = interaction.user.id;
        let [polls] = await pool.execute(
            'SELECT * FROM polls WHERE user_id = ? AND type = "pups" ORDER BY created_at DESC',
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

        const pollEmbed = new EmbedBuilder()
            .setAuthor({ name: `${user.username} | PUPS Vote`, iconURL: user.displayAvatarURL() })
            .setDescription(
                `- **Poll ID** relative to user: \`${pollId}\`\n` +
                `> This poll is currently __\`${status}\`__.\u00A0\u00A0\u00A0\u00A0\u00A0` // Added Unicode spaces here
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
                    .setCustomId(`prev_myvote_pups_${userId}_${currentPage}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                    .setCustomId(`voteview_viewvotes_${userId}_pups_${currentPage}`) // Changed from `view_votes_pups_${poll.id}`
                    .setEmoji('🔍')
                    .setLabel('View Votes')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`next_myvote_pups_${userId}_${currentPage}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === totalPages - 1)                
            );

        await interaction.editReply({ embeds: [pollEmbed], components: [buttons] });
    } catch (error) {
        logger.error('Error handling /pups myvote command:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while fetching your polls.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};
/**
 * Handle pagination for the /pups myvote command
 * @param {ButtonInteraction} interaction 
 */
const handleMyVotePagination = async (interaction) => {
    const customId = interaction.customId; // e.g., 'next_myvote_pups_<userId>_<currentPage>'
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
    const pollType = parts[2]; // 'pups'
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
            'SELECT * FROM polls WHERE user_id = ? AND type = "pups" ORDER BY created_at DESC',
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
        const pollId = totalPages - currentPage; // Adjust Poll ID based on recency

        const pollEmbed = new EmbedBuilder()
            .setAuthor({ name: `${interaction.user.username} | PUPS Vote`, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`**Poll ID:** \`${pollId}\`\n> This poll is currently __\`${status}\`__`)
            .addFields(
                { name: 'Upvotes 👍', value: `\`\`\`${poll.upvotes}\`\`\``, inline: true },
                { name: 'Downvotes 👎', value: `\`\`\`${poll.downvotes}\`\`\``, inline: true }
            )
            .setFooter({ text: `Poll ${currentPage + 1}/${totalPages}`, iconURL: interaction.user.displayAvatarURL() })
            .setColor('#e96d6d')
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev_myvote_pups_${initiatorId}_${currentPage}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`next_myvote_pups_${initiatorId}_${currentPage}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1),
                new ButtonBuilder()
                    .setCustomId(`view_votes_pups_${poll.id}`)
                    .setLabel('View Votes')
                    .setStyle(ButtonStyle.Primary)
            );

        // Edit the original message with the new embed and updated buttons
        await interaction.update({ embeds: [pollEmbed], components: [buttons] });

        logger.info(`PUPS myvote pagination: user ${initiatorId} navigated to page ${currentPage + 1}/${totalPages}`);
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
 * Handle the Add to Pups button
 * @param {ButtonInteraction} interaction 
 */
const handleAddToPups = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const customId = interaction.customId; // e.g., 'add_to_pups_151'
    const parts = customId.split('_');

    if (parts.length < 4) { // 'add_to_pups_<pollId>'
        logger.warn(`Invalid customId for add to pups: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid interaction.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    const action = `${parts[0]}_${parts[1]}`; // 'add_to'
    const type = parts[2]; // 'pups'
    const pollId = parts[3];

    if (type !== 'pups') {
        logger.warn(`Ignoring non-pups type: ${type}`);
        const embed = new EmbedBuilder()
            .setDescription('This interaction is not valid for PUPS polls.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    // Fetch poll details
    const [polls] = await pool.execute('SELECT * FROM polls WHERE id = ? AND type = "pups" AND active = 0', [pollId]);
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
        const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);

        if (!pupsRole) {
            logger.error(`PUPS Role with ID ${config.pupsRoleId} not found.`);
            const embed = new EmbedBuilder()
                .setDescription('PUPS role not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        if (member.roles.cache.has(pupsRole.id)) {
            const embed = new EmbedBuilder()
                .setDescription(`> <@${userId}> is already <@&${config.pupsRoleId}>`)
                .setColor(0xFFD700);
            return interaction.editReply({ embeds: [embed] });
        }

        await member.roles.add(pupsRole);

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

        const channel = interaction.guild.channels.cache.get(config.pupsChannelId);
        if (!channel) {
            logger.error(`PUPS Channel with ID ${config.pupsChannelId} not found.`);
            const embed = new EmbedBuilder()
                .setDescription('PUPS voting channel not found.')
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
            .setTitle('PUPS Addition')
            .setDescription(`> <@${userId}> has been added to <@&${config.pupsRoleId}>.\n- **Added By:** <@${interaction.user.id}>`)
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
            .setDescription(`> <@${userId}> has been successfully added to <@&${config.pupsRoleId}>.`)
            .setColor(0x00FF00)
            .setTimestamp();
        await interaction.editReply({ embeds: [confirmationEmbed] });

    } catch (error) {
        logger.error('Error adding PUPS role via Add to Pups button:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while adding the PUPS role.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};

/**
 * Handle the Add to Pups button in the voting result message
 * @param {ButtonInteraction} interaction 
 */
const handleAddToPupsButton = async (interaction) => {
    // Delegate to handleAddToPups function
    await handleAddToPups(interaction);
};

/**
 * Close a poll by setting its status to 'closed'
 * @param {number} pollId 
 */
const closePreviousPoll = async (pollId) => {
    await pool.execute('UPDATE polls SET active = 0 WHERE id = ?', [pollId]);
};

// Export all handlers and necessary properties
module.exports = {
    allowedRoles,
    votingAllowedRoles,
    handleVote,
    handleUpvote,
    handleDownvote,
    handleVoteButton,
    handleEndVote,
    handleCreate,
    handleList,
    handlePagination,
    handleAdd,
    handleRemove,
    handleMyVote,
    handleAddToPups,
    handleAddToPupsButton,
    closePreviousPoll,
    handleMyVotePagination
};
