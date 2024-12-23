const { EmbedBuilder } = require('discord.js');
const { getPermissionOverwrites } = require('../utilities/permissions');
const config = require('../config/config');

async function handleUnlockCommand(interaction, client) {
    // Ensure the command is used in a guild
    if (!interaction.guild) {
        return interaction.reply({ content: 'This command can only be used within a server.', ephemeral: true });
    }

    // Defer the reply to prevent the interaction from expiring
    await interaction.deferReply({ ephemeral: false });

    // Define roles that can use the command
    const allowedRoleIds = [
        config.ManagerRoleId,
        config.HeadDeveloperRoleId,
        config.OwnerRoleId,
    ];

    // Check if the user has one of the allowed roles
    const member = interaction.member;
    const hasPermission = member.roles.cache.some(role => allowedRoleIds.includes(role.id));

    if (!hasPermission) {
        // Fetch role mentions
        const roleMentions = allowedRoleIds.map(roleId => `<@&${roleId}>`).join('\n');

        // Create an embed to inform the user
        const embed = new EmbedBuilder()
            .setColor('#FF0000') // Red color for error
            .setTitle('Insufficient Permissions')
            .setDescription(`Only members with the following roles can use this command:\n${roleMentions}`)
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed], ephemeral: true });
    }

    const channel = interaction.channel;

    // Check if the channel is a ticket channel by querying the database
    try {
        console.log(`Channel ID from bot: ${channel.id} (Length: ${channel.id.length})`);
        const [rows] = await client.pool.query('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
        console.log(`Number of rows returned: ${rows.length}`);
        console.log('Rows:', rows);

        if (rows.length === 0) {
            return interaction.editReply({ content: 'This command can only be used in ticket channels.' });
        }

        const ticket = rows[0];

        // Fetch the ticket owner
        const ticketOwnerId = ticket.user_id;
        const ticketOwner = await interaction.guild.members.fetch(ticketOwnerId).catch(() => null);

        // Get the ticket type
        const ticketType = ticket.ticket_type;

        // Use getPermissionOverwrites to restore permissions
        const permissionOverwrites = getPermissionOverwrites(interaction.guild, ticketOwnerId, ticketType);

        // Update channel permissions
        await channel.permissionOverwrites.set(permissionOverwrites, 'Channel unlocked and permissions restored');

        // Create the embed with desired color and content
        const embed = new EmbedBuilder()
            .setColor('#1E90FF') // Dodger Blue (neon light blue)
            .setTitle('🔓 Channel Unlocked')
            .setDescription(`This channel has been unlocked and permissions have been restored.`)
            .setFooter({ text: `Unlocked by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        // Provide feedback to the user via embed
        return interaction.editReply({
            embeds: [embed],
            ephemeral: false, // Set to true if only the command executor should see the message
        });
    } catch (error) {
        console.error(`Error in /unlock command: ${error}`);
        return interaction.editReply({ content: 'There was an error while trying to unlock the channel.' });
    }
}

module.exports = { handleUnlockCommand };
