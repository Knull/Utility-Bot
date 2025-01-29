// handlers/buttonHandlersRegistry.js

const handleUnblacklistButton = require('./handleUnblacklistButton');
const { handlePremiumPagination } = require('./premiumPaginationHandler');
const { handleCreateTicketButton } = require('./tickets/handleCreateTicketButton');
const handleCloseTicketButton = require('./tickets/handleCloseTicketButton');
const handleClaimTicketButton = require('./tickets/handleClaimTicketButton');
const handleDeleteTicketButton = require('./tickets/handleDeleteTicketButton');
const handleReopenTicketButton = require('./tickets/handleReopenTicketButton');
const handleEvidenceButton = require('./tickets/handleEvidenceButton');
const handlePartnershipDetailsButton = require('./tickets/handlePartnershipDetailsButton');
const handleReportDetailsButton = require('./tickets/handleReportDetailsButton');
const handleShowTicketModal = require('./tickets/handleShowTicketModal');
const pupsVoteHandler = require('./voting/pupsVoteHandler');
const pugsVoteHandler = require('./voting/pugsVoteHandler');
const { handlePagination: handleStaffPagination } = require('./staffListHandler');
const voteviewHandler = require('./voting/voteviewHandler');

const buttonHandlers = {
    // Existing Handlers
    'unblacklist': handleUnblacklistButton,
    'prev_premium': handlePremiumPagination,
    'next_premium': handlePremiumPagination,
    'create_general': handleCreateTicketButton,
    'create_appeal': handleCreateTicketButton,
    'create_store': handleCreateTicketButton,
    'create_staff_report': handleCreateTicketButton,
    'create_partnership': handleCreateTicketButton,
    'close_ticket': handleCloseTicketButton,
    'claim_ticket': handleClaimTicketButton,
    'delete_ticket': handleDeleteTicketButton,
    'reopen_ticket': handleReopenTicketButton,
    'evidence': handleEvidenceButton, // Prefix 'evidence_'
    'partnership_details': handlePartnershipDetailsButton, // Prefix 'partnership_details_'
    'report_details': handleReportDetailsButton, // Prefix 'report_details_'
    'modal': handleShowTicketModal,
    
    // PUPS vote handlers
    'upvote_pups': pupsVoteHandler.handleUpvote,
    'downvote_pups': pupsVoteHandler.handleDownvote,
    'end_vote_pups': pupsVoteHandler.handleEndVote,
    'view_votes_pups': voteviewHandler.handleViewVotesButton, // Existing Handler
    'add_to_pups': pupsVoteHandler.handleAddToPupsButton,
    'next_list_pups': pupsVoteHandler.handlePagination,
    'prev_list_pups': pupsVoteHandler.handlePagination,
    'next_myvote_pups': pupsVoteHandler.handleMyVotePagination,
    'prev_myvote_pups': pupsVoteHandler.handleMyVotePagination,

    // PUGs Handlers
    'upvote_pugs': pugsVoteHandler.handleUpvote,
    'downvote_pugs': pugsVoteHandler.handleDownvote,
    'end_vote_pugs': pugsVoteHandler.handleEndVote,
    'add_to_pugs': pugsVoteHandler.handleAddToPugs,
    'add_to_pugs_trial': pugsVoteHandler.handleAddToPugs, // Assuming same handler for both types
    'next_list_pugs': pugsVoteHandler.handlePagination,
    'prev_list_pugs': pugsVoteHandler.handlePagination,
    'next_myvote_pugs': pugsVoteHandler.handleMyVotePagination,
    'prev_myvote_pugs': pugsVoteHandler.handleMyVotePagination,

    // Staff list handlers
    'stafflist_prev': handleStaffPagination,
    'stafflist_next': handleStaffPagination,

    // New VoteView Handlers
    'voteview_prev': voteviewHandler.handlePrevButton,
    'voteview_next': voteviewHandler.handleNextButton,
    'voteview_viewvotes': voteviewHandler.handleViewVotesButton,
    'myvote_viewvotes': pugsVoteHandler.handleMyVoteViewVotes, // only for pugs
};

module.exports = buttonHandlers;
