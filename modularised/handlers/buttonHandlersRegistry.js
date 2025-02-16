// handlers/buttonHandlersRegistry.js

const handleUnblacklistButton = require('./handleUnblacklistButton');
const { handlePremiumPagination } = require('./premiumPaginationHandler');
const pupsVoteHandler = require('./voting/pupsVoteHandler');
const pugsVoteHandler = require('./voting/pugsVoteHandler');
const { handlePagination: handleStaffPagination } = require('./staffListHandler');
const voteviewHandler = require('./voting/voteviewHandler');

const buttonHandlers = {


    // Unblacklist & Premium Pagination
    'unblacklist': handleUnblacklistButton,
    'prev_premium': handlePremiumPagination,
    'next_premium': handlePremiumPagination,

    // PUPS Vote Handlers
    'upvote_pups': pupsVoteHandler.handleUpvote,
    'downvote_pups': pupsVoteHandler.handleDownvote,
    'end_vote_pups': pupsVoteHandler.handleEndVote,
    'view_votes_pups': voteviewHandler.handleViewVotesButton,
    'add_to_pups': pupsVoteHandler.handleAddToPupsButton,
    'next_list_pups': pupsVoteHandler.handlePagination,
    'prev_list_pups': pupsVoteHandler.handlePagination,
    'next_myvote_pups': pupsVoteHandler.handleMyVotePagination,
    'prev_myvote_pups': pupsVoteHandler.handleMyVotePagination,

    // PUGS Vote Handlers
    'upvote_pugs': pugsVoteHandler.handleUpvote,
    'downvote_pugs': pugsVoteHandler.handleDownvote,
    'end_vote_pugs': pugsVoteHandler.handleEndVote,
    'add_to_pugs': pugsVoteHandler.handleAddToPugs,
    'add_to_pugs_trial': pugsVoteHandler.handleAddToPugs,
    'next_list_pugs': pugsVoteHandler.handlePagination,
    'prev_list_pugs': pugsVoteHandler.handlePagination,
    'next_myvote_pugs': pugsVoteHandler.handleMyVotePagination,
    'prev_myvote_pugs': pugsVoteHandler.handleMyVotePagination,

    // Staff List Handlers
    'stafflist_prev': handleStaffPagination,
    'stafflist_next': handleStaffPagination,

    // VoteView Handlers
    'voteview_prev': voteviewHandler.handlePrevButton,
    'voteview_next': voteviewHandler.handleNextButton,
    'voteview_viewvotes': voteviewHandler.handleViewVotesButton,
    'myvote_viewvotes': pugsVoteHandler.handleMyVoteViewVotes // only for pugs
};

module.exports = buttonHandlers;
