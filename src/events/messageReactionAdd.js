// handlers/messageReactionAddHandler.js
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const {
    isUserBlacklisted,
    blacklistUser,
    sendBlacklistNotification,
} = require('../utilities/translationBlacklistUtils');
const {
    getChannelReactionCount,
    trackReaction,
    hasUserReacted,
} = require('../utilities/reactionTracking');
const config = require('../config/config');

/**
 * Handles messageReactionAdd events for translation blacklist.
 * @param {MessageReaction} reaction 
 * @param {User} user 
 * @param {Client} client 
 */
async function handleMessageReactionAdd(reaction, user, client) {
    // Ignore bot reactions
    if (user.bot) return;

    console.log('Reaction added');

    // Fetch full reaction if partial
    if (reaction.partial) {
        try {
            await reaction.fetch();
            console.log('Partial reaction fetched successfully');
        } catch (error) {
            console.error('Error fetching partial reaction:', error);
            return;
        }
    }

    console.log(`Reaction added by ${user.tag} with emoji ${reaction.emoji.name}`);
    if (config.forbiddenTranslationChannels.includes(reaction.message.channel.id)) {
        console.log('Reaction is in a forbidden channel.');
        return;
    }
    if (reaction.emoji.id === '1298248723394068541') { // this is also hard coded, sorry im too lazy 
        console.log('Translation reaction detected.');

        const message = reaction.message;
        const originalText = message.content;

        if (!originalText) {
            console.log('No message content to translate.');
            return;
        }

        // Check if the user is blacklisted
        if (await isUserBlacklisted(user.id, client.pool)) {
            console.log(`User ${user.tag} is blacklisted.`);
            return;
        }
        // Check if the user has already reacted to this message
        if (await hasUserReacted(user.id, message.id, message.channel.id, client.pool)) {
            console.log(`User ${user.tag} has already reacted to this message. Ignoring.`);
            return;
        }
        await trackReaction(user.id, message.id, message.channel.id, client.pool);

        // Get the number of unique messages the user has reacted to in this channel within 60 seconds
        const channelReactionCount = await getChannelReactionCount(user.id, message.channel.id, client.pool);
        console.log(`User ${user.tag} has reacted to ${channelReactionCount} unique messages in this channel.`);

        // Blacklist if reactions reach threshold
        if (channelReactionCount >= 4) {
            await blacklistUser(
                user.id,
                message.id,
                message.channel.id,
                'Spamming translation emoji across different messages in the same channel within a short period',
                'System',
                false, // customDuration = false for automatic unblacklisting
                client.pool
            );
            await sendBlacklistNotification(client, user, message, 'Spamming translation emoji across different messages in the same channel within a short period', client.pool);
            console.log(`User ${user.tag} has been blacklisted for spamming translation reactions.`);
            return;
        }

        // Translation logic (only if the user is not blacklisted)
        // don't share this :)
        // this method might've been patched so idk
        try {
            console.log(`Original text: ${originalText}`);

            // Scrape Google Translate
            const url = `https://translate.google.com/m?hl=en&sl=auto&tl=en&ie=UTF-8&prev=_m&q=${encodeURIComponent(originalText)}`;
            const response = await axios.get(url);
            const dom = new JSDOM(response.data);

            // Extract translated text
            const translatedElement = dom.window.document.querySelector('.result-container');
            const translatedText = translatedElement ? translatedElement.textContent : null;

            // If translation failed
            if (!translatedText) {
                console.error('Failed to extract translation from the response.');
                await message.reply({ content: 'Failed to translate the message.', allowedMentions: { repliedUser: false } });
                return;
            }

            console.log(`Translated text: ${translatedText}`);

            const fromLang = 'auto';  // Auto-detect the source language (i couldn't find a way to customize this, if you do lmk)
            const embed = new EmbedBuilder()
                .setColor('#1a37db')
                .setAuthor({
                    name: message.author.username,
                    iconURL: message.author.displayAvatarURL({ dynamic: true })
                })
                .setDescription(`- **Original Text**\n> ${originalText}\n- **Translated**\n> ${translatedText}`)
                .setFooter({ text: `Translated from ${config.languageMap[fromLang] || fromLang} to English` })
                .setTimestamp();
            await message.reply({
                content: `<@${user.id}>`, 
                embeds: [embed],
                allowedMentions: { users: [user.id], repliedUser: false }  
            });    
        } catch (error) {
            console.error(error);
            await message.reply({ content: 'An error occurred while trying to translate the message.', allowedMentions: { repliedUser: false } });
        }
    } else {
        console.log('Reaction emoji does not match or reaction is from a bot.');
    }
}

module.exports = { handleMessageReactionAdd };
