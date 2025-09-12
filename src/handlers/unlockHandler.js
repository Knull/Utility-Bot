const { EmbedBuilder } = require('discord.js');
const { getPermissionOverwrites } = require('../utilities/permissions');
const config = require('../config/config');

async function handleUnlockCommand(interaction, client) {
    if (!interaction.guild) {
        return interaction.reply({ content: 'This command can only be used within a server.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: false });
    const allowedRoleIds = [
        config.ManagerRoleId,
        config.HeadDeveloperRoleId,
        config.OwnerRoleId,
    ];
    const member = interaction.member;
    const hasPermission = member.roles.cache.some(role => allowedRoleIds.includes(role.id));

    if (!hasPermission) {
        const roleMentions = allowedRoleIds.map(roleId => `<@&${roleId}>`).join('\n');
        const embed = new EmbedBuilder()
            .setColor('#FF0000') 
            .setTitle('Insufficient Permissions')
            .setDescription(`Only members with the following roles can use this command:\n${roleMentions}`)
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed], ephemeral: true });
    }

    const channel = interaction.channel;
    try {
        console.log(`Channel ID from bot: ${channel.id} (Length: ${channel.id.length})`);
        const [rows] = await client.pool.query('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
        console.log(`Number of rows returned: ${rows.length}`);
        console.log('Rows:', rows);

        if (rows.length === 0) {
            return interaction.editReply({ content: 'This command can only be used in ticket channels.' });
        }

        const ticket = rows[0];
        const ticketOwnerId = ticket.user_id;
        const ticketOwner = await interaction.guild.members.fetch(ticketOwnerId).catch(() => null);
        const ticketType = ticket.ticket_type;
        const permissionOverwrites = getPermissionOverwrites(interaction.guild, ticketOwnerId, ticketType);
        await channel.permissionOverwrites.set(permissionOverwrites, 'Channel unlocked and permissions restored');
        const embed = new EmbedBuilder()
            .setColor('#1E90FF') 
            .setTitle('🔓 Channel Unlocked')
            .setDescription(`This channel has been unlocked and permissions have been restored.`)
            .setFooter({ text: `Unlocked by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();
        return interaction.editReply({
            embeds: [embed],
            ephemeral: false, 
        });
    } catch (error) {
        console.error(`Error in /unlock command: ${error}`);
        return interaction.editReply({ content: 'There was an error while trying to unlock the channel.' });
    }
}

module.exports = { handleUnlockCommand };
