const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');
const { pool } = require('../utils/database');

// Function to handle 'pugs vote' subcommand
async function handlePugsVote(interaction) {
    const user = interaction.options.getUser('user');

    // Check if the command user has manager roles
    const member = interaction.member;
    if (!member.roles.cache.has(config.pugsManagerRoleId) && !member.roles.cache.has(config.premiumManagerRoleId)) {
        const embed = new EmbedBuilder()
            .setDescription(`Only members with <@&${config.pugsManagerRoleId}> or <@&${config.premiumManagerRoleId}> can vote.`)
            .setColor('#e74c3c');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if a poll is already active for this user
    const [rows] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pugs" AND active = 1', [user.id]);
    if (rows.length > 0) {
        const embed = new EmbedBuilder()
            .setDescription('A poll is already active for this user.')
            .setColor('#e74c3c');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Create a new poll
    await pool.execute('INSERT INTO polls (user_id, type, upvotes, downvotes, active) VALUES (?, "pugs", 0, 0, 1)', [user.id]);

    const embed = new EmbedBuilder()
        .setAuthor({ name: `${user.username} | PUGS Vote`, iconURL: user.displayAvatarURL() })
        .setDescription(`A vote has been created for <@${user.id}> to join <@&${config.pugsRoleId}>.\n\n**Upvotes 👍**\n\`\`\`0\`\`\`\n**Downvotes 👎**\n\`\`\`0\`\`\``)
        .setFooter({ text: `Created by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
        .setColor('#b90d1a');

    const buttons = new ActionRowBuilder().addComponents(
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

    // Find the voting channel
    const votingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pugs-voting');
    if (!votingChannel) {
        return interaction.reply({ content: 'Voting channel not found.', ephemeral: true });
    }

    // Send the vote message
    await votingChannel.send({ content: `<@&${config.pugsRoleId}>`, embeds: [embed], components: [buttons] });

    await interaction.reply({ content: 'Vote created successfully.', ephemeral: true });
}

// Function to handle 'pugs myvote' subcommand
async function handlePugsMyVote(interaction) {
    const userId = interaction.user.id;

    const [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pugs" ORDER BY created_at DESC', [userId]);

    if (polls.length === 0) {
        const embed = new EmbedBuilder()
            .setDescription('```ini\nYou do not have any polls```\n')
            .setColor('#D72F2F');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const pollIndex = 1; // Example: show latest poll
    const poll = polls[0];
    const status = poll.active ? 'active' : 'inactive';

    const embed = new EmbedBuilder()
        .setAuthor({ name: `${interaction.user.username} | PUGS Vote`, iconURL: interaction.user.displayAvatarURL() })
        .setDescription(`Mode: **PUGS** [${pollIndex}/${polls.length}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n **Upvotes 👍**\n\`\`\`${poll.upvotes}\`\`\`\n**Downvotes 👎**\n\`\`\`${poll.downvotes}\`\`\`\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n> This poll is currently __\`\`${status}\`\`__`)
        .setColor('#b90d1a')
        .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`prev_pugs_${userId}_${pollIndex}`)
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pollIndex === 1),
        new ButtonBuilder()
            .setCustomId(`next_pugs_${userId}_${pollIndex}`)
            .setEmoji('➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pollIndex === polls.length)
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: false });
}

// Function to handle 'pugs add' subcommand
async function handlePugsAdd(interaction) {
    const user = interaction.options.getUser('user');
    const type = interaction.options.getString('type');

    const member = await interaction.guild.members.fetch(user.id);
    const roleToAdd = type === 'trial' ? config.pugsTrialRoleId : config.pugsRoleId;
    const role = interaction.guild.roles.cache.get(roleToAdd);

    if (!role) {
        return interaction.reply({ content: 'Role not found.', ephemeral: true });
    }

    try {
        await member.roles.add(role);
        console.log(`Added PUGS role to ${user.id}`);

        const embed = new EmbedBuilder()
            .setDescription(`Added <@${user.id}> to <@&${role.id}>.`)
            .setColor('#b90d1a');

        await interaction.reply({ embeds: [embed], ephemeral: false });

        const votingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pugs-voting');
        if (votingChannel) {
            const votingEmbed = new EmbedBuilder()
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setTitle('PUGS Addition')
                .setDescription(`<@${user.id}> has been added to <@&${role.id}>`)
                .addFields({ name: 'Added by', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#b90d1a');

            await votingChannel.send({ embeds: [votingEmbed] });
        } else {
            console.error('pugs-voting channel not found.');
        }
    } catch (error) {
        console.error(`Error adding PUGS role to user ${user.id}:`, error);
        await interaction.reply({ content: 'Error adding PUGS role.', ephemeral: true });
    }
}

// Function to handle 'pugs remove' subcommand
async function handlePugsRemove(interaction) {
    const user = interaction.options.getUser('user');

    const member = await interaction.guild.members.fetch(user.id);
    const roles = [config.pugsRoleId, config.pugsTrialRoleId];
    const roleToRemove = roles.find(roleId => member.roles.cache.has(roleId));

    if (!roleToRemove) {
        return interaction.reply({ content: `<@${user.id}> does not have any PUGS roles.`, ephemeral: true });
    }

    const role = interaction.guild.roles.cache.get(roleToRemove);

    try {
        await member.roles.remove(role);
        console.log(`Removed PUGS role from user ${user.id}`);

        const embed = new EmbedBuilder()
            .setDescription(`Removed <@${user.id}> from <@&${role.id}>.`)
            .setColor('#e91e63');

        await interaction.reply({ embeds: [embed], ephemeral: false });

        const votingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pugs-voting');
        if (votingChannel) {
            const votingEmbed = new EmbedBuilder()
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setTitle('PUGS Removal')
                .setDescription(`<@${user.id}> has been removed from <@&${role.id}>`)
                .addFields({ name: 'Removed by', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#e91e63');

            await votingChannel.send({ embeds: [votingEmbed] });
        } else {
            console.error('pugs-voting channel not found.');
        }
    } catch (error) {
        console.error(`Error removing PUGS role from user ${user.id}:`, error);
        await interaction.reply({ content: 'Error removing PUGS role.', ephemeral: true });
    }
}

// Function to handle 'pugs list' subcommand
async function handlePugsList(interaction) {
    const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
    if (!pugsRole) {
        return interaction.reply({ content: 'PUGS role not found in this server.', ephemeral: true });
    }

    try {
        const membersWithRole = await interaction.guild.members.fetch();
        const membersArray = membersWithRole
            .filter(member => member.roles.cache.has(pugsRole.id))
            .map(member => member);

        const pageSize = 10;
        const totalPages = Math.ceil(membersArray.length / pageSize);

        if (totalPages === 0) {
            const noMembersEmbed = new EmbedBuilder()
                .setDescription('```ini\nNo members with PUGS role found.\n```')
                .setColor(0x980e00);
            return interaction.reply({ embeds: [noMembersEmbed], ephemeral: true });
        }

        let currentPage = 1; // Start with the first page
        const paginatedMembers = membersArray.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        const memberList = paginatedMembers
            .map((member, index) => `\`\`${index + 1 + (currentPage - 1) * pageSize}.\`\` <@${member.id}>`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'PUGS Members List', iconURL: interaction.guild.iconURL() })
            .setDescription(`Mode: **PUGS** [${currentPage}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
            .setFooter({
                text: `${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setColor('#b90d1a');

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`prev_pugs_${interaction.user.id}_${currentPage}`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 1),
            new ButtonBuilder()
                .setCustomId(`next_pugs_${interaction.user.id}_${currentPage}`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages)
        );

        await interaction.reply({
            embeds: [embed],
            components: [buttons],
            ephemeral: false,
        });
    } catch (error) {
        console.error('Error listing PUGS members:', error);
        await interaction.reply({ content: 'Error listing PUGS members.', ephemeral: true });
    }
}

module.exports = { handlePugsVote, handlePugsMyVote, handlePugsAdd, handlePugsRemove, handlePugsList };
