const { EmbedBuilder } = require('discord.js');

const exitChannelId = '1298246423665442928';

module.exports = (client) => {
    client.on('guildMemberRemove', member => {
        const exitChannel = member.guild.channels.cache.get(exitChannelId);
        if (!exitChannel) return;

        const leaveEmbed = new EmbedBuilder()
            .setColor('#8B0000')
            .setDescription(`# > ${member.user.username}\n> See you soon!`)
            .setFooter({
                text: `We now have ${member.guild.memberCount} members!`,
                iconURL: member.guild.iconURL(),
            })
            .setThumbnail(member.user.displayAvatarURL());

        exitChannel.send({
            content: `<@${member.user.id}> just left the server.`,
            embeds: [leaveEmbed],
        });
    });
};
