const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config/config');

async function sendBoostMessage(member) {
  try {
    const boostsChannel = member.guild.channels.cache.get(config.BoostsChannelId);
    if (!boostsChannel) return console.error("Boosts channel not found!");

    const heartRoleId = config.HeartRoleId || '1306597802377220149';
    const heartRole = await member.guild.roles.fetch(heartRoleId);
    const heartIconURL = heartRole?.iconURL() || '';

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Thanks for Boosting PRBW!', iconURL: heartIconURL })
      .setDescription(`<@&${config.BoosterRoleId}> **Perks**:
- **VC Bypass**: You can join any Game VC now!
- **A Custom Role**: You may request a custom role!
- \`=claimelo\`: A small token of our gratitude.
- **Exclusive Giveaways**: Giveaways just for you!`)
      .setFooter({
        text: member.user.username,
        iconURL: member.user.displayAvatarURL()
      })
      .setTimestamp()
      .setColor('#ff79ce');

    await boostsChannel.send({
      content: `<@${member.id}>`,
      embeds: [embed]
    });

    console.log(`Boost message sent for ${member.user.tag}`);
  } catch (error) {
    console.error("Error sending boost message:", error);
  }
}

module.exports = (client) => {
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      if (oldMember.partial) await oldMember.fetch();
      if (newMember.partial) await newMember.fetch();

      // Check if the user just started boosting
      if (!oldMember.premiumSince && newMember.premiumSince) {
        console.log('Member started boosting, sending message...');
        await sendBoostMessage(newMember);
      }
    } catch (error) {
      console.error("Error handling GuildMemberUpdate:", error);
    }
  });
};
