// utilities/reactionTracking.js
/**
 * utilities/reactionTracking.js
 */

async function getChannelReactionCount(userId, channelId, pool) {
    const query = `
        SELECT COUNT(DISTINCT message_id) AS reaction_count FROM translation_reactions
        WHERE user_id = ? AND channel_id = ? AND reaction_timestamp >= (NOW() - INTERVAL 60 SECOND)
    `;
    const [rows] = await pool.execute(query, [userId, channelId]);
    return rows.length > 0 ? rows[0].reaction_count : 0;
}

/**
 * Track the reaction for a user on a specific message and channel.
 * @param {string} userId 
 * @param {string} messageId 
 * @param {string} channelId 
 * @param {object} pool 
 */
async function trackReaction(userId, messageId, channelId, pool) {
    const query = `
        INSERT IGNORE INTO translation_reactions (user_id, message_id, channel_id, reaction_timestamp)
        VALUES (?, ?, ?, NOW())
    `;
    await pool.execute(query, [userId, messageId, channelId]);
}

/**
 * Check if a user has already reacted to a specific message in a channel.
 * @param {string} userId 
 * @param {string} messageId 
 * @param {string} channelId 
 * @param {object} pool 
 * @returns {boolean}
 */
async function hasUserReacted(userId, messageId, channelId, pool) {
    const query = `
        SELECT 1 FROM translation_reactions
        WHERE user_id = ? AND message_id = ? AND channel_id = ?
        LIMIT 1
    `;
    const [rows] = await pool.execute(query, [userId, messageId, channelId]);
    return rows.length > 0;
}

module.exports = {
    getChannelReactionCount,
    trackReaction,
    hasUserReacted,
};
